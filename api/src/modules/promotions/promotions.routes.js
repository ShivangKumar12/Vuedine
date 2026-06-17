import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { promotionsController } from './promotions.controller.js';
import {
  applyCouponSchema,
  autoOffersSchema,
  createSchema,
  idParamSchema,
  listSchema,
  updateSchema,
} from './promotions.validators.js';

/**
 * Promotions router.
 *   /v1/promotions             GET list / POST create
 *   /v1/promotions/:id         GET / PATCH / DELETE
 *   /v1/promotions/:id/pause   POST
 *   /v1/promotions/:id/resume  POST
 *   /v1/cart/apply-coupon      POST — validate + discount preview
 *   /v1/cart/auto-offers       POST — applicable auto offers for a cart
 *
 * Mounted at the v1 root because it owns both /promotions and /cart paths.
 */

export const promotionsRouter = Router();

promotionsRouter.use(authMiddleware);
promotionsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/promotions:
 *   get:
 *     tags: [Promotions]
 *     summary: List promotions (coupons + offers)
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [COUPON, OFFER] }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, SCHEDULED, PAUSED, EXPIRED, ENDED] }
 *       - name: kind
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Promotions]
 *     summary: Create a coupon or offer
 *     responses:
 *       201: { description: Created }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { description: Code already taken }
 */
promotionsRouter.get(
  '/promotions',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(listSchema),
  promotionsController.list,
);

promotionsRouter.post(
  '/promotions',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(createSchema),
  promotionsController.create,
);

/**
 * @openapi
 * /v1/promotions/{id}:
 *   get:
 *     tags: [Promotions]
 *     summary: Fetch a single promotion
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Promotion }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Promotions]
 *     summary: Update a promotion (partial)
 *     responses:
 *       200: { description: Updated }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Promotions]
 *     summary: Soft-delete a promotion (redemptions stay intact)
 *     responses:
 *       204: { description: Deleted }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
promotionsRouter.get(
  '/promotions/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(idParamSchema),
  promotionsController.getById,
);

promotionsRouter.patch(
  '/promotions/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(updateSchema),
  promotionsController.update,
);

promotionsRouter.delete(
  '/promotions/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  promotionsController.remove,
);

/**
 * @openapi
 * /v1/promotions/{id}/pause:
 *   post:
 *     tags: [Promotions]
 *     summary: Pause an active/scheduled promotion
 *     responses:
 *       200: { description: Paused }
 */
promotionsRouter.post(
  '/promotions/:id/pause',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  promotionsController.pause,
);

/**
 * @openapi
 * /v1/promotions/{id}/resume:
 *   post:
 *     tags: [Promotions]
 *     summary: Resume a paused promotion
 *     responses:
 *       200: { description: Resumed }
 *       400: { description: Window has passed }
 */
promotionsRouter.post(
  '/promotions/:id/resume',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  promotionsController.resume,
);

/**
 * @openapi
 * /v1/cart/apply-coupon:
 *   post:
 *     tags: [Promotions]
 *     summary: Validate a coupon against a cart and return discount preview
 *     responses:
 *       200: { description: Discount preview }
 *       400: { description: Coupon ineligible }
 *       404: { description: Code not found }
 *       409: { description: Per-user limit reached }
 */
promotionsRouter.post(
  '/cart/apply-coupon',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(applyCouponSchema),
  promotionsController.applyCoupon,
);

/**
 * @openapi
 * /v1/cart/auto-offers:
 *   post:
 *     tags: [Promotions]
 *     summary: List auto-apply offers applicable to a cart right now
 *     responses:
 *       200: { description: Applicable offers + computed discounts }
 */
promotionsRouter.post(
  '/cart/auto-offers',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(autoOffersSchema),
  promotionsController.autoOffers,
);
