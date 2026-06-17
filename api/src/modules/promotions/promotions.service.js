import { emitToTenant } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { checkEligibility, computePromotionDiscount } from './promotion-calculator.js';
import { promotionsRepo } from './promotions.repository.js';
import {
  serializeCoupon,
  serializeOffer,
  serializePromotion,
} from './promotions.serializer.js';

/**
 * Promotions service — coupon + offer CRUD, apply-coupon validation,
 * auto-offer surfacing, redemption recording, and the worker entrypoints
 * for scheduled activation + expiry.
 *
 * Stacking rule (v1): one COUPON per order; auto-applied OFFERS may stack
 * with that single coupon. Enforced where redemptions are recorded.
 */

const CACHE_PREFIX = 'promos';

function dualSerialize(p) {
  // Return the page-appropriate shape based on type, plus the normalized view.
  const base = serializePromotion(p);
  return p.type === 'OFFER'
    ? { ...serializeOffer(p), _promotion: base }
    : { ...serializeCoupon(p), _promotion: base };
}

function normalizeBody(body) {
  const data = { ...body };
  // Coerce date strings → Date.
  if (data.startsAt) data.startsAt = new Date(data.startsAt);
  if (data.endsAt) data.endsAt = new Date(data.endsAt);
  // Empty code → null (offers).
  if (data.code === '' || data.code === undefined) data.code = null;
  return data;
}

