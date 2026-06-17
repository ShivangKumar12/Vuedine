import { logger } from '../config/logger.js';

import { getQueue } from './index.js';

/**
 * Dead Letter Queue helper.
 *
 * BullMQ already retains failed jobs per queue, but a dedicated DLQ gives us:
 *   - one place to monitor exhausted retries across all queues
 *   - a consistent shape (`DlqJob`) for human inspection / manual replay
 *   - an obvious metric (`dlq` queue depth) for alerting
 *
 * Usage from worker `failed` handlers:
 *
 *   w.on('failed', (job, err) => {
 *     if (job.attemptsMade >= job.opts.attempts) {
 *       sendToDlq({ queueName: w.name, job, err });
 *     }
 *   });
 */
export async function sendToDlq({ queueName, job, err }) {
  try {
    /** @type {import('./types.js').DlqJob} */
    const payload = {
      originalQueue: queueName,
      originalJobName: job.name,
      originalJobId: String(job.id),
      originalData: job.data,
      reason: err?.message ?? String(err),
      stack: err?.stack,
      finalAttempt: job.attemptsMade,
      timestamp: new Date().toISOString(),
    };
    await getQueue('dlq').add('failed', payload);
    logger.warn('dlq.job_added', {
      originalQueue: queueName,
      originalJobId: String(job.id),
      reason: payload.reason,
    });
  } catch (e) {
    logger.error('dlq.add_failed', { message: e.message });
  }
}
