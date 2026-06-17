import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { apiKeysService } from './apiKeys.service.js';

/**
 * Controllers stay thin: validate-via-middleware → call service → envelope.
 * No business logic here.
 */
export const apiKeysController = {
  issue: asyncHandler(async (req, res) => {
    const { name, scopes, expiresAt, envTag } = req.body;
    const result = await apiKeysService.issue({
      tenantId: req.user.tenantId,
      name,
      scopes,
      expiresAt: expiresAt ?? null,
      envTag,
      createdBy: req.user.id,
    });
    // The raw `key` field is in the response ONCE — clients must store/show
    // it immediately. Subsequent reads via list() never include it.
    res.status(201).json(ok(req, result));
  }),

  list: asyncHandler(async (req, res) => {
    const rows = await apiKeysService.list({ tenantId: req.user.tenantId });
    res.json(ok(req, rows));
  }),

  revoke: asyncHandler(async (req, res) => {
    await apiKeysService.revoke({
      id: req.params.id,
      tenantId: req.user.tenantId,
      revokedBy: req.user.id,
    });
    res.status(204).end();
  }),
};
