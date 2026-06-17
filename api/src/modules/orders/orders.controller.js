import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { ordersService } from './orders.service.js';

export const ordersController = {
  calculate: asyncHandler(async (req, res) => {
    const result = await ordersService.calculate({
      tenantId: req.tenantId,
      body: req.body,
    });
    res.json(ok(req, result));
  }),

  create: asyncHandler(async (req, res) => {
    const order = await ordersService.create({
      tenantId: req.tenantId,
      body: req.body,
      actor: req.user,
      idempotencyKey: req.idempotencyKey ?? null,
      source: req.body.source,
    });
    res.status(201).json(ok(req, order));
  }),

  list: asyncHandler(async (req, res) => {
    const { rows, total } = await ordersService.list({
      tenantId: req.tenantId,
      query: req.query,
    });
    res.json(
      ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })),
    );
  }),

  getById: asyncHandler(async (req, res) => {
    const order = await ordersService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, order));
  }),

  update: asyncHandler(async (req, res) => {
    const order = await ordersService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      data: req.body,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  setStatus: asyncHandler(async (req, res) => {
    const order = await ordersService.setStatus({
      tenantId: req.tenantId,
      id: req.params.id,
      status: req.body.status,
      reason: req.body.reason,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  advance: asyncHandler(async (req, res) => {
    const order = await ordersService.advance({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  cancel: asyncHandler(async (req, res) => {
    const order = await ordersService.cancel({
      tenantId: req.tenantId,
      id: req.params.id,
      reason: req.body?.reason,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  recall: asyncHandler(async (req, res) => {
    const order = await ordersService.recall({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  setLinePrepared: asyncHandler(async (req, res) => {
    const order = await ordersService.setLinePrepared({
      tenantId: req.tenantId,
      id: req.params.id,
      lineId: req.params.lineId,
      prepared: req.body.prepared,
      actor: req.user,
    });
    res.json(ok(req, order));
  }),

  stats: asyncHandler(async (req, res) => {
    const stats = await ordersService.stats({
      tenantId: req.tenantId,
      branchId: req.query.branchId,
    });
    res.json(ok(req, stats));
  }),
};
