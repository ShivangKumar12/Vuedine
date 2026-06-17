import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  Filter,
  IndianRupee,
  Package,
  Percent,
  RefreshCcw,
  Search,
  Smartphone,
  Truck,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { reportsApi, saveBlob, type ExportFormat, type SalesPayload, type SalesQuery } from '../../services/reports';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type PaymentType = 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Online';
type PayStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';
type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery' | 'QR';

type SalesRow = {
  id: string;
  date: string;
  iso: string;
  total: number;
  discount: number;
  delivery: number;
  payment: PaymentType;
  status: PayStatus;
  type: OrderType;
  customer: string;
};

// Mock ledger removed — rows now come from /v1/reports/sales (server-aggregated).

/** Server returns rows without a pre-formatted date label; build it from the ISO. */
function withDate(r: Omit<SalesRow, 'date'>): SalesRow {
  const dt = new Date(r.iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    ...r,
    date: `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()} · ${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

/** Default range: trailing 30 days, as YYYY-MM-DD strings for <input type="date">. */
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toISODate(from), to: toISODate(to) };
}
function fmtRangeLabel(from: string, to: string) {
  const f = (s: string) => {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${f(from)} — ${f(to)}`;
}

const paymentMethods: PaymentType[] = ['Cash', 'Card', 'UPI', 'Wallet', 'Online'];
const orderTypes: OrderType[] = ['Dine-In', 'Takeaway', 'Delivery', 'QR'];
const statuses: PayStatus[] = ['Paid', 'Pending', 'Refunded', 'Failed'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function SalesReport() {
  const branches = branchesStore.use();
  const [range, setRange] = useState(defaultRange);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [type, setType] = useState<'All' | OrderType>('All');
  const [payment, setPayment] = useState<'All' | PaymentType>('All');
  const [status, setStatus] = useState<'All' | PayStatus>('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [drawer, setDrawer] = useState<SalesRow | null>(null);

  const [payload, setPayload] = useState<SalesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Server-side aggregation + filtering + pagination via /v1/reports/sales.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    reportsApi
      .sales({
        from: range.from,
        to: range.to,
        branchId: branches.activeId ?? undefined,
        type,
        payment,
        status,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      })
      .then((p) => {
        if (!cancelled) setPayload(p);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, branches.activeId, type, payment, status, debouncedSearch, page]);

  const visible = useMemo(() => (payload?.rows ?? []).map(withDate), [payload]);
  const stats = payload?.kpis ?? { orders: 0, earnings: 0, discounts: 0, delivery: 0 };
  const hourly = payload?.hourly ?? [];
  const paymentMix = payload?.paymentMix ?? paymentMethods.map((m) => ({ m, v: 0, share: 0 }));
  const typeMix = payload?.typeMix ?? orderTypes.map((t) => ({ t, v: 0, share: 0 }));

  const total = payload?.total ?? 0;
  const totalPages = payload?.totalPages ?? 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  const exportQuery = {
    from: range.from,
    to: range.to,
    branchId: branches.activeId ?? undefined,
    type,
    payment,
    status,
    search: debouncedSearch || undefined,
  };

  const clearFilters = () => {
    setSearch('');
    setType('All');
    setPayment('All');
    setStatus('All');
    setPage(1);
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(type !== 'All') +
    Number(payment !== 'All') +
    Number(status !== 'All');

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-3xl font-extrabold text-ink-900 sm:text-4xl">Sales Report</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-600">
              Daily sales, discounts, delivery charges and payment performance.
            </p>
          </div>
          <DateRangePicker from={range.from} to={range.to} onChange={(from, to) => { setRange({ from, to }); setPage(1); }} />
        </div>

        {fetchError && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <span>{fetchError}</span>
            <button
              onClick={() => setRange((r) => ({ ...r }))}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total Orders" value={stats.orders} tone="brand" icon={Package} delta="+12%" up />
          <Kpi label="Total Earnings" value={stats.earnings} prefix="$" tone="emerald" icon={IndianRupee} delta="+24%" up />
          <Kpi label="Total Discounts" value={stats.discounts} prefix="$" tone="amber" icon={Percent} delta="-3%" />
          <Kpi label="Total Delivery Charges" value={stats.delivery} prefix="$" tone="cool" icon={Truck} delta="+8%" up />
        </div>

        {/* Hourly chart */}
        <HourlyChart data={hourly} earnings={stats.earnings} />

        {/* Mix cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PaymentMix mix={paymentMix} />
          <OrderTypeMix mix={typeMix} />
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Order ledger</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {total}
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
              <FilterMenu
                type={type}
                setType={(v) => { setType(v); setPage(1); }}
                payment={payment}
                setPayment={(v) => { setPayment(v); setPage(1); }}
                status={status}
                setStatus={(v) => { setStatus(v); setPage(1); }}
              />
              <ExportMenu query={exportQuery} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100">
              <thead>
                <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  <Th>Order ID</Th>
                  <Th>Date</Th>
                  <Th>Total</Th>
                  <Th>Discount</Th>
                  <Th>Delivery charge</Th>
                  <Th>Payment type</Th>
                  <Th>Payment status</Th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-sm">
                {visible.map((r, i) => (
                  <Row key={r.id} row={r} index={i} onView={() => setDrawer(r)} />
                ))}
                {visible.length === 0 && !loading && <EmptyState onReset={clearFilters} />}
                {visible.length === 0 && loading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-sm font-semibold text-ink-400">
                      Loading orders…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
            <div className="text-[12px] font-medium text-ink-500">
              Showing <span className="font-bold text-ink-900">{total === 0 ? 0 : start + 1}</span> to{' '}
              <span className="font-bold text-ink-900">{start + visible.length}</span> of{' '}
              <span className="font-bold text-ink-900">{total}</span> orders
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      <SalesDrawer row={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}

/* ============================================================ */
/*  Row                                                         */
/* ============================================================ */

function Row({
  row,
  index,
  onView,
}: {
  row: SalesRow;
  index: number;
  onView: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className="group cursor-pointer transition-colors hover:bg-ink-50/60"
      onClick={onView}
    >
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">{row.id}</div>
        <div className="mt-0.5 text-[11px] font-medium text-ink-500">{row.customer}</div>
      </td>
      <td className="px-5 py-3 text-[13px] font-medium text-ink-700">{row.date}</td>
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">${row.total.toFixed(2)}</div>
        <OrderTypePill type={row.type} />
      </td>
      <td className="px-5 py-3">
        {row.discount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[12px] font-bold text-amber-700 ring-1 ring-amber-200">
            <Percent className="h-3 w-3" />−${row.discount.toFixed(2)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-400">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        {row.delivery > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-cool-50 px-2 py-0.5 text-[12px] font-bold text-cool-700 ring-1 ring-cool-200">
            <Truck className="h-3 w-3" />${row.delivery.toFixed(2)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-400">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        <PaymentPill payment={row.payment} />
      </td>
      <td className="px-5 py-3">
        <PaymentStatusPill status={row.status} />
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="View" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </motion.tr>
  );
}

/* ============================================================ */
/*  Pills                                                       */
/* ============================================================ */

const orderTypeMeta: Record<OrderType, string> = {
  'Dine-In': 'bg-brand-50 text-brand-700 ring-brand-200',
  Takeaway: 'bg-warm-50 text-warm-700 ring-warm-200',
  Delivery: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  QR: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function OrderTypePill({ type }: { type: OrderType }) {
  return (
    <span className={cn('mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', orderTypeMeta[type])}>
      {type}
    </span>
  );
}

const paymentMeta: Record<PaymentType, { pill: string; icon: React.ElementType }> = {
  UPI: { pill: 'bg-brand-50 text-brand-700 ring-brand-200', icon: Smartphone },
  Card: { pill: 'bg-blue-50 text-blue-700 ring-blue-200', icon: CreditCard },
  Cash: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Banknote },
  Online: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', icon: Wallet },
  Wallet: { pill: 'bg-warm-50 text-warm-700 ring-warm-200', icon: Wallet },
};

function PaymentPill({ payment }: { payment: PaymentType }) {
  const Icon = paymentMeta[payment].icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', paymentMeta[payment].pill)}>
      <Icon className="h-3 w-3" />
      {payment}
    </span>
  );
}

const payStatusMeta: Record<PayStatus, { pill: string; dot: string }> = {
  Paid: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Pending: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  Refunded: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  Failed: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

function PaymentStatusPill({ status }: { status: PayStatus }) {
  const meta = payStatusMeta[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', meta.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

/* ============================================================ */
/*  Hourly chart                                                */
/* ============================================================ */

function HourlyChart({ data, earnings }: { data: { h: number; v: number }[]; earnings: number }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
            Hourly earnings
          </div>
          <div className="text-2xl font-extrabold text-ink-900">
            <Counter value={earnings} prefix="$" decimals={2} />
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600">
            <ArrowUpRight className="h-3 w-3" />
            +24% vs yesterday
          </div>
        </div>
        <div className="flex gap-1 text-[10px]">
          {['7D', '30D', 'YTD'].map((t) => (
            <span
              key={t}
              className={cn(
                'rounded-md px-2 py-1 font-bold ring-1',
                t === '30D'
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30 ring-brand-500'
                  : 'bg-white text-ink-600 ring-ink-200',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-5 h-48 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
        <div className="flex h-full items-end gap-1.5">
          {data.map((d, i) => {
            const h = (d.v / max) * 100;
            return (
              <motion.div
                key={d.h}
                initial={{ scaleY: 0.05 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.9, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                style={{ height: `${h}%`, transformOrigin: 'bottom' }}
                className="group relative flex-1 rounded-t bg-gradient-to-t from-brand-500 via-rose-500 to-warm-500"
              >
                {/* Tooltip */}
                <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-ink-900 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                  ${d.v.toFixed(2)}
                </div>
              </motion.div>
            );
          })}
        </div>
        {/* Hour labels */}
        <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-14">
          {data.map((d) => (
            <div key={d.h} className="text-center text-[9px] font-bold text-ink-400">
              {d.h}h
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Mix cards                                                   */
/* ============================================================ */

function PaymentMix({ mix }: { mix: { m: PaymentType; v: number; share: number }[] }) {
  const colors: Record<PaymentType, string> = {
    UPI: 'from-brand-500 to-rose-500',
    Card: 'from-blue-500 to-cool-500',
    Cash: 'from-emerald-500 to-emerald-600',
    Online: 'from-violet-500 to-pink-500',
    Wallet: 'from-warm-500 to-amber-500',
  };
  const total = mix.reduce((s, r) => s + r.v, 0);
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
            Payment method mix
          </div>
          <div className="text-sm font-extrabold text-ink-900">
            ${total.toFixed(2)} captured this period
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {mix.map((r, i) => (
          <li key={r.m}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 font-bold text-ink-900">
                <span className={cn('h-2 w-3 rounded-full bg-gradient-to-r', colors[r.m])} />
                {r.m}
              </span>
              <span className="font-mono text-[12px] font-bold text-ink-700">
                ${r.v.toFixed(2)}
                <span className="ml-1 font-medium text-ink-400">· {(r.share * 100).toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${r.share * 100}%` }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 1, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                className={cn('h-full rounded-full bg-gradient-to-r', colors[r.m])}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrderTypeMix({ mix }: { mix: { t: OrderType; v: number; share: number }[] }) {
  const colors: Record<OrderType, string> = {
    'Dine-In': '#EC1B7C',
    Takeaway: '#F97316',
    Delivery: '#10B981',
    QR: '#8B5CF6',
  };
  const total = mix.reduce((s, r) => s + r.v, 0);

  // Build SVG donut segments
  let offset = 0;
  const radius = 14;
  const segments = mix.map((r) => {
    const len = r.share * 100;
    const seg = { color: colors[r.t], len, off: -offset };
    offset += len;
    return seg;
  });

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
            Order type mix
          </div>
          <div className="text-sm font-extrabold text-ink-900">
            ${total.toFixed(2)} across all channels
          </div>
        </div>

        <div className="relative">
          <svg width="120" height="120" viewBox="0 0 36 36" className="-rotate-90">
            <circle cx="18" cy="18" r={radius} fill="none" stroke="#F1F5F9" strokeWidth={4} />
            {segments.map((s, i) => (
              <motion.circle
                key={i}
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={4}
                strokeDasharray={`${s.len} 100`}
                strokeDashoffset={s.off}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] font-bold uppercase tracking-widest text-ink-500">Total</div>
            <div className="text-base font-extrabold text-ink-900">
              {mix.length} types
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {mix.map((r) => (
          <li
            key={r.t}
            className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3 py-2"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-bold text-ink-700">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[r.t] }} />
              {r.t}
            </span>
            <span className="font-mono text-[12px] font-bold text-ink-900">
              ${r.v.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
} as const;

function Kpi({
  label,
  value,
  prefix,
  tone,
  icon: Icon,
  delta,
  up,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone: keyof typeof tones;
  icon: React.ElementType;
  delta?: string;
  up?: boolean;
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
            <Counter value={value} prefix={prefix} decimals={prefix === '$' ? 2 : 0} />
          </div>
          {delta && (
            <div
              className={cn(
                'mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold',
                up ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
      <span className="text-ink-900">Sales Report</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by ID or customer…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        <Calendar className="h-3.5 w-3.5 text-brand-500" />
        <span>{fmtRangeLabel(from, to)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-3 shadow-2xl shadow-black/10">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-500">From</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => onChange(e.target.value, to)}
              className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-sm text-ink-800 focus:border-brand-300 focus:outline-none"
            />
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-ink-500">To</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => onChange(from, e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 px-2 py-1.5 text-sm text-ink-800 focus:border-brand-300 focus:outline-none"
            />
            <button
              onClick={() => setOpen(false)}
              className="btn-primary mt-3 w-full rounded-lg px-3 py-1.5 text-sm font-bold"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Debounce a fast-changing value (used for the search box). */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function FilterMenu({
  type,
  setType,
  payment,
  setPayment,
  status,
  setStatus,
}: {
  type: 'All' | OrderType;
  setType: (v: 'All' | OrderType) => void;
  payment: 'All' | PaymentType;
  setPayment: (v: 'All' | PaymentType) => void;
  status: 'All' | PayStatus;
  setStatus: (v: 'All' | PayStatus) => void;
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-72 space-y-3 p-2">
          <FilterGroup label="Order type">
            {(['All', ...orderTypes] as const).map((t) => (
              <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                {t}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Payment method">
            {(['All', ...paymentMethods] as const).map((m) => (
              <FilterChip key={m} active={payment === m} onClick={() => setPayment(m)}>
                {m}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Payment status">
            {(['All', ...statuses] as const).map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      )}
    </Dropdown>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
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

function ExportMenu({ query }: { query: SalesQuery }) {
  const [busy, setBusy] = useState<string | null>(null);
  const options: { label: string; format: ExportFormat }[] = [
    { label: 'CSV', format: 'csv' },
    { label: 'Excel (.xlsx)', format: 'excel' },
    { label: 'PDF report', format: 'pdf' },
    { label: 'GST summary', format: 'gst' },
  ];

  const handleDownload = async (format: ExportFormat, close: () => void) => {
    setBusy(format);
    try {
      const { blob, filename } = await reportsApi.download({ ...query, format });
      saveBlob(blob, filename);
      close();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (close: () => void) => {
    setBusy('email');
    try {
      const res = await reportsApi.enqueueExport({ ...query, format: 'csv' });
      alert(res.message);
      close();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not queue export');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dropdown label="Export" icon={<Download className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Download now</DropHeader>
          {options.map((o) => (
            <DropItem key={o.format} onClick={() => handleDownload(o.format, close)}>
              {o.label}
              {busy === o.format && <span className="text-[10px] text-ink-400">…</span>}
            </DropItem>
          ))}
          <div className="my-1 border-t border-ink-100" />
          <DropHeader>Large export</DropHeader>
          <DropItem onClick={() => handleEmail(close)}>
            Email me a copy
            {busy === 'email' && <span className="text-[10px] text-ink-400">…</span>}
          </DropItem>
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
              className="absolute right-0 top-full z-40 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-black/10"
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

function ActionButton({
  tone,
  label,
  children,
  onClick,
}: {
  tone: 'brand';
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        tone === 'brand'
          ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
          : '',
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <tr>
      <td colSpan={8} className="px-5 py-16 text-center">
        <div className="text-base font-bold text-ink-700">No orders match</div>
        <div className="mt-1 text-sm text-ink-500">Adjust filters or pick a wider date range.</div>
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

  const btn =
    'inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border text-[12px] font-bold transition';

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
            className={cn(
              btn,
              p === current
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
            )}
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
/*  Drawer                                                      */
/* ============================================================ */

function SalesDrawer({ row, onClose }: { row: SalesRow | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {row && (
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
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                Order
              </div>
              <div className="mt-1 font-mono text-2xl font-extrabold">{row.id}</div>
              <div className="mt-3 text-3xl font-extrabold">${row.total.toFixed(2)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{row.type}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{row.payment}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{row.status}</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/85">
                <Calendar className="h-3.5 w-3.5" />
                {row.date}
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              <Section title="Customer">
                <div className="rounded-xl border border-ink-100 bg-white p-3">
                  <div className="text-sm font-bold text-ink-900">{row.customer}</div>
                </div>
              </Section>

              <Section title="Earnings breakdown">
                <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                  <Line label="Subtotal">${(row.total - row.delivery + row.discount).toFixed(2)}</Line>
                  <Line label="Discount">
                    <span className="text-emerald-600">−${row.discount.toFixed(2)}</span>
                  </Line>
                  <Line label="Delivery charge">${row.delivery.toFixed(2)}</Line>
                  <div className="my-1 border-t border-dashed border-ink-200" />
                  <Line label="Total" emphasis>
                    ${row.total.toFixed(2)}
                  </Line>
                </div>
              </Section>
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-ink-100 bg-white p-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                Close
              </button>
              <Link
                to="/dashboard/pos-orders"
                className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold"
              >
                Open in orders
                <Eye className="h-3.5 w-3.5" />
              </Link>
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
