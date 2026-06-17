import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { hardwareDevicesService } from './hardwareDevices.service.js';

export const hardwareDevicesController = {
  list: asyncHandler(async (req, res) => {
    const rows = await hardwareDevicesService.list({
      tenantId: req.tenantId,
      branchId: req.query.branchId,
      type: req.query.type,
    });
    res.json(ok(req, rows));
  }),

  getById: asyncHandler(async (req, res) => {
    const d = await hardwareDevicesService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, d));
  }),

  create: asyncHandler(async (req, res) => {
    const d = await hardwareDevicesService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, d));
  }),

  update: asyncHandler(async (req, res) => {
    const d = await hardwareDevicesService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, d));
  }),

  pair: asyncHandler(async (req, res) => {
    const d = await hardwareDevicesService.pair({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, d));
  }),

  heartbeat: asyncHandler(async (req, res) => {
    const d = await hardwareDevicesService.heartbeat({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, d));
  }),

  remove: asyncHandler(async (req, res) => {
    await hardwareDevicesService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),
};
