import { prisma } from '../../db/prisma.js';

const include = {
  orders: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  },
};

export const sessionsRepo = {
  list({ tenantId, branchId, status }) {
    return prisma.tableSession.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ openedAt: 'desc' }],
      include,
    });
  },

  findById({ tenantId, id }) {
    return prisma.tableSession.findFirst({
      where: { id, tenantId, deletedAt: null },
      include,
    });
  },

  findOpenForTable({ tenantId, tableId }) {
    return prisma.tableSession.findFirst({
      where: {
        tenantId,
        tableId,
        deletedAt: null,
        status: { in: ['OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT'] },
      },
      include,
    });
  },

  create(data) {
    return prisma.tableSession.create({ data, include });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.tableSession.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.tableSession.findUnique({ where: { id }, include });
  },
};
