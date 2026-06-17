import { getQueue } from './index.js';

/**
 * QR async jobs:
 *   - geoip-enrich : fill QrScan.city from the scanner IP (best-effort).
 *   - daily-rollup : rebuild scan/order aggregates for fast dashboard reads.
 */
export function enqueueGeoipEnrich({ scanId, ip }) {
  if (!ip) return Promise.resolve(null);
  return getQueue('qr').add('geoip-enrich', { scanId, ip }, { jobId: `geoip_${scanId}` });
}

export function scheduleQrDailyRollup() {
  return getQueue('qr').add(
    'daily-rollup',
    {},
    { jobId: 'qr-daily-rollup', repeat: { every: 24 * 60 * 60_000 }, removeOnComplete: true, removeOnFail: true },
  );
}
