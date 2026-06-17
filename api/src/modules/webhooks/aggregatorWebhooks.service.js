import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';
import { getAdapter } from '../integrations/integrations.adapters.js';
import { integrationsRepo } from '../integrations/integrations.repository.js';
import { ordersService } from '../orders/orders.service.js';

/**
 * Aggregator inbound webhooks (Zomato / Swiggy).
 *
 * Flow: verify signature → dedupe via WebhookEvent (provider, externalId)
 * unique constraint → parse via the provider adapter → create an Order with
 * channel=ONLINE, source=<provider>. The unique constraint is the only thing
 * that prevents double-orders on retried deliveries (pitfall #2).
 */

function verifySignature({ rawBody, signature, secret }) {
  if (!secret) return true; // not connected / dev — accept
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

async function fallbackBranchId(tenantId) {
  const branch = await prisma.branch.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return branch?.id ?? null;
}

export const aggregatorWebhooksService = {
  async handle({ provider, rawBody, signature, tenantId }) {
    if (!tenantId) throw AppError.badRequest('Webhook missing tenant context', 'WEBHOOK_TENANT_REQUIRED');

    const integration = await integrationsRepo.findByProvider({ tenantId, provider });
    if (!verifySignature({ rawBody, signature, secret: integration?.webhookSecret })) {
      throw AppError.unauthorized('Bad webhook signature', 'WEBHOOK_BAD_SIGNATURE');
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw AppError.badRequest('Webhook body must be JSON', 'WEBHOOK_BAD_BODY');
    }

    const fallback = integration?.branchId ?? (await fallbackBranchId(tenantId));
    const parsed = getAdapter(provider).parseOrder(payload, { fallbackBranchId: fallback });
    if (!parsed || !parsed.externalId) {
      return { ignored: true };
    }
    if (!parsed.order.branchId) {
      throw AppError.badRequest('No branch to route the order to', 'WEBHOOK_NO_BRANCH');
    }

    // Idempotency: insert the event row first. A duplicate external id throws
    // P2002 → recordEvent returns created=false and we short-circuit.
    const { created, event } = await integrationsRepo.recordEvent({
      provider,
      externalId: parsed.externalId,
      integrationId: integration?.id ?? null,
      signature: signature ?? null,
      rawPayload: payload,
    });
    if (!created) {
      return { duplicate: true, externalId: parsed.externalId };
    }

    let order;
    try {
      order = await ordersService.create({
        tenantId,
        body: parsed.order,
        source: parsed.order.source,
        idempotencyKey: `${provider}:${parsed.externalId}`,
      });
    } catch (err) {
      await integrationsRepo.markEventProcessed({ id: event.id, errorMessage: err.message });
      logger.error('webhook.aggregator.order_failed', { provider, externalId: parsed.externalId, message: err.message });
      throw err;
    }

    await integrationsRepo.markEventProcessed({ id: event.id });
    if (integration) {
      await integrationsRepo.update({ id: integration.id, data: { lastSyncAt: new Date() } });
    }
    await auditService.record({
      tenantId,
      action: 'WEBHOOK_RECEIVED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { provider, externalId: parsed.externalId },
    });

    return { duplicate: false, orderId: order.id, serial: order.serial };
  },
};
