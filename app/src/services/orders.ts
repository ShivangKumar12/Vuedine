import { api } from '../lib/api';

/**
 * Orders service — wraps /v1/orders for the dashboard surfaces:
 *   POS, LiveOrders, POSOrders, OnlineOrders, TableOrders.
 *
 * The shapes mirror what the backend serializer emits.
 */

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'SERVED'
  | 'CANCELLED';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type OrderChannel = 'POS' | 'WAITER' | 'QR' | 'ONLINE';
export type OrderSource =
  | 'POS'
  | 'WAITER'
  | 'QR'
  | 'ZOMATO'
  | 'SWIGGY'
  | 'VUEDINE_DIRECT'
  | 'WHATSAPP'
  | 'QR_PAY';
export type OrderStation = 'HOT' | 'COLD' | 'BAR' | 'DESSERT';
export type OrderPriority = 'NORMAL' | 'RUSH';
export type PaymentMode = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'PAY_LATER';

export type OrderItem = {
  id: string;
  itemId: string | null;
  name: string;
  emoji: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  variantId: string | null;
  variantLabel: string | null;
  addons: Array<{ id: string; label: string; price: number }>;
  notes: string | null;
  spice: 1 | 2 | 3 | null;
  station: OrderStation;
  stationLabel: string;
  prepared: boolean;
  preparedAt: string | null;
  preparedBy: string | null;
};

export type OrderEvent = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type Order = {
  id: string;
  serial: string;
  token: string;
  tenantId: string;
  branchId: string;
  sessionId: string | null;
  tableId: string | null;
  type: OrderType;
  typeLabel: string;
  channel: OrderChannel;
  channelLabel: string;
  source: OrderSource;
  sourceLabel: string;
  station: OrderStation;
  stationLabel: string;
  priority: OrderPriority;
  status: OrderStatus;
  statusLabel: string;
  guestName: string | null;
  guestPhone: string | null;
  tableLabel: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  driverName: string | null;
  driverPhone: string | null;
  etaMinutes: number | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceTotal: number;
  tipTotal: number;
  grandTotal: number;
  promoCode: string | null;
  taxBreakdown: Array<{ name: string; rate: number; amount: number }>;
  paymentMode: PaymentMode;
  paymentModeLabel: string;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  paymentStatusLabel: string;
  acceptedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
};

export type OrderLineInput = {
  itemId?: string | null;
  itemName: string;
  emoji?: string | null;
  qty: number;
  unitPrice: number;
  variantId?: string | null;
  variantLabel?: string | null;
  addons?: Array<{ id: string; label: string; price: number }> | null;
  notes?: string | null;
  category?: string | null;
  spice?: 1 | 2 | 3 | null;
  station?: OrderStation;
};

export type CreateOrderInput = {
  branchId: string;
  type: OrderType;
  channel?: OrderChannel;
  source?: OrderSource;
  station?: OrderStation;
  priority?: OrderPriority;
  tableId?: string | null;
  tableLabel?: string | null;
  sessionId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  etaMinutes?: number | null;
  paymentMode?: PaymentMode;
  promoCode?: string | null;
  discountPct?: number;
  tipAmount?: number;
  tipPct?: number;
  notes?: string | null;
  lines: OrderLineInput[];
};

export type CalculateOutput = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  serviceTotal: number;
  tipTotal: number;
  grandTotal: number;
  taxBreakdown: Array<{ name: string; rate: number; amount: number }>;
  lines: Array<OrderLineInput & { lineTotal: number }>;
};

export type OrdersListFilter = {
  branchId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrderStatus;
  channel?: OrderChannel;
  source?: OrderSource;
  type?: OrderType;
  fromDate?: string;
  toDate?: string;
  active?: boolean;
};

export type OrdersStats = {
  total: number;
  newCount: number;
  cooking: number;
  ready: number;
  revenue: number;
  activeStatuses: OrderStatus[];
};

let idempoCounter = 0;
function newIdempotencyKey() {
  idempoCounter += 1;
  return `vuedine-${Date.now()}-${idempoCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ordersApi = {
  list(filter: OrdersListFilter = {}): Promise<Order[]> {
    return api.get<Order[]>('/v1/orders', {
      query: {
        page: filter.page ?? 1,
        pageSize: filter.pageSize ?? 50,
        branchId: filter.branchId,
        search: filter.search,
        status: filter.status,
        channel: filter.channel,
        source: filter.source,
        type: filter.type,
        fromDate: filter.fromDate,
        toDate: filter.toDate,
        active: filter.active === undefined ? undefined : String(filter.active),
      },
    });
  },

  stats(branchId?: string): Promise<OrdersStats> {
    return api.get<OrdersStats>('/v1/orders/stats', { query: { branchId } });
  },

  get(id: string): Promise<Order> {
    return api.get<Order>(`/v1/orders/${id}`);
  },

  calculate(input: CreateOrderInput): Promise<CalculateOutput> {
    return api.post<CalculateOutput>('/v1/orders/calculate', input);
  },

  create(input: CreateOrderInput, opts: { idempotencyKey?: string } = {}): Promise<Order> {
    const key = opts.idempotencyKey ?? newIdempotencyKey();
    return api.post<Order>('/v1/orders', input, {
      headers: { 'Idempotency-Key': key },
    });
  },

  update(id: string, patch: Partial<Order>): Promise<Order> {
    return api.patch<Order>(`/v1/orders/${id}`, patch);
  },

  setStatus(id: string, status: OrderStatus, reason?: string): Promise<Order> {
    return api.patch<Order>(`/v1/orders/${id}/status`, { status, reason });
  },

  advance(id: string): Promise<Order> {
    return api.post<Order>(`/v1/orders/${id}/advance`);
  },

  cancel(id: string, reason?: string): Promise<Order> {
    return api.post<Order>(`/v1/orders/${id}/cancel`, { reason });
  },

  recall(id: string): Promise<Order> {
    return api.post<Order>(`/v1/orders/${id}/recall`);
  },

  setLinePrepared(orderId: string, lineId: string, prepared: boolean): Promise<Order> {
    return api.patch<Order>(`/v1/orders/${orderId}/lines/${lineId}/prepared`, { prepared });
  },
};
