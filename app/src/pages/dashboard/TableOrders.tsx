import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChefHat,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
  Filter,
  IndianRupee,
  LayoutGrid,
  List,
  Plus,
  Receipt,
  RefreshCcw,
  Search,
  Split,
  Timer,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { sessionsApi, type TableSession } from '../../services/sessions';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type Status = 'Open' | 'Preparing' | 'Served' | 'Awaiting payment';
type Channel = 'Waiter' | 'QR' | 'POS';

type Round = {
  id: string;
  at: string;
  items: { name: string; emoji: string; qty: number; price: number }[];
};

type TableOrder = {
  id: string;
  table: string;
  section: string;
  guests: number;
  channel: Channel;
  waiter?: string;
  guestName?: string;
  startedAt: string; // HH:mm
  durationMin: number;
  status: Status;
  rounds: Round[];
  tags?: string[];
};

const _legacyAllOrders: TableOrder[] = [
  {
    id: 'TBL-1841',
    table: 'T-7',
    section: 'Indoor · Window',
    guests: 4,
    channel: 'Waiter',
    waiter: 'Aman K.',
    guestName: 'Aarav Mehta',
    startedAt: '12:42',
    durationMin: 36,
    status: 'Preparing',
    tags: ['Birthday'],
    rounds: [
      {
        id: 'R-1',
        at: '12:44',
        items: [
          { name: 'Margherita', emoji: '🍕', qty: 1, price: 4.5 },
          { name: 'Caesar Salad', emoji: '🥗', qty: 1, price: 3.3 },
          { name: 'Iced Latte', emoji: '🧊', qty: 2, price: 1.5 },
        ],
      },
      {
        id: 'R-2',
        at: '13:08',
        items: [
          { name: 'Tiramisu', emoji: '🍰', qty: 1, price: 2.5 },
          { name: 'Espresso', emoji: '☕', qty: 2, price: 1.0 },
        ],
      },
    ],
  },
  {
    id: 'TBL-1840',
    table: 'T-12',
    section: 'Terrace',
    guests: 2,
    channel: 'QR',
    guestName: 'Walking customer',
    startedAt: '12:55',
    durationMin: 22,
    status: 'Open',
    rounds: [
      {
        id: 'R-1',
        at: '12:56',
        items: [
          { name: 'Truffle Burger', emoji: '🍔', qty: 2, price: 5.9 },
          { name: 'Mojito', emoji: '🍹', qty: 2, price: 4.0 },
        ],
      },
    ],
  },
  {
    id: 'TBL-1839',
    table: 'T-3',
    section: 'Indoor · Center',
    guests: 6,
    channel: 'Waiter',
    waiter: 'Nikita J.',
    guestName: 'Priya Iyer',
    startedAt: '12:18',
    durationMin: 60,
    status: 'Awaiting payment',
    rounds: [
      {
        id: 'R-1',
        at: '12:20',
        items: [
          { name: 'Sushi Set', emoji: '🍣', qty: 1, price: 7.5 },
          { name: 'Carbonara', emoji: '🍝', qty: 2, price: 4.2 },
          { name: 'Veggie Burger', emoji: '🍔', qty: 1, price: 3.8 },
        ],
      },
      {
        id: 'R-2',
        at: '12:40',
        items: [
          { name: 'Pinot Noir', emoji: '🍷', qty: 2, price: 6.0 },
          { name: 'Cheesecake', emoji: '🍰', qty: 2, price: 2.8 },
        ],
      },
    ],
  },
  {
    id: 'TBL-1838',
    table: 'T-9',
    section: 'Outdoor · Patio',
    guests: 3,
    channel: 'Waiter',
    waiter: 'Aman K.',
    guestName: 'Vikram Reddy',
    startedAt: '11:58',
    durationMin: 78,
    status: 'Served',
    tags: ['VIP'],
    rounds: [
      {
        id: 'R-1',
        at: '12:00',
        items: [
          { name: 'Steak Frites', emoji: '🥩', qty: 2, price: 8.5 },
          { name: 'Burrata', emoji: '🧀', qty: 1, price: 4.5 },
          { name: 'Pinot Noir', emoji: '🍷', qty: 3, price: 6.0 },
        ],
      },
      {
        id: 'R-2',
        at: '12:32',
        items: [{ name: 'Tiramisu', emoji: '🍰', qty: 3, price: 2.5 }],
      },
    ],
  },
  {
    id: 'TBL-1837',
    table: 'T-1',
    section: 'Indoor · Window',
    guests: 2,
    channel: 'QR',
    guestName: 'Walking customer',
    startedAt: '13:08',
    durationMin: 9,
    status: 'Open',
    rounds: [
      {
        id: 'R-1',
        at: '13:09',
        items: [
          { name: 'Cappuccino', emoji: '☕', qty: 2, price: 1.5 },
          { name: 'Brownie', emoji: '🍫', qty: 1, price: 1.8 },
        ],
      },
    ],
  },
  {
    id: 'TBL-1836',
    table: 'T-11',
    section: 'Terrace',
    guests: 4,
    channel: 'Waiter',
    waiter: 'Sara P.',
    guestName: 'D. Joshi',
    startedAt: '12:36',
    durationMin: 42,
    status: 'Preparing',
    rounds: [
      {
        id: 'R-1',
        at: '12:38',
        items: [
          { name: 'Pad Thai', emoji: '🍜', qty: 2, price: 4.0 },
          { name: 'Spring Rolls', emoji: '🥟', qty: 1, price: 2.0 },
          { name: 'Mango Lassi', emoji: '🥭', qty: 4, price: 1.5 },
        ],
      },
    ],
  },
  {
    id: 'TBL-1835',
    table: 'T-5',
    section: 'Indoor · Bar',
    guests: 2,
    channel: 'POS',
    waiter: 'Sara P.',
    guestName: 'Rohit Sharma',
    startedAt: '11:42',
    durationMin: 92,
    status: 'Awaiting payment',
    tags: ['Slow turn'],
    rounds: [
      {
        id: 'R-1',
        at: '11:44',
        items: [
          { name: 'Negroni', emoji: '🍸', qty: 2, price: 5.0 },
          { name: 'Bruschetta', emoji: '🍞', qty: 1, price: 2.5 },
          { name: 'Calamari Fritti', emoji: '🦑', qty: 1, price: 3.8 },
        ],
      },
      {
        id: 'R-2',
        at: '12:18',
        items: [{ name: 'Chardonnay', emoji: '🥂', qty: 2, price: 5.5 }],
      },
    ],
  },
  {
    id: 'TBL-1834',
    table: 'T-6',
    section: 'Indoor · Bar',
    guests: 1,
    channel: 'QR',
    guestName: 'Walking customer',
    startedAt: '13:01',
    durationMin: 16,
    status: 'Served',
    rounds: [
      {
        id: 'R-1',
        at: '13:03',
        items: [
          { name: 'Old Fashioned', emoji: '🥃', qty: 1, price: 5.0 },
          { name: 'Cheesecake', emoji: '🍰', qty: 1, price: 2.8 },
        ],
      },
    ],
  },
];

