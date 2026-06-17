import { api, API_BASE } from '../lib/api';
import type { Order, OrderLineInput } from './orders';

/**
 * Public PWA service — no auth required, no envelope-401-refresh.
 *
 * Note: api.ts injects Authorization on every call. For the public flow
 * we need the same envelope unwrap but no auth header. We use a tiny inline
 * fetch helper here for that — small enough not to warrant a second wrapper.
 */

async function publicFetch<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (res.ok && json.success) return json.data as T;
  const err = new Error(json?.error?.message ?? `Request failed (${res.status})`) as Error & {
    code?: string;
    status?: number;
  };
  err.code = json?.error?.code ?? `HTTP_${res.status}`;
  err.status = res.status;
  throw err;
}

export type PublicResolveQr = {
  branch: {
    id: string;
    name: string;
    qrSlug: string;
    defaultPrep: number;
    serviceCharge: number;
    taxInclusive: boolean;
  };
  table: {
    id: string;
    name: string;
    section: string;
    capacity: number;
    shape: 'round' | 'square' | 'rect';
    status: string;
  };
};

export type PublicMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string | null;
  imageUrl: string | null;
  veg: boolean;
  bestseller: boolean;
  description: string | null;
};

export type PublicMenu = {
  branch: { id: string; name: string; qrSlug: string };
  items: PublicMenuItem[];
  categories: string[];
};

export type PublicCalculateInput = {
  branchSlug: string;
  qrToken?: string;
  lines: OrderLineInput[];
  promoCode?: string | null;
  tipAmount?: number;
  tipPct?: number;
};

export type PublicCalculateOutput = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceTotal: number;
  tipTotal: number;
  grandTotal: number;
  taxBreakdown: Array<{ name: string; rate: number; amount: number }>;
};

export type PublicPlaceInput = PublicCalculateInput & {
  qrToken: string;
  guestName?: string | null;
  guestPhone?: string | null;
  payMode?: 'pay-at-counter' | 'pay-now-upi' | 'pay-now-card';
};

let publicIdempoCounter = 0;
function newPublicIdempoKey() {
  publicIdempoCounter += 1;
  return `vue-pub-${Date.now()}-${publicIdempoCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const publicApi = {
  resolveQr(branchSlug: string, qrToken: string): Promise<PublicResolveQr> {
    return publicFetch<PublicResolveQr>('GET', `/v1/public/qr/${branchSlug}/${qrToken}`);
  },

  getMenu(branchSlug: string): Promise<PublicMenu> {
    return publicFetch<PublicMenu>('GET', `/v1/public/menu/${branchSlug}`);
  },

  // The dashboard's authenticated client is reused for menu/items if the user is logged in.
  // Public PWA always uses the public endpoint above.
  getDashboardItems(): Promise<unknown[]> {
    return api.get<unknown[]>('/v1/items', { query: { pageSize: 200 } });
  },

  calculate(input: PublicCalculateInput): Promise<PublicCalculateOutput> {
    return publicFetch<PublicCalculateOutput>('POST', '/v1/public/orders/calculate', input);
  },

  applyCoupon(input: {
    branchSlug: string;
    code: string;
    customerId?: string | null;
    lines: Array<{ itemId?: string | null; itemName?: string | null; category?: string | null; qty: number; unitPrice: number }>;
  }): Promise<{ promotionId: string; code: string; title: string; discount: number; subtotal: number }> {
    return publicFetch('POST', '/v1/public/cart/apply-coupon', input);
  },

  placeOrder(input: PublicPlaceInput, opts: { idempotencyKey?: string } = {}): Promise<Order> {
    const key = opts.idempotencyKey ?? newPublicIdempoKey();
    return publicFetch<Order>('POST', '/v1/public/orders', input, {
      'Idempotency-Key': key,
    });
  },

  trackOrder(orderId: string): Promise<Order> {
    return publicFetch<Order>('GET', `/v1/public/orders/${orderId}`);
  },

  signal(
    orderId: string,
    type: 'WAITER_RING' | 'BILL_REQUEST' | 'FEEDBACK' | 'HELP',
    extras: { message?: string; rating?: number } = {},
  ): Promise<{ id: string; type: string; orderId: string; createdAt: string }> {
    return publicFetch('POST', `/v1/public/orders/${orderId}/signal`, {
      type,
      ...extras,
    });
  },
};
