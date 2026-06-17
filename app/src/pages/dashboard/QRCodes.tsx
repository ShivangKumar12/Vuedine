import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  Eye,
  Filter,
  Lock,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { ApiError } from '../../lib/api';
import { qrApi, type QrAnalytics, type QrEntry, type QrStats, type QrTypeCode } from '../../services/qr';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types                                                       */
/* ============================================================ */

type QrType = 'Table' | 'Counter' | 'Takeaway' | 'Delivery' | 'Marketing';
type QrStatus = 'Active' | 'Inactive' | 'Pending';

type ProductSize = { id: string; label: string; desc: string; price: number };

type Product = {
  id: string;
  name: string;
  desc: string;
  long: string;
  badge?: string;
  badgeTone?: 'brand' | 'amber' | 'emerald';
  emoji: string;
  features: string[];
  basePrice: number;
  bulkPrice?: number;
  sizes?: ProductSize[];
};

const orderableProducts: Product[] = [
  {
    id: 'tent',
    name: 'Premium tent card',
    desc: 'Sturdy A6 acrylic tent with brand colors',
    long: '4mm acrylic, full-color UV print on both sides, includes cleaning microfiber.',
    badge: 'Bestseller',
    badgeTone: 'brand',
    emoji: '🪧',
    features: ['Double-sided print', '4mm acrylic', 'Anti-glare', 'Cleaning cloth included'],
    basePrice: 8.99,
    bulkPrice: 6.99,
    sizes: [
      { id: 'a6', label: 'A6 · 105×148mm', desc: 'Standard tabletop size', price: 0 },
      { id: 'a5', label: 'A5 · 148×210mm', desc: 'Ideal for shared tables', price: 2.5 },
    ],
  },
  {
    id: 'sticker',
    name: 'Vinyl QR sticker',
    desc: 'Waterproof tabletop sticker',
    long: '90×90mm UV-laminated vinyl sticker, scratch resistant, perfect for fixed counters.',
    emoji: '🏷️',
    features: ['UV laminated', 'Waterproof', 'Removable adhesive', '2-year lifespan'],
    basePrice: 1.99,
    bulkPrice: 1.49,
    sizes: [
      { id: 'sm', label: '75×75mm', desc: 'Compact', price: 0 },
      { id: 'md', label: '90×90mm', desc: 'Most popular', price: 0.5 },
      { id: 'lg', label: '150×150mm', desc: 'Wall mount', price: 1.5 },
    ],
  },
  {
    id: 'metal',
    name: 'Brass tent stand',
    desc: 'Premium brass stand for fine dining',
    long: 'Hand-finished brass stand with engraved logo, A6 QR insert, weighted base.',
    badge: 'Premium',
    badgeTone: 'amber',
    emoji: '🥇',
    features: ['Engraved brand logo', 'Weighted base', 'Magnetic insert change', 'Lifetime warranty'],
    basePrice: 24.99,
    sizes: [
      { id: 'gold', label: 'Antique brass', desc: 'Warm finish', price: 0 },
      { id: 'silver', label: 'Brushed silver', desc: 'Modern finish', price: 0 },
    ],
  },
  {
    id: 'standee',
    name: 'A4 floor standee',
    desc: 'Welcome standee for entrance / counter',
    long: '60×120cm fabric standee with retractable steel base, stores in a carry bag.',
    emoji: '🏳️',
    features: ['60×120cm canvas', 'Retractable base', 'Carry bag', 'Wrinkle resistant'],
    basePrice: 49.99,
  },
  {
    id: 'bundle-30',
    name: 'Bundle · 30 tables',
    desc: '30 tent cards + 1 standee',
    long: 'Everything you need to roll out QR ordering on opening day. Includes branding QC.',
    badge: 'Save $40',
    badgeTone: 'emerald',
    emoji: '📦',
    features: ['30 tent cards', '1 floor standee', 'Branding review', 'Express shipping'],
    basePrice: 219,
  },
  {
    id: 'driver',
    name: 'Delivery rider QR',
    desc: 'Magnetic QR for delivery bikes',
    long: 'Weatherproof magnetic decal for delivery riders to share menu / re-order links.',
    emoji: '🛵',
    features: ['Magnetic mount', 'Weatherproof', 'Reflective edge', 'Pack of 5'],
    basePrice: 14.99,
  },
];

/* ============================================================ */
/*  Meta                                                        */
/* ============================================================ */

