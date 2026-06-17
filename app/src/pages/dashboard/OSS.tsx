import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChefHat, Maximize, Minimize, ScanLine, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { ossApi } from '../../services/oss';
import { socketClient } from '../../lib/socket';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type State = 'Preparing' | 'Ready';

type DisplayOrder = {
  token: string;
  customer: string;
  channel: 'Dine-In' | 'Takeaway' | 'Online' | 'QR';
  state: State;
};

const _initialOrders: DisplayOrder[] = [
  { token: '128', customer: 'Aarav', channel: 'Takeaway', state: 'Ready' },
  { token: '129', customer: 'Priya', channel: 'Online', state: 'Ready' },
  { token: '130', customer: 'Walking', channel: 'QR', state: 'Ready' },
  { token: '131', customer: 'Rohit', channel: 'Takeaway', state: 'Preparing' },
  { token: '132', customer: 'Neha', channel: 'Dine-In', state: 'Preparing' },
  { token: '133', customer: 'Vikram', channel: 'Online', state: 'Preparing' },
  { token: '134', customer: 'Sana', channel: 'Takeaway', state: 'Preparing' },
  { token: '135', customer: 'Anika', channel: 'QR', state: 'Preparing' },
  { token: '136', customer: 'Yash', channel: 'Online', state: 'Preparing' },
];
void _initialOrders;

const popular = [
  { name: 'Margherita', emoji: '🍕', price: 4.5 },
  { name: 'Truffle Burger', emoji: '🍔', price: 5.9 },
  { name: 'Caesar Salad', emoji: '🥗', price: 3.3 },
  { name: 'Sushi Set', emoji: '🍣', price: 7.5 },
  { name: 'Tiramisu', emoji: '🍰', price: 2.5 },
  { name: 'Mojito', emoji: '🍹', price: 4.0 },
  { name: 'Cappuccino', emoji: '☕', price: 1.5 },
  { name: 'Pad Thai', emoji: '🍜', price: 4.0 },
];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function OSS() {
  const branches = branchesStore.use();
  const activeBranch = branches.list.find((b) => b.id === branches.activeId) ?? null;

  const [orders, setOrders] = useState<DisplayOrder[]>([]);
  const [now, setNow] = useState(new Date());
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReadyCount = useRef(0);

  // Fetch the live OSS board for this branch + subscribe to refreshes.
  useEffect(() => {
    if (!activeBranch?.qrSlug) {
      setOrders([]);
      return;
    }
    const slug = activeBranch.qrSlug;
    const refresh = async () => {
      try {
        const board = await ossApi.getBoard(slug);
        const next: DisplayOrder[] = [
          ...board.preparing.map<DisplayOrder>((p) => ({
            token: p.token.replace(/^TKN-/, ''),
            customer: p.serial,
            channel: (p.type === 'DELIVERY' ? 'Online' : p.type === 'TAKEAWAY' ? 'Takeaway' : 'Dine-In') as DisplayOrder['channel'],
            state: 'Preparing',
          })),
          ...board.ready.map<DisplayOrder>((r) => ({
            token: r.token.replace(/^TKN-/, ''),
            customer: r.serial,
            channel: (r.type === 'DELIVERY' ? 'Online' : r.type === 'TAKEAWAY' ? 'Takeaway' : 'Dine-In') as DisplayOrder['channel'],
            state: 'Ready',
          })),
        ];
        setOrders(next);
      } catch {
        // keep last
      }
    };
    refresh();
    const off = socketClient.on('oss:tokens', () => {
      refresh();
    });
    const tick = window.setInterval(refresh, 15_000);
    return () => {
      off();
      window.clearInterval(tick);
    };
  }, [activeBranch?.qrSlug]);

  // Update clock
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Bell sound when a new ready order appears (simulated by counting ready set growth)
  useEffect(() => {
    const readyCount = orders.filter((o) => o.state === 'Ready').length;
    if (!muted && readyCount > lastReadyCount.current) {
      // Synthesized bell using WebAudio (no asset shipped)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } catch {
        // ignore — autoplay or context errors are fine on a passive screen
      }
    }
    lastReadyCount.current = readyCount;
  }, [orders, muted]);

  // Fullscreen
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const preparing = orders.filter((o) => o.state === 'Preparing');
  const ready = orders.filter((o) => o.state === 'Ready');

  return (
    <div
      ref={containerRef}
      className="-mx-4 -my-6 flex h-[calc(100vh-64px)] flex-col bg-gradient-to-br from-ink-50 to-brand-50/30 sm:-mx-6 lg:-mx-8"
    >
      {/* Chrome bar */}
      <header className="flex items-center justify-between gap-3 border-b border-ink-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[12px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exit OSS
          </Link>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">
              Order Status Screen
            </div>
            <div className="text-sm font-extrabold text-ink-900">Bandra · Counter screen</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock now={now} />
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
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
            aria-label="Fullscreen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-5 lg:p-6">
        {/* Popular menu items */}
        <PopularPanel />

        {/* Preparing column */}
        <Column title="Preparing" tone="brand" count={preparing.length}>
          <AnimatePresence mode="popLayout">
            {preparing.length === 0 ? (
              <ColumnEmpty
                key="empty-prep"
                emoji="✨"
                label="All caught up"
                sub="No tickets in progress right now."
              />
            ) : (
              preparing.map((o) => <Tile key={o.token} order={o} />)
            )}
          </AnimatePresence>
        </Column>

        {/* Ready column */}
        <Column title="Ready" tone="emerald" count={ready.length} pulse>
          <AnimatePresence mode="popLayout">
            {ready.length === 0 ? (
              <ColumnEmpty
                key="empty-ready"
                emoji="🍽️"
                label="Waiting for the kitchen"
                sub="Ready tokens will pop up here."
              />
            ) : (
              ready.map((o) => <Tile key={o.token} order={o} variant="ready" />)
            )}
          </AnimatePresence>
        </Column>
      </div>

      {/* Bottom marquee */}
      <Marquee />
    </div>
  );
}

