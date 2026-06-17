import { AnimatePresence, motion } from 'framer-motion';
import {
  AlarmClock,
  Bell,
  CheckCircle2,
  ChefHat,
  Maximize,
  Minimize,
  Play,
  Search,
  Smartphone,
  Truck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { kdsApi } from '../../services/kds';
import { ordersApi, type Order as ApiOrder } from '../../services/orders';
import { socketClient } from '../../lib/socket';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types & seed data                                           */
/* ============================================================ */

type Channel = 'Dine-In' | 'Online' | 'Takeaway';
type State = 'Confirmed' | 'Preparing' | 'Done';
type Priority = 'Normal' | 'Rush';
type Station = 'Hot' | 'Cold' | 'Bar' | 'Dessert';

type LineItem = {
  id: string;
  name: string;
  emoji: string;
  qty: number;
  station: Station;
  notes?: string;
  prepared?: boolean;
};

type Ticket = {
  id: string;
  serverId?: string;
  channel: Channel;
  state: State;
  priority: Priority;
  table?: string;
  guest?: string;
  waiter?: string;
  receivedAt: number; // ms
  items: LineItem[];
  source?: string;
};

const now = Date.now();

const _seed: Ticket[] = [
  // Dine-In
  {
    id: '1284',
    channel: 'Dine-In',
    state: 'Confirmed',
    priority: 'Normal',
    table: 'T-7',
    guest: 'A. Mehta',
    waiter: 'Aman K.',
    receivedAt: now - 45_000,
    items: [
      { id: 'a', name: 'Margherita', emoji: '🍕', qty: 1, station: 'Hot' },
      { id: 'b', name: 'Caesar Salad', emoji: '🥗', qty: 1, station: 'Cold' },
      { id: 'c', name: 'Iced Latte', emoji: '🧊', qty: 2, station: 'Bar', notes: 'No sugar' },
    ],
  },
  {
    id: '1285',
    channel: 'Dine-In',
    state: 'Preparing',
    priority: 'Rush',
    table: 'T-12',
    guest: 'D. Joshi',
    waiter: 'Sara P.',
    receivedAt: now - 5 * 60_000,
    items: [
      { id: 'a', name: 'Truffle Burger', emoji: '🍔', qty: 2, station: 'Hot', prepared: true },
      { id: 'b', name: 'Caesar Salad', emoji: '🥗', qty: 1, station: 'Cold', prepared: true },
      { id: 'c', name: 'Coke', emoji: '🥤', qty: 2, station: 'Bar' },
    ],
  },
  {
    id: '1286',
    channel: 'Dine-In',
    state: 'Preparing',
    priority: 'Normal',
    table: 'T-3',
    guest: 'Walking',
    waiter: 'Aman K.',
    receivedAt: now - 3 * 60_000,
    items: [
      { id: 'a', name: 'Carbonara', emoji: '🍝', qty: 2, station: 'Hot', notes: 'Extra parmesan', prepared: false },
      { id: 'b', name: 'Tiramisu', emoji: '🍰', qty: 2, station: 'Dessert' },
    ],
  },
  // Online
  {
    id: '7821',
    channel: 'Online',
    state: 'Confirmed',
    priority: 'Normal',
    guest: 'Aarav Mehta',
    source: 'Zomato',
    receivedAt: now - 90_000,
    items: [
      { id: 'a', name: 'Pepperoni', emoji: '🍕', qty: 1, station: 'Hot' },
      { id: 'b', name: 'Garlic Bread', emoji: '🥖', qty: 1, station: 'Hot' },
      { id: 'c', name: 'Mojito', emoji: '🍹', qty: 2, station: 'Bar' },
      { id: 'd', name: 'Brownie', emoji: '🍫', qty: 1, station: 'Dessert' },
    ],
  },
  {
    id: '7820',
    channel: 'Online',
    state: 'Preparing',
    priority: 'Normal',
    guest: 'Priya Iyer',
    source: 'Swiggy',
    receivedAt: now - 8 * 60_000,
    items: [
      { id: 'a', name: 'Pad Thai', emoji: '🍜', qty: 2, station: 'Hot', prepared: true },
      { id: 'b', name: 'Spring Rolls', emoji: '🥟', qty: 1, station: 'Hot', prepared: false },
      { id: 'c', name: 'Mango Lassi', emoji: '🥭', qty: 4, station: 'Bar' },
    ],
  },
  // Takeaway
  {
    id: '1287',
    channel: 'Takeaway',
    state: 'Confirmed',
    priority: 'Normal',
    guest: 'Walking',
    receivedAt: now - 30_000,
    items: [
      { id: 'a', name: 'Sushi Set', emoji: '🍣', qty: 1, station: 'Cold' },
      { id: 'b', name: 'Miso Soup', emoji: '🍲', qty: 2, station: 'Hot' },
    ],
  },
  {
    id: '1288',
    channel: 'Takeaway',
    state: 'Preparing',
    priority: 'Rush',
    guest: 'R. Sharma',
    receivedAt: now - 10 * 60_000,
    items: [
      { id: 'a', name: 'BBQ Ribs', emoji: '🍖', qty: 1, station: 'Hot', prepared: false },
      { id: 'b', name: 'Onion Rings', emoji: '🧅', qty: 2, station: 'Hot', prepared: false },
    ],
  },
  {
    id: '1289',
    channel: 'Takeaway',
    state: 'Done',
    priority: 'Normal',
    guest: 'N. Kapoor',
    receivedAt: now - 14 * 60_000,
    items: [
      { id: 'a', name: 'Veggie Burger', emoji: '🍔', qty: 1, station: 'Hot', prepared: true },
      { id: 'b', name: 'Lemonade', emoji: '🍋', qty: 1, station: 'Bar', prepared: true },
    ],
  },
];

void _seed;

/* ============================================================ */
/*  Server adapter                                              */
/* ============================================================ */

const SERVER_STATUS_TO_LOCAL: Record<string, State> = {
  PENDING: 'Confirmed',
  ACCEPTED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Done',
};
const SERVER_CHANNEL_TO_LOCAL: Record<string, Channel> = {
  POS: 'Dine-In',
  WAITER: 'Dine-In',
  QR: 'Dine-In',
  ONLINE: 'Online',
};
const SERVER_STATION_TO_LOCAL: Record<string, Station> = {
  HOT: 'Hot',
  COLD: 'Cold',
  BAR: 'Bar',
  DESSERT: 'Dessert',
};

function adaptTicket(o: ApiOrder): Ticket {
  return {
    id: o.serial,
    serverId: o.id,
    channel:
      o.type === 'TAKEAWAY' && o.channel !== 'ONLINE'
        ? 'Takeaway'
        : (SERVER_CHANNEL_TO_LOCAL[o.channel] ?? 'Dine-In'),
    state: SERVER_STATUS_TO_LOCAL[o.status] ?? 'Confirmed',
    priority: o.priority === 'RUSH' ? 'Rush' : 'Normal',
    table: o.tableLabel ?? undefined,
    guest: o.guestName ?? undefined,
    waiter: undefined,
    receivedAt: new Date(o.createdAt).getTime(),
    items: o.items.map((it) => ({
      id: it.id,
      name: it.name,
      emoji: it.emoji ?? '🍽️',
      qty: it.qty,
      station: SERVER_STATION_TO_LOCAL[it.station] ?? 'Hot',
      notes: it.notes ?? undefined,
      prepared: it.prepared,
    })),
    source: o.sourceLabel ?? undefined,
  };
}

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function KDS() {
  const branches = branchesStore.use();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<'All' | State>('All');
  const [search, setSearch] = useState('');
  const [station, setStation] = useState<'All' | Station>('All');
  const [muted, setMuted] = useState(false);
  const [, force] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Initial fetch + socket subscription.
  useEffect(() => {
    if (!branches.activeId) {
      setTickets([]);
      return;
    }
    const branchId = branches.activeId;
    const reload = () => {
      kdsApi
        .listTickets(branchId)
        .then((rows) => setTickets(rows.map(adaptTicket)))
        .catch(() => {
          /* keep last */
        });
    };
    reload();
    const offNew = socketClient.on<ApiOrder>('kds:ticket:new', (o) => {
      if (o.branchId !== branchId) return;
      setTickets((prev) => {
        const idx = prev.findIndex((t) => t.serverId === o.id);
        const adapted = adaptTicket(o);
        if (idx === -1) return [adapted, ...prev];
        const next = prev.slice();
        next[idx] = adapted;
        return next;
      });
    });
    const offUpd = socketClient.on<ApiOrder>('kds:ticket:updated', (o) => {
      if (o.branchId !== branchId) return;
      const adapted = adaptTicket(o);
      setTickets((prev) => {
        // Drop the ticket if it's no longer active (DELIVERED/SERVED/CANCELLED).
        if (!['Confirmed', 'Preparing', 'Done'].includes(adapted.state)) {
          return prev.filter((t) => t.serverId !== o.id);
        }
        const idx = prev.findIndex((t) => t.serverId === o.id);
        if (idx === -1) return [adapted, ...prev];
        const next = prev.slice();
        next[idx] = adapted;
        return next;
      });
    });
    return () => {
      offNew();
      offUpd();
    };
  }, [branches.activeId]);

  // Re-render once a second so age timers tick
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen API hook-up
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filter !== 'All' && t.state !== filter) return false;
      if (station !== 'All' && !t.items.some((i) => i.station === station)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.id.toLowerCase().includes(s) &&
          !(t.table ?? '').toLowerCase().includes(s) &&
          !(t.guest ?? '').toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [tickets, filter, station, search]);

  const byChannel = useMemo(() => {
    return {
      'Dine-In': filtered.filter((t) => t.channel === 'Dine-In'),
      Online: filtered.filter((t) => t.channel === 'Online'),
      Takeaway: filtered.filter((t) => t.channel === 'Takeaway'),
    } as Record<Channel, Ticket[]>;
  }, [filtered]);

  const counts = useMemo(() => {
    const by: Record<string, number> = { All: tickets.length };
    (['Confirmed', 'Preparing', 'Done'] as State[]).forEach((s) => {
      by[s] = tickets.filter((t) => t.state === s).length;
    });
    return by;
  }, [tickets]);

  // Aggregate item counts (item board) — sums quantities for active tickets
  const itemBoard = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string; qty: number; pending: number }>();
    tickets
      .filter((t) => t.state !== 'Done')
      .forEach((t) => {
        t.items.forEach((it) => {
          const key = `${it.emoji}|${it.name}`;
          const exist = map.get(key);
          if (exist) {
            exist.qty += it.qty;
            if (!it.prepared) exist.pending += it.qty;
          } else {
            map.set(key, { name: it.name, emoji: it.emoji, qty: it.qty, pending: it.prepared ? 0 : it.qty });
          }
        });
      });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [tickets]);

  /* Mutators — backend-backed. Optimistically update local state; the
     subsequent socket event reconciles. */
  const advance = (id: string) => {
    const t = tickets.find((x) => x.id === id);
    if (!t || !t.serverId) return;
    setTickets((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, state: x.state === 'Confirmed' ? 'Preparing' : x.state === 'Preparing' ? 'Done' : 'Done' }
          : x,
      ),
    );
    ordersApi.advance(t.serverId).catch(() => {
      // Revert on failure: re-fetch.
      const branchId = branchesStore.get().activeId;
      if (branchId) {
        kdsApi.listTickets(branchId).then((rows) => setTickets(rows.map(adaptTicket))).catch(() => {});
      }
    });
  };
  const recall = (id: string) => {
    const t = tickets.find((x) => x.id === id);
    if (!t || !t.serverId) return;
    setTickets((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, state: x.state === 'Done' ? 'Preparing' : x.state === 'Preparing' ? 'Confirmed' : 'Confirmed' }
          : x,
      ),
    );
    // Recall only valid from READY → PREPARING server-side. For PREPARING→ACCEPTED
    // we have no server endpoint yet (the state machine doesn't allow regress);
    // treat the local optimistic state as a UX nicety and resync on next socket event.
    if (t.state === 'Done') {
      ordersApi.recall(t.serverId).catch(() => {});
    }
  };
  const toggleItem = (ticketId: string, itemId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || !ticket.serverId) return;
    const line = ticket.items.find((i) => i.id === itemId);
    if (!line) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, prepared: !i.prepared } : i)) }
          : t,
      ),
    );
    ordersApi.setLinePrepared(ticket.serverId, itemId, !line.prepared).catch(() => {
      // Revert on failure
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, prepared: line.prepared } : i)) }
            : t,
        ),
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="-mx-4 -my-6 flex h-[calc(100vh-64px)] flex-col bg-ink-50 sm:-mx-6 lg:-mx-8"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 text-white shadow-md shadow-brand-500/30">
            <ChefHat className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
              Kitchen Display
            </div>
            <div className="text-sm font-extrabold text-ink-900">Hot Kitchen · Bandra</div>
          </div>
          <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live · {tickets.filter((t) => t.state !== 'Done').length} active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StationToggle value={station} onChange={setStation} />
          <SearchBox value={search} onChange={setSearch} />
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition',
              muted
                ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
            )}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 sm:inline-flex"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[12px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            Exit KDS
          </Link>
        </div>
      </header>

      {/* State filter strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        {(['All', 'Confirmed', 'Preparing', 'Done'] as const).map((s) => {
          const active = filter === s;
          const meta = s === 'All' ? null : stateMeta[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
                active
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
              )}
            >
              {meta && <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : meta.dot)} />}
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
        <div className="ml-auto inline-flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-1 text-[11px] font-bold text-ink-500">
          <AlarmClock className="h-3.5 w-3.5 text-amber-500" />
          Avg prep time:{' '}
          <span className="text-ink-900">
            {Math.round(
              tickets.reduce((s, t) => s + ageMinutes(t.receivedAt), 0) / Math.max(1, tickets.length),
            )}
            m
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Items board */}
        <ItemsBoard items={itemBoard} />

        {/* Tickets — three columns */}
        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-3">
          <Column
            title="Dine-In Orders"
            count={byChannel['Dine-In'].length}
            icon={<UtensilsCrossed className="h-4 w-4" />}
            tone="brand"
          >
            <AnimatePresence mode="popLayout">
              {byChannel['Dine-In'].map((t, i) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  onAdvance={() => advance(t.id)}
                  onRecall={() => recall(t.id)}
                  onToggleItem={(itemId) => toggleItem(t.id, itemId)}
                />
              ))}
            </AnimatePresence>
            {byChannel['Dine-In'].length === 0 && <Empty channel="Dine-In" />}
          </Column>

          <Column
            title="Online Orders"
            count={byChannel.Online.length}
            icon={<Smartphone className="h-4 w-4" />}
            tone="cool"
          >
            <AnimatePresence mode="popLayout">
              {byChannel.Online.map((t, i) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  onAdvance={() => advance(t.id)}
                  onRecall={() => recall(t.id)}
                  onToggleItem={(itemId) => toggleItem(t.id, itemId)}
                />
              ))}
            </AnimatePresence>
            {byChannel.Online.length === 0 && <Empty channel="Online" />}
          </Column>

          <Column
            title="Takeaway"
            count={byChannel.Takeaway.length}
            icon={<Truck className="h-4 w-4" />}
            tone="warm"
          >
            <AnimatePresence mode="popLayout">
              {byChannel.Takeaway.map((t, i) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  onAdvance={() => advance(t.id)}
                  onRecall={() => recall(t.id)}
                  onToggleItem={(itemId) => toggleItem(t.id, itemId)}
                />
              ))}
            </AnimatePresence>
            {byChannel.Takeaway.length === 0 && <Empty channel="Takeaway" />}
          </Column>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Items board (left rail)                                     */
