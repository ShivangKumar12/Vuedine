import { prisma } from '../../db/prisma.js';
import { emitToBranch } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { tablesRepo } from '../tables/tables.repository.js';

import { sessionsRepo } from './sessions.repository.js';
import { serializeSession } from './sessions.serializer.js';

/**
 * Table-session lifecycle. A session represents a guest party at a table
 * across multiple rounds of orders. Status shadows the dominant order:
 *
 *   OPEN — first order in flight
 *   PREPARING — at least one order in PREPARING
 *   SERVED — all orders served, none pending
 *   AWAITING_PAYMENT — bill requested
 *   CLOSED — paid + table cleaned
 *
 * Opening a session flips the table to OCCUPIED. Closing it flips back to FREE.
 */

async function ensureBranchAndTable({ tenantId, branchId, tableId }) {
  const branch = await branchesRepo.findById({ tenantId, id: branchId });
  if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
  const table = await tablesRepo.findById({ tenantId, id: tableId });
  if (!table) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
  if (table.branchId !== branchId) {
    throw AppError.badRequest('Table belongs to a different branch', 'TABLE_BRANCH_MISMATCH');
  }
  return { branch, table };
}

export const sessionsService = {
  async list({ tenantId, branchId, status }) {
    const rows = await sessionsRepo.list({ tenantId, branchId, status });
    return rows.map(serializeSession);
  },

  async getById({ tenantId, id }) {
    const session = await sessionsRepo.findById({ tenantId, id });
    if (!session) throw AppError.notFound('Session not found', 'SESSION_NOT_FOUND');
    return serializeSession(session);
  },

  async open({ tenantId, body, actor }) {
    const { table: _table } = await ensureBranchAndTable({
      tenantId,
      branchId: body.branchId,
      tableId: body.tableId,
    });
    void _table;

    const existing = await sessionsRepo.findOpenForTable({
      tenantId,
      tableId: body.tableId,
    });
    if (existing) {
      // Idempotent — return the open session instead of erroring.
      return serializeSession(existing);
    }

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.tableSession.create({
        data: {
          tenantId,
          branchId: body.branchId,
          tableId: body.tableId,
          guestName: body.guestName ?? null,
          guestPhone: body.guestPhone ?? null,
          partySize: body.partySize ?? 2,
          status: 'OPEN',
          paymentStatus: 'UNPAID',
        },
        include: {
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      // Flip the table to OCCUPIED (bypass the housekeeping guard since this
      // is the orders pipeline owning that transition).
      await tx.table.updateMany({
        where: { id: body.tableId, tenantId },
        data: { status: 'OCCUPIED' },
      });
      return created;
    });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_SESSION_OPENED',
      entityType: 'TableSession',
      entityId: session.id,
      metadata: { tableId: body.tableId, partySize: session.partySize },
    });

    emitToBranch(body.branchId, 'session:opened', { sessionId: session.id, tableId: body.tableId });
    emitToBranch(body.branchId, 'table:status', { id: body.tableId, status: 'OCCUPIED' });
    return serializeSession(session);
  },

  async close({ tenantId, id, actor }) {
    const cur = await sessionsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Session not found', 'SESSION_NOT_FOUND');
    if (cur.status === 'CLOSED') return serializeSession(cur);

    const closed = await prisma.$transaction(async (tx) => {
      const upd = await tx.tableSession.update({
        where: { id },
        data: { status: 'CLOSED', paymentStatus: 'PAID', closedAt: new Date() },
        include: {
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      // Free the table only if no other open sessions exist on it.
      const otherOpen = await tx.tableSession.count({
        where: {
          tableId: cur.tableId,
          status: { in: ['OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT'] },
          id: { not: id },
          deletedAt: null,
        },
      });
      if (otherOpen === 0) {
        await tx.table.updateMany({
          where: { id: cur.tableId, tenantId },
          data: { status: 'CLEANING' },
        });
      }
      return upd;
    });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_SESSION_CLOSED',
      entityType: 'TableSession',
      entityId: id,
    });

    emitToBranch(cur.branchId, 'session:closed', { sessionId: id });
    emitToBranch(cur.branchId, 'table:status', { id: cur.tableId, status: 'CLEANING' });
    return serializeSession(closed);
  },

  async requestBill({ tenantId, id, actor }) {
    const updated = await sessionsRepo.update({
      tenantId,
      id,
      data: { status: 'AWAITING_PAYMENT' },
    });
    if (!updated) throw AppError.notFound('Session not found', 'SESSION_NOT_FOUND');
    emitToBranch(updated.branchId, 'session:bill-requested', { sessionId: id });
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'GUEST_REQUEST_BILL',
      entityType: 'TableSession',
      entityId: id,
    });
    return serializeSession(updated);
  },

  async update({ tenantId, id, data, actor }) {
    const updated = await sessionsRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('Session not found', 'SESSION_NOT_FOUND');
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_SESSION_OPENED', // closest existing — better one would need a new enum
      entityType: 'TableSession',
      entityId: id,
      metadata: Object.keys(data),
    });
    return serializeSession(updated);
  },
};
