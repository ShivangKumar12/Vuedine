import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  Minus,
  Percent,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { itemsApi, type Item as ApiItem } from '../../services/items';
import {
  ordersApi,
  type CalculateOutput,
  type OrderType as ApiOrderType,
  type PaymentMode,
} from '../../services/orders';
import { tablesApi, type Table as ApiTable } from '../../services/tables';
import { transactionsApi } from '../../services/transactions';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';

/* ============================================================ */
/*  Types                                                       */
/* ============================================================ */

type Item = {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string;
  veg: boolean;
  bestseller?: boolean;
  desc?: string;
};

type Category = {
  key: string;
  label: string;
  emoji: string;
  bg: string;
};

const categories: Category[] = [
  { key: 'all', label: 'All Items', emoji: '✨', bg: 'from-brand-100 to-warm-50' },
  { key: 'Appetizers', label: 'Appetizers', emoji: '🥟', bg: 'from-amber-100 to-warm-50' },
  { key: 'Pizza', label: 'Pizza', emoji: '🍕', bg: 'from-red-100 to-warm-50' },
  { key: 'Burgers', label: 'Burgers', emoji: '🍔', bg: 'from-orange-100 to-amber-50' },
  { key: 'Pasta', label: 'Pasta', emoji: '🍝', bg: 'from-yellow-100 to-amber-50' },
  { key: 'Sushi', label: 'Sushi', emoji: '🍣', bg: 'from-rose-100 to-pink-50' },
  { key: 'Salads', label: 'Salads', emoji: '🥗', bg: 'from-emerald-100 to-cool-50' },
  { key: 'Indian', label: 'Indian', emoji: '🍛', bg: 'from-orange-100 to-rose-50' },
  { key: 'Asian', label: 'Asian', emoji: '🍜', bg: 'from-rose-100 to-pink-50' },
  { key: 'Mains', label: 'Mains', emoji: '🍽️', bg: 'from-violet-100 to-fuchsia-50' },
  { key: 'Desserts', label: 'Desserts', emoji: '🍰', bg: 'from-pink-100 to-rose-50' },
  { key: 'Beverages', label: 'Beverages', emoji: '🥤', bg: 'from-cool-100 to-blue-50' },
  { key: 'Wines', label: 'Wines', emoji: '🍷', bg: 'from-purple-100 to-rose-50' },
  { key: 'Cocktails', label: 'Cocktails', emoji: '🍸', bg: 'from-indigo-100 to-violet-50' },
];

function adaptItem(it: ApiItem): Item {
  return {
    id: it.id,
    name: it.name,
    category: it.category,
    price: typeof it.price === 'string' ? parseFloat(it.price) : it.price,
    emoji: it.emoji ?? '🍽️',
    veg: it.veg,
    bestseller: it.bestseller,
    desc: it.description ?? undefined,
  };
}

type CartLine = {
  itemId: string;
  qty: number;
};

type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery';

