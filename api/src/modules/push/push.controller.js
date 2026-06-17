import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { pushService } from './push.service.js';

export const pushController = {
  publicKey: asyncHandler(async (req, res) => {
    res.json(ok(req, pushService.publicKey()));
  }),

  list: asyncHandler(async (req, res) => {
    const subs = await pushService.listForUser({ tenantId: req.tenantId, userId: req.user.id });
    res.json(ok(req, subs));
  }),

  subscribe: asyncHandler(async (req, res) => {
    const sub = await pushService.subscribe({
      tenantId: req.tenantId,
      userId: req.user.id,
      body: req.body,
      userAgent: req.get('user-agent') ?? null,
    });
    res.status(201).json(ok(req, sub));
  }),

  unsubscribe: asyncHandler(async (req, res) => {
    await pushService.unsubscribe({ tenantId: req.tenantId, userId: req.user.id, id: req.params.id });
    res.status(204).end();
  }),

  test: asyncHandler(async (req, res) => {
    const result = await pushService.test({ tenantId: req.tenantId, userId: req.user.id });
    res.json(ok(req, result));
  }),
};
