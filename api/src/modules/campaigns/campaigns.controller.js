import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { campaignsService } from './campaigns.service.js';

export const campaignsController = {
  list: asyncHandler(async (req, res) => {
    const { rows, total } = await campaignsService.list({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, rows, { total }));
  }),

  getById: asyncHandler(async (req, res) => {
    const c = await campaignsService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, c));
  }),

  create: asyncHandler(async (req, res) => {
    const c = await campaignsService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, c));
  }),

  update: asyncHandler(async (req, res) => {
    const c = await campaignsService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, c));
  }),

  remove: asyncHandler(async (req, res) => {
    await campaignsService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),

  sendNow: asyncHandler(async (req, res) => {
    const result = await campaignsService.sendNow({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, result));
  }),

  schedule: asyncHandler(async (req, res) => {
    const c = await campaignsService.schedule({ tenantId: req.tenantId, id: req.params.id, at: req.body.at, actor: req.user });
    res.json(ok(req, c));
  }),

  cancel: asyncHandler(async (req, res) => {
    const c = await campaignsService.cancel({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, c));
  }),

  events: asyncHandler(async (req, res) => {
    const { rows, total } = await campaignsService.listEvents({ tenantId: req.tenantId, id: req.params.id, query: req.query });
    res.json(ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })));
  }),

  previewAudience: asyncHandler(async (req, res) => {
    const result = await campaignsService.previewAudience({ tenantId: req.tenantId, body: req.body });
    res.json(ok(req, result));
  }),
};
