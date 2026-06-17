import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { pushService } from '../../modules/push/push.service.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Notification worker — fans out to push / SMS / WhatsApp.
 *
 * Push is delivered for real via web-push (when VAPID is configured); SMS /
 * WhatsApp land as their own provider integrations (logged for now).
 */
export function startNotificationWorker() {
  const worker = new Worker(
    'notification',
    async (job) => {
      const { channel, userId, tenantId, title, body, data } = job.data;
      logger.info('notification.send.start', { jobId: job.id, channel, userId });

      await job.updateProgress(50);

      if (channel === 'push' && userId && tenantId) {
        const result = await pushService.sendToUser({
          tenantId,
          userId,
          payload: { title, body, url: data?.url ?? '/dashboard' },
        });
        logger.info('notification.send.ok', { jobId: job.id, channel, ...result });
        return { delivered: result.delivered > 0, ...result };
      }

      // SMS / WhatsApp provider dispatch lands as a follow-up integration.
      logger.info('notification.send.ok', { jobId: job.id, channel });
      return { delivered: true };
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 20,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('notification.send.failed', {
      jobId: job.id,
      message: err.message,
      attempt: job.attemptsMade,
      final: finalAttempt,
    });
    if (finalAttempt) await sendToDlq({ queueName: 'notification', job, err });
  });

  worker.on('error', (err) => {
    logger.error('notification.worker.error', { message: err.message });
  });

  return worker;
}
