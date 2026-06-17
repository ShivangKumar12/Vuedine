import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { aiService } from './ai.service.js';

export const aiController = {
  chat: asyncHandler(async (req, res) => {
    const data = await aiService.chat({
      tenantId: req.tenantId,
      branchId: req.body.branchId,
      message: req.body.message,
      history: req.body.history ?? [],
    });
    res.json(ok(req, data));
  }),

  suggestions: asyncHandler(async (req, res) => {
    const data = await aiService.suggestions({ tenantId: req.tenantId, branchId: req.query.branchId });
    res.json(ok(req, data));
  }),

  usage: asyncHandler(async (req, res) => {
    const data = await aiService.usage({ tenantId: req.tenantId });
    res.json(ok(req, data));
  }),
};
