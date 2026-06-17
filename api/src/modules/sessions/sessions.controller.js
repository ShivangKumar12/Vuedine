import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { sessionsService } from './sessions.service.js';

export const sessionsController = {
  list: asyncHandler(async (req, res) => {
    const sessions = await sessionsService.list({
      tenantId: req.tenantId,
      branchId: req.query.branchId,
      status: req.query.status,
    });
    res.json(ok(req, sessions));
  }),

  getById: asyncHandler(async (req, res) => {
    const session = await sessionsService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, session));
  }),

  open: asyncHandler(async (req, res) => {
    const session = await sessionsService.open({
      tenantId: req.tenantId,
      body: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, session));
  }),

  close: asyncHandler(async (req, res) => {
    const session = await sessionsService.close({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, session));
  }),

  requestBill: asyncHandler(async (req, res) => {
    const session = await sessionsService.requestBill({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, session));
  }),

  update: asyncHandler(async (req, res) => {
    const session = await sessionsService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      data: req.body,
      actor: req.user,
    });
    res.json(ok(req, session));
  }),
};
