import { prisma } from '../../db/prisma.js';

/**
 * Branches repository — Prisma queries only. No business logic here.
 *
 * Every read is implicitly tenant-scoped via the caller passing tenantId.
 * Soft-delete: `deletedAt IS NULL` is enforced in every read.
 */
export const branchesRepo = {
  list({ tenantId, where = {}, take = 200, skip = 0 }) {
    return prisma.$transaction([
      prisma.branch.findMany({
        where: { tenantId, deletedAt: null, ...where },
        take,
        skip,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          _count: { select: { tables: { where: { deletedAt: null } } } },
        },
      }),
      prisma.branch.count({ where: { tenantId, deletedAt: null, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.branch.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: { select: { tables: { where: { deletedAt: null } } } },
      },
    });
  },

  findByCode({ tenantId, code }) {
    return prisma.branch.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
  },

  findBySlug({ qrSlug }) {
    return prisma.branch.findFirst({ where: { qrSlug, deletedAt: null } });
  },

  create(data) {
    return prisma.branch.create({ data });
  },

  /**
   * Two-step update so we can return the row even when Prisma's `updateMany`
   * doesn't yield it. Tenant scoping enforced via the where clause.
   */
  async update({ tenantId, id, data }) {
    const result = await prisma.branch.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.branch.findUnique({
      where: { id },
      include: {
        _count: { select: { tables: { where: { deletedAt: null } } } },
      },
    });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.branch.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },
};
