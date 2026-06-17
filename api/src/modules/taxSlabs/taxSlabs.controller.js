import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { taxSlabsService } from './taxSlabs.service.js';

export const taxSlabsController = {
  list: asyncHandler(async (req, res) => {
    const rows = await taxSlabsService.list({ tenantId: req.tenantId, branchId: req.query.branchId });
    res.json(ok(req, rows));
  }),

  getById: asyncHandler(async (req, res) => {
    const slab = await taxSlabsService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, slab));
  }),

  create: asyncHandler(async (req, res) => {
    const slab = await taxSlabsService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, slab));
  }),

  update: asyncHandler(async (req, res) => {
    const slab = await taxSlabsService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, slab));
  }),

  remove: asyncHandler(async (req, res) => {
    await taxSlabsService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),
};
