import { getQueue } from './index.js';

/**
 * Billing schedulers. Three repeatable jobs drive the billing lifecycle:
 *   billing.invoice-cycle  — daily   (generate invoices on renewsAt)
 *   billing.usage-capture  — hourly  (snapshot usage metrics)
 *   billing.dunning        — daily   (past-due escalation: email/sms/freeze)
 *
 * Registered with stable jobIds so restarting the worker doesn't pile up
 * duplicate schedules.
 */
export async function scheduleBillingJobs() {
  const q = getQueue('billing');
  await q.add('billing.usage-capture', {}, {
    jobId: 'billing-usage-capture',
    repeat: { every: 60 * 60_000 }, // hourly
    removeOnComplete: true,
    removeOnFail: true,
  });
  await q.add('billing.invoice-cycle', {}, {
    jobId: 'billing-invoice-cycle',
    repeat: { every: 24 * 60 * 60_000 }, // daily
    removeOnComplete: true,
    removeOnFail: true,
  });
  await q.add('billing.dunning', {}, {
    jobId: 'billing-dunning',
    repeat: { every: 24 * 60 * 60_000 }, // daily
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export function enqueueBillingJob(name, data = {}) {
  return getQueue('billing').add(name, data, { removeOnComplete: true });
}
