import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { conversationsService } from './conversations.service.js';

export const conversationsController = {
  list: asyncHandler(async (req, res) => {
    const { rows, total, stats } = await conversationsService.list({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, rows, { total, stats }));
  }),

  getById: asyncHandler(async (req, res) => {
    const c = await conversationsService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, c));
  }),

  reply: asyncHandler(async (req, res) => {
    const m = await conversationsService.reply({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.status(201).json(ok(req, m));
  }),

  assign: asyncHandler(async (req, res) => {
    const c = await conversationsService.assign({ tenantId: req.tenantId, id: req.params.id, agentId: req.body.agentId, actor: req.user });
    res.json(ok(req, c));
  }),

  setStatus: asyncHandler(async (req, res) => {
    const c = await conversationsService.setStatus({ tenantId: req.tenantId, id: req.params.id, status: req.body.status, actor: req.user });
    res.json(ok(req, c));
  }),

  setTags: asyncHandler(async (req, res) => {
    const c = await conversationsService.setTags({ tenantId: req.tenantId, id: req.params.id, tags: req.body.tags });
    res.json(ok(req, c));
  }),

  star: asyncHandler(async (req, res) => {
    const c = await conversationsService.star({ tenantId: req.tenantId, id: req.params.id, starred: req.body?.starred });
    res.json(ok(req, c));
  }),
};
