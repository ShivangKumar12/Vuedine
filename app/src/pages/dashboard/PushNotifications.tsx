import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Calendar,
  Clock,
  Copy,
  Download,
  Eye,
  Filter,
  Image as ImageIcon,
  MousePointerClick,
  Pencil,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { campaignsApi, type Campaign, type CampaignType } from '../../services/campaigns';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type PushStatus = 'Sent' | 'Scheduled' | 'Draft' | 'Failed';
type Audience = 'All subscribers' | 'New customers' | 'Loyal diners' | 'Lapsed' | 'VIP' | 'Custom segment';

type PushCampaign = {
  id: string;
  title: string;
  body: string;
  imageEmoji?: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: Audience;
  audienceSize: number;
  status: PushStatus;
  scheduledFor?: string;
  sentAt?: string;
  delivered: number;
  opened: number;
  clicked: number;
  type?: CampaignType;
};

const AUDIENCE_TO_KEY: Record<Audience, string> = {
  'All subscribers': 'all',
  'New customers': 'new',
  'Loyal diners': 'loyal',
  Lapsed: 'lapsed',
  VIP: 'vip',
  'Custom segment': 'custom',
};

const STATUS_LABEL: Record<string, PushStatus> = {
  SENT: 'Sent',
  SENDING: 'Sent',
  SCHEDULED: 'Scheduled',
  DRAFT: 'Draft',
  FAILED: 'Failed',
  CANCELLED: 'Draft',
};

function toLocal(c: Campaign): PushCampaign {
  return {
    id: c.id,
    title: c.title,
    body: c.body,
    imageEmoji: c.imageEmoji ?? '🔔',
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    audience: c.audience as Audience,
    audienceSize: c.audienceSize,
    status: STATUS_LABEL[c.statusCode] ?? 'Draft',
    scheduledFor: c.scheduledFor ?? undefined,
    sentAt: c.sentAt ?? undefined,
    delivered: c.delivered,
    opened: c.opened,
    clicked: c.clicked,
    type: c.type,
  };
}

const statuses: PushStatus[] = ['Sent', 'Scheduled', 'Draft', 'Failed'];
const audiences: Audience[] = ['All subscribers', 'New customers', 'Loyal diners', 'Lapsed', 'VIP', 'Custom segment'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function PushNotifications() {
  const [data, setData] = useState<PushCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | PushStatus>('All');
  const [drawer, setDrawer] = useState<PushCampaign | null>(null);
  const [editing, setEditing] = useState<PushCampaign | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await campaignsApi.list();
      setData(rows.map(toLocal));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return data.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.body.toLowerCase().includes(search.toLowerCase())) return false;
      if (status !== 'All' && p.status !== status) return false;
      return true;
    });
  }, [data, search, status]);

  const totals = useMemo(() => {
    const sent = data.filter((p) => p.status === 'Sent');
    const delivered = sent.reduce((s, p) => s + p.delivered, 0);
    const opened = sent.reduce((s, p) => s + p.opened, 0);
    const clicked = sent.reduce((s, p) => s + p.clicked, 0);
    const ctr = delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : 0;
    return { campaigns: sent.length, delivered, opened, clicked, ctr };
  }, [data]);

  const remove = async (id: string) => {
    setData((d) => d.filter((p) => p.id !== id));
    setDrawer(null);
    try {
      await campaignsApi.remove(id);
    } catch {
      load();
    }
  };

  // Persist a campaign via the API, then refresh the list.
  const persist = async (form: PushCampaign, mode: 'draft' | 'send' | 'schedule') => {
    const payload = {
      type: (form.type ?? 'PUSH') as CampaignType,
      title: form.title,
      body: form.body,
      imageEmoji: form.imageEmoji ?? null,
      ctaLabel: form.ctaLabel || null,
      ctaUrl: form.ctaUrl || null,
      audience: AUDIENCE_TO_KEY[form.audience] ?? 'all',
    };
    const isExisting = data.some((p) => p.id === form.id);
    const saved = isExisting ? await campaignsApi.update(form.id, payload) : await campaignsApi.create(payload);
    if (mode === 'send') await campaignsApi.sendNow(saved.id);
    else if (mode === 'schedule' && form.scheduledFor) await campaignsApi.schedule(saved.id, new Date(form.scheduledFor).toISOString());
    setEditing(null);
    setCreating(false);
    await load();
  };

  return (
    <div className="space-y-6">
      <Header onCreate={() => setCreating(true)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Campaigns sent" value={totals.campaigns} icon={Send} tone="brand" />
        <Stat label="Total delivered" value={totals.delivered} icon={Smartphone} tone="violet" />
        <Stat label="Opens" value={totals.opened} icon={Eye} tone="amber" />
        <Stat label="Click-through" value={totals.ctr} suffix="%" icon={MousePointerClick} tone="emerald" />
      </div>

      <Toolbar search={search} setSearch={setSearch} status={status} setStatus={setStatus} count={filtered.length} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-[14px] font-bold text-rose-700">
          {error} <button onClick={load} className="underline">Retry</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
        </div>
      ) : (
        <Table data={filtered} onView={setDrawer} onEdit={setEditing} onDelete={remove} />
      )}

      <AnimatePresence>
        {drawer && <Drawer push={drawer} onClose={() => setDrawer(null)} onEdit={() => { setEditing(drawer); setDrawer(null); }} onDelete={() => remove(drawer.id)} />}
      </AnimatePresence>

      <AnimatePresence>
        {(creating || editing) && <PushModal push={editing} onClose={() => { setEditing(null); setCreating(false); }} onPersist={persist} />}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */

