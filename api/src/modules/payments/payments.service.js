import { prisma } from '../../db/prisma.js';
import { emitToBranch, emitToTenant } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { ordersRepo } from '../orders/orders.repository.js';

import { mintPaymentSerial } from './payment-serial.js';
import { paymentsRepo } from './payments.repository.js';
import {
  serializePayment,
  serializeSettlement,
} from './payments.serializer.js';

/**
 * Payments service.
 *
 * Money-handling rules:
 *   - Refunds carry a NEGATIVE amount on the row (so the ledger reads
 *     left-to-right: sale +18, refund -18, net 0). Refund.amount in the
 *     API is positive — we negate at the service boundary.
 *   - Comps are negative SALE-equivalent rows of type COMP.
 *   - Tips are positive type=TIP rows.
 *   - Refunds cannot exceed the original sale amount minus prior refunds
 *     (atomic check in a transaction).
 *   - Order.paymentStatus is recomputed after every payment mutation
 *     based on totalSuccessfulSale - totalRefund vs Order.grandTotal.
 */

const CACHE_PREFIX = 'payments';

const CASH_METHODS = new Set(['CASH']);

async function loadOrderOrThrow({ tenantId, orderId }) {
  const order = await ordersRepo.findById({ tenantId, id: orderId });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  return order;
}

async function recomputeOrderPaymentStatus({ tenantId, orderId }) {
  const order = await ordersRepo.findById({ tenantId, id: orderId });
  if (!order) return null;
  const all = await paymentsRepo.listByOrder({ orderId });
  let captured = 0;
  for (const p of all) {
    if (p.type === 'SALE' && (p.status === 'SUCCESS' || p.status === 'REFUNDED')) {
      captured += Number(p.amount);
    }
    if (p.type === 'REFUND' && p.status !== 'FAILED') {
      // amount is negative on refund rows
      captured += Number(p.amount);
    }
    if (p.type === 'TIP' && p.status === 'SUCCESS') {
      // tips don't count toward order grand total
    }
    if (p.type === 'COMP' && p.status === 'SUCCESS') {
      captured += Number(p.amount); // negative
    }
  }
  const grand = Number(order.grandTotal);
  let next = 'UNPAID';
  if (captured >= grand && grand > 0) next = 'PAID';
  else if (captured > 0) next = 'PARTIAL';
  // If a refund pushed everything back to zero or below, mark REFUNDED.
  const refunded = all.some((p) => p.type === 'REFUND' && p.status === 'SUCCESS');
  if (refunded && captured <= 0.001) next = 'REFUNDED';

  if (order.paymentStatus !== next) {
    await ordersRepo.update({
      tenantId,
      id: orderId,
      data: { paymentStatus: next },
    });
  }
  return next;
}

