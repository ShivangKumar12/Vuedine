import { prisma } from '../../db/prisma.js';
import {
  emitToBranch,
  emitToTenant,
  emitLiveOrder,
} from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { promotionsService } from '../promotions/promotions.service.js';
import { tablesRepo } from '../tables/tables.repository.js';

import { calculateOrder } from './order-calculator.js';
import { resolveStation, pickPrimaryStation } from './order-routing.js';
import { mintSerial, mintToken } from './order-serial.js';
import { assertTransition, nextStatus, ACTIVE } from './order-state.js';
import { ordersRepo } from './orders.repository.js';
import { serializeOrder } from './orders.serializer.js';

const CACHE_PREFIX = 'orders';

/* ============================================================ */
/*  Helpers                                                     */
/* ============================================================ */

async function loadBranchOrThrow({ tenantId, branchId }) {
  const branch = await branchesRepo.findById({ tenantId, id: branchId });
  if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
  return branch;
}

async function loadTenantTaxConfig({ tenantId }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { taxConfig: true },
  });
  return tenant?.taxConfig ?? null;
}

function timestampField(status) {
  switch (status) {
    case 'ACCEPTED':         return { acceptedAt: new Date() };
    case 'PREPARING':        return { startedAt: new Date() };
    case 'READY':            return { readyAt: new Date() };
    case 'OUT_FOR_DELIVERY': return { dispatchedAt: new Date() };
    case 'DELIVERED':        return { deliveredAt: new Date() };
    case 'SERVED':           return { servedAt: new Date() };
    case 'CANCELLED':        return { cancelledAt: new Date() };
    default:                 return {};
  }
}

/**
 * Resolve all promotion discounts for a cart: one optional coupon (validated,
 * throws when `strict`) PLUS any eligible auto-apply offers (stack with the
 * coupon per the v1 rule). Returns the combined absolute discount and the
 * list of applied promotions for redemption recording.
 *
 * @param {object} opts
 * @param {boolean} [opts.strict]   true → coupon ineligibility throws (order
 *                                  placement); false → silently skip (preview)
 */
async function resolveCartDiscounts({ tenantId, body, strict }) {
  const applied = [];
  let coupon = null;

  if (body.promoCode) {
    if (strict) {
      coupon = await promotionsService.resolveForOrder({
        tenantId,
        code: body.promoCode,
        lines: body.lines,
        channel: body.channel ?? 'POS',
        customerId: body.guestPhone ?? null,
      });
    } else {
      try {
        coupon = await promotionsService.resolveForOrder({
          tenantId,
          code: body.promoCode,
          lines: body.lines,
          channel: body.channel,
          customerId: body.guestPhone ?? null,
        });
      } catch {
        coupon = null;
      }
    }
    if (coupon) {
      applied.push({
        promotionId: coupon.promotionId,
        code: coupon.code,
        discount: coupon.discount,
        kind: 'COUPON',
      });
    }
  }

  // Auto-apply offers — stack with the coupon.
  let autoOffers = [];
  try {
    const res = await promotionsService.autoOffers({
      tenantId,
      body: { branchId: body.branchId, channel: body.channel, lines: body.lines },
    });
    autoOffers = res.offers ?? [];
  } catch {
    autoOffers = [];
  }
  for (const off of autoOffers) {
    applied.push({
      promotionId: off.promotionId,
      code: null,
      discount: off.discount,
      kind: 'OFFER',
    });
  }

  const totalDiscount = applied.reduce((s, a) => s + a.discount, 0);
  return { totalDiscount: Math.round(totalDiscount * 100) / 100, applied, coupon };
}

function eventTypeForStatus(status) {
  switch (status) {
    case 'PENDING':          return 'CREATED';
    case 'ACCEPTED':         return 'ACCEPTED';
    case 'PREPARING':        return 'STARTED';
    case 'READY':            return 'READY';
    case 'OUT_FOR_DELIVERY': return 'DISPATCHED';
    case 'DELIVERED':        return 'DELIVERED';
    case 'SERVED':           return 'SERVED';
    case 'CANCELLED':        return 'CANCELLED';
    default:                 return null;
  }
}

/* ============================================================ */
/*  Service                                                     */
/* ============================================================ */

