import { AnimatePresence, motion } from 'framer-motion';
import {
  AlarmClock,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Eye,
  Maximize,
  Minimize,
  Pause,
  Play,
  Printer,
  QrCode,
  Search,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { liveOrders, useLiveOrders, type LiveOrder, type LiveOrderStatus } from '../../lib/liveOrders';
import { cn } from '../../lib/cn';

/* ============================================================ */
/*  Types                                                       */
/* ============================================================ */

const stageOrder: LiveOrderStatus[] = ['New', 'Accepted', 'Preparing', 'Ready', 'Served'];

const statusMeta: Record<
  LiveOrderStatus,
  { pill: string; dot: string; label: string; cardBg: string; cardBorder: string }
> = {
  New: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    label: 'New',
    cardBg: 'bg-amber-50/60',
    cardBorder: 'border-amber-300',
  },
  Accepted: {
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    label: 'Accepted',
    cardBg: 'bg-blue-50/40',
    cardBorder: 'border-blue-200',
  },
  Preparing: {
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
    label: 'Preparing',
    cardBg: 'bg-violet-50/40',
    cardBorder: 'border-violet-200',
  },
  Ready: {
    pill: 'bg-brand-50 text-brand-700 ring-brand-200',
    dot: 'bg-brand-500',
    label: 'Ready',
    cardBg: 'bg-brand-50/40',
    cardBorder: 'border-brand-200',
  },
  Served: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Served',
    cardBg: 'bg-emerald-50/40',
    cardBorder: 'border-emerald-200',
  },
  Cancelled: {
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    label: 'Cancelled',
    cardBg: 'bg-rose-50/40',
    cardBorder: 'border-rose-200',
  },
};

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function LiveOrdersPage() {
  const orders = useLiveOrders();
  const [, force] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LiveOrderStatus>('All');
  const [autoAccept, setAutoAccept] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drawer, setDrawer] = useState<LiveOrder | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSeenIds = useRef<Set<string>>(new Set(orders.map((o) => o.id)));

  // Re-render every second so age timers stay live
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // Bell sound + auto-accept when a new order comes in
  useEffect(() => {
    const incoming = orders.filter((o) => !lastSeenIds.current.has(o.id));
    if (incoming.length > 0) {
      if (!muted) chime();
      if (autoAccept) {
        incoming.forEach((o) => {
          if (o.status === 'New') liveOrders.setStatus(o.id, 'Accepted');
        });
      }
    }
    lastSeenIds.current = new Set(orders.map((o) => o.id));
  }, [orders, muted, autoAccept]);

  // Fullscreen API
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  /* Filters */
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !o.id.toLowerCase().includes(s) &&
          !o.token.toLowerCase().includes(s) &&
          !o.table.toLowerCase().includes(s) &&
          !(o.guestName ?? '').toLowerCase().includes(s) &&
          !(o.phone ?? '').includes(s)
        )
          return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  /* KPIs */
  const stats = useMemo(() => {
    const total = orders.length;
    const newCount = orders.filter((o) => o.status === 'New').length;
    const cooking = orders.filter((o) => ['Accepted', 'Preparing'].includes(o.status)).length;
    const ready = orders.filter((o) => o.status === 'Ready').length;
    const revenue = orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((s, o) => s + o.total, 0);
    return { total, newCount, cooking, ready, revenue };
  }, [orders]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: orders.length };
    stageOrder.concat(['Cancelled']).forEach((s) => {
      map[s] = orders.filter((o) => o.status === s).length;
    });
    return map;
  }, [orders]);

  return (
    <div ref={containerRef} className="space-y-5">
      <Breadcrumb />

      {/* Hero header */}
      <Hero
        connected={!muted}
        autoAccept={autoAccept}
        muted={muted}
        fullscreen={fullscreen}
        onToggleAutoAccept={() => setAutoAccept((v) => !v)}
        onToggleMuted={() => setMuted((v) => !v)}
        onToggleFullscreen={toggleFullscreen}
        onClear={() => liveOrders.clear()}
        onDemo={() => spawnDemoOrder()}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Live orders" value={stats.total} icon={QrCode} tone="brand" />
        <Kpi label="New" value={stats.newCount} icon={Bell} tone="amber" pulse />
        <Kpi label="In kitchen" value={stats.cooking} icon={ChefHat} tone="violet" />
        <Kpi label="Ready" value={stats.ready} icon={Sparkles} tone="cool" />
        <Kpi label="Revenue" value={stats.revenue} prefix="$" icon={TrendingUp} tone="emerald" />
      </div>

      {/* Status pills */}
      <StatusPills value={statusFilter} onChange={setStatusFilter} counts={counts} />

      {/* Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder="Search by token, table, name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>
        <div className="text-[11px] font-bold text-ink-500">
          Last update: <span className="font-mono text-ink-900">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Body */}
      {orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((o, i) => (
              <OrderCard
                key={o.id}
                order={o}
                index={i}
                onView={() => setDrawer(o)}
                onAdvance={() => advance(o)}
                onCancel={() => liveOrders.setStatus(o.id, 'Cancelled')}
                onRemove={() => liveOrders.remove(o.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <OrderDrawer order={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function advance(o: LiveOrder) {
  const idx = stageOrder.indexOf(o.status as LiveOrderStatus);
  if (idx >= 0 && idx < stageOrder.length - 1) {
    liveOrders.setStatus(o.id, stageOrder[idx + 1]);
  }
}

/* ============================================================ */
/*  Hero                                                        */
/* ============================================================ */

function Hero({
  connected,
  autoAccept,
  muted,
  fullscreen,
  onToggleAutoAccept,
  onToggleMuted,
  onToggleFullscreen,
  onClear,
  onDemo,
}: {
  connected: boolean;
  autoAccept: boolean;
  muted: boolean;
  fullscreen: boolean;
  onToggleAutoAccept: () => void;
  onToggleMuted: () => void;
  onToggleFullscreen: () => void;
  onClear: () => void;
  onDemo: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50 p-5 shadow-sm sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-brand-200/60 to-warm-200/60 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-700">
              <QrCode className="h-3 w-3" />
              QR live feed
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                connected
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-rose-50 text-rose-700 ring-rose-200',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  connected ? 'animate-pulse bg-emerald-500' : 'bg-rose-500',
                )}
              />
              {connected ? 'Live' : 'Muted'}
            </span>
          </div>
          <h1 className="display mt-2 text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">
            Live orders from the <span className="gradient-text-warm">QR menu</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-600">
            Every time a guest taps "Place order" on their phone, it appears here within a second.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            on={autoAccept}
            onClick={onToggleAutoAccept}
            icon={autoAccept ? Play : Pause}
            label={autoAccept ? 'Auto-accept on' : 'Auto-accept off'}
          />
          <Toggle
            on={!muted}
            onClick={onToggleMuted}
            icon={muted ? VolumeX : Volume2}
            label={muted ? 'Sound off' : 'Sound on'}
            tone={muted ? 'rose' : undefined}
          />
          <button
            onClick={onToggleFullscreen}
            aria-label="Toggle fullscreen"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 sm:inline-flex"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <button
            onClick={onDemo}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-[12px] font-bold text-brand-700 shadow-sm transition hover:bg-brand-500 hover:text-white hover:border-brand-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Spawn demo order
          </button>
          <button
            onClick={onClear}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[12px] font-bold text-ink-700 shadow-sm transition hover:border-rose-200 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}

function Toggle({
  on,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  tone?: 'rose';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold shadow-sm transition',
        on
          ? 'border-brand-500 bg-brand-50 text-brand-700 hover:bg-brand-100'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
            : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ============================================================ */
/*  KPI                                                         */
/* ============================================================ */

const tones = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  cool: { bg: 'bg-cool-50', text: 'text-cool-600', ring: 'ring-cool-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
} as const;

function Kpi({
  label,
  value,
  prefix,
  tone,
  icon: Icon,
  pulse,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone: keyof typeof tones;
  icon: React.ElementType;
  pulse?: boolean;
}) {
  const t = tones[tone];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-xl ring-1',
            t.bg,
            t.ring,
          )}
        >
          <Icon className={cn('h-4 w-4', t.text)} />
          {pulse && value > 0 && (
            <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
          <div className="text-2xl font-extrabold text-ink-900">
            <Counter value={value} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Status pills                                                */
/* ============================================================ */

function StatusPills({
  value,
  onChange,
  counts,
}: {
  value: 'All' | LiveOrderStatus;
  onChange: (v: 'All' | LiveOrderStatus) => void;
  counts: Record<string, number>;
}) {
  const list: ('All' | LiveOrderStatus)[] = ['All', ...stageOrder, 'Cancelled'];
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {list.map((s) => {
        const active = value === s;
        const meta = s === 'All' ? null : statusMeta[s];
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
            )}
          >
            {meta && <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : meta.dot)} />}
            {s}
            <span
              className={cn(
                'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
              )}
            >
              {counts[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Order card                                                  */
/* ============================================================ */

function OrderCard({
  order,
  index,
  onView,
  onAdvance,
  onCancel,
  onRemove,
}: {
  order: LiveOrder;
  index: number;
  onView: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const meta = statusMeta[order.status];
  const ageMin = Math.max(0, Math.floor((Date.now() - order.receivedAt) / 60_000));
  const ageSec = Math.max(0, Math.floor((Date.now() - order.receivedAt) / 1_000));
  const isFresh = ageSec < 30;
  const isLate = ageMin > 12;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        boxShadow: isFresh ? '0 10px 30px -10px rgba(236,27,124,0.4)' : '0 1px 2px rgba(15,23,42,0.05)',
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition',
        meta.cardBorder,
      )}
    >
      {/* Status strip */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', meta.dot)} />

      {/* Late badge */}
      {isLate && order.status !== 'Served' && order.status !== 'Cancelled' && (
        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-rose-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
          <AlarmClock className="h-2.5 w-2.5" />
          Late
        </div>
      )}

      {/* Fresh pulse for new orders */}
      {isFresh && order.status === 'New' && (
        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          New
        </div>
      )}

      <div className={cn('px-4 pb-3 pt-3 pl-5', meta.cardBg)}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-base font-extrabold text-ink-900">{order.token}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {order.table} · #{order.id}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ring-1',
                isLate
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : ageMin > 6
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
              )}
            >
              <Clock className="h-3 w-3" />
              {ageMin}m
            </div>
            {order.guestName && (
              <div className="mt-1 max-w-[120px] truncate text-[10px] font-bold text-ink-600">
                {order.guestName}
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <ul className="mt-3 space-y-1 text-[12px] text-ink-700">
          {order.items.slice(0, 4).map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="text-base">{it.emoji}</span>
                <span className="truncate font-bold text-ink-900">
                  {it.qty}× {it.name}
                </span>
              </span>
              <span className="font-mono text-[11px] font-bold text-ink-700">
                ${(it.qty * it.unitPrice).toFixed(2)}
              </span>
            </li>
          ))}
          {order.items.length > 4 && (
            <li className="text-[11px] font-bold text-ink-500">
              + {order.items.length - 4} more items
            </li>
          )}
        </ul>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Total</div>
            <div className="text-base font-extrabold text-brand-600">${order.total.toFixed(2)}</div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
              meta.pill,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
            {meta.label}
          </span>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-1.5">
          <button
            onClick={onView}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          {order.status === 'Served' || order.status === 'Cancelled' ? (
            <button
              onClick={onRemove}
              className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 text-[11px] font-bold text-ink-500 hover:border-rose-200 hover:text-rose-600"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 text-[11px] font-bold text-ink-500 hover:border-rose-200 hover:text-rose-600"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={onAdvance}
                className={cn(
                  'ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[11px] font-bold text-white transition shadow-sm',
                  order.status === 'New'
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'
                    : order.status === 'Accepted'
                      ? 'bg-violet-500 hover:bg-violet-600 shadow-violet-500/30'
                      : order.status === 'Preparing'
                        ? 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30',
                )}
              >
                {order.status === 'New' && (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                    Accept
                  </>
                )}
                {order.status === 'Accepted' && (
                  <>
                    <ChefHat className="h-3 w-3" />
                    Send to kitchen
                  </>
                )}
                {order.status === 'Preparing' && (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Mark ready
                  </>
                )}
                {order.status === 'Ready' && (
                  <>
                    <Sun className="h-3 w-3" />
                    Mark served
                  </>
                )}
                <ArrowRight className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ============================================================ */
/*  Empty state                                                 */
/* ============================================================ */

function EmptyState() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-200 bg-gradient-to-br from-white to-brand-50/40 p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-brand-100">
        <QrCode className="h-7 w-7 text-brand-500" />
      </div>
      <div className="mt-4 text-lg font-extrabold text-ink-900">No live orders yet</div>
      <div className="mx-auto mt-1 max-w-md text-[13px] text-ink-600">
        When a guest scans a table QR and places an order, it'll appear here in real time. Try it
        yourself: open <span className="font-mono font-bold text-brand-700">/m/bandra/T-7</span> in
        another tab.
      </div>
      <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/m/bandra/T-7"
          target="_blank"
          rel="noreferrer"
          className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Open guest menu
        </Link>
        <button
          onClick={spawnDemoOrder}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Spawn demo order
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function OrderDrawer({ order, onClose }: { order: LiveOrder | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {order && (
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
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">QR order</div>
              <div className="mt-1 font-mono text-2xl font-extrabold">{order.token}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.table}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">via QR</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.payMode === 'pay-at-counter' ? 'Pay at counter' : order.payMode === 'pay-now-upi' ? 'Paid · UPI' : 'Paid · Card'}</span>
              </div>
              {order.guestName && (
                <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/85">
                  <span className="font-bold">{order.guestName}</span>
                  {order.phone && <span>· {order.phone}</span>}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-5 p-6">
              {/* Timeline */}
              <Section title="Order timeline">
                <div className="rounded-xl border border-ink-100 bg-white p-3">
                  <ul className="relative space-y-3">
                    <span className="absolute left-2.5 top-3 h-[calc(100%-1.5rem)] w-0.5 bg-ink-100" />
                    {stageOrder.map((s, i) => {
                      const cur = stageOrder.indexOf(order.status as LiveOrderStatus);
                      const reached = i <= cur;
                      const isCurrent = i === cur;
                      return (
                        <li key={s} className="relative flex items-center gap-3 pl-1">
                          <span
                            className={cn(
                              'relative z-10 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white',
                              reached ? 'bg-brand-500' : 'bg-ink-200',
                            )}
                          >
                            {isCurrent && (
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-50" />
                            )}
                          </span>
                          <span
                            className={cn(
                              'text-[13px]',
                              reached ? 'font-bold text-ink-900' : 'font-medium text-ink-400',
                            )}
                          >
                            {s}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Section>

              {/* Items */}
              <Section title={`Items · ${order.items.length}`}>
                <ul className="space-y-2">
                  {order.items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between rounded-xl border border-ink-100 bg-white p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
                          {it.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-ink-900">
                            {it.qty}× {it.name}
                          </div>
                          {(it.variantLabel || (it.addons && it.addons.length > 0)) && (
                            <div className="text-[11px] text-ink-500">
                              {it.variantLabel}
                              {it.addons && it.addons.length > 0 &&
                                ` · ${it.addons.join(', ')}`}
                            </div>
                          )}
                          {it.notes && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              📝 {it.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[13px] font-bold text-ink-900">
                          ${(it.qty * it.unitPrice).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-ink-400">${it.unitPrice.toFixed(2)} ea</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Totals */}
              <Section title="Bill">
                <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                  <Line label="Subtotal">${order.subtotal.toFixed(2)}</Line>
                  <Line label="Tax">${order.tax.toFixed(2)}</Line>
                  <Line label="Service charge">${order.service.toFixed(2)}</Line>
                  {order.tip > 0 && <Line label="Tip">${order.tip.toFixed(2)}</Line>}
                  <div className="my-1 border-t border-dashed border-ink-200" />
                  <Line label="Total" emphasis>
                    ${order.total.toFixed(2)}
                  </Line>
                </div>
              </Section>
            </div>

            <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-ink-100 bg-white p-4">
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  KOT
                </span>
              </button>
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Settle
                </span>
              </button>
              <button
                onClick={() => {
                  advance(order);
                  onClose();
                }}
                className="btn-primary shine rounded-xl px-3 py-2.5 text-sm font-bold"
              >
                Advance
              </button>
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

function Line({
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
/*  Demo helpers                                                */
/* ============================================================ */

async function spawnDemoOrder() {
  // Demo button — places a real order via the orders API. Branch comes from
  // the active branch in the store; if not set, this is a no-op.
  const { branchesStore } = await import('../../stores/branches');
  const { ordersApi } = await import('../../services/orders');
  const active = branchesStore.getActive();
  if (!active) return;

  const dishes = [
    { name: 'Margherita', emoji: '🍕', unitPrice: 4.5, category: 'Pizza' },
    { name: 'Truffle Burger', emoji: '🍔', unitPrice: 5.9, category: 'Burgers' },
    { name: 'Caesar Salad', emoji: '🥗', unitPrice: 3.3, category: 'Salads' },
    { name: 'Sushi Set', emoji: '🍣', unitPrice: 7.5, category: 'Sushi' },
    { name: 'Mojito', emoji: '🍹', unitPrice: 4.0, category: 'Cocktails' },
    { name: 'Butter Chicken', emoji: '🍛', unitPrice: 5.0, category: 'Indian' },
    { name: 'Brownie', emoji: '🍫', unitPrice: 1.8, category: 'Desserts' },
  ];
  const pickedCount = 2 + Math.floor(Math.random() * 3);
  const lines = Array.from({ length: pickedCount }).map(() => {
    const d = dishes[Math.floor(Math.random() * dishes.length)];
    return { ...d, qty: 1 + Math.floor(Math.random() * 2) };
  });

  try {
    await ordersApi.create({
      branchId: active.id,
      type: 'DINE_IN',
      channel: 'QR',
      source: 'QR',
      tableLabel: ['T-1', 'T-3', 'T-7', 'T-9', 'T-12', 'T-14'][Math.floor(Math.random() * 6)],
      guestName: ['Aarav Mehta', 'Priya Iyer', null, 'Walking customer', 'Rohit S.'][
        Math.floor(Math.random() * 5)
      ] as string | null,
      lines: lines.map((l) => ({
        itemName: l.name,
        emoji: l.emoji,
        qty: l.qty,
        unitPrice: l.unitPrice,
        category: l.category,
      })),
    });
  } catch {
    // Silent failure; the user can retry — real errors surface in the page error state.
  }
}

function chime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch {
    // ignore — autoplay or context errors are fine
  }
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
      <span className="text-ink-900">Live Orders</span>
    </nav>
  );
}
