import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Mail,
  Phone,
  Pencil,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import {
  usersApi,
  type Subscriber,
  type SubscriberInput,
} from '../../services/users';
import { segmentsApi, type Segment } from '../../services/segments';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type SubChannel = 'Email' | 'SMS' | 'WhatsApp' | 'Push';
type SubStatus = 'Subscribed' | 'Unsubscribed' | 'Bounced';
type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

// The Subscriber type comes from services/users.ts — we alias the label strings here
// to keep local type predicates working with the friendly label values.
// API subscriber.tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' (serialized label)
// API subscriber.status = 'Subscribed' | 'Unsubscribed' | 'Bounced'
const _seedSubscribers: Subscriber[] = [];
void _seedSubscribers;

const tiers: Tier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const statuses: SubStatus[] = ['Subscribed', 'Unsubscribed', 'Bounced'];
const channelOptions: SubChannel[] = ['Email', 'SMS', 'WhatsApp', 'Push'];

const SEGMENT_TONES: Record<string, string> = {
  all: 'from-brand-500 to-rose-500',
  vip: 'from-violet-500 to-fuchsia-500',
  loyal: 'from-emerald-500 to-teal-500',
  lapsed: 'from-amber-500 to-orange-500',
  new: 'from-sky-500 to-cyan-500',
};

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Subscribers() {
  const [data, setData] = useState<Subscriber[]>([]);
  const [apiSegments, setApiSegments] = useState<Segment[]>([]);
  const [, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [tier, setTier] = useState<'All' | Tier>('All');
  const [status, setStatus] = useState<'All' | SubStatus>('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<Subscriber | null>(null);
  const [editing, setEditing] = useState<Subscriber | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const SYSTEM_KEYS = ['vip', 'loyal', 'lapsed', 'new'];

  const refresh = (segKey = segment) => {
    setLoading(true);
    setApiError(null);
    const sysSeg = apiSegments.find((s) => s.id === segKey)?.systemKey ?? segKey;
    const serverSegment = SYSTEM_KEYS.includes(sysSeg) ? sysSeg : undefined;
    usersApi
      .listSubscribers({ pageSize: 200, segment: serverSegment })
      .then((list) => setData(list))
      .catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to load subscribers'))
      .finally(() => setLoading(false));
  };

  const loadSegments = () => {
    segmentsApi.list().then(setApiSegments).catch(() => {});
  };

  useEffect(() => {
    refresh('all');
    loadSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectSegment = (segId: string) => {
    setSegment(segId);
    setPage(1);
    refresh(segId);
  };

  const filtered = useMemo(() => {
    return data.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.phone.includes(q)) return false;
      }
      if (tier !== 'All' && s.tier !== tier) return false;
      if (status !== 'All' && s.status !== status) return false;
      return true;
    });
  }, [data, search, tier, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totals = useMemo(() => {
    const total = data.length;
    const subscribed = data.filter((s) => s.status === 'Subscribed').length;
    const newThisMonth = data.filter((s) => (Date.now() - new Date(s.joinedAt).getTime()) / 86400000 < 30).length;
    const ltv = Math.round(data.reduce((sum, s) => sum + s.spend, 0) / Math.max(1, total));
    return { total, subscribed, newThisMonth, ltv };
  }, [data]);

  const remove = (id: string) => {
    usersApi.deleteSubscriber(id).then(() => {
      setData((d) => d.filter((s) => s.id !== id));
      setDrawer(null);
    }).catch((err) => setApiError(err instanceof Error ? err.message : 'Delete failed'));
  };
  const upsert = async (s: SubscriberInput & { id?: string }) => {
    try {
      if (s.id && data.some((x) => x.id === s.id)) {
        const updated = await usersApi.updateSubscriber(s.id, s);
        setData((d) => d.map((x) => x.id === s.id ? updated : x));
      } else {
        const created = await usersApi.createSubscriber(s);
        setData((d) => [created, ...d]);
      }
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const res = await usersApi.importCustomers(text);
      setNotice(`Imported ${res.created} new, updated ${res.updated}, skipped ${res.skipped}.`);
      refresh();
      loadSegments();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const onExport = () => {
    const header = 'name,email,phone,channels,tier,city,orders,spend,status\n';
    const rows = filtered
      .map((s) => [s.name, s.email, s.phone, s.channels.join('|'), s.tier, s.city, s.orders, s.spend, s.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vuedine-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulk = async (action: 'unsubscribe' | 'tag' | 'delete', tags?: string[]) => {
    if (selected.length === 0) return;
    try {
      const res = await usersApi.bulkCustomers({ ids: selected, action, tags });
      setNotice(`${action} applied to ${res.affected} subscribers.`);
      setSelected([]);
      refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Bulk action failed');
    }
  };

  const toggleAll = (checked: boolean) => setSelected(checked ? visible.map((s) => s.id) : []);
  const toggleOne = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="space-y-6">
      <Header onCreate={() => setCreating(true)} onImport={() => fileRef.current?.click()} onExport={onExport} />
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onImportFile(e.target.files?.[0])} />

      {apiError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-700">
          {apiError}
          <button onClick={() => setApiError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-bold text-emerald-700">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Total subscribers" value={totals.total} icon={Users} tone="brand" />
        <Stat label="Subscribed" value={totals.subscribed} icon={Mail} tone="emerald" />
        <Stat label="New this month" value={totals.newThisMonth} icon={UserPlus} tone="violet" />
        <Stat label="Avg LTV" value={totals.ltv} prefix="₹" icon={TrendingUp} tone="amber" />
      </div>

      <SegmentBar segment={segment} setSegment={onSelectSegment} segments={apiSegments} />

      <Toolbar
        search={search} setSearch={setSearch}
        tier={tier} setTier={setTier}
        status={status} setStatus={setStatus}
        count={filtered.length}
        selectedCount={selected.length}
        onClearSelection={() => setSelected([])}
        onBulkUnsubscribe={() => bulk('unsubscribe')}
        onBulkTag={() => { const t = window.prompt('Tag to add to selected subscribers:'); if (t) bulk('tag', [t.trim()]); }}
        onBulkRemove={() => { if (window.confirm(`Remove ${selected.length} subscribers?`)) bulk('delete'); }}
      />

      <Table
        data={visible}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onView={setDrawer}
        onEdit={setEditing}
        onDelete={remove}
        allSelected={visible.length > 0 && visible.every((s) => selected.includes(s.id))}
      />

      <Pagination page={safePage} totalPages={totalPages} onChange={setPage} count={filtered.length} pageSize={pageSize} />

      <AnimatePresence>
        {drawer && <Drawer subscriber={drawer} onClose={() => setDrawer(null)} onEdit={() => { setEditing(drawer); setDrawer(null); }} onDelete={() => remove(drawer.id)} />}
      </AnimatePresence>

      <AnimatePresence>
        {(creating || editing) && <SubscriberModal subscriber={editing} onClose={() => { setEditing(null); setCreating(false); }} onSave={upsert} />}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */

function Header({ onCreate, onImport, onExport }: { onCreate: () => void; onImport: () => void; onExport: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Vuedine · communications</div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">Subscribers</h1>
        <p className="mt-1 text-[14px] text-ink-600">
          One source of truth for every customer who can hear from you — across email, SMS, WhatsApp and push.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onImport} className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Upload className="h-3.5 w-3.5" />
          Import CSV
        </button>
        <button onClick={onExport} className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold">
          <Plus className="h-3.5 w-3.5" />
          Add subscriber
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

function Stat({ label, value, prefix, icon: Icon, tone, delta, deltaUp }: { label: string; value: number; prefix?: string; icon: typeof Users; tone: keyof typeof tones; delta?: string; deltaUp?: boolean }) {
  const t = tones[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm', t.bg)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1 text-2xl font-extrabold text-ink-900">
          {prefix && <span className="text-base text-ink-500">{prefix}</span>}
          <Counter value={value} />
        </div>
        {delta && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold', deltaUp ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-600')}>
            {deltaUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */

function SegmentBar({ segment, setSegment, segments }: { segment: string; setSegment: (s: string) => void; segments: Segment[] }) {
  if (segments.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {segments.map((s) => {
        const isActive = s.id === segment || (s.systemKey && s.systemKey === segment);
        const tone = SEGMENT_TONES[s.systemKey ?? ''] ?? 'from-cool-500 to-emerald-500';
        return (
          <button
            key={s.id}
            onClick={() => setSegment(s.systemKey ?? s.id)}
            className={cn(
              'group relative overflow-hidden rounded-2xl border p-4 text-left transition',
              isActive ? 'border-transparent bg-gradient-to-br text-white shadow-lg' + ' ' + tone : 'border-ink-200 bg-white shadow-sm hover:border-brand-300',
            )}
          >
            <div className={cn('text-[10px] font-bold uppercase tracking-widest', isActive ? 'text-white/80' : 'text-ink-500')}>Segment</div>
            <div className={cn('mt-0.5 text-sm font-extrabold', isActive ? 'text-white' : 'text-ink-900')}>{s.name}</div>
            <div className={cn('mt-2 text-2xl font-black', isActive ? 'text-white' : 'text-ink-900')}>{s.count}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */

function Toolbar({
  search, setSearch, tier, setTier, status, setStatus, count, selectedCount, onClearSelection,
  onBulkUnsubscribe, onBulkTag, onBulkRemove,
}: {
  search: string; setSearch: (v: string) => void;
  tier: 'All' | Tier; setTier: (v: 'All' | Tier) => void;
  status: 'All' | SubStatus; setStatus: (v: 'All' | SubStatus) => void;
  count: number;
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUnsubscribe: () => void;
  onBulkTag: () => void;
  onBulkRemove: () => void;
}) {
  if (selectedCount > 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-rose-50 p-3 shadow-sm">
        <div className="flex items-center gap-2 text-[13px] font-bold text-brand-700">
          <Users className="h-4 w-4" /> {selectedCount} selected
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/push" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-brand-700 shadow-sm hover:bg-brand-100"><Send className="h-3.5 w-3.5" /> Send broadcast</Link>
          <button onClick={onBulkTag} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-ink-700 shadow-sm hover:bg-ink-50"><Tag className="h-3.5 w-3.5" /> Tag</button>
          <button onClick={onBulkUnsubscribe} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-amber-700 shadow-sm hover:bg-amber-50"><Mail className="h-3.5 w-3.5" /> Unsubscribe</button>
          <button onClick={onBulkRemove} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-rose-600 shadow-sm hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          <button onClick={onClearSelection} className="text-[12px] font-bold text-brand-700 hover:underline">Clear</button>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
        </div>
        <Select label="Tier" value={tier} onChange={(v) => setTier(v as 'All' | Tier)} options={['All', ...tiers]} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as 'All' | SubStatus)} options={['All', ...statuses]} />
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Filter className="h-3.5 w-3.5" />
          More filters
        </button>
        <div className="ml-auto text-[12px] font-semibold text-ink-500">{count} subscribers</div>
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

/* ============================================================ */

function Table({
  data, selected, allSelected, onToggleAll, onToggleOne, onView, onEdit, onDelete,
}: {
  data: Subscriber[];
  selected: string[];
  allSelected: boolean;
  onToggleAll: (v: boolean) => void;
  onToggleOne: (id: string) => void;
  onView: (s: Subscriber) => void;
  onEdit: (s: Subscriber) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/40" />
              </th>
              <th className="px-4 py-3">Subscriber</th>
              <th className="px-4 py-3">Channels</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Spend</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.length === 0 && (
              <tr><td colSpan={10} className="py-16 text-center text-sm text-ink-500">No subscribers match the filters.</td></tr>
            )}
            {data.map((s) => (
              <tr key={s.id} className="cursor-pointer transition hover:bg-ink-50/60" onClick={() => onView(s)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => onToggleOne(s.id)} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/40" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-rose-500 text-[12px] font-extrabold text-white shadow-sm">{s.initials}</span>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink-900">{s.name}</div>
                      <div className="truncate text-[11px] text-ink-500">{s.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ChannelChips channels={s.channels as SubChannel[]} />
                </td>
                <td className="px-4 py-3"><TierBadge tier={s.tier} /></td>
                <td className="px-4 py-3 text-[12px] text-ink-700">{s.city}</td>
                <td className="px-4 py-3 text-right font-bold text-ink-900">{s.orders}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">₹{s.spend.toLocaleString()}</td>
                <td className="px-4 py-3 text-[12px] text-ink-700">{fmtDate(s.joinedAt)}</td>
                <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <IconAction title="Send" onClick={() => { /* noop */ }}><Send className="h-3.5 w-3.5" /></IconAction>
                    <IconAction title="Edit" onClick={() => onEdit(s)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                    <IconAction title="Delete" tone="danger" onClick={() => onDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
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

function ChannelChips({ channels }: { channels: SubChannel[] }) {
  const map: Record<SubChannel, string> = { Email: '📧', SMS: '💬', WhatsApp: '🟢', Push: '🔔' };
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-700">
          <span className="text-[10px]">{map[c]}</span>
          {c}
        </span>
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    Bronze: 'bg-amber-50 text-amber-700 border-amber-200',
    Silver: 'bg-ink-100 text-ink-700 border-ink-200',
    Gold: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Platinum: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold', map[tier])}>{tier}</span>;
}

function StatusPill({ status }: { status: SubStatus }) {
  const map: Record<SubStatus, { bg: string; text: string; dot: string }> = {
    Subscribed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Unsubscribed: { bg: 'bg-ink-100', text: 'text-ink-500', dot: 'bg-ink-400' },
    Bounced: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  };
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', m.bg, m.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {status}
    </span>
  );
}

function IconAction({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button title={title} onClick={onClick} className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700', tone === 'danger' && 'hover:border-rose-300 hover:text-rose-600')}>{children}</button>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================ */

function Pagination({ page, totalPages, onChange, count, pageSize }: { page: number; totalPages: number; onChange: (p: number) => void; count: number; pageSize: number }) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(count, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[12px] font-semibold text-ink-500">
        {count === 0 ? 'No results' : `Showing ${start}–${end} of ${count}`}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((p) => (
          <button key={p} onClick={() => onChange(p)} className={cn('inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-bold transition', p === page ? 'bg-brand-500 text-white shadow-sm' : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-300')}>{p}</button>
        ))}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function Drawer({ subscriber, onClose, onEdit, onDelete }: { subscriber: Subscriber; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
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
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{subscriber.id}</div>
            <div className="text-base font-extrabold text-ink-900">Subscriber details</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 text-2xl font-black text-white shadow-lg shadow-brand-500/30">{subscriber.initials}</span>
            <div className="mt-3 text-lg font-extrabold text-ink-900">{subscriber.name}</div>
            <div className="text-[12px] text-ink-500">{subscriber.email}</div>
            <div className="text-[12px] text-ink-500">{subscriber.phone}</div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <TierBadge tier={subscriber.tier} />
              <StatusPill status={subscriber.status} />
              {subscriber.tags.map((t) => (
                <span key={t} className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-700">{t}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SmallStat label="Orders" value={subscriber.orders.toString()} />
            <SmallStat label="Spend" value={`₹${(subscriber.spend / 1000).toFixed(1)}k`} />
            <SmallStat label="Joined" value={fmtDate(subscriber.joinedAt)} />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">Subscribed channels</div>
            <ChannelChips channels={subscriber.channels as SubChannel[]} />
          </div>

          {subscriber.lastOrderAt && (
            <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4 text-[12px] text-ink-700">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-500">
                <Calendar className="h-3 w-3" /> Last order
              </div>
              <div className="mt-1 text-sm font-bold text-ink-900">{fmtDate(subscriber.lastOrderAt)}</div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-ink-100 pt-5">
            <button className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold">
              <Send className="h-3.5 w-3.5" />
              Send message
            </button>
            <button onClick={onEdit} className="inline-flex items-center justify-center rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[13px] font-bold text-ink-700 hover:border-brand-300">
              <Pencil className="h-3.5 w-3.5" />
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

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-ink-900">{value}</div>
    </div>
  );
}

/* ============================================================ */
/*  Modal                                                       */
/* ============================================================ */

function SubscriberModal({ subscriber, onClose, onSave }: { subscriber: Subscriber | null; onClose: () => void; onSave: (s: SubscriberInput & { id?: string }) => Promise<void> }) {
  type LocalForm = { id: string; name: string; email: string; phone: string; city: string; channels: string[]; tags: string[]; status: string; marketingConsent: boolean };
  const [form, setForm] = useState<LocalForm>(subscriber ? {
    id: subscriber.id,
    name: subscriber.name,
    email: subscriber.email,
    phone: subscriber.phone,
    city: subscriber.city,
    channels: subscriber.channels,
    tags: subscriber.tags,
    status: subscriber.status,
    marketingConsent: subscriber.marketingConsent,
  } : {
    id: `S-${Math.floor(1000 + Math.random() * 9000)}`,
    name: '',
    email: '',
    phone: '',
    city: 'Mumbai',
    channels: ['Email'],
    tags: [],
    status: 'Subscribed',
    marketingConsent: true,
  });

  const toggleChannel = (c: SubChannel) => setForm((f) => ({
    ...f,
    channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
  }));

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
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{subscriber ? 'Edit' : 'New'}</div>
            <div className="text-base font-extrabold text-ink-900">{subscriber ? 'Edit subscriber' : 'Add subscriber'}</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Aarav Mehta" /></Field></div>
          <Field label="Email"><div className="relative"><Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" /><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={cn(inputCls, 'pl-8')} placeholder="aarav@mail.com" /></div></Field>
          <Field label="Phone"><div className="relative"><Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" /><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={cn(inputCls, 'pl-8')} placeholder="+91 98xxx xxxxx" /></div></Field>
          <Field label="City"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} /></Field>
          <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <div className="sm:col-span-2">
            <Field label="Subscribed channels">
              <div className="flex flex-wrap gap-1.5">
                {channelOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                      form.channels.includes(c) ? 'bg-brand-500 text-white shadow-sm' : 'border border-ink-200 bg-white text-ink-600 hover:border-brand-300',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tags (comma separated)">
              <input
                value={form.tags.join(', ')}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className={inputCls}
                placeholder="VIP, Allergy, Corporate"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300">Cancel</button>
          <button onClick={() => onSave({
            id: subscriber?.id,
            name: form.name,
            email: form.email,
            phone: form.phone || null,
            city: form.city,
            channels: form.channels,
            tags: form.tags,
            marketingConsent: form.marketingConsent,
          })} className="btn-primary rounded-lg px-4 py-2 text-[13px] font-bold">Save subscriber</button>
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
