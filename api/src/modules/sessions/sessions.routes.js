import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { sessionsController } from './sessions.controller.js';

const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
    status: z.enum(['OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT', 'CLOSED']).optional(),
  }),
});

const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

const openSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40),
    tableId: z.string().min(8).max(40),
    guestName: z.string().max(120).optional().nullable(),
    guestPhone: z.string().max(40).optional().nullable(),
    partySize: z.coerce.number().int().min(1).max(40).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    guestName: z.string().max(120).optional().nullable(),
    guestPhone: z.string().max(40).optional().nullable(),
    partySize: z.coerce.number().int().min(1).max(40).optional(),
    status: z.enum(['OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT']).optional(),
    paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional(),
  }),
});

export const sessionsRouter = Router();

sessionsRouter.use(authMiddleware);
sessionsRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/table-sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: List active table sessions
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Sessions]
 *     summary: Open a new session for a table (idempotent — returns existing if open)
 *     responses:
 *       201: { description: Created or existing }
 */
sessionsRouter.get(
  '/',
  validate(listSchema),
  sessionsController.list,
);

sessionsRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(openSchema),
  sessionsController.open,
);

/**
 * @openapi
 * /v1/table-sessions/{id}:
 *   get:
 *     tags: [Sessions]
 *     summary: Fetch a session with all rounds
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Session }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Sessions]
 *     summary: Update a session (party size, status, payment status)
 *     responses:
 *       200: { description: Updated }
 */
sessionsRouter.get('/:id', validate(idParamSchema), sessionsController.getById);

sessionsRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(updateSchema),
  sessionsController.update,
);

/**
 * @openapi
 * /v1/table-sessions/{id}/close:
 *   post:
 *     tags: [Sessions]
 *     summary: Close session + flip table to CLEANING
 *     responses:
 *       200: { description: Closed }
 */
sessionsRouter.post(
  '/:id/close',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(idParamSchema),
  sessionsController.close,
);

/**
 * @openapi
 * /v1/table-sessions/{id}/request-bill:
 *   post:
 *     tags: [Sessions]
 *     summary: Mark the session as awaiting payment
 *     responses:
 *       200: { description: Updated }
 */
sessionsRouter.post(
  '/:id/request-bill',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(idParamSchema),
  sessionsController.requestBill,
);
