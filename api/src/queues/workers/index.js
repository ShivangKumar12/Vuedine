import 'dotenv/config';

import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { disconnectDb } from '../../db/prisma.js';
import { disconnectRedis } from '../../db/redis.js';
import { emailService } from '../../modules/email/email.service.js';
import { closeQueues } from '../index.js';

import { startBillingWorker } from './billing.worker.js';
import { startEmailWorker } from './email.worker.js';
import { startHardwareWorker } from './hardware.worker.js';
import { startIntegrationWorker } from './integration.worker.js';
import { startMessagingWorker } from './messaging.worker.js';
import { startNotificationWorker } from './notification.worker.js';
import { startPromotionsWorker } from './promotions.worker.js';
import { startQrWorker } from './qr.worker.js';
import { startReportWorker } from './report.worker.js';
import { startSegmentEvalWorker } from './segmentEval.worker.js';
import { startSettingsWorker } from './settings.worker.js';
import { startUsersWorker } from './users.worker.js';
import { startWebhookWorker } from './webhook.worker.js';

/**
 * Worker process entrypoint.
 *
 *   npm run start:worker
 *
 * Runs in its own process (separate from the API), so a heavy report can't
 * affect API latency. PM2 ecosystem (Phase 8) launches N worker pods.
 */

logger.info('🚜 worker process starting', { env: config.env, pid: process.pid });

const workers = [
  startEmailWorker(),
  startNotificationWorker(),
  startReportWorker(),
  startWebhookWorker(),
  startPromotionsWorker(),
  startUsersWorker(),
  startSettingsWorker(),
  startHardwareWorker(),
  startQrWorker(),
  startMessagingWorker(),
  startSegmentEvalWorker(),
  startIntegrationWorker(),
  startBillingWorker(),
];

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`🛑 worker received ${signal}, draining`);

  // Hard deadline so a stuck job doesn't pin the process forever.
  const killer = setTimeout(() => {
    logger.error('worker shutdown timed out');
    process.exit(1);
  }, 30_000);
  killer.unref();

  try {
    // Worker.close() waits for active jobs to complete (up to lockDuration).
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await emailService.close();
    await disconnectDb();
    await disconnectRedis();
  } catch (err) {
    logger.error('worker shutdown error', { message: err.message });
  }
  logger.info('✅ worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('worker.unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
  });
});

process.on('uncaughtException', (err) => {
  logger.error('worker.uncaughtException', { stack: err.stack });
  shutdown('uncaughtException').catch(() => process.exit(1));
});