export const ordersService = {
  /**
   * Quote-only: compute totals from the cart without creating anything.
   * Used by POS + customer Checkout to keep a live "Total: $X" in sync
   * with the server's view of money.
   */
  async calculate({ tenantId, body }) {
    const branch = await loadBranchOrThrow({ tenantId, branchId: body.branchId });
    const taxConfig = await loadTenantTaxConfig({ tenantId });

    // Resolve coupon (best-effort) + eligible auto-apply offers; they stack.
    const { totalDiscount } = await resolveCartDiscounts({ tenantId, body, strict: false });
    const promoDiscount = totalDiscount > 0 ? totalDiscount : undefined;

    const result = calculateOrder({
      lines: body.lines,
      branch,
      tenantTaxConfig: taxConfig,
      tipAmount: body.tipAmount,
      tipPct: body.tipPct,
      promoCode: body.promoCode,
      promoDiscount,
      discountPct: body.discountPct,
    });

    return result;
  },

  /**
   * Place a new order. Idempotency-Key is honored (returns the previously-
   * created order when key is reused). Emits realtime + appends a CREATED event.
   */
  async create({ tenantId, body, actor, idempotencyKey, source }) {
    if (idempotencyKey) {
      const existing = await ordersRepo.findByIdempotencyKey({ tenantId, idempotencyKey });
      if (existing) return serializeOrder(existing);
    }

    const branch = await loadBranchOrThrow({ tenantId, branchId: body.branchId });
    const taxConfig = await loadTenantTaxConfig({ tenantId });

    // Optional table validation — only when dine-in
    let tableLabel = body.tableLabel ?? null;
    if (body.type === 'DINE_IN' && body.tableId) {
      const t = await tablesRepo.findById({ tenantId, id: body.tableId });
      if (!t) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
      if (t.branchId !== body.branchId) {
        throw AppError.badRequest('Table belongs to a different branch', 'TABLE_BRANCH_MISMATCH');
      }
      tableLabel = tableLabel ?? t.name;
    }

    // Resolve coupon (strict — ineligible throws) + auto-apply offers (stack).
    const { totalDiscount, applied, coupon: promoResolution } = await resolveCartDiscounts({
      tenantId,
      body,
      strict: true,
    });

    // Server-side calc
    const calc = calculateOrder({
      lines: body.lines,
      branch,
      tenantTaxConfig: taxConfig,
      tipAmount: body.tipAmount,
      tipPct: body.tipPct,
      promoCode: body.promoCode,
      promoDiscount: totalDiscount > 0 ? totalDiscount : undefined,
      discountPct: body.discountPct,
    });

    // Per-line station (route to KDS)
    const itemsForCreate = calc.lines.map((l) => {
      const station = resolveStation({
        category: l.category,
        override: l.station,
      });
      return {
        itemId: l.itemId ?? null,
        itemName: l.itemName,
        emoji: l.emoji ?? null,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        variantId: l.variantId ?? null,
        variantLabel: l.variantLabel ?? null,
        addons: l.addons ?? [],
        notes: l.notes ?? null,
        spice: l.spice ?? null,
        station,
      };
    });

    const primaryStation = pickPrimaryStation(itemsForCreate);

    const serial = await mintSerial({ branchId: body.branchId, branchCode: branch.code });
    const token = mintToken();

    const order = await ordersRepo.create({
      data: {
        tenantId,
        branchId: body.branchId,
        sessionId: body.sessionId ?? null,
        tableId: body.tableId ?? null,
        tableLabel,
        serial,
        token,
        type: body.type,
        channel: body.channel ?? 'POS',
        source: body.source ?? source ?? body.channel ?? 'POS',
        station: body.station ?? primaryStation,
        priority: body.priority ?? 'NORMAL',
        guestName: body.guestName ?? null,
        guestPhone: body.guestPhone ?? null,
        deliveryAddress: body.deliveryAddress ?? null,
        deliveryNotes: body.deliveryNotes ?? null,
        driverName: body.driverName ?? null,
        driverPhone: body.driverPhone ?? null,
        etaMinutes: body.etaMinutes ?? branch.defaultPrep ?? 15,
        paymentMode: body.paymentMode ?? 'PAY_LATER',
        promoCode: body.promoCode ?? null,
        notes: body.notes ?? null,
        idempotencyKey: idempotencyKey ?? null,
        subtotal: calc.subtotal,
        discountTotal: calc.discountTotal,
        taxTotal: calc.taxTotal,
        serviceTotal: calc.serviceTotal,
        tipTotal: calc.tipTotal,
        grandTotal: calc.grandTotal,
        taxBreakdown: calc.taxBreakdown,
        status: 'PENDING',
      },
      items: itemsForCreate,
      events: [
        {
          type: 'CREATED',
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? actor?.email ?? null,
          message: `Order ${serial} created via ${body.channel ?? 'POS'}`,
          metadata: { itemCount: itemsForCreate.length, total: calc.grandTotal },
        },
      ],
    });

    await bumpVersion(CACHE_PREFIX);

    // Record redemptions for every applied promotion (coupon + auto-offers).
    // Scale each saved amount if the calculator clamped the combined discount
    // to the subtotal, so the recorded sum matches the actual discountTotal.
    if (applied.length > 0) {
      const rawSum = applied.reduce((s, a) => s + a.discount, 0);
      const scale = rawSum > 0 ? calc.discountTotal / rawSum : 0;
      for (const a of applied) {
        try {
          await promotionsService.recordRedemption({
            tenantId,
            promotionId: a.promotionId,
            orderId: order.id,
            customerId: body.guestPhone ?? null,
            amountSaved: Math.round(a.discount * scale * 100) / 100,
            code: a.code,
          });
        } catch (err) {
          // Usage-limit race lost or similar — log via audit; order stands.
          await auditService.record({
            tenantId,
            userId: actor?.id,
            action: 'PROMOTION_REDEEMED',
            entityType: 'Order',
            entityId: order.id,
            metadata: { failed: true, promotionId: a.promotionId, reason: err.code ?? err.message },
          });
        }
      }
    }
    void promoResolution;

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        serial,
        type: body.type,
        channel: body.channel,
        total: calc.grandTotal,
      },
    });

    const serialized = serializeOrder(order);
    // Realtime fan-out
    emitLiveOrder(body.branchId, 'created', serialized);
    emitToBranch(body.branchId, 'kds:ticket:new', serialized);
    emitToBranch(body.branchId, 'oss:tokens', { branchId: body.branchId });
    emitToTenant(tenantId, 'order:created', { id: order.id, branchId: body.branchId });

    return serialized;
  },

  async list({ tenantId, query }) {
    const {
      page = 1,
      pageSize = 50,
      branchId,
      status,
      channel,
      source,
      type,
      search,
      fromDate,
      toDate,
      active,
    } = query;
    const skip = (page - 1) * pageSize;
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
      ...(source ? { source } : {}),
      ...(type ? { type } : {}),
      ...(active === true ? { status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } } : {}),
      ...(active === false ? { status: { in: ['SERVED', 'DELIVERED', 'CANCELLED'] } } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { serial: { contains: search, mode: 'insensitive' } },
              { token: { contains: search, mode: 'insensitive' } },
              { guestName: { contains: search, mode: 'insensitive' } },
              { guestPhone: { contains: search, mode: 'insensitive' } },
              { tableLabel: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const cacheKey = `service:orders:${tenantId}:${page}:${pageSize}:${JSON.stringify(where)}`;
    const { rows, total } = await withCache(
      { key: cacheKey, ttlSec: 5, prefix: CACHE_PREFIX },
      async () => {
        const [r, t] = await ordersRepo.list({ tenantId, where, take: pageSize, skip });
        return { rows: r, total: t };
      },
    );
    return { rows: rows.map(serializeOrder), total };
  },

  async getById({ tenantId, id }) {
    const order = await ordersRepo.findById({ tenantId, id });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    return serializeOrder(order);
  },

  async update({ tenantId, id, data, actor }) {
    const cur = await ordersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const updated = await ordersRepo.update({
      tenantId,
      id,
      data,
      eventToAppend: {
        type: 'NOTE_ADDED',
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.email ?? null,
        message: `Updated by ${actor?.email ?? 'system'}`,
        metadata: { fields: Object.keys(data) },
      },
    });
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'ORDER_UPDATED',
      entityType: 'Order',
      entityId: id,
      metadata: Object.keys(data),
    });

    const serialized = serializeOrder(updated);
    emitLiveOrder(updated.branchId, 'updated', serialized);
    return serialized;
  },

  async setStatus({ tenantId, id, status, reason, actor }) {
    const cur = await ordersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    if (cur.status === status) return serializeOrder(cur);

    assertTransition(cur.status, status);

    const data = {
      status,
      ...timestampField(status),
      ...(status === 'CANCELLED' ? { cancelReason: reason ?? null } : {}),
    };

    const updated = await ordersRepo.update({
      tenantId,
      id,
      data,
      eventToAppend: {
        type: eventTypeForStatus(status) ?? 'CREATED',
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? actor?.email ?? null,
        message: `Status → ${status}${reason ? ` (${reason})` : ''}`,
        metadata: { from: cur.status, to: status, reason: reason ?? null },
      },
    });

    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
      entityType: 'Order',
      entityId: id,
      metadata: { from: cur.status, to: status, reason: reason ?? null },
    });

    const serialized = serializeOrder(updated);
    emitLiveOrder(updated.branchId, status.toLowerCase(), serialized);
    emitToBranch(updated.branchId, 'kds:ticket:updated', serialized);
    if (status === 'READY' || status === 'PREPARING') {
      emitToBranch(updated.branchId, 'oss:tokens', { branchId: updated.branchId });
    }
    return serialized;
  },

  async setLinePrepared({ tenantId, id, lineId, prepared, actor }) {
    const cur = await ordersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    if (cur.status === 'CANCELLED' || cur.status === 'SERVED' || cur.status === 'DELIVERED') {
      throw AppError.badRequest(
        'Cannot prepare lines on a closed order',
        'ORDER_CLOSED',
      );
    }

    const updated = await ordersRepo.setLinePrepared({
      orderId: id,
      lineId,
      prepared: Boolean(prepared),
      actor,
    });
    if (!updated) throw AppError.notFound('Order line not found', 'ORDER_LINE_NOT_FOUND');

    // If every line is prepared and status is PREPARING, auto-advance to READY.
    let final = updated;
    const allPrepared = updated.items.length > 0 && updated.items.every((l) => l.prepared);
    if (allPrepared && updated.status === 'PREPARING') {
      final = await ordersRepo.update({
        tenantId,
        id,
        data: { status: 'READY', readyAt: new Date() },
        eventToAppend: {
          type: 'READY',
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? null,
          message: 'All lines prepared — ready',
        },
      });
      emitLiveOrder(final.branchId, 'ready', serializeOrder(final));
      emitToBranch(final.branchId, 'oss:tokens', { branchId: final.branchId });
    }

    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'ORDER_LINE_PREPARED',
      entityType: 'OrderItem',
      entityId: lineId,
      metadata: { orderId: id, prepared },
    });

    const serialized = serializeOrder(final);
    emitToBranch(final.branchId, 'kds:ticket:updated', serialized);
    emitLiveOrder(final.branchId, 'updated', serialized);
    return serialized;
  },

  async cancel({ tenantId, id, reason, actor }) {
    return this.setStatus({ tenantId, id, status: 'CANCELLED', reason, actor });
  },

  async advance({ tenantId, id, actor }) {
    const cur = await ordersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    const next = nextStatus({ status: cur.status, type: cur.type });
    if (!next) {
      throw AppError.badRequest('Order cannot advance further', 'ORDER_TERMINAL');
    }
    return this.setStatus({ tenantId, id, status: next, actor });
  },

  async recall({ tenantId, id, actor }) {
    return this.setStatus({ tenantId, id, status: 'PREPARING', actor });
  },

  /* -------- Stats / KPIs surface -------- */
  async stats({ tenantId, branchId }) {
    const where = { tenantId, deletedAt: null, ...(branchId ? { branchId } : {}) };
    const [total, newCount, cooking, ready, revenueAgg] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: 'PENDING' } }),
      prisma.order.count({
        where: { ...where, status: { in: ['ACCEPTED', 'PREPARING'] } },
      }),
      prisma.order.count({ where: { ...where, status: 'READY' } }),
      prisma.order.aggregate({
        where: { ...where, status: { notIn: ['CANCELLED'] } },
        _sum: { grandTotal: true },
      }),
    ]);
    return {
      total,
      newCount,
      cooking,
      ready,
      revenue: Number(revenueAgg._sum.grandTotal ?? 0),
      activeStatuses: [...ACTIVE],
    };
  },
};
