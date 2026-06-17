import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { emailService } from '../../modules/email/email.service.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Email worker. Consumes `email` queue jobs and delivers via SMTP.
 *
 * Concurrency: 10 simultaneous jobs per worker process. With 2 worker pods
 * (Phase 8 ecosystem.config.js), that's 20 in-flight emails.
 *
 * SMTP rate limit: 100 sends/sec — most providers' burst cap. Adjust per
 * provider (SendGrid: 600/sec on Pro, Postmark: 250/sec base, etc.).
 */
export function startEmailWorker() {
  const worker = new Worker(
    'email',
    async (job) => {
      logger.info('email.send.start', {
        jobId: job.id,
        to: job.data.to,
        template: job.data.template,
      });

      await job.updateProgress(10);

      const result = await emailService.send({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template,
        data: job.data.data,
      });

      await job.updateProgress(100);

      logger.info('email.send.ok', {
        jobId: job.id,
        messageId: result.messageId,
      });
      return { messageId: result.messageId };
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 10,
      limiter: { max: 100, duration: 1000 },
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('email.send.failed', {
      jobId: job.id,
      message: err.message,
      attempt: job.attemptsMade,
      final: finalAttempt,
    });
    if (finalAttempt) await sendToDlq({ queueName: 'email', job, err });
  });

  worker.on('error', (err) => {
    logger.error('email.worker.error', { message: err.message });
  });

  return worker;
}
