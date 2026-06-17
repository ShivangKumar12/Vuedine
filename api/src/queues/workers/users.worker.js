import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { getQueue } from '../index.js';

/**
 * Users worker — Phase E async work.
 *
 *   users.tick (every 60 min):
 *     1. Expire invite tokens older than 72h (set status DELETED if never accepted).
 *     2. Auto-tag 'lapsed' when lastOrderAt > 60 days — removes tag if newer.
 *     3. Recompute customer tier based on rolling 12-month spend.
 */

const TIER_THRESHOLDS = [
  { tier: 'PLATINUM', min: 100_000 },  // ₹1,00,000 / year
  { tier: 'GOLD',     min:  50_000 },
  { tier: 'SILVER',   min:  15_000 },
  { tier: 'BRONZE',   min:       0 },
];

function computeTier(spend) {
  const n = Number(spend ?? 0);
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (n >= min) return tier;
  }
  return 'BRONZE';
}

async function expireInvites() {
  const expired = await prisma.user.updateMany({
    where: {
      status: 'INVITED',
      inviteExpiresAt: { lt: new Date() },
    },
    data: { inviteToken: null, inviteExpiresAt: null },
  });
  return expired.count;
}

async function tagLapsed() {
  const cutoff = new Date(Date.now() - 60 * 86400_000);
  // Add 'lapsed' to profiles whose last order was > 60d ago
  const lapsed = await prisma.customerProfile.findMany({
    where: { lastOrderAt: { lt: cutoff, not: null } },
    select: { id: true, tags: true },
  });
  let tagged = 0;
  for (const cp of lapsed) {
    if (!cp.tags.includes('lapsed')) {
      await prisma.customerProfile.update({
        where: { id: cp.id },
        data: { tags: [...cp.tags, 'lapsed'] },
      });
      tagged += 1;
    }
  }
  // Remove 'lapsed' from recently active customers
  const active = await prisma.customerProfile.findMany({
    where: { lastOrderAt: { gte: cutoff }, tags: { has: 'lapsed' } },
    select: { id: true, tags: true },
  });
  let untagged = 0;
  for (const cp of active) {
    await prisma.customerProfile.update({
      where: { id: cp.id },
      data: { tags: cp.tags.filter((t) => t !== 'lapsed') },
    });
    untagged += 1;
  }
  return { tagged, untagged };
}

async function recomputeTiers() {
  const year = new Date();
  year.setFullYear(year.getFullYear() - 1);

  // Aggregate spend for each customer from orders in the last 12 months
  const spends = await prisma.order.groupBy({
    by: ['guestPhone'],
    where: {
      createdAt: { gte: year },
      status: { notIn: ['CANCELLED'] },
      guestPhone: { not: null },
    },
    _sum: { grandTotal: true },
  });

  let updated = 0;
  for (const row of spends) {
    if (!row.guestPhone) continue;
    const spend = Number(row._sum.grandTotal ?? 0);
    const tier = computeTier(spend);
    const result = await prisma.customerProfile.updateMany({
      where: { user: { phone: row.guestPhone } },
      data: { tier, totalSpend: spend },
    });
    updated += result.count;
  }
  return updated;
}

export function startUsersWorker() {
  const worker = new Worker(
    'users',
    async (job) => {
      if (job.name === 'users.tick') {
        const invitesExpired = await expireInvites();
        const { tagged, untagged } = await tagLapsed();
        const tiersUpdated = await recomputeTiers();
        if (invitesExpired + tagged + untagged + tiersUpdated > 0) {
          logger.info('users.tick', { invitesExpired, tagged, untagged, tiersUpdated });
        }
        return { invitesExpired, tagged, untagged, tiersUpdated };
      }
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 1,
      lockDuration: 120_000,
    },
  );

  worker.on('error', (err) => {
    logger.error('users.worker.error', { message: err.message });
  });

  (async () => {
    try {
      const q = getQueue('users');
      // Hourly tick
      await q.add('users.tick', {}, {
        jobId: 'users-tick',
        repeat: { every: 3600_000 },
        removeOnComplete: true,
        removeOnFail: true,
      });
      // Immediate first run
      await q.add('users.tick', {}, { removeOnComplete: true });
      logger.info('users.tick scheduled (every 60 min)');
    } catch (err) {
      logger.error('users.tick.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