const typeMeta: Record<QrType, { tone: string; emoji: string }> = {
  Table: { tone: 'bg-brand-50 text-brand-700 ring-brand-200', emoji: '🪑' },
  Counter: { tone: 'bg-warm-50 text-warm-700 ring-warm-200', emoji: '🛎️' },
  Takeaway: { tone: 'bg-amber-50 text-amber-700 ring-amber-200', emoji: '🥡' },
  Delivery: { tone: 'bg-cool-50 text-cool-700 ring-cool-200', emoji: '🛵' },
  Marketing: { tone: 'bg-violet-50 text-violet-700 ring-violet-200', emoji: '✨' },
};

const statusMeta: Record<QrStatus, { pill: string; dot: string }> = {
  Active: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Inactive: { pill: 'bg-ink-100 text-ink-600 ring-ink-200', dot: 'bg-ink-400' },
  Pending: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
};

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function QRCodes() {
  const branchesState = branchesStore.use();
  const [tab, setTab] = useState<'manage' | 'order'>('manage');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'All' | QrType>('All');
  const [status, setStatus] = useState<'All' | QrStatus>('All');
  const [branch, setBranch] = useState('All branches');
  const [drawer, setDrawer] = useState<QrEntry | null>(null);
  const [productCart, setProductCart] = useState<Record<string, { qty: number; sizeId?: string }>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  // Live QR data
  const [entries, setEntries] = useState<QrEntry[]>([]);
  const [stats, setStats] = useState<QrStats>({ total: 0, active: 0, scans: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { entries: rows, stats: s } = await qrApi.list();
      setEntries(rows);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const branchOptions = useMemo(
    () => ['All branches', ...branchesState.list.map((b) => b.name)],
    [branchesState.list],
  );

  const filtered = useMemo(() => {
    return entries.filter((q) => {
      if (search) {
        const s = search.toLowerCase();
        if (!q.label.toLowerCase().includes(s) && !q.url.toLowerCase().includes(s)) return false;
      }
      if (type !== 'All' && q.type !== type) return false;
      if (status !== 'All' && q.status !== status) return false;
      if (branch !== 'All branches' && q.branch !== branch) return false;
      return true;
    });
  }, [entries, search, type, status, branch]);

  // Optimistic local mutations after API calls.
  const upsertEntry = (e: QrEntry) =>
    setEntries((cur) => {
      const i = cur.findIndex((x) => x.id === e.id);
      if (i === -1) return [e, ...cur];
      const next = cur.slice();
      next[i] = e;
      return next;
    });
  const removeEntry = (id: string) => setEntries((cur) => cur.filter((x) => x.id !== id));

  const onCreated = (e: QrEntry) => {
    upsertEntry(e);
    setStats((s) => ({ ...s, total: s.total + 1, active: s.active + (e.statusCode === 'ACTIVE' ? 1 : 0) }));
  };

  const handlePrintAll = async () => {
    setPrinting(true);
    try {
      const blob = await qrApi.bulkPrint(
        branch !== 'All branches'
          ? { branchId: branchesState.list.find((b) => b.name === branch)?.id }
          : {},
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vuedine-qr-codes.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  };

  const cartLines = Object.entries(productCart)
    .map(([pid, val]) => {
      const product = orderableProducts.find((p) => p.id === pid);
      if (!product) return null;
      const size = product.sizes?.find((sz) => sz.id === val.sizeId);
      const unitPrice = product.basePrice + (size?.price ?? 0);
      const usedBulk = product.bulkPrice && val.qty >= 30 ? product.bulkPrice : null;
      const finalUnit = usedBulk ? usedBulk + (size?.price ?? 0) : unitPrice;
      return { product, size, qty: val.qty, unitPrice: finalUnit, total: finalUnit * val.qty };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const cartTotal = cartLines.reduce((s, l) => s + l.total, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  const setProduct = (id: string, patch: Partial<{ qty: number; sizeId: string }>) => {
    setProductCart((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? { qty: 0 };
      const merged = { ...cur, ...patch };
      if (!merged.qty || merged.qty <= 0) {
        delete next[id];
      } else {
        next[id] = merged;
      }
      return next;
    });
  };

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* Hero */}
        <Hero stats={stats} />

        {/* Tabs */}
        <Tabs tab={tab} onChange={setTab} cartCount={cartCount} />

        {tab === 'manage' ? (
          <ManagePane
            search={search}
            setSearch={setSearch}
            type={type}
            setType={setType}
            status={status}
            setStatus={setStatus}
            branch={branch}
            setBranch={setBranch}
            branchOptions={branchOptions}
            allEntries={entries}
            entries={filtered}
            loading={loading}
            error={error}
            onRetry={load}
            onView={setDrawer}
            onNew={() => setCreating(true)}
            onPrintAll={handlePrintAll}
            printing={printing}
          />
        ) : (
          <OrderPane
            cart={productCart}
            cartLines={cartLines}
            cartTotal={cartTotal}
            cartCount={cartCount}
            setProduct={setProduct}
            onCheckout={() => setShowCheckout(true)}
          />
        )}
      </div>

      <QrViewerDrawer
        entry={drawer}
        onClose={() => setDrawer(null)}
        onChanged={(e) => {
          upsertEntry(e);
          setDrawer(e);
        }}
        onDeleted={(id) => {
          removeEntry(id);
          setDrawer(null);
          setStats((s) => ({ ...s, total: Math.max(0, s.total - 1) }));
        }}
      />
      <CreateQrModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(e) => {
          onCreated(e);
          setCreating(false);
        }}
      />
      <CheckoutDrawer
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        cartLines={cartLines}
        cartTotal={cartTotal}
        onConfirm={() => {
          setShowCheckout(false);
          setProductCart({});
        }}
      />
    </>
  );
}

/* ============================================================ */
/*  Hero                                                        */
/* ============================================================ */

function Hero({ stats }: { stats: { total: number; active: number; scans: number; orders: number } }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50 p-5 shadow-sm sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-brand-200/60 to-warm-200/60 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-brand-700">
            <QrCode className="h-3 w-3" />
            QR Codes
          </span>
          <h1 className="display mt-3 text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">
            Every QR your <span className="gradient-text-warm">restaurant runs.</span>
          </h1>
          <p className="mt-2 max-w-lg text-[14px] text-ink-600">
            Manage tabletop, takeaway, delivery and marketing QR codes — and order branded physical
            tent cards, stickers and stands shipped to your door.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} accent="text-brand-600" />
          <Stat label="Active" value={stats.active} accent="text-emerald-600" />
          <Stat label="Scans · 30d" value={stats.scans} accent="text-amber-600" />
          <Stat label="Orders today" value={stats.orders} accent="text-cool-600" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/80 px-3 py-2 text-center shadow-sm backdrop-blur">
      <div className={cn('text-2xl font-extrabold', accent)}>
        <Counter value={value} />
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
    </div>
  );
}

/* ============================================================ */
/*  Tabs                                                        */
/* ============================================================ */

function Tabs({
  tab,
  onChange,
  cartCount,
}: {
  tab: 'manage' | 'order';
  onChange: (t: 'manage' | 'order') => void;
  cartCount: number;
}) {
  return (
    <div className="inline-flex h-12 items-center gap-0.5 rounded-2xl border border-ink-200 bg-white p-1 shadow-sm">
      {(
        [
          { id: 'manage', label: 'Manage QR codes', icon: QrCode },
          { id: 'order', label: 'Order physical', icon: ShoppingCart },
        ] as const
      ).map((t) => {
        const isActive = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold transition',
              isActive ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="qr-tab"
                className="absolute inset-0 rounded-xl bg-brand-500 shadow-md shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === 'order' && cartCount > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    isActive ? 'bg-white/25 text-white' : 'bg-brand-500 text-white',
                  )}
                >
                  {cartCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Manage pane                                                 */
/* ============================================================ */

function ManagePane({
  search,
  setSearch,
  type,
  setType,
  status,
  setStatus,
  branch,
  setBranch,
  branchOptions,
  allEntries,
  entries,
  loading,
  error,
  onRetry,
  onView,
  onNew,
  onPrintAll,
  printing,
}: {
  search: string;
  setSearch: (v: string) => void;
  type: 'All' | QrType;
  setType: (v: 'All' | QrType) => void;
  status: 'All' | QrStatus;
  setStatus: (v: 'All' | QrStatus) => void;
  branch: string;
  setBranch: (v: string) => void;
  branchOptions: string[];
  allEntries: QrEntry[];
  entries: QrEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onView: (q: QrEntry) => void;
  onNew: () => void;
  onPrintAll: () => void;
  printing: boolean;
}) {
  const counts: Record<string, number> = { All: allEntries.length };
  (Object.keys(typeMeta) as QrType[]).forEach((t) => {
    counts[t] = allEntries.filter((q) => q.type === t).length;
  });

  return (
    <>
      {/* Header bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              placeholder="Search by label or URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            />
          </div>
          <FilterMenu status={status} setStatus={setStatus} branch={branch} setBranch={setBranch} branchOptions={branchOptions} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onPrintAll}
            disabled={printing || allEntries.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            {printing ? 'Preparing…' : 'Print all'}
          </button>
          <button
            onClick={onNew}
            className="btn-primary shine inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            New QR code
          </button>
        </div>
      </div>

      {/* Type pills */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {(['All', ...(Object.keys(typeMeta) as QrType[])] as const).map((t) => {
          const active = type === t;
          const meta = t === 'All' ? null : typeMeta[t];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
                active
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
              )}
            >
              {meta && <span>{meta.emoji}</span>}
              {t}
              <span
                className={cn(
                  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
                )}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <div className="text-[14px] font-bold text-rose-700">{error}</div>
          <button onClick={onRetry} className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-bold text-rose-700 hover:bg-rose-50">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyManage />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((q, i) => (
            <QrCard key={q.id} entry={q} index={i} onView={() => onView(q)} />
          ))}
        </div>
      )}
    </>
  );
}

function FilterMenu({
  status,
  setStatus,
  branch,
  setBranch,
  branchOptions,
}: {
  status: 'All' | QrStatus;
  setStatus: (v: 'All' | QrStatus) => void;
  branch: string;
  setBranch: (v: string) => void;
  branchOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-40 mt-2 w-64 space-y-3 rounded-xl border border-ink-200 bg-white p-3 shadow-2xl shadow-black/10"
            >
              <div>
                <div className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Status
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['All', 'Active', 'Inactive', 'Pending'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                        status === s
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Branch
                </div>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-900 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                >
                  {branchOptions.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function QrCard({ entry, index, onView }: { entry: QrEntry; index: number; onView: () => void }) {
  const meta = typeMeta[entry.type];
  const status = statusMeta[entry.status];

  return (
    <motion.button
      onClick={onView}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.025, 0.4) }}
      whileHover={{ y: -3 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="relative flex items-center justify-center bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 p-5">
        <div className="rounded-xl border-2 border-ink-100 bg-white p-2">
          <QRCodeSVG value={entry.url} size={96} level="M" bgColor="#ffffff" fgColor="#0F172A" />
        </div>
        <span
          className={cn(
            'absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
            status.pill,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
          {entry.status}
        </span>
      </div>
      <div className="border-t border-ink-100 p-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold text-ink-900">{entry.label}</div>
            <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {meta.emoji} {entry.type}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
          <div>
            <div className="text-ink-400">Scans</div>
            <div className="text-ink-900">
              <Counter value={entry.scans} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-ink-400">Today</div>
            <div className="text-brand-600">{entry.ordersToday}</div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function EmptyManage() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink-200 bg-white p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-100">
        <QrCode className="h-6 w-6 text-brand-500" />
      </div>
      <div className="mt-4 text-base font-extrabold text-ink-900">No QR codes match</div>
      <div className="mt-1 text-sm text-ink-500">Try a different filter or create your first QR.</div>
    </div>
  );
}

/* ============================================================ */
/*  Order pane                                                  */
/* ============================================================ */

function OrderPane({
  cart,
  cartLines,
  cartTotal,
  cartCount,
  setProduct,
  onCheckout,
}: {
  cart: Record<string, { qty: number; sizeId?: string }>;
  cartLines: { product: Product; size?: ProductSize; qty: number; unitPrice: number; total: number }[];
  cartTotal: number;
  cartCount: number;
  setProduct: (id: string, patch: Partial<{ qty: number; sizeId: string }>) => void;
  onCheckout: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Products */}
        <div className="space-y-4">
          {/* Bundle banner */}
          <BundleBanner />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orderableProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={cart[p.id]?.qty ?? 0}
                sizeId={cart[p.id]?.sizeId}
                onQty={(q) => setProduct(p.id, { qty: q })}
                onSize={(sid) => setProduct(p.id, { sizeId: sid })}
              />
            ))}
          </div>
        </div>

        {/* Sticky summary (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-[88px]">
            <SummaryCard
              cartLines={cartLines}
              cartTotal={cartTotal}
              cartCount={cartCount}
              onCheckout={onCheckout}
            />
          </div>
        </aside>
      </div>

      {/* Mobile floating bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-x-3 bottom-3 z-30 lg:hidden"
          >
            <button
              onClick={onCheckout}
              className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-white shadow-2xl shadow-brand-500/40"
            >
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-700">
                    {cartCount}
                  </span>
                </span>
                <span className="text-[12px] font-bold uppercase tracking-wider">Checkout</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-base font-extrabold">
                ${cartTotal.toFixed(2)}
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function BundleBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-100/60 via-warm-100/60 to-brand-100/60 p-5 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-amber-300/60 to-brand-300/60 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-brand-500 text-white shadow-md shadow-amber-500/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700">
              Pro tip · save up to 30%
            </div>
            <div className="mt-0.5 text-base font-extrabold text-ink-900">
              Order 30+ tent cards and unlock bulk pricing automatically.
            </div>
            <div className="mt-0.5 text-[12px] text-ink-600">
              Free express shipping on bundles · branding QC included.
            </div>
          </div>
        </div>
        <span className="rounded-full border border-amber-300 bg-white/70 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-amber-800 shadow-sm backdrop-blur">
          Auto-applied
        </span>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  qty,
  sizeId,
  onQty,
  onSize,
}: {
  product: Product;
  qty: number;
  sizeId?: string;
  onQty: (q: number) => void;
  onSize: (s: string) => void;
}) {
  const selectedSize = product.sizes?.find((s) => s.id === sizeId) ?? product.sizes?.[0];
  const unitPrice =
    product.bulkPrice && qty >= 30
      ? product.bulkPrice + (selectedSize?.price ?? 0)
      : product.basePrice + (selectedSize?.price ?? 0);
  const isBulk = product.bulkPrice && qty >= 30;

  const tone = product.badgeTone ?? 'brand';
  const badgeClasses = {
    brand: 'bg-brand-500 text-white',
    amber: 'bg-amber-500 text-white',
    emerald: 'bg-emerald-500 text-white',
  }[tone];

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition',
        qty > 0 ? 'border-brand-300 ring-1 ring-brand-200' : 'border-ink-200 hover:shadow-md',
      )}
    >
      {/* Hero */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50">
        <span className="absolute inset-0 flex items-center justify-center text-7xl">
          {product.emoji}
        </span>
        <div className="absolute right-2 top-2 rounded-xl border-2 border-white bg-white p-1.5 shadow-md">
          <QRCodeSVG value="https://vuedine.app/m/sample" size={48} level="L" bgColor="#ffffff" fgColor="#0F172A" />
        </div>
        {product.badge && (
          <span
            className={cn(
              'absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-md',
              badgeClasses,
            )}
          >
            {product.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[14px] font-extrabold text-ink-900">{product.name}</div>
        <div className="mt-0.5 text-[12px] text-ink-500">{product.desc}</div>

        {/* Features */}
        <ul className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-ink-700">
          {product.features.slice(0, 3).map((f) => (
            <li key={f} className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              {f}
            </li>
          ))}
        </ul>

        {/* Sizes */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-400">Size</div>
            <div className="flex flex-wrap gap-1.5">
              {product.sizes.map((s) => {
                const on = (sizeId ?? product.sizes![0].id) === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSize(s.id)}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-left text-[11px] font-bold transition',
                      on
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                    )}
                  >
                    {s.label}
                    {s.price > 0 && <span className="ml-1 text-ink-500">+${s.price.toFixed(2)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <div className="text-xl font-extrabold text-ink-900">${unitPrice.toFixed(2)}</div>
            {isBulk && (
              <div className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                <Sparkles className="h-2.5 w-2.5" />
                Bulk · saved
              </div>
            )}
            {!isBulk && product.bulkPrice && (
              <div className="text-[10px] text-ink-500">
                Bulk @ 30+: ${product.bulkPrice.toFixed(2)}/unit
              </div>
            )}
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {qty === 0 ? (
              <motion.button
                key="add"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => onQty(1)}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12px] font-bold text-brand-700 transition hover:bg-brand-500 hover:text-white"
              >
                <Plus className="h-3 w-3" strokeWidth={3} />
                Add
              </motion.button>
            ) : (
              <motion.div
                key="qty"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 p-0.5 text-white shadow-sm shadow-brand-500/30"
              >
                <button
                  onClick={() => onQty(qty - 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20"
                  aria-label="Decrease"
                >
                  <Minus className="h-3 w-3" strokeWidth={3} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    onQty(Number.isFinite(v) ? Math.max(0, v) : 0);
                  }}
                  className="h-7 w-10 bg-transparent text-center text-[12px] font-extrabold text-white focus:outline-none"
                />
                <button
                  onClick={() => onQty(qty + 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20"
                  aria-label="Increase"
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

function SummaryCard({
  cartLines,
  cartTotal,
  cartCount,
  onCheckout,
}: {
  cartLines: { product: Product; size?: ProductSize; qty: number; unitPrice: number; total: number }[];
  cartTotal: number;
  cartCount: number;
  onCheckout: () => void;
}) {
  const shipping = cartTotal === 0 ? 0 : cartTotal > 100 ? 0 : 9.99;
  const tax = cartTotal * 0.05;
  const grandTotal = cartTotal + shipping + tax;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 p-4 text-white">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/85">Your order</div>
        <div className="mt-0.5 text-xl font-extrabold">
          {cartCount} {cartCount === 1 ? 'item' : 'items'}
        </div>
      </div>
      {cartLines.length === 0 ? (
        <div className="p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-100">
            <Package className="h-5 w-5" />
          </span>
          <div className="mt-3 text-[13px] font-bold text-ink-900">Cart is empty</div>
          <div className="mt-1 text-[11px] text-ink-500">Add tent cards or stickers to get started.</div>
        </div>
      ) : (
        <>
          <ul className="max-h-72 overflow-y-auto divide-y divide-ink-100">
            {cartLines.map((l) => (
              <li key={l.product.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
                  {l.product.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-ink-900">{l.product.name}</div>
                  <div className="text-[11px] text-ink-500">
                    {l.size?.label ?? '—'} · {l.qty} × ${l.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div className="font-mono text-[12px] font-bold text-ink-900">${l.total.toFixed(2)}</div>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5 border-t border-ink-100 bg-ink-50/40 p-4 text-[13px]">
            <Row label="Subtotal">${cartTotal.toFixed(2)}</Row>
            <Row label="Shipping">
              {shipping === 0 ? (
                <span className="text-emerald-600">Free</span>
              ) : (
                `$${shipping.toFixed(2)}`
              )}
            </Row>
            <Row label="Tax (5%)">${tax.toFixed(2)}</Row>
            <div className="my-1 border-t border-dashed border-ink-200" />
            <Row label="Total" emphasis>
              ${grandTotal.toFixed(2)}
            </Row>
          </div>
          <div className="border-t border-ink-100 p-4">
            <button
              onClick={onCheckout}
              className="btn-primary shine flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold"
            >
              Checkout
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-500">
              <Lock className="h-3 w-3" />
              Encrypted checkout · ships in 2–4 business days
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700',
      )}
    >
      <span className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</span>
      <span className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</span>
    </div>
  );
}

/* ============================================================ */
/*  Drawers                                                     */
/* ============================================================ */

function QrViewerDrawer({
  entry,
  onClose,
  onChanged,
  onDeleted,
}: {
  entry: QrEntry | null;
  onClose: () => void;
  onChanged: (e: QrEntry) => void;
  onDeleted: (id: string) => void;
}) {
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [analytics, setAnalytics] = useState<QrAnalytics | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setAnalytics(null);
      return;
    }
    let cancelled = false;
    qrApi
      .analytics(entry.id)
      .then((a) => {
        if (!cancelled) setAnalytics(a);
      })
      .catch(() => {
        /* analytics is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry) return <AnimatePresence />;
  const meta = typeMeta[entry.type];

  const downloadSvg = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.label.replace(/\s+/g, '-').toLowerCase()}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<html><head><title>${entry.label}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;}
      h2{margin:16px 0 4px;} p{color:#64748b;font-size:12px;margin:0;}</style></head>
      <body>${xml}<h2>${entry.label}</h2><p>Scan with your camera to view the menu</p>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script></body></html>`);
    w.document.close();
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const regenerate = () =>
    run('regen', async () => {
      const updated = await qrApi.regenerate(entry.id);
      onChanged(updated);
    });

  const toggleStatus = () =>
    run('status', async () => {
      const next = entry.statusCode === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = await qrApi.update(entry.id, { status: next });
      onChanged(updated);
    });

  const remove = () =>
    run('delete', async () => {
      if (!window.confirm(`Delete "${entry.label}"? Its QR will stop resolving.`)) return;
      await qrApi.remove(entry.id);
      onDeleted(entry.id);
    });

  return (
    <AnimatePresence>
      {entry && (
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">QR code</div>
              <div className="mt-1 text-2xl font-extrabold">{entry.label}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">
                  {meta.emoji} {entry.type}
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{entry.branch}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{entry.status}</span>
              </div>
            </div>
            <div className="flex-1 space-y-5 p-6">
              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-b from-white to-brand-50/30">
                <div className="bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-white">
                  <Logo size={28} />
                </div>
                <div ref={qrRef} className="flex items-center justify-center p-6">
                  <div className="rounded-xl border-2 border-ink-100 bg-white p-3">
                    <QRCodeSVG value={entry.url} size={220} level="M" bgColor="#ffffff" fgColor="#0F172A" />
                  </div>
                </div>
                <div className="border-t border-ink-100 p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{entry.label}</div>
                  <div className="mt-0.5 text-[12px] font-medium text-ink-500">Open camera · point at QR</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">Public link</div>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/40 p-1.5 pl-3">
                  <span className="truncate font-mono text-[11px] text-ink-700">{entry.url}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(entry.url)}
                    className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-brand-700"
                    aria-label="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">
                  Performance · last 30 days
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat2 label="Total scans" value={analytics?.totalScans ?? entry.scans} accent="text-amber-600" />
                  <Stat2 label="Orders" value={analytics?.orders ?? entry.ordersCount} accent="text-brand-600" />
                  <Stat2 label="Conv. %" value={analytics?.conversionRate ?? 0} accent="text-emerald-600" />
                </div>
                {analytics && analytics.series.length > 0 && (
                  <div className="mt-3 flex h-16 items-end gap-0.5 rounded-xl border border-ink-100 bg-white p-2">
                    {analytics.series.map((d) => {
                      const max = Math.max(1, ...analytics.series.map((x) => x.scans));
                      return (
                        <div
                          key={d.date}
                          title={`${d.date}: ${d.scans}`}
                          style={{ height: `${Math.max(4, (d.scans / max) * 100)}%` }}
                          className="flex-1 rounded-sm bg-brand-300"
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Manage actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggleStatus}
                  disabled={busy === 'status'}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                >
                  {entry.statusCode === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={regenerate}
                  disabled={busy === 'regen'}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-amber-300 hover:text-amber-700 disabled:opacity-60"
                >
                  {busy === 'regen' ? 'Regenerating…' : 'Regenerate'}
                </button>
                <button
                  onClick={remove}
                  disabled={busy === 'delete'}
                  className="col-span-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  Delete QR code
                </button>
              </div>
            </div>
            <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-ink-100 bg-white p-4">
              <button
                onClick={downloadSvg}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  SVG
                </span>
              </button>
              <button
                onClick={printQr}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </span>
              </button>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Create QR modal                                             */
/* ============================================================ */

function CreateQrModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (e: QrEntry) => void;
}) {
  const branchesState = branchesStore.use();
  const [branchId, setBranchId] = useState('');
  const [qrType, setQrType] = useState<Exclude<QrTypeCode, 'TABLE'>>('COUNTER');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLabel('');
    setQrType('COUNTER');
    setBranchId(branchesStore.get().activeId ?? branchesState.list[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !label.trim()) {
      setError('Pick a branch and enter a label.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await qrApi.create({ branchId, type: qrType, label: label.trim() });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create QR code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <form onSubmit={submit} className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div className="text-lg font-extrabold text-ink-900">New QR code</div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">Branch</div>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  >
                    <option value="" disabled>Select a branch…</option>
                    {branchesState.list.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">Type</div>
                  <select
                    value={qrType}
                    onChange={(e) => setQrType(e.target.value as Exclude<QrTypeCode, 'TABLE'>)}
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  >
                    <option value="COUNTER">Counter</option>
                    <option value="TAKEAWAY">Takeaway</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="MARKETING">Marketing</option>
                  </select>
                  <div className="mt-1 text-[11px] text-ink-500">Table QR codes are auto-created with each table.</div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">Label</div>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Pickup counter"
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  />
                </div>
                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{error}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                <button type="button" onClick={onClose} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60">
                  {busy ? 'Creating…' : 'Create QR code'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat2({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
      <div className={cn('text-2xl font-extrabold', accent)}>
        <Counter value={value} />
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
    </div>
  );
}

function CheckoutDrawer({
  open,
  onClose,
  cartLines,
  cartTotal,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  cartLines: { product: Product; size?: ProductSize; qty: number; unitPrice: number; total: number }[];
  cartTotal: number;
  onConfirm: () => void;
}) {
  const [step, setStep] = useState<'address' | 'pay' | 'success'>('address');
  const [name, setName] = useState('Vuedine Bistro Pvt Ltd');
  const [addr, setAddr] = useState('Carter Road, Bandra W, Mumbai 400050');
  const [coupon, setCoupon] = useState('');

  const shipping = cartTotal > 100 ? 0 : 9.99;
  const tax = cartTotal * 0.05;
  const grandTotal = cartTotal + shipping + tax;

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <header className="relative flex items-center justify-between border-b border-ink-100 bg-white p-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
                  Checkout · {step === 'address' ? '1 of 2' : step === 'pay' ? '2 of 2' : 'Done'}
                </div>
                <div className="text-base font-extrabold text-ink-900">
                  {step === 'success' ? 'Order placed' : 'Ship branded QR codes'}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Steps */}
            {step !== 'success' && (
              <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/40 px-4 py-3">
                {(['address', 'pay'] as const).map((s, i) => {
                  const reached = step === s || (s === 'address' && step === 'pay');
                  return (
                    <div key={s} className="flex flex-1 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                          reached ? 'bg-brand-500 text-white' : 'bg-ink-200 text-ink-500',
                        )}
                      >
                        {step === 'pay' && s === 'address' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          'text-[12px] font-bold',
                          reached ? 'text-ink-900' : 'text-ink-400',
                        )}
                      >
                        {s === 'address' ? 'Shipping' : 'Payment'}
                      </span>
                      {i === 0 && <div className="h-0.5 flex-1 rounded-full bg-ink-200" />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 space-y-5 p-5">
              {step === 'address' && (
                <>
                  <Section title="Ship to">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="vue-input"
                        placeholder="Restaurant name"
                      />
                      <textarea
                        value={addr}
                        onChange={(e) => setAddr(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-900 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                        placeholder="Address"
                      />
                    </div>
                  </Section>

                  <Section title="Promo code">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                          placeholder="WELCOME10"
                          className="vue-input pl-9 uppercase tracking-wider"
                        />
                      </div>
                      <button
                        disabled={!coupon}
                        className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[12px] font-bold text-brand-700 disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  </Section>

                  <Section title="Order recap">
                    <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
                      {cartLines.map((l) => (
                        <li key={l.product.id} className="flex items-center gap-3 p-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
                            {l.product.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-ink-900">{l.product.name}</div>
                            <div className="text-[11px] text-ink-500">
                              {l.size?.label ?? '—'} · {l.qty} × ${l.unitPrice.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-[13px] font-bold text-ink-900">${l.total.toFixed(2)}</div>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                      <Row label="Subtotal">${cartTotal.toFixed(2)}</Row>
                      <Row label="Shipping">
                        {shipping === 0 ? <span className="text-emerald-600">Free</span> : `$${shipping.toFixed(2)}`}
                      </Row>
                      <Row label="Tax (5%)">${tax.toFixed(2)}</Row>
                      <div className="my-1 border-t border-dashed border-ink-200" />
                      <Row label="Total" emphasis>
                        ${grandTotal.toFixed(2)}
                      </Row>
                    </div>
                  </Section>
                </>
              )}

              {step === 'pay' && (
                <>
                  <Section title="Payment method">
                    <div className="space-y-2">
                      {(
                        [
                          { id: 'card', label: 'Credit / debit card', desc: 'Visa · Mastercard · RuPay · Amex', icon: CreditCard, on: true },
                          { id: 'upi', label: 'UPI', desc: 'GPay · PhonePe · Paytm', icon: Box, on: false },
                          { id: 'invoice', label: 'Pay later · invoice', desc: 'Net-30 · Enterprise only', icon: Truck, on: false },
                        ] as const
                      ).map((p) => {
                        const Icon = p.icon;
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-xl border p-3',
                              p.on
                                ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-200'
                                : 'border-ink-200 bg-white',
                            )}
                          >
                            <input type="radio" name="pay" defaultChecked={p.on} className="sr-only" />
                            <span
                              className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-xl ring-1',
                                p.on
                                  ? 'bg-brand-500 text-white ring-brand-500'
                                  : 'bg-ink-50 text-ink-500 ring-ink-100',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-bold text-ink-900">{p.label}</div>
                              <div className="text-[11px] text-ink-500">{p.desc}</div>
                            </div>
                            <span
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full border-2',
                                p.on ? 'border-brand-500' : 'border-ink-300',
                              )}
                            >
                              {p.on && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </Section>

                  <Section title="Card details">
                    <div className="space-y-2">
                      <input className="vue-input" placeholder="Cardholder name" defaultValue={name} />
                      <input className="vue-input" placeholder="1234 5678 9012 3456" />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="vue-input" placeholder="MM / YY" />
                        <input className="vue-input" placeholder="CVC" />
                      </div>
                    </div>
                  </Section>

                  <div className="rounded-xl border border-ink-100 bg-white p-3 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-900">Total to charge</span>
                      <span className="text-base font-extrabold text-brand-600">
                        ${grandTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-ink-500">
                      <Lock className="h-3 w-3" />
                      Encrypted with AES-256 · Vuedine never stores card data.
                    </div>
                  </div>
                </>
              )}

              {step === 'success' && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-8 w-8" />
                  </span>
                  <div className="text-xl font-extrabold text-ink-900">Order placed!</div>
                  <div className="max-w-sm text-[13px] text-ink-600">
                    We're prepping your branded QR codes. They'll ship in 2–4 business days. Order
                    receipt is on the way to your email.
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                    <Truck className="h-3 w-3" />
                    Tracking · ORD-{Math.floor(100000 + Math.random() * 900000)}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-ink-100 bg-white p-4">
              {step === 'address' && (
                <>
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep('pay')}
                    disabled={!name.trim() || !addr.trim()}
                    className="btn-primary shine ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue · ${grandTotal.toFixed(2)}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {step === 'pay' && (
                <>
                  <button
                    onClick={() => setStep('address')}
                    className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('success')}
                    className="btn-primary shine ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Pay ${grandTotal.toFixed(2)}
                  </button>
                </>
              )}
              {step === 'success' && (
                <button
                  onClick={() => {
                    onConfirm();
                    setStep('address');
                  }}
                  className="btn-primary shine w-full rounded-xl px-3 py-2.5 text-sm font-bold"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">{title}</h3>
      {children}
    </section>
  );
}

/* ============================================================ */
/*  Header                                                      */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">QR Codes</span>
    </nav>
  );
}
