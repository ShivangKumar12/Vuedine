import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../db/prisma.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { emitToBranch } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { auditService } from '../audit/audit.service.js';

export const shiftsRouter = Router();

shiftsRouter.use(authMiddleware);
shiftsRouter.use(userRateLimit);

const startSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40),
    cashIn: z.coerce.number().min(0).optional(),
  }),
});

const endSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    cashOut: z.coerce.number().min(0).optional(),
    note: z.string().max(500).optional().nullable(),
  }),
});

const listSchema = z.object({
  query: z.object({
    userId: z.string().min(8).max(40).optional(),
    branchId: z.string().min(8).max(40).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    take: z.coerce.number().int().min(1).max(200).default(50),
  }),
});

function serializeShift(s) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    branchId: s.branchId,
    userId: s.userId,
    userName: s.user?.name ?? null,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    cashIn: s.cashIn ? Number(s.cashIn) : null,
    cashOut: s.cashOut ? Number(s.cashOut) : null,
    variance: s.variance ? Number(s.variance) : null,
    note: s.note,
    open: !s.endedAt,
  };
}

/**
 * @openapi
 * /v1/shifts/start:
 *   post:
 *     tags: [Users]
 *     summary: Open a cash drawer shift for the authenticated user
 *     responses:
 *       201: { description: Shift opened }
 */
shiftsRouter.post(
  '/start',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(startSchema),
  asyncHandler(async (req, res) => {
    const { branchId, cashIn = 0 } = req.body;
    const existing = await prisma.shift.findFirst({
      where: { tenantId: req.tenantId, userId: req.user.id, endedAt: null },
    });
    if (existing) throw AppError.conflict('A shift is already open for this user', 'SHIFT_ALREADY_OPEN');

    const shift = await prisma.shift.create({
      data: {
        tenantId: req.tenantId,
        branchId,
        userId: req.user.id,
        cashIn,
      },
      include: { user: { select: { name: true } } },
    });

    await auditService.record({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'SHIFT_STARTED',
      entityType: 'Shift',
      entityId: shift.id,
      metadata: { branchId, cashIn },
    });

    emitToBranch(branchId, 'shift:started', { shiftId: shift.id, userId: req.user.id });
    res.status(201).json({ success: true, data: serializeShift(shift), error: null, requestId: req.id });
  }),
);

/**
 * @openapi
 * /v1/shifts/{id}/end:
 *   post:
 *     tags: [Users]
 *     summary: Close a shift and compute cash variance
 *     responses:
 *       200: { description: Shift closed }
 */
shiftsRouter.post(
  '/:id/end',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(endSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { cashOut, note } = req.body;

    const shift = await prisma.shift.findFirst({
      where: { id, tenantId: req.tenantId },
      include: { user: { select: { name: true } } },
    });
    if (!shift) throw AppError.notFound('Shift not found', 'SHIFT_NOT_FOUND');
    if (shift.endedAt) throw AppError.badRequest('Shift is already closed', 'SHIFT_ALREADY_CLOSED');

    const cashIn = Number(shift.cashIn ?? 0);
    const out = cashOut !== undefined ? cashOut : cashIn;
    const variance = out - cashIn;

    const closed = await prisma.shift.update({
      where: { id },
      data: { endedAt: new Date(), cashOut: out, variance, note: note ?? null },
      include: { user: { select: { name: true } } },
    });

    await auditService.record({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'SHIFT_ENDED',
      entityType: 'Shift',
      entityId: id,
      metadata: { cashIn, cashOut: out, variance },
    });

    if (variance !== 0) {
      emitToBranch(shift.branchId, 'shift:variance', {
        shiftId: id,
        userId: shift.userId,
        variance,
      });
    }

    res.json({ success: true, data: serializeShift(closed), error: null, requestId: req.id });
  }),
);

/**
 * @openapi
 * /v1/shifts:
 *   get:
 *     tags: [Users]
 *     summary: List shifts
 *     responses:
 *       200: { description: List }
 */
shiftsRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(listSchema),
  asyncHandler(async (req, res) => {
    const { userId, branchId, from, to, take } = req.query;
    const shifts = await prisma.shift.findMany({
      where: {
        tenantId: req.tenantId,
        ...(userId ? { userId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(from || to
          ? {
              startedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { startedAt: 'desc' },
      take,
      include: { user: { select: { name: true } } },
    });
    res.json({ success: true, data: shifts.map(serializeShift), error: null, requestId: req.id });
  }),
);
