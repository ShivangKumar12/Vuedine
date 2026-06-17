import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { itemsService } from './items.service.js';

/**
 * Controllers do three things:
 *   1. Pull validated input from the request
 *   2. Call into the service
 *   3. Shape the response (envelope + status code)
 *
 * They never touch Prisma directly. They never embed business logic.
 */
export const itemsController = {
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, search, category, status, veg } = req.query;
    const { rows, total } = await itemsService.list({
      tenantId: req.tenantId,
      page,
      pageSize,
      search,
      category,
      status,
      veg,
    });
    res.json(ok(req, rows, offsetMeta({ page, pageSize, total })));
  }),

  getById: asyncHandler(async (req, res) => {
    const item = await itemsService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, item));
  }),

  create: asyncHandler(async (req, res) => {
    const item = await itemsService.create({
      tenantId: req.tenantId,
      data: req.body,
    });
    res.status(201).json(ok(req, item));
  }),

  update: asyncHandler(async (req, res) => {
    const item = await itemsService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      data: req.body,
    });
    res.json(ok(req, item));
  }),

  remove: asyncHandler(async (req, res) => {
    await itemsService.remove({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.status(204).end();
  }),
};
