import { api } from '../lib/api';

/**
 * Promotions service — backs Coupons.tsx, Offers.tsx, the POS promo box,
 * and the guest Checkout promo box.
 *
 * The server returns a dual shape: page-friendly fields (Coupon / Offer)
 * PLUS a `_promotion` normalized view (enums) used when round-tripping
 * edits back to the API.
 */

export type PromotionType = 'COUPON' | 'OFFER';
export type PromotionKindCode =
  | 'PERCENTAGE'
  | 'FLAT'
  | 'BOGO'
  | 'FREE_ITEM'
  | 'COMBO'
  | 'HAPPY_HOUR'
  | 'LOYALTY'
  | 'FESTIVAL';
export type PromotionStatusCode = 'ACTIVE' | 'SCHEDULED' | 'PAUSED' | 'EXPIRED' | 'ENDED';
export type PromotionScope = 'WHOLE_ORDER' | 'ITEMS' | 'CATEGORIES';
export type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type NormalizedPromotion = {
  id: string;
  type: PromotionType;
  kind: PromotionKindCode;
  status: PromotionStatusCode;
  title: string;
  description: string | null;
  summary: string | null;
  emoji: string | null;
  hero: string | null;
  code: string | null;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  startTime: string | null;
  endTime: string | null;
  days: DayCode[];
  channels: string[];
  usageLimit: number;
  perUserLimit: number;
  used: number;
  scope: PromotionScope;
  targetItemIds: string[];
  targetCategories: string[];
  autoApply: boolean;
  trigger: Record<string, unknown> | null;
  redemptions: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
};

/** Coupons.tsx `Coupon` shape (+ `_promotion`). */
export type CouponDTO = {
  id: string;
  code: string;
  title: string;
  kind: 'Percentage' | 'Flat' | 'BOGO' | 'Free Item';
  value: number;
  minOrder: number;
  maxDiscount?: number;
  status: 'Active' | 'Scheduled' | 'Paused' | 'Expired';
  channel: 'All' | 'POS' | 'QR' | 'Online';
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  used: number;
  perUser: number;
  description?: string;
  _promotion: NormalizedPromotion;
};

/** Offers.tsx `Offer` shape (+ `_promotion`). */
export type OfferDTO = {
  id: string;
  title: string;
  emoji: string;
  hero: string;
  kind: 'Happy Hour' | 'Combo' | 'Festival' | 'Loyalty' | 'Featured';
  status: 'Live' | 'Scheduled' | 'Paused' | 'Ended';
  discount: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>;
  channels: string[];
  redemptions: number;
  revenue: number;
  description: string;
  _promotion: NormalizedPromotion;
};

export type CreatePromotionInput = {
  type: PromotionType;
  kind: PromotionKindCode;
  status?: PromotionStatusCode;
  title: string;
  description?: string | null;
  summary?: string | null;
  emoji?: string | null;
  hero?: string | null;
  code?: string | null;
  value?: number;
  minOrder?: number;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  startTime?: string | null;
  endTime?: string | null;
  days?: DayCode[];
  channels?: string[];
  usageLimit?: number;
  perUserLimit?: number;
  scope?: PromotionScope;
  targetItemIds?: string[];
  targetCategories?: string[];
  autoApply?: boolean;
  trigger?: Record<string, unknown> | null;
};

export type ApplyCouponResult = {
  promotionId: string;
  code: string;
  title: string;
  kind: PromotionKindCode;
  scope: PromotionScope;
  discount: number;
  subtotal: number;
};

export type AutoOffer = {
  promotionId: string;
  title: string;
  emoji: string | null;
  kind: PromotionKindCode;
  summary: string | null;
  discount: number;
};

export type CartLineInput = {
  itemId?: string | null;
  itemName?: string | null;
  category?: string | null;
  qty: number;
  unitPrice: number;
};

type ListResult<T> = T[];

