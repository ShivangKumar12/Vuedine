import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  Image as ImageIcon,
  Inbox,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Star,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { messagesApi, type Conversation as ApiConversation } from '../../services/messages';
import { socketClient } from '../../lib/socket';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type Channel = 'whatsapp' | 'sms' | 'instagram' | 'webchat';
type Status = 'open' | 'pending' | 'resolved';
type Sender = 'customer' | 'agent' | 'bot';

type Message = {
  id: string;
  sender: Sender;
  body: string;
  at: string;
  read?: boolean;
};

type Conversation = {
  id: string;
  customer: string;
  phone: string;
  initials: string;
  channel: Channel;
  status: Status;
  unread: number;
  lastAt: string;
  tags: string[];
  starred?: boolean;
  agent?: string;
  lastSnippet?: string;
  messages: Message[];
};

function toLocal(c: ApiConversation): Conversation {
  return {
    id: c.id,
    customer: c.customer,
    phone: c.phone,
    initials: c.initials,
    channel: c.channel,
    status: c.status,
    unread: c.unread,
    lastAt: c.lastAt,
    tags: c.tags ?? [],
    starred: c.starred,
    agent: c.agent ?? undefined,
    lastSnippet: c.lastSnippet,
    messages: (c.messages ?? []).map((m) => ({ id: m.id, sender: m.sender, body: m.body, at: m.at, read: m.read })),
  };
}

