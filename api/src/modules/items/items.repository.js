import { prisma } from '../../db/prisma.js';

/**
 * Items repository — Prisma queries only. No business logic here.
 *
 * Every read is implicitly tenant-scoped via the caller passing tenantId.
 * The service layer is responsible for never calling these without one.
 */
export const itemsRepo = {
  list({ tenantId, where = {}, take = 20, skip = 0, orderBy }) {
    return prisma.$transaction([
      prisma.item.findMany({
        where: { tenantId, ...where },
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.item.count({ where: { tenantId, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.item.findFirst({ where: { id, tenantId } });
  },

  findByName({ tenantId, name }) {
    return prisma.item.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
  },

  create(data) {
    return prisma.item.create({ data });
  },

  /**
   * Two-step update so we can return the row even after Prisma's `updateMany`
   * (which doesn't return rows). Tenant scoping enforced via the where clause.
   */
  async update({ tenantId, id, data }) {
    const result = await prisma.item.updateMany({
      where: { id, tenantId },
      data,
    });
    if (result.count === 0) return null;
    return prisma.item.findUnique({ where: { id } });
  },

  /** Soft delete via deletedAt (Item has the column — see Phase 5 schema change). */
  async softDelete({ tenantId, id }) {
    const result = await prisma.item.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },
};
