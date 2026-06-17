import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { emitToBranch } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { ordersRepo } from '../orders/orders.repository.js';
import { paymentsRepo } from '../payments/payments.repository.js';
import { paymentSettingsService } from '../paymentSettings/paymentSettings.service.js';

/**
 * Razorpay-style webhook handler.
 *
 * Idempotency: every gateway delivers a unique `x-razorpay-event-id` (or
 * equivalent). We dedupe on (gateway, event_id) for 24h via Redis AND via
 * the unique index on Payment.webhookEventId.
 *
 * Signature: HMAC-SHA256 over the raw body using `webhookSecret` from the
 * tenant's PaymentSettings. Compare in constant time.
 *
 * Status mapping:
 *   payment.captured → SUCCESS
 *   payment.failed   → FAILED
 *   refund.processed → SUCCESS (on the REFUND row)
 *   refund.failed    → FAILED
 *
 * In dev / test we don't always have a configured secret — when none is
 * set the verifySignature step is skipped (the route still requires the
 * payload to look like a Razorpay webhook).
 */

function verifySignature({ rawBody, signature, secret }) {
  if (!secret) return true; // dev mode without a configured secret
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const STATUS_MAP = {
  'payment.captured': 'SUCCESS',
  'payment.authorized': 'SUCCESS',
  'payment.failed': 'FAILED',
  'refund.processed': 'SUCCESS',
  'refund.failed': 'FAILED',
};

export const webhooksService = {
  async handleRazorpay({ rawBody, signature, eventId, tenantId, actor }) {
    if (!tenantId) {
      throw AppError.badRequest('Webhook missing tenant context', 'WEBHOOK_TENANT_REQUIRED');
    }
    const settings = await paymentSettingsService.getInternal({ tenantId });
    const secret = settings?.webhookSecret ?? null;

    if (!verifySignature({ rawBody, signature, secret })) {
      throw AppError.unauthorized('Bad webhook signature', 'WEBHOOK_BAD_SIGNATURE');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw AppError.badRequest('Webhook body must be JSON', 'WEBHOOK_BAD_BODY');
    }

    const event = payload.event;
    const dedupeKey = `webhook:razorpay:${eventId ?? `${event}:${payload?.payload?.payment?.entity?.id ?? ''}`}`;
    try {
      const reserved = await redis.set(dedupeKey, '1', 'EX', 24 * 60 * 60, 'NX');
      if (!reserved) {
        return { duplicate: true, event };
      }
    } catch (err) {
      logger.warn('webhook.dedupe_failed', { message: err.message });
    }

    // Resolve the Payment row by reference (gateway payment id).
    const gatewayPaymentId = payload?.payload?.payment?.entity?.id;
    const gatewayRefundId = payload?.payload?.refund?.entity?.id;
    const reference = gatewayPaymentId ?? gatewayRefundId;
    if (!reference) {
      return { duplicate: false, event, ignored: true };
    }

    const existing = await paymentsRepo.findByReference({ tenantId, reference });
    const nextStatus = STATUS_MAP[event];
    if (!existing || !nextStatus) {
      // Already-processed via webhookEventId path
      const prior = await paymentsRepo.findByWebhookEvent({
        gateway: 'razorpay',
        webhookEventId: eventId ?? null,
      });
      if (prior) return { duplicate: true, event };
      return { duplicate: false, event, ignored: true };
    }

    const updated = await paymentsRepo.update({
      tenantId,
      id: existing.id,
      data: {
        status: nextStatus,
        webhookEventId: eventId ?? null,
        capturedAt: nextStatus === 'SUCCESS' ? new Date() : existing.capturedAt,
        failedReason:
          nextStatus === 'FAILED'
            ? payload?.payload?.payment?.entity?.error_description ?? 'gateway failure'
            : null,
        gatewayMeta: payload,
      },
    });

    await bumpVersion('payments');
    if (existing.orderId) {
      const order = await ordersRepo.findById({ tenantId, id: existing.orderId });
      if (order) {
        emitToBranch(order.branchId, 'payment:status', {
          orderId: order.id,
          paymentId: existing.id,
          status: nextStatus,
        });
        if (nextStatus === 'SUCCESS' && existing.type === 'SALE') {
          emitToBranch(order.branchId, 'order:paid', {
            orderId: order.id,
            total: Number(order.grandTotal),
            method: existing.method,
          });
        }
      }
    }

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action:
        nextStatus === 'FAILED'
          ? 'PAYMENT_FAILED'
          : nextStatus === 'SUCCESS' && existing.type === 'REFUND'
            ? 'PAYMENT_REFUNDED'
            : 'PAYMENT_CAPTURED',
      entityType: 'Payment',
      entityId: existing.id,
      metadata: { event, gateway: 'razorpay', eventId },
    });

    return { duplicate: false, event, payment: updated };
  },
};

export async function ensureWebhookContext(req) {
  // For dev we accept the tenant slug in a query param; in prod the gateway
  // would deliver to a tenant-specific URL like
  // /v1/webhooks/razorpay/:tenantSlug — easy to add later.
  const slug = req.query?.tenant ?? req.body?.tenantSlug;
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return tenant?.id ?? null;
}