const ORDER_TYPE_TO_API: Record<OrderType, ApiOrderType> = {
  'Dine-In': 'DINE_IN',
  Takeaway: 'TAKEAWAY',
  Delivery: 'DELIVERY',
};

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function POS() {
  const navigate = useNavigate();
  const branches = branchesStore.use();
  const activeBranch = branches.list.find((b) => b.id === branches.activeId) ?? null;
  const settingsSnap = settingsStore.use();

  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('Dine-In');
  const [tableId, setTableId] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [token] = useState(() => `TKN-${1284 + Math.floor(Math.random() * 50)}`);
  const [showSummary, setShowSummary] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [serverTotals, setServerTotals] = useState<CalculateOutput | null>(null);

  // Fetch items + tables once we have an active branch.
  useEffect(() => {
    if (!activeBranch) return;
    let cancelled = false;
    setLoadingItems(true);
    setLoadError(null);
    Promise.all([
      itemsApi.listAll().catch((e) => {
        throw e instanceof Error ? e : new Error('Failed to load items');
      }),
      tablesApi.listForBranch(activeBranch.id).catch(() => [] as ApiTable[]),
    ])
      .then(([its, tbs]) => {
        if (cancelled) return;
        setItems(its.map(adaptItem));
        setTables(tbs);
        // Set the default table to the first available "Table N" entry.
        if (!tableId && tbs.length > 0) {
          setTableId(tbs.find((t) => t.status === 'FREE')?.id ?? tbs[0].id);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load menu');
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch?.id]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeCat !== 'all' && it.category !== activeCat) return false;
      return true;
    });
  }, [search, activeCat, items]);

  const cartItems = useMemo(
    () =>
      cart
        .map((c) => {
          const item = items.find((i) => i.id === c.itemId);
          if (!item) return null;
          return { ...item, qty: c.qty, lineTotal: item.price * c.qty };
        })
        .filter((x): x is Item & { qty: number; lineTotal: number } => x !== null),
    [cart, items],
  );

  // Live server-side totals — debounced, called whenever the cart shape changes.
  useEffect(() => {
    if (!activeBranch || cart.length === 0) {
      setServerTotals(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const result = await ordersApi.calculate({
          branchId: activeBranch.id,
          type: ORDER_TYPE_TO_API[orderType],
          channel: 'POS',
          discountPct,
          lines: cartItems.map((l) => ({
            itemId: l.id,
            itemName: l.name,
            emoji: l.emoji,
            qty: l.qty,
            unitPrice: l.price,
            category: l.category,
          })),
        });
        setServerTotals(result);
      } catch {
        // Fall back to client-side totals if calculator unreachable
        setServerTotals(null);
      }
    }, 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, discountPct, orderType, activeBranch?.id]);

  const totals = useMemo(() => {
    // Prefer server totals — server is authoritative for tax / service.
    if (serverTotals) {
      const itemCount = cartItems.reduce((s, l) => s + l.qty, 0);
      return {
        subtotal: serverTotals.subtotal,
        discount: serverTotals.discountTotal,
        tax: serverTotals.taxTotal + serverTotals.serviceTotal,
        total: serverTotals.grandTotal,
        itemCount,
      };
    }
    // Client preview while server is computing or offline. Tax + service come
    // from tenant settings (branch can still force tax-inclusive / override SC).
    const subtotal = cartItems.reduce((s, l) => s + l.lineTotal, 0);
    const discount = subtotal * (discountPct / 100);
    const taxable = subtotal - discount;
    const taxRate = activeBranch?.taxInclusive ? 0 : settingsSnap.tenant ? settingsStore.defaultTaxRate() : 0.05;
    const serviceRate = activeBranch?.serviceCharge
      ? Number(activeBranch.serviceCharge) / 100
      : settingsStore.serviceChargeRate();
    const tax = taxable * taxRate + taxable * serviceRate;
    const total = taxable + tax;
    const itemCount = cartItems.reduce((s, l) => s + l.qty, 0);
    return { subtotal, discount, tax, total, itemCount };
  }, [serverTotals, cartItems, discountPct, activeBranch, settingsSnap]);

  const addToCart = (id: string) => {
    setCart((prev) => {
      const found = prev.find((c) => c.itemId === id);
      if (found) return prev.map((c) => (c.itemId === id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { itemId: id, qty: 1 }];
    });
  };
  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((c) => c.itemId !== id));
    else setCart((prev) => prev.map((c) => (c.itemId === id ? { ...c, qty } : c)));
  };
  const clearCart = () => setCart([]);

  const placeOrder = async (paymentMode?: PaymentMode) => {
    if (!activeBranch || cartItems.length === 0 || placing) return;
    setPlacing(true);
    try {
      const order = await ordersApi.create({
        branchId: activeBranch.id,
        type: ORDER_TYPE_TO_API[orderType],
        channel: 'POS',
        source: 'POS',
        tableId: orderType === 'Dine-In' ? tableId : null,
        tableLabel:
          orderType === 'Dine-In'
            ? tables.find((t) => t.id === tableId)?.name ?? null
            : orderType === 'Takeaway'
              ? 'Counter'
              : null,
        paymentMode: paymentMode ?? 'PAY_LATER',
        discountPct,
        lines: cartItems.map((l) => ({
          itemId: l.id,
          itemName: l.name,
          emoji: l.emoji,
          qty: l.qty,
          unitPrice: l.price,
          category: l.category,
        })),
      });

      // If a payment method was chosen at the counter (Cash / Card / UPI),
      // immediately record the corresponding Payment so the order ends up
      // PAID and the Transactions ledger is in sync.
      if (paymentMode && paymentMode !== 'PAY_LATER') {
        try {
          await transactionsApi.createForOrder(order.id, {
            method: paymentMode === 'WALLET' ? 'WALLET' : paymentMode,
            amount: order.grandTotal,
            type: 'SALE',
            // Cash captures synchronously at the service layer; non-cash
            // captures here too because the cashier has eyeballs on the
            // physical transaction (card swipe, UPI app confirmation).
            capture: true,
          });
        } catch (err) {
          // Order is created — surface the payment error but don't roll back
          // the order. The cashier can record payment from the Order detail
          // / Transactions page.
          // eslint-disable-next-line no-console
          console.warn('[pos] payment record failed:', err);
        }
      }

      clearCart();
      setShowSummary(false);
      navigate('/dashboard/live-orders', { state: { lastOrderId: order.id } });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const tableName = useMemo(
    () => tables.find((t) => t.id === tableId)?.name ?? '—',
    [tableId, tables],
  );

  return (
    <>
      <div className="-mx-4 -my-6 grid h-[calc(100vh-64px)] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px] sm:-mx-6 lg:-mx-8">
        {/* Menu side */}
        <section className="flex min-h-0 flex-col overflow-hidden border-r border-ink-100 bg-ink-50/40">
          <MenuHeader
            search={search}
            setSearch={setSearch}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-500">
                {activeCat === 'all' ? 'All items' : activeCat}
                <span className="ml-2 text-ink-400">· {filtered.length} items</span>
              </div>
              {loadingItems && (
                <span className="text-[11px] font-semibold text-ink-500">Loading menu…</span>
              )}
              {loadError && (
                <span className="text-[11px] font-semibold text-rose-600">{loadError}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((it, i) => {
                const inCart = cart.find((c) => c.itemId === it.id);
                return (
                  <ItemCard
                    key={it.id}
                    item={it}
                    index={i}
                    qty={inCart?.qty ?? 0}
                    onAdd={() => addToCart(it.id)}
                    onUpdate={(q) => updateQty(it.id, q)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <div className="text-base font-bold text-ink-700">No items match your search</div>
                  <div className="mt-1 text-sm text-ink-500">Try a different keyword or category.</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Cart side (desktop) */}
        <aside className="hidden flex-col bg-white lg:flex">
          <CartPanel
            cartItems={cartItems}
            updateQty={updateQty}
            clearCart={clearCart}
            orderType={orderType}
            setOrderType={setOrderType}
            tables={tables}
            tableId={tableId}
            setTableId={setTableId}
            discountPct={discountPct}
            setDiscountPct={setDiscountPct}
            token={token}
            totals={totals}
            placing={placing}
            onPlace={() => setShowSummary(true)}
          />
        </aside>
      </div>

      {/* Mobile cart bar */}
      <MobileCartBar
        count={totals.itemCount}
        total={totals.total}
        onOpen={() => setShowSummary(true)}
      />

      {/* Cart drawer (mobile) + Place-order summary modal */}
      <SummaryModal
        open={showSummary}
        onClose={() => setShowSummary(false)}
        cartItems={cartItems}
        totals={totals}
        orderType={orderType}
        table={tableName}
        token={token}
        placing={placing}
        onConfirm={(mode) => placeOrder(mode)}
      />
    </>
  );
}

/* ============================================================ */
/*  Menu header                                                 */
/* ============================================================ */

function MenuHeader({
  search,
  setSearch,
  activeCat,
  setActiveCat,
}: {
  search: string;
  setSearch: (v: string) => void;
  activeCat: string;
  setActiveCat: (v: string) => void;
}) {
  return (
    <div className="border-b border-ink-100 bg-white px-4 pt-4 sm:px-6">
      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder="Search menu by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="vue-input pl-10"
            style={{ height: 44 }}
          />
        </div>
        <button
          aria-label="Search"
          className="btn-primary shine inline-flex h-11 w-11 items-center justify-center rounded-xl"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      {/* Categories */}
      <CategoryStrip activeCat={activeCat} setActiveCat={setActiveCat} />
    </div>
  );
}

function CategoryStrip({
  activeCat,
  setActiveCat,
}: {
  activeCat: string;
  setActiveCat: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative -mx-4 mt-3 sm:-mx-6">
      <div
        ref={ref}
        className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 pb-4 sm:px-6"
      >
        {categories.map((c) => {
          const active = activeCat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={cn(
                'group relative flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-3 py-2.5 text-center transition',
                active
                  ? 'border-brand-500 bg-white shadow-md shadow-brand-500/15'
                  : 'border-transparent bg-ink-50/60 hover:border-ink-200 hover:bg-white',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ring-1',
                  c.bg,
                  active ? 'ring-brand-300' : 'ring-ink-100',
                )}
              >
                {c.emoji}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] font-bold transition',
                  active ? 'text-brand-700' : 'text-ink-700',
                )}
              >
                {c.label}
              </span>
              {active && (
                <motion.span
                  layoutId="pos-cat-bar"
                  className="absolute -bottom-0.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-brand-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Item card                                                   */
/* ============================================================ */

function ItemCard({
  item,
  index,
  qty,
  onAdd,
  onUpdate,
}: {
  item: Item;
  index: number;
  qty: number;
  onAdd: () => void;
  onUpdate: (q: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.015, 0.4) }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition',
        qty > 0 ? 'border-brand-300 ring-1 ring-brand-200' : 'border-ink-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md',
      )}
    >
      {/* Photo / emoji */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 sm:h-32">
        <span className="absolute inset-0 flex items-center justify-center text-5xl transition-transform duration-500 group-hover:scale-110">
          {item.emoji}
        </span>
        {item.bestseller && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
            <Sparkles className="h-2.5 w-2.5" />
            BESTSELLER
          </span>
        )}
        <span
          className={cn(
            'absolute right-2 top-2 inline-flex h-4 w-4 items-center justify-center rounded-sm border bg-white/90',
            item.veg ? 'border-emerald-500' : 'border-rose-500',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', item.veg ? 'bg-emerald-500' : 'bg-rose-500')} />
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <div className="text-[13px] font-bold text-ink-900">{item.name}</div>
        {item.desc && (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-500">{item.desc}</div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="text-base font-extrabold text-ink-900">${item.price.toFixed(2)}</div>
          <AnimatePresence mode="popLayout" initial={false}>
            {qty === 0 ? (
              <motion.button
                key="add"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={onAdd}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-500 hover:text-white"
              >
                <Plus className="h-3 w-3" strokeWidth={3} />
                Add
              </motion.button>
            ) : (
              <motion.div
                key="stepper"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 p-0.5 text-white shadow-sm shadow-brand-500/30"
              >
                <button
                  onClick={() => onUpdate(qty - 1)}
                  aria-label="Decrease"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/20"
                >
                  <Minus className="h-3 w-3" strokeWidth={3} />
                </button>
                <span className="min-w-[18px] text-center text-[12px] font-bold">{qty}</span>
                <button
                  onClick={() => onUpdate(qty + 1)}
                  aria-label="Increase"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/20"
                >
                  <Plus className="h-3 w-3" strokeWidth={3} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Cart panel                                                  */
/* ============================================================ */

type Totals = { subtotal: number; discount: number; tax: number; total: number; itemCount: number };

function CartPanel({
  cartItems,
  updateQty,
  clearCart,
  orderType,
  setOrderType,
  tables,
  tableId,
  setTableId,
  discountPct,
  setDiscountPct,
  token,
  totals,
  placing,
  onPlace,
}: {
  cartItems: (Item & { qty: number; lineTotal: number })[];
  updateQty: (id: string, q: number) => void;
  clearCart: () => void;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  tables: ApiTable[];
  tableId: string | null;
  setTableId: (id: string | null) => void;
  discountPct: number;
  setDiscountPct: (p: number) => void;
  token: string;
  totals: Totals;
  placing: boolean;
  onPlace: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-ink-100 px-5 pt-5">
        <CustomerSelect />
        <TokenInput token={token} />

        <div className="mt-3">
          <Label>Select order type</Label>
          <OrderTypeTabs value={orderType} onChange={setOrderType} />
        </div>

        {orderType === 'Dine-In' && (
          <div className="mt-3 pb-4">
            <Label>Select table</Label>
            <TableSelect tables={tables} value={tableId} onChange={setTableId} />
          </div>
        )}
        {orderType !== 'Dine-In' && <div className="pb-4" />}
      </div>

      {/* Items list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[1fr_60px_80px_28px] gap-2 border-b border-ink-100 bg-brand-50/50 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-700">
          <span>Item</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Price</span>
          <span />
        </div>
        {cartItems.length === 0 ? (
          <EmptyCart />
        ) : (
          <ul className="divide-y divide-ink-100">
            <AnimatePresence initial={false}>
              {cartItems.map((line) => (
                <motion.li
                  key={line.id}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-[1fr_60px_80px_28px] items-center gap-2 px-5 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-base ring-1 ring-ink-100">
                      {line.emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-ink-900">{line.name}</div>
                      <div className="text-[10px] font-medium text-ink-500">${line.price.toFixed(2)} ea</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-0.5 rounded-lg bg-brand-50 p-0.5 ring-1 ring-brand-200">
                      <button
                        onClick={() => updateQty(line.id, line.qty - 1)}
                        aria-label="Decrease"
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-brand-600 hover:bg-white"
                      >
                        <Minus className="h-3 w-3" strokeWidth={3} />
                      </button>
                      <span className="min-w-[16px] text-center text-[11px] font-bold text-brand-700">
                        {line.qty}
                      </span>
                      <button
                        onClick={() => updateQty(line.id, line.qty + 1)}
                        aria-label="Increase"
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-brand-600 hover:bg-white"
                      >
                        <Plus className="h-3 w-3" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-[13px] font-extrabold text-ink-900">
                    ${line.lineTotal.toFixed(2)}
                  </div>
                  <button
                    onClick={() => updateQty(line.id, 0)}
                    aria-label="Remove"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Totals + actions */}
      <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-4">
        <DiscountRow value={discountPct} onChange={setDiscountPct} />

        <dl className="mt-3 space-y-1.5 text-[13px]">
          <Row label="Sub Total">${totals.subtotal.toFixed(2)}</Row>
          <Row label="Discount">
            <span className="text-emerald-600">−${totals.discount.toFixed(2)}</span>
          </Row>
          <Row label="Tax + service">${totals.tax.toFixed(2)}</Row>
          <div className="my-2 border-t border-dashed border-ink-200" />
          <Row label="Total" emphasis>
            ${totals.total.toFixed(2)}
          </Row>
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={clearCart}
            disabled={cartItems.length === 0}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </span>
          </button>
          <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
            <span className="inline-flex items-center justify-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Save
            </span>
          </button>
        </div>

        <button
          onClick={onPlace}
          disabled={cartItems.length === 0 || placing}
          className="btn-primary shine mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? 'Placing…' : `Place order · $${totals.total.toFixed(2)}`}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700',
      )}
    >
      <dt className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</dt>
      <dd className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</dd>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
      {children}
    </div>
  );
}

function CustomerSelect() {
  return (
    <div>
      <Label>Customer</Label>
      <div className="flex items-center gap-2">
        <button className="flex flex-1 items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-[13px] font-semibold text-ink-700 shadow-sm transition hover:border-brand-300">
          <span className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-warm-500 text-white">
              <User className="h-3.5 w-3.5" />
            </span>
            Walking customer
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
        </button>
        <button
          aria-label="Add customer"
          className="btn-primary shine inline-flex h-10 w-10 items-center justify-center rounded-xl"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TokenInput({ token }: { token: string }) {
  return (
    <div className="mt-3">
      <Label>Token no</Label>
      <input
        readOnly
        value={token}
        className="vue-input cursor-default font-mono font-bold tracking-wider"
      />
    </div>
  );
}

function OrderTypeTabs({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (v: OrderType) => void;
}) {
  const opts: OrderType[] = ['Dine-In', 'Takeaway', 'Delivery'];
  return (
    <div className="relative grid grid-cols-3 gap-1.5">
      {opts.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn(
              'relative rounded-xl border px-2 py-2 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/15'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
            )}
          >
            <span className="relative inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex h-3 w-3 items-center justify-center rounded-full border-2',
                  active ? 'border-brand-500' : 'border-ink-300',
                )}
              >
                {active && <span className="h-1 w-1 rounded-full bg-brand-500" />}
              </span>
              {o}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TableSelect({
  tables,
  value,
  onChange,
}: {
  tables: ApiTable[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="vue-input appearance-none pr-9 font-bold"
      >
        {tables.length === 0 && <option value="">No tables</option>}
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} {t.section ? `· ${t.section}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

function DiscountRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
          <Tag className="h-3.5 w-3.5 text-emerald-600" />
        </span>
        Discount
      </div>
      <div className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          className="h-8 w-14 rounded-lg border border-ink-200 bg-white px-2 text-right text-[13px] font-bold text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
        />
        <span className="text-[12px] font-bold text-ink-500">
          <Percent className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-brand-100">
        <ShoppingCart className="h-6 w-6 text-brand-500" />
      </span>
      <div>
        <div className="text-sm font-bold text-ink-900">Cart is empty</div>
        <div className="mt-0.5 text-[12px] text-ink-500">Pick items from the menu to start an order.</div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Mobile bar + summary modal                                  */
/* ============================================================ */

function MobileCartBar({
  count,
  total,
  onOpen,
}: {
  count: number;
  total: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed inset-x-3 bottom-3 z-30 lg:hidden"
    >
      <button
        onClick={onOpen}
        className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-white shadow-2xl shadow-brand-500/40"
      >
        <div className="inline-flex items-center gap-2">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-700">
              {count}
            </span>
          </span>
          <span className="text-[12px] font-bold uppercase tracking-wider">View order</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-base font-extrabold">
          ${total.toFixed(2)}
          <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </motion.div>
  );
}

function SummaryModal({
  open,
  onClose,
  cartItems,
  totals,
  orderType,
  table,
  token,
  placing,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  cartItems: (Item & { qty: number; lineTotal: number })[];
  totals: Totals;
  orderType: OrderType;
  table: string;
  token: string;
  placing: boolean;
  onConfirm: (paymentMode?: PaymentMode) => void;
}) {
  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-2xl shadow-black/20">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Confirm order</div>
                <div className="mt-1 text-3xl font-extrabold">${totals.total.toFixed(2)}</div>
                <div className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold text-white/90">
                  <span>{token}</span>
                  <span className="text-white/40">·</span>
                  <span>{orderType}</span>
                  {orderType === 'Dine-In' && (
                    <>
                      <span className="text-white/40">·</span>
                      <span>{table}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[40vh] overflow-y-auto border-b border-ink-100 px-5 py-3">
                {cartItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-ink-500">No items in this order.</div>
                ) : (
                  <ul className="divide-y divide-ink-100 text-sm">
                    {cartItems.map((line) => (
                      <li key={line.id} className="flex items-center justify-between py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-base">{line.emoji}</span>
                          <span className="font-bold text-ink-900">{line.qty}× {line.name}</span>
                        </span>
                        <span className="font-bold text-ink-900">${line.lineTotal.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1.5 border-b border-ink-100 px-5 py-3 text-[13px]">
                <Row label="Sub Total">${totals.subtotal.toFixed(2)}</Row>
                <Row label="Discount">
                  <span className="text-emerald-600">−${totals.discount.toFixed(2)}</span>
                </Row>
                <Row label="Tax">${totals.tax.toFixed(2)}</Row>
                <div className="my-1 border-t border-dashed border-ink-200" />
                <Row label="Total" emphasis>
                  ${totals.total.toFixed(2)}
                </Row>
              </div>

              {/* Pay actions */}
              <div className="space-y-2 p-5">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { label: 'Cash', tone: 'emerald', mode: 'CASH' as PaymentMode },
                      { label: 'Card', tone: 'blue', mode: 'CARD' as PaymentMode },
                      { label: 'UPI', tone: 'brand', mode: 'UPI' as PaymentMode },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.label}
                      disabled={placing}
                      onClick={() => onConfirm(p.mode)}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
                        p.tone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                        p.tone === 'blue' && 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                        p.tone === 'brand' && 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onConfirm()}
                  disabled={cartItems.length === 0 || placing}
                  className="btn-primary shine flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {placing ? 'Sending…' : 'Confirm & charge'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Back to order
                </button>
                <Link
                  to="/dashboard/pos-orders"
                  className="block text-center text-[11px] font-semibold text-ink-500 hover:text-brand-600"
                >
                  Or go to all POS orders →
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
