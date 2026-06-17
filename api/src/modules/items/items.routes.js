import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { cacheRoute } from '../../middleware/cache.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { itemsController } from './items.controller.js';
import { createSchema, idParamSchema, listSchema, updateSchema } from './items.validators.js';

export const itemsRouter = Router();

/* ---- Every items route requires auth + per-user rate limit ---- */
itemsRouter.use(authMiddleware);
itemsRouter.use(userRateLimit);

/* ---- Reads ----
 * The route-level cache and the service-level cache share the same prefix
 * (`items:<tenantId>`) so a single `bumpVersion` on mutation invalidates
 * both layers in O(1). Without that, a write would invalidate the service
 * cache but the route response cache would keep serving the stale list.
 */

/**
 * @openapi
 * /v1/items:
 *   get:
 *     tags: [Items]
 *     summary: List menu items
 *     description: |
 *       Returns a paginated list of menu items for the authenticated tenant.
 *       Cached at both the route and service layer for 60s, invalidated by
 *       any write through the same module.
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - $ref: '#/components/parameters/Search'
 *       - name: category
 *         in: query
 *         schema: { type: string, maxLength: 50 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, SOLD_OUT, DRAFT] }
 *       - name: veg
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
 *                       items: { $ref: '#/components/schemas/Item' }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 *   post:
 *     tags: [Items]
 *     summary: Create a menu item
 *     description: Requires OWNER, ADMIN, or MANAGER role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price]
 *             properties:
 *               name:        { type: string, minLength: 1, maxLength: 120 }
 *               description: { type: string, maxLength: 2000 }
 *               category:    { type: string, minLength: 1, maxLength: 50 }
 *               price:       { type: number, minimum: 0 }
 *               status:      { type: string, enum: [ACTIVE, SOLD_OUT, DRAFT], default: ACTIVE }
 *               emoji:       { type: string, maxLength: 8 }
 *               imageUrl:    { type: string, format: uri, nullable: true }
 *               veg:         { type: boolean, default: true }
 *               bestseller:  { type: boolean, default: false }
 *               branchIds:
 *                 type: array
 *                 items: { type: string }
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
 *                     data: { $ref: '#/components/schemas/Item' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
itemsRouter.get(
  '/',
  validate(listSchema),
  cacheRoute({
    ttlSec: 60,
    prefix: 'items',
    keyFn: (req) => `route:items:${req.tenantId}:${req.user.id}:${req.originalUrl}`,
  }),
  itemsController.list,
);

/**
 * @openapi
 * /v1/items/{id}:
 *   get:
 *     tags: [Items]
 *     summary: Fetch one item
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Item' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Items]
 *     summary: Update an item (partial)
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
 *             properties:
 *               name:        { type: string, maxLength: 120 }
 *               description: { type: string, maxLength: 2000 }
 *               category:    { type: string, maxLength: 50 }
 *               price:       { type: number, minimum: 0 }
 *               status:      { type: string, enum: [ACTIVE, SOLD_OUT, DRAFT] }
 *               veg:         { type: boolean }
 *               bestseller:  { type: boolean }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Item' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Items]
 *     summary: Soft-delete an item (OWNER/ADMIN only)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
itemsRouter.get('/:id', validate(idParamSchema), itemsController.getById);

/* ---- Writes ---- */
itemsRouter.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  validate(createSchema),
  itemsController.create,
);

itemsRouter.patch(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  validate(updateSchema),
  itemsController.update,
);

itemsRouter.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  validate(idParamSchema),
  itemsController.remove,
);
