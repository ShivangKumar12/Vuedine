import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Check,
  Copy,
  Download,
  Filter,
  Gift,
  IndianRupee,
  Pencil,
  Percent,
  Plus,
  Search,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import {
  promotionsApi,
  couponFormToInput,
  type CouponDTO,
} from '../../services/promotions';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type CouponKind = 'Percentage' | 'Flat' | 'BOGO' | 'Free Item';
type CouponStatus = 'Active' | 'Scheduled' | 'Paused' | 'Expired';
type Channel = 'POS' | 'QR' | 'Online' | 'All';

type Coupon = {
  id: string;
  code: string;
  title: string;
  kind: CouponKind;
  value: number; // % or flat
  minOrder: number;
  maxDiscount?: number;
  status: CouponStatus;
  channel: Channel;
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  used: number;
  perUser: number;
  description?: string;
};

function adaptCoupon(c: CouponDTO): Coupon {
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    kind: c.kind,
    value: c.value,
    minOrder: c.minOrder,
    maxDiscount: c.maxDiscount,
    status: c.status,
    channel: c.channel,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    used: c.used,
    perUser: c.perUser,
    description: c.description,
  };
}

const kinds: CouponKind[] = ['Percentage', 'Flat', 'BOGO', 'Free Item'];
const statuses: CouponStatus[] = ['Active', 'Scheduled', 'Paused', 'Expired'];
const channels: Channel[] = ['All', 'POS', 'QR', 'Online'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Coupons() {
  const [data, setData] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | CouponStatus>('All');
  const [kind, setKind] = useState<'All' | CouponKind>('All');
  const [drawer, setDrawer] = useState<Coupon | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await promotionsApi.listCoupons();
      setData(list.map(adaptCoupon));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return data.filter((c) => {
      if (search && !c.code.toLowerCase().includes(search.toLowerCase()) && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== 'All' && c.status !== status) return false;
      if (kind !== 'All' && c.kind !== kind) return false;
      return true;
    });
  }, [data, search, status, kind]);

  const totals = useMemo(() => {
    const active = data.filter((c) => c.status === 'Active').length;
    const redemptions = data.reduce((s, c) => s + c.used, 0);
    const savings = data.reduce((s, c) => {
      const avg = c.kind === 'Percentage' ? (c.maxDiscount ?? 80) : c.kind === 'Flat' ? c.value : 60;
      return s + avg * c.used;
    }, 0);
    const conversion = data.length
      ? Math.round((data.reduce((s, c) => s + c.used / Math.max(1, c.usageLimit), 0) / data.length) * 100)
      : 0;
    return { active, redemptions, savings, conversion };
  }, [data]);

  const togglePause = async (c: Coupon) => {
    try {
      const updated = c.status === 'Active'
        ? await promotionsApi.pause(c.id)
        : await promotionsApi.resume(c.id);
      setData((d) => d.map((x) => (x.id === c.id ? adaptCoupon(updated as CouponDTO) : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coupon');
    }
  };

  const remove = async (id: string) => {
    try {
      await promotionsApi.remove(id);
      setData((d) => d.filter((c) => c.id !== id));
      setDrawer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coupon');
    }
  };

  const upsert = async (c: Coupon) => {
    try {
      const input = couponFormToInput(c);
      const exists = data.some((x) => x.id === c.id);
      const saved = exists
        ? await promotionsApi.update(c.id, input)
        : await promotionsApi.create(input);
      const adapted = adaptCoupon(saved as CouponDTO);
      setData((d) => (exists ? d.map((x) => (x.id === c.id ? adapted : x)) : [adapted, ...d]));
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save coupon');
    }
  };

  return (
    <div className="space-y-6">
      <Header onCreate={() => setCreating(true)} />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Active coupons" value={totals.active} icon={Tag} tone="brand" />
        <Stat label="Total redemptions" value={totals.redemptions} icon={Ticket} tone="emerald" />
        <Stat label="Customer savings" value={totals.savings} prefix="₹" icon={IndianRupee} tone="amber" />
        <Stat label="Avg utilisation" value={totals.conversion} suffix="%" icon={TrendingUp} tone="violet" />
      </div>

      <Toolbar
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        kind={kind}
        setKind={setKind}
        count={filtered.length}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-ink-200 bg-white py-20">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
        </div>
      ) : (
        <Table data={filtered} onView={setDrawer} onEdit={setEditing} onTogglePause={togglePause} onDelete={remove} />
      )}

      <AnimatePresence>
        {drawer && <Drawer coupon={drawer} onClose={() => setDrawer(null)} onEdit={() => { setEditing(drawer); setDrawer(null); }} onDelete={() => remove(drawer.id)} />}
      </AnimatePresence>

      <AnimatePresence>
        {(creating || editing) && (
          <CouponModal
            coupon={editing}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSave={upsert}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */
/*  Header                                                      */
/* ============================================================ */

function Header({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Vuedine · promo</div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">Coupons</h1>
        <p className="mt-1 text-[14px] text-ink-600">
          Discount codes, BOGO offers and free-item promotions across every order channel.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button
          onClick={onCreate}
          className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold"
        >
          <Plus className="h-3.5 w-3.5" />
          New coupon
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Stats                                                       */
/* ============================================================ */

const tones = {
  brand: { bg: 'from-brand-500 to-rose-500', text: 'text-brand-700', soft: 'bg-brand-50' },
  emerald: { bg: 'from-emerald-500 to-teal-500', text: 'text-emerald-700', soft: 'bg-emerald-50' },
  amber: { bg: 'from-amber-500 to-orange-500', text: 'text-amber-700', soft: 'bg-amber-50' },
  violet: { bg: 'from-violet-500 to-indigo-500', text: 'text-violet-700', soft: 'bg-violet-50' },
} as const;

function Stat({
  label,
  value,
  prefix,
  suffix,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: typeof Tag;
  tone: keyof typeof tones;
}) {
  const t = tones[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm', t.bg)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1 text-2xl font-extrabold text-ink-900">
        {prefix && <span className="text-base text-ink-500">{prefix}</span>}
        <Counter value={value} />
        {suffix && <span className="text-base text-ink-500">{suffix}</span>}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Toolbar                                                     */
/* ============================================================ */

function Toolbar({
  search, setSearch, status, setStatus, kind, setKind, count,
}: {
  search: string; setSearch: (v: string) => void;
  status: 'All' | CouponStatus; setStatus: (v: 'All' | CouponStatus) => void;
  kind: 'All' | CouponKind; setKind: (v: 'All' | CouponKind) => void;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or title…"
            className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>
        <Select label="Status" value={status} onChange={(v) => setStatus(v as 'All' | CouponStatus)} options={['All', ...statuses]} />
        <Select label="Type" value={kind} onChange={(v) => setKind(v as 'All' | CouponKind)} options={['All', ...kinds]} />
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Filter className="h-3.5 w-3.5" />
          More filters
        </button>
        <div className="ml-auto text-[12px] font-semibold text-ink-500">{count} coupons</div>
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-700">
      <span className="text-ink-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent pr-1 text-ink-900 outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/* ============================================================ */
/*  Table                                                       */
/* ============================================================ */

function Table({
  data, onView, onEdit, onTogglePause, onDelete,
}: {
  data: Coupon[];
  onView: (c: Coupon) => void;
  onEdit: (c: Coupon) => void;
  onTogglePause: (c: Coupon) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Validity</th>
              <th className="px-4 py-3">Used / Limit</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-ink-500">
                  No coupons match these filters.
                </td>
              </tr>
            )}
            {data.map((c) => {
              const usagePct = Math.min(100, Math.round((c.used / Math.max(1, c.usageLimit)) * 100));
              return (
                <tr key={c.id} className="cursor-pointer transition hover:bg-ink-50/60" onClick={() => onView(c)}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-[13px] font-bold text-ink-900">{c.code}</div>
                    <div className="text-[12px] text-ink-500">{c.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <DiscountBadge c={c} />
                    {c.minOrder > 0 && (
                      <div className="mt-0.5 text-[11px] text-ink-500">Min ₹{c.minOrder}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700">{c.channel}</span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-[12px] text-ink-700">
                    <div>{fmtDate(c.startsAt)}</div>
                    <div className="text-ink-500">→ {fmtDate(c.endsAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-semibold text-ink-800">{c.used.toLocaleString()} / {c.usageLimit.toLocaleString()}</div>
                    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-rose-500" style={{ width: `${usagePct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconAction title="Edit" onClick={() => onEdit(c)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                      <IconAction
                        title={c.status === 'Active' ? 'Pause' : 'Activate'}
                        onClick={() => onTogglePause(c)}
                      >
                        {c.status === 'Active' ? <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> : <Check className="h-3.5 w-3.5" />}
                      </IconAction>
                      <IconAction title="Delete" tone="danger" onClick={() => onDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconAction({
  children, title, onClick, tone,
}: {
  children: React.ReactNode; title: string; onClick: () => void; tone?: 'danger';
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700',
        tone === 'danger' && 'hover:border-rose-300 hover:text-rose-600',
      )}
    >
      {children}
    </button>
  );
}

function DiscountBadge({ c }: { c: Coupon }) {
  if (c.kind === 'Percentage') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-700">
        <Percent className="h-3.5 w-3.5" /> {c.value}% off
      </span>
    );
  }
  if (c.kind === 'Flat') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-700">
        <IndianRupee className="h-3.5 w-3.5" /> {c.value} off
      </span>
    );
  }
  if (c.kind === 'BOGO') {
    return <span className="inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">Buy 1 Get 1</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Gift className="h-3 w-3" /> Free item</span>;
}

function StatusPill({ status }: { status: CouponStatus }) {
  const map: Record<CouponStatus, { bg: string; text: string; dot: string }> = {
    Active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Scheduled: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
    Paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    Expired: { bg: 'bg-ink-100', text: 'text-ink-500', dot: 'bg-ink-400' },
  };
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', m.bg, m.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {status}
    </span>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function Drawer({
  coupon, onClose, onEdit, onDelete,
}: {
  coupon: Coupon; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const usagePct = Math.min(100, Math.round((coupon.used / Math.max(1, coupon.usageLimit)) * 100));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 36 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Coupon</div>
            <div className="text-base font-extrabold text-ink-900">{coupon.title}</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border-2 border-dashed border-brand-300 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50 p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Code</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="font-mono text-2xl font-black text-ink-900">{coupon.code}</div>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-brand-700 shadow-sm hover:bg-brand-100"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <DiscountBadge c={coupon} />
              <StatusPill status={coupon.status} />
            </div>
          </div>

          <DetailGrid rows={[
            ['Type', coupon.kind],
            ['Channel', coupon.channel],
            ['Min order', coupon.minOrder ? `₹${coupon.minOrder}` : '—'],
            ['Max discount', coupon.maxDiscount ? `₹${coupon.maxDiscount}` : '—'],
            ['Per user limit', `${coupon.perUser}×`],
            ['Starts', fmtDate(coupon.startsAt)],
            ['Ends', fmtDate(coupon.endsAt)],
          ]} />

          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">Redemption</div>
            <div className="rounded-xl border border-ink-200 bg-white p-4">
              <div className="flex items-center justify-between text-[13px] font-semibold text-ink-800">
                <span>{coupon.used.toLocaleString()} used</span>
                <span className="text-ink-500">of {coupon.usageLimit.toLocaleString()}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-gradient-to-r from-brand-500 to-rose-500" style={{ width: `${usagePct}%` }} />
              </div>
              <div className="mt-1 text-right text-[11px] font-bold text-ink-500">{usagePct}% utilised</div>
            </div>
          </div>

          {coupon.description && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">Description</div>
              <p className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 text-[13px] text-ink-700">
                {coupon.description}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-ink-100 pt-5">
            <button onClick={onEdit} className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold">
              <Pencil className="h-3.5 w-3.5" />
              Edit coupon
            </button>
            <button onClick={onDelete} className="inline-flex items-center justify-center rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[13px] font-bold text-rose-600 hover:border-rose-300 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function DetailGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-ink-200 bg-white p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{k}</div>
          <div className="mt-0.5 text-[13px] font-semibold text-ink-800">{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================ */
/*  Modal                                                       */
/* ============================================================ */

function CouponModal({
  coupon, onClose, onSave,
}: {
  coupon: Coupon | null; onClose: () => void; onSave: (c: Coupon) => void;
}) {
  const [form, setForm] = useState<Coupon>(coupon ?? {
    id: `C-${Math.floor(1000 + Math.random() * 9000)}`,
    code: '',
    title: '',
    kind: 'Percentage',
    value: 10,
    minOrder: 0,
    status: 'Active',
    channel: 'All',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    usageLimit: 1000,
    used: 0,
    perUser: 1,
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-2xl -translate-y-1/2 rounded-2xl border border-ink-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{coupon ? 'Edit' : 'New'}</div>
            <div className="text-base font-extrabold text-ink-900">{coupon ? 'Edit coupon' : 'Create coupon'}</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputCls} placeholder="WELCOME20" /></Field>
          <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="New customer 20% off" /></Field>
          <Field label="Type">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CouponKind })} className={inputCls}>
              {kinds.map((k) => <option key={k}>{k}</option>)}
            </select>
          </Field>
          <Field label="Value">
            <div className="flex items-center gap-2">
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={inputCls} />
              <span className="text-[12px] font-bold text-ink-500">{form.kind === 'Percentage' ? '%' : '₹'}</span>
            </div>
          </Field>
          <Field label="Min order (₹)"><input type="number" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Max discount (₹)"><input type="number" value={form.maxDiscount ?? 0} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Channel">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })} className={inputCls}>
              {channels.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CouponStatus })} className={inputCls}>
              {statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Starts">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={cn(inputCls, 'pl-8')} />
            </div>
          </Field>
          <Field label="Ends">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={cn(inputCls, 'pl-8')} />
            </div>
          </Field>
          <Field label="Usage limit"><input type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="Per-user limit"><input type="number" value={form.perUser} onChange={(e) => setForm({ ...form, perUser: Number(e.target.value) })} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)">
              <textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={cn(inputCls, 'h-auto resize-none py-2')}
                placeholder="Internal note for staff or customer-facing tagline."
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="btn-primary rounded-lg px-4 py-2 text-[13px] font-bold">
            Save coupon
          </button>
        </div>
      </motion.div>
    </>
  );
}

const inputCls = 'h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</span>
      {children}
    </label>
  );
}
