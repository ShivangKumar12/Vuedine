import { prisma } from '../../db/prisma.js';
import { emitToBranch } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { calculateOrder } from '../orders/order-calculator.js';
import { ordersRepo } from '../orders/orders.repository.js';
import { serializeOrder } from '../orders/orders.serializer.js';
import { ordersService } from '../orders/orders.service.js';
import { promotionsService } from '../promotions/promotions.service.js';
import { qrCodesService } from '../qrCodes/qrCodes.service.js';
import { tablesRepo } from '../tables/tables.repository.js';

/**
 * Public PWA endpoints — no auth, public + rate-limited.
 *
 * The customer-facing flow:
 *   1. Scan QR → /public/qr/:branchSlug/:qrToken — resolve table + branch
 *   2. Browse menu → /public/menu/:branchSlug
 *   3. Live totals → /public/orders/calculate
 *   4. Place order → /public/orders (Idempotency-Key)
 *   5. Track → /public/orders/:orderId (status + ETA)
 *   6. Ring waiter / request bill / feedback → /public/orders/:orderId/signal
 */

const PAY_MODE_TO_DB = {
  'pay-at-counter': 'PAY_LATER',
  'pay-now-upi': 'UPI',
  'pay-now-card': 'CARD',
};

async function loadBranchAndTax(branchSlug) {
  const branch = await branchesRepo.findBySlug({ qrSlug: branchSlug });
  if (!branch || !branch.isLive) {
    throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: branch.tenantId },
    select: { taxConfig: true, currency: true, name: true },
  });
  return { branch, tenant };
}

