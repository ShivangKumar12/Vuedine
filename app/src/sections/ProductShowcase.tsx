import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChefHat, LayoutDashboard, QrCode, BarChart3 } from 'lucide-react';
import { SectionLabel } from '../components/SectionLabel';
import { Reveal } from '../components/Reveal';

type Stage = {
  id: string;
  title: string;
  desc: string;
  icon: typeof LayoutDashboard;
  accent: string;
  body: () => ReactNode;
};

const stages: Stage[] = [
  {
    id: 'pos',
    title: 'Smart POS',
    desc: 'Lightning-fast billing built for the rush. Split bills, KOTs, GST, payments — in two taps.',
    icon: LayoutDashboard,
    accent: 'from-brand-500 via-rose-500 to-warm-500',
    body: PosFrame,
  },
  {
    id: 'qr',
    title: 'QR Ordering',
    desc: 'Guests scan, browse, order and pay — no app, no friction. Auto-synced to KDS.',
    icon: QrCode,
    accent: 'from-warm-500 via-brand-500 to-rose-600',
    body: QrFrame,
  },
  {
    id: 'kds',
    title: 'Kitchen Display',
    desc: 'Station-aware tickets with live timers, color states, sound alerts and offline-first sync.',
    icon: ChefHat,
    accent: 'from-rose-500 via-brand-500 to-warm-500',
    body: KdsFrame,
  },
  {
    id: 'analytics',
    title: 'Realtime Analytics',
    desc: 'Revenue, peak hours, dish margin, staff performance — beautiful charts, instantly.',
    icon: BarChart3,
    accent: 'from-cool-500 via-brand-500 to-warm-500',
    body: AnalyticsFrame,
  },
];

/**
 * On large screens we use a sticky scroll-driven cinema. On small screens we
 * fall back to a tabbed stacked view so the section keeps a sane height.
 */
