import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { getAdapter } from '../../modules/integrations/integrations.adapters.js';
import { integrationsRepo } from '../../modules/integrations/integrations.repository.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Integration sync worker — runs provider `sync()` adapters (menu /
 * availability push). On success it stamps `lastSyncAt`; on failure it
 * records `lastError` and flips status to ERROR so the UI surfaces it.
 */
export function startIntegrationWorker() {
  const worker = new Worker(
    'integration',
    async (job) => {
      const { provider, integrationId } = job.data;
      logger.info('integration.sync.start', { jobId: job.id, provider });

      try {
        const result = await getAdapter(provider).sync(job.data);
        if (integrationId) {
          await integrationsRepo.update({
            id: integrationId,
            data: { status: 'CONNECTED', lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
          });
        }
        logger.info('integration.sync.ok', { jobId: job.id, provider });
        return result ?? { ok: true };
      } catch (err) {
        if (integrationId) {
          await integrationsRepo.update({
            id: integrationId,
            data: { status: 'ERROR', lastError: err.message, lastErrorAt: new Date() },
          });
        }
        throw err;
      }
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 5,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('integration.sync.failed', { jobId: job.id, message: err.message, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'integration', job, err });
  });

  worker.on('error', (err) => {
    logger.error('integration.worker.error', { message: err.message });
  });

  return worker;
}
