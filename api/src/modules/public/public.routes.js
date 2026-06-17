import { Router } from 'express';
import { z } from 'zod';

import { idempotency } from '../../middleware/idempotency.middleware.js';
import { globalRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { publicController } from './public.controller.js';

export const publicRouter = Router();

publicRouter.use(globalRateLimit);

const resolveSchema = z.object({
  params: z.object({
    branchSlug: z.string().min(2).max(80),
    qrToken: z.string().min(8).max(40),
  }),
});

const menuSchema = z.object({
  params: z.object({
    branchSlug: z.string().min(2).max(80),
  }),
  query: z.object({
    category: z.string().max(60).optional(),
    search: z.string().max(80).optional(),
  }),
});

const calculateSchema = z.object({
  body: z.object({
    branchSlug: z.string().min(2).max(80),
    qrToken: z.string().min(8).max(40).optional(),
    lines: z
      .array(
        z.object({
          itemId: z.string().min(1).optional().nullable(),
          itemName: z.string().min(1).max(120),
          emoji: z.string().max(8).optional().nullable(),
          qty: z.coerce.number().int().min(1).max(50),
          unitPrice: z.coerce.number().min(0).max(100000),
          variantId: z.string().max(60).optional().nullable(),
          variantLabel: z.string().max(120).optional().nullable(),
          addons: z
            .array(
              z.object({
                id: z.string().max(60),
                label: z.string().max(120),
                price: z.coerce.number().min(0),
              }),
            )
            .optional()
            .nullable(),
          notes: z.string().max(300).optional().nullable(),
          category: z.string().max(60).optional().nullable(),
          spice: z.coerce.number().int().min(1).max(3).optional().nullable(),
        }),
      )
      .min(1)
      .max(50),
    promoCode: z.string().max(40).optional().nullable(),
    tipAmount: z.coerce.number().min(0).optional(),
    tipPct: z.coerce.number().min(0).max(50).optional(),
  }),
});

const placeSchema = z.object({
  body: calculateSchema.shape.body.extend({
    qrToken: z.string().min(8).max(40),
    guestName: z.string().max(120).optional().nullable(),
    guestPhone: z.string().max(40).optional().nullable(),
    payMode: z.enum(['pay-at-counter', 'pay-now-upi', 'pay-now-card']).optional(),
  }),
});

const orderIdParamSchema = z.object({
  params: z.object({ orderId: z.string().min(8).max(40) }),
});

const applyCouponSchema = z.object({
  body: z.object({
    branchSlug: z.string().min(2).max(80),
    code: z.string().trim().min(1).max(40),
    customerId: z.string().max(120).optional().nullable(),
    lines: z
      .array(
        z.object({
          itemId: z.string().max(40).optional().nullable(),
          itemName: z.string().max(160).optional().nullable(),
          category: z.string().max(60).optional().nullable(),
          qty: z.coerce.number().int().min(1).max(50),
          unitPrice: z.coerce.number().min(0).max(100000),
        }),
      )
      .min(1)
      .max(50),
  }),
});

const signalSchema = z.object({
  params: z.object({ orderId: z.string().min(8).max(40) }),
  body: z.object({
    type: z.enum(['WAITER_RING', 'BILL_REQUEST', 'FEEDBACK', 'HELP']),
    message: z.string().max(500).optional().nullable(),
    rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  }),
});

/**
 * @openapi
 * /v1/public/qr/{branchSlug}/{qrToken}:
 *   get:
 *     tags: [Public]
 *     summary: Resolve a QR scan to a branch + table
 *     security: []
 *     responses:
 *       200: { description: Branch + Table }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
publicRouter.get(
  '/qr/:branchSlug/:qrToken',
  validate(resolveSchema),
  publicController.resolveQr,
);

/**
 * @openapi
 * /v1/public/menu/{branchSlug}:
 *   get:
 *     tags: [Public]
 *     summary: Public menu for a branch (active items only)
 *     security: []
 *     responses:
 *       200: { description: Menu }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
publicRouter.get(
  '/menu/:branchSlug',
  validate(menuSchema),
  publicController.getMenu,
);

/**
 * @openapi
 * /v1/public/orders/calculate:
 *   post:
 *     tags: [Public]
 *     summary: Quote totals for a guest cart (server-authoritative tax/service/tip)
 *     security: []
 *     responses:
 *       200: { description: Totals }
 */
publicRouter.post(
  '/orders/calculate',
  validate(calculateSchema),
  publicController.calculate,
);

/**
 * @openapi
 * /v1/public/cart/apply-coupon:
 *   post:
 *     tags: [Public]
 *     summary: Validate a coupon for a guest cart (discount preview)
 *     security: []
 *     responses:
 *       200: { description: Discount preview }
 *       400: { description: Coupon ineligible }
 *       404: { description: Code not found }
 */
publicRouter.post(
  '/cart/apply-coupon',
  validate(applyCouponSchema),
  publicController.applyCoupon,
);

/**
 * @openapi
 * /v1/public/orders:
 *   post:
 *     tags: [Public]
 *     summary: Place a guest order (PWA / QR)
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Idempotency conflict }
 */
publicRouter.post(
  '/orders',
  idempotency({ scope: 'public-orders' }),
  validate(placeSchema),
  publicController.placeOrder,
);

/**
 * @openapi
 * /v1/public/orders/{orderId}:
 *   get:
 *     tags: [Public]
 *     summary: Track an order (status + ETA + items + bill)
 *     security: []
 *     responses:
 *       200: { description: Order }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
publicRouter.get(
  '/orders/:orderId',
  validate(orderIdParamSchema),
  publicController.trackOrder,
);

/**
 * @openapi
 * /v1/public/orders/{orderId}/signal:
 *   post:
 *     tags: [Public]
 *     summary: Ring waiter / request bill / submit feedback
 *     security: []
 *     responses:
 *       201: { description: Signal recorded }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
publicRouter.post(
  '/orders/:orderId/signal',
  validate(signalSchema),
  publicController.signal,
);
