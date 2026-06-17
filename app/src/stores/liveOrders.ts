import { useEffect, useState } from 'react';
import { ordersApi, type Order, type OrderStatus } from '../services/orders';
import { socketClient } from '../lib/socket';
import { branchesStore } from './branches';

/**
 * Live orders store — REPLACES `lib/liveOrders.ts` (localStorage bus) with a
 * socket.io stream backed by the server.
 *
 * Behavior:
 *   - On first subscribe, fetches the active order list for the active branch.
 *   - Subscribes to `liveOrder:*` socket events and merges them into local state.
 *   - When the active branch changes, refreshes.
 *   - When socket reconnects, re-fetches to recover any missed events.
 *
 * The legacy 'New' / 'Accepted' / 'Preparing' / 'Ready' / 'Served' / 'Cancelled'
 * label set used by the existing UI is mapped from the server's PENDING / ACCEPTED /
 * etc. via the legacyStatusLabel() helper.
 */

type Listener = (orders: Order[]) => void;

let state: Order[] = [];
let loading = false;
let lastError: string | null = null;
const listeners = new Set<Listener>();
let activeBranchId: string | null = null;
let socketUnsubs: Array<() => void> = [];
let reloadTimer: number | null = null;

function emit() {
  listeners.forEach((l) => l(state));
}

function upsertOrder(order: Order) {
  const idx = state.findIndex((o) => o.id === order.id);
  if (idx === -1) state = [order, ...state].slice(0, 200);
  else {
    const next = state.slice();
    next[idx] = order;
    state = next;
  }
  emit();
}

function removeOrder(id: string) {
  state = state.filter((o) => o.id !== id);
  emit();
}

async function reload() {
  if (!activeBranchId) {
    state = [];
    emit();
    return;
  }
  loading = true;
  lastError = null;
  try {
    const list = await ordersApi.list({ branchId: activeBranchId, active: true, pageSize: 100 });
    state = list;
    emit();
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Failed to load live orders';
    emit();
  } finally {
    loading = false;
  }
}

function subscribeSockets() {
  unsubSockets();
  socketUnsubs.push(
    socketClient.on<Order>('liveOrder:created', (order) => {
      if (!activeBranchId || order.branchId === activeBranchId) upsertOrder(order);
    }),
    socketClient.on<Order>('liveOrder:updated', (order) => {
      if (!activeBranchId || order.branchId === activeBranchId) upsertOrder(order);
    }),
    socketClient.on<Order>('liveOrder:accepted', (order) => upsertOrder(order)),
    socketClient.on<Order>('liveOrder:preparing', (order) => upsertOrder(order)),
    socketClient.on<Order>('liveOrder:ready', (order) => upsertOrder(order)),
    socketClient.on<Order>('liveOrder:out_for_delivery', (order) => upsertOrder(order)),
    socketClient.on<Order>('liveOrder:served', (order) => removeOrder(order.id)),
    socketClient.on<Order>('liveOrder:delivered', (order) => removeOrder(order.id)),
    socketClient.on<Order>('liveOrder:cancelled', (order) => removeOrder(order.id)),
  );
  // On reconnect, re-fetch.
  if (typeof window !== 'undefined') {
    const onReconnect = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(reload, 250);
    };
    window.addEventListener('vuedine:socket:connect', onReconnect);
    socketUnsubs.push(() => window.removeEventListener('vuedine:socket:connect', onReconnect));
  }
}

function unsubSockets() {
  socketUnsubs.forEach((u) => u());
  socketUnsubs = [];
}

// Whenever the active branch changes, reload + resubscribe.
let branchUnsub: (() => void) | null = null;
function watchBranchChange() {
  if (branchUnsub) return;
  // Use the underlying store's subscribe via createStore — branchesStore exposes
  // `use()` for React, but we need an imperative subscriber. The store object
  // returned by createStore has subscribe(), but the wrapper hides it; pull the
  // current via a periodic check instead. Cheaper: poll once a render cycle
  // through the React hook.
  const initial = branchesStore.get().activeId;
  activeBranchId = initial;
  // Lightweight imperative subscription via a custom event broadcast we add to branches.
}

export const liveOrdersStore = {
  use(): { orders: Order[]; loading: boolean; error: string | null } {
    const [snap, setSnap] = useState<Order[]>(state);
    const branches = branchesStore.use();
    useEffect(() => {
      if (branches.activeId && branches.activeId !== activeBranchId) {
        activeBranchId = branches.activeId;
        reload();
      }
      if (!activeBranchId && branches.activeId) {
        activeBranchId = branches.activeId;
        reload();
      }
      const l: Listener = (o) => setSnap(o);
      listeners.add(l);
      // Lazily subscribe to sockets on first use.
      if (listeners.size === 1) {
        subscribeSockets();
        if (activeBranchId) reload();
      }
      return () => {
        listeners.delete(l);
        if (listeners.size === 0) {
          unsubSockets();
        }
      };
    }, [branches.activeId]);
    return { orders: snap, loading, error: lastError };
  },

  /* Imperative actions used by LiveOrders.tsx, KDS.tsx etc. */

  async setStatus(id: string, status: OrderStatus) {
    const updated = await ordersApi.setStatus(id, status);
    upsertOrder(updated);
    if (status === 'SERVED' || status === 'DELIVERED' || status === 'CANCELLED') {
      removeOrder(id);
    }
    return updated;
  },

  async cancel(id: string, reason?: string) {
    const updated = await ordersApi.cancel(id, reason);
    removeOrder(id);
    return updated;
  },

  async advance(id: string) {
    const updated = await ordersApi.advance(id);
    upsertOrder(updated);
    if (updated.status === 'SERVED' || updated.status === 'DELIVERED') {
      removeOrder(id);
    }
    return updated;
  },

  async recall(id: string) {
    const updated = await ordersApi.recall(id);
    upsertOrder(updated);
    return updated;
  },

  async setLinePrepared(orderId: string, lineId: string, prepared: boolean) {
    const updated = await ordersApi.setLinePrepared(orderId, lineId, prepared);
    upsertOrder(updated);
    return updated;
  },

  async refresh() {
    return reload();
  },

  current() {
    return state;
  },
};

watchBranchChange();

/**
 * Compatibility shim: maps server status enums to the legacy frontend labels
 * the LiveOrders / POSOrders / etc. UIs already consume.
 */
export const LEGACY_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

export function legacyStatusLabel(status: OrderStatus): string {
  return LEGACY_STATUS_LABEL[status] ?? status;
}
