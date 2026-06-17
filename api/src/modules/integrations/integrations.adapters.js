/**
 * Provider adapters.
 *
 * Each adapter knows how to:
 *   - `test(credentials)`     — a lightweight provider ping (stubbed success
 *                               in dev; real adapters call the partner API).
 *   - `parseOrder(payload)`   — (aggregators only) normalize an inbound
 *                               webhook into an order body + external id.
 *
 * MVP ships real parsing for Zomato + Swiggy. Everything else uses the
 * generic adapter (test only).
 */

const TYPE_MAP = { DELIVERY: 'DELIVERY', TAKEAWAY: 'TAKEAWAY', PICKUP: 'TAKEAWAY', DINE_IN: 'DINE_IN' };

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * Normalize an aggregator payload into { externalId, order } where `order`
 * is a body accepted by ordersService.create.
 *
 * Supports a simple normalized shape (used by partners' sandbox + our tests):
 *   { orderId, branchId?, type?, customer:{name,phone}, items:[{name,qty,price,category?,emoji?}] }
 * and a Zomato-ish nested shape:
 *   { order:{ id, ... }, ... }
 */
function parseAggregatorOrder(provider, payload, { fallbackBranchId } = {}) {
  const root = payload?.order ?? payload ?? {};
  const externalId = String(
    root.orderId ?? root.id ?? root.order_id ?? payload?.orderId ?? payload?.id ?? '',
  ).trim();
  if (!externalId) return null;

  const rawItems = root.items ?? root.line_items ?? payload?.items ?? [];
  const lines = (Array.isArray(rawItems) ? rawItems : [])
    .map((it) => ({
      itemName: String(it.name ?? it.itemName ?? it.title ?? 'Item'),
      qty: Math.max(1, Math.round(num(it.qty ?? it.quantity ?? 1, 1))),
      unitPrice: num(it.price ?? it.unitPrice ?? it.unit_price, 0),
      category: it.category ?? 'Aggregator',
      emoji: it.emoji ?? null,
    }))
    .filter((l) => l.itemName);

  if (lines.length === 0) return null;

  const customer = root.customer ?? payload?.customer ?? {};
  const type = TYPE_MAP[String(root.type ?? payload?.type ?? 'DELIVERY').toUpperCase()] ?? 'DELIVERY';
  const branchId = root.branchId ?? payload?.branchId ?? fallbackBranchId ?? null;

  return {
    externalId,
    order: {
      branchId,
      type,
      channel: 'ONLINE',
      source: provider === 'swiggy' ? 'SWIGGY' : 'ZOMATO',
      lines,
      guestName: customer.name ?? root.customerName ?? `${provider} customer`,
      guestPhone: customer.phone ?? root.customerPhone ?? null,
      deliveryAddress: customer.address ?? root.address ?? null,
      paymentMode: 'ONLINE',
      notes: `Imported from ${provider} order ${externalId}`,
    },
  };
}

const aggregatorAdapter = (provider) => ({
  async test() {
    return { ok: true, message: `${provider} credentials accepted` };
  },
  async sync() {
    // Real impl pushes the menu to the partner; stubbed.
    return { ok: true, pushed: true };
  },
  parseOrder(payload, ctx) {
    return parseAggregatorOrder(provider, payload, ctx);
  },
});

const genericAdapter = (provider) => ({
  async test() {
    return { ok: true, message: `${provider} credentials accepted` };
  },
  async sync() {
    return { ok: true };
  },
  parseOrder() {
    return null;
  },
});

const ADAPTERS = {
  zomato: aggregatorAdapter('zomato'),
  swiggy: aggregatorAdapter('swiggy'),
};

export function getAdapter(provider) {
  return ADAPTERS[provider] ?? genericAdapter(provider);
}