export const publicService = {
  async resolveQr({ branchSlug, qrToken }) {
    const branch = await branchesRepo.findBySlug({ qrSlug: branchSlug });
    if (!branch || !branch.isLive) {
      throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    }
    const table = await tablesRepo.findByQrToken({ qrToken });
    if (!table || !table.active || table.branchId !== branch.id) {
      throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    }
    return {
      branch: {
        id: branch.id,
        name: branch.name,
        qrSlug: branch.qrSlug,
        defaultPrep: branch.defaultPrep,
        serviceCharge: Number(branch.serviceCharge),
        taxInclusive: branch.taxInclusive,
      },
      table: {
        id: table.id,
        name: table.name,
        section: table.section,
        capacity: table.capacity,
        shape: table.shape,
        status: table.status,
      },
    };
  },

  async getMenu({ branchSlug, category, search }) {
    const { branch } = await loadBranchAndTax(branchSlug);

    const where = {
      tenantId: branch.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const items = await prisma.item.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    // Filter to items active at this branch (empty branchIds = all branches).
    const filtered = items.filter(
      (i) => !Array.isArray(i.branchIds) || i.branchIds.length === 0 || i.branchIds.includes(branch.id),
    );

    // Group by category for the customer UI.
    const byCategory = {};
    for (const it of filtered) {
      byCategory[it.category] = byCategory[it.category] ?? [];
      byCategory[it.category].push({
        id: it.id,
        name: it.name,
        category: it.category,
        price: Number(it.price),
        emoji: it.emoji,
        imageUrl: it.imageUrl,
        veg: it.veg,
        bestseller: it.bestseller,
        description: it.description,
      });
    }

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        qrSlug: branch.qrSlug,
      },
      items: filtered.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        price: Number(i.price),
        emoji: i.emoji,
        imageUrl: i.imageUrl,
        veg: i.veg,
        bestseller: i.bestseller,
        description: i.description,
      })),
      categories: Object.keys(byCategory).sort(),
    };
  },

  async calculate({ body }) {
    const { branch, tenant } = await loadBranchAndTax(body.branchSlug);

    // Resolve a real coupon (best-effort) + eligible auto-apply offers so the
    // guest sees the true discount. They stack per the v1 rule.
    let promoDiscount = 0;
    if (body.promoCode) {
      try {
        const resolved = await promotionsService.resolveForOrder({
          tenantId: branch.tenantId,
          code: body.promoCode,
          lines: body.lines,
          channel: 'QR',
        });
        promoDiscount += resolved.discount;
      } catch {
        /* ignore ineligible code in preview */
      }
    }
    try {
      const auto = await promotionsService.autoOffers({
        tenantId: branch.tenantId,
        body: { branchId: branch.id, channel: 'QR', lines: body.lines },
      });
      promoDiscount += (auto.offers ?? []).reduce((s, o) => s + o.discount, 0);
    } catch {
      /* ignore */
    }

    const result = calculateOrder({
      lines: body.lines,
      branch,
      tenantTaxConfig: tenant?.taxConfig,
      tipAmount: body.tipAmount,
      tipPct: body.tipPct,
      promoCode: body.promoCode,
      promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
      isPublic: true,
    });
    return result;
  },

  /** Public coupon validation for the guest Checkout promo box. */
  async applyCoupon({ body }) {
    const { branch } = await loadBranchAndTax(body.branchSlug);
    return promotionsService.applyCoupon({
      tenantId: branch.tenantId,
      body: {
        code: body.code,
        channel: 'QR',
        lines: body.lines,
        customerId: body.customerId ?? null,
      },
    });
  },

  async placeOrder({ body, idempotencyKey }) {
    const { branch } = await loadBranchAndTax(body.branchSlug);
    const table = await tablesRepo.findByQrToken({ qrToken: body.qrToken });
    if (!table || table.branchId !== branch.id) {
      throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    }

    // For the guest flow, only pass the promo code through if it actually
    // resolves — a bad/expired code must never block the order from placing.
    let validPromoCode = null;
    if (body.promoCode) {
      try {
        await promotionsService.resolveForOrder({
          tenantId: branch.tenantId,
          code: body.promoCode,
          lines: body.lines,
          channel: 'QR',
          customerId: body.guestPhone ?? null,
        });
        validPromoCode = body.promoCode;
      } catch {
        validPromoCode = null;
      }
    }

    const order = await ordersService.create({
      tenantId: branch.tenantId,
      body: {
        branchId: branch.id,
        type: 'DINE_IN',
        channel: 'QR',
        source: 'QR',
        tableId: table.id,
        tableLabel: table.name,
        guestName: body.guestName ?? null,
        guestPhone: body.guestPhone ?? null,
        paymentMode: PAY_MODE_TO_DB[body.payMode] ?? 'PAY_LATER',
        promoCode: validPromoCode,
        tipAmount: body.tipAmount,
        tipPct: body.tipPct,
        lines: body.lines,
      },
      actor: null,
      idempotencyKey,
      source: 'QR',
    });

    // Phase G — count this as a QR-driven conversion (best-effort).
    qrCodesService.incrementOrdersForTable({ tableId: table.id }).catch(() => {});

    return order;
  },

  async trackOrder({ orderId }) {
    // Tenant-agnostic find — track is by id only.
    const order = await prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
    return serializeOrder(order);
  },

  async signal({ orderId, body }) {
    const order = await ordersRepo.findById({ tenantId: undefined, id: orderId });
    // The track surface is public so we drop the tenant scope guard. Find by id only.
    const o =
      order ??
      (await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } }));
    if (!o) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

    const signal = await prisma.guestSignal.create({
      data: {
        tenantId: o.tenantId,
        branchId: o.branchId,
        tableId: o.tableId,
        orderId: o.id,
        type: body.type,
        guestName: o.guestName,
        guestPhone: o.guestPhone,
        message: body.message ?? null,
        rating: body.rating ?? null,
      },
    });

    // Append to the order timeline so dashboard sees it inline.
    const eventType =
      body.type === 'WAITER_RING' ? 'WAITER_RING'
        : body.type === 'BILL_REQUEST' ? 'BILL_REQUESTED'
        : body.type === 'FEEDBACK' ? 'FEEDBACK_RECEIVED'
        : 'NOTE_ADDED';

    await prisma.orderEvent.create({
      data: {
        orderId: o.id,
        type: eventType,
        message: body.message ?? body.type,
        metadata: { rating: body.rating ?? null },
      },
    });

    emitToBranch(o.branchId, 'guest:signal', {
      orderId: o.id,
      tableId: o.tableId,
      type: body.type,
      message: body.message ?? null,
      rating: body.rating ?? null,
    });

    const auditAction =
      body.type === 'WAITER_RING' ? 'GUEST_RING_WAITER'
        : body.type === 'BILL_REQUEST' ? 'GUEST_REQUEST_BILL'
        : body.type === 'FEEDBACK' ? 'GUEST_FEEDBACK'
        : 'GUEST_RING_WAITER';

    await auditService.record({
      tenantId: o.tenantId,
      action: auditAction,
      entityType: 'Order',
      entityId: o.id,
      metadata: { rating: body.rating ?? null, message: body.message ?? null },
    });

    return {
      id: signal.id,
      type: signal.type,
      orderId: signal.orderId,
      createdAt: signal.createdAt,
    };
  },
};
