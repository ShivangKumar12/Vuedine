import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { branchesService } from './branches.service.js';

export const branchesController = {
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, search, isLive } = req.query;
    const { rows, total } = await branchesService.list({
      tenantId: req.tenantId,
      page,
      pageSize,
      search,
      isLive,
    });
    res.json(ok(req, rows, offsetMeta({ page, pageSize, total })));
  }),

  getById: asyncHandler(async (req, res) => {
    const branch = await branchesService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, branch));
  }),

  create: asyncHandler(async (req, res) => {
    const branch = await branchesService.create({
      tenantId: req.tenantId,
      data: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, branch));
  }),

  update: asyncHandler(async (req, res) => {
    const branch = await branchesService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      data: req.body,
      actor: req.user,
    });
    res.json(ok(req, branch));
  }),

  toggleLive: asyncHandler(async (req, res) => {
    const branch = await branchesService.toggleLive({
      tenantId: req.tenantId,
      id: req.params.id,
      isLive: req.body?.isLive,
      actor: req.user,
    });
    res.json(ok(req, branch));
  }),

  remove: asyncHandler(async (req, res) => {
    await branchesService.remove({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.status(204).end();
  }),

  listSections: asyncHandler(async (req, res) => {
    const sections = await branchesService.listSections({
      tenantId: req.tenantId,
      branchId: req.params.id,
    });
    res.json(ok(req, sections));
  }),
};
