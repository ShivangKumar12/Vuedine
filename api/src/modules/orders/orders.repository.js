import { prisma } from '../../db/prisma.js';

/**
 * Orders repository — Prisma-only. Tenant + branch scoping enforced by
 * service. Soft-delete via deletedAt.
 *
 * Hot read paths use compound indexes:
 *   (tenantId, branchId, status), (tenantId, branchId, createdAt),
 *   (tenantId, branchId, channel, status), (sessionId).
 */

const includeAll = {
  items: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' } },
  session: true,
};

export const ordersRepo = {
  list({ tenantId, where = {}, take = 50, skip = 0, orderBy }) {
    const fullWhere = { tenantId, deletedAt: null, ...where };
    return prisma.$transaction([
      prisma.order.findMany({
        where: fullWhere,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { items: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.order.count({ where: fullWhere }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.order.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: includeAll,
    });
  },

  findBySerial({ branchId, serial }) {
    return prisma.order.findFirst({
      where: { branchId, serial, deletedAt: null },
      include: includeAll,
    });
  },

  findByIdempotencyKey({ tenantId, idempotencyKey }) {
    return prisma.order.findFirst({
      where: { tenantId, idempotencyKey, deletedAt: null },
      include: includeAll,
    });
  },

  create({ data, items, events }) {
    return prisma.order.create({
      data: {
        ...data,
        items: { create: items },
        events: { create: events ?? [] },
      },
      include: includeAll,
    });
  },

  /** Plain field update (no state-machine guard — caller's responsibility). */
  async update({ tenantId, id, data, eventToAppend }) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: { id, tenantId, deletedAt: null },
        data,
      });
      if (result.count === 0) return null;
      if (eventToAppend) {
        await tx.orderEvent.create({
          data: { ...eventToAppend, orderId: id },
        });
      }
      return tx.order.findUnique({ where: { id }, include: includeAll });
    });
  },

  async setLinePrepared({ orderId, lineId, prepared, actor }) {
    const result = await prisma.orderItem.updateMany({
      where: { id: lineId, orderId },
      data: {
        prepared,
        preparedAt: prepared ? new Date() : null,
        preparedBy: prepared ? (actor?.name ?? actor?.id ?? null) : null,
      },
    });
    if (result.count === 0) return null;
    return prisma.order.findUnique({ where: { id: orderId }, include: includeAll });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.order.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },

  /* -------- KDS-specific queries -------- */

  /** Tickets currently in the kitchen for a branch (status in ACCEPTED, PREPARING, READY). */
  listKdsTickets({ tenantId, branchId, station }) {
    return prisma.order.findMany({
      where: {
        tenantId,
        branchId,
        deletedAt: null,
        status: { in: ['ACCEPTED', 'PREPARING', 'READY'] },
        ...(station ? { station } : {}),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
  },

  /* -------- OSS-specific public read -------- */

  listOssTokens({ branchId }) {
    return prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { in: ['PREPARING', 'READY'] },
      },
      select: {
        id: true,
        token: true,
        serial: true,
        status: true,
        readyAt: true,
        createdAt: true,
        type: true,
      },
      orderBy: [{ readyAt: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
  },
};
