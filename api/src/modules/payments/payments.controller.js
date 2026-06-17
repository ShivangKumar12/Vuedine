import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { paymentsService } from './payments.service.js';

export const paymentsController = {
  list: asyncHandler(async (req, res) => {
    const { rows, total } = await paymentsService.list({
      tenantId: req.tenantId,
      query: req.query,
    });
    res.json(
      ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })),
    );
  }),

  stats: asyncHandler(async (req, res) => {
    const stats = await paymentsService.stats({
      tenantId: req.tenantId,
      branchId: req.query.branchId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    });
    res.json(ok(req, stats));
  }),

  getById: asyncHandler(async (req, res) => {
    const payment = await paymentsService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, payment));
  }),

  createForOrder: asyncHandler(async (req, res) => {
    const payment = await paymentsService.createForOrder({
      tenantId: req.tenantId,
      orderId: req.params.id,
      body: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, payment));
  }),

  refund: asyncHandler(async (req, res) => {
    const payment = await paymentsService.refund({
      tenantId: req.tenantId,
      orderId: req.params.id,
      paymentId: req.params.paymentId,
      body: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, payment));
  }),

  comp: asyncHandler(async (req, res) => {
    const payment = await paymentsService.comp({
      tenantId: req.tenantId,
      orderId: req.params.id,
      body: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, payment));
  }),

  recapture: asyncHandler(async (req, res) => {
    const payment = await paymentsService.recapture({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, payment));
  }),

  listSettlements: asyncHandler(async (req, res) => {
    const { rows, total } = await paymentsService.listSettlements({
      tenantId: req.tenantId,
      query: req.query,
    });
    res.json(
      ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })),
    );
  }),

  syncSettlement: asyncHandler(async (req, res) => {
    const settlement = await paymentsService.syncSettlement({
      tenantId: req.tenantId,
      gateway: req.params.gateway,
      actor: req.user,
    });
    res.json(ok(req, settlement));
  }),
};
