import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { redis } from '../../db/redis.js';
import { AppError } from '../../utils/AppError.js';
import { conversationsService } from '../conversations/conversations.service.js';

/**
 * Inbound messaging webhooks (WhatsApp / SMS / Instagram).
 *
 * Signature: HMAC-SHA256 over the raw body using the provider secret from env.
 * No secret configured → verification skipped (dev), matching the razorpay
 * webhook behaviour. Idempotency via Redis NX on the provider message id.
 */

const SECRETS = {
  WHATSAPP: () => env.WHATSAPP_WEBHOOK_SECRET,
  SMS: () => env.SMS_WEBHOOK_SECRET,
  INSTAGRAM: () => env.INSTAGRAM_WEBHOOK_SECRET,
};

function verifySignature({ rawBody, signature, secret }) {
  if (!secret) return true;
  if (!signature) return false;
  try {
    // Meta sends "sha256=<hex>"; strip the prefix if present.
    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Normalize provider payloads into a flat inbound message. Supports the common
 * Meta / Twilio shapes plus a simple `{ from, name, body, messageId, conversationId }`
 * fallback used by tests and the WEBCHAT widget.
 */
function normalize(channel, payload) {
  // Simple/normalized shape
  if (payload && (payload.body || payload.message) && (payload.from || payload.phone)) {
    return {
      from: payload.from ?? payload.phone,
      name: payload.name ?? null,
      body: payload.body ?? payload.message,
      externalMessageId: payload.messageId ?? payload.id ?? null,
      externalConversationId: payload.conversationId ?? null,
    };
  }

  // WhatsApp Cloud API
  if (channel === 'WHATSAPP') {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (msg) {
      return {
        from: msg.from ?? null,
        name: value?.contacts?.[0]?.profile?.name ?? null,
        body: msg.text?.body ?? msg.button?.text ?? '[media message]',
        externalMessageId: msg.id ?? null,
        externalConversationId: value?.metadata?.phone_number_id ? `${value.metadata.phone_number_id}:${msg.from}` : null,
      };
    }
  }

  // Instagram / Messenger
  if (channel === 'INSTAGRAM') {
    const m = payload?.entry?.[0]?.messaging?.[0];
    if (m?.message) {
      return {
        from: m.sender?.id ?? null,
        name: null,
        body: m.message?.text ?? '[media message]',
        externalMessageId: m.message?.mid ?? null,
        externalConversationId: m.sender?.id ?? null,
      };
    }
  }

  return null;
}

export const messagingWebhooksService = {
  async handle({ channel, rawBody, signature, tenantId }) {
    if (!tenantId) throw AppError.badRequest('Webhook missing tenant context', 'WEBHOOK_TENANT_REQUIRED');
    const secret = SECRETS[channel]?.();
    if (!verifySignature({ rawBody, signature, secret })) {
      throw AppError.unauthorized('Bad webhook signature', 'WEBHOOK_BAD_SIGNATURE');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw AppError.badRequest('Webhook body must be JSON', 'WEBHOOK_BAD_BODY');
    }

    const msg = normalize(channel, payload);
    if (!msg || !msg.body) {
      return { ignored: true };
    }

    // Idempotency on the provider message id.
    if (msg.externalMessageId) {
      const dedupeKey = `webhook:${channel.toLowerCase()}:${msg.externalMessageId}`;
      try {
        const reserved = await redis.set(dedupeKey, '1', 'EX', 24 * 60 * 60, 'NX');
        if (!reserved) return { duplicate: true };
      } catch (err) {
        logger.warn('webhook.dedupe_failed', { message: err.message });
      }
    }

    const result = await conversationsService.ingestInbound({
      tenantId,
      channel,
      externalConversationId: msg.externalConversationId,
      externalMessageId: msg.externalMessageId,
      from: msg.from,
      name: msg.name,
      body: msg.body,
    });
    return { duplicate: false, ...result };
  },
};
