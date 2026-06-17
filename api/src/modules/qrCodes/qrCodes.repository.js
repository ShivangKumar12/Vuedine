import { prisma } from '../../db/prisma.js';

/**
 * QR-code repository. Tenant-scoped reads; soft-delete via deletedAt.
 * Branch is NOT a Prisma relation here (the model only carries branchId per
 * the Phase G spec) — the service attaches branch display names.
 */
export const qrCodesRepo = {
  list({ tenantId, where = {}, take = 500, skip = 0 }) {
    return prisma.$transaction([
      prisma.qrCode.findMany({
        where: { tenantId, deletedAt: null, ...where },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      prisma.qrCode.count({ where: { tenantId, deletedAt: null, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.qrCode.findFirst({ where: { id, tenantId, deletedAt: null } });
  },

  findByToken({ token }) {
    return prisma.qrCode.findFirst({ where: { token, deletedAt: null } });
  },

  findByTableId({ tableId }) {
    return prisma.qrCode.findFirst({ where: { tableId, deletedAt: null } });
  },

  create(data) {
    return prisma.qrCode.create({ data });
  },

  async update({ tenantId, id, data }) {
    const res = await prisma.qrCode.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (res.count === 0) return null;
    return prisma.qrCode.findFirst({ where: { id } });
  },

  async softDelete({ tenantId, id }) {
    const res = await prisma.qrCode.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return res.count;
  },

  /** Atomically bump the scan counter + write a scan row. */
  recordScan({ qrCodeId, ip, userAgent, referrer }) {
    return prisma.$transaction([
      prisma.qrCode.update({ where: { id: qrCodeId }, data: { scans: { increment: 1 } } }),
      prisma.qrScan.create({ data: { qrCodeId, ip, userAgent, referrer } }),
    ]);
  },

  incrementOrders({ qrCodeId }) {
    return prisma.qrCode.update({ where: { id: qrCodeId }, data: { ordersCount: { increment: 1 } } });
  },

  /** Daily scan buckets for the analytics endpoint (last N days). */
  scanSeries({ qrCodeId, since }) {
    return prisma.qrScan.findMany({
      where: { qrCodeId, at: { gte: since } },
      select: { at: true },
      orderBy: { at: 'asc' },
    });
  },

  countScansSince({ tenantId, since }) {
    return prisma.qrScan.count({
      where: { at: { gte: since }, qrCode: { tenantId, deletedAt: null } },
    });
  },
};
