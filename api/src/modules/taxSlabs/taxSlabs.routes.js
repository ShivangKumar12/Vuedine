import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { taxSlabsController } from './taxSlabs.controller.js';
import { createSchema, idParamSchema, listSchema, updateSchema } from './taxSlabs.validators.js';

export const taxSlabsRouter = Router();

taxSlabsRouter.use(authMiddleware);
taxSlabsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/tax-slabs:
 *   get:
 *     tags: [Settings]
 *     summary: List tax slabs (tenant defaults + branch overrides)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of tax slabs }
 *   post:
 *     tags: [Settings]
 *     summary: Create a tax slab
 *     responses:
 *       201: { description: Created }
 */
taxSlabsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(listSchema),
  taxSlabsController.list,
);

taxSlabsRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(createSchema),
  taxSlabsController.create,
);

/**
 * @openapi
 * /v1/tax-slabs/{id}:
 *   get:
 *     tags: [Settings]
 *     summary: Fetch a tax slab
 *     responses:
 *       200: { description: Tax slab }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Settings]
 *     summary: Update a tax slab
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Settings]
 *     summary: Soft-delete a tax slab
 *     responses:
 *       204: { description: Deleted }
 */
taxSlabsRouter.get('/:id', validate(idParamSchema), taxSlabsController.getById);

taxSlabsRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(updateSchema),
  taxSlabsController.update,
);

taxSlabsRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  taxSlabsController.remove,
);