/* ============================================================ */
/*  Popular menu rail                                           */
/* ============================================================ */

function PopularPanel() {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-cool-500 to-blue-500 px-4 py-3 text-white">
        <div className="text-sm font-extrabold tracking-tight">Popular Menu Items</div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
          <Sparkles className="h-3 w-3" />
          AI picked
        </span>
      </header>

      <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto p-3">
        {popular.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm"
          >
            <div className="relative h-24 overflow-hidden bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50">
              <span className="absolute inset-0 flex items-center justify-center text-5xl">
                {p.emoji}
              </span>
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-900 ring-1 ring-ink-100">
                ★ Top
              </span>
            </div>
            <div className="px-3 py-2">
              <div className="truncate text-[13px] font-bold text-ink-900">{p.name}</div>
              <div className="text-[12px] font-extrabold text-brand-600">${p.price.toFixed(2)}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* QR scan footer */}
      <footer className="flex items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Skip the line</div>
          <div className="text-[13px] font-extrabold text-ink-900">Scan to order from your phone</div>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-warm-500 text-white shadow-md shadow-brand-500/30">
          <ScanLine className="h-5 w-5" />
        </span>
      </footer>
    </section>
  );
}

/* ============================================================ */
/*  Column                                                      */
/* ============================================================ */

const colTone = {
  brand: { from: 'from-brand-500', to: 'to-rose-500', dot: 'bg-brand-500' },
  emerald: { from: 'from-emerald-500', to: 'to-emerald-600', dot: 'bg-emerald-500' },
} as const;

function Column({
  title,
  tone,
  count,
  pulse,
  children,
}: {
  title: string;
  tone: keyof typeof colTone;
  count: number;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  const t = colTone[tone];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <header
        className={cn(
          'relative flex items-center justify-between bg-gradient-to-r px-4 py-3 text-white',
          t.from,
          t.to,
        )}
      >
        <div className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}
          {title}
        </div>
        <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-white/25 px-2 text-[11px] font-bold">
          {count}
        </span>
      </header>
      <div className="grid min-h-0 grid-cols-2 content-start gap-3 overflow-y-auto p-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function ColumnEmpty({ emoji, label, sub }: { emoji: string; label: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-white py-12 text-center"
    >
      <span className="text-4xl">{emoji}</span>
      <div className="text-[14px] font-extrabold text-ink-700">{label}</div>
      <div className="text-[12px] text-ink-500">{sub}</div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Tile (token)                                                */
/* ============================================================ */

const channelMeta: Record<DisplayOrder['channel'], { label: string; pill: string }> = {
  'Dine-In': { label: 'Dine-In', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  Takeaway: { label: 'Pickup', pill: 'bg-warm-50 text-warm-700 ring-warm-200' },
  Online: { label: 'Delivery', pill: 'bg-cool-50 text-cool-700 ring-cool-200' },
  QR: { label: 'QR', pill: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

function Tile({ order, variant = 'preparing' }: { order: DisplayOrder; variant?: 'preparing' | 'ready' }) {
  const channel = channelMeta[order.channel];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -16 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-4 text-center shadow-sm',
        variant === 'ready'
          ? 'border-emerald-300 bg-emerald-50/70'
          : 'border-brand-200 bg-brand-50/40',
      )}
    >
      {/* Glow on ready */}
      {variant === 'ready' && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-emerald-300/30 blur-2xl"
        />
      )}

      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Token</div>
      <div className={cn('mt-1 font-mono text-5xl font-black tracking-tight', variant === 'ready' ? 'text-emerald-700' : 'text-brand-600')}>
        {order.token}
      </div>
      <div className="mt-2 truncate text-[12px] font-bold text-ink-700">{order.customer}</div>
      <div className="mt-2 inline-flex items-center justify-center">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
            channel.pill,
          )}
        >
          {channel.label}
        </span>
      </div>

      {/* Ready badge */}
      {variant === 'ready' && (
        <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-bl-2xl rounded-tr-2xl bg-emerald-500 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/30">
          <ChefHat className="h-2.5 w-2.5" />
          Ready
        </span>
      )}
    </motion.div>
  );
}

/* ============================================================ */
/*  Clock                                                       */
/* ============================================================ */

function Clock({ now }: { now: Date }) {
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  return (
    <div className="hidden items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 shadow-sm sm:inline-flex">
      <div className="text-[9px] font-bold uppercase tracking-widest text-ink-500">Live</div>
      <div className="font-mono text-sm font-extrabold text-ink-900 tabular-nums">
        {hh}:{mm}
        <span className="text-ink-400">:{ss}</span>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Marquee                                                     */
/* ============================================================ */

const promos = [
  '🔥 Chef\'s special tonight · Truffle Burger ₹590',
  '🥂 Happy hours from 6 PM · 1+1 on cocktails',
  '🍕 Free delivery on orders above ₹500 within Bandra',
  '⭐ Vuedine AI suggests the Sushi Set tonight — 92% love it',
  '🍰 New on the menu · Salted-caramel Tiramisu',
];

function Marquee() {
  const items = [...promos, ...promos];
  return (
    <div className="relative overflow-hidden border-t border-ink-200 bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 py-2 text-white">
      <div className="flex w-max items-center gap-10 animate-[marquee_45s_linear_infinite] px-6">
        {items.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[12px] font-bold whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