export const promotionsApi = {
  listCoupons(filter: { status?: PromotionStatusCode; search?: string } = {}): Promise<ListResult<CouponDTO>> {
    return api.get<CouponDTO[]>('/v1/promotions', {
      query: { type: 'COUPON', pageSize: 200, status: filter.status, search: filter.search },
    });
  },

  listOffers(filter: { status?: PromotionStatusCode; search?: string } = {}): Promise<ListResult<OfferDTO>> {
    return api.get<OfferDTO[]>('/v1/promotions', {
      query: { type: 'OFFER', pageSize: 200, status: filter.status, search: filter.search },
    });
  },

  get(id: string): Promise<CouponDTO | OfferDTO> {
    return api.get<CouponDTO | OfferDTO>(`/v1/promotions/${id}`);
  },

  create(input: CreatePromotionInput): Promise<CouponDTO | OfferDTO> {
    return api.post<CouponDTO | OfferDTO>('/v1/promotions', input);
  },

  update(id: string, patch: Partial<CreatePromotionInput>): Promise<CouponDTO | OfferDTO> {
    return api.patch<CouponDTO | OfferDTO>(`/v1/promotions/${id}`, patch);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/v1/promotions/${id}`);
  },

  pause(id: string): Promise<CouponDTO | OfferDTO> {
    return api.post<CouponDTO | OfferDTO>(`/v1/promotions/${id}/pause`);
  },

  resume(id: string): Promise<CouponDTO | OfferDTO> {
    return api.post<CouponDTO | OfferDTO>(`/v1/promotions/${id}/resume`);
  },

  applyCoupon(input: {
    code: string;
    branchId?: string;
    channel?: string;
    customerId?: string | null;
    lines: CartLineInput[];
  }): Promise<ApplyCouponResult> {
    return api.post<ApplyCouponResult>('/v1/cart/apply-coupon', input);
  },

  autoOffers(input: {
    branchId?: string;
    channel?: string;
    lines: CartLineInput[];
  }): Promise<{ offers: AutoOffer[]; subtotal: number }> {
    return api.post<{ offers: AutoOffer[]; subtotal: number }>('/v1/cart/auto-offers', input);
  },
};


/* ============================================================ */
/*  UI ⇄ server mapping helpers                                 */
/* ============================================================ */

const COUPON_KIND_TO_CODE: Record<CouponDTO['kind'], PromotionKindCode> = {
  Percentage: 'PERCENTAGE',
  Flat: 'FLAT',
  BOGO: 'BOGO',
  'Free Item': 'FREE_ITEM',
};
const COUPON_STATUS_TO_CODE: Record<CouponDTO['status'], PromotionStatusCode> = {
  Active: 'ACTIVE',
  Scheduled: 'SCHEDULED',
  Paused: 'PAUSED',
  Expired: 'EXPIRED',
};
const OFFER_KIND_TO_CODE: Record<OfferDTO['kind'], PromotionKindCode> = {
  'Happy Hour': 'HAPPY_HOUR',
  Combo: 'COMBO',
  Festival: 'FESTIVAL',
  Loyalty: 'LOYALTY',
  Featured: 'COMBO',
};
const OFFER_STATUS_TO_CODE: Record<OfferDTO['status'], PromotionStatusCode> = {
  Live: 'ACTIVE',
  Scheduled: 'SCHEDULED',
  Paused: 'PAUSED',
  Ended: 'ENDED',
};
const DAY_TO_CODE: Record<string, DayCode> = {
  Mon: 'MON', Tue: 'TUE', Wed: 'WED', Thu: 'THU', Fri: 'FRI', Sat: 'SAT', Sun: 'SUN',
};

function dateToIso(d: string) {
  // 'YYYY-MM-DD' → ISO at local midnight; server coerces to Date.
  return new Date(`${d}T00:00:00`).toISOString();
}

/** Translate a Coupons.tsx `Coupon` form into a server create/update payload. */
export function couponFormToInput(c: {
  code: string;
  title: string;
  kind: CouponDTO['kind'];
  value: number;
  minOrder: number;
  maxDiscount?: number;
  status: CouponDTO['status'];
  channel: CouponDTO['channel'];
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  perUser: number;
  description?: string;
}): CreatePromotionInput {
  return {
    type: 'COUPON',
    kind: COUPON_KIND_TO_CODE[c.kind],
    status: COUPON_STATUS_TO_CODE[c.status],
    title: c.title,
    code: c.code,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount && c.maxDiscount > 0 ? c.maxDiscount : null,
    channels: c.channel === 'All' ? [] : [c.channel],
    startsAt: dateToIso(c.startsAt),
    endsAt: dateToIso(c.endsAt),
    usageLimit: c.usageLimit,
    perUserLimit: c.perUser,
    description: c.description ?? null,
    scope: 'WHOLE_ORDER',
  };
}

/** Translate an Offers.tsx `Offer` form into a server create/update payload. */
export function offerFormToInput(o: {
  title: string;
  emoji: string;
  hero: string;
  kind: OfferDTO['kind'];
  status: OfferDTO['status'];
  discount: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  days: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>;
  channels: string[];
  description: string;
}): CreatePromotionInput {
  return {
    type: 'OFFER',
    kind: OFFER_KIND_TO_CODE[o.kind],
    status: OFFER_STATUS_TO_CODE[o.status],
    title: o.title,
    emoji: o.emoji,
    hero: o.hero,
    summary: o.discount,
    description: o.description || null,
    startsAt: dateToIso(o.startsAt),
    endsAt: dateToIso(o.endsAt),
    startTime: o.startTime,
    endTime: o.endTime,
    days: o.days.map((d) => DAY_TO_CODE[d]).filter(Boolean) as DayCode[],
    channels: o.channels,
    scope: 'WHOLE_ORDER',
    autoApply: o.kind === 'Happy Hour',
  };
}
