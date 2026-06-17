import { prisma } from '../../db/prisma.js';

/**
 * Users repository — Prisma-only queries. Tenant scoping enforced by the
 * service. Soft delete via deletedAt.
 */

const staffInclude = {
  customRole: { select: { id: true, name: true, permissions: true, color: true } },
  shifts: {
    where: { endedAt: null },
    select: { id: true, startedAt: true, branchId: true },
    take: 1,
    orderBy: { startedAt: 'desc' },
  },
};

const customerInclude = {
  customerProfile: true,
};

function userWhere({ tenantId, deletedAt = null }) {
  return { tenantId, deletedAt };
}

export const usersRepo = {
  list({ tenantId, where = {}, take = 100, skip = 0, orderBy }) {
    const fullWhere = { ...userWhere({ tenantId }), ...where };
    return prisma.$transaction([
      prisma.user.findMany({
        where: fullWhere,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { ...staffInclude, ...customerInclude },
      }),
      prisma.user.count({ where: fullWhere }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { ...staffInclude, ...customerInclude },
    });
  },

  findByEmail({ tenantId, email }) {
    return prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
      include: { ...staffInclude },
    });
  },

  findByInviteToken({ token }) {
    return prisma.user.findFirst({
      where: { inviteToken: token, deletedAt: null },
    });
  },

  create(data) {
    return prisma.user.create({ data, include: { ...staffInclude, ...customerInclude } });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.user.findUnique({
      where: { id },
      include: { ...staffInclude, ...customerInclude },
    });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    return result.count;
  },

  /* -------- Audit trail -------- */
  auditLog({ userId, take = 20 }) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },
};
