import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { notificationPreferencesService } from './notificationPreferences.service.js';

export const notificationPreferencesController = {
  list: asyncHandler(async (req, res) => {
    const rows = await notificationPreferencesService.list({
      tenantId: req.tenantId,
      branchId: req.query.branchId ?? null,
      userId: req.query.userId ?? null,
    });
    res.json(ok(req, rows));
  }),

  bulkSet: asyncHandler(async (req, res) => {
    const rows = await notificationPreferencesService.bulkSet({
      tenantId: req.tenantId,
      prefs: req.body.prefs,
      branchId: req.body.branchId ?? null,
      userId: req.body.userId ?? null,
      actor: req.user,
    });
    res.json(ok(req, rows));
  }),
};
