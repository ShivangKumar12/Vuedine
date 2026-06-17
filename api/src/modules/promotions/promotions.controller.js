import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { promotionsService } from './promotions.service.js';

export const promotionsController = {
  list: asyncHandler(async (req, res) => {
    const { rows, total } = await promotionsService.list({
      tenantId: req.tenantId,
      query: req.query,
    });
    res.json(
      ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })),
    );
  }),

  getById: asyncHandler(async (req, res) => {
    const promo = await promotionsService.getById({
      tenantId: req.tenantId,
      id: req.params.id,
    });
    res.json(ok(req, promo));
  }),

  create: asyncHandler(async (req, res) => {
    const promo = await promotionsService.create({
      tenantId: req.tenantId,
      body: req.body,
      actor: req.user,
    });
    res.status(201).json(ok(req, promo));
  }),

  update: asyncHandler(async (req, res) => {
    const promo = await promotionsService.update({
      tenantId: req.tenantId,
      id: req.params.id,
      body: req.body,
      actor: req.user,
    });
    res.json(ok(req, promo));
  }),

  remove: asyncHandler(async (req, res) => {
    await promotionsService.remove({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.status(204).end();
  }),

  pause: asyncHandler(async (req, res) => {
    const promo = await promotionsService.pause({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, promo));
  }),

  resume: asyncHandler(async (req, res) => {
    const promo = await promotionsService.resume({
      tenantId: req.tenantId,
      id: req.params.id,
      actor: req.user,
    });
    res.json(ok(req, promo));
  }),

  applyCoupon: asyncHandler(async (req, res) => {
    const result = await promotionsService.applyCoupon({
      tenantId: req.tenantId,
      body: req.body,
    });
    res.json(ok(req, result));
  }),

  autoOffers: asyncHandler(async (req, res) => {
    const result = await promotionsService.autoOffers({
      tenantId: req.tenantId,
      body: req.body,
    });
    res.json(ok(req, result));
  }),
};
