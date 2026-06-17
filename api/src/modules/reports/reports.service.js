import { prisma } from '../../db/prisma.js';
import { enqueueReport } from '../../queues/report.queue.js';
import { AppError } from '../../utils/AppError.js';
import { withCache } from '../../utils/cache.js';

import { reportsRepo } from './reports.repository.js';
import { dayKey, hourInTz, lastNDayKeys, resolveRange } from './reportTime.js';

const CACHE_PREFIX = 'reports';
const COMPLETED = new Set(['DELIVERED', 'SERVED']);

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

const PAYMENT_LABEL = { CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet', ONLINE: 'Online', PAY_LATER: 'Cash' };
const PAYMENTS = ['Cash', 'Card', 'UPI', 'Wallet', 'Online'];
const TYPES = ['Dine-In', 'Takeaway', 'Delivery', 'QR'];

function localType(o) {
  if (o.channel === 'QR' && o.type === 'DINE_IN') return 'QR';
  if (o.type === 'TAKEAWAY') return 'Takeaway';
  if (o.type === 'DELIVERY') return 'Delivery';
  return 'Dine-In';
}

function payStatus(o) {
  if (o.status === 'CANCELLED') return 'Failed';
  if (o.paymentStatus === 'PAID') return 'Paid';
  if (o.paymentStatus === 'REFUNDED') return 'Refunded';
  return 'Pending';
}

async function tenantTz(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  return t?.timezone ?? 'Asia/Kolkata';
}

function pctDelta(curr, prev) {
  if (prev <= 0) return { delta: curr > 0 ? '+100%' : '0%', up: curr >= 0 };
  const change = ((curr - prev) / prev) * 100;
  const rounded = Math.round(change);
  return { delta: `${rounded >= 0 ? '+' : ''}${rounded}%`, up: rounded >= 0 };
}

export const reportsService = {
  async dashboard({ tenantId, query }) {
    const { fromDate, toDate } = resolveRange({ from: query.from, to: query.to, defaultDays: 30 });
    const branchId = query.branchId || undefined;
    const cacheKey = `svc:reports:dash:${tenantId}:${branchId ?? 'all'}:${fromDate.toISOString()}:${toDate.toISOString()}`;

    return withCache({ key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX }, async () => {
      const tz = await tenantTz(tenantId);
      const spanMs = toDate.getTime() - fromDate.getTime();
      const prevFrom = new Date(fromDate.getTime() - spanMs);

      const [orders, prevOrders, custCounts, itemCount, top, featured, popular] = await Promise.all([
        reportsRepo.fetchOrders({ tenantId, branchId, fromDate, toDate }),
        reportsRepo.fetchOrders({ tenantId, branchId, fromDate: prevFrom, toDate: fromDate }),
        reportsRepo.customerCounts({ tenantId, fromDate, toDate }),
        reportsRepo.itemCount({ tenantId }),
        reportsRepo.topCustomers({ tenantId, take: 5 }),
        reportsRepo.featuredItems({ tenantId, take: 4 }),
        reportsRepo.itemPopularity({ tenantId, branchId, fromDate, toDate, take: 5 }),
      ]);

      const completed = orders.filter((o) => COMPLETED.has(o.status));
      const prevCompleted = prevOrders.filter((o) => COMPLETED.has(o.status));
      const totalSales = completed.reduce((s, o) => s + num(o.grandTotal), 0);
      const prevSales = prevCompleted.reduce((s, o) => s + num(o.grandTotal), 0);
      const nonCancelled = orders.filter((o) => o.status !== 'CANCELLED');
      const prevNonCancelled = prevOrders.filter((o) => o.status !== 'CANCELLED');

      // Status counts (within range)
      const sc = { PENDING: 0, ACCEPTED: 0, PREPARING: 0, READY: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, SERVED: 0, CANCELLED: 0 };
      for (const o of orders) sc[o.status] = (sc[o.status] ?? 0) + 1;

      // Daily sales bars (last 14 days, completed gross)
      const dayKeys = lastNDayKeys(14, tz);
      const byDay = new Map(dayKeys.map((k) => [k, 0]));
      for (const o of completed) {
        const k = dayKey(o.createdAt, tz);
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + num(o.grandTotal));
      }
      const bars = dayKeys.map((k) => Math.round(byDay.get(k)));

      // Orders summary (% of range orders)
      const totalOrdersAll = orders.length || 1;
      const ordersSummary = {
        delivered: Math.round((sc.DELIVERED / totalOrdersAll) * 100),
        returned: 0,
        cancelled: Math.round((sc.CANCELLED / totalOrdersAll) * 100),
        rejected: 0,
      };

      const [custTotal, custNew, custReturning, custInactive] = custCounts;
      const days = Math.max(1, Math.round(spanMs / 86400_000));

      return {
        kpis: {
          totalSales: { value: Math.round(totalSales), ...pctDelta(totalSales, prevSales) },
          totalOrders: { value: nonCancelled.length, ...pctDelta(nonCancelled.length, prevNonCancelled.length) },
          totalCustomers: { value: custTotal, delta: `+${custNew}`, up: true },
          totalMenuItems: { value: itemCount, delta: '+0', up: true },
        },
        orderStatusCounts: {
          total: orders.length,
          pending: sc.PENDING,
          accepted: sc.ACCEPTED,
          preparing: sc.PREPARING,
          prepared: sc.READY,
          outForDelivery: sc.OUT_FOR_DELIVERY,
          delivered: sc.DELIVERED,
          cancelled: sc.CANCELLED,
        },
        salesSummary: {
          bars,
          totalSales: Math.round(totalSales),
          avgPerDay: Math.round(totalSales / days),
        },
        ordersSummary,
        customerStats: {
          new: { value: custNew, ...pctDelta(custNew, 0) },
          returning: { value: custReturning, delta: '+0%', up: true },
          inactive: { value: custInactive, delta: '0%', up: false },
        },
        topCustomers: top.map((c) => ({ name: c.user?.name ?? 'Customer', spend: Math.round(num(c.totalSpend)), orders: c.totalOrders })),
        featuredItems: (() => {
          const soldByName = new Map(popular.map((p) => [p.itemName, p._sum.qty ?? 0]));
          return featured.map((it) => ({ e: it.emoji ?? '🍽️', name: it.name, price: Math.round(num(it.price)), sold: soldByName.get(it.name) ?? 0, tag: 'Bestseller' }));
        })(),
        mostPopularItems: (() => {
          const max = Math.max(1, ...popular.map((p) => p._sum.qty ?? 0));
          return popular.map((p) => ({ e: p.emoji ?? '🍽️', name: p.itemName, sold: p._sum.qty ?? 0, p: Math.round(((p._sum.qty ?? 0) / max) * 100) }));
        })(),
        range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      };
    });
  },

  /** Sales report payload: KPIs + hourly + paymentMix + typeMix + paginated rows. */
  async sales({ tenantId, query }) {
    const { fromDate, toDate } = resolveRange({ from: query.from, to: query.to, defaultDays: 30 });
    const branchId = query.branchId || undefined;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const tz = await tenantTz(tenantId);

    const orders = await reportsRepo.fetchOrders({ tenantId, branchId, fromDate, toDate });
    const rows = orders
      .map((o) => ({
        id: o.serial,
        iso: o.createdAt.toISOString(),
        total: num(o.grandTotal),
        discount: num(o.discountTotal),
        delivery: 0,
        payment: PAYMENT_LABEL[o.paymentMode] ?? 'Cash',
        status: payStatus(o),
        type: localType(o),
        customer: o.guestName ?? 'Walking customer',
      }))
      // Apply server-side filters (search/type/payment/status)
      .filter((r) => {
        if (query.type && query.type !== 'All' && r.type !== query.type) return false;
        if (query.payment && query.payment !== 'All' && r.payment !== query.payment) return false;
        if (query.status && query.status !== 'All' && r.status !== query.status) return false;
        if (query.search) {
          const s = query.search.toLowerCase();
          if (!r.id.toLowerCase().includes(s) && !r.customer.toLowerCase().includes(s)) return false;
        }
        return true;
      });

    const paid = rows.filter((r) => r.status === 'Paid');
    const earnings = paid.reduce((s, r) => s + r.total, 0);
    const kpis = {
      orders: rows.length,
      earnings,
      discounts: rows.reduce((s, r) => s + r.discount, 0),
      delivery: rows.reduce((s, r) => s + r.delivery, 0),
    };

    // Hourly bars (10..23) of paid earnings, tenant tz
    const hourMap = new Map();
    for (let h = 10; h <= 23; h += 1) hourMap.set(h, 0);
    for (const r of paid) {
      const h = hourInTz(new Date(r.iso), tz);
      if (hourMap.has(h)) hourMap.set(h, hourMap.get(h) + r.total);
    }
    const hourly = Array.from(hourMap.entries()).map(([h, v]) => ({ h, v }));

    const paymentMix = PAYMENTS.map((m) => {
      const v = paid.filter((r) => r.payment === m).reduce((s, r) => s + r.total, 0);
      return { m, v, share: earnings > 0 ? v / earnings : 0 };
    });
    const typeMix = TYPES.map((t) => {
      const v = paid.filter((r) => r.type === t).reduce((s, r) => s + r.total, 0);
      return { t, v, share: earnings > 0 ? v / earnings : 0 };
    });

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return { kpis, hourly, paymentMix, typeMix, rows: pageRows, total, page, pageSize };
  },

  async itemsPopularity({ tenantId, query }) {
    const days = query.period === '7d' ? 7 : query.period === '90d' ? 90 : 30;
    const { fromDate, toDate } = resolveRange({ defaultDays: days });
    const rows = await reportsRepo.itemPopularity({ tenantId, branchId: query.branchId || undefined, fromDate, toDate, take: 20 });
    const max = Math.max(1, ...rows.map((r) => r._sum.qty ?? 0));
    return rows.map((r) => ({ name: r.itemName, emoji: r.emoji ?? '🍽️', sold: r._sum.qty ?? 0, share: Math.round(((r._sum.qty ?? 0) / max) * 100) }));
  },

  async topCustomers({ tenantId, query }) {
    const top = await reportsRepo.topCustomers({ tenantId, take: query.take ?? 10 });
    return top.map((c, i) => ({ rank: i + 1, name: c.user?.name ?? 'Customer', spend: Math.round(num(c.totalSpend)), orders: c.totalOrders }));
  },

  async staffPerformance({ tenantId, query }) {
    const { fromDate, toDate } = resolveRange({ from: query.from, to: query.to, defaultDays: 30 });
    const branchId = query.branchId || undefined;
    const cashiers = await reportsRepo.cashierSales({ tenantId, branchId, fromDate, toDate });
    return {
      cashiers: cashiers.map((c) => ({
        cashierId: c.cashierId,
        name: c.cashierName ?? 'Unknown',
        sales: Math.round(num(c._sum.amount)),
        transactions: c._count,
      })).sort((a, b) => b.sales - a.sales),
    };
  },

  /** CSV of the sales rows matching the current filter (for inline export). */
  async buildSalesCsv({ tenantId, query }) {
    const data = await this.sales({ tenantId, query: { ...query, page: 1, pageSize: 100000 } });
    const header = 'Order ID,Date,Total,Discount,Delivery,Payment,Status,Type,Customer\n';
    const body = data.rows
      .map((r) => [r.id, r.iso, r.total.toFixed(2), r.discount.toFixed(2), r.delivery.toFixed(2), r.payment, r.status, r.type, r.customer]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    return header + body;
  },

  /** Queue an async export build (large/emailed). */
  async enqueueExport({ tenantId, branchId, from, to, format, actor }) {
    const { fromDate, toDate } = resolveRange({ from, to, defaultDays: 30 });
    let jobId = null;
    try {
      const job = await enqueueReport({
        tenantId,
        branchId: branchId ?? 'all',
        type: format === 'pdf' ? 'sales-pdf' : 'sales-csv',
        range: { from: fromDate.toISOString(), to: toDate.toISOString() },
        requestedBy: actor?.id,
      });
      jobId = job?.id ?? null;
    } catch {
      throw AppError.dependencyDown('Export queue unavailable', 'QUEUE_UNAVAILABLE');
    }
    return { queued: true, jobId, message: 'Export queued — the owner will receive an email when it is ready.' };
  },
};
