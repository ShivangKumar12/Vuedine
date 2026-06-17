import { getQueue } from './index.js';

/**
 * Email queue producers.
 *
 *   import { enqueueEmail, scheduleEmail, recurringEmail } from '@/queues/email.queue';
 *
 *   await enqueueEmail({
 *     to: 'aarav@example.com',
 *     subject: 'Welcome!',
 *     template: 'welcome',
 *     data: { name: 'Aarav' },
 *     requestId,
 *   });
 */

/** @param {import('./types.js').EmailJob} job */
export function enqueueEmail(job) {
  return getQueue('email').add('send', job, {
    // Job IDs make duplicates idempotent: a retry / reissue under the same id
    // gets dropped instead of producing two emails.
    // BullMQ disallows `:` in custom IDs, so we use `_` as separator.
    jobId: job.requestId ?? `email_${job.template}_${job.to}_${Date.now()}`,
  });
}

/** Schedule for a future moment. `runAt` is a Date. */
export function scheduleEmail(job, runAt) {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  return getQueue('email').add('send', job, { delay });
}

/**
 * Recurring email (cron pattern). BullMQ deduplicates by `jobId`, so calling
 * this on every app boot is safe — the schedule survives restarts.
 *
 *   recurringEmail('daily-digest', { ... }, '0 3 * * *');  // daily 3am UTC
 */
export function recurringEmail(name, job, cron) {
  return getQueue('email').add('send', job, {
    repeat: { pattern: cron, tz: 'UTC' },
    jobId: `recurring_email_${name}`,
  });
}
