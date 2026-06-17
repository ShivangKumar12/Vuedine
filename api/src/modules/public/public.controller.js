import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { publicService } from './public.service.js';

export const publicController = {
  resolveQr: asyncHandler(async (req, res) => {
    const data = await publicService.resolveQr({
      branchSlug: req.params.branchSlug,
      qrToken: req.params.qrToken,
    });
    res.json(ok(req, data));
  }),

  getMenu: asyncHandler(async (req, res) => {
    const data = await publicService.getMenu({
      branchSlug: req.params.branchSlug,
      category: req.query.category,
      search: req.query.search,
    });
    res.json(ok(req, data));
  }),

  calculate: asyncHandler(async (req, res) => {
    const data = await publicService.calculate({ body: req.body });
    res.json(ok(req, data));
  }),

  applyCoupon: asyncHandler(async (req, res) => {
    const data = await publicService.applyCoupon({ body: req.body });
    res.json(ok(req, data));
  }),

  placeOrder: asyncHandler(async (req, res) => {
    const order = await publicService.placeOrder({
      body: req.body,
      idempotencyKey: req.idempotencyKey ?? null,
    });
    res.status(201).json(ok(req, order));
  }),

  trackOrder: asyncHandler(async (req, res) => {
    const order = await publicService.trackOrder({ orderId: req.params.orderId });
    res.json(ok(req, order));
  }),

  signal: asyncHandler(async (req, res) => {
    const signal = await publicService.signal({
      orderId: req.params.orderId,
      body: req.body,
    });
    res.status(201).json(ok(req, signal));
  }),
};
