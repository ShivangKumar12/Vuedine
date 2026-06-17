import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../config/logger.js';
import { redis } from '../../db/redis.js';
import { AppError } from '../../utils/AppError.js';
import { billingService } from '../billing/billing.service.js';
import { integrationsRepo } from '../integrations/integrations.repository.js';

/**
 * Billing webhook (Razorpay / Stripe subscription events).
 *
 * Maps gateway events to invoice + subscription state:
 *   invoice.paid / subscription.charged   → invoice PAID, subscription ACTIVE
 *   payment.failed / subscription.halted  → invoice FAILED, subscription PAST_DUE
 *
 * Signature verified against the tenant's connected billing integration
 * webhook secret (skipped in dev when none is set). Idempotent via Redis on
 * the gateway event id.
 */

const PAID_EVENTS = new Set(['invoice.paid', 'subscription.charged', 'order.paid', 'payment.captured']);
const FAILED_EVENTS = new Set(['payment.failed', 'subscription.halted', 'invoice.payment_failed']);

function verifySignature({ rawBody, signature, secret }) {
  if (!secret) return true;
  if (!signature) return false;
  try {
    const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const billingWebhooksService = {
  async handle({ rawBody, signature, eventId, tenantId }) {
    if (!tenantId) throw AppError.badRequest('Webhook missing tenant context', 'WEBHOOK_TENANT_REQUIRED');

    // Verify against the razorpay integration secret if connected.
    const integration = await integrationsRepo.findByProvider({ tenantId, provider: 'razorpay' });
    if (!verifySignature({ rawBody, signature, secret: integration?.webhookSecret })) {
      throw AppError.unauthorized('Bad webhook signature', 'WEBHOOK_BAD_SIGNATURE');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw AppError.badRequest('Webhook body must be JSON', 'WEBHOOK_BAD_BODY');
    }

    const event = payload.event ?? payload.type;
    const id = eventId ?? payload.id ?? `${event}:${payload?.payload?.payment?.entity?.id ?? ''}`;
    const dedupeKey = `webhook:billing:${id}`;
    try {
      const reserved = await redis.set(dedupeKey, '1', 'EX', 24 * 60 * 60, 'NX');
      if (!reserved) return { duplicate: true, event };
    } catch (err) {
      logger.warn('webhook.billing.dedupe_failed', { message: err.message });
    }

    const paymentRef =
      payload?.payload?.payment?.entity?.id ??
      payload?.payload?.invoice?.entity?.id ??
      payload?.data?.object?.id ??
      payload?.paymentRef ??
      null;

    if (PAID_EVENTS.has(event)) {
      const r = await billingService.applyPayment({ tenantId, paymentRef, success: true, gatewayEvent: event });
      return { duplicate: false, event, ...r };
    }
    if (FAILED_EVENTS.has(event)) {
      const r = await billingService.applyPayment({ tenantId, paymentRef, success: false, gatewayEvent: event });
      return { duplicate: false, event, ...r };
    }
    return { duplicate: false, event, ignored: true };
  },
};
