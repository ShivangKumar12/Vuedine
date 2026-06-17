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
  Gift,
  IndianRupee,
  RefreshCcw,
  Search,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import {
  transactionsApi,
  type Transaction as ApiTransaction,
  type TransactionsStats,
} from '../../services/transactions';
import { branchesStore } from '../../stores/branches';
import { socketClient } from '../../lib/socket';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type Method = 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Online' | 'Loyalty';
type TxType = 'Sale' | 'Refund' | 'Tip' | 'Settlement' | 'Comp';
type TxStatus = 'Success' | 'Pending' | 'Failed' | 'Refunded';

type Transaction = {
  id: string; // TXN-...
  serverId: string;
  orderId: string | null;
  orderSerial: string;
  date: string;
  iso: string;
  method: Method;
  type: TxType;
  status: TxStatus;
  amount: number;
  channel: 'POS' | 'Online' | 'QR' | 'Waiter' | string;
  cashier?: string;
  customer?: string;
  reference?: string;
  fee?: number;
};

function adapt(t: ApiTransaction): Transaction {
  return {
    id: t.id,
    serverId: t.serverId,
    orderId: t.orderId,
    orderSerial: t.orderSerial,
    date: t.date,
    iso: t.iso,
    method: t.method,
    type: t.type,
    status: t.status,
    amount: t.amount,
    channel: (t.channel as Transaction['channel']) ?? 'POS',
    cashier: t.cashier ?? undefined,
    customer: t.customer ?? undefined,
    reference: t.reference ?? undefined,
    fee: t.fee,
  };
}

const methods: Method[] = ['Cash', 'Card', 'UPI', 'Wallet', 'Online', 'Loyalty'];
const types: TxType[] = ['Sale', 'Refund', 'Tip', 'Settlement', 'Comp'];

const METHOD_TO_CODE: Record<Method, ApiTransaction['methodCode']> = {
  Cash: 'CASH',
  Card: 'CARD',
  UPI: 'UPI',
  Wallet: 'WALLET',
  Online: 'ONLINE',
  Loyalty: 'LOYALTY',
};
const TYPE_TO_CODE: Record<TxType, ApiTransaction['typeCode']> = {
  Sale: 'SALE',
  Refund: 'REFUND',
  Tip: 'TIP',
  Settlement: 'SETTLEMENT',
  Comp: 'COMP',
};
const STATUS_TO_CODE: Record<TxStatus, ApiTransaction['statusCode']> = {
  Success: 'SUCCESS',
  Pending: 'PENDING',
  Failed: 'FAILED',
  Refunded: 'REFUNDED',
};