const channelMeta: Record<Channel, { label: string; bg: string; text: string; emoji: string }> = {
  whatsapp: { label: 'WhatsApp', bg: 'bg-emerald-50', text: 'text-emerald-700', emoji: '💬' },
  sms: { label: 'SMS', bg: 'bg-sky-50', text: 'text-sky-700', emoji: '📱' },
  instagram: { label: 'Instagram', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', emoji: '📸' },
  webchat: { label: 'Web chat', bg: 'bg-amber-50', text: 'text-amber-700', emoji: '🌐' },
};

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Messages() {
  const [data, setData] = useState<Conversation[]>([]);
  const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | Status>('all');
  const [composer, setComposer] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const active = useMemo(() => data.find((c) => c.id === activeId) ?? null, [data, activeId]);

  const load = async () => {
    setLoading(true);
    try {
      const { conversations, stats: s } = await messagesApi.listWithStats();
      setData(conversations.map(toLocal));
      setStats(s);
      setActiveId((cur) => cur || conversations[0]?.id || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Live inbound messages + agent replies.
  useEffect(() => {
    const offNew = socketClient.on('conversation:new', () => load());
    const offReply = socketClient.on<{ conversationId: string }>('conversation:reply', (p) => {
      if (p.conversationId === activeId) selectConversation(activeId, true);
    });
    return () => {
      offNew();
      offReply();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const selectConversation = async (id: string, silent = false) => {
    if (!silent) setActiveId(id);
    try {
      const full = await messagesApi.get(id); // marks read server-side
      setData((d) => d.map((c) => (c.id === id ? toLocal(full) : c)));
      setStats((s) => ({ ...s })); // unread recalculated on next load
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => {
    return data.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.customer.toLowerCase().includes(s) && !c.phone.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, search, tab]);

  const totals = stats;

  const send = async () => {
    if (!composer.trim() || !active) return;
    const text = composer.trim();
    setComposer('');
    try {
      const msg = await messagesApi.reply(active.id, text);
      setData((d) => d.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, { id: msg.id, sender: msg.sender, body: msg.body, at: msg.at, read: msg.read }], lastAt: msg.at, status: c.status === 'resolved' ? 'open' : c.status } : c)));
    } catch {
      setComposer(text);
    }
  };

  const markResolved = async () => {
    if (!active) return;
    setData((d) => d.map((c) => (c.id === active.id ? { ...c, status: 'resolved' } : c)));
    await messagesApi.setStatus(active.id, 'resolved').catch(() => load());
  };

  const toggleStar = async () => {
    if (!active) return;
    const next = !active.starred;
    setData((d) => d.map((c) => (c.id === active.id ? { ...c, starred: next } : c)));
    await messagesApi.star(active.id, next).catch(() => load());
  };

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Open" value={totals.open} icon={Inbox} tone="brand" />
        <Stat label="Pending" value={totals.pending} icon={MessageSquare} tone="amber" />
        <Stat label="Resolved" value={totals.resolved} icon={Check} tone="emerald" />
        <Stat label="Unread" value={totals.unread} icon={TrendingUp} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_300px]">
        <ConversationList
          data={filtered}
          loading={loading}
          activeId={active?.id ?? ''}
          onSelect={(id) => { selectConversation(id); setData((d) => d.map((c) => (c.id === id ? { ...c, unread: 0 } : c))); }}
          search={search} setSearch={setSearch}
          tab={tab} setTab={setTab}
        />

        {active ? (
          <ConversationPane conversation={active} composer={composer} setComposer={setComposer} onSend={send} onResolve={markResolved} onStar={toggleStar} onToggleInfo={() => setShowInfo((v) => !v)} />
        ) : (
          <div className="rounded-2xl border border-ink-200 bg-white p-12 text-center shadow-sm">
            <Inbox className="mx-auto h-8 w-8 text-ink-300" />
            <div className="mt-3 text-base font-bold text-ink-700">{loading ? 'Loading…' : 'No conversation selected'}</div>
          </div>
        )}

        <CustomerInfo active={active} className="hidden xl:block" />
      </div>

      <AnimatePresence>
        {showInfo && active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm xl:hidden"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl"
            >
              <CustomerInfo active={active} onClose={() => setShowInfo(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */

function Header() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Vuedine · communications</div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">Messages</h1>
        <p className="mt-1 text-[14px] text-ink-600">
          Unified inbox for WhatsApp, SMS, Instagram and your in-store web chat — answer customers in one place.
        </p>
      </div>
      <button className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold">
        <MessageSquare className="h-3.5 w-3.5" />
        New conversation
      </button>
    </div>
  );
}

const tones = {
  brand: { bg: 'from-brand-500 to-rose-500' },
  emerald: { bg: 'from-emerald-500 to-teal-500' },
  amber: { bg: 'from-amber-500 to-orange-500' },
  violet: { bg: 'from-violet-500 to-indigo-500' },
} as const;

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Inbox; tone: keyof typeof tones }) {
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
        <Counter value={value} />
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Conversation list                                           */
/* ============================================================ */

function ConversationList({
  data, loading, activeId, onSelect, search, setSearch, tab, setTab,
}: {
  data: Conversation[];
  loading: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  search: string; setSearch: (v: string) => void;
  tab: 'all' | Status; setTab: (v: 'all' | Status) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
        </div>
      </div>

      <div className="flex border-b border-ink-100 px-1">
        {(['all', 'open', 'pending', 'resolved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative flex-1 py-2 text-[12px] font-bold capitalize transition',
              tab === t ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {t}
            {tab === t && <motion.span layoutId="msgs-tab" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-500" />}
          </button>
        ))}
      </div>

      <ul className="max-h-[640px] divide-y divide-ink-100 overflow-y-auto">
        {loading && data.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-ink-500">Loading…</li>
        )}
        {!loading && data.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-ink-500">No conversations.</li>
        )}
        {data.map((c) => {
          const lastBody = c.messages.length > 0 ? c.messages[c.messages.length - 1].body : c.lastSnippet ?? '';
          const lastIsAgent = c.messages.length > 0 && c.messages[c.messages.length - 1].sender === 'agent';
          const meta = channelMeta[c.channel];
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-3 text-left transition',
                  activeId === c.id ? 'bg-brand-50/60' : 'hover:bg-ink-50/60',
                )}
              >
                <div className="relative shrink-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-rose-500 text-[13px] font-extrabold text-white shadow">
                    {c.initials}
                  </span>
                  <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ring-2 ring-white', meta.bg)}>
                    {meta.emoji}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate text-[13px] font-bold text-ink-900">{c.customer}</span>
                      {c.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </div>
                    <div className="text-[11px] text-ink-500">{relTime(c.lastAt)}</div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className={cn('truncate text-[12px]', c.unread > 0 ? 'font-bold text-ink-800' : 'text-ink-500')}>
                      {lastIsAgent && <span className="text-ink-400">You: </span>}
                      {lastBody}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-600">{t}</span>
                    ))}
                  </div>
                </div>
                {c.unread > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================ */
/*  Conversation pane                                           */
/* ============================================================ */

function ConversationPane({
  conversation, composer, setComposer, onSend, onResolve, onStar, onToggleInfo,
}: {
  conversation: Conversation;
  composer: string; setComposer: (v: string) => void;
  onSend: () => void; onResolve: () => void; onStar: () => void; onToggleInfo: () => void;
}) {
  const meta = channelMeta[conversation.channel];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversation.messages.length, conversation.id]);

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-rose-500 text-[13px] font-extrabold text-white shadow">
            {conversation.initials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-extrabold text-ink-900">{conversation.customer}</div>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', meta.bg, meta.text)}>{meta.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-500">
              <Phone className="h-3 w-3" /> {conversation.phone}
              {conversation.agent && <span className="ml-2">· assigned to <b className="text-ink-700">{conversation.agent}</b></span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onStar} title="Star" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
            <Star className={cn('h-4 w-4', conversation.starred && 'fill-amber-400 text-amber-400')} />
          </button>
          <button onClick={onResolve} className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-700 hover:border-emerald-300">
            Mark resolved
          </button>
          <button onClick={onToggleInfo} title="Customer info" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 xl:hidden">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button title="More" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50/30 px-5 py-4">
        {groupByDay(conversation.messages).map(([day, msgs]) => (
          <div key={day}>
            <div className="my-3 flex items-center justify-center">
              <span className="rounded-full bg-white px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-500 shadow-sm ring-1 ring-ink-200">
                {day}
              </span>
            </div>
            {msgs.map((m) => <Bubble key={m.id} m={m} />)}
          </div>
        ))}
      </div>

      <div className="border-t border-ink-100 bg-white p-3">
        <div className="flex items-end gap-2">
          <button title="Attach" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700">
            <Paperclip className="h-4 w-4" />
          </button>
          <button title="Image" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700">
            <ImageIcon className="h-4 w-4" />
          </button>
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            rows={1}
            placeholder="Type a reply…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
          />
          <button title="Emoji" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700">
            <Smile className="h-4 w-4" />
          </button>
          <button onClick={onSend} disabled={!composer.trim()} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isAgent = m.sender === 'agent';
  const isBot = m.sender === 'bot';
  return (
    <div className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] shadow-sm',
        isAgent ? 'rounded-br-sm bg-gradient-to-br from-brand-500 to-rose-500 text-white' :
        isBot ? 'rounded-bl-sm border border-violet-200 bg-violet-50 text-violet-900' :
        'rounded-bl-sm border border-ink-200 bg-white text-ink-800',
      )}>
        {isBot && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-violet-700">
            <Bot className="h-3 w-3" /> Auto-reply
          </div>
        )}
        <div className="leading-snug">{m.body}</div>
        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', isAgent ? 'text-white/80' : 'text-ink-400')}>
          {fmtTime(m.at)}
          {isAgent && (m.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Customer info side                                          */
/* ============================================================ */

function CustomerInfo({ active, onClose, className }: { active: Conversation | null; onClose?: () => void; className?: string }) {
  if (!active) return null;
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Customer</div>
        {onClose && (
          <button onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-rose-500 text-xl font-extrabold text-white shadow">{active.initials}</span>
          <div className="mt-3 text-base font-extrabold text-ink-900">{active.customer}</div>
          <div className="text-[12px] text-ink-500">{active.phone}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {active.tags.map((t) => (
              <span key={t} className="rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-700">{t}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Mini label="Channel" value={channelMeta[active.channel].label} />
          <Mini label="Status" value={active.status} />
          <Mini label="Unread" value={String(active.unread)} />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">Conversation</div>
          <ul className="space-y-1.5 text-[12px]">
            <li className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-2.5">
              <span className="text-ink-500">Assigned to</span>
              <span className="font-bold text-ink-900">{active.agent ?? 'Unassigned'}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-2.5">
              <span className="text-ink-500">Last activity</span>
              <span className="font-bold text-ink-900">{relTime(active.lastAt)}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-2.5">
              <span className="text-ink-500">Messages</span>
              <span className="font-bold text-ink-900">{active.messages.length}</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <a
            href={`tel:${active.phone}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </a>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-sm font-extrabold text-ink-900">{value}</div>
    </div>
  );
}

/* ============================================================ */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'now';
  if (diff < 60) return `${Math.floor(diff)}m`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function groupByDay(msgs: Message[]): Array<[string, Message[]]> {
  const groups = new Map<string, Message[]>();
  for (const m of msgs) {
    const day = new Date(m.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(m);
  }
  return Array.from(groups.entries());
}
