import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { integrationsService } from './integrations.service.js';

export const integrationsController = {
  list: asyncHandler(async (req, res) => {
    const data = await integrationsService.list({ tenantId: req.tenantId });
    res.json(ok(req, data));
  }),

  get: asyncHandler(async (req, res) => {
    const data = await integrationsService.get({ tenantId: req.tenantId, provider: req.params.provider });
    res.json(ok(req, data));
  }),

  connect: asyncHandler(async (req, res) => {
    const data = await integrationsService.connect({
      tenantId: req.tenantId,
      provider: req.params.provider,
      branchId: req.body.branchId ?? null,
      credentials: req.body.credentials,
      config: req.body.config,
      actor: req.user,
    });
    res.status(201).json(ok(req, data));
  }),

  disconnect: asyncHandler(async (req, res) => {
    const data = await integrationsService.disconnect({
      tenantId: req.tenantId,
      provider: req.params.provider,
      actor: req.user,
    });
    res.json(ok(req, data));
  }),

  test: asyncHandler(async (req, res) => {
    const data = await integrationsService.test({
      tenantId: req.tenantId,
      provider: req.params.provider,
      actor: req.user,
    });
    res.json(ok(req, data));
  }),

  sync: asyncHandler(async (req, res) => {
    const data = await integrationsService.sync({
      tenantId: req.tenantId,
      provider: req.params.provider,
      actor: req.user,
    });
    res.status(202).json(ok(req, data));
  }),
};
