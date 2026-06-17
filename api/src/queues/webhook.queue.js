import { getQueue } from './index.js';

/** @param {import('./types.js').WebhookJob} job */
export function enqueueWebhook(job) {
  return getQueue('webhook').add('deliver', job);
}
