import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { paymentSettingsService } from './paymentSettings.service.js';

export const paymentSettingsController = {
  get: asyncHandler(async (req, res) => {
    const data = await paymentSettingsService.get({ tenantId: req.tenantId });
    res.json(ok(req, data));
  }),

  update: asyncHandler(async (req, res) => {
    const data = await paymentSettingsService.update({
      tenantId: req.tenantId,
      data: req.body,
      actor: req.user,
    });
    res.json(ok(req, data));
  }),
};
