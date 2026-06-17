import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { buildCustomerWhere, channelForCampaignType } from '../../modules/segments/audience.js';
import { segmentsService } from '../../modules/segments/segments.service.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { getQueue } from '../index.js';

/**
 * Segment-eval worker — Phase H.
 *
 *   recompute (every 5 min): refresh audienceSize for SCHEDULED campaigns so
 *   the dashboard reach numbers stay accurate as the customer base changes.
 */
async function recomputeScheduled() {
  const scheduled = await prisma.notificationCampaign.findMany({
    where: { status: 'SCHEDULED', deletedAt: null },
    select: { id: true, tenantId: true, type: true, audience: true, audienceQuery: true },
  });
  let updated = 0;
  for (const c of scheduled) {
    // eslint-disable-next-line no-await-in-loop
    const rule = await segmentsService.resolveRule({ tenantId: c.tenantId, audience: c.audience, audienceQuery: c.audienceQuery });
    const channel = channelForCampaignType(c.type);
    const where = buildCustomerWhere({ tenantId: c.tenantId, rule, requireConsent: true, channel });
    // eslint-disable-next-line no-await-in-loop
    const size = await prisma.user.count({ where });
    // eslint-disable-next-line no-await-in-loop
    await prisma.notificationCampaign.update({ where: { id: c.id }, data: { audienceSize: size } });
    updated += 1;
  }
  if (updated > 0) logger.info('segment-eval.recompute', { campaigns: updated });
  return { campaigns: updated };
}

export function startSegmentEvalWorker() {
  const worker = new Worker(
    'segment-eval',
    async (job) => {
      if (job.name === 'recompute') return recomputeScheduled();
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 1,
      lockDuration: 60_000,
    },
  );

  worker.on('error', (err) => logger.error('segment-eval.worker.error', { message: err.message }));

  (async () => {
    try {
      await getQueue('segment-eval').add(
        'recompute',
        {},
        { jobId: 'segment-eval-recompute', repeat: { every: 5 * 60_000 }, removeOnComplete: true, removeOnFail: true },
      );
      logger.info('segment-eval.recompute scheduled (every 5 min)');
    } catch (err) {
      logger.error('segment-eval.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
