import { prisma } from '../../db/prisma.js';

const include = {
  parent: { select: { id: true, serial: true, amount: true, type: true } },
  children: {
    select: { id: true, serial: true, amount: true, type: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
  order: { select: { id: true, serial: true, grandTotal: true, channel: true } },
};

export const paymentsRepo = {
  list({ tenantId, where = {}, take = 50, skip = 0, orderBy }) {
    const fullWhere = { tenantId, deletedAt: null, ...where };
    return prisma.$transaction([
      prisma.payment.findMany({
        where: fullWhere,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }, { id: 'desc' }],
        include,
      }),
      prisma.payment.count({ where: fullWhere }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.payment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include,
    });
  },

  findByReference({ tenantId, reference }) {
    return prisma.payment.findFirst({
      where: { tenantId, reference, deletedAt: null },
    });
  },

  findByWebhookEvent({ gateway, webhookEventId }) {
    return prisma.payment.findFirst({
      where: { gateway, webhookEventId },
    });
  },

  listByOrder({ orderId }) {
    return prisma.payment.findMany({
      where: { orderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Sum of refund amounts already issued against a sale (positive number). */
  async totalRefunded({ parentPaymentId }) {
    const result = await prisma.payment.aggregate({
      where: {
        parentPaymentId,
        type: 'REFUND',
        status: { in: ['PENDING', 'SUCCESS', 'REFUNDED'] },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    return Math.abs(Number(result._sum.amount ?? 0));
  },

  create(data) {
    return prisma.payment.create({ data, include });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.payment.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.payment.findUnique({ where: { id }, include });
  },

  /* -------- KPI aggregates -------- */
  async stats({ tenantId, branchId, fromDate, toDate }) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [grossSales, refunds, tips, fees] = await prisma.$transaction([
      prisma.payment.aggregate({
        where: { ...where, type: 'SALE', status: 'SUCCESS' },
        _sum: { amount: true, fee: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { ...where, type: 'REFUND' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { ...where, type: 'TIP' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where,
        _sum: { fee: true },
      }),
    ]);

    return { grossSales, refunds, tips, fees, where };
  },

  async methodMix({ tenantId, branchId, fromDate, toDate }) {
    const where = {
      tenantId,
      deletedAt: null,
      type: 'SALE',
      status: 'SUCCESS',
      ...(branchId ? { branchId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };
    const groups = await prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
      _count: true,
    });
    return groups;
  },
};
