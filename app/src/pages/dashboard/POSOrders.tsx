import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  IndianRupee,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { ordersApi, type Order as ApiOrder } from '../../services/orders';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery' | 'QR';
type Status = 'Pending' | 'Accepted' | 'Preparing' | 'Prepared' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
type Channel = 'POS' | 'Waiter' | 'QR' | 'Online';
type Payment = 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Online';

type Order = {
  id: string;
  /** Server-side cuid (used for status updates / cancel). */
  serverId?: string;
  type: OrderType;
  customer: string;
  customerPhone?: string;
  table?: string;
  amount: number;
  date: string; // display string
  iso: string; // sortable
  status: Status;
  channel: Channel;
  payment: Payment;
  items: number;
};

const SERVER_STATUS_MAP: Record<string, Status> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Prepared',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  SERVED: 'Delivered',
  CANCELLED: 'Cancelled',
};
const SERVER_TYPE_MAP: Record<string, OrderType> = {
  DINE_IN: 'Dine-In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};
const SERVER_CHANNEL_MAP: Record<string, Channel> = {
  POS: 'POS',
  WAITER: 'Waiter',
  QR: 'QR',
  ONLINE: 'Online',
};
const SERVER_PAYMENT_MAP: Record<string, Payment> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  WALLET: 'Wallet',
  ONLINE: 'Online',
  PAY_LATER: 'Cash',
};

function adaptServerOrder(o: ApiOrder): Order {
  const dt = new Date(o.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: o.serial.replace(/[^A-Za-z0-9]/g, ''),
    serverId: o.id,
    type:
      (o.channel === 'QR' && o.type === 'DINE_IN' ? 'QR' : SERVER_TYPE_MAP[o.type]) ?? 'Dine-In',
    customer: o.guestName ?? 'Walking customer',
    customerPhone: o.guestPhone ?? undefined,
    table: o.tableLabel ?? undefined,
    amount: o.grandTotal,
    date: `${pad(dt.getHours())}:${pad(dt.getMinutes())}, ${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`,
    iso: dt.toISOString(),
    status: SERVER_STATUS_MAP[o.status] ?? 'Pending',
    channel: SERVER_CHANNEL_MAP[o.channel] ?? 'POS',
    payment: SERVER_PAYMENT_MAP[o.paymentMode] ?? 'Cash',
    items: o.items.length,
  };
}

