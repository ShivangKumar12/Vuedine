import { prisma } from '../../db/prisma.js';

export const rolesRepo = {
  list({ tenantId }) {
    return prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
      orderBy: [{ systemRole: 'desc' }, { name: 'asc' }],
    });
  },

  findById({ tenantId, id }) {
    return prisma.role.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });
  },

  findByName({ tenantId, name }) {
    return prisma.role.findFirst({ where: { tenantId, name, deletedAt: null } });
  },

  create(data) {
    return prisma.role.create({
      data,
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.role.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.role.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },
};
