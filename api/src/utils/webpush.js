import webpush from 'web-push';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Web Push (VAPID) helper.
 *
 * Configured lazily from env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. When keys
 * aren't set (dev/test), sends are skipped and reported as `skipped` rather
 * than throwing — so the campaign pipeline still works end-to-end.
 */
let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export function isPushConfigured() {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/**
 * Send a push to one subscription.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, gone?: boolean, error?: string }>}
 *   gone=true means a 404/410 — the caller should delete the subscription.
 */
export async function sendWebPush(subscription, payload) {
  if (!ensureConfigured()) return { ok: false, skipped: true };
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) return { ok: false, gone: true };
    logger.warn('webpush.send_failed', { status, message: err?.message });
    return { ok: false, error: err?.message ?? 'send failed' };
  }
}
