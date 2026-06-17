import { getQueue } from './index.js';

/**
 * Settings async jobs:
 *   - export-tenant-data : long-running ZIP build → S3 → email owner.
 *   - demo-reset         : hourly wipe when tenant.demoMode = true.
 */

export function enqueueTenantExport({ tenantId, requestedBy }) {
  return getQueue('settings').add(
    'export-tenant-data',
    { tenantId, requestedBy, at: new Date().toISOString() },
    { jobId: `export_${tenantId}_${Date.now()}` },
  );
}

export function enqueueDemoReset({ tenantId }) {
  return getQueue('settings').add(
    'demo-reset',
    { tenantId },
    { jobId: `demoreset_${tenantId}_${Date.now()}` },
  );
}

/** Repeatable hourly demo-reset sweep across all demo tenants. */
export function scheduleDemoResetSweep() {
  return getQueue('settings').add(
    'demo-reset-sweep',
    {},
    { repeat: { every: 60 * 60_000 }, jobId: 'demo-reset-sweep' },
  );
}
