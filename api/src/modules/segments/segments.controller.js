import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { segmentsService } from './segments.service.js';

export const segmentsController = {
  list: asyncHandler(async (req, res) => {
    const segments = await segmentsService.list({ tenantId: req.tenantId });
    res.json(ok(req, segments));
  }),

  create: asyncHandler(async (req, res) => {
    const seg = await segmentsService.create({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, seg));
  }),

  remove: asyncHandler(async (req, res) => {
    await segmentsService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),

  preview: asyncHandler(async (req, res) => {
    const rule = req.body.rule ?? (await segmentsService.resolveRule({
      tenantId: req.tenantId,
      audience: req.body.audience,
      audienceQuery: req.body.rule,
    }));
    const result = await segmentsService.previewAudience({
      tenantId: req.tenantId,
      rule,
      requireConsent: req.body.requireConsent ?? false,
      channel: req.body.channel ?? null,
    });
    res.json(ok(req, result));
  }),
};
