import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { notificationPreferencesController } from './notificationPreferences.controller.js';
import { bulkSchema, listSchema } from './notificationPreferences.validators.js';

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.use(authMiddleware);
notificationPreferencesRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/notification-preferences:
 *   get:
 *     tags: [Settings]
 *     summary: Read the notification matrix (events × channels)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: userId
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: Preferences }
 */
notificationPreferencesRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(listSchema),
  notificationPreferencesController.list,
);

/**
 * @openapi
 * /v1/notification-preferences/bulk:
 *   post:
 *     tags: [Settings]
 *     summary: Set the whole notification matrix in one call
 *     responses:
 *       200: { description: Updated preferences }
 */
notificationPreferencesRouter.post(
  '/bulk',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(bulkSchema),
  notificationPreferencesController.bulkSet,
);
