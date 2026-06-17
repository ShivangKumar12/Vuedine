import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { idempotency } from '../../middleware/idempotency.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { paymentsController } from './payments.controller.js';
import {
  compSchema,
  createPaymentSchema,
  idParamSchema,
  listSchema,
  recaptureSchema,
  refundSchema,
  settlementListSchema,
  settlementSyncSchema,
} from './payments.validators.js';

/**
 * Payments router — three roots:
 *   /v1/orders/:id/payments              POST   create payment for an order
 *   /v1/orders/:id/payments/:paymentId/refund  POST  refund
 *   /v1/orders/:id/comp                  POST   manager comp
 *   /v1/transactions                     GET    list / stats / detail
 *   /v1/payments/:id/recapture           POST   stuck-PENDING retry
 *   /v1/settlements                      GET / sync
 *
 * To keep the existing orders router decoupled from the payments module,
 * we expose this router and mount it under /v1 in the aggregator.
 */

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);
paymentsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/transactions:
 *   get:
 *     tags: [Payments]
 *     summary: Paginated payment ledger (Transactions page)
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: method
 *         in: query
 *         schema: { type: string, enum: [CASH, CARD, UPI, WALLET, ONLINE, LOYALTY] }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [SALE, REFUND, TIP, COMP, SETTLEMENT] }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, SUCCESS, FAILED, REFUNDED] }
 *     responses:
 *       200: { description: Page of transactions }
 */
paymentsRouter.get(
  '/transactions',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(listSchema),
  paymentsController.list,
);

/**
 * @openapi
 * /v1/transactions/stats:
 *   get:
 *     tags: [Payments]
 *     summary: Aggregate KPIs + method mix for the Transactions page header
 *     responses:
 *       200: { description: Stats }
 */
paymentsRouter.get(
  '/transactions/stats',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  paymentsController.stats,
);

/**
 * @openapi
 * /v1/transactions/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Single transaction detail
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Payment }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
paymentsRouter.get(
  '/transactions/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(idParamSchema),
  paymentsController.getById,
);

/**
 * @openapi
 * /v1/orders/{id}/payments:
 *   post:
 *     tags: [Payments]
 *     summary: Record a payment against an order (cash / card / upi / etc.)
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
paymentsRouter.post(
  '/orders/:id/payments',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  idempotency({ scope: 'payments' }),
  validate(createPaymentSchema),
  paymentsController.createForOrder,
);

/**
 * @openapi
 * /v1/orders/{id}/payments/{paymentId}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund (full or partial) against a successful sale
 *     responses:
 *       201: { description: Refund recorded }
 *       400: { description: Refund amount exceeds remaining }
 *       404: { description: Order or payment not found }
 */
paymentsRouter.post(
  '/orders/:id/payments/:paymentId/refund',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  idempotency({ scope: 'refunds' }),
  validate(refundSchema),
  paymentsController.refund,
);

/**
 * @openapi
 * /v1/orders/{id}/comp:
 *   post:
 *     tags: [Payments]
 *     summary: Manager comp — zero out part or all of the bill
 *     responses:
 *       201: { description: Comp recorded }
 */
paymentsRouter.post(
  '/orders/:id/comp',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  idempotency({ scope: 'comps' }),
  validate(compSchema),
  paymentsController.comp,
);

/**
 * @openapi
 * /v1/payments/{id}/recapture:
 *   post:
 *     tags: [Payments]
 *     summary: Re-attempt capture for a stuck PENDING payment
 *     responses:
 *       200: { description: Updated }
 */
paymentsRouter.post(
  '/payments/:id/recapture',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(recaptureSchema),
  paymentsController.recapture,
);

/**
 * @openapi
 * /v1/settlements:
 *   get:
 *     tags: [Payments]
 *     summary: List gateway settlement batches
 *     responses:
 *       200: { description: List }
 */
paymentsRouter.get(
  '/settlements',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(settlementListSchema),
  paymentsController.listSettlements,
);

/**
 * @openapi
 * /v1/settlements/sync/{gateway}:
 *   post:
 *     tags: [Payments]
 *     summary: Manual reconcile pull for a gateway
 *     responses:
 *       200: { description: Settlement created }
 *       404: { description: No new payments to settle }
 */
paymentsRouter.post(
  '/settlements/sync/:gateway',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(settlementSyncSchema),
  paymentsController.syncSettlement,
);