const statusOrder: Status[] = ['Pending', 'Accepted', 'Preparing', 'Prepared', 'Out for Delivery', 'Delivered', 'Cancelled'];
const orderTypes: OrderType[] = ['Dine-In', 'Takeaway', 'Delivery', 'QR'];
const channels: Channel[] = ['POS', 'Waiter', 'QR', 'Online'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function POSOrders() {
  const branches = branchesStore.use();
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoading] = useState(false);
  const [, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [type, setType] = useState<'All' | OrderType>('All');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [channel, setChannel] = useState<'All' | Channel>('All');
  const [payment, setPayment] = useState<'All' | Payment>('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);

  const refresh = () => {
    if (!branches.activeId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    ordersApi
      .list({ branchId: branches.activeId, pageSize: 100 })
      .then((rows) => setOrders(rows.map(adaptServerOrder)))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  };

  // Initial + refresh on branch change.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.activeId]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (search) {
        const s = search.toLowerCase();
        if (!o.id.toLowerCase().includes(s) && !o.customer.toLowerCase().includes(s)) return false;
      }
      if (type !== 'All' && o.type !== type) return false;
      if (status !== 'All' && o.status !== status) return false;
      if (channel !== 'All' && o.channel !== channel) return false;
      if (payment !== 'All' && o.payment !== payment) return false;
      return true;
    });
  }, [search, type, status, channel, payment, orders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const totals = useMemo(() => {
    const revenue = orders.reduce((s, o) => (o.status !== 'Cancelled' ? s + o.amount : s), 0);
    const completed = orders.filter((o) => o.status === 'Delivered').length;
    const pending = orders.filter((o) => ['Pending', 'Accepted', 'Preparing', 'Prepared', 'Out for Delivery'].includes(o.status)).length;
    const cancelled = orders.filter((o) => o.status === 'Cancelled').length;
    return { revenue, completed, pending, cancelled };
  }, [orders]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: orders.length };
    statusOrder.forEach((s) => {
      map[s] = orders.filter((o) => o.status === s).length;
    });
    return map;
  }, [orders]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(visible.map((o) => o.id));
    else setSelected([]);
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const clearFilters = () => {
    setSearch('');
    setType('All');
    setStatus('All');
    setChannel('All');
    setPayment('All');
    setPage(1);
  };

  const activeFilters =
    Number(search.length > 0) +
    Number(type !== 'All') +
    Number(status !== 'All') +
    Number(channel !== 'All') +
    Number(payment !== 'All');

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Today's revenue" value={totals.revenue} prefix="$" tone="brand" icon={IndianRupee} />
          <Kpi label="Completed" value={totals.completed} tone="emerald" icon={Receipt} />
          <Kpi label="In progress" value={totals.pending} tone="amber" icon={TrendingUp} />
          <Kpi label="Cancelled" value={totals.cancelled} tone="rose" icon={X} />
        </div>

        {/* Status quick filter pills */}
        <StatusPills value={status} onChange={(s) => { setStatus(s); setPage(1); }} counts={counts} />

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">POS Orders</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {filtered.length}
              </span>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-600"
                >
                  <RefreshCcw className="h-3 w-3" />
                  Clear filters · {activeFilters}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
              <DateRangePicker label="06/01/2026 — 06/30/2026" />
              <FilterMenu
                type={type}
                setType={(t) => { setType(t); setPage(1); }}
                channel={channel}
                setChannel={(c) => { setChannel(c); setPage(1); }}
                payment={payment}
                setPayment={(p) => { setPayment(p); setPage(1); }}
              />
              <ExportMenu />
            </div>
          </div>

          {/* Bulk action bar */}
          <AnimatePresence>
            {selected.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden border-b border-brand-100 bg-brand-50/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div className="font-bold text-brand-700">{selected.length} selected</div>
                  <div className="flex flex-wrap gap-2">
                    <BulkButton>Mark Accepted</BulkButton>
                    <BulkButton>Mark Prepared</BulkButton>
                    <BulkButton>Print KOT</BulkButton>
                    <BulkButton tone="danger">Cancel orders</BulkButton>
                    <button
                      onClick={() => setSelected([])}
                      className="text-[12px] font-semibold text-ink-500 hover:text-ink-900"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100">
              <thead>
                <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  <th className="px-5 py-3 w-10">
                    <Check
                      checked={visible.length > 0 && visible.every((v) => selected.includes(v.id))}
                      onChange={toggleAll}
                      indeterminate={
                        selected.length > 0 &&
                        !visible.every((v) => selected.includes(v.id)) &&
                        visible.some((v) => selected.includes(v.id))
                      }
                    />
                  </th>
                  <Th>Order ID</Th>
                  <Th>Order Type</Th>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-sm">
                {visible.map((o, idx) => (
                  <Row
                    key={o.id}
                    order={o}
                    index={idx}
                    selected={selected.includes(o.id)}
                    onToggle={(c) => toggleOne(o.id, c)}
                    onView={() => setDrawerOrder(o)}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="text-base font-bold text-ink-700">No orders match your filters</div>
                      <div className="mt-1 text-sm text-ink-500">Try clearing the search, status, or filter chips.</div>
                      {activeFilters > 0 && (
                        <button
                          onClick={clearFilters}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Reset filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
            <div className="flex items-center gap-3 text-[12px] font-medium text-ink-500">
              <span>
                Showing <span className="font-bold text-ink-900">{filtered.length === 0 ? 0 : start + 1}</span> to{' '}
                <span className="font-bold text-ink-900">{Math.min(start + pageSize, filtered.length)}</span> of{' '}
                <span className="font-bold text-ink-900">{filtered.length}</span> entries
              </span>
              <PageSizeMenu value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      {/* Detail drawer */}
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
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  prefix?: string;
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
  value: 'All' | Status;
  onChange: (v: 'All' | Status) => void;
  counts: Record<string, number>;
}) {
  const list: ('All' | Status)[] = ['All', ...statusOrder];

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
              'group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
            )}
          >
            {meta && (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  active ? 'bg-white' : meta.dot,
                )}
              />
            )}
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
/*  Row                                                         */
/* ============================================================ */

function Row({
  order,
  index,
  selected,
  onToggle,
  onView,
}: {
  order: Order;
  index: number;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onView: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn(
        'group cursor-pointer transition-colors',
        selected ? 'bg-brand-50/40' : 'hover:bg-ink-50/60',
      )}
      onClick={onView}
    >
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <Check checked={selected} onChange={onToggle} />
      </td>
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">#{order.id}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          via {order.channel}
        </div>
      </td>
      <td className="px-5 py-3">
        <OrderTypePill type={order.type} />
        {order.table && (
          <div className="mt-1 text-[10px] font-bold text-ink-500">· {order.table}</div>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm',
              avatarGradient(order.customer),
            )}
          >
            {initials(order.customer)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink-900">{order.customer}</div>
            <div className="text-[11px] font-medium text-ink-500">
              {order.customerPhone ?? `${order.items} items`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">${order.amount.toFixed(2)}</div>
        <div className="text-[10px] font-semibold text-ink-400">{order.payment}</div>
      </td>
      <td className="px-5 py-3 text-[13px] font-medium text-ink-600">{order.date}</td>
      <td className="px-5 py-3">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="View" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="emerald" label="Print">
            <Printer className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="rose" label="Cancel">
            <Trash2 className="h-3.5 w-3.5" />
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

/* ============================================================ */
/*  Status / type badges                                        */
/* ============================================================ */

const statusMeta: Record<Status, { pill: string; dot: string }> = {
  Pending: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  Accepted: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Preparing: { pill: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  Prepared: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  'Out for Delivery': { pill: 'bg-cool-50 text-cool-700 ring-cool-200', dot: 'bg-cool-500' },
  Delivered: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Cancelled: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        meta.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

const orderTypeMeta: Record<OrderType, string> = {
  'Dine-In': 'bg-brand-50 text-brand-700 ring-brand-200',
  Takeaway: 'bg-warm-50 text-warm-700 ring-warm-200',
  Delivery: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  QR: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function OrderTypePill({ type }: { type: OrderType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
        orderTypeMeta[type],
      )}
    >
      {type}
    </span>
  );
}

/* ============================================================ */
/*  Action button (shared)                                      */
/* ============================================================ */

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
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        cls,
      )}
    >
      {children}
    </button>
  );
}

function Check({
  checked,
  onChange,
  indeterminate,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  indeterminate?: boolean;
}) {
  return (
    <label className="relative inline-flex cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-500 checked:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40"
      />
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8l3.5 3.5L13 5" />
      </svg>
      {indeterminate && !checked && (
        <span className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2 rounded-full bg-brand-500" />
      )}
    </label>
  );
}

function BulkButton({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[12px] font-bold transition',
        tone === 'danger'
          ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
      )}
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
      <span className="text-ink-900">POS Orders</span>
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

function DateRangePicker({ label }: { label: string }) {
  return (
    <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[12px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
      <Calendar className="h-3.5 w-3.5 text-brand-500" />
      <span>{label}</span>
    </button>
  );
}

function FilterMenu({
  type,
  setType,
  channel,
  setChannel,
  payment,
  setPayment,
}: {
  type: 'All' | OrderType;
  setType: (v: 'All' | OrderType) => void;
  channel: 'All' | Channel;
  setChannel: (v: 'All' | Channel) => void;
  payment: 'All' | Payment;
  setPayment: (v: 'All' | Payment) => void;
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
          <FilterGroup label="Channel">
            {(['All', ...channels] as const).map((c) => (
              <FilterChip key={c} active={channel === c} onClick={() => setChannel(c)}>
                {c}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Payment">
            {(['All', 'Cash', 'Card', 'UPI', 'Wallet', 'Online'] as const).map((p) => (
              <FilterChip key={p} active={payment === p} onClick={() => setPayment(p)}>
                {p}
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

function PageSizeMenu({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Dropdown label={`${value} / page`} icon={null} size="sm">
      {(close) => (
        <>
          <DropHeader>Rows per page</DropHeader>
          {[10, 25, 50, 100].map((n) => (
            <DropItem key={n} active={n === value} onClick={() => { onChange(n); close(); }}>
              {n} entries
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
  size = 'md',
}: {
  label: string;
  icon: React.ReactNode | null;
  children: (close: () => void) => React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700',
          size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-9 px-3 text-[13px]',
        )}
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

function DropItem({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition',
        active ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50',
      )}
    >
      {children}
      {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
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
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700')}
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
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700')}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Order detail drawer                                         */
/* ============================================================ */

function OrderDrawer({ order, onClose }: { order: Order | null; onClose: () => void }) {
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
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Order</div>
              <div className="mt-1 font-mono text-2xl font-extrabold">#{order.id}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{order.type}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">via {order.channel}</span>
                {order.table && <span className="rounded-full bg-white/20 px-2 py-0.5">{order.table}</span>}
              </div>
              <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/85">
                <Calendar className="h-3.5 w-3.5" />
                {order.date}
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              {/* Status timeline */}
              <Timeline status={order.status} />

              {/* Customer */}
              <Section title="Customer">
                <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white',
                      avatarGradient(order.customer),
                    )}
                  >
                    {initials(order.customer)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink-900">{order.customer}</div>
                    <div className="text-[12px] text-ink-500">
                      {order.customerPhone ?? 'No phone on file'}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Items (mock) */}
              <Section title={`Items · ${order.items}`}>
                <ul className="space-y-2 text-sm">
                  {mockItems(order).map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-3"
                    >
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
                  <Line label="Subtotal">{settingsStore.formatMoney(order.amount * 0.93)}</Line>
                  <Line label="Discount">
                    <span className="text-emerald-600">−{settingsStore.formatMoney(0)}</span>
                  </Line>
                  <Line label={`Tax (${Math.round(settingsStore.defaultTaxRate() * 100)}%)`}>
                    {settingsStore.formatMoney(order.amount * settingsStore.defaultTaxRate())}
                  </Line>
                  <Line label="Service charge">{settingsStore.formatMoney(order.amount * settingsStore.serviceChargeRate())}</Line>
                  <div className="my-1 border-t border-dashed border-ink-200" />
                  <Line label="Total" emphasis>
                    {settingsStore.formatMoney(order.amount)}
                  </Line>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Paid · {order.payment}
                </div>
              </Section>
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-ink-100 bg-white p-4">
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  KOT
                </span>
              </button>
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  Receipt
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

/* Timeline */
const timelineSteps: Status[] = ['Pending', 'Accepted', 'Preparing', 'Prepared', 'Delivered'];

function Timeline({ status }: { status: Status }) {
  // Cancelled = dedicated style
  if (status === 'Cancelled') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
        <div className="font-bold text-rose-700">Cancelled</div>
        <div className="mt-1 text-[12px] text-rose-600">This order was cancelled and refunded.</div>
      </div>
    );
  }
  if (status === 'Out for Delivery') {
    return (
      <div className="rounded-xl border border-cool-200 bg-cool-50 p-3 text-sm">
        <div className="font-bold text-cool-700">Out for delivery</div>
        <div className="mt-1 text-[12px] text-cool-600">Driver is on the way · ETA ~15 min</div>
      </div>
    );
  }

  const idx = timelineSteps.indexOf(status);
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-500">Order timeline</div>
      <div className="relative">
        <div className="absolute left-3 top-3 h-[calc(100%-1.5rem)] w-0.5 bg-ink-100" />
        <ul className="space-y-3">
          {timelineSteps.map((s, i) => {
            const reached = i <= idx;
            const current = i === idx;
            return (
              <li key={s} className="relative flex items-center gap-3 pl-1">
                <span
                  className={cn(
                    'relative z-10 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white',
                    reached ? 'bg-brand-500' : 'bg-ink-200',
                  )}
                >
                  {current && (
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
    </div>
  );
}

/* Mock items per order — derived deterministically from id */
function mockItems(order: Order) {
  const pool = [
    { name: 'Margherita', emoji: '🍕', price: 4.5 },
    { name: 'Truffle Burger', emoji: '🍔', price: 5.9 },
    { name: 'Caesar Salad', emoji: '🥗', price: 3.3 },
    { name: 'Sushi Set', emoji: '🍣', price: 7.5 },
    { name: 'Iced Latte', emoji: '🧊', price: 1.5 },
    { name: 'Tiramisu', emoji: '🍰', price: 2.5 },
    { name: 'Garlic Naan', emoji: '🫓', price: 1.2 },
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
