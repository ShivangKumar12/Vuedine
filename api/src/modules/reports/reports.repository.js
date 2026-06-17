import { prisma } from '../../db/prisma.js';

/**
 * Reports repository — read-only aggregation over base tables (Order /
 * OrderItem / Payment / CustomerProfile / Item). No materialized views: the
 * spec (pitfall #3) sanctions base-table reads to avoid stale current-day MV
 * rows; results are cached at the service layer.
 */

const COMPLETED = ['DELIVERED', 'SERVED'];

function orderWhere({ tenantId, branchId, fromDate, toDate }) {
  return {
    tenantId,
    deletedAt: null,
    ...(branchId ? { branchId } : {}),
    createdAt: { gte: fromDate, lte: toDate },
  };
}

export const reportsRepo = {
  /** Minimal order rows for in-memory bucketing (series, mixes, status). */
  fetchOrders({ tenantId, branchId, fromDate, toDate, take = 50000 }) {
    return prisma.order.findMany({
      where: orderWhere({ tenantId, branchId, fromDate, toDate }),
      select: {
        id: true,
        serial: true,
        status: true,
        type: true,
        channel: true,
        paymentMode: true,
        paymentStatus: true,
        grandTotal: true,
        discountTotal: true,
        guestName: true,
        guestPhone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  /** Paginated ledger rows for the sales report table. */
  listOrders({ where, take, skip }) {
    return prisma.$transaction([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          serial: true,
          status: true,
          type: true,
          channel: true,
          paymentMode: true,
          paymentStatus: true,
          grandTotal: true,
          discountTotal: true,
          guestName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ]);
  },

  orderWhere,
  COMPLETED,

  itemPopularity({ tenantId, branchId, fromDate, toDate, take = 10 }) {
    return prisma.orderItem.groupBy({
      by: ['itemName', 'emoji'],
      where: {
        order: {
          tenantId,
          deletedAt: null,
          status: { in: COMPLETED },
          ...(branchId ? { branchId } : {}),
          createdAt: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take,
    });
  },

  topCustomers({ tenantId, take = 5 }) {
    return prisma.customerProfile.findMany({
      where: { tenantId },
      orderBy: { totalSpend: 'desc' },
      take,
      select: { totalSpend: true, totalOrders: true, user: { select: { name: true } } },
    });
  },

  customerCounts({ tenantId, fromDate, toDate }) {
    const lapsed = new Date(Date.now() - 60 * 86400_000);
    return prisma.$transaction([
      prisma.customerProfile.count({ where: { tenantId } }),
      prisma.customerProfile.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.customerProfile.count({ where: { tenantId, totalOrders: { gt: 1 } } }),
      prisma.customerProfile.count({ where: { tenantId, OR: [{ lastOrderAt: null }, { lastOrderAt: { lt: lapsed } }] } }),
    ]);
  },

  itemCount({ tenantId }) {
    return prisma.item.count({ where: { tenantId, deletedAt: null } });
  },

  featuredItems({ tenantId, take = 4 }) {
    return prisma.item.findMany({
      where: { tenantId, deletedAt: null, bestseller: true },
      take,
      select: { name: true, emoji: true, price: true },
    });
  },

  /** Per-cashier sales (payments) for staff performance. */
  cashierSales({ tenantId, branchId, fromDate, toDate }) {
    return prisma.payment.groupBy({
      by: ['cashierId', 'cashierName'],
      where: {
        tenantId,
        deletedAt: null,
        type: 'SALE',
        status: 'SUCCESS',
        cashierId: { not: null },
        ...(branchId ? { branchId } : {}),
        createdAt: { gte: fromDate, lte: toDate },
      },
      _sum: { amount: true },
      _count: true,
    });
  },
};
