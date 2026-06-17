import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { paymentMethodConfigsService } from './paymentMethodConfigs.service.js';

export const paymentMethodConfigsController = {
  list: asyncHandler(async (req, res) => {
    const rows = await paymentMethodConfigsService.list({ tenantId: req.tenantId, branchId: req.query.branchId });
    res.json(ok(req, rows));
  }),

  upsert: asyncHandler(async (req, res) => {
    const row = await paymentMethodConfigsService.upsert({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, row));
  }),

  remove: asyncHandler(async (req, res) => {
    await paymentMethodConfigsService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),
};
