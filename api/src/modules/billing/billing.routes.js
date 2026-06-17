import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { billingController } from './billing.controller.js';
import { addonParamSchema, changePlanSchema, invoiceParamSchema } from './billing.validators.js';

const VIEW = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];
const OWNER_ONLY = ['SUPER_ADMIN', 'OWNER'];
const MANAGE = ['SUPER_ADMIN', 'OWNER', 'ADMIN'];

/* ---- /v1/subscription ---- */
export const subscriptionRouter = Router();
subscriptionRouter.use(authMiddleware);
subscriptionRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/subscription:
 *   get:
 *     tags: [Billing]
 *     summary: Current plan, usage, addons and recent invoices
 *     responses:
 *       200: { description: Subscription snapshot }
 */
subscriptionRouter.get('/', requireRole(...VIEW), billingController.current);

/**
 * @openapi
 * /v1/subscription/change-plan:
 *   post:
 *     tags: [Billing]
 *     summary: Change plan / billing cycle (OWNER only). Upgrades trigger a gateway mandate.
 *     responses:
 *       200: { description: Updated subscription + optional invoice + mandate }
 *       402: { description: Plan limit exceeded on downgrade }
 */
subscriptionRouter.post('/change-plan', requireRole(...OWNER_ONLY), validate(changePlanSchema), billingController.changePlan);

/**
 * @openapi
 * /v1/subscription/cancel:
 *   post: { tags: [Billing], summary: Cancel (stays active until renewal), responses: { 200: { description: Cancelled } } }
 */
subscriptionRouter.post('/cancel', requireRole(...OWNER_ONLY), billingController.cancel);

/**
 * @openapi
 * /v1/subscription/resume:
 *   post: { tags: [Billing], summary: Resume a cancelled subscription, responses: { 200: { description: Resumed } } }
 */
subscriptionRouter.post('/resume', requireRole(...OWNER_ONLY), billingController.resume);

/**
 * @openapi
 * /v1/subscription/addons/{id}/toggle:
 *   post: { tags: [Billing], summary: Toggle an add-on, responses: { 200: { description: Toggled } } }
 */
subscriptionRouter.post('/addons/:id/toggle', requireRole(...MANAGE), validate(addonParamSchema), billingController.toggleAddon);

/* ---- /v1/invoices ---- */
export const invoicesRouter = Router();
invoicesRouter.use(authMiddleware);
invoicesRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/invoices:
 *   get: { tags: [Billing], summary: List invoices, responses: { 200: { description: List } } }
 */
invoicesRouter.get('/', requireRole(...VIEW), billingController.listInvoices);

/**
 * @openapi
 * /v1/invoices/{id}:
 *   get: { tags: [Billing], summary: Single invoice, responses: { 200: { description: Invoice }, 404: { description: Not found } } }
 */
invoicesRouter.get('/:id', requireRole(...VIEW), validate(invoiceParamSchema), billingController.getInvoice);

/**
 * @openapi
 * /v1/invoices/{id}/download:
 *   get: { tags: [Billing], summary: Download invoice PDF, responses: { 200: { description: PDF } } }
 */
invoicesRouter.get('/:id/download', requireRole(...VIEW), validate(invoiceParamSchema), billingController.downloadInvoice);
