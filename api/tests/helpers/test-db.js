import { execSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

/**
 * Test database lifecycle.
 *
 * Strategy:
 *   - Migrations applied once via `prisma migrate deploy` at first connect.
 *   - Between tests, `TRUNCATE ... RESTART IDENTITY CASCADE` wipes user data
 *     while preserving the schema (much faster than `migrate reset`).
 *   - The Prisma client itself is a process-singleton; opening 1000s of
 *     connections per test would exhaust the pool.
 *
 * We rely on a fresh `vuedine_test` Postgres database (separate from dev's
 * `vuedine`). Initial provisioning happens via `npm run test:db:setup`.
 */

let prisma = null;

export async function setupTestDb() {
  if (prisma) return prisma;

  // Apply migrations to the test DB. `migrate deploy` is non-interactive and
  // skips schema-drift detection — perfect for CI.
  // eslint-disable-next-line security/detect-child-process -- DB URL comes from env, not user input
  execSync('npx prisma migrate deploy', {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: process.env,
  });

  prisma = new PrismaClient();
  await prisma.$connect();
  return prisma;
}

/**
 * Truncate every user table. Fast (~10ms) and atomic.
 *
 * Why DO $$ block instead of a static list?
 *   The schema evolves — orders/payments/inventory tables are added in later
 *   phases. A discovery loop means we don't have to update this script.
 */
export async function resetTestDb() {
  if (!prisma) throw new Error('setupTestDb() must run first');
  // eslint-disable-next-line no-restricted-properties -- static admin SQL with no user input
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function teardownTestDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export function getPrisma() {
  if (!prisma) throw new Error('setupTestDb() must run first');
  return prisma;
}
