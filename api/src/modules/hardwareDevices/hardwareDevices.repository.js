import { prisma } from '../../db/prisma.js';

/**
 * HardwareDevice repository. Tenant + branch scoped; soft-delete via deletedAt.
 */
export const hardwareDevicesRepo = {
  list({ tenantId, branchId, type }) {
    return prisma.hardwareDevice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  },

  findById({ tenantId, id }) {
    return prisma.hardwareDevice.findFirst({ where: { id, tenantId, deletedAt: null } });
  },

  create(data) {
    return prisma.hardwareDevice.create({ data });
  },

  async update({ tenantId, id, data }) {
    const res = await prisma.hardwareDevice.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (res.count === 0) return null;
    return prisma.hardwareDevice.findUnique({ where: { id } });
  },

  async softDelete({ tenantId, id }) {
    const res = await prisma.hardwareDevice.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), active: false },
    });
    return res.count;
  },

  markStaleOffline({ olderThan }) {
    return prisma.hardwareDevice.updateMany({
      where: { deletedAt: null, active: true, lastSeenAt: { lt: olderThan } },
      data: { active: false },
    });
  },
};
