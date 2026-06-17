/**
 * Audience evaluator — converts a segment rule into a Prisma `where` for the
 * customer query (User rows with role CUSTOMER + a CustomerProfile).
 *
 * Rule shape:
 *   { kind: 'all'|'vip'|'loyal'|'lapsed'|'new'|'custom',
 *     tier?: 'BRONZE'|'SILVER'|'GOLD'|'PLATINUM',
 *     tags?: string[], minOrders?: number, lapsedDays?: number }
 *
 * Options:
 *   requireConsent — only customers with marketingConsent + not unsubscribed.
 *   channel        — only customers whose channels[] includes this channel.
 *
 * Deterministic: the same rule always produces the same `where` (tests rely
 * on this).
 */

const CHANNEL_FOR_TYPE = {
  PUSH: 'Push',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

export function channelForCampaignType(type) {
  return CHANNEL_FOR_TYPE[type] ?? null;
}

export function buildCustomerWhere({ tenantId, rule = {}, requireConsent = false, channel = null, now = Date.now() }) {
  const kind = rule.kind ?? 'all';
  const cp = {};

  if (kind === 'vip') {
    cp.OR = [{ tags: { has: 'VIP' } }, { tier: 'PLATINUM' }];
  } else if (kind === 'loyal') {
    cp.totalOrders = { gte: rule.minOrders ?? 30 };
  } else if (kind === 'lapsed') {
    cp.lastOrderAt = { lt: new Date(now - (rule.lapsedDays ?? 30) * 86400_000) };
  } else if (kind === 'new') {
    cp.createdAt = { gte: new Date(now - 30 * 86400_000) };
  } else if (kind === 'custom') {
    if (rule.tier) cp.tier = rule.tier;
    if (Array.isArray(rule.tags) && rule.tags.length) cp.tags = { hasSome: rule.tags };
    if (rule.minOrders) cp.totalOrders = { gte: rule.minOrders };
    if (rule.lapsedDays) cp.lastOrderAt = { lt: new Date(now - rule.lapsedDays * 86400_000) };
  }

  // Standalone overrides (apply on any kind).
  if (rule.tier && kind !== 'custom') cp.tier = rule.tier;

  if (requireConsent) {
    cp.marketingConsent = true;
    cp.unsubscribedAt = null;
  }
  if (channel) {
    cp.channels = { has: channel };
  }

  const where = {
    tenantId,
    role: 'CUSTOMER',
    deletedAt: null,
  };
  if (Object.keys(cp).length > 0) {
    where.customerProfile = { is: cp };
  }
  return where;
}
