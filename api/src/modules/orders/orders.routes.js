import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { idempotency } from '../../middleware/idempotency.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { ordersController } from './orders.controller.js';
import {
  calculateSchema,
  cancelSchema,
  createSchema,
  idParamSchema,
  listSchema,
  setLinePreparedSchema,
  setStatusSchema,
  updateSchema,
} from './orders.validators.js';

export const ordersRouter = Router();

ordersRouter.use(authMiddleware);
ordersRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/orders/calculate:
 *   post:
 *     tags: [Orders]
 *     summary: Compute server-authoritative totals for a draft cart
 *     description: |
 *       Returns subtotal / tax / service / tip / discount / grand total
 *       given branch + line items + optional promo / tip / discount.
 *       Does not create anything. Used by POS + Checkout for live totals.
 *     responses:
 *       200: { description: Totals }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { description: Branch not found }
 */
ordersRouter.post(
  '/calculate',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(calculateSchema),
  ordersController.calculate,
);

/**
 * @openapi
 * /v1/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders (filterable + paginated)
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, ACCEPTED, PREPARING, READY, OUT_FOR_DELIVERY, DELIVERED, SERVED, CANCELLED] }
 *       - name: channel
 *         in: query
 *         schema: { type: string, enum: [POS, WAITER, QR, ONLINE] }
 *       - name: source
 *         in: query
 *         schema: { type: string, enum: [POS, WAITER, QR, ZOMATO, SWIGGY, VUEDINE_DIRECT, WHATSAPP, QR_PAY] }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [DINE_IN, TAKEAWAY, DELIVERY] }
 *       - name: active
 *         in: query
 *         description: 'true → in-flight only; false → terminal only'
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200: { description: Page of orders }
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order
 *     description: |
 *       Server is authoritative for money. Pass `Idempotency-Key` to dedupe
 *       retries (24h window).
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string, minLength: 8, maxLength: 128 }
 *     responses:
 *       201: { description: Created }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { description: Idempotency-Key reused with a different body }
 */
ordersRouter.get(
  '/',
  validate(listSchema),
  ordersController.list,
);

ordersRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  idempotency({ scope: 'orders' }),
  validate(createSchema),
  ordersController.create,
);

/**
 * @openapi
 * /v1/orders/stats:
 *   get:
 *     tags: [Orders]
 *     summary: Aggregate KPIs for live orders header (counts by status + revenue)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: Stats }
 */
ordersRouter.get('/stats', ordersController.stats);

/**
 * @openapi
 * /v1/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Fetch a single order with items + events
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Order }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Orders]
 *     summary: Update non-status fields (notes, priority, payment, delivery)
 *     responses:
 *       200: { description: Updated }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
ordersRouter.get('/:id', validate(idParamSchema), ordersController.getById);

ordersRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(updateSchema),
  ordersController.update,
);

/**
 * @openapi
 * /v1/orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Move order between states (PENDING → ACCEPTED → PREPARING → READY → SERVED/DELIVERED)
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid transition }
 */
ordersRouter.patch(
  '/:id/status',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF'),
  validate(setStatusSchema),
  ordersController.setStatus,
);

/**
 * @openapi
 * /v1/orders/{id}/advance:
 *   post:
 *     tags: [Orders]
 *     summary: Move the order to the next happy-path state
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Order is in a terminal state }
 */
ordersRouter.post(
  '/:id/advance',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF'),
  validate(idParamSchema),
  ordersController.advance,
);

/**
 * @openapi
 * /v1/orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel the order with optional reason
 *     responses:
 *       200: { description: Cancelled }
 *       400: { description: Already terminal }
 */
ordersRouter.post(
  '/:id/cancel',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(cancelSchema),
  ordersController.cancel,
);

/**
 * @openapi
 * /v1/orders/{id}/recall:
 *   post:
 *     tags: [Orders]
 *     summary: Recall a READY order back to PREPARING (kitchen mistake)
 *     responses:
 *       200: { description: Recalled }
 *       400: { description: Invalid transition }
 */
ordersRouter.post(
  '/:id/recall',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CHEF'),
  validate(idParamSchema),
  ordersController.recall,
);

/**
 * @openapi
 * /v1/orders/{id}/lines/{lineId}/prepared:
 *   patch:
 *     tags: [Orders]
 *     summary: Toggle a single line item as prepared (KDS)
 *     description: When the last line of an order flips to prepared, the order auto-advances to READY.
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Order or line not found }
 */
ordersRouter.patch(
  '/:id/lines/:lineId/prepared',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CHEF'),
  validate(setLinePreparedSchema),
  ordersController.setLinePrepared,
);
