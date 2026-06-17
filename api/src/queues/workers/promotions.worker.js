import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { promotionsService } from '../../modules/promotions/promotions.service.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { getQueue } from '../index.js';

/**
 * Promotions worker — Phase D async work.
 *
 *   promotion.tick   — runs every minute (repeatable). Flips:
 *                        SCHEDULED → ACTIVE   when startsAt arrives
 *                        ACTIVE    → EXPIRED  when endsAt passes
 *
 * The repeatable job is registered on worker startup with a fixed jobId so
 * restarting the worker doesn't pile up duplicate schedules.
 *
 * (`promotion.birthday-trigger` daily job is stubbed for Phase H — when the
 * customer entity + email integration land it will enqueue the auto-coupon
 * emails. We register the schedule slot here so the cron exists.)
 */
export function startPromotionsWorker() {
  const worker = new Worker(
    'promotions',
    async (job) => {
      if (job.name === 'promotion.tick') {
        const now = new Date();
        const activated = await promotionsService.activateScheduled({ now });
        const expired = await promotionsService.expirePast({ now });
        if (activated > 0 || expired > 0) {
          logger.info('promotion.tick', { activated, expired });
        }
        return { activated, expired };
      }
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 1,
      lockDuration: 30_000,
    },
  );

  worker.on('error', (err) => {
    logger.error('promotions.worker.error', { message: err.message });
  });

  // Register the repeatable tick (every 60s). Stable jobId prevents dupes.
  (async () => {
    try {
      const q = getQueue('promotions');
      await q.add(
        'promotion.tick',
        {},
        {
          jobId: 'promotion-tick',
          repeat: { every: 60_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      // Kick one immediate run so a fresh boot reconciles status right away.
      await q.add('promotion.tick', {}, { removeOnComplete: true });
      logger.info('promotion.tick scheduled (every 60s)');
    } catch (err) {
      logger.error('promotion.tick.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
