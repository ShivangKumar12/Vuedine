import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Webhook worker — outbound webhook delivery to integrations.
 *
 * High concurrency (30) and aggressive retries (6 attempts, 5s base backoff)
 * because aggregator / partner endpoints can be flaky. Once Phase 7 lands,
 * this delivers events to Zomato/Swiggy/Razorpay confirmation URLs.
 */
export function startWebhookWorker() {
  const worker = new Worker(
    'webhook',
    async (job) => {
      logger.info('webhook.deliver.start', {
        jobId: job.id,
        eventType: job.data.eventType,
        integrationId: job.data.integrationId,
      });

      // Stub: fetch() to the integration URL goes here in Phase 7+.
      await job.updateProgress(100);

      logger.info('webhook.deliver.ok', { jobId: job.id });
      return { delivered: true };
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 30,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('webhook.deliver.failed', {
      jobId: job.id,
      message: err.message,
      attempt: job.attemptsMade,
      final: finalAttempt,
    });
    if (finalAttempt) await sendToDlq({ queueName: 'webhook', job, err });
  });

  worker.on('error', (err) => {
    logger.error('webhook.worker.error', { message: err.message });
  });

  return worker;
}
