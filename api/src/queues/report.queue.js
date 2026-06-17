import { getQueue } from './index.js';

/** @param {import('./types.js').ReportJob} job */
export function enqueueReport(job) {
  return getQueue('report').add('generate', job, {
    // BullMQ disallows `:` in custom IDs.
    jobId: `report_${job.tenantId}_${job.branchId}_${job.type}_${job.range.from}_${job.range.to}`,
  });
}
