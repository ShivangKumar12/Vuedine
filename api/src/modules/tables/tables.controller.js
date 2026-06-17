import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { tablesService } from './tables.service.js';

export const tablesController = {
  listByBranch: asyncHandler(async (req, res) => {
    const { page, pageSize, search, section, status } = req.query;
    const { rows, total } = await tablesService.listByBranch({
      tenantId: req.tenantId,
      branchId: req.params.branchId,
      page,
      pageSize,
      search,
      section,
      status,
    });
    res.json(ok(req, rows, offsetMeta({ page, pageSize, total })));
  }),

  listForTenant: asyncHandler(async (req, res) => {
    const { page, pageSize, search, section, status, branchId } = req.query;
    const { rows, total } = await tablesService.listForTenant({
      tenantId: req.tenantId,
      page,
      pageSize,
      branchId,
      search,
      section,
      status,
    });
    res.json(ok(req, rows, offsetMeta({ page, pageSize, total })));
  }),

  getById: asyncHandler(async (req, res) => {
    const table = await tablesService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, table));
  }),

  create: asyncHandler(async (req, res) => {
    const table = await tablesService.create({
      tenantId: req.tenantId,
      branchId: req.params.branchId,
      data: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, table));
  }),

  update: asyncHandler(async (req, res) => {
    const table = await tablesService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      data: req.body,
      actor: req.user,
    });
    res.json(ok(req, table));
  }),

  setStatus: asyncHandler(async (req, res) => {
    const table = await tablesService.setStatus({
      tenantId: req.tenantId,
      id: req.params.id,
      status: req.body.status,
      actor: req.user,
    });
    res.json(ok(req, table));
  }),

  regenerateQr: asyncHandler(async (req, res) => {
    const table = await tablesService.regenerateQr({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, table));
  }),

  remove: asyncHandler(async (req, res) => {
    await tablesService.remove({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.status(204).end();
  }),
};
