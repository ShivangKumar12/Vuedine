import { PrismaClient } from '@prisma/client';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

import { prisma } from './prisma.js';

/**
 * Read replica client — used for analytics / reports / heavy aggregations.
 *
 * When DATABASE_REPLICA_URL is unset (dev / single-node prod), falls back to
 * the primary client. This means existing call sites can opt in to using the
 * replica without breaking when one isn't configured.
 *
 * Replica reads are eventually consistent (typical lag < 100ms). Use it only
 * for queries that tolerate that lag — never for live operational reads.
 */

let replica = null;
let warned = false;

export function getReadClient() {
  if (!env.DATABASE_REPLICA_URL) {
    if (!warned) {
      logger.debug('prismaReplica.fallback', {
        reason: 'DATABASE_REPLICA_URL not set, using primary',
      });
      warned = true;
    }
    return prisma;
  }

  if (replica) return replica;

  replica = new PrismaClient({
    datasources: { db: { url: env.DATABASE_REPLICA_URL } },
  });
  logger.info('prismaReplica.initialized');
  return replica;
}

export async function disconnectReplica() {
  if (replica) {
    await replica.$disconnect();
    replica = null;
  }
}
