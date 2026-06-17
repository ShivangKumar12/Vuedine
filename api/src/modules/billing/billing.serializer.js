function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

const INVOICE_LABEL = { DRAFT: 'Draft', OPEN: 'Open', PAID: 'Paid', FAILED: 'Failed', VOID: 'Void' };
const STATUS_LABEL = { TRIALING: 'Trialing', ACTIVE: 'Active', PAST_DUE: 'Past due', CANCELLED: 'Cancelled' };

export function serializePlan(p) {
  return {
    slug: p.slug,
    name: p.name,
    blurb: p.blurb,
    monthly: num(p.monthly),
    yearly: num(p.yearly),
    features: p.features ?? [],
    active: p.active,
  };
}

export function serializeSubscription(s) {
  return {
    id: s.id,
    planSlug: s.planSlug,
    cycle: s.cycle.toLowerCase(), // 'monthly' | 'yearly'
    status: s.status,
    statusLabel: STATUS_LABEL[s.status] ?? s.status,
    startedAt: s.startedAt,
    renewsAt: s.renewsAt,
    cancelledAt: s.cancelledAt,
    trialEndsAt: s.trialEndsAt,
    seatLimit: s.seatLimit,
    branchLimit: s.branchLimit,
    storageLimitGb: num(s.storageLimitGb),
    aiQuota: s.aiQuota,
    addons: Array.isArray(s.meta?.addons) ? s.meta.addons : [],
    frozen: s.meta?.frozen ?? false,
    card: s.meta?.card ?? null, // { last4, brand, exp } when a gateway mandate exists
  };
}

export function serializeInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number,
    period: inv.period,
    amount: num(inv.amount),
    taxAmount: num(inv.taxAmount),
    status: inv.status,
    statusLabel: INVOICE_LABEL[inv.status] ?? inv.status,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    paidAt: inv.paidAt,
    date: new Date(inv.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
}
