import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  Filter,
  IndianRupee,
  MapPin,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  Timer,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { ordersApi, type Order as ApiOrder } from '../../services/orders';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type Source = 'Zomato' | 'Swiggy' | 'Vuedine Direct' | 'WhatsApp' | 'QR Pay';
type Mode = 'Delivery' | 'Pickup';
type Status =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';
type PayStatus = 'Paid' | 'Pay on delivery' | 'Failed' | 'Refunded';

type OnlineOrder = {
  id: string;
  serverId?: string;
  source: Source;
  mode: Mode;
  customer: string;
  phone: string;
  address: string;
  area: string;
  amount: number;
  date: string;
  iso: string;
  status: Status;
  pay: PayStatus;
  prepMinutes: number; // prep time
  etaMinutes: number; // remaining ETA when out
  driver?: string;
  driverPhone?: string;
  items: number;
  isLate?: boolean;
};

const SERVER_SOURCE_TO_LOCAL: Record<string, Source> = {
  ZOMATO: 'Zomato',
  SWIGGY: 'Swiggy',
  VUEDINE_DIRECT: 'Vuedine Direct',
  WHATSAPP: 'WhatsApp',
  QR_PAY: 'QR Pay',
  QR: 'Vuedine Direct',
  POS: 'Vuedine Direct',
  WAITER: 'Vuedine Direct',
};
const SERVER_STATUS_TO_LOCAL: Record<string, Status> = {
  PENDING: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  SERVED: 'Delivered',
  CANCELLED: 'Cancelled',
};
const SERVER_PAY_TO_LOCAL: Record<string, PayStatus> = {
  PAID: 'Paid',
  UNPAID: 'Pay on delivery',
  PARTIAL: 'Pay on delivery',
  REFUNDED: 'Refunded',
};

function adaptServerOrder(o: ApiOrder): OnlineOrder {
  const dt = new Date(o.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: o.serial,
    serverId: o.id,
    source: SERVER_SOURCE_TO_LOCAL[o.source] ?? 'Vuedine Direct',
    mode: o.type === 'DELIVERY' ? 'Delivery' : 'Pickup',
    customer: o.guestName ?? 'Walking customer',
    phone: o.guestPhone ?? '—',
    address: o.deliveryAddress ?? (o.type === 'DELIVERY' ? 'Address pending' : 'Self pickup'),
    area: o.deliveryAddress ? '—' : 'In-store · 0 km',
    amount: o.grandTotal,
    date: `${pad(dt.getHours())}:${pad(dt.getMinutes())}, ${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`,
    iso: dt.toISOString(),
    status: SERVER_STATUS_TO_LOCAL[o.status] ?? 'New',
    pay: SERVER_PAY_TO_LOCAL[o.paymentStatus] ?? 'Pay on delivery',
    prepMinutes: 0,
    etaMinutes: o.etaMinutes ?? 0,
    driver: o.driverName ?? undefined,
    driverPhone: o.driverPhone ?? undefined,
    items: o.items.length,
  };
}

const _MOCK_ORDERS_REMOVED: OnlineOrder[] = [];
void _MOCK_ORDERS_REMOVED;

