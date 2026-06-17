import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChefHat,
  Clock,
  IndianRupee,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { reportsApi, type DashboardPayload, type KpiValue } from '../../services/reports';
import { authStore } from '../../stores/auth';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';

/* ============================================================ */
/*  Date-range helpers                                          */
/* ============================================================ */

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
    return `${m}/${d}/${y}`;
  };
  return `${f(from)} — ${f(to)}`;
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const AVATARS = [
  'from-brand-500 via-rose-500 to-warm-500',
  'from-rose-500 via-brand-500 to-warm-500',
  'from-warm-500 via-amber-500 to-brand-500',
  'from-cool-500 via-brand-500 to-warm-500',
  'from-violet-500 via-pink-500 to-brand-500',
];
const POPULAR_COLORS = [
  'from-brand-500 to-warm-500',
  'from-warm-500 to-amber-500',
  'from-rose-500 to-brand-500',
  'from-violet-500 to-purple-500',
  'from-cool-500 to-emerald-500',
];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Dashboard() {
  const branches = branchesStore.use();
  const auth = authStore.use();
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    reportsApi
      .dashboard({ from: range.from, to: range.to, branchId: branches.activeId ?? undefined })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, branches.activeId]);

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      <ReminderBanner />
      <Greeting name={auth.user?.name ?? auth.user?.email ?? 'there'} />

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <span>{error}</span>
          <button
            onClick={() => setRange((r) => ({ ...r }))}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top KPI grid */}
      <Section title="Overview">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Total Sales" kpi={k?.totalSales} prefix="₹" icon={IndianRupee} gradient="from-brand-500 via-rose-500 to-warm-500" loading={loading} />
          <KpiCard title="Total Orders" kpi={k?.totalOrders} icon={ShoppingBag} gradient="from-violet-500 via-indigo-500 to-blue-500" loading={loading} />
          <KpiCard title="Total Customers" kpi={k?.totalCustomers} icon={Users} gradient="from-cyan-500 via-blue-500 to-indigo-500" loading={loading} />
          <KpiCard title="Total Menu Items" kpi={k?.totalMenuItems} icon={UtensilsCrossed} gradient="from-fuchsia-500 via-purple-500 to-violet-500" loading={loading} />
        </div>
      </Section>

      {/* Order statistics */}
      <Section
        title="Order Statistics"
        action={<DateRangePicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatusCard label="Total Orders" value={data?.orderStatusCounts.total ?? 0} icon={Package} tone="brand" />
          <StatusCard label="Pending" value={data?.orderStatusCounts.pending ?? 0} icon={Clock} tone="amber" />
          <StatusCard label="Accepted" value={data?.orderStatusCounts.accepted ?? 0} icon={CheckCircle2} tone="emerald" />
          <StatusCard label="Preparing" value={data?.orderStatusCounts.preparing ?? 0} icon={ChefHat} tone="cool" />
          <StatusCard label="Prepared" value={data?.orderStatusCounts.prepared ?? 0} icon={Sparkles} tone="violet" />
          <StatusCard label="Out for Delivery" value={data?.orderStatusCounts.outForDelivery ?? 0} icon={Truck} tone="blue" />
          <StatusCard label="Delivered" value={data?.orderStatusCounts.delivered ?? 0} icon={CheckCircle2} tone="emerald" />
          <StatusCard label="Cancelled" value={data?.orderStatusCounts.cancelled ?? 0} icon={X} tone="rose" />
        </div>
      </Section>

      {/* Sales / Orders summaries */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesSummary summary={data?.salesSummary} rangeLabel={fmtRangeLabel(range.from, range.to)} />
        <OrdersSummary summary={data?.ordersSummary} rangeLabel={fmtRangeLabel(range.from, range.to)} />
      </div>

      {/* Customer stats / Top customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CustomerStats stats={data?.customerStats} rangeLabel={fmtRangeLabel(range.from, range.to)} />
        <TopCustomers customers={data?.topCustomers ?? []} />
      </div>

      {/* Featured / Most popular */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FeaturedItems items={data?.featuredItems ?? []} />
        <MostPopularItems items={data?.mostPopularItems ?? []} />
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Layout primitives                                           */
/* ============================================================ */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReminderBanner() {
  const settings = settingsStore.use();
  // Banner only shows in demo mode (Phase F acceptance: disappears when demoMode = false).
  if (!settings.tenant?.demoMode) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-rose-50 to-warm-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-brand-700">Reminder!</div>
          <div className="mt-0.5 text-[13px] text-ink-700">
            Demo data will reset every 60 minutes. Live mode disables this banner.
          </div>
        </div>
        <button className="hidden rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100/50 sm:inline-flex">
          Switch to Live
        </button>
      </div>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-3xl font-extrabold leading-tight text-brand-600 sm:text-4xl">
          {greetingWord()}!
        </h1>
        <p className="mt-1 text-base font-semibold text-ink-700">{name}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12px] font-bold text-brand-700">
        Version: 3.9
      </span>
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
        className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 shadow-sm transition hover:border-brand-300"
      >
        <Calendar className="h-3.5 w-3.5 text-brand-500" />
        <span className="text-[12px] font-semibold text-ink-700">{fmtRangeLabel(from, to)}</span>
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

/* ============================================================ */
/*  KPI cards (top row)                                         */
/* ============================================================ */

function KpiCard({
  title,
  kpi,
  prefix,
  icon: Icon,
  gradient,
  loading,
}: {
  title: string;
  kpi?: KpiValue;
  prefix?: string;
  icon: LucideIcon;
  gradient: string;
  loading?: boolean;
}) {
  const value = kpi?.value ?? 0;
  const delta = kpi?.delta ?? '—';
  const up = kpi?.up ?? true;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg',
        gradient,
      )}
      style={{ boxShadow: '0 14px 30px -12px rgba(15,23,42,0.25)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-white/15 blur-2xl"
      />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
          <Icon className="h-5 w-5" />
        </span>
        <div className="text-[13px] font-bold uppercase tracking-wider opacity-90">{title}</div>
      </div>
      <div className="mt-5 text-3xl font-extrabold tracking-tight">
        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-white/30" /> : <Counter value={value} prefix={prefix} />}
      </div>
      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold opacity-90">
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {delta} vs prev. period
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Status (Order Statistics)                                   */
/* ============================================================ */

const tones: Record<string, { bg: string; text: string; ring: string }> = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  cool: { bg: 'bg-cool-50', text: 'text-cool-600', ring: 'ring-cool-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  warm: { bg: 'bg-warm-50', text: 'text-warm-600', ring: 'ring-warm-100' },
};

function StatusCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: keyof typeof tones;
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
          <div className="truncate text-[12px] font-semibold text-ink-500">{label}</div>
          <div className="text-xl font-extrabold text-ink-900">
            <Counter value={value} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Sales summary                                               */
/* ============================================================ */

function SalesSummary({
  summary,
  rangeLabel,
}: {
  summary?: DashboardPayload['salesSummary'];
  rangeLabel: string;
}) {
  const raw = summary?.bars ?? [];
  const max = Math.max(1, ...raw);
  const bars = raw.length ? raw.map((v) => Math.max(4, Math.round((v / max) * 100))) : Array(14).fill(4);
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Sales Summary</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">Daily revenue (last 14 days)</p>
        </div>
        <RangeBadge label={rangeLabel} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Sales" value={summary?.totalSales ?? 0} prefix="₹" tone="brand" />
        <Stat label="Avg. sales / day" value={summary?.avgPerDay ?? 0} prefix="₹" tone="warm" />
      </div>

      <div className="mt-5 flex h-44 items-end gap-1.5 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0.05 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ height: `${h}%`, transformOrigin: 'bottom' }}
            className="flex-1 rounded-t bg-gradient-to-t from-brand-500 via-rose-500 to-warm-500"
          />
        ))}
      </div>
    </Card>
  );
}

function RangeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 shadow-sm">
      <Calendar className="h-3.5 w-3.5 text-brand-500" />
      <span className="text-[12px] font-semibold text-ink-700">{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  prefix,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone: keyof typeof tones;
}) {
  const t = tones[tone];
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md', t.bg)}>
          <TrendingUp className={cn('h-3 w-3', t.text)} />
        </span>
        {label}
      </div>
      <div className="mt-1.5 text-xl font-extrabold text-ink-900">
        <Counter value={value} prefix={prefix} />
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Orders summary                                              */
/* ============================================================ */

function OrdersSummary({
  summary,
  rangeLabel,
}: {
  summary?: DashboardPayload['ordersSummary'];
  rangeLabel: string;
}) {
  const rows = [
    { label: 'Delivered (%)', v: summary?.delivered ?? 0, c: 'bg-gradient-to-r from-brand-500 to-rose-500' },
    { label: 'Returned (%)', v: summary?.returned ?? 0, c: 'bg-gradient-to-r from-violet-500 to-indigo-500' },
    { label: 'Cancelled (%)', v: summary?.cancelled ?? 0, c: 'bg-gradient-to-r from-violet-500 to-purple-500' },
    { label: 'Rejected (%)', v: summary?.rejected ?? 0, c: 'bg-gradient-to-r from-rose-500 to-red-500' },
  ];
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Orders Summary</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">Delivery and lifecycle performance</p>
        </div>
        <RangeBadge label={rangeLabel} />
      </div>

      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={r.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-ink-700">{r.label}</span>
              <span className="font-mono text-[12px] font-bold text-ink-900">{r.v}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${r.v}%` }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 1.1, delay: i * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                className={cn('h-full rounded-full', r.c)}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ============================================================ */
/*  Customer stats                                              */
/* ============================================================ */

function CustomerStats({
  stats,
  rangeLabel,
}: {
  stats?: DashboardPayload['customerStats'];
  rangeLabel: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Customer Stats</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">New vs returning visitors</p>
        </div>
        <RangeBadge label={rangeLabel} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Mini label="New" value={stats?.new.value ?? 0} delta={stats?.new.delta ?? '—'} down={!(stats?.new.up ?? true)} />
        <Mini label="Returning" value={stats?.returning.value ?? 0} delta={stats?.returning.delta ?? '—'} down={!(stats?.returning.up ?? true)} />
        <Mini label="Inactive" value={stats?.inactive.value ?? 0} delta={stats?.inactive.delta ?? '—'} down={!(stats?.inactive.up ?? false)} />
      </div>

      <svg viewBox="0 0 320 100" className="mt-5 h-28 w-full">
        <defs>
          <linearGradient id="csLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#EC1B7C" />
          </linearGradient>
          <linearGradient id="csFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#EC1B7C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EC1B7C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,75 C40,55 60,80 100,60 C140,40 160,15 200,30 C240,45 260,18 300,10 L320,10 L320,100 L0,100 Z"
          fill="url(#csFill)"
        />
        <path
          className="draw"
          d="M0,75 C40,55 60,80 100,60 C140,40 160,15 200,30 C240,45 260,18 300,10 L320,10"
          fill="none"
          stroke="url(#csLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    </Card>
  );
}

function Mini({ label, value, delta, down }: { label: string; value: number; delta: string; down?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-ink-900">
        <Counter value={value} />
      </div>
      <div
        className={cn(
          'mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold',
          down ? 'text-rose-600' : 'text-emerald-600',
        )}
      >
        {down ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
        {delta}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Top customers                                               */
/* ============================================================ */

function TopCustomers({ customers }: { customers: DashboardPayload['topCustomers'] }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Top Customers</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">By spend this period</p>
        </div>
      </div>
      {customers.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No customer spend yet for this range.</p>
      ) : (
        <ul className="space-y-2.5">
          {customers.map((c, i) => (
            <li
              key={`${c.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3 transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br', AVATARS[i % AVATARS.length])}>
                  {c.name[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink-900">{c.name}</div>
                <div className="text-[11px] text-ink-500">{c.orders} orders</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-brand-600">₹{c.spend.toLocaleString('en-IN')}</div>
                <div className="text-[10px] font-semibold text-ink-500">#{i + 1}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ============================================================ */
/*  Items                                                       */
/* ============================================================ */

function FeaturedItems({ items }: { items: DashboardPayload['featuredItems'] }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Featured Items</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">Curated picks from your menu</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No menu items yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <li
              key={it.name}
              className="rounded-2xl border border-ink-100 bg-gradient-to-br from-white to-ink-50/40 p-3 transition hover:border-brand-200"
            >
              <div className="flex h-16 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-3xl">
                {it.e}
              </div>
              <div className="mt-2 truncate text-sm font-bold text-ink-900">{it.name}</div>
              <div className="text-[11px] font-semibold text-brand-600">₹{it.price}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink-500">{it.sold} sold</span>
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                  {it.tag}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MostPopularItems({ items }: { items: DashboardPayload['mostPopularItems'] }) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Most Popular Items</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">By orders this period</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">No orders yet for this range.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((d, i) => (
            <li key={d.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-bold text-ink-900">
                  <span className="text-base">{d.e}</span>
                  {d.name}
                </span>
                <span className="font-mono text-[11px] font-bold text-ink-500">{d.sold} orders</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${d.p}%` }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 1, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                  className={cn('h-full rounded-full bg-gradient-to-r', POPULAR_COLORS[i % POPULAR_COLORS.length])}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ============================================================ */
/*  Card primitive                                              */
/* ============================================================ */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <span aria-hidden className="absolute left-0 top-5 h-8 w-1 rounded-r bg-brand-500" />
      {children}
    </div>
  );
}
