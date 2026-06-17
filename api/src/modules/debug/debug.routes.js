import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { emitToBranch, emitToTenant, emitToUser } from '../../realtime/socket.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

/**
 * Internal debug surface — emit arbitrary events for socket.io smoke tests
 * and for ops to verify cross-instance fan-out from a kubectl exec.
 *
 * 🔒 SECURITY — gated by SUPER_ADMIN/OWNER. Never enable for lower roles;
 * the payload is forwarded verbatim to subscribers.
 */
export const debugRouter = Router();

debugRouter.use(authMiddleware);
debugRouter.use(requireRole('SUPER_ADMIN', 'OWNER'));

const emitSchema = z.object({
  body: z.object({
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('user'), userId: z.string().min(1) }),
      z.object({ kind: z.literal('branch'), branchId: z.string().min(1) }),
      z.object({ kind: z.literal('tenant'), tenantId: z.string().min(1) }),
    ]),
    event: z.string().min(1).max(80),
    payload: z.record(z.string(), z.any()).default({}),
  }),
});

debugRouter.post(
  '/socket/emit',
  validate(emitSchema),
  asyncHandler(async (req, res) => {
    const { target, event, payload } = req.body;
    if (target.kind === 'user') emitToUser(target.userId, event, payload);
    else if (target.kind === 'branch') emitToBranch(target.branchId, event, payload);
    else emitToTenant(target.tenantId, event, payload);
    res.json(ok(req, { delivered: true }));
  }),
);
