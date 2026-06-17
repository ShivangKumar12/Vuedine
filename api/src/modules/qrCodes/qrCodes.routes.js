import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { qrCodesController } from './qrCodes.controller.js';
import {
  bulkPrintSchema,
  createSchema,
  idParamSchema,
  listSchema,
  updateSchema,
} from './qrCodes.validators.js';

export const qrCodesRouter = Router();

qrCodesRouter.use(authMiddleware);
qrCodesRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/qr-codes:
 *   get:
 *     tags: [QR Codes]
 *     summary: List QR codes (filter by branch + type + status)
 *     parameters:
 *       - name: branch
 *         in: query
 *         schema: { type: string }
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [TABLE, COUNTER, TAKEAWAY, DELIVERY, MARKETING] }
 *     responses:
 *       200: { description: List of QR codes + stats }
 *   post:
 *     tags: [QR Codes]
 *     summary: Mint a QR code (non-table types)
 *     responses:
 *       201: { description: Created }
 */
qrCodesRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(listSchema),
  qrCodesController.list,
);

qrCodesRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(createSchema),
  qrCodesController.create,
);

/**
 * @openapi
 * /v1/qr-codes/bulk-print:
 *   post:
 *     tags: [QR Codes]
 *     summary: Generate a multi-page print-ready PDF of QR codes
 *     responses:
 *       200: { description: application/pdf }
 */
qrCodesRouter.post(
  '/bulk-print',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(bulkPrintSchema),
  qrCodesController.bulkPrint,
);

/**
 * @openapi
 * /v1/qr-codes/{id}:
 *   get:
 *     tags: [QR Codes]
 *     summary: Fetch a QR code
 *     responses:
 *       200: { description: QR code }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [QR Codes]
 *     summary: Update label / status
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [QR Codes]
 *     summary: Soft-delete a QR code
 *     responses:
 *       204: { description: Deleted }
 */
qrCodesRouter.get('/:id', validate(idParamSchema), qrCodesController.getById);

qrCodesRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(updateSchema),
  qrCodesController.update,
);

qrCodesRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  qrCodesController.remove,
);

/**
 * @openapi
 * /v1/qr-codes/{id}/regenerate:
 *   post:
 *     tags: [QR Codes]
 *     summary: Rotate the token — the previous URL stops resolving
 *     responses:
 *       200: { description: Regenerated }
 */
qrCodesRouter.post(
  '/:id/regenerate',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  qrCodesController.regenerate,
);

/**
 * @openapi
 * /v1/qr-codes/{id}/analytics:
 *   get:
 *     tags: [QR Codes]
 *     summary: Daily scan series + order conversion (last 30 days)
 *     responses:
 *       200: { description: Analytics }
 */
qrCodesRouter.get(
  '/:id/analytics',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  qrCodesController.analytics,
);
