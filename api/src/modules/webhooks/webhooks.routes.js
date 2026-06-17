import express, { Router } from 'express';

import { globalRateLimit } from '../../middleware/rateLimit.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { aggregatorWebhooksService } from './aggregatorWebhooks.service.js';
import { billingWebhooksService } from './billingWebhooks.service.js';
import { messagingWebhooksService } from './messagingWebhooks.service.js';
import { ensureWebhookContext, webhooksService } from './webhooks.service.js';

/**
 * Webhook routes — these need the RAW body (Buffer) for HMAC signature
 * verification. We mount express.raw() locally on each handler so the
 * global JSON parser doesn't consume the body first.
 */

export const webhooksRouter = Router();

webhooksRouter.use(globalRateLimit);

const rawJson = express.raw({ type: '*/*', limit: '1mb' });

/**
 * @openapi
 * /v1/webhooks/razorpay:
 *   post:
 *     tags: [Payments]
 *     summary: Razorpay webhook (signature-verified, idempotent)
 *     security: []
 *     parameters:
 *       - name: tenant
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Processed }
 *       401: { description: Bad signature }
 */
webhooksRouter.post(
  '/razorpay',
  rawJson,
  asyncHandler(async (req, res) => {
    const tenantId = await ensureWebhookContext(req);
    const result = await webhooksService.handleRazorpay({
      rawBody: req.body,
      signature: req.get('x-razorpay-signature') ?? null,
      eventId: req.get('x-razorpay-event-id') ?? null,
      tenantId,
    });
    res.json(ok(req, result));
  }),
);

/* ------------------------------------------------------------------ */
/*  Messaging ingest — WhatsApp / SMS / Instagram (Phase H)           */
/* ------------------------------------------------------------------ */

function messagingHandler(channel) {
  return asyncHandler(async (req, res) => {
    const tenantId = await ensureWebhookContext(req);
    const result = await messagingWebhooksService.handle({
      channel,
      rawBody: req.body,
      signature:
        req.get('x-hub-signature-256') ??
        req.get('x-twilio-signature') ??
        req.get('x-signature') ??
        null,
      tenantId,
    });
    res.json(ok(req, result));
  });
}

/**
 * @openapi
 * /v1/webhooks/whatsapp:
 *   post:
 *     tags: [Messages]
 *     summary: WhatsApp inbound message webhook (signature-verified, idempotent)
 *     security: []
 *     parameters:
 *       - { name: tenant, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Ingested }
 *       401: { description: Bad signature }
 */
webhooksRouter.post('/whatsapp', rawJson, messagingHandler('WHATSAPP'));

/**
 * @openapi
 * /v1/webhooks/sms:
 *   post:
 *     tags: [Messages]
 *     summary: SMS inbound message webhook
 *     security: []
 *     responses:
 *       200: { description: Ingested }
 */
webhooksRouter.post('/sms', rawJson, messagingHandler('SMS'));

/**
 * @openapi
 * /v1/webhooks/instagram:
 *   post:
 *     tags: [Messages]
 *     summary: Instagram DM inbound message webhook
 *     security: []
 *     responses:
 *       200: { description: Ingested }
 */
webhooksRouter.post('/instagram', rawJson, messagingHandler('INSTAGRAM'));

/* ------------------------------------------------------------------ */
/*  Aggregator ingest — Zomato / Swiggy (Phase J)                     */
/* ------------------------------------------------------------------ */

function aggregatorHandler(provider) {
  return asyncHandler(async (req, res) => {
    const tenantId = await ensureWebhookContext(req);
    const result = await aggregatorWebhooksService.handle({
      provider,
      rawBody: req.body,
      signature: req.get('x-webhook-signature') ?? req.get('x-zomato-signature') ?? req.get('x-swiggy-signature') ?? null,
      tenantId,
    });
    res.json(ok(req, result));
  });
}

/**
 * @openapi
 * /v1/webhooks/zomato:
 *   post:
 *     tags: [Integrations]
 *     summary: Zomato order webhook — creates an ONLINE order (signature-verified, idempotent)
 *     security: []
 *     parameters:
 *       - { name: tenant, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Order created or duplicate }
 *       401: { description: Bad signature }
 */
webhooksRouter.post('/zomato', rawJson, aggregatorHandler('zomato'));

/**
 * @openapi
 * /v1/webhooks/swiggy:
 *   post:
 *     tags: [Integrations]
 *     summary: Swiggy order webhook — creates an ONLINE order (signature-verified, idempotent)
 *     security: []
 *     parameters:
 *       - { name: tenant, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Order created or duplicate }
 *       401: { description: Bad signature }
 */
webhooksRouter.post('/swiggy', rawJson, aggregatorHandler('swiggy'));

/* ------------------------------------------------------------------ */
/*  Billing ingest — Razorpay / Stripe subscription events (Phase K)  */
/* ------------------------------------------------------------------ */

/**
 * @openapi
 * /v1/webhooks/billing:
 *   post:
 *     tags: [Billing]
 *     summary: SaaS billing webhook — marks invoices paid/failed (signature-verified, idempotent)
 *     security: []
 *     parameters:
 *       - { name: tenant, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Processed }
 *       401: { description: Bad signature }
 */
webhooksRouter.post(
  '/billing',
  rawJson,
  asyncHandler(async (req, res) => {
    const tenantId = await ensureWebhookContext(req);
    const result = await billingWebhooksService.handle({
      rawBody: req.body,
      signature: req.get('x-razorpay-signature') ?? req.get('stripe-signature') ?? null,
      eventId: req.get('x-razorpay-event-id') ?? null,
      tenantId,
    });
    res.json(ok(req, result));
  }),
);