/* ============================================================ */

function ItemsBoard({ items }: { items: { name: string; emoji: string; qty: number; pending: number }[] }) {
  return (
    <aside className="hidden flex-col border-r border-ink-200 bg-white lg:flex">
      <div className="border-b border-ink-200 px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Items board</div>
        <div className="mt-0.5 text-sm font-extrabold text-ink-900">Live aggregate</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-brand-100">
              <UtensilsCrossed className="h-5 w-5 text-brand-500" />
            </span>
            <div className="text-[13px] font-bold text-ink-700">All caught up</div>
            <div className="text-[11px] text-ink-500">New tickets will appear here.</div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li
                key={it.name}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-2 transition',
                  it.pending > 0
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-ink-100 bg-white',
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-base ring-1 ring-ink-100">
                  {it.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-ink-900">{it.name}</div>
                  <div className="text-[10px] font-medium text-ink-500">
                    {it.pending > 0 ? `${it.pending} pending` : 'All prepared'}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-base font-extrabold text-ink-900">×{it.qty}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ============================================================ */
/*  Column                                                      */
/* ============================================================ */

const channelTone: Record<string, { headBg: string; ring: string; dot: string }> = {
  brand: { headBg: 'from-brand-500 to-rose-500', ring: 'ring-brand-200', dot: 'bg-brand-500' },
  cool: { headBg: 'from-cool-500 to-blue-500', ring: 'ring-cool-200', dot: 'bg-cool-500' },
  warm: { headBg: 'from-warm-500 to-amber-500', ring: 'ring-warm-200', dot: 'bg-warm-500' },
};

function Column({
  title,
  count,
  icon,
  tone,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  tone: keyof typeof channelTone;
  children: React.ReactNode;
}) {
  const t = channelTone[tone];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <header
        className={cn(
          'flex items-center justify-between rounded-t-2xl bg-gradient-to-r px-4 py-2.5 text-white shadow-sm',
          t.headBg,
        )}
      >
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">{icon}</span>
          {title}
        </div>
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white/25 px-2 text-[11px] font-bold">
          {count}
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-ink-50/40 p-3">{children}</div>
    </section>
  );
}

function Empty({ channel }: { channel: Channel }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink-200 bg-white py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-50">
        <ChefHat className="h-4 w-4 text-ink-400" />
      </span>
      <div className="text-[12px] font-bold text-ink-700">No {channel.toLowerCase()} tickets</div>
      <div className="text-[10px] text-ink-500">New orders will appear instantly.</div>
    </div>
  );
}

/* ============================================================ */
/*  Ticket card                                                 */
/* ============================================================ */

function TicketCard({
  ticket,
  index,
  onAdvance,
  onRecall,
  onToggleItem,
}: {
  ticket: Ticket;
  index: number;
  onAdvance: () => void;
  onRecall: () => void;
  onToggleItem: (itemId: string) => void;
}) {
  const minutes = ageMinutes(ticket.receivedAt);
  const meta = stateMeta[ticket.state];
  const heat =
    minutes > 12
      ? 'border-rose-300 bg-rose-50/70'
      : minutes > 7
        ? 'border-amber-300 bg-amber-50/60'
        : meta.cardBg;
  const heatBorder = minutes > 12 ? 'border-rose-300' : minutes > 7 ? 'border-amber-300' : meta.cardBorder;
  const completedItems = ticket.items.filter((i) => i.prepared).length;
  const totalItems = ticket.items.length;
  const allDone = completedItems === totalItems;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn('relative overflow-hidden rounded-2xl border-2 bg-white shadow-sm', heatBorder, heat)}
    >
      {/* Priority strip */}
      {ticket.priority === 'Rush' && (
        <div className="absolute left-0 top-0 inline-flex items-center gap-1 rounded-br-lg bg-rose-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          <Bell className="h-2.5 w-2.5" />
          Rush
        </div>
      )}
      {/* Late badge */}
      {minutes > 12 && (
        <div className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-lg bg-rose-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          <AlarmClock className="h-2.5 w-2.5" />
          Late
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 pt-1.5">
          <div>
            <div className="font-mono text-base font-extrabold text-ink-900">#{ticket.id}</div>
            <div className="mt-0.5 text-[11px] font-bold text-ink-500">
              {ticket.table ? `Table · ${ticket.table}` : ticket.source ?? 'Walk-in'}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ring-1',
                minutes > 12
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : minutes > 7
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
              )}
            >
              <AlarmClock className="h-3 w-3" />
              {minutes}m
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {ticket.guest ?? 'Walking'}
            </div>
          </div>
        </div>

        {/* Items */}
        <ul className="mt-2 space-y-1">
          {ticket.items.map((it) => (
            <li
              key={it.id}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-2 transition',
                it.prepared
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-ink-100 bg-white',
              )}
            >
              <button
                onClick={() => onToggleItem(it.id)}
                aria-label={it.prepared ? 'Mark not prepared' : 'Mark prepared'}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
                  it.prepared
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-ink-300 bg-white hover:border-brand-400',
                )}
              >
                {it.prepared && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
                  <span className="text-base leading-none">{it.emoji}</span>
                  <span className={it.prepared ? 'text-ink-400 line-through' : ''}>
                    {it.qty}× {it.name}
                  </span>
                </div>
                {it.notes && (
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    📝 {it.notes}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1',
                  stationMeta[it.station].pill,
                )}
              >
                {it.station}
              </span>
            </li>
          ))}
        </ul>

        {/* Progress + actions */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-ink-500">
                {completedItems}/{totalItems} prepared
              </span>
              <span className={cn(meta.text)}>{ticket.state}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedItems / Math.max(1, totalItems)) * 100}%` }}
                transition={{ duration: 0.4 }}
                className={cn('h-full rounded-full', meta.bar)}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          <button
            onClick={onRecall}
            disabled={ticket.state === 'Confirmed'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Recall"
          >
            <Play className="h-3.5 w-3.5 -scale-x-100" strokeWidth={3} />
          </button>
          <button
            onClick={onAdvance}
            disabled={ticket.state === 'Done'}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40',
              ticket.state === 'Confirmed'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 hover:bg-amber-600'
                : ticket.state === 'Preparing'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600'
                  : 'bg-ink-200 text-ink-500',
            )}
          >
            {ticket.state === 'Confirmed' && (
              <>
                <Play className="h-3.5 w-3.5" strokeWidth={3} />
                Start preparing
              </>
            )}
            {ticket.state === 'Preparing' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
                {allDone ? 'Mark ready' : `Bump (${completedItems}/${totalItems})`}
              </>
            )}
            {ticket.state === 'Done' && <>Done</>}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ============================================================ */
/*  Helpers / sub-components                                    */
/* ============================================================ */

const stateMeta: Record<
  State,
  { text: string; cardBg: string; cardBorder: string; bar: string; dot: string }
> = {
  Confirmed: {
    text: 'text-amber-700',
    cardBg: 'bg-amber-50/40',
    cardBorder: 'border-amber-200',
    bar: 'bg-gradient-to-r from-amber-400 to-amber-500',
    dot: 'bg-amber-500',
  },
  Preparing: {
    text: 'text-blue-700',
    cardBg: 'bg-blue-50/40',
    cardBorder: 'border-blue-200',
    bar: 'bg-gradient-to-r from-blue-400 to-cool-500',
    dot: 'bg-blue-500',
  },
  Done: {
    text: 'text-emerald-700',
    cardBg: 'bg-emerald-50/40',
    cardBorder: 'border-emerald-200',
    bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    dot: 'bg-emerald-500',
  },
};

const stationMeta: Record<Station, { pill: string }> = {
  Hot: { pill: 'bg-rose-50 text-rose-700 ring-rose-200' },
  Cold: { pill: 'bg-cool-50 text-cool-700 ring-cool-200' },
  Bar: { pill: 'bg-warm-50 text-warm-700 ring-warm-200' },
  Dessert: { pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

function ageMinutes(receivedAt: number) {
  return Math.max(0, Math.floor((Date.now() - receivedAt) / 60_000));
}

function StationToggle({
  value,
  onChange,
}: {
  value: 'All' | Station;
  onChange: (v: 'All' | Station) => void;
}) {
  const list: ('All' | Station)[] = ['All', 'Hot', 'Cold', 'Bar', 'Dessert'];
  return (
    <div className="hidden h-9 items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm md:inline-flex">
      {list.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'relative inline-flex items-center rounded-lg px-2.5 py-1 text-[12px] font-bold transition',
              active ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {active && (
              <motion.span
                layoutId="kds-station"
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search ticket…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-44 rounded-xl border border-ink-200 bg-white pl-8 pr-3 text-[12px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 sm:w-56"
      />
    </div>
  );
}
