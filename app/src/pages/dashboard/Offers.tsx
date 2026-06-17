import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Download,
  Filter,
  Flame,
  Gift,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import {
  promotionsApi,
  offerFormToInput,
  type OfferDTO,
} from '../../services/promotions';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type OfferKind = 'Happy Hour' | 'Combo' | 'Festival' | 'Loyalty' | 'Featured';
type OfferStatus = 'Live' | 'Scheduled' | 'Paused' | 'Ended';
type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

type Offer = {
  id: string;
  title: string;
  emoji: string;
  hero: string; // gradient class
  kind: OfferKind;
  status: OfferStatus;
  discount: string; // display
  startsAt: string;
  endsAt: string;
  startTime: string; // HH:MM
  endTime: string;
  days: Day[];
  channels: string[];
  redemptions: number;
  revenue: number;
  description: string;
};

const seedOffers: Offer[] = [];
void seedOffers;

function adaptOffer(o: OfferDTO): Offer {
  return {
    id: o.id,
    title: o.title,
    emoji: o.emoji,
    hero: o.hero,
    kind: o.kind,
    status: o.status,
    discount: o.discount,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    startTime: o.startTime,
    endTime: o.endTime,
    days: o.days as Day[],
    channels: o.channels,
    redemptions: o.redemptions,
    revenue: o.revenue,
    description: o.description,
  };
}