const sources: Source[] = ['Zomato', 'Swiggy', 'Vuedine Direct', 'WhatsApp', 'QR Pay'];
const statusOrder: Status[] = ['New', 'Accepted', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function OnlineOrders() {
  const branches = branchesStore.use();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [, setLoading] = useState(false);
  const [, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'All' | Source>('All');
  const [mode, setMode] = useState<'All' | Mode>('All');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [pay, setPay] = useState<'All' | PayStatus>('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [drawerOrder, setDrawerOrder] = useState<OnlineOrder | null>(null);

  // Fetch online orders (channel=ONLINE) for the active branch.
  useEffect(() => {
    if (!branches.activeId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    ordersApi
      .list({ branchId: branches.activeId, channel: 'ONLINE', pageSize: 100 })
      .then((rows) => setOrders(rows.map(adaptServerOrder)))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, [branches.activeId]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (search) {
        const s = search.toLowerCase();
        if (!o.id.toLowerCase().includes(s) && !o.customer.toLowerCase().includes(s) && !o.phone.includes(s))
          return false;
      }
      if (source !== 'All' && o.source !== source) return false;
      if (mode !== 'All' && o.mode !== mode) return false;
      if (status !== 'All' && o.status !== status) return false;
      if (pay !== 'All' && o.pay !== pay) return false;
      return true;
    });
  }, [search, source, mode, status, pay, orders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const totals = useMemo(() => {
    const revenue = orders.reduce((s, o) => (o.status !== 'Cancelled' ? s + o.amount : s), 0);
    const out = orders.filter((o) => o.status === 'Out for Delivery').length;
    const breach = orders.filter((o) => o.isLate).length;
    const avgPrep = Math.round(
      orders.filter((o) => o.prepMinutes > 0).reduce((s, o) => s + o.prepMinutes, 0) /
        Math.max(1, orders.filter((o) => o.prepMinutes > 0).length),
    );
    return { revenue, out, breach, avgPrep };
  }, [orders]);

  const sourceCounts = useMemo(() => {
    const map: Record<string, number> = { All: orders.length };
    sources.forEach((s) => {
      map[s] = orders.filter((o) => o.source === s).length;
    });
    return map;
  }, [orders]);

  const clearFilters = () => {
    setSearch('');
    setSource('All');
    setMode('All');
    setStatus('All');
    setPay('All');
    setPage(1);
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(source !== 'All') +
    Number(mode !== 'All') +
    Number(status !== 'All') +
    Number(pay !== 'All');

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Online revenue" value={totals.revenue} prefix="$" tone="brand" icon={IndianRupee} />
          <Kpi label="Out for delivery" value={totals.out} tone="cool" icon={Truck} />
          <Kpi label="ETA breach" value={totals.breach} tone="rose" icon={AlertTriangle} />
          <Kpi label="Avg prep time" value={totals.avgPrep} suffix="m" tone="amber" icon={Timer} />
        </div>

        {/* Source quick filter */}
        <SourceStrip value={source} onChange={(v) => { setSource(v); setPage(1); }} counts={sourceCounts} />

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Online Orders</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {filtered.length}
              </span>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-600"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Clear · {activeFilters}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
              <ModeToggle value={mode} onChange={(v) => { setMode(v); setPage(1); }} />
              <FilterMenu
                pay={pay}
                setPay={(v) => { setPay(v); setPage(1); }}
                status={status}
                setStatus={(v) => { setStatus(v); setPage(1); }}
              />
              <ExportMenu />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100">
              <thead>
                <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  <Th>Order</Th>
                  <Th>Source · mode</Th>
                  <Th>Customer</Th>
                  <Th>Address</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>ETA</Th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-sm">
                {visible.map((o, i) => (
                  <Row key={o.id} order={o} index={i} onView={() => setDrawerOrder(o)} />
                ))}
                {visible.length === 0 && <EmptyState onReset={clearFilters} />}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
            <div className="text-[12px] font-medium text-ink-500">
              Showing <span className="font-bold text-ink-900">{filtered.length === 0 ? 0 : start + 1}</span> to{' '}
              <span className="font-bold text-ink-900">{Math.min(start + pageSize, filtered.length)}</span> of{' '}
              <span className="font-bold text-ink-900">{filtered.length}</span> orders
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      <OrderDrawer order={drawerOrder} onClose={() => setDrawerOrder(null)} />
    </>
  );
}

/* ============================================================ */
/*  KPI                                                         */
/* ============================================================ */

const tones = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  cool: { bg: 'bg-cool-50', text: 'text-cool-600', ring: 'ring-cool-100' },
} as const;

function Kpi({
  label,
  value,
  prefix,
  suffix,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  tone: keyof typeof tones;
  icon: React.ElementType;
}) {
  const t = tones[tone];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', t.bg, t.ring)}>
          <Icon className={cn('h-4 w-4', t.text)} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
          <div className="text-2xl font-extrabold text-ink-900">
            <Counter value={value} prefix={prefix} suffix={suffix} decimals={prefix === '$' ? 2 : 0} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Source strip (logos)                                        */
/* ============================================================ */

const sourceMeta: Record<Source, { color: string; bg: string; ring: string; emoji: string }> = {
  Zomato: { color: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-200', emoji: '🍴' },
  Swiggy: { color: 'text-warm-700', bg: 'bg-warm-50', ring: 'ring-warm-200', emoji: '🛵' },
  'Vuedine Direct': { color: 'text-brand-700', bg: 'bg-brand-50', ring: 'ring-brand-200', emoji: '🍽️' },
  WhatsApp: { color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', emoji: '💬' },
  'QR Pay': { color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200', emoji: '⌗' },
};

function SourceStrip({
  value,
  onChange,
  counts,
}: {
  value: 'All' | Source;
  onChange: (v: 'All' | Source) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <SourceChip
        active={value === 'All'}
        label="All sources"
        emoji="✨"
        count={counts.All}
        onClick={() => onChange('All')}
      />
      {sources.map((s) => {
        const meta = sourceMeta[s];
        return (
          <SourceChip
            key={s}
            active={value === s}
            label={s}
            emoji={meta.emoji}
            count={counts[s]}
            onClick={() => onChange(s)}
            tone={meta}
          />
        );
      })}
    </div>
  );
}

function SourceChip({
  active,
  label,
  emoji,
  count,
  onClick,
  tone,
}: {
  active: boolean;
  label: string;
  emoji: string;
  count: number;
  onClick: () => void;
  tone?: { bg: string; ring: string; color: string };
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
        active
          ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
          active ? 'bg-white/20' : tone ? cn(tone.bg, tone.color) : 'bg-ink-100 text-ink-500',
        )}
      >
        {emoji}
      </span>
      {label}
      <span
        className={cn(
          'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
          active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* ============================================================ */
/*  Row                                                         */
/* ============================================================ */

function Row({
  order,
  index,
  onView,
}: {
  order: OnlineOrder;
  index: number;
  onView: () => void;
}) {
  const meta = sourceMeta[order.source];

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className="group cursor-pointer transition-colors hover:bg-ink-50/60"
      onClick={onView}
    >
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">#{order.id}</div>
        <div className="mt-0.5 text-[11px] font-medium text-ink-500">{order.date.split(',')[0]}</div>
      </td>
      <td className="px-5 py-3">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', meta.bg, meta.ring, meta.color)}>
          <span>{meta.emoji}</span>
          {order.source}
        </span>
        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-ink-500">
          {order.mode === 'Delivery' ? <Truck className="h-3 w-3" /> : <span>📍</span>}
          {order.mode}
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm', avatarGradient(order.customer))}>
            {initials(order.customer)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink-900">{order.customer}</div>
            <div className="text-[11px] font-medium text-ink-500">{order.phone}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="inline-flex items-start gap-1.5 text-[12px]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink-700" style={{ maxWidth: 220 }}>
              {order.address}
            </div>
            <div className="text-[10px] font-bold text-ink-400">{order.area}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">${order.amount.toFixed(2)}</div>
        <PayBadge pay={order.pay} />
      </td>
      <td className="px-5 py-3">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-5 py-3">
        <EtaCell order={order} />
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="View" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="emerald" label="Print KOT">
            <Printer className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="rose" label="Cancel">
            <X className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </motion.tr>
  );
}

function avatarGradient(name: string) {
  const palette = [
    'from-brand-500 via-rose-500 to-warm-500',
    'from-warm-500 via-amber-500 to-brand-500',
    'from-cool-500 via-emerald-500 to-brand-500',
    'from-violet-500 via-pink-500 to-brand-500',
    'from-blue-500 via-cool-500 to-brand-500',
    'from-rose-500 via-brand-500 to-warm-500',
  ];
  const idx = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return palette[idx];
}
function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const statusMeta: Record<Status, { pill: string; dot: string }> = {
  New: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  Accepted: { pill: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  Preparing: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  Ready: { pill: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500' },
  'Out for Delivery': { pill: 'bg-cool-50 text-cool-700 ring-cool-200', dot: 'bg-cool-500' },
  Delivered: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Cancelled: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', meta.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

const payMeta: Record<PayStatus, string> = {
  Paid: 'text-emerald-600',
  'Pay on delivery': 'text-amber-600',
  Failed: 'text-rose-600',
  Refunded: 'text-violet-600',
};

function PayBadge({ pay }: { pay: PayStatus }) {
  return <div className={cn('text-[10px] font-bold', payMeta[pay])}>{pay}</div>;
}

function EtaCell({ order }: { order: OnlineOrder }) {
  if (order.status === 'Delivered' || order.status === 'Cancelled') {
    return <span className="text-[12px] text-ink-400">—</span>;
  }
  if (order.status === 'Ready' && order.mode === 'Pickup') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
        </span>
        Awaiting pickup
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 text-[12px] font-bold">
      <Clock className={cn('h-3.5 w-3.5', order.isLate ? 'text-rose-500' : 'text-cool-600')} />
      <span className={cn(order.isLate ? 'text-rose-600' : 'text-ink-700')}>
        {order.etaMinutes}m
      </span>
      {order.isLate && (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="h-2.5 w-2.5" />
          Late
        </span>
      )}
    </div>
  );
}

function ActionButton({
  tone,
  label,
  children,
  onClick,
}: {
  tone: 'brand' | 'emerald' | 'rose';
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
        : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition', cls)}
    >
      {children}
    </button>
  );
}

/* ============================================================ */
/*  Header controls                                             */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">Online Orders</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by order, name, phone…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function ModeToggle({ value, onChange }: { value: 'All' | Mode; onChange: (v: 'All' | Mode) => void }) {
  const opts: ('All' | Mode)[] = ['All', 'Delivery', 'Pickup'];
  return (
    <div className="relative inline-flex h-9 items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      {opts.map((v) => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'relative inline-flex items-center rounded-lg px-2.5 py-1 text-[12px] font-bold transition',
              active ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {active && (
              <motion.span
                layoutId="online-mode-toggle"
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative">{v}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterMenu({
  pay,
  setPay,
  status,
  setStatus,
}: {
  pay: 'All' | PayStatus;
  setPay: (v: 'All' | PayStatus) => void;
  status: 'All' | Status;
  setStatus: (v: 'All' | Status) => void;
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-72 space-y-3 p-2">
          <div>
            <DropHeader>Status</DropHeader>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['All', ...statusOrder] as const).map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <DropHeader>Payment</DropHeader>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(['All', 'Paid', 'Pay on delivery', 'Failed', 'Refunded'] as const).map((p) => (
                <FilterChip key={p} active={pay === p} onClick={() => setPay(p)}>
                  {p}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
      )}
    >
      {children}
    </button>
  );
}

function ExportMenu() {
  return (
    <Dropdown label="Export" icon={<Download className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Export as</DropHeader>
          {['CSV', 'Excel (.xlsx)', 'PDF', 'Print receipts'].map((t) => (
            <DropItem key={t} onClick={close}>
              {t}
            </DropItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function Dropdown({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        {icon}
        {label}
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
              className="absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-black/10"
            >
              {children(() => setOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">
      {children}
    </div>
  );
}

function DropItem({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-ink-700 transition hover:bg-ink-50"
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <tr>
      <td colSpan={8} className="px-5 py-16 text-center">
        <div className="text-base font-bold text-ink-700">No online orders match</div>
        <div className="mt-1 text-sm text-ink-500">Try clearing filters or wait for the next order.</div>
        <button
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
        >
          <RefreshCcw className="h-3 w-3" />
          Reset filters
        </button>
      </td>
    </tr>
  );
}

/* ============================================================ */
/*  Pagination                                                  */
/* ============================================================ */

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (n: number) => void;
}) {
  const pages: (number | 'ellipsis')[] = useMemo(() => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const arr: (number | 'ellipsis')[] = [1];
    if (current > 3) arr.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) arr.push(i);
    if (current < total - 2) arr.push('ellipsis');
    arr.push(total);
    return arr;
  }, [current, total]);

  const btn = 'inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border text-[12px] font-bold transition';

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        aria-label="Previous"
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40')}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1 text-ink-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(btn, p === current ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30' : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700')}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        aria-label="Next"
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40')}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Order detail drawer (with mini map + delivery timeline)     */
/* ============================================================ */

function OrderDrawer({ order, onClose }: { order: OnlineOrder | null; onClose: () => void }) {
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
            {/* Header */}
            <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                Online order
              </div>
              <div className="mt-1 font-mono text-2xl font-extrabold">#{order.id}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.source}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.mode}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.items} items</span>
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              {/* Mini map */}
              {order.mode === 'Delivery' && <MiniMap order={order} />}

              {/* Driver / pickup */}
              {order.mode === 'Delivery' && order.driver && (
                <Section title="Delivery agent">
                  <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cool-500 via-blue-500 to-brand-500 text-sm font-bold text-white">
                      {initials(order.driver)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink-900">{order.driver}</div>
                      <div className="text-[12px] text-ink-500">{order.driverPhone}</div>
                    </div>
                    <a
                      href={`tel:${order.driverPhone}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cool-200 bg-cool-50 text-cool-600 hover:bg-cool-500 hover:text-white"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </Section>
              )}

              {/* Customer */}
              <Section title="Customer">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', avatarGradient(order.customer))}>
                      {initials(order.customer)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-ink-900">{order.customer}</div>
                      <div className="text-[12px] text-ink-500">{order.phone}</div>
                    </div>
                    <a
                      href={`tel:${order.phone}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                      <MapPin className="h-4 w-4 text-brand-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-ink-900">{order.address}</div>
                      <div className="text-[12px] text-ink-500">{order.area}</div>
                    </div>
                    <button
                      aria-label="Copy address"
                      title="Copy address"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Section>

              {/* Items */}
              <Section title={`Items · ${order.items}`}>
                <ul className="space-y-2 text-sm">
                  {mockItems(order).map((it, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
                          {it.emoji}
                        </span>
                        <div>
                          <div className="font-bold text-ink-900">
                            {it.qty}× {it.name}
                          </div>
                          <div className="text-[11px] text-ink-500">${it.price.toFixed(2)} ea</div>
                        </div>
                      </div>
                      <div className="font-bold text-ink-900">${(it.qty * it.price).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Totals */}
              <Section title="Payment">
                <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                  <Line label="Subtotal">${(order.amount * 0.86).toFixed(2)}</Line>
                  <Line label="Delivery fee">${(order.amount * 0.06).toFixed(2)}</Line>
                  <Line label="Tax (5%)">${(order.amount * 0.05).toFixed(2)}</Line>
                  <Line label="Platform fee">${(order.amount * 0.03).toFixed(2)}</Line>
                  <div className="my-1 border-t border-dashed border-ink-200" />
                  <Line label="Total" emphasis>
                    ${order.amount.toFixed(2)}
                  </Line>
                </div>
                <div
                  className={cn(
                    'mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-bold ring-1',
                    order.pay === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : order.pay === 'Refunded'
                        ? 'bg-violet-50 text-violet-700 ring-violet-200'
                        : 'bg-amber-50 text-amber-700 ring-amber-200',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', order.pay === 'Paid' ? 'bg-emerald-500' : order.pay === 'Refunded' ? 'bg-violet-500' : 'bg-amber-500')} />
                  {order.pay}
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
                  <Truck className="h-3.5 w-3.5" />
                  Assign
                </span>
              </button>
              <button className="btn-primary shine rounded-xl px-3 py-2.5 text-sm font-bold">
                Update status
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

function Line({ label, emphasis, children }: { label: string; emphasis?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between', emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700')}>
      <span className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</span>
      <span className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</span>
    </div>
  );
}

function MiniMap({ order }: { order: OnlineOrder }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-100">
      {/* Stylized map background */}
      <div className="relative aspect-[16/8] bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50">
        <svg viewBox="0 0 320 160" className="absolute inset-0 h-full w-full">
          {/* Roads */}
          <line x1="0" y1="100" x2="320" y2="100" stroke="#FECDD3" strokeWidth="6" />
          <line x1="0" y1="60" x2="320" y2="60" stroke="#FED7AA" strokeWidth="4" />
          <line x1="120" y1="0" x2="120" y2="160" stroke="#FECDD3" strokeWidth="6" />
          <line x1="220" y1="0" x2="220" y2="160" stroke="#FED7AA" strokeWidth="4" />
          {/* Dashed route */}
          <motion.path
            d="M40,120 C100,80 180,140 260,40"
            fill="none"
            stroke="#EC1B7C"
            strokeWidth="2.5"
            strokeDasharray="5 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
          />
          {/* Restaurant pin */}
          <circle cx="40" cy="120" r="6" fill="#fff" stroke="#EC1B7C" strokeWidth="3" />
          {/* Driver pulse */}
          <motion.circle
            cx="160"
            cy="80"
            r="6"
            fill="#06B6D4"
            stroke="#fff"
            strokeWidth="2"
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Customer pin */}
          <circle cx="260" cy="40" r="7" fill="#EC1B7C" stroke="#fff" strokeWidth="3" />
        </svg>

        {/* ETA badge */}
        <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink-900 shadow-md ring-1 ring-ink-200">
          <Clock className={cn('h-3 w-3', order.isLate ? 'text-rose-500' : 'text-brand-500')} />
          {order.status === 'Delivered' ? 'Delivered' : `${order.etaMinutes}m ETA`}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-ink-100 bg-white text-center text-[11px]">
        <div className="p-2">
          <div className="font-bold uppercase tracking-wider text-ink-500">From</div>
          <div className="mt-0.5 truncate font-bold text-ink-900">Vuedine · Bandra</div>
        </div>
        <div className="p-2">
          <div className="font-bold uppercase tracking-wider text-ink-500">Distance</div>
          <div className="mt-0.5 truncate font-bold text-ink-900">{order.area.split('·')[1]?.trim() ?? '—'}</div>
        </div>
        <div className="p-2">
          <div className="font-bold uppercase tracking-wider text-ink-500">Status</div>
          <div className={cn('mt-0.5 truncate font-bold', order.isLate ? 'text-rose-600' : 'text-emerald-600')}>
            {order.isLate ? 'Late' : 'On track'}
          </div>
        </div>
      </div>
    </div>
  );
}

function mockItems(order: OnlineOrder) {
  const pool = [
    { name: 'Margherita', emoji: '🍕', price: 4.5 },
    { name: 'Truffle Burger', emoji: '🍔', price: 5.9 },
    { name: 'Caesar Salad', emoji: '🥗', price: 3.3 },
    { name: 'Sushi Set', emoji: '🍣', price: 7.5 },
    { name: 'Iced Latte', emoji: '🧊', price: 1.5 },
    { name: 'Tiramisu', emoji: '🍰', price: 2.5 },
    { name: 'Garlic Naan', emoji: '🫓', price: 1.2 },
    { name: 'Pad Thai', emoji: '🍜', price: 4.0 },
  ];
  const seed = Array.from(order.id).reduce((s, c) => s + c.charCodeAt(0), 0);
  const list: { name: string; emoji: string; price: number; qty: number }[] = [];
  for (let i = 0; i < order.items; i++) {
    const it = pool[(seed + i) % pool.length];
    const exists = list.find((l) => l.name === it.name);
    if (exists) exists.qty += 1;
    else list.push({ ...it, qty: 1 });
  }
  return list;
}