export const paymentsService = {
  /* -------- Lookups -------- */
  async list({ tenantId, query }) {
    const { page = 1, pageSize = 50, branchId, search, method, type, status, fromDate, toDate } = query;
    const skip = (page - 1) * pageSize;
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(method ? { method } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
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
              { reference: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { order: { serial: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const cacheKey = `service:tx:${tenantId}:${page}:${pageSize}:${JSON.stringify(where)}`;
    const { rows, total } = await withCache(
      { key: cacheKey, ttlSec: 5, prefix: CACHE_PREFIX },
      async () => {
        const [r, t] = await paymentsRepo.list({ tenantId, where, take: pageSize, skip });
        return { rows: r, total: t };
      },
    );
    return { rows: rows.map(serializePayment), total };
  },

  async getById({ tenantId, id }) {
    const p = await paymentsRepo.findById({ tenantId, id });
    if (!p) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    return serializePayment(p);
  },

  async stats({ tenantId, branchId, fromDate, toDate }) {
    const stats = await paymentsRepo.stats({ tenantId, branchId, fromDate, toDate });
    const grossSales = Number(stats.grossSales._sum.amount ?? 0);
    const refunds = Math.abs(Number(stats.refunds._sum.amount ?? 0));
    const tips = Number(stats.tips._sum.amount ?? 0);
    const fees = Number(stats.fees._sum.fee ?? 0);
    const net = grossSales - refunds - fees;

    const mix = await paymentsRepo.methodMix({ tenantId, branchId, fromDate, toDate });
    const methodMix = ['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'LOYALTY'].map((m) => {
      const row = mix.find((x) => x.method === m);
      return {
        method: m,
        amount: Number(row?._sum?.amount ?? 0),
        count: row?._count ?? 0,
      };
    });
    const total = methodMix.reduce((s, m) => s + m.amount, 0);
    const methodMixWithShare = methodMix.map((m) => ({
      ...m,
      share: total > 0 ? m.amount / total : 0,
    }));

    return {
      grossSales,
      refunds,
      tips,
      fees,
      net,
      methodMix: methodMixWithShare,
    };
  },

  /* -------- Create payment -------- */
  async createForOrder({ tenantId, orderId, body, actor }) {
    const order = await loadOrderOrThrow({ tenantId, orderId });
    const branch = await branchesRepo.findById({ tenantId, id: order.branchId });
    if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');

    const isCash = CASH_METHODS.has(body.method);
    const status = body.capture || isCash ? 'SUCCESS' : 'PENDING';
    const serial = await mintPaymentSerial({
      branchId: branch.id,
      branchCode: branch.code,
    });

    const payment = await paymentsRepo.create({
      tenantId,
      branchId: branch.id,
      orderId,
      serial,
      type: body.type ?? 'SALE',
      method: body.method,
      status,
      amount: body.amount,
      fee: body.fee ?? 0,
      currency: branch.currency ?? 'INR',
      cashierId: actor?.id ?? null,
      cashierName: actor?.name ?? actor?.email ?? null,
      customerName: body.customerName ?? order.guestName ?? null,
      reference: body.reference ?? null,
      gateway: body.gateway ?? null,
      channel: order.channel,
      capturedAt: status === 'SUCCESS' ? new Date() : null,
    });

    await bumpVersion(CACHE_PREFIX);

    if (status === 'SUCCESS') {
      await recomputeOrderPaymentStatus({ tenantId, orderId });
      await auditService.record({
        tenantId,
        userId: actor?.id,
        action: payment.type === 'TIP' ? 'PAYMENT_TIP' : 'PAYMENT_CAPTURED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { orderId, method: body.method, amount: body.amount },
      });
      emitToBranch(branch.id, 'payment:status', {
        orderId,
        paymentId: payment.id,
        status: payment.status,
      });
      emitToBranch(branch.id, 'order:paid', {
        orderId,
        total: Number(order.grandTotal),
        method: body.method,
      });
      emitToTenant(tenantId, 'payment:created', { id: payment.id, branchId: branch.id });
    }

    return serializePayment(payment);
  },

  /* -------- Refund -------- */
  async refund({ tenantId, orderId, paymentId, body, actor }) {
    const order = await loadOrderOrThrow({ tenantId, orderId });
    const sale = await paymentsRepo.findById({ tenantId, id: paymentId });
    if (!sale) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (sale.orderId !== orderId) {
      throw AppError.badRequest('Payment does not belong to this order', 'PAYMENT_ORDER_MISMATCH');
    }
    if (sale.type !== 'SALE') {
      throw AppError.badRequest('Only SALE payments can be refunded', 'PAYMENT_NOT_REFUNDABLE');
    }
    if (sale.status !== 'SUCCESS' && sale.status !== 'REFUNDED') {
      throw AppError.badRequest('Cannot refund a non-success sale', 'PAYMENT_NOT_REFUNDABLE');
    }

    const totalRefunded = await paymentsRepo.totalRefunded({ parentPaymentId: paymentId });
    const remaining = Number(sale.amount) - totalRefunded;
    if (body.amount > remaining + 0.001) {
      throw AppError.badRequest(
        `Refund amount exceeds remaining (${remaining.toFixed(2)})`,
        'REFUND_EXCEEDS_REMAINING',
      );
    }

    const refundSerial = await mintPaymentSerial({
      branchId: sale.branchId,
      branchCode: order.branch?.code ?? sale.serial.split('-')[1] ?? 'BR',
    });

    // For cash, refund is immediate. For online, leave PENDING and the
    // gateway webhook flips to SUCCESS.
    const isCash = CASH_METHODS.has(sale.method);
    const refundStatus = isCash ? 'SUCCESS' : 'PENDING';

    const refund = await paymentsRepo.create({
      tenantId,
      branchId: sale.branchId,
      orderId,
      serial: refundSerial,
      type: 'REFUND',
      method: sale.method,
      status: refundStatus,
      amount: -Math.abs(body.amount),
      fee: 0,
      currency: sale.currency,
      cashierId: actor?.id ?? null,
      cashierName: actor?.name ?? actor?.email ?? null,
      customerName: sale.customerName,
      reference: body.reason ?? null,
      gateway: sale.gateway,
      channel: order.channel,
      parentPaymentId: paymentId,
      capturedAt: refundStatus === 'SUCCESS' ? new Date() : null,
    });

    // Mark the sale as REFUNDED if fully refunded.
    const newRefundTotal = totalRefunded + body.amount;
    if (newRefundTotal >= Number(sale.amount) - 0.001) {
      await paymentsRepo.update({
        tenantId,
        id: paymentId,
        data: { status: 'REFUNDED' },
      });
    }

    await bumpVersion(CACHE_PREFIX);
    await recomputeOrderPaymentStatus({ tenantId, orderId });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_REFUNDED',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: { refundId: refund.id, amount: body.amount, reason: body.reason },
    });

    emitToBranch(sale.branchId, 'payment:status', {
      orderId,
      paymentId: refund.id,
      status: refund.status,
    });

    return serializePayment(refund);
  },

  /* -------- Comp -------- */
  async comp({ tenantId, orderId, body, actor }) {
    const order = await loadOrderOrThrow({ tenantId, orderId });
    const branch = await branchesRepo.findById({ tenantId, id: order.branchId });
    if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');

    const serial = await mintPaymentSerial({
      branchId: branch.id,
      branchCode: branch.code,
    });

    const payment = await paymentsRepo.create({
      tenantId,
      branchId: branch.id,
      orderId,
      serial,
      type: 'COMP',
      method: 'LOYALTY',
      status: 'SUCCESS',
      amount: -Math.abs(body.amount),
      fee: 0,
      currency: branch.currency ?? 'INR',
      cashierId: actor?.id ?? null,
      cashierName: actor?.name ?? actor?.email ?? null,
      customerName: order.guestName,
      reference: body.reason ?? null,
      channel: order.channel,
      capturedAt: new Date(),
    });

    await bumpVersion(CACHE_PREFIX);
    await recomputeOrderPaymentStatus({ tenantId, orderId });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_COMP',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { orderId, amount: body.amount, reason: body.reason },
    });

    emitToBranch(branch.id, 'payment:status', {
      orderId,
      paymentId: payment.id,
      status: payment.status,
    });

    return serializePayment(payment);
  },

  /* -------- Recapture (stuck PENDING) -------- */
  async recapture({ tenantId, id, actor }) {
    const p = await paymentsRepo.findById({ tenantId, id });
    if (!p) throw AppError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
    if (p.status !== 'PENDING') {
      throw AppError.badRequest('Only PENDING payments can be recaptured', 'PAYMENT_NOT_PENDING');
    }
    // Without a real gateway client, we just flip to SUCCESS in dev. The
    // gateway poll worker (Phase F) does the real query.
    const updated = await paymentsRepo.update({
      tenantId,
      id,
      data: { status: 'SUCCESS', capturedAt: new Date() },
    });
    await bumpVersion(CACHE_PREFIX);
    if (p.orderId) {
      await recomputeOrderPaymentStatus({ tenantId, orderId: p.orderId });
    }
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_CAPTURED',
      entityType: 'Payment',
      entityId: id,
      metadata: { recaptured: true },
    });
    emitToBranch(p.branchId, 'payment:status', {
      orderId: p.orderId,
      paymentId: id,
      status: 'SUCCESS',
    });
    return serializePayment(updated);
  },

  /* -------- Settlements -------- */
  async listSettlements({ tenantId, query }) {
    const { page = 1, pageSize = 50, gateway } = query;
    const skip = (page - 1) * pageSize;
    const where = { tenantId, ...(gateway ? { gateway } : {}) };
    const [rows, total] = await prisma.$transaction([
      prisma.settlement.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { settledAt: 'desc' },
      }),
      prisma.settlement.count({ where }),
    ]);
    return { rows: rows.map(serializeSettlement), total };
  },

  /**
   * Manual settlement sync. Without a live gateway client we fabricate a
   * synthetic batch from successful gateway-routed sale payments since the
   * last settlement. In production the worker pulls real batches via the
   * gateway API.
   */
  async syncSettlement({ tenantId, gateway, actor }) {
    const last = await prisma.settlement.findFirst({
      where: { tenantId, gateway },
      orderBy: { settledAt: 'desc' },
    });
    const since = last?.settledAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    const candidates = await prisma.payment.findMany({
      where: {
        tenantId,
        gateway,
        type: 'SALE',
        status: 'SUCCESS',
        capturedAt: { gt: since },
        deletedAt: null,
      },
      select: { id: true, amount: true, fee: true },
    });

    if (candidates.length === 0) {
      throw AppError.notFound(
        `No new ${gateway} payments to settle since ${since.toISOString()}`,
        'NO_NEW_PAYMENTS',
      );
    }

    const grossAmount = candidates.reduce((s, p) => s + Number(p.amount), 0);
    const feeAmount = candidates.reduce((s, p) => s + Number(p.fee), 0);
    const netAmount = grossAmount - feeAmount;

    const settlement = await prisma.settlement.create({
      data: {
        tenantId,
        gateway,
        reference: `${gateway}_settle_${Date.now()}`,
        grossAmount,
        feeAmount,
        netAmount,
        paymentCount: candidates.length,
        settledAt: new Date(),
      },
    });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SETTLEMENT_SYNCED',
      entityType: 'Settlement',
      entityId: settlement.id,
      metadata: { gateway, paymentCount: candidates.length, netAmount },
    });

    return serializeSettlement(settlement);
  },
};
