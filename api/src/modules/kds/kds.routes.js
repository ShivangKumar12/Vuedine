import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { kdsController } from './kds.controller.js';

const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
    station: z.enum(['HOT', 'COLD', 'BAR', 'DESSERT']).optional(),
  }),
});

export const kdsRouter = Router();

kdsRouter.use(authMiddleware);
kdsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/kds/tickets:
 *   get:
 *     tags: [KDS]
 *     summary: Active kitchen tickets (ACCEPTED, PREPARING, READY)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: station
 *         in: query
 *         schema: { type: string, enum: [HOT, COLD, BAR, DESSERT] }
 *     responses:
 *       200: { description: Tickets }
 */
kdsRouter.get(
  '/tickets',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CHEF', 'WAITER'),
  validate(listSchema),
  kdsController.listTickets,
);