export const promotionsService = {
  async list({ tenantId, query }) {
    const { page = 1, pageSize = 200, type, status, kind, search } = query;
    const skip = (page - 1) * pageSize;
    const where = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const cacheKey = `service:promos:${tenantId}:${page}:${pageSize}:${JSON.stringify(where)}`;
    const { rows, total } = await withCache(
      { key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX },
      async () => {
        const [r, t] = await promotionsRepo.list({ tenantId, where, take: pageSize, skip });
        return { rows: r, total: t };
      },
    );
    return { rows: rows.map(dualSerialize), total };
  },

  async getById({ tenantId, id }) {
    const p = await promotionsRepo.findById({ tenantId, id });
    if (!p) throw AppError.notFound('Promotion not found', 'PROMOTION_NOT_FOUND');
    return dualSerialize(p);
  },

  async create({ tenantId, body, actor }) {
    const data = normalizeBody(body);

    if (data.code) {
      const dup = await promotionsRepo.findByCode({ tenantId, code: data.code });
      if (dup) {
        throw AppError.conflict(`Code "${data.code}" is already in use`, 'PROMOTION_CODE_TAKEN');
      }
    }

    // Auto-derive status if not explicitly set: SCHEDULED when startsAt is
    // in the future, EXPIRED when endsAt already passed, else ACTIVE.
    if (!data.status) {
      const now = new Date();
      if (data.startsAt > now) data.status = 'SCHEDULED';
      else if (data.endsAt < now) data.status = 'EXPIRED';
      else data.status = 'ACTIVE';
    }

    const created = await promotionsRepo.create({ ...data, tenantId });
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PROMOTION_CREATED',
      entityType: 'Promotion',
      entityId: created.id,
      metadata: { type: created.type, kind: created.kind, code: created.code },
    });

    return dualSerialize(created);
  },

  async update({ tenantId, id, body, actor }) {
    const data = normalizeBody(body);
    if (data.code) {
      const dup = await promotionsRepo.findByCode({ tenantId, code: data.code });
      if (dup && dup.id !== id) {
        throw AppError.conflict(`Code "${data.code}" is already in use`, 'PROMOTION_CODE_TAKEN');
      }
    }
    const updated = await promotionsRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('Promotion not found', 'PROMOTION_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PROMOTION_UPDATED',
      entityType: 'Promotion',
      entityId: id,
      metadata: Object.keys(data),
    });

    return dualSerialize(updated);
  },

  async remove({ tenantId, id, actor }) {
    const count = await promotionsRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Promotion not found', 'PROMOTION_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PROMOTION_DELETED',
      entityType: 'Promotion',
      entityId: id,
    });
  },

  async pause({ tenantId, id, actor }) {
    const cur = await promotionsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Promotion not found', 'PROMOTION_NOT_FOUND');
    if (cur.status === 'EXPIRED' || cur.status === 'ENDED') {
      throw AppError.badRequest('Cannot pause an expired/ended promotion', 'PROMOTION_TERMINAL');
    }
    const updated = await promotionsRepo.update({ tenantId, id, data: { status: 'PAUSED' } });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PROMOTION_PAUSED',
      entityType: 'Promotion',
      entityId: id,
    });
    return dualSerialize(updated);
  },

  async resume({ tenantId, id, actor }) {
    const cur = await promotionsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Promotion not found', 'PROMOTION_NOT_FOUND');
    const now = new Date();
    let next = 'ACTIVE';
    if (new Date(cur.startsAt) > now) next = 'SCHEDULED';
    else if (new Date(cur.endsAt) < now) {
      throw AppError.badRequest('Promotion window has passed', 'PROMOTION_EXPIRED');
    }
    const updated = await promotionsRepo.update({ tenantId, id, data: { status: next } });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PROMOTION_RESUMED',
      entityType: 'Promotion',
      entityId: id,
    });
    return dualSerialize(updated);
  },

  /* -------- Cart integration -------- */

  /**
   * Validate a coupon against a cart and return a discount preview.
   * Does NOT record a redemption — that happens at order placement.
   */
  async applyCoupon({ tenantId, body, branchTimezone }) {
    const code = body.code.trim().toUpperCase();
    const promo = await promotionsRepo.findByCode({ tenantId, code });
    if (!promo) {
      throw AppError.notFound('Coupon code not found', 'PROMOTION_CODE_NOT_FOUND');
    }
    if (promo.type !== 'COUPON') {
      throw AppError.badRequest('This code is not a coupon', 'PROMOTION_NOT_COUPON');
    }

    const subtotal = body.lines.reduce(
      (s, l) => s + Number(l.unitPrice) * (Number(l.qty) || 1),
      0,
    );

    const elig = checkEligibility(promo, {
      subtotal,
      lines: body.lines,
      channel: body.channel,
      now: new Date(),
      timezone: branchTimezone,
    });
    if (!elig.eligible) {
      throw AppError.badRequest(eligibilityMessage(elig.reason, promo), elig.reason);
    }

    // Per-user limit (best-effort preview; the hard guard is at redemption).
    if (body.customerId && promo.perUserLimit > 0) {
      const usedByUser = await promotionsRepo.countRedemptionsByCustomer({
        promotionId: promo.id,
        customerId: body.customerId,
      });
      if (usedByUser >= promo.perUserLimit) {
        throw AppError.conflict(
          'You have already used this coupon the maximum number of times',
          'PROMOTION_PER_USER_LIMIT',
        );
      }
    }

    const discount = computePromotionDiscount(promo, { lines: body.lines, subtotal });
    if (discount <= 0) {
      throw AppError.badRequest('Coupon yields no discount for this cart', 'PROMOTION_NO_DISCOUNT');
    }

    return {
      promotionId: promo.id,
      code: promo.code,
      title: promo.title,
      kind: promo.kind,
      scope: promo.scope,
      discount,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  },

  /**
   * Surface auto-apply offers applicable to a cart right now. Returns each
   * with its computed discount so the UI can show "you saved $X".
   */
  async autoOffers({ tenantId, body, branchTimezone }) {
    const offers = await withCache(
      {
        key: `service:auto-offers:${tenantId}`,
        ttlSec: 300,
        prefix: CACHE_PREFIX,
      },
      () => promotionsRepo.listAutoOffers({ tenantId }),
    );

    const subtotal = body.lines.reduce(
      (s, l) => s + Number(l.unitPrice) * (Number(l.qty) || 1),
      0,
    );

    const applicable = [];
    for (const promo of offers) {
      const elig = checkEligibility(promo, {
        subtotal,
        lines: body.lines,
        channel: body.channel,
        now: new Date(),
        timezone: branchTimezone,
      });
      if (!elig.eligible) continue;
      const discount = computePromotionDiscount(promo, { lines: body.lines, subtotal });
      if (discount <= 0) continue;
      applicable.push({
        promotionId: promo.id,
        title: promo.title,
        emoji: promo.emoji,
        kind: promo.kind,
        summary: promo.summary,
        discount,
      });
    }
    // Best discount first.
    applicable.sort((a, b) => b.discount - a.discount);
    return { offers: applicable, subtotal: Math.round(subtotal * 100) / 100 };
  },

  /**
   * Resolve a coupon code to a discount for the order calculator. Throws on
   * any ineligibility so the order placement surfaces the precise reason.
   * Returns { promotionId, code, discount } — caller records the redemption.
   */
  async resolveForOrder({ tenantId, code, lines, channel, customerId }) {
    const result = await this.applyCoupon({
      tenantId,
      body: { code, lines, channel, customerId },
    });
    return result;
  },

  /** Record a redemption atomically (called from orders.service on placement). */
  async recordRedemption({ tenantId, promotionId, orderId, customerId, amountSaved, code }) {
    const res = await promotionsRepo.redeem({ promotionId, orderId, customerId, amountSaved });
    if (!res.ok) {
      throw AppError.conflict(
        eligibilityMessage(res.reason),
        res.reason ?? 'PROMOTION_REDEEM_FAILED',
      );
    }
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      action: 'PROMOTION_REDEEMED',
      entityType: 'Promotion',
      entityId: promotionId,
      metadata: { orderId, amountSaved, code },
    });
    emitToTenant(tenantId, 'promotion:redeemed', { promotionId, orderId, amountSaved });
    return res.redemption;
  },

  /* -------- Worker entrypoints -------- */

  async expirePast({ now = new Date() } = {}) {
    const count = await promotionsRepo.expirePast({ now });
    if (count > 0) {
      // Bump cache for all tenants; cheap and correct.
      await bumpVersion(CACHE_PREFIX);
    }
    return count;
  },

  async activateScheduled({ now = new Date() } = {}) {
    const count = await promotionsRepo.activateScheduled({ now });
    if (count > 0) await bumpVersion(CACHE_PREFIX);
    return count;
  },
};

function eligibilityMessage(reason, promo) {
  switch (reason) {
    case 'PROMO_NOT_ACTIVE':
      return 'This promotion is not currently active';
    case 'PROMO_NOT_STARTED':
      return 'This promotion has not started yet';
    case 'PROMO_EXPIRED':
      return 'This promotion has expired';
    case 'PROMO_MIN_ORDER_NOT_MET':
      return promo
        ? `Minimum order of ${Number(promo.minOrder)} required`
        : 'Minimum order not met';
    case 'PROMO_USAGE_LIMIT_REACHED':
      return 'This promotion has reached its usage limit';
    case 'PROMO_CHANNEL_NOT_ALLOWED':
      return 'This promotion is not valid on this channel';
    case 'PROMO_DAY_NOT_ALLOWED':
      return 'This promotion is not valid today';
    case 'PROMO_OUTSIDE_HOURS':
      return 'This promotion is only valid during its happy-hour window';
    case 'PROMO_NO_MATCHING_ITEMS':
      return 'No items in your cart qualify for this promotion';
    default:
      return 'This promotion cannot be applied';
  }
}
