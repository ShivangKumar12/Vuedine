import { prisma } from '../../db/prisma.js';

/**
 * Promotions repository — Prisma queries only. Tenant scoping enforced by
 * the service layer. Soft delete via deletedAt.
 */
export const promotionsRepo = {
  list({ tenantId, where = {}, take = 200, skip = 0, orderBy }) {
    const fullWhere = { tenantId, deletedAt: null, ...where };
    return prisma.$transaction([
      prisma.promotion.findMany({
        where: fullWhere,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.promotion.count({ where: fullWhere }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.promotion.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  },

  findByCode({ tenantId, code }) {
    return prisma.promotion.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
  },

  /** Active auto-apply offers for a tenant (used by the auto-offers endpoint). */
  listAutoOffers({ tenantId }) {
    return prisma.promotion.findMany({
      where: {
        tenantId,
        deletedAt: null,
        type: 'OFFER',
        autoApply: true,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  create(data) {
    return prisma.promotion.create({ data });
  },

  async update({ tenantId, id, data }) {
    const result = await prisma.promotion.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return prisma.promotion.findUnique({ where: { id } });
  },

  async softDelete({ tenantId, id }) {
    const result = await prisma.promotion.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ENDED' },
    });
    return result.count;
  },

  /** Per-user redemption count for the perUserLimit guard. */
  countRedemptionsByCustomer({ promotionId, customerId }) {
    return prisma.promotionRedemption.count({
      where: { promotionId, customerId },
    });
  },

  /**
   * Atomically record a redemption + bump counters. Enforces usageLimit
   * inside the transaction so racing redemptions can't overshoot.
   *
   * Returns the created redemption, or null if the usage limit was reached.
   */
  async redeem({ promotionId, orderId, customerId, amountSaved }) {
    return prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.findUnique({ where: { id: promotionId } });
      if (!promo) return { ok: false, reason: 'PROMO_NOT_FOUND' };
      if (promo.usageLimit > 0 && promo.used >= promo.usageLimit) {
        return { ok: false, reason: 'PROMO_USAGE_LIMIT_REACHED' };
      }

      const redemption = await tx.promotionRedemption.create({
        data: { promotionId, orderId, customerId: customerId ?? null, amountSaved },
      });

      await tx.orderPromotion.upsert({
        where: { orderId_promotionId: { orderId, promotionId } },
        create: { orderId, promotionId, code: promo.code, amountSaved },
        update: { amountSaved },
      });

      const updated = await tx.promotion.update({
        where: { id: promotionId },
        data: {
          used: { increment: 1 },
          redemptions: { increment: 1 },
          revenue: { increment: amountSaved },
        },
      });

      return { ok: true, redemption, promotion: updated };
    });
  },

  /* -------- Worker queries -------- */

  /** ACTIVE promos whose endsAt has passed → flip to EXPIRED. */
  async expirePast({ now }) {
    const result = await prisma.promotion.updateMany({
      where: { status: 'ACTIVE', endsAt: { lt: now }, deletedAt: null },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  },

  /** SCHEDULED promos whose startsAt has arrived (and not yet ended). */
  async activateScheduled({ now }) {
    const result = await prisma.promotion.updateMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { lte: now },
        endsAt: { gt: now },
        deletedAt: null,
      },
      data: { status: 'ACTIVE' },
    });
    return result.count;
  },
};
