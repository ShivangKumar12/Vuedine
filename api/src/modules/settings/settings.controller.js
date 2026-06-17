import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { settingsService } from './settings.service.js';

export const settingsController = {
  bundle: asyncHandler(async (req, res) => {
    const data = await settingsService.getBundle({ tenantId: req.tenantId });
    res.json(ok(req, data));
  }),

  updateTenant: asyncHandler(async (req, res) => {
    const t = await settingsService.updateTenant({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.json(ok(req, t));
  }),

  updateBranding: asyncHandler(async (req, res) => {
    const t = await settingsService.updateBranding({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.json(ok(req, t));
  }),

  updateLocalization: asyncHandler(async (req, res) => {
    const t = await settingsService.updateLocalization({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.json(ok(req, t));
  }),

  exportData: asyncHandler(async (req, res) => {
    const result = await settingsService.exportData({ tenantId: req.tenantId, actor: req.user });
    res.status(202).json(ok(req, result));
  }),

  anonymizeTenant: asyncHandler(async (req, res) => {
    const result = await settingsService.anonymizeTenant({ tenantId: req.tenantId, confirm: req.body.confirm, actor: req.user });
    res.json(ok(req, result));
  }),
};
