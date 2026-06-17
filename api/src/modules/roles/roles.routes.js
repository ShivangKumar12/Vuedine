import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { rolesService } from './roles.service.js';

export const rolesRouter = Router();

rolesRouter.use(authMiddleware);
rolesRouter.use(userRateLimit);

const idParamSchema = z.object({ params: z.object({ id: z.string().min(8).max(40) }) });

const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(200).optional().nullable(),
    color: z.string().max(200).optional(),
    permissions: z.array(z.string().max(60)).max(100).optional().default([]),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(200).optional().nullable(),
    color: z.string().max(200).optional(),
    permissions: z.array(z.string().max(60)).max(100).optional(),
  }),
});

/**
 * @openapi
 * /v1/roles:
 *   get:
 *     tags: [Users]
 *     summary: List custom roles for the tenant
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Users]
 *     summary: Create a custom role
 *     responses:
 *       201: { description: Created }
 *       409: { description: Name taken }
 */
rolesRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  asyncHandler(async (req, res) => {
    const roles = await rolesService.list({ tenantId: req.tenantId });
    res.json(ok(req, roles));
  }),
);

rolesRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const role = await rolesService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, role));
  }),
);

/**
 * @openapi
 * /v1/roles/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Fetch a single role
 *     responses:
 *       200: { description: Role }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Users]
 *     summary: Update name / description / permissions (cannot edit systemRole)
 *     responses:
 *       200: { description: Updated }
 *       403: { description: System role locked }
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a custom role
 *     responses:
 *       204: { description: Deleted }
 */
rolesRouter.get(
  '/:id',
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    const role = await rolesService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, role));
  }),
);

rolesRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const role = await rolesService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, role));
  }),
);

rolesRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  asyncHandler(async (req, res) => {
    await rolesService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),
);
