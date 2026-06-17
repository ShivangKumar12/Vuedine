/**
 * Serialize Promotion for the dashboard frontend.
 *
 * Two consumer shapes:
 *   - Coupons.tsx — `Coupon` type (kind: 'Percentage'|'Flat'|'BOGO'|'Free Item',
 *     status: 'Active'|'Scheduled'|'Paused'|'Expired', channel: 'All'|'POS'|'QR'|'Online')
 *   - Offers.tsx  — `Offer` type (kind: 'Happy Hour'|'Combo'|'Festival'|'Loyalty'|'Featured',
 *     status: 'Live'|'Scheduled'|'Paused'|'Ended', days: ['Mon'..'Sun'], channels: string[])
 *
 * We expose BOTH a normalized server view (enums) and the friendly fields,
 * plus a `serialize*` per consumer so each page gets exactly its shape.
 */

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

const COUPON_KIND_TO_LABEL = {
  PERCENTAGE: 'Percentage',
  FLAT: 'Flat',
  BOGO: 'BOGO',
  FREE_ITEM: 'Free Item',
};
const COUPON_LABEL_TO_KIND = {
  Percentage: 'PERCENTAGE',
  Flat: 'FLAT',
  BOGO: 'BOGO',
  'Free Item': 'FREE_ITEM',
};

const COUPON_STATUS_TO_LABEL = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  ENDED: 'Expired',
};
const COUPON_LABEL_TO_STATUS = {
  Active: 'ACTIVE',
  Scheduled: 'SCHEDULED',
  Paused: 'PAUSED',
  Expired: 'EXPIRED',
};

const OFFER_KIND_TO_LABEL = {
  HAPPY_HOUR: 'Happy Hour',
  COMBO: 'Combo',
  FESTIVAL: 'Festival',
  LOYALTY: 'Loyalty',
  // 'Featured' has no dedicated enum — we map COMBO+featured via metadata.
  PERCENTAGE: 'Featured',
  FLAT: 'Featured',
  BOGO: 'Featured',
  FREE_ITEM: 'Featured',
};
const OFFER_LABEL_TO_KIND = {
  'Happy Hour': 'HAPPY_HOUR',
  Combo: 'COMBO',
  Festival: 'FESTIVAL',
  Loyalty: 'LOYALTY',
  Featured: 'COMBO',
};

const OFFER_STATUS_TO_LABEL = {
  ACTIVE: 'Live',
  SCHEDULED: 'Scheduled',
  PAUSED: 'Paused',
  EXPIRED: 'Ended',
  ENDED: 'Ended',
};
const OFFER_LABEL_TO_STATUS = {
  Live: 'ACTIVE',
  Scheduled: 'SCHEDULED',
  Paused: 'PAUSED',
  Ended: 'ENDED',
};

const DAY_TO_LABEL = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
const DAY_LABEL_TO_CODE = { Mon: 'MON', Tue: 'TUE', Wed: 'WED', Thu: 'THU', Fri: 'FRI', Sat: 'SAT', Sun: 'SUN' };

export const promotionMaps = {
  COUPON_LABEL_TO_KIND,
  COUPON_LABEL_TO_STATUS,
  OFFER_LABEL_TO_KIND,
  OFFER_LABEL_TO_STATUS,
  DAY_LABEL_TO_CODE,
  DAY_TO_LABEL,
};

/** Channel single-string for coupons. Server stores string[]. */
function channelsToCouponChannel(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return 'All';
  if (channels.length === 1) return channels[0];
  return 'All';
}

/** Raw normalized view — used by the cart/apply contexts. */
export function serializePromotion(p) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    type: p.type,
    kind: p.kind,
    status: p.status,
    title: p.title,
    description: p.description,
    summary: p.summary ?? null,
    emoji: p.emoji,
    hero: p.hero,
    code: p.code,
    value: num(p.value),
    minOrder: num(p.minOrder),
    maxDiscount: p.maxDiscount != null ? num(p.maxDiscount) : null,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    startTime: p.startTime,
    endTime: p.endTime,
    days: p.days ?? [],
    channels: p.channels ?? [],
    usageLimit: p.usageLimit,
    perUserLimit: p.perUserLimit,
    used: p.used,
    scope: p.scope,
    targetItemIds: p.targetItemIds ?? [],
    targetCategories: p.targetCategories ?? [],
    autoApply: p.autoApply,
    trigger: p.trigger ?? null,
    redemptions: p.redemptions,
    revenue: num(p.revenue),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Coupons.tsx `Coupon` shape. */
export function serializeCoupon(p) {
  const dateStr = (d) => new Date(d).toISOString().slice(0, 10);
  return {
    id: p.id,
    code: p.code ?? '',
    title: p.title,
    kind: COUPON_KIND_TO_LABEL[p.kind] ?? 'Percentage',
    value: num(p.value),
    minOrder: num(p.minOrder),
    maxDiscount: p.maxDiscount != null ? num(p.maxDiscount) : undefined,
    status: COUPON_STATUS_TO_LABEL[p.status] ?? 'Active',
    channel: channelsToCouponChannel(p.channels),
    startsAt: dateStr(p.startsAt),
    endsAt: dateStr(p.endsAt),
    usageLimit: p.usageLimit,
    used: p.used,
    perUser: p.perUserLimit,
    description: p.description ?? undefined,
  };
}

/** Offers.tsx `Offer` shape. */
export function serializeOffer(p) {
  const dateStr = (d) => new Date(d).toISOString().slice(0, 10);
  return {
    id: p.id,
    title: p.title,
    emoji: p.emoji ?? '✨',
    hero: p.hero ?? 'from-brand-500 via-rose-500 to-amber-500',
    kind: OFFER_KIND_TO_LABEL[p.kind] ?? 'Combo',
    status: OFFER_STATUS_TO_LABEL[p.status] ?? 'Live',
    discount: p.summary ?? '',
    startsAt: dateStr(p.startsAt),
    endsAt: dateStr(p.endsAt),
    startTime: p.startTime ?? '00:00',
    endTime: p.endTime ?? '23:59',
    days: (p.days ?? []).map((d) => DAY_TO_LABEL[d]).filter(Boolean),
    channels: p.channels ?? [],
    redemptions: p.redemptions,
    revenue: num(p.revenue),
    description: p.description ?? '',
  };
}
