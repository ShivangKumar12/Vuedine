import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';
import { getQueue } from '../index.js';

/**
 * QR worker — Phase G async work.
 *
 *   geoip-enrich : best-effort fill of QrScan.city from the scanner IP. Uses a
 *                  free GeoIP HTTP API when reachable; silently skips otherwise
 *                  (no hard dependency, never blocks).
 *   daily-rollup : reconcile each QrCode.scans denorm against the QrScan table
 *                  so dashboard reads stay accurate even if a live increment was
 *                  dropped. Runs daily (repeatable).
 */

function isPrivateIp(ip) {
  if (!ip) return true;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:127.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  );
}

async function geoipEnrich({ scanId, ip }) {
  const clean = (ip ?? '').replace('::ffff:', '');
  if (!scanId || isPrivateIp(clean)) return { skipped: true };
  try {
    // ip-api.com: free, no key. Guard with a short timeout so a slow lookup
    // never pins the worker.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3_000);
    const res = await fetch(`http://ip-api.com/json/${clean}?fields=status,city`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { skipped: true };
    const data = await res.json();
    if (data.status === 'success' && data.city) {
      await prisma.qrScan.update({ where: { id: scanId }, data: { city: data.city } });
      return { city: data.city };
    }
  } catch {
    /* offline / blocked — skip silently */
  }
  return { skipped: true };
}

async function dailyRollup() {
  // Reconcile scans denorm with the source-of-truth scan log.
  const grouped = await prisma.qrScan.groupBy({ by: ['qrCodeId'], _count: { _all: true } });
  let fixed = 0;
  for (const g of grouped) {
    const real = g._count._all;
    const res = await prisma.qrCode.updateMany({
      where: { id: g.qrCodeId, scans: { not: real } },
      data: { scans: real },
    });
    fixed += res.count;
  }
  if (fixed > 0) logger.info('qr.daily-rollup', { reconciled: fixed });
  return { reconciled: fixed };
}

export function startQrWorker() {
  const worker = new Worker(
    'qr',
    async (job) => {
      if (job.name === 'geoip-enrich') return geoipEnrich(job.data);
      if (job.name === 'daily-rollup') return dailyRollup();
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 4,
      lockDuration: 30_000,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('qr.worker.failed', { jobId: job.id, name: job.name, message: err.message, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'qr', job, err });
  });
  worker.on('error', (err) => logger.error('qr.worker.error', { message: err.message }));

  (async () => {
    try {
      await getQueue('qr').add(
        'daily-rollup',
        {},
        { jobId: 'qr-daily-rollup', repeat: { every: 24 * 60 * 60_000 }, removeOnComplete: true, removeOnFail: true },
      );
      logger.info('qr.daily-rollup scheduled (daily)');
    } catch (err) {
      logger.error('qr.daily-rollup.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
