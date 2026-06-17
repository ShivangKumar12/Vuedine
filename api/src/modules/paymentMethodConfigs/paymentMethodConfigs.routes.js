import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { paymentMethodConfigsController } from './paymentMethodConfigs.controller.js';
import { idParamSchema, listSchema, upsertSchema } from './paymentMethodConfigs.validators.js';

export const paymentMethodConfigsRouter = Router();

paymentMethodConfigsRouter.use(authMiddleware);
paymentMethodConfigsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/payment-method-configs:
 *   get:
 *     tags: [Settings]
 *     summary: List per-method payment configs (tenant default + branch overrides)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Settings]
 *     summary: Create or update a payment-method config (upsert)
 *     responses:
 *       201: { description: Upserted }
 */
paymentMethodConfigsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(listSchema),
  paymentMethodConfigsController.list,
);

paymentMethodConfigsRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(upsertSchema),
  paymentMethodConfigsController.upsert,
);

/**
 * @openapi
 * /v1/payment-method-configs/{id}:
 *   delete:
 *     tags: [Settings]
 *     summary: Delete a payment-method config
 *     responses:
 *       204: { description: Deleted }
 */
paymentMethodConfigsRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  paymentMethodConfigsController.remove,
);
