import { useEffect, useState } from 'react';

import { liveOrdersStore } from '../stores/liveOrders';
import type { Order } from '../services/orders';

/* ============================================================ */
/*  Live order bus — backend-backed compat shim                 */
/* ============================================================ */
/*
 * This file used to be a localStorage pub/sub. It's now a thin compat
 * adapter so the existing dashboard pages (LiveOrders.tsx etc.) keep
 * their original code while the actual data comes from the server via
 * `stores/liveOrders.ts` (which fetches /v1/orders + subscribes to
 * socket.io events).
 *
 * Public surface preserved:
 *   - LiveOrder type
 *   - LiveOrderStatus type
 *   - useLiveOrders() hook
 *   - liveOrders.setStatus(id, status)
 *   - liveOrders.remove(id)
 *   - liveOrders.clear()
 *   - liveOrders.current()
 *
 * Removed:
 *   - liveOrders.enqueue() — replaced by the server emitting a
 *     `liveOrder:created` event. Callers should use the
 *     `services/orders.ts` ordersApi.create() or
 *     `services/public.ts` publicApi.placeOrder() instead.
 */

export type LiveOrderItem = {
  id: number | string;
  name: string;
  emoji: string;
  qty: number;
  unitPrice: number;
  variantLabel?: string;
  addons?: string[];
  notes?: string;
};

export type LiveOrderStatus =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Served'
  | 'Cancelled';

export type LiveOrder = {
  /** Server-side cuid (real id used for API calls). */
  id: string;
  token: string;
  branch: string;
  table: string;
  receivedAt: number;
  channel: 'QR' | 'POS' | 'WAITER' | 'ONLINE';
  items: LiveOrderItem[];
  subtotal: number;
  tax: number;
  service: number;
  tip: number;
  total: number;
  payMode: 'pay-at-counter' | 'pay-now-upi' | 'pay-now-card';
  guestName?: string;
  phone?: string;
  status: LiveOrderStatus;
  /** Original server Order — exposed for newer pages that want full fidelity. */
  raw?: Order;
};

const SERVER_TO_LEGACY_STATUS: Record<string, LiveOrderStatus> = {
  PENDING: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Ready',
  DELIVERED: 'Served',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

const LEGACY_TO_SERVER_STATUS: Record<LiveOrderStatus, string> = {
  New: 'PENDING',
  Accepted: 'ACCEPTED',
  Preparing: 'PREPARING',
  Ready: 'READY',
  Served: 'SERVED',
  Cancelled: 'CANCELLED',
};

const SERVER_PAYMODE_TO_LEGACY: Record<string, LiveOrder['payMode']> = {
  CASH: 'pay-at-counter',
  CARD: 'pay-now-card',
  UPI: 'pay-now-upi',
  WALLET: 'pay-now-upi',
  ONLINE: 'pay-now-card',
  PAY_LATER: 'pay-at-counter',
};

const SERVER_CHANNEL_TO_LEGACY: Record<string, LiveOrder['channel']> = {
  POS: 'POS',
  WAITER: 'WAITER',
  QR: 'QR',
  ONLINE: 'ONLINE',
};

function adapt(order: Order): LiveOrder {
  return {
    id: order.id,
    token: order.token,
    branch: order.branchId,
    table: order.tableLabel ?? '',
    receivedAt: new Date(order.createdAt).getTime(),
    channel: SERVER_CHANNEL_TO_LEGACY[order.channel] ?? 'POS',
    items: order.items.map((it) => ({
      id: it.itemId ?? it.id,
      name: it.name,
      emoji: it.emoji ?? '🍽️',
      qty: it.qty,
      unitPrice: it.unitPrice,
      variantLabel: it.variantLabel ?? undefined,
      addons: (it.addons ?? []).map((a) => a.label),
      notes: it.notes ?? undefined,
    })),
    subtotal: order.subtotal,
    tax: order.taxTotal,
    service: order.serviceTotal,
    tip: order.tipTotal,
    total: order.grandTotal,
    payMode: SERVER_PAYMODE_TO_LEGACY[order.paymentMode] ?? 'pay-at-counter',
    guestName: order.guestName ?? undefined,
    phone: order.guestPhone ?? undefined,
    status: SERVER_TO_LEGACY_STATUS[order.status] ?? 'New',
    raw: order,
  };
}

/**
 * The legacy hook — returns a flat array of LiveOrders. Internally it
 * subscribes to liveOrdersStore (which talks to the server) and adapts.
 */
export function useLiveOrders(): LiveOrder[] {
  const live = liveOrdersStore.use();
  const [snap, setSnap] = useState<LiveOrder[]>(() => live.orders.map(adapt));
  useEffect(() => {
    setSnap(live.orders.map(adapt));
  }, [live.orders]);
  return snap;
}

export const liveOrders = {
  /**
   * No-op. Server now creates orders via ordersApi.create() /
   * publicApi.placeOrder(); the resulting socket event flows in through
   * useLiveOrders() automatically.
   */
  enqueue(_order: Omit<LiveOrder, 'status' | 'raw'> & { status?: LiveOrderStatus }): LiveOrder {
    void _order;
    if (typeof console !== 'undefined') {
      console.warn(
        '[liveOrders.enqueue] is deprecated — call ordersApi.create() / publicApi.placeOrder() instead.',
      );
    }
    return { ..._order, status: _order.status ?? 'New' } as LiveOrder;
  },

  async setStatus(id: string, status: LiveOrderStatus) {
    const serverStatus = LEGACY_TO_SERVER_STATUS[status];
    if (!serverStatus) return;
    if (status === 'Cancelled') {
      await liveOrdersStore.cancel(id);
    } else {
      await liveOrdersStore.setStatus(id, serverStatus as never);
    }
  },

  async remove(id: string) {
    await liveOrdersStore.cancel(id);
  },

  clear() {
    // No-op — server is authoritative; can't bulk-cancel from a UI gesture.
  },

  current(): LiveOrder[] {
    return liveOrdersStore.current().map(adapt);
  },
};
