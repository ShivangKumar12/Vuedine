import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { cacheRoute } from '../../middleware/cache.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { tablesController } from './tables.controller.js';
import {
  createSchema,
  idParamSchema,
  listByTenantSchema,
  listSchema,
  setStatusSchema,
  updateSchema,
} from './tables.validators.js';

/**
 * Tables router — mounted at `/v1`. We expose two list paths:
 *   - GET /v1/branches/:branchId/tables  — branch-scoped list (Tables page)
 *   - GET /v1/tables                     — tenant-wide list (multi-branch view)
 *
 * Branch-scoped writes live under `/v1/branches/:branchId/tables`. Per-id
 * writes live under `/v1/tables/:id`.
 */

export const tablesRouter = Router();

tablesRouter.use(authMiddleware);
tablesRouter.use(userRateLimit);

/* ============================================================
 *  Tenant-wide list (no branch path param)
 *  GET /v1/tables
 * ============================================================ */

/**
 * @openapi
 * /v1/tables:
 *   get:
 *     tags: [Tables]
 *     summary: List tables across the tenant (optionally filtered by branchId)
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - $ref: '#/components/parameters/Search'
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: section
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [FREE, OCCUPIED, RESERVED, CLEANING, BILL] }
 *     responses:
 *       200: { description: List }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
tablesRouter.get(
  '/tables',
  validate(listByTenantSchema),
  cacheRoute({
    ttlSec: 30,
    prefix: 'tables',
    keyFn: (req) => `route:tables-tenant:${req.tenantId}:${req.user.id}:${req.originalUrl}`,
  }),
  tablesController.listForTenant,
);

/* ============================================================
 *  Branch-scoped list + create
 *  GET / POST /v1/branches/:branchId/tables
 * ============================================================ */

/**
 * @openapi
 * /v1/branches/{branchId}/tables:
 *   get:
 *     tags: [Tables]
 *     summary: List tables for a branch
 *     parameters:
 *       - name: branchId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *     responses:
 *       200: { description: List }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   post:
 *     tags: [Tables]
 *     summary: Create a table in a branch
 *     responses:
 *       201: { description: Created }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { description: Table name already used in this branch }
 */
tablesRouter.get(
  '/branches/:branchId/tables',
  validate(listSchema),
  cacheRoute({
    ttlSec: 30,
    prefix: 'tables',
    keyFn: (req) =>
      `route:tables-branch:${req.tenantId}:${req.params.branchId}:${req.user.id}:${req.originalUrl}`,
  }),
  tablesController.listByBranch,
);

tablesRouter.post(
  '/branches/:branchId/tables',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(createSchema),
  tablesController.create,
);

/* ============================================================
 *  Per-id GET / PATCH / DELETE / status / QR
 *  /v1/tables/:id
 * ============================================================ */

/**
 * @openapi
 * /v1/tables/{id}:
 *   get:
 *     tags: [Tables]
 *     summary: Fetch a table
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Table }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Tables]
 *     summary: Update a table (partial)
 *     responses:
 *       200: { description: Updated }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Table name already used in this branch }
 *   delete:
 *     tags: [Tables]
 *     summary: Soft-delete a table (only when not in use)
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Table is in use }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
tablesRouter.get('/tables/:id', validate(idParamSchema), tablesController.getById);

tablesRouter.patch(
  '/tables/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(updateSchema),
  tablesController.update,
);

tablesRouter.delete(
  '/tables/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  tablesController.remove,
);

/**
 * @openapi
 * /v1/tables/{id}/status:
 *   patch:
 *     tags: [Tables]
 *     summary: Set housekeeping status (FREE or CLEANING only)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [FREE, CLEANING] }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Reserved for orders/reservations pipeline }
 */
tablesRouter.patch(
  '/tables/:id/status',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'WAITER'),
  validate(setStatusSchema),
  tablesController.setStatus,
);

/**
 * @openapi
 * /v1/tables/{id}/qr/regenerate:
 *   post:
 *     tags: [Tables]
 *     summary: Mint a fresh qrToken for the table
 *     responses:
 *       200: { description: Updated table with new qrToken }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
tablesRouter.post(
  '/tables/:id/qr/regenerate',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  tablesController.regenerateQr,
);
