import { PrismaClient } from '@prisma/client';

import { config, env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Prisma client singleton.
 *
 *  - log levels mapped to our logger
 *  - slow-query warning threshold from env (default 200ms)
 *  - soft-delete via Prisma Client `$extends`:
 *      - read queries (find*, count, aggregate, groupBy) auto-filter `deletedAt = null`
 *      - delete / deleteMany are overridden to call update under the hood,
 *        setting `deletedAt = now()` instead of issuing a real DELETE.
 *  - connection pool sizing controlled via `?connection_limit=` in DATABASE_URL
 *
 *  In dev / test, hot-reload would otherwise spawn a new client every save,
 *  exhausting Postgres. The `globalForPrisma` cache keeps a single instance
 *  alive across module reloads.
 *
 *  Escape hatches when you really do need to bypass:
 *  - `where: { deletedAt: { not: null } }` to find soft-deleted rows
 *  - `prisma.$executeRaw\`DELETE FROM ...\`` for hard-delete (use sparingly)
 */

/** Models with a `deletedAt: DateTime?` column that should never hard-delete. */
const SOFT_DELETE_MODELS = ['tenant', 'branch', 'user', 'item'];

function readFilter({ args, query }) {
  const next = { ...(args ?? {}) };
  const where = next.where ?? {};
  if (where.deletedAt === undefined) {
    next.where = { ...where, deletedAt: null };
  }
  return query(next);
}

function buildClient() {
  const base = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  /* ------------ Logging ------------ */

  base.$on('query', (e) => {
    if (env.DATABASE_LOG_QUERIES) {
      logger.debug('prisma.query', {
        query: e.query,
        params: e.params,
        durationMs: e.duration,
      });
    }
    if (e.duration >= env.DATABASE_SLOW_QUERY_MS) {
      logger.warn('prisma.slow_query', {
        query: e.query,
        params: e.params,
        durationMs: e.duration,
      });
    }
  });

  base.$on('warn', (e) => logger.warn('prisma.warn', { message: e.message }));
  base.$on('error', (e) => logger.error('prisma.error', { message: e.message }));

  /* ------------ Soft-delete read filter ------------ */
  const queryHandlers = SOFT_DELETE_MODELS.reduce((acc, name) => {
    acc[name] = {
      $allOperations({ operation, args, query }) {
        switch (operation) {
          case 'findUnique':
          case 'findUniqueOrThrow':
          case 'findFirst':
          case 'findFirstOrThrow':
          case 'findMany':
          case 'count':
          case 'aggregate':
          case 'groupBy':
            return readFilter({ args, query });
          default:
            return query(args);
        }
      },
    };
    return acc;
  }, {});

  const withReadFilter = base.$extends({
    name: 'softDelete-read',
    query: queryHandlers,
  });

  /* ------------ Soft-delete write overrides ------------
   *
   *   prisma.user.delete({ where: { id } })
   *     → internally: prisma.user.update({ where: { id }, data: { deletedAt: now() }})
   *
   * `this` inside the method is the extended model client, so `this.update` is
   * available and Prisma's typings line up automatically.
   */
  const withWriteOverrides = withReadFilter.$extends({
    name: 'softDelete-write',
    model: {
      tenant: softDeleteOverrides(),
      branch: softDeleteOverrides(),
      user: softDeleteOverrides(),
      item: softDeleteOverrides(),
    },
  });

  return withWriteOverrides;
}

function softDeleteOverrides() {
  return {
    async delete({ where, select, include } = {}) {
      return this.update({
        where,
        data: { deletedAt: new Date() },
        ...(select ? { select } : {}),
        ...(include ? { include } : {}),
      });
    },
    async deleteMany({ where } = {}) {
      return this.updateMany({
        where: where ?? {},
        data: { deletedAt: new Date() },
      });
    },
  };
}

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__vuedinePrisma ?? buildClient();
if (!config.isProd) globalForPrisma.__vuedinePrisma = prisma;

/**
 * Health probe — fast SELECT 1.
 * Used by /ready to confirm DB connectivity.
 */
export async function pingDb() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

/** Graceful shutdown helper. Called from server.js on SIGTERM. */
export async function disconnectDb() {
  await prisma.$disconnect();
}
