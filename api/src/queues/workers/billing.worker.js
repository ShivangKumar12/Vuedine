import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { billingService } from '../../modules/billing/billing.service.js';
import { scheduleBillingJobs } from '../billing.queue.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Billing worker — three scheduled jobs drive the SaaS billing lifecycle:
 *   billing.usage-capture  — hourly snapshot of usage metrics
 *   billing.invoice-cycle  — daily invoice generation on renewsAt
 *   billing.dunning        — daily past-due escalation (email → SMS → freeze)
 *
 * Repeatable schedules are registered on startup with stable jobIds.
 */
export function startBillingWorker() {
  const worker = new Worker(
    'billing',
    async (job) => {
      switch (job.name) {
        case 'billing.usage-capture': {
          const r = await billingService.runUsageCapture({});
          logger.info('billing.usage-capture.done', r);
          return r;
        }
        case 'billing.invoice-cycle': {
          const r = await billingService.runInvoiceCycle({ now: new Date() });
          logger.info('billing.invoice-cycle.done', r);
          return r;
        }
        case 'billing.dunning': {
          const r = await billingService.runDunning({ now: new Date() });
          logger.info('billing.dunning.done', r);
          return r;
        }
        default:
          return null;
      }
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 1,
      lockDuration: 60_000,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('billing.job.failed', { jobId: job.id, name: job?.name, message: err.message, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'billing', job, err });
  });

  worker.on('error', (err) => {
    logger.error('billing.worker.error', { message: err.message });
  });

  scheduleBillingJobs().catch((err) =>
    logger.error('billing.schedule_failed', { message: err.message }),
  );

  return worker;
}
