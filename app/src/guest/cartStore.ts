import { useEffect, useState } from 'react';

export type CartLine = {
  uid: string; // unique line id (item + variant + addons signature)
  itemId: number;
  qty: number;
  variantId?: string;
  addonIds?: string[];
  notes?: string;
  unitPrice: number; // computed at add-time
};

export type GuestSession = {
  branch: string;
  table: string;
  cart: CartLine[];
  rounds: { id: string; placedAt: number; lines: CartLine[] }[]; // already-placed orders for this session
  guestName?: string;
  phone?: string;
};

type Listener = (s: GuestSession) => void;

const STORAGE_KEY = 'vuedine.guest.session.v1';

function load(): GuestSession {
  if (typeof window === 'undefined') {
    return { branch: 'bandra', table: 'T-7', cart: [], rounds: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { branch: 'bandra', table: 'T-7', cart: [], rounds: [] };
}

function save(s: GuestSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

let state: GuestSession = load();
const listeners = new Set<Listener>();

function set(next: Partial<GuestSession> | ((s: GuestSession) => GuestSession)) {
  state = typeof next === 'function' ? next(state) : { ...state, ...next };
  save(state);
  listeners.forEach((l) => l(state));
}

export function useGuestSession() {
  const [snap, setSnap] = useState(state);
  useEffect(() => {
    const l: Listener = (s) => setSnap(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

function lineSignature(line: Omit<CartLine, 'uid' | 'qty' | 'unitPrice'>) {
  return `${line.itemId}::${line.variantId ?? ''}::${(line.addonIds ?? []).slice().sort().join(',')}::${line.notes ?? ''}`;
}

export const guestActions = {
  setContext(branch: string, table: string) {
    if (state.branch !== branch || state.table !== table) {
      set({ branch, table });
    }
  },
  add(line: Omit<CartLine, 'uid' | 'qty'> & { qty?: number }) {
    const sig = lineSignature(line);
    set((s) => {
      const existing = s.cart.find((c) => lineSignature(c) === sig);
      if (existing) {
        return {
          ...s,
          cart: s.cart.map((c) => (c.uid === existing.uid ? { ...c, qty: c.qty + (line.qty ?? 1) } : c)),
        };
      }
      const newLine: CartLine = {
        ...line,
        uid: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        qty: line.qty ?? 1,
      };
      return { ...s, cart: [...s.cart, newLine] };
    });
  },
  setQty(uid: string, qty: number) {
    set((s) =>
      qty <= 0
        ? { ...s, cart: s.cart.filter((c) => c.uid !== uid) }
        : { ...s, cart: s.cart.map((c) => (c.uid === uid ? { ...c, qty } : c)) },
    );
  },
  remove(uid: string) {
    set((s) => ({ ...s, cart: s.cart.filter((c) => c.uid !== uid) }));
  },
  clearCart() {
    set((s) => ({ ...s, cart: [] }));
  },
  setGuest(guestName?: string, phone?: string) {
    set({ guestName, phone });
  },
  placeOrder(): string {
    const id = `RND-${Math.floor(Math.random() * 9000 + 1000)}`;
    const at = Date.now();
    set((s) => ({
      ...s,
      cart: [],
      rounds: [...s.rounds, { id, placedAt: at, lines: s.cart }],
    }));
    return id;
  },
};

export function lineSubtotal(l: CartLine) {
  return l.unitPrice * l.qty;
}