const _legacyTx: Transaction[] = [];
void _legacyTx;

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Transactions() {
  const branches = branchesStore.use();
  const [tx, setTx] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<'All' | Method>('All');
  const [type, setType] = useState<'All' | TxType>('All');
  const [status, setStatus] = useState<'All' | TxStatus>('All');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [drawer, setDrawer] = useState<Transaction | null>(null);
  const [refundOpen, setRefundOpen] = useState<Transaction | null>(null);

  const refresh = async () => {
    if (!branches.activeId) {
      setTx([]);
      setStats(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        transactionsApi.list({
          branchId: branches.activeId,
          pageSize: 200,
          method: method === 'All' ? undefined : METHOD_TO_CODE[method],
          type: type === 'All' ? undefined : TYPE_TO_CODE[type],
          status: status === 'All' ? undefined : STATUS_TO_CODE[status],
          search: search || undefined,
        }),
        transactionsApi.stats(branches.activeId),
      ]);
      setTx(list.map(adapt));
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  // Initial + branch change.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.activeId]);

  // Refresh on filter change (debounced).
  useEffect(() => {
    const t = window.setTimeout(refresh, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, method, type, status]);

  // Live update on payment events.
  useEffect(() => {
    const off = socketClient.on('payment:created', () => refresh());
    const off2 = socketClient.on('payment:status', () => refresh());
    return () => {
      off();
      off2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side filter is no longer strictly necessary (server filters) but
  // we keep it so the UI stays responsive while a refresh is in flight.
  const filtered = useMemo(() => {
    return tx.filter((t) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.id.toLowerCase().includes(s) &&
          !t.orderSerial.toLowerCase().includes(s) &&
          !(t.customer ?? '').toLowerCase().includes(s) &&
          !(t.reference ?? '').toLowerCase().includes(s)
        )
          return false;
      }
      if (method !== 'All' && t.method !== method) return false;
      if (type !== 'All' && t.type !== type) return false;
      if (status !== 'All' && t.status !== status) return false;
      return true;
    });
  }, [tx, search, method, type, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const methodMix = useMemo(() => {
    if (!stats) {
      return methods.map((m) => ({ method: m, value: 0, share: 0 }));
    }
    const codeToLabel: Record<string, Method> = {
      CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet', ONLINE: 'Online', LOYALTY: 'Loyalty',
    };
    return stats.methodMix
      .map((m) => ({
        method: codeToLabel[m.method] ?? 'Cash',
        value: m.amount,
        share: m.share,
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = { All: tx.length };
    methods.forEach((m) => {
      counts[m] = tx.filter((t) => t.method === m).length;
    });
    return counts;
  }, [tx]);

  const handleRefund = async (transaction: Transaction, amount: number, reason?: string) => {
    if (!transaction.orderId) return;
    try {
      await transactionsApi.refund(transaction.orderId, transaction.serverId, amount, reason);
      setRefundOpen(null);
      setDrawer(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    }
  };

  const handleRetry = async (transaction: Transaction) => {
    try {
      await transactionsApi.recapture(transaction.serverId);
      setDrawer(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry capture failed');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setMethod('All');
    setType('All');
    setStatus('All');
    setPage(1);
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(method !== 'All') +
    Number(type !== 'All') +
    Number(status !== 'All');

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Kpi
            label="Gross sales"
            value={stats?.grossSales ?? 0}
            prefix="$"
            tone="brand"
            icon={IndianRupee}
          />
          <Kpi
            label="Refunds"
            value={stats?.refunds ?? 0}
            prefix="$"
            tone="rose"
            icon={ArrowDownRight}
          />
          <Kpi label="Tips" value={stats?.tips ?? 0} prefix="$" tone="emerald" icon={Sparkles} />
          <Kpi label="Gateway fees" value={stats?.fees ?? 0} prefix="$" tone="amber" icon={CreditCard} />
          <Kpi
            label="Net revenue"
            value={stats?.net ?? 0}
            prefix="$"
            tone="cool"
            icon={TrendingUp}
          />
        </div>

        {/* Method mix bar */}
        <MethodMix mix={methodMix} />

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Transactions</h2>
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
              <DateRangePicker label="06/01/2026 — 06/30/2026" />
              <FilterMenu
                method={method}
                setMethod={(v) => { setMethod(v); setPage(1); }}
                type={type}
                setType={(v) => { setType(v); setPage(1); }}
                status={status}
                setStatus={(v) => { setStatus(v); setPage(1); }}
              />
              <ExportMenu />
            </div>
          </div>

          {/* Method pills */}
          <MethodPills value={method} onChange={(v) => { setMethod(v); setPage(1); }} counts={methodCounts} />

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100">
              <thead>
                <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  <Th>Transaction ID</Th>
                  <Th>Date</Th>
                  <Th>Payment method</Th>
                  <Th>Order serial</Th>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <th className="px-5 py-3 text-right font-bold">Amount</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-sm">
                {visible.map((t, i) => (
                  <Row
                    key={t.id}
                    t={t}
                    i={i}
                    onView={() => setDrawer(t)}
                    onRefund={() => setRefundOpen(t)}
                    onRetry={() => handleRetry(t)}
                  />
                ))}
                {visible.length === 0 && <EmptyState onReset={clearFilters} />}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
            <div className="text-[12px] font-medium text-ink-500">
              Showing <span className="font-bold text-ink-900">{filtered.length === 0 ? 0 : start + 1}</span> to{' '}
              <span className="font-bold text-ink-900">{Math.min(start + pageSize, filtered.length)}</span> of{' '}
              <span className="font-bold text-ink-900">{filtered.length}</span> transactions
            </div>
            <Pagination current={safePage} total={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      <TransactionDrawer
        t={drawer}
        onClose={() => setDrawer(null)}
        onOpenRefund={(t) => setRefundOpen(t)}
        onRetry={(t) => handleRetry(t)}
      />
      <RefundModal
        t={refundOpen}
        onClose={() => setRefundOpen(null)}
        onConfirm={(amount, reason) => {
          if (refundOpen) handleRefund(refundOpen, amount, reason);
        }}
      />
      {error && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-700 shadow-2xl">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {loading && (
        <div className="pointer-events-none fixed top-20 right-6 z-40 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-ink-600 shadow-md">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          Refreshing…
        </div>
      )}
    </>
  );
}

/* ============================================================ */
/*  Refund modal                                                */
/* ============================================================ */

function RefundModal({
  t,
  onClose,
  onConfirm,
}: {
  t: Transaction | null;
  onClose: () => void;
  onConfirm: (amount: number, reason?: string) => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (t) setAmount(t.amount);
    else setAmount(0);
    setReason('');
    setSubmitting(false);
  }, [t]);

  if (!t) return null;
  const max = t.amount;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2"
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-5 text-white">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Refund</div>
            <div className="mt-1 font-mono text-xl font-extrabold">{t.id}</div>
            <div className="mt-1 text-[13px] text-white/85">
              {t.method} · {t.orderSerial} · ${t.amount.toFixed(2)}
            </div>
          </div>
          <div className="space-y-3 p-5">
            <label className="block text-[12px] font-bold uppercase tracking-wider text-ink-500">
              Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={max}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
                className="vue-input pl-7"
              />
            </div>
            <div className="text-[11px] text-ink-500">Max refundable: ${max.toFixed(2)}</div>
            <label className="block pt-2 text-[12px] font-bold uppercase tracking-wider text-ink-500">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer changed mind"
              className="vue-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
            >
              Cancel
            </button>
            <button
              disabled={amount <= 0 || amount > max || submitting}
              onClick={async () => {
                setSubmitting(true);
                onConfirm(amount, reason || undefined);
              }}
              className="rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none"
            >
              {submitting ? 'Refunding…' : `Refund $${amount.toFixed(2)}`}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Row                                                         */
/* ============================================================ */

function Row({
  t,
  i,
  onView,
  onRefund,
  onRetry,
}: {
  t: Transaction;
  i: number;
  onView: () => void;
  onRefund: () => void;
  onRetry: () => void;
}) {
  const isNeg = t.amount < 0;
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: i * 0.02 }}
      className="group cursor-pointer transition-colors hover:bg-ink-50/60"
      onClick={onView}
    >
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">{t.id}</div>
        {t.reference && (
          <div className="mt-0.5 truncate font-mono text-[10px] text-ink-400" style={{ maxWidth: 180 }}>
            {t.reference}
          </div>
        )}
      </td>
      <td className="px-5 py-3 text-[13px] font-medium text-ink-700">{t.date}</td>
      <td className="px-5 py-3">
        <MethodPill method={t.method} />
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">via {t.channel}</div>
      </td>
      <td className="px-5 py-3 font-mono text-sm font-semibold text-ink-700">{t.orderSerial}</td>
      <td className="px-5 py-3 text-[13px] font-semibold text-ink-700">
        {t.customer ?? <span className="text-ink-400">—</span>}
      </td>
      <td className="px-5 py-3">
        <TypePill type={t.type} />
      </td>
      <td className="px-5 py-3">
        <StatusPill status={t.status} />
      </td>
      <td className="px-5 py-3 text-right">
        <div
          className={cn(
            'font-mono text-sm font-extrabold',
            isNeg ? 'text-rose-600' : 'text-ink-900',
          )}
        >
          {isNeg ? '−' : ''}${Math.abs(t.amount).toFixed(2)}
        </div>
        {t.fee && t.fee > 0 ? (
          <div className="text-[10px] font-medium text-ink-400">fee · ${t.fee.toFixed(2)}</div>
        ) : null}
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="View" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          {t.type === 'Sale' && (t.status === 'Pending' || t.status === 'Failed') && (
            <ActionButton tone="amber" label="Retry capture" onClick={onRetry}>
              <RefreshCcw className="h-3.5 w-3.5" />
            </ActionButton>
          )}
          {t.type === 'Sale' && t.status === 'Success' && (
            <ActionButton tone="rose" label="Refund" onClick={onRefund}>
              <ArrowDownRight className="h-3.5 w-3.5" />
            </ActionButton>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

/* ============================================================ */
/*  Method mix horizontal bar                                   */
/* ============================================================ */

function MethodMix({
  mix,
}: {
  mix: { method: Method; value: number; share: number }[];
}) {
  const colors: Record<Method, string> = {
    UPI: 'from-brand-500 to-rose-500',
    Card: 'from-blue-500 to-cool-500',
    Cash: 'from-emerald-500 to-emerald-600',
    Online: 'from-violet-500 to-pink-500',
    Wallet: 'from-warm-500 to-amber-500',
    Loyalty: 'from-amber-500 to-amber-600',
  };
  const total = mix.reduce((s, m) => s + m.value, 0);
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Payment mix</div>
          <div className="text-sm font-extrabold text-ink-900">
            ${total.toFixed(2)} captured today
          </div>
        </div>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink-100">
        {mix.map((m, i) => {
          const w = m.share * 100;
          if (w < 0.5) return null;
          return (
            <motion.div
              key={m.method}
              initial={{ width: 0 }}
              animate={{ width: `${w}%` }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn('h-full bg-gradient-to-r', colors[m.method])}
              title={`${m.method} · ${(w).toFixed(0)}%`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold">
        {mix.map((m) => (
          <div key={m.method} className="inline-flex items-center gap-1.5">
            <span
              className={cn('h-2 w-3 rounded-full bg-gradient-to-r', colors[m.method])}
            />
            <span className="text-ink-700">{m.method}</span>
            <span className="font-mono text-ink-900">${m.value.toFixed(2)}</span>
            <span className="text-ink-400">·</span>
            <span className="text-ink-500">{(m.share * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Method pills row                                            */
/* ============================================================ */

function MethodPills({
  value,
  onChange,
  counts,
}: {
  value: 'All' | Method;
  onChange: (v: 'All' | Method) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-ink-100 bg-ink-50/40 px-4 py-3 sm:px-5">
      {(['All', ...methods] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
            )}
          >
            {m !== 'All' && (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                <MethodIcon method={m} />
              </span>
            )}
            {m}
            <span
              className={cn(
                'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
              )}
            >
              {counts[m]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Method / type / status pills                                */
/* ============================================================ */

const methodMeta: Record<
  Method,
  { pill: string; icon: React.ElementType }
> = {
  UPI: { pill: 'bg-brand-50 text-brand-700 ring-brand-200', icon: Smartphone },
  Card: { pill: 'bg-blue-50 text-blue-700 ring-blue-200', icon: CreditCard },
  Cash: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Banknote },
  Online: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', icon: Wallet },
  Wallet: { pill: 'bg-warm-50 text-warm-700 ring-warm-200', icon: Wallet },
  Loyalty: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', icon: Gift },
};

function MethodPill({ method }: { method: Method }) {
  const Icon = methodMeta[method].icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        methodMeta[method].pill,
      )}
    >
      <Icon className="h-3 w-3" />
      {method}
    </span>
  );
}

function MethodIcon({ method }: { method: Method }) {
  const Icon = methodMeta[method].icon;
  return <Icon className="h-3 w-3" />;
}

const typeMeta: Record<TxType, string> = {
  Sale: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Refund: 'bg-rose-50 text-rose-700 ring-rose-200',
  Tip: 'bg-amber-50 text-amber-700 ring-amber-200',
  Settlement: 'bg-cool-50 text-cool-700 ring-cool-200',
  Comp: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function TypePill({ type }: { type: TxType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
        typeMeta[type],
      )}
    >
      {type}
    </span>
  );
}

const statusMeta: Record<TxStatus, { pill: string; dot: string }> = {
  Success: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Pending: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  Failed: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  Refunded: { pill: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
};

function StatusPill({ status }: { status: TxStatus }) {
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
            <div className={cn('mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold', up ? 'text-emerald-600' : 'text-rose-600')}>
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
      <span className="text-ink-900">Transactions</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by id, ref, customer…"
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
  method,
  setMethod,
  type,
  setType,
  status,
  setStatus,
}: {
  method: 'All' | Method;
  setMethod: (v: 'All' | Method) => void;
  type: 'All' | TxType;
  setType: (v: 'All' | TxType) => void;
  status: 'All' | TxStatus;
  setStatus: (v: 'All' | TxStatus) => void;
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-72 space-y-3 p-2">
          <FilterGroup label="Method">
            {(['All', ...methods] as const).map((m) => (
              <FilterChip key={m} active={method === m} onClick={() => setMethod(m)}>
                {m}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Type">
            {(['All', ...types] as const).map((t) => (
              <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                {t}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            {(['All', 'Success', 'Pending', 'Failed', 'Refunded'] as const).map((s) => (
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

function ExportMenu() {
  return (
    <Dropdown label="Export" icon={<Download className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Export as</DropHeader>
          {['CSV', 'Excel (.xlsx)', 'PDF', 'GST report (PDF)'].map((t) => (
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
  tone: 'brand' | 'rose' | 'amber';
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500'
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

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <tr>
      <td colSpan={9} className="px-5 py-16 text-center">
        <div className="text-base font-bold text-ink-700">No transactions match</div>
        <div className="mt-1 text-sm text-ink-500">Try adjusting filters or selecting a wider date range.</div>
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
/*  Detail drawer                                               */
/* ============================================================ */

function TransactionDrawer({
  t,
  onClose,
  onOpenRefund,
  onRetry,
}: {
  t: Transaction | null;
  onClose: () => void;
  onOpenRefund?: (t: Transaction) => void;
  onRetry?: (t: Transaction) => void;
}) {
  return (
    <AnimatePresence>
      {t && (
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
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Transaction</div>
              <div className="mt-1 font-mono text-2xl font-extrabold">{t.id}</div>
              <div className={cn('mt-3 text-3xl font-extrabold', t.amount < 0 ? 'text-rose-100' : 'text-white')}>
                {t.amount < 0 ? '−' : ''}${Math.abs(t.amount).toFixed(2)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{t.type}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">{t.method}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5">via {t.channel}</span>
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              <Section title="Status">
                <Timeline status={t.status} />
              </Section>

              <Section title="Details">
                <ul className="space-y-2 text-sm">
                  <Detail label="Date">{t.date}</Detail>
                  <Detail label="Order">
                    <Link to="/dashboard/pos-orders" className="font-mono font-bold text-brand-600 hover:underline">
                      {t.orderSerial}
                    </Link>
                  </Detail>
                  {t.customer && <Detail label="Customer">{t.customer}</Detail>}
                  {t.cashier && <Detail label="Cashier">{t.cashier}</Detail>}
                  {t.reference && (
                    <Detail label="Reference">
                      <span className="font-mono">{t.reference}</span>
                    </Detail>
                  )}
                </ul>
              </Section>

              <Section title="Money flow">
                <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                  <Line label="Amount">${Math.abs(t.amount).toFixed(2)}</Line>
                  {t.fee && t.fee > 0 ? (
                    <Line label="Gateway fee">
                      <span className="text-rose-600">−${t.fee.toFixed(2)}</span>
                    </Line>
                  ) : null}
                  <div className="my-1 border-t border-dashed border-ink-200" />
                  <Line label="Net to outlet" emphasis>
                    ${(Math.abs(t.amount) - (t.fee ?? 0)).toFixed(2)}
                  </Line>
                </div>
              </Section>
            </div>

            <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-ink-100 bg-white p-4">
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                Receipt
              </button>
              <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                Email
              </button>
              {t.type === 'Sale' && (t.status === 'Pending' || t.status === 'Failed') ? (
                <button
                  onClick={() => onRetry?.(t)}
                  className="rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/30 transition hover:bg-amber-600"
                >
                  Retry capture
                </button>
              ) : (
                <button
                  disabled={t.type !== 'Sale' || t.status !== 'Success'}
                  onClick={() => onOpenRefund?.(t)}
                  className="rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none"
                >
                  Refund
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

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2">
      <span className="text-[12px] font-bold uppercase tracking-wider text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{children}</span>
    </li>
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

const flow: TxStatus[] = ['Pending', 'Success', 'Refunded'];

function Timeline({ status }: { status: TxStatus }) {
  if (status === 'Failed') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
        <div className="font-bold text-rose-700">Failed</div>
        <div className="mt-1 text-[12px] text-rose-600">
          Payment could not be captured. The order remains unpaid.
        </div>
      </div>
    );
  }
  const idx = flow.indexOf(status);
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3">
      <ul className="relative space-y-3">
        <span className="absolute left-2.5 top-3 h-[calc(100%-1.5rem)] w-0.5 bg-ink-100" />
        {flow.map((s, i) => {
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
  );
}