const kinds: OfferKind[] = ['Happy Hour', 'Combo', 'Festival', 'Loyalty', 'Featured'];
const statuses: OfferStatus[] = ['Live', 'Scheduled', 'Paused', 'Ended'];
const allDays: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Offers() {
  const [data, setData] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | OfferStatus>('All');
  const [kind, setKind] = useState<'All' | OfferKind>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [drawer, setDrawer] = useState<Offer | null>(null);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await promotionsApi.listOffers();
      setData(list.map(adaptOffer));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    return data.filter((o) => {
      if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== 'All' && o.status !== status) return false;
      if (kind !== 'All' && o.kind !== kind) return false;
      return true;
    });
  }, [data, search, status, kind]);

  const totals = useMemo(() => {
    const live = data.filter((o) => o.status === 'Live').length;
    const scheduled = data.filter((o) => o.status === 'Scheduled').length;
    const redemptions = data.reduce((s, o) => s + o.redemptions, 0);
    const revenue = data.reduce((s, o) => s + o.revenue, 0);
    return { live, scheduled, redemptions, revenue };
  }, [data]);

  const togglePause = async (o: Offer) => {
    try {
      const updated = o.status === 'Live'
        ? await promotionsApi.pause(o.id)
        : await promotionsApi.resume(o.id);
      setData((d) => d.map((x) => (x.id === o.id ? adaptOffer(updated as OfferDTO) : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update offer');
    }
  };
  const remove = async (id: string) => {
    try {
      await promotionsApi.remove(id);
      setData((d) => d.filter((o) => o.id !== id));
      setDrawer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete offer');
    }
  };
  const upsert = async (o: Offer) => {
    try {
      const input = offerFormToInput(o);
      const exists = data.some((x) => x.id === o.id);
      const saved = exists
        ? await promotionsApi.update(o.id, input)
        : await promotionsApi.create(input);
      const adapted = adaptOffer(saved as OfferDTO);
      setData((d) => (exists ? d.map((x) => (x.id === o.id ? adapted : x)) : [adapted, ...d]));
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save offer');
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
        <Stat label="Live offers" value={totals.live} icon={Flame} tone="brand" />
        <Stat label="Scheduled" value={totals.scheduled} icon={Calendar} tone="violet" />
        <Stat label="Redemptions" value={totals.redemptions} icon={Gift} tone="amber" />
        <Stat label="Revenue contribution" value={totals.revenue} prefix="₹" icon={TrendingUp} tone="emerald" />
      </div>

      <Toolbar
        search={search} setSearch={setSearch}
        status={status} setStatus={setStatus}
        kind={kind} setKind={setKind}
        view={view} setView={setView}
        count={filtered.length}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-ink-200 bg-white py-20">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && <EmptyState />}
          {filtered.map((o) => (
            <OfferCard key={o.id} offer={o} onClick={() => setDrawer(o)} onTogglePause={() => togglePause(o)} />
          ))}
        </div>
      ) : (
        <ListView data={filtered} onView={setDrawer} onEdit={setEditing} onDelete={remove} />
      )}

      <AnimatePresence>
        {drawer && <Drawer offer={drawer} onClose={() => setDrawer(null)} onEdit={() => { setEditing(drawer); setDrawer(null); }} onDelete={() => remove(drawer.id)} />}
      </AnimatePresence>

      <AnimatePresence>
        {(creating || editing) && (
          <OfferModal offer={editing} onClose={() => { setEditing(null); setCreating(false); }} onSave={upsert} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */

function Header({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Vuedine · promo</div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">Offers</h1>
        <p className="mt-1 text-[14px] text-ink-600">
          Curate happy-hours, festival specials and loyalty bundles. Schedule them once — Vuedine handles the rest.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold">
          <Plus className="h-3.5 w-3.5" />
          New offer
        </button>
      </div>
    </div>
  );
}

const tones = {
  brand: { bg: 'from-brand-500 to-rose-500' },
  emerald: { bg: 'from-emerald-500 to-teal-500' },
  amber: { bg: 'from-amber-500 to-orange-500' },
  violet: { bg: 'from-violet-500 to-indigo-500' },
} as const;

function Stat({ label, value, prefix, icon: Icon, tone }: { label: string; value: number; prefix?: string; icon: typeof Flame; tone: keyof typeof tones }) {
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
      </div>
    </div>
  );
}

function Toolbar({
  search, setSearch, status, setStatus, kind, setKind, view, setView, count,
}: {
  search: string; setSearch: (v: string) => void;
  status: 'All' | OfferStatus; setStatus: (v: 'All' | OfferStatus) => void;
  kind: 'All' | OfferKind; setKind: (v: 'All' | OfferKind) => void;
  view: 'grid' | 'list'; setView: (v: 'grid' | 'list') => void;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search offers…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
        </div>
        <Select label="Status" value={status} onChange={(v) => setStatus(v as 'All' | OfferStatus)} options={['All', ...statuses]} />
        <Select label="Type" value={kind} onChange={(v) => setKind(v as 'All' | OfferKind)} options={['All', ...kinds]} />
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Filter className="h-3.5 w-3.5" />
          More filters
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-[12px] font-semibold text-ink-500">{count} offers</div>
          <div className="inline-flex items-center rounded-lg border border-ink-200 bg-white p-0.5">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition',
                  view === v ? 'rounded-md bg-brand-500 text-white shadow-sm' : 'text-ink-500 hover:text-ink-700',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-700">
      <span className="text-ink-500">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent pr-1 text-ink-900 outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full rounded-2xl border-2 border-dashed border-ink-200 bg-white p-16 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-ink-300" />
      <div className="mt-3 text-base font-bold text-ink-700">No offers match these filters</div>
      <div className="mt-1 text-sm text-ink-500">Try clearing the search or pick a different category.</div>
    </div>
  );
}

/* ============================================================ */
/*  Cards                                                       */
/* ============================================================ */

function OfferCard({ offer, onClick, onTogglePause }: { offer: Offer; onClick: () => void; onTogglePause: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white text-left shadow-sm transition hover:shadow-xl"
    >
      <div className={cn('relative h-32 overflow-hidden bg-gradient-to-br', offer.hero)}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white, transparent 60%)' }} />
        <div className="relative flex h-full items-center justify-between px-5">
          <div className="text-5xl">{offer.emoji}</div>
          <StatusPill status={offer.status} />
        </div>
        <div className="absolute bottom-2 left-5 text-[10px] font-bold uppercase tracking-widest text-white/80">{offer.kind}</div>
      </div>

      <div className="p-5">
        <div className="text-base font-extrabold text-ink-900">{offer.title}</div>
        <div className="mt-1 text-[13px] font-semibold text-brand-700">{offer.discount}</div>

        <div className="mt-3 flex items-center gap-3 text-[12px] text-ink-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-ink-400" />
            {offer.startTime}–{offer.endTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-ink-400" />
            {offer.days.length === 7 ? 'Daily' : offer.days.join(', ')}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Redemptions</div>
            <div className="text-sm font-extrabold text-ink-900">{offer.redemptions.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Revenue</div>
            <div className="text-sm font-extrabold text-emerald-700">₹{(offer.revenue / 1000).toFixed(1)}k</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePause(); }}
            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-700 transition group-hover:border-brand-300 group-hover:text-brand-700"
          >
            {offer.status === 'Live' ? 'Pause' : 'Activate'}
          </button>
        </div>
      </div>
    </motion.button>
  );
}

function ListView({
  data, onView, onEdit, onDelete,
}: {
  data: Offer[]; onView: (o: Offer) => void; onEdit: (o: Offer) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Offer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Redemptions</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-ink-500">No offers found.</td></tr>
            )}
            {data.map((o) => (
              <tr key={o.id} className="cursor-pointer transition hover:bg-ink-50/60" onClick={() => onView(o)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-lg', o.hero)}>{o.emoji}</span>
                    <div>
                      <div className="font-bold text-ink-900">{o.title}</div>
                      <div className="text-[11px] font-semibold text-brand-700">{o.discount}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="inline-flex rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700">{o.kind}</span></td>
                <td className="px-4 py-3 text-[12px] text-ink-700">
                  <div>{o.startTime}–{o.endTime}</div>
                  <div className="text-ink-500">{o.days.length === 7 ? 'Daily' : o.days.join(', ')}</div>
                </td>
                <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                <td className="px-4 py-3 text-right font-bold text-ink-900">{o.redemptions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">₹{o.revenue.toLocaleString()}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconAction title="Edit" onClick={() => onEdit(o)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                    <IconAction title="Delete" tone="danger" onClick={() => onDelete(o.id)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IconAction({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button title={title} onClick={onClick} className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700', tone === 'danger' && 'hover:border-rose-300 hover:text-rose-600')}>{children}</button>
  );
}

function StatusPill({ status }: { status: OfferStatus }) {
  const map: Record<OfferStatus, { bg: string; text: string; dot: string }> = {
    Live: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Scheduled: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
    Paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    Ended: { bg: 'bg-ink-100', text: 'text-ink-500', dot: 'bg-ink-400' },
  };
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold backdrop-blur', m.bg, m.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot, status === 'Live' && 'animate-pulse')} />
      {status}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function Drawer({ offer, onClose, onEdit, onDelete }: { offer: Offer; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 36 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className={cn('relative h-44 overflow-hidden bg-gradient-to-br', offer.hero)}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white, transparent 60%)' }} />
          <button onClick={onClose} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur hover:bg-white/30">
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="text-5xl">{offer.emoji}</div>
            <div className="mt-2 text-xl font-extrabold text-white drop-shadow">{offer.title}</div>
            <div className="mt-1 text-[13px] font-semibold text-white/90">{offer.discount}</div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <StatusPill status={offer.status} />
            <span className="inline-flex rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700">{offer.kind}</span>
            {offer.channels.map((c) => (
              <span key={c} className="inline-flex rounded-md border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-700">{c}</span>
            ))}
          </div>

          <p className="rounded-xl bg-ink-50/60 p-4 text-[13px] text-ink-700">{offer.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <Detail label="Starts" value={fmtDate(offer.startsAt)} />
            <Detail label="Ends" value={fmtDate(offer.endsAt)} />
            <Detail label="Hours" value={`${offer.startTime}–${offer.endTime}`} />
            <Detail label="Days" value={offer.days.length === 7 ? 'Daily' : offer.days.join(', ')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-200 bg-gradient-to-br from-brand-50 to-rose-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Redemptions</div>
              <div className="mt-1 text-2xl font-black text-brand-700">{offer.redemptions.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-ink-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Revenue</div>
              <div className="mt-1 text-2xl font-black text-emerald-700">₹{(offer.revenue / 1000).toFixed(1)}k</div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-ink-100 pt-5">
            <button onClick={onEdit} className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold">
              <Pencil className="h-3.5 w-3.5" />
              Edit offer
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-ink-800">{value}</div>
    </div>
  );
}

/* ============================================================ */
/*  Modal                                                       */
/* ============================================================ */

function OfferModal({ offer, onClose, onSave }: { offer: Offer | null; onClose: () => void; onSave: (o: Offer) => void }) {
  const [form, setForm] = useState<Offer>(offer ?? {
    id: `O-${Math.floor(3000 + Math.random() * 9000)}`,
    title: '',
    emoji: '✨',
    hero: 'from-brand-500 via-rose-500 to-amber-500',
    kind: 'Combo',
    status: 'Live',
    discount: '',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '22:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    channels: ['POS', 'QR', 'Online'],
    redemptions: 0,
    revenue: 0,
    description: '',
  });

  const toggleDay = (d: Day) => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90vh] max-w-2xl -translate-y-1/2 overflow-y-auto rounded-2xl border border-ink-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{offer ? 'Edit' : 'New'}</div>
            <div className="text-base font-extrabold text-ink-900">{offer ? 'Edit offer' : 'Create offer'}</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Happy Hour — 5 to 7 PM" /></Field></div>
          <Field label="Emoji"><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className={inputCls} maxLength={2} /></Field>
          <Field label="Type">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as OfferKind })} className={inputCls}>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
          </Field>
          <div className="sm:col-span-2"><Field label="Discount summary"><input value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className={inputCls} placeholder="Flat 30% off drinks" /></Field></div>
          <Field label="Start date"><input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputCls} /></Field>
          <Field label="End date"><input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={inputCls} /></Field>
          <Field label="Start time"><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputCls} /></Field>
          <Field label="End time"><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="Days of week">
              <div className="flex flex-wrap gap-1.5">
                {allDays.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                      form.days.includes(d)
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'border border-ink-200 bg-white text-ink-600 hover:border-brand-300',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OfferStatus })} className={inputCls}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Hero theme">
            <select value={form.hero} onChange={(e) => setForm({ ...form, hero: e.target.value })} className={inputCls}>
              <option value="from-brand-500 via-rose-500 to-amber-500">Brand fire</option>
              <option value="from-amber-500 via-orange-500 to-rose-500">Sunset</option>
              <option value="from-emerald-500 via-teal-500 to-cyan-500">Mint</option>
              <option value="from-violet-500 via-indigo-500 to-sky-500">Aurora</option>
              <option value="from-rose-500 via-pink-500 to-fuchsia-500">Bloom</option>
              <option value="from-sky-500 via-cyan-500 to-emerald-500">Lagoon</option>
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} placeholder="What customers see in their feed and at checkout." /></Field></div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary rounded-lg px-4 py-2 text-[13px] font-bold">Save offer</button>
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
