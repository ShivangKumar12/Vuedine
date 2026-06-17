import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { hardwareDevicesRepo } from '../../modules/hardwareDevices/hardwareDevices.repository.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { getQueue } from '../index.js';

/**
 * Hardware worker — Phase F async work.
 *
 *   heartbeat-check (every 60s): mark devices inactive when their last
 *   heartbeat is older than 5 minutes so the dashboard's online/offline dots
 *   reflect reality.
 */
const OFFLINE_AFTER_MS = 5 * 60_000;

export function startHardwareWorker() {
  const worker = new Worker(
    'hardware',
    async (job) => {
      if (job.name === 'heartbeat-check') {
        const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
        const res = await hardwareDevicesRepo.markStaleOffline({ olderThan: cutoff });
        if (res.count > 0) logger.info('hardware.heartbeat.flagged_offline', { count: res.count });
        return { flaggedOffline: res.count };
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

  worker.on('error', (err) => logger.error('hardware.worker.error', { message: err.message }));

  (async () => {
    try {
      await getQueue('hardware').add(
        'heartbeat-check',
        {},
        { jobId: 'hardware-heartbeat-check', repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: true },
      );
      logger.info('hardware.heartbeat-check scheduled (every 60s)');
    } catch (err) {
      logger.error('hardware.heartbeat.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
