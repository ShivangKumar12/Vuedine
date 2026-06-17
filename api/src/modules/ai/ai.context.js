import { prisma } from '../../db/prisma.js';
import { reportsRepo } from '../reports/reports.repository.js';
import { hourInTz, resolveRange } from '../reports/reportTime.js';

/**
 * Build a grounded context snapshot for the AI assistant from the tenant's
 * real data (last `days` days). Everything the assistant says is anchored to
 * these numbers — no hallucinated figures.
 */

const COMPLETED = new Set(['DELIVERED', 'SERVED']);

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

async function tenantTz(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  return t?.timezone ?? 'Asia/Kolkata';
}

export async function buildContext({ tenantId, branchId, days = 7 }) {
  const { fromDate, toDate } = resolveRange({ defaultDays: days });
  const tz = await tenantTz(tenantId);

  const [orders, popular, itemCount] = await Promise.all([
    reportsRepo.fetchOrders({ tenantId, branchId, fromDate, toDate }),
    reportsRepo.itemPopularity({ tenantId, branchId, fromDate, toDate, take: 5 }),
    reportsRepo.itemCount({ tenantId }),
  ]);

  const completed = orders.filter((o) => COMPLETED.has(o.status));
  const totalSales = completed.reduce((s, o) => s + num(o.grandTotal), 0);
  const orderCount = orders.filter((o) => o.status !== 'CANCELLED').length;
  const avgOrderValue = completed.length ? totalSales / completed.length : 0;
  const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;

  // Busiest hour by completed revenue (tenant tz).
  const hourBuckets = new Map();
  for (const o of completed) {
    const h = hourInTz(o.createdAt, tz);
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + num(o.grandTotal));
  }
  let peakHour = null;
  let peakValue = -1;
  for (const [h, v] of hourBuckets.entries()) {
    if (v > peakValue) {
      peakValue = v;
      peakHour = h;
    }
  }

  const topItems = popular.map((p) => ({ name: p.itemName, sold: p._sum.qty ?? 0, emoji: p.emoji ?? '🍽️' }));

  return {
    rangeDays: days,
    totalSales: Math.round(totalSales),
    orderCount,
    completedCount: completed.length,
    cancelledCount: cancelled,
    avgOrderValue: Math.round(avgOrderValue),
    menuItemCount: itemCount,
    topItems,
    peakHour, // 0-23 or null
    currency: 'INR',
  };
}

/** A compact, human-readable summary used both for the LLM system prompt and the local responder. */
export function summarize(ctx) {
  const top = ctx.topItems.length
    ? ctx.topItems.map((t) => `${t.name} (${t.sold})`).join(', ')
    : 'no sales yet';
  const peak = ctx.peakHour === null ? 'n/a' : `${ctx.peakHour}:00`;
  return [
    `Last ${ctx.rangeDays} days:`,
    `revenue ₹${ctx.totalSales}`,
    `${ctx.orderCount} orders (${ctx.completedCount} completed, ${ctx.cancelledCount} cancelled)`,
    `avg order ₹${ctx.avgOrderValue}`,
    `${ctx.menuItemCount} menu items`,
    `top sellers: ${top}`,
    `peak hour: ${peak}`,
  ].join(' · ');
}