function useIsLargeScreen() {
  const [is, setIs] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIs(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return is;
}

export function ProductShowcase() {
  const isLg = useIsLargeScreen();
  return isLg ? <DesktopShowcase /> : <MobileShowcase />;
}

/* ---------------- Desktop: sticky scroll cinema ---------------- */
function DesktopShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  return (
    <section
      id="showcase"
      ref={ref}
      className="relative"
      // Each stage gets ~90vh of scroll, plenty to read but not gratuitous
      style={{ height: `${stages.length * 90 + 20}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="relative mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-10 max-w-3xl">
            <SectionLabel dot="warm" className="mb-4">
              Product · interactive tour
            </SectionLabel>
            <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
              One platform. <span className="gradient-text-warm">Every surface.</span>
            </h2>
            <p className="mt-4 max-w-xl text-ink-600">
              Watch the entire restaurant flow assemble itself — from counter to kitchen to customer — without ever leaving Vuedine.
            </p>
          </Reveal>

          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <ol className="space-y-3">
                {stages.map((s, i) => (
                  <StageItem key={s.id} stage={s} i={i} progress={scrollYProgress} total={stages.length} />
                ))}
              </ol>
            </div>

            <div className="relative lg:col-span-8">
              <div className="app-frame relative aspect-[4/3] overflow-hidden p-3 md:p-5">
                {stages.map((s, i) => (
                  <StageCanvas key={s.id} index={i} total={stages.length} progress={scrollYProgress}>
                    <s.body />
                  </StageCanvas>
                ))}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] bg-gradient-to-br from-brand-200/50 via-warm-100/40 to-amber-100/40 blur-3xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageItem({
  stage,
  i,
  progress,
  total,
}: {
  stage: Stage;
  i: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  total: number;
}) {
  const start = i / total;
  const end = (i + 1) / total;
  const opacity = useTransform(progress, [start - 0.05, start + 0.05, end - 0.05, end], [0.45, 1, 1, 0.45]);
  const x = useTransform(progress, [start, start + 0.05], [-12, 0]);
  const Icon = stage.icon;

  return (
    <motion.li style={{ opacity, x }}>
      <div className="card flex items-center gap-4 p-4 transition hover:border-brand-200 hover:shadow-md hover:shadow-brand-500/10">
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stage.accent} text-white shadow-lg shadow-brand-500/30`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-bold text-ink-900">
            {stage.title}
            <span className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
              {String(i + 1).padStart(2, '0')}
            </span>
          </div>
          <div className="mt-0.5 max-w-sm text-sm text-ink-600">{stage.desc}</div>
        </div>
      </div>
    </motion.li>
  );
}

function StageCanvas({
  index,
  total,
  progress,
  children,
}: {
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  children: React.ReactNode;
}) {
  const start = index / total;
  const end = (index + 1) / total;
  const fadeIn = (start + Math.max(0, start - 0.04)) / 2;
  const fadeOut = (end + Math.min(1, end + 0.04)) / 2;
  const opacity = useTransform(
    progress,
    [Math.max(0, start - 0.04), fadeIn, fadeOut, Math.min(1, end + 0.04)],
    index === total - 1 ? [0, 1, 1, 1] : [0, 1, 1, 0],
  );
  const scale = useTransform(progress, [start, start + 0.05, end - 0.05, end], [0.96, 1, 1, 0.96]);

  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-3 md:inset-5">
      <div className="h-full w-full overflow-hidden rounded-2xl">{children}</div>
    </motion.div>
  );
}

/* ---------------- Mobile / Tablet: tabbed stacked ---------------- */
function MobileShowcase() {
  const [active, setActive] = useState(0);
  const stage = stages[active];
  const Body = stage.body;
  const Icon = stage.icon;

  return (
    <section id="showcase" className="relative py-20 md:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="mb-8">
          <SectionLabel dot="warm" className="mb-4">
            Product · interactive tour
          </SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-5xl">
            One platform. <span className="gradient-text-warm">Every surface.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            Watch the entire restaurant flow — counter, kitchen, customer — inside one calm interface.
          </p>
        </Reveal>

        {/* Tabs */}
        <div className="no-scrollbar -mx-6 mb-5 flex gap-2 overflow-x-auto px-6 pb-1">
          {stages.map((s, i) => {
            const SIcon = s.icon;
            const on = i === active;
            return (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  on
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                    : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700'
                }`}
              >
                <SIcon className="h-4 w-4" />
                {s.title}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="card-elevated p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stage.accent} text-white shadow-lg shadow-brand-500/30`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold text-ink-900">{stage.title}</div>
                <div className="text-xs text-ink-600">{stage.desc}</div>
              </div>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-ink-100">
              <Body />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------- Stage frames ---------------- */
function PosFrame() {
  return (
    <div className="grid h-full grid-cols-5 gap-3 bg-gradient-to-br from-ink-50 to-white p-4 text-xs">
      <div className="col-span-3 space-y-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-ink-500">
          <span>Table 12 · Window seat</span>
          <span className="rounded-md bg-brand-500 px-2 py-0.5 font-semibold text-white">Dine-in</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['🍕 Margherita', '🍔 Truffle', '🥗 Caesar', '🍣 Salmon', '🍷 Pinot', '🍰 Tiramisu'].map((m) => (
            <div key={m} className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
              <div className="text-2xl">{m.split(' ')[0]}</div>
              <div className="mt-1 truncate text-[11px] font-medium text-ink-700">{m.split(' ').slice(1).join(' ')}</div>
              <div className="mt-1 text-[10px] font-semibold text-brand-600">₹{(Math.random() * 800 + 200).toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2 flex flex-col rounded-2xl border border-ink-100 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-ink-500">
          <span>Order · #1284</span>
          <span className="font-semibold text-emerald-600">Live</span>
        </div>
        <ul className="flex-1 space-y-1.5 text-[11px] text-ink-700">
          <li className="flex justify-between"><span>1× Margherita</span><span className="font-semibold">₹389</span></li>
          <li className="flex justify-between"><span>2× Truffle Burger</span><span className="font-semibold">₹1,180</span></li>
          <li className="flex justify-between"><span>1× Caesar Salad</span><span className="font-semibold">₹329</span></li>
          <li className="flex justify-between"><span>2× Sparkling Water</span><span className="font-semibold">₹240</span></li>
        </ul>
        <div className="mt-3 space-y-1 border-t border-ink-100 pt-2 text-[11px] text-ink-700">
          <div className="flex justify-between"><span>Subtotal</span><span>₹2,138</span></div>
          <div className="flex justify-between"><span>GST 5%</span><span>₹107</span></div>
          <div className="flex justify-between text-base font-extrabold text-ink-900">
            <span>Total</span><span>₹2,245</span>
          </div>
        </div>
        <button className="btn-primary shine mt-3 rounded-lg py-2 text-[12px] font-semibold">Settle bill</button>
      </div>
    </div>
  );
}

function QrFrame() {
  return (
    <div className="relative grid h-full grid-cols-2 gap-4 bg-gradient-to-br from-brand-50 to-white p-5">
      <div className="relative flex items-center justify-center">
        <div className="phone-shell flex flex-col overflow-hidden">
          <div className="bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-4 pt-6 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Bandra Bistro</div>
            <div className="mt-1 text-lg font-bold">Table 7 · Menu</div>
          </div>
          <div className="flex-1 overflow-hidden bg-white p-3 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              {['🍕 Margherita', '🍝 Carbonara', '🥗 Burrata', '🍔 Truffle', '🍣 Sushi Roll', '🍰 Tiramisu'].map((m) => (
                <div key={m} className="rounded-xl border border-ink-100 bg-ink-50/50 p-2">
                  <div className="text-xl">{m.split(' ')[0]}</div>
                  <div className="mt-1 text-[10px] font-medium text-ink-700">{m.split(' ').slice(1).join(' ')}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-ink-100 bg-brand-50 p-3">
            <button className="w-full rounded-lg bg-brand-500 py-2 text-[11px] font-bold text-white shadow-md shadow-brand-500/30">View cart · ₹1,840</button>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-3 text-xs text-ink-700">
        {[
          { l: 'Scan', d: 'Customer scans table QR · zero install' },
          { l: 'Browse', d: 'Live menu with veg/non-veg, customizations' },
          { l: 'Order', d: 'Send to KDS instantly · auto-printed KOT' },
          { l: 'Pay', d: 'UPI, card, cash · split or in-app pay' },
        ].map((s, i) => (
          <div key={s.l} className="card flex items-start gap-3 p-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700">
              {i + 1}
            </div>
            <div>
              <div className="font-bold text-ink-900">{s.l}</div>
              <div className="text-[11px] text-ink-500">{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KdsFrame() {
  const cards = [
    { id: 1284, table: 'T-7', state: 'NEW', items: ['Margherita', 'Iced Latte'], color: 'border-emerald-200 bg-emerald-50' },
    { id: 1285, table: 'T-12', state: 'PREP', items: ['Truffle Burger', 'Caesar', 'Coke'], color: 'border-amber-200 bg-amber-50' },
    { id: 1286, table: 'T-3', state: 'PREP', items: ['Carbonara', 'Tiramisu'], color: 'border-amber-200 bg-amber-50' },
    { id: 1287, table: 'TKW', state: 'READY', items: ['Sushi Set', 'Miso'], color: 'border-brand-200 bg-brand-50' },
    { id: 1288, table: 'T-9', state: 'NEW', items: ['Burrata', 'Sparkling'], color: 'border-emerald-200 bg-emerald-50' },
    { id: 1289, table: 'T-1', state: 'READY', items: ['Pinot 2x', 'Cheese Plate'], color: 'border-brand-200 bg-brand-50' },
  ];
  return (
    <div className="h-full bg-ink-50 p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-ink-500">
        <span>Hot Kitchen · 6 active tickets</span>
        <span className="flex items-center gap-2 font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      <div className="grid h-[calc(100%-2rem)] grid-cols-3 gap-3 text-[11px]">
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className={`flex flex-col rounded-xl border-2 p-3 ${c.color}`}
          >
            <div className="flex items-center justify-between text-ink-900">
              <span className="font-bold">#{c.id}</span>
              <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-ink-200">{c.table}</span>
            </div>
            <ul className="mt-2 flex-1 space-y-1 text-ink-700">
              {c.items.map((it) => (
                <li key={it} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-400" /> {it}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-ink-500">
              <span>{c.state}</span>
              <span>{Math.floor(Math.random() * 8) + 2}m</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsFrame() {
  const bars = [42, 56, 30, 72, 88, 64, 95, 78, 60, 84, 52, 70];
  return (
    <div className="h-full bg-gradient-to-br from-white to-brand-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-medium text-ink-500">Performance · this month</div>
          <div className="text-base font-extrabold text-ink-900">₹84.2L · +24% MoM</div>
        </div>
        <div className="flex gap-1 text-[10px]">
          {['7D', '30D', 'YTD'].map((t) => (
            <span
              key={t}
              className={`rounded-md px-2 py-1 font-semibold ${t === '30D' ? 'bg-brand-500 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200'}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-[10px]">
        {[
          { l: 'AOV', v: '₹712', d: '+8%' },
          { l: 'Repeat', v: '37%', d: '+3%' },
          { l: 'Margin', v: '64%', d: '+1.4%' },
        ].map((m) => (
          <div key={m.l} className="rounded-xl border border-ink-100 bg-white p-2 shadow-sm">
            <div className="font-medium text-ink-500">{m.l}</div>
            <div className="text-base font-extrabold text-ink-900">{m.v}</div>
            <div className="font-semibold text-emerald-600">{m.d}</div>
          </div>
        ))}
      </div>

      <div className="flex h-[55%] items-end gap-1.5 rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
        {bars.map((h, i) => (
          <div
            key={i}
            className="bar flex-1 rounded-t bg-gradient-to-t from-brand-500 via-rose-500 to-warm-500"
            style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
