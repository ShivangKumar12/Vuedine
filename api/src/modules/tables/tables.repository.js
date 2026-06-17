import { prisma } from '../../db/prisma.js';

/**
 * Tables repository — Prisma queries only. Branch + tenant scoping enforced
 * by the service layer.
 */
export const tablesRepo = {
  list({ tenantId, where = {}, take = 200, skip = 0, orderBy }) {
    return prisma.$transaction([
      prisma.table.findMany({
        where: { tenantId, deletedAt: null, ...where },
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.table.count({ where: { tenantId, deletedAt: null, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.table.findFirst({ where: { id, tenantId, deletedAt: null } });
  },

  findByQrToken({ qrToken }) {
    return prisma.table.findFirst({
      where: { qrToken, deletedAt: null },
      include: { branch: true },
    });
  },

  findByName({ branchId, name }) {
    return prisma.table.findFirst({
      where: { branchId, name, deletedAt: null },
    });
  },

  create(data) {
    return prisma.table.create({ data });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.table.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.table.findUnique({ where: { id } });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.table.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },
};
