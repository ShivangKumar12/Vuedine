import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { cacheRoute } from '../../middleware/cache.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { branchesController } from './branches.controller.js';
import {
  createSchema,
  idParamSchema,
  listSchema,
  toggleLiveSchema,
  updateSchema,
} from './branches.validators.js';

export const branchesRouter = Router();

branchesRouter.use(authMiddleware);
branchesRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/branches:
 *   get:
 *     tags: [Branches]
 *     summary: List branches for the authenticated tenant
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - $ref: '#/components/parameters/Search'
 *       - name: isLive
 *         in: query
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Branch' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Branches]
 *     summary: Create a new branch
 *     description: OWNER or ADMIN only.
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Branch' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: Branch code or qrSlug already taken
 */
branchesRouter.get(
  '/',
  validate(listSchema),
  cacheRoute({
    ttlSec: 60,
    prefix: 'branches',
    keyFn: (req) => `route:branches:${req.tenantId}:${req.user.id}:${req.originalUrl}`,
  }),
  branchesController.list,
);

branchesRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(createSchema),
  branchesController.create,
);

/**
 * @openapi
 * /v1/branches/{id}:
 *   get:
 *     tags: [Branches]
 *     summary: Fetch a single branch
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Branch
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Branches]
 *     summary: Update a branch (partial)
 *     responses:
 *       200: { description: Updated }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Branch code or qrSlug already taken }
 *   delete:
 *     tags: [Branches]
 *     summary: Soft-delete a branch (cascades to its tables)
 *     responses:
 *       204: { description: Deleted }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
branchesRouter.get('/:id', validate(idParamSchema), branchesController.getById);

branchesRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(updateSchema),
  branchesController.update,
);

branchesRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER'),
  validate(idParamSchema),
  branchesController.remove,
);

/**
 * @openapi
 * /v1/branches/{id}/toggle-live:
 *   post:
 *     tags: [Branches]
 *     summary: Flip isLive (or set explicitly via body)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isLive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
branchesRouter.post(
  '/:id/toggle-live',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(toggleLiveSchema),
  branchesController.toggleLive,
);

/**
 * @openapi
 * /v1/branches/{id}/sections:
 *   get:
 *     tags: [Branches]
 *     summary: Distinct dining-sections list for a branch
 *     responses:
 *       200:
 *         description: List of section labels
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: string }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
branchesRouter.get('/:id/sections', validate(idParamSchema), branchesController.listSections);
