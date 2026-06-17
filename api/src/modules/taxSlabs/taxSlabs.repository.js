import { prisma } from '../../db/prisma.js';

/**
 * Tax-slab repository. Tenant-scoped reads; soft-delete via deletedAt.
 * branchId null = tenant default; a branch row overrides for that branch.
 */
export const taxSlabsRepo = {
  list({ tenantId, branchId, where = {} }) {
    return prisma.taxSlab.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId !== undefined ? { branchId } : {}),
        ...where,
      },
      orderBy: [{ branchId: 'asc' }, { rate: 'asc' }],
    });
  },

  findById({ tenantId, id }) {
    return prisma.taxSlab.findFirst({ where: { id, tenantId, deletedAt: null } });
  },

  create(data) {
    return prisma.taxSlab.create({ data });
  },

  async update({ tenantId, id, data }) {
    const res = await prisma.taxSlab.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (res.count === 0) return null;
    return prisma.taxSlab.findUnique({ where: { id } });
  },

  async clearDefaults({ tenantId, branchId }) {
    await prisma.taxSlab.updateMany({
      where: { tenantId, branchId: branchId ?? null, deletedAt: null, isDefault: true },
      data: { isDefault: false },
    });
  },

  async softDelete({ tenantId, id }) {
    const res = await prisma.taxSlab.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count;
  },
};
