import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { paymentSettingsSchema } from '../payments/payments.validators.js';

import { paymentSettingsController } from './paymentSettings.controller.js';

export const paymentSettingsRouter = Router();

paymentSettingsRouter.use(authMiddleware);
paymentSettingsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/settings/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Fetch tenant payment settings (Settings → Payments)
 *     responses:
 *       200: { description: PaymentSettings }
 *   patch:
 *     tags: [Payments]
 *     summary: Update tenant payment settings
 *     responses:
 *       200: { description: Updated }
 */
paymentSettingsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  paymentSettingsController.get,
);

paymentSettingsRouter.patch(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(paymentSettingsSchema),
  paymentSettingsController.update,
);
