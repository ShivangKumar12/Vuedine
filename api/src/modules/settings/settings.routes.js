import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { settingsController } from './settings.controller.js';
import {
  anonymizeSchema,
  brandingSchema,
  localizationSchema,
  tenantSchema,
} from './settings.validators.js';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);
settingsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Settings bundle — tenant identity, branding, localization, tax slabs, payment methods
 *     responses:
 *       200: { description: Settings bundle }
 */
settingsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF'),
  settingsController.bundle,
);

/**
 * @openapi
 * /v1/settings/tenant:
 *   patch:
 *     tags: [Settings]
 *     summary: Update restaurant identity + invoice/receipt config
 *     responses:
 *       200: { description: Updated tenant settings }
 */
settingsRouter.patch(
  '/tenant',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(tenantSchema),
  settingsController.updateTenant,
);

/**
 * @openapi
 * /v1/settings/branding:
 *   patch:
 *     tags: [Settings]
 *     summary: Update branding (color, theme, custom domain, logo, banner)
 *     responses:
 *       200: { description: Updated }
 */
settingsRouter.patch(
  '/branding',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(brandingSchema),
  settingsController.updateBranding,
);

/**
 * @openapi
 * /v1/settings/localization:
 *   patch:
 *     tags: [Settings]
 *     summary: Update localization (currency, timezone, locale, week start)
 *     responses:
 *       200: { description: Updated }
 */
settingsRouter.patch(
  '/localization',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(localizationSchema),
  settingsController.updateLocalization,
);

/**
 * @openapi
 * /v1/settings/data/export:
 *   post:
 *     tags: [Settings]
 *     summary: Queue a full tenant data export (emailed to owner)
 *     responses:
 *       202: { description: Export queued }
 */
settingsRouter.post(
  '/data/export',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  settingsController.exportData,
);

/**
 * @openapi
 * /v1/settings/data/anonymize-tenant:
 *   post:
 *     tags: [Settings]
 *     summary: GDPR close-tenant — scrub tenant + customer PII (requires confirm)
 *     responses:
 *       200: { description: Anonymized }
 */
settingsRouter.post(
  '/data/anonymize-tenant',
  requireRole('SUPER_ADMIN', 'OWNER'),
  validate(anonymizeSchema),
  settingsController.anonymizeTenant,
);