function Header({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Vuedine · communications</div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">Push notifications</h1>
        <p className="mt-1 text-[14px] text-ink-600">
          Compose, schedule and measure every broadcast that lands on your customer’s phone.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Download className="h-3.5 w-3.5" />
          Export report
        </button>
        <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold">
          <Plus className="h-3.5 w-3.5" />
          New campaign
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

function Stat({ label, value, prefix, suffix, icon: Icon, tone }: { label: string; value: number; prefix?: string; suffix?: string; icon: typeof Bell; tone: keyof typeof tones }) {
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

function Toolbar({
  search, setSearch, status, setStatus, count,
}: {
  search: string; setSearch: (v: string) => void;
  status: 'All' | PushStatus; setStatus: (v: 'All' | PushStatus) => void;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15" />
        </div>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-700">
          <span className="text-ink-500">Status:</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'All' | PushStatus)} className="bg-transparent pr-1 text-ink-900 outline-none">
            {(['All', ...statuses] as const).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700">
          <Filter className="h-3.5 w-3.5" />
          More filters
        </button>
        <div className="ml-auto text-[12px] font-semibold text-ink-500">{count} campaigns</div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Table                                                       */
/* ============================================================ */

function Table({
  data, onView, onEdit, onDelete,
}: {
  data: PushCampaign[];
  onView: (p: PushCampaign) => void;
  onEdit: (p: PushCampaign) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent / scheduled</th>
              <th className="px-4 py-3 text-right">Delivered</th>
              <th className="px-4 py-3 text-right">Open · Click</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {data.length === 0 && (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-ink-500">No campaigns match the filters.</td></tr>
            )}
            {data.map((p) => {
              const openRate = p.delivered > 0 ? Math.round((p.opened / p.delivered) * 100) : 0;
              const ctr = p.delivered > 0 ? Math.round((p.clicked / p.delivered) * 100) : 0;
              return (
                <tr key={p.id} className="cursor-pointer transition hover:bg-ink-50/60" onClick={() => onView(p)}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-rose-100 text-lg">{p.imageEmoji ?? '🔔'}</span>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink-900">{p.title}</div>
                        <div className="line-clamp-1 text-[12px] text-ink-500">{p.body}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-semibold text-ink-800">{p.audience}</div>
                    <div className="text-[11px] text-ink-500">{p.audienceSize.toLocaleString()} recipients</div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-3 text-[12px] text-ink-700">
                    {p.sentAt ? fmtDateTime(p.sentAt) : p.scheduledFor ? fmtDateTime(p.scheduledFor) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-ink-900">{p.delivered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold text-ink-700">
                    <div>{openRate}% / {ctr}%</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <IconAction title="Duplicate" onClick={() => onEdit({ ...p, id: `P-${Math.floor(9000 + Math.random() * 1000)}`, status: 'Draft' })}><Copy className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="Edit" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="Delete" tone="danger" onClick={() => onDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
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

function IconAction({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button title={title} onClick={onClick} className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700', tone === 'danger' && 'hover:border-rose-300 hover:text-rose-600')}>{children}</button>
  );
}

function StatusPill({ status }: { status: PushStatus }) {
  const map: Record<PushStatus, { bg: string; text: string; dot: string }> = {
    Sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Scheduled: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
    Draft: { bg: 'bg-ink-100', text: 'text-ink-600', dot: 'bg-ink-400' },
    Failed: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  };
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', m.bg, m.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {status}
    </span>
  );
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function Drawer({ push, onClose, onEdit, onDelete }: { push: PushCampaign; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const openRate = push.delivered > 0 ? Math.round((push.opened / push.delivered) * 100) : 0;
  const ctr = push.delivered > 0 ? Math.round((push.clicked / push.delivered) * 100) : 0;

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
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Campaign · {push.id}</div>
            <div className="text-base font-extrabold text-ink-900">Push details</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Phone preview</div>
          <PhonePreview push={push} />

          <div className="grid grid-cols-2 gap-3">
            <Detail label="Status" value={<StatusPill status={push.status} />} />
            <Detail label="Audience" value={push.audience} />
            <Detail label="Recipients" value={push.audienceSize.toLocaleString()} />
            <Detail label={push.status === 'Scheduled' ? 'Scheduled for' : 'Sent at'} value={push.scheduledFor || push.sentAt ? fmtDateTime(push.scheduledFor || push.sentAt!) : '—'} />
          </div>

          {push.status === 'Sent' && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">Performance</div>
              <div className="grid grid-cols-3 gap-3">
                <PerfTile label="Delivered" value={push.delivered.toLocaleString()} sub={`of ${push.audienceSize.toLocaleString()}`} tone="violet" />
                <PerfTile label="Open rate" value={`${openRate}%`} sub={`${push.opened.toLocaleString()} opened`} tone="amber" />
                <PerfTile label="CTR" value={`${ctr}%`} sub={`${push.clicked.toLocaleString()} clicks`} tone="emerald" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-ink-100 pt-5">
            <button onClick={onEdit} className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold">
              <Pencil className="h-3.5 w-3.5" />
              {push.status === 'Sent' ? 'Duplicate' : 'Edit'}
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

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-ink-800">{value}</div>
    </div>
  );
}

function PerfTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'violet' | 'amber' | 'emerald' }) {
  const map = {
    violet: 'from-violet-50 to-indigo-50 text-violet-700 border-violet-100',
    amber: 'from-amber-50 to-orange-50 text-amber-700 border-amber-100',
    emerald: 'from-emerald-50 to-teal-50 text-emerald-700 border-emerald-100',
  };
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br p-3', map[tone])}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-black">{value}</div>
      <div className="text-[10px] font-semibold opacity-80">{sub}</div>
    </div>
  );
}

function PhonePreview({ push }: { push: PushCampaign }) {
  return (
    <div className="rounded-3xl border-4 border-ink-900 bg-gradient-to-br from-ink-800 to-ink-950 p-3 shadow-2xl">
      <div className="rounded-2xl bg-cover bg-center p-3" style={{ backgroundImage: 'linear-gradient(135deg, #4c1d95 0%, #be185d 100%)' }}>
        <div className="text-[10px] font-bold tracking-widest text-white/70">9:41</div>
        <div className="mt-3 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-rose-500 text-sm">{push.imageEmoji ?? '🔔'}</span>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Vuedine</div>
              <div className="text-[10px] text-ink-400">now</div>
            </div>
          </div>
          <div className="mt-2 text-[13px] font-extrabold leading-tight text-ink-900">{push.title || 'Notification title'}</div>
          <div className="mt-1 text-[11px] leading-snug text-ink-700">{push.body || 'Notification body preview goes here.'}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Modal                                                       */
/* ============================================================ */

function PushModal({ push, onClose, onPersist }: { push: PushCampaign | null; onClose: () => void; onPersist: (form: PushCampaign, mode: 'draft' | 'send' | 'schedule') => Promise<void> }) {
  const [form, setForm] = useState<PushCampaign>(push ?? {
    id: `new-${Date.now()}`,
    title: '',
    body: '',
    imageEmoji: '🔔',
    ctaLabel: 'Order now',
    ctaUrl: '/menu',
    audience: 'All subscribers',
    audienceSize: 0,
    status: 'Draft',
    delivered: 0,
    opened: 0,
    clicked: 0,
    type: 'PUSH',
  });
  const [scheduleNow, setScheduleNow] = useState(form.status !== 'Scheduled');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Live audience reach from the segment evaluator.
  useEffect(() => {
    let cancelled = false;
    campaignsApi
      .previewAudience({ type: form.type ?? 'PUSH', audience: AUDIENCE_TO_KEY[form.audience] })
      .then((r) => { if (!cancelled) setForm((f) => ({ ...f, audienceSize: r.count })); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.audience, form.type]);

  const handleSave = async (mode: 'draft' | 'send' | 'schedule') => {
    if (!form.title.trim() || !form.body.trim()) {
      setErr('Title and body are required.');
      return;
    }
    setBusy(mode);
    setErr(null);
    try {
      await onPersist(form, mode);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save campaign');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[92vh] max-w-4xl -translate-y-1/2 overflow-y-auto rounded-2xl border border-ink-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{push ? 'Edit' : 'New'}</div>
            <div className="text-base font-extrabold text-ink-900">{push ? 'Edit campaign' : 'New push campaign'}</div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2"><Field label="Title (max 60 chars)"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} className={inputCls} placeholder="🍕 Lunch is on us today!" /></Field></div>
              <Field label="Emoji"><input value={form.imageEmoji ?? ''} onChange={(e) => setForm({ ...form, imageEmoji: e.target.value })} maxLength={2} className={inputCls} /></Field>
            </div>

            <Field label={`Body (${form.body.length}/120)`}>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value.slice(0, 120) })}
                rows={3}
                className={cn(inputCls, 'h-auto resize-none py-2')}
                placeholder="Use code LUNCH15 for 15% off any order placed before 3 PM. Limited slots, hurry."
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA label"><input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} className={inputCls} /></Field>
              <Field label="CTA URL"><input value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} className={inputCls} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience">
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })} className={inputCls}>
                  {audiences.map((a) => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Estimated reach">
                <div className={cn(inputCls, 'flex items-center font-bold text-brand-700')}>
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {form.audienceSize.toLocaleString()} recipients
                </div>
              </Field>
            </div>

            <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-500">Delivery</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleNow(true)}
                  className={cn('flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold transition', scheduleNow ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600')}
                >
                  Send now
                </button>
                <button
                  onClick={() => setScheduleNow(false)}
                  className={cn('flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold transition', !scheduleNow ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600')}
                >
                  Schedule
                </button>
              </div>
              {!scheduleNow && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                      <input type="date" value={(form.scheduledFor || '').slice(0, 10)} onChange={(e) => setForm({ ...form, scheduledFor: `${e.target.value}T${(form.scheduledFor || 'T10:00').slice(11, 16)}` })} className={cn(inputCls, 'pl-8')} />
                    </div>
                  </Field>
                  <Field label="Time">
                    <div className="relative">
                      <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                      <input type="time" value={(form.scheduledFor || 'T10:00').slice(11, 16)} onChange={(e) => setForm({ ...form, scheduledFor: `${(form.scheduledFor || new Date().toISOString().slice(0, 10)).slice(0, 10)}T${e.target.value}` })} className={cn(inputCls, 'pl-8')} />
                    </div>
                  </Field>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Live preview</div>
            <PhonePreview push={form} />
            <div className="rounded-xl bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
              <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
              Tip: titles under 50 chars and bodies under 100 perform 22% better.
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
          {err && <span className="mr-auto text-[12px] font-semibold text-rose-600">{err}</span>}
          <button onClick={onClose} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 hover:border-brand-300">Cancel</button>
          <button onClick={() => handleSave('draft')} disabled={!!busy} className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 disabled:opacity-60">{busy === 'draft' ? 'Saving…' : 'Save as draft'}</button>
          {scheduleNow ? (
            <button onClick={() => handleSave('send')} disabled={!!busy} className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold disabled:opacity-60">
              <Send className="h-3.5 w-3.5" />
              {busy === 'send' ? 'Sending…' : 'Send now'}
            </button>
          ) : (
            <button onClick={() => handleSave('schedule')} disabled={!!busy} className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold disabled:opacity-60">
              <Calendar className="h-3.5 w-3.5" />
              {busy === 'schedule' ? 'Scheduling…' : 'Schedule'}
            </button>
          )}
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