void _legacyAllOrders;

const SERVER_SESSION_STATUS_TO_LOCAL: Record<string, Status> = {
  OPEN: 'Open',
  PREPARING: 'Preparing',
  SERVED: 'Served',
  AWAITING_PAYMENT: 'Awaiting payment',
  CLOSED: 'Served',
};

function adaptSession(s: TableSession): TableOrder {
  const startedDate = new Date(s.openedAt);
  const startedAt = `${String(startedDate.getHours()).padStart(2, '0')}:${String(startedDate.getMinutes()).padStart(2, '0')}`;
  const durationMin = Math.max(0, Math.round((Date.now() - startedDate.getTime()) / 60_000));
  return {
    id: s.id,
    table: s.orders[0]?.tableLabel ?? `T-${s.tableId.slice(-4)}`,
    section: '—',
    guests: s.partySize,
    channel: 'Waiter',
    guestName: s.guestName ?? undefined,
    startedAt,
    durationMin,
    status: SERVER_SESSION_STATUS_TO_LOCAL[s.status] ?? 'Open',
    rounds: s.rounds.map((r) => ({
      id: r.serial,
      at: new Date(r.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: r.lines.map((l) => ({
        name: l.name,
        emoji: l.emoji ?? '🍽️',
        qty: l.qty,
        price: l.unitPrice,
      })),
    })),
  };
}

const statusOrder: Status[] = ['Open', 'Preparing', 'Served', 'Awaiting payment'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function TableOrders() {
  const branches = branchesStore.use();
  const [allOrders, setAllOrders] = useState<TableOrder[]>([]);
  const [, setLoading] = useState(false);
  const [, setFetchError] = useState<string | null>(null);

  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('All sections');
  const [waiter, setWaiter] = useState('All waiters');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [, force] = useState(0);

  // Fetch active table sessions for the active branch.
  useEffect(() => {
    if (!branches.activeId) {
      setAllOrders([]);
      return;
    }
    setLoading(true);
    setFetchError(null);
    sessionsApi
      .list(branches.activeId)
      .then((rows) =>
        setAllOrders(
          rows
            .filter((s) => s.status !== 'CLOSED')
            .map(adaptSession),
        ),
      )
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, [branches.activeId]);

  const sections = useMemo(
    () => ['All sections', ...Array.from(new Set(allOrders.map((o) => o.section)))],
    [allOrders],
  );
  const waiters = useMemo(
    () => [
      'All waiters',
      ...Array.from(new Set(allOrders.map((o) => o.waiter).filter(Boolean) as string[])),
    ],
    [allOrders],
  );

  // Tick durations every 30s
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return allOrders.filter((o) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !o.id.toLowerCase().includes(s) &&
          !o.table.toLowerCase().includes(s) &&
          !(o.guestName ?? '').toLowerCase().includes(s) &&
          !(o.waiter ?? '').toLowerCase().includes(s)
        )
          return false;
      }
      if (section !== 'All sections' && o.section !== section) return false;
      if (waiter !== 'All waiters' && o.waiter !== waiter) return false;
      if (status !== 'All' && o.status !== status) return false;
      return true;
    });
  }, [search, section, waiter, status, allOrders]);

  const totals = useMemo(() => {
    const live = allOrders.length;
    const guests = allOrders.reduce((s, o) => s + o.guests, 0);
    const revenue = allOrders.reduce((s, o) => s + computeTotals(o).total, 0);
    const avgTurn = Math.round(allOrders.reduce((s, o) => s + o.durationMin, 0) / Math.max(1, allOrders.length || 1));
    return { live, guests, revenue, avgTurn };
  }, [allOrders]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: allOrders.length };
    statusOrder.forEach((s) => {
      m[s] = allOrders.filter((o) => o.status === s).length;
    });
    return m;
  }, [allOrders]);

  const drawerOrder = drawerId ? allOrders.find((o) => o.id === drawerId) ?? null : null;

  const clearFilters = () => {
    setSearch('');
    setSection('All sections');
    setWaiter('All waiters');
    setStatus('All');
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(section !== 'All sections') +
    Number(waiter !== 'All waiters') +
    Number(status !== 'All');

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Active tables" value={totals.live} tone="brand" icon={Users} />
          <Kpi label="Guests served" value={totals.guests} tone="cool" icon={Users} />
          <Kpi label="Live revenue" value={totals.revenue} prefix="$" tone="emerald" icon={IndianRupee} />
          <Kpi label="Avg dine time" value={totals.avgTurn} suffix="m" tone="amber" icon={Timer} />
        </div>

        {/* Status pills */}
        <StatusPills value={status} onChange={setStatus} counts={counts} />

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Table Orders</h2>
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
              <SearchBox value={search} onChange={setSearch} />
              <ViewToggle value={view} onChange={setView} />
              <FilterMenu
                section={section}
                setSection={setSection}
                waiter={waiter}
                setWaiter={setWaiter}
                sections={sections}
                waiters={waiters}
              />
              <Link
                to="/dashboard/pos"
                className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                Open table
              </Link>
            </div>
          </div>

          {/* Body */}
          <AnimatePresence mode="wait">
            {view === 'cards' ? (
              <motion.div
                key="cards"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="p-4 sm:p-6"
              >
                {filtered.length === 0 ? (
                  <EmptyState onReset={clearFilters} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((o, i) => (
                      <TableCard
                        key={o.id}
                        order={o}
                        index={i}
                        onView={() => setDrawerId(o.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ink-100">
                    <thead>
                      <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                        <Th>Order</Th>
                        <Th>Table · section</Th>
                        <Th>Guests</Th>
                        <Th>Captain</Th>
                        <Th>Time</Th>
                        <Th>Rounds</Th>
                        <Th>Total</Th>
                        <Th>Status</Th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-sm">
                      {filtered.map((o, i) => (
                        <Row key={o.id} order={o} index={i} onView={() => setDrawerId(o.id)} />
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-5 py-16 text-center">
                            <div className="text-base font-bold text-ink-700">No table orders</div>
                            <div className="mt-1 text-sm text-ink-500">Try clearing filters or open a new table.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <OrderDrawer order={drawerOrder} onClose={() => setDrawerId(null)} />
    </>
  );
}

/* ============================================================ */
/*  Card view                                                   */
/* ============================================================ */

function TableCard({
  order,
  index,
  onView,
}: {
  order: TableOrder;
  index: number;
  onView: () => void;
}) {
  const meta = statusMeta[order.status];
  const totals = computeTotals(order);

  return (
    <motion.button
      onClick={onView}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition hover:shadow-md',
        meta.cardBg,
        meta.cardBorder,
      )}
    >
      {/* Status pulse */}
      {(order.status === 'Open' || order.status === 'Preparing') && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-70', meta.dot)} />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', meta.dot)} />
        </span>
      )}

      {/* Top row */}
      <div className="flex items-start justify-between pr-6">
        <div>
          <div className="text-2xl font-extrabold text-ink-900">{order.table}</div>
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            {order.section}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] font-bold text-ink-500">#{order.id}</div>
          <ChannelChip channel={order.channel} />
        </div>
      </div>

      {/* Status pill */}
      <div className="mt-3">
        <StatusPill status={order.status} />
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Guests">
          <span className="inline-flex items-center justify-center gap-1">
            <Users className="h-3 w-3 text-ink-400" />
            {order.guests}
          </span>
        </Stat>
        <Stat label="Time">
          <span className="inline-flex items-center justify-center gap-1">
            <Clock
              className={cn(
                'h-3 w-3',
                order.durationMin > 75 ? 'text-rose-500' : 'text-ink-400',
              )}
            />
            {order.durationMin}m
          </span>
        </Stat>
        <Stat label="Rounds">{order.rounds.length}</Stat>
      </div>

      {/* Captain / guest */}
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-white">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white',
            avatarGradient(order.guestName ?? order.table),
          )}
        >
          {initials(order.guestName ?? order.table)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-ink-900">
            {order.guestName ?? 'Walking customer'}
          </div>
          <div className="text-[10px] font-medium text-ink-500">
            {order.waiter ? `Captain · ${order.waiter}` : 'Self-service · QR'}
          </div>
        </div>
      </div>

      {/* Tags */}
      {order.tags && order.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {order.tags.map((t) => (
            <span
              key={t}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                t === 'VIP'
                  ? 'bg-amber-100 text-amber-700'
                  : t === 'Slow turn'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-violet-100 text-violet-700',
              )}
            >
              {t === 'Slow turn' && <AlertTriangle className="h-2.5 w-2.5" />}
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Total + cta */}
      <div className="mt-3 flex items-end justify-between border-t border-white/60 pt-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Running bill</div>
          <div className="text-xl font-extrabold text-brand-600">${totals.total.toFixed(2)}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200 transition group-hover:bg-brand-500 group-hover:text-white group-hover:ring-brand-500">
          Open
          <Eye className="h-3 w-3" />
        </span>
      </div>
    </motion.button>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-2 py-1.5 ring-1 ring-white">
      <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-[13px] font-extrabold text-ink-900">{children}</div>
    </div>
  );
}

/* ============================================================ */
/*  List view                                                   */
/* ============================================================ */

function Row({
  order,
  index,
  onView,
}: {
  order: TableOrder;
  index: number;
  onView: () => void;
}) {
  const totals = computeTotals(order);
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className="group cursor-pointer transition-colors hover:bg-ink-50/60"
      onClick={onView}
    >
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">#{order.id}</div>
        <ChannelChip channel={order.channel} />
      </td>
      <td className="px-5 py-3">
        <div className="text-sm font-extrabold text-ink-900">{order.table}</div>
        <div className="text-[11px] font-medium text-ink-500">{order.section}</div>
      </td>
      <td className="px-5 py-3">
        <div className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-900">
          <Users className="h-3.5 w-3.5 text-ink-400" />
          {order.guests}
        </div>
      </td>
      <td className="px-5 py-3 text-[13px] font-semibold text-ink-700">
        {order.waiter ?? <span className="text-ink-400">Self · QR</span>}
      </td>
      <td className="px-5 py-3">
        <div className={cn('inline-flex items-center gap-1 text-[13px] font-bold', order.durationMin > 75 ? 'text-rose-600' : 'text-ink-700')}>
          <Clock className="h-3.5 w-3.5" />
          {order.durationMin}m
        </div>
        <div className="text-[10px] font-medium text-ink-400">since {order.startedAt}</div>
      </td>
      <td className="px-5 py-3 text-[13px] font-bold text-ink-700">
        {order.rounds.length}
      </td>
      <td className="px-5 py-3">
        <div className="font-mono text-sm font-extrabold text-ink-900">${totals.total.toFixed(2)}</div>
        <div className="text-[10px] font-bold text-ink-400">{totals.itemCount} items</div>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={order.status} />
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="Open" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="emerald" label="Print KOT">
            <ChefHat className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="rose" label="Settle">
            <Receipt className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </motion.tr>
  );
}

/* ============================================================ */
/*  Status / channel                                            */
/* ============================================================ */

const statusMeta: Record<
  Status,
  {
    pill: string;
    dot: string;
    cardBg: string;
    cardBorder: string;
  }
> = {
  Open: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    cardBg: 'bg-emerald-50/60',
    cardBorder: 'border-emerald-200',
  },
  Preparing: {
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    cardBg: 'bg-amber-50/50',
    cardBorder: 'border-amber-200',
  },
  Served: {
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    cardBg: 'bg-blue-50/40',
    cardBorder: 'border-blue-200',
  },
  'Awaiting payment': {
    pill: 'bg-brand-50 text-brand-700 ring-brand-200',
    dot: 'bg-brand-500',
    cardBg: 'bg-brand-50/40',
    cardBorder: 'border-brand-200',
  },
};

function StatusPill({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', meta.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

const channelMeta: Record<Channel, { label: string; pill: string }> = {
  Waiter: { label: 'Waiter', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  QR: { label: 'QR', pill: 'bg-cool-50 text-cool-700 ring-cool-200' },
  POS: { label: 'POS', pill: 'bg-warm-50 text-warm-700 ring-warm-200' },
};

function ChannelChip({ channel }: { channel: Channel }) {
  const meta = channelMeta[channel];
  return (
    <span className={cn('mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', meta.pill)}>
      via {meta.label}
    </span>
  );
}

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
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
            )}
          >
            {meta && (
              <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : meta.dot)} />
            )}
            {s}
            <span className={cn(
              'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
              active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
            )}>
              {counts[s]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Helpers                                                     */
/* ============================================================ */

function computeTotals(order: TableOrder) {
  const subtotal = order.rounds.reduce(
    (s, r) => s + r.items.reduce((ss, i) => ss + i.qty * i.price, 0),
    0,
  );
  const itemCount = order.rounds.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const tax = subtotal * settingsStore.defaultTaxRate();
  const service = subtotal * settingsStore.serviceChargeRate();
  const total = subtotal + tax + service;
  return { subtotal, tax, service, total, itemCount };
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
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition', cls)}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
}

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
  suffix,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
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
            <Counter value={value} prefix={prefix} suffix={suffix} decimals={prefix === '$' ? 2 : 0} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-brand-100">
        <Users className="h-6 w-6 text-brand-500" />
      </span>
      <div>
        <div className="text-base font-bold text-ink-900">No active table sessions</div>
        <div className="mt-0.5 text-[12px] text-ink-500">Open a table to start taking orders.</div>
      </div>
      <button
        onClick={onReset}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
      >
        <RefreshCcw className="h-3 w-3" />
        Reset filters
      </button>
    </div>
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
      <span className="text-ink-900">Table Orders</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by table, captain, guest…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: 'cards' | 'list'; onChange: (v: 'cards' | 'list') => void }) {
  return (
    <div className="relative inline-flex h-9 items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      {(['cards', 'list'] as const).map((v) => {
        const active = v === value;
        const Icon = v === 'cards' ? LayoutGrid : List;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold transition',
              active ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {active && (
              <motion.span
                layoutId="tableorders-view-toggle"
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {v === 'cards' ? 'Cards' : 'List'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilterMenu({
  section,
  setSection,
  waiter,
  setWaiter,
  sections,
  waiters,
}: {
  section: string;
  setSection: (s: string) => void;
  waiter: string;
  setWaiter: (s: string) => void;
  sections: string[];
  waiters: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
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
              className="absolute right-0 top-full z-40 mt-2 w-72 space-y-3 rounded-xl border border-ink-200 bg-white p-3 shadow-2xl shadow-black/10"
            >
              <div>
                <div className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">Section</div>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="vue-input h-9 text-[13px]"
                >
                  {sections.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">Captain</div>
                <select
                  value={waiter}
                  onChange={(e) => setWaiter(e.target.value)}
                  className="vue-input h-9 text-[13px]"
                >
                  {waiters.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */
/*  Drawer (round-by-round breakdown + actions)                 */
/* ============================================================ */

function OrderDrawer({ order, onClose }: { order: TableOrder | null; onClose: () => void }) {
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
            {(() => {
              const totals = computeTotals(order);
              return (
                <>
                  {/* Header */}
                  <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
                    <button
                      onClick={onClose}
                      aria-label="Close"
                      className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                      Table session
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <div className="text-3xl font-extrabold">{order.table}</div>
                      <div className="font-mono text-[12px] text-white/80">#{order.id}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                      <span className="rounded-full bg-white/20 px-2 py-0.5">{order.section}</span>
                      <span className="rounded-full bg-white/20 px-2 py-0.5">{order.guests} guests</span>
                      <span className="rounded-full bg-white/20 px-2 py-0.5">via {order.channel}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[12px] text-white/85">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Started {order.startedAt} · {order.durationMin}m
                      </span>
                      {order.waiter && (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {order.waiter}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-5 p-6">
                    {/* Guest */}
                    <Section title="Guest">
                      <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                        <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white', avatarGradient(order.guestName ?? order.table))}>
                          {initials(order.guestName ?? order.table)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-ink-900">
                            {order.guestName ?? 'Walking customer'}
                          </div>
                          <div className="text-[12px] text-ink-500">
                            {order.waiter ? `Waited by ${order.waiter}` : 'Self-service via QR'}
                          </div>
                        </div>
                        {order.tags?.map((t) => (
                          <span
                            key={t}
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
                              t === 'VIP'
                                ? 'bg-amber-100 text-amber-700'
                                : t === 'Slow turn'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-violet-100 text-violet-700',
                            )}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </Section>

                    {/* Status */}
                    <Section title="Status">
                      <div className="flex flex-wrap gap-2">
                        {statusOrder.map((s) => (
                          <span
                            key={s}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition',
                              order.status === s
                                ? statusMeta[s].pill
                                : 'bg-white text-ink-400 ring-ink-200',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                order.status === s ? statusMeta[s].dot : 'bg-ink-300',
                              )}
                            />
                            {s}
                          </span>
                        ))}
                      </div>
                    </Section>

                    {/* Rounds */}
                    <Section title={`Order rounds · ${order.rounds.length}`}>
                      <ul className="space-y-3">
                        {order.rounds.map((r, i) => {
                          const roundTotal = r.items.reduce((s, it) => s + it.qty * it.price, 0);
                          return (
                            <li key={r.id} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                              <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-3 py-2">
                                <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
                                  Round {i + 1}
                                  <span className="ml-2 text-ink-400">{r.at}</span>
                                </div>
                                <div className="font-mono text-[12px] font-bold text-ink-900">
                                  ${roundTotal.toFixed(2)}
                                </div>
                              </div>
                              <ul className="divide-y divide-ink-100 text-sm">
                                {r.items.map((it, j) => (
                                  <li key={j} className="flex items-center justify-between px-3 py-2">
                                    <span className="inline-flex items-center gap-2">
                                      <span className="text-base">{it.emoji}</span>
                                      <span className="font-bold text-ink-900">
                                        {it.qty}× {it.name}
                                      </span>
                                    </span>
                                    <span className="font-bold text-ink-900">
                                      ${(it.qty * it.price).toFixed(2)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>

                      <button className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 px-3 py-2.5 text-[12px] font-bold text-brand-700 transition hover:bg-brand-50">
                        <Plus className="h-3.5 w-3.5" />
                        Add another round
                      </button>
                    </Section>

                    {/* Totals */}
                    <Section title="Bill">
                      <div className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                        <Line label={`Subtotal · ${totals.itemCount} items`}>${totals.subtotal.toFixed(2)}</Line>
                        <Line label="Tax (5%)">${totals.tax.toFixed(2)}</Line>
                        <Line label="Service charge (5%)">${totals.service.toFixed(2)}</Line>
                        <div className="my-1 border-t border-dashed border-ink-200" />
                        <Line label="Total" emphasis>
                          ${totals.total.toFixed(2)}
                        </Line>
                      </div>
                    </Section>
                  </div>

                  {/* Footer */}
                  <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-ink-100 bg-white p-4">
                    <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Split className="h-3.5 w-3.5" />
                        Split
                      </span>
                    </button>
                    <button className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700">
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <ChefHat className="h-3.5 w-3.5" />
                        KOT
                      </span>
                    </button>
                    <button className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold">
                      <CreditCard className="h-3.5 w-3.5" />
                      Settle
                    </button>
                  </div>
                </>
              );
            })()}
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

function Line({ label, emphasis, children }: { label: string; emphasis?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between', emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700')}>
      <span className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</span>
      <span className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</span>
    </div>
  );
}
