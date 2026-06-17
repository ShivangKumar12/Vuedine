import { logger } from '../../config/logger.js';
import { redis } from '../../db/redis.js';
import { AppError } from '../../utils/AppError.js';
import { billingRepo } from '../billing/billing.repository.js';
import { billingService } from '../billing/billing.service.js';

/**
 * AI quota tracking (Phase K enforcement).
 *
 * The authoritative live counter lives in Redis, keyed per tenant + billing
 * month. Each chat increments it; the Subscription page reads the latest
 * UsageRollup snapshot we also write so usage shows up without Redis access.
 */

function periodKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function usageKey(tenantId, now = new Date()) {
  return `ai:usage:${tenantId}:${periodKey(now)}`;
}

async function quotaFor(tenantId) {
  const sub = await billingService.ensure({ tenantId });
  return { sub, quota: sub.aiQuota };
}

export const aiUsage = {
  async getUsed(tenantId) {
    try {
      const v = await redis.get(usageKey(tenantId));
      return v ? parseInt(v, 10) : 0;
    } catch (err) {
      logger.warn('ai.usage.read_failed', { message: err.message });
      return 0;
    }
  },

  async snapshot(tenantId) {
    const { quota } = await quotaFor(tenantId);
    const used = await this.getUsed(tenantId);
    return { used, limit: quota, remaining: Math.max(0, quota - used) };
  },

  /** Throw 402 when the tenant has no AI quota left. */
  async assertQuota(tenantId) {
    const { quota } = await quotaFor(tenantId);
    const used = await this.getUsed(tenantId);
    if (used >= quota) {
      throw new AppError(
        quota === 0
          ? 'Vuedine AI is not included on your plan. Upgrade to unlock the AI co-pilot.'
          : `You've used all ${quota} AI requests this month. Upgrade for more.`,
        {
          statusCode: 402,
          code: 'AI_QUOTA_EXCEEDED',
          details: { used, limit: quota, upgrade: '/dashboard/subscription' },
        },
      );
    }
  },

  /** Increment the live counter and snapshot it into a UsageRollup row. */
  async record(tenantId) {
    let used = 1;
    try {
      const key = usageKey(tenantId);
      used = await redis.incr(key);
      await redis.expire(key, 40 * 24 * 60 * 60);
    } catch (err) {
      logger.warn('ai.usage.incr_failed', { message: err.message });
    }
    try {
      const sub = await billingRepo.findSubscription({ tenantId });
      if (sub) await billingRepo.createUsageRollup({ subscriptionId: sub.id, metric: 'aiRequests', value: used });
    } catch (err) {
      logger.warn('ai.usage.rollup_failed', { message: err.message });
    }
    return used;
  },
};
