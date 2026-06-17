import { prisma } from '../../db/prisma.js';

/**
 * PaymentMethodConfig repository. Per-method config with branch-override
 * (branchId null = tenant default). Upsert keyed by (tenantId, branchId, method).
 */
export const paymentMethodConfigsRepo = {
  list({ tenantId, branchId }) {
    return prisma.paymentMethodConfig.findMany({
      where: { tenantId, ...(branchId !== undefined ? { branchId } : {}) },
      orderBy: [{ branchId: 'asc' }, { method: 'asc' }],
    });
  },

  findById({ tenantId, id }) {
    return prisma.paymentMethodConfig.findFirst({ where: { id, tenantId } });
  },

  async upsert({ tenantId, branchId = null, method, data }) {
    // Prisma can't use null inside a compound-unique where, so do a manual
    // find-then-write keyed on (tenantId, branchId, method).
    const existing = await prisma.paymentMethodConfig.findFirst({
      where: { tenantId, branchId, method },
      select: { id: true },
    });
    if (existing) {
      return prisma.paymentMethodConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.paymentMethodConfig.create({ data: { tenantId, branchId, method, ...data } });
  },

  async clearPreferred({ tenantId, branchId = null }) {
    await prisma.paymentMethodConfig.updateMany({
      where: { tenantId, branchId, preferred: true },
      data: { preferred: false },
    });
  },

  async remove({ tenantId, id }) {
    const res = await prisma.paymentMethodConfig.deleteMany({ where: { id, tenantId } });
    return res.count;
  },
};
