import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { campaignsService } from '../../modules/campaigns/campaigns.service.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Messaging worker — Phase H.
 *
 *   campaign-dispatch : fan-out a scheduled campaign at its send time.
 *   send-message      : outbound WhatsApp / SMS / Instagram reply. Stubbed —
 *                       logs the send; real provider clients land in a
 *                       follow-up. Marked delivered so the pipeline completes.
 */
export function startMessagingWorker() {
  const worker = new Worker(
    'messaging',
    async (job) => {
      if (job.name === 'campaign-dispatch') {
        return campaignsService.dispatch({ campaignId: job.data.campaignId });
      }
      if (job.name === 'send-message') {
        logger.info('messaging.send.start', {
          channel: job.data.channel,
          conversationId: job.data.conversationId,
          messageId: job.data.messageId,
        });
        // Provider dispatch goes here (Meta WhatsApp Cloud / Twilio / IG).
        return { sent: true, channel: job.data.channel };
      }
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 10,
      lockDuration: 120_000,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('messaging.worker.failed', { jobId: job.id, name: job.name, message: err.message, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'messaging', job, err });
  });
  worker.on('error', (err) => logger.error('messaging.worker.error', { message: err.message }));

  return worker;
}
