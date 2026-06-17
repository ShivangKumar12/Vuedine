import { getQueue } from './index.js';

/** @param {import('./types.js').NotificationJob} job */
export function enqueueNotification(job) {
  return getQueue('notification').add('send', job);
}
