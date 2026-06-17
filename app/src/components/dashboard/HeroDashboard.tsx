import { motion } from 'framer-motion';
import { ArrowUpRight, Bell, CheckCircle2, ChefHat, Sparkles } from 'lucide-react';
import { Counter } from '../Counter';

export function HeroDashboard() {
  return (
    <div className="relative">
      {/* Orbit rings — masked behind the dashboard, don't bleed off page */}
      <div aria-hidden className="absolute -inset-4 spin-slow pointer-events-none opacity-50 sm:-inset-6 lg:-inset-10">
        <div className="absolute inset-6 rounded-full border border-dashed border-brand-200" />
        <div className="absolute inset-16 rounded-full border border-dashed border-brand-100" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        className="app-frame relative p-4 sm:p-5 md:p-6"
      >
        {/* Window chrome */}
        <div className="mb-4 flex items-center justify-between md:mb-5">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <div className="ml-2 truncate font-mono text-[10px] text-ink-500 sm:ml-3 sm:text-xs">
              vuedine.app — Bandra
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            LIVE
          </span>
        </div>

        {/* Stat strip */}
        <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard label="Today" delta="+18.4%" deltaColor="text-emerald-600">
            <Counter value={184350} prefix="₹" format="number" className="text-lg font-bold text-ink-900 sm:text-xl" />
          </StatCard>
          <StatCard label="Orders" delta="QR · 47%" deltaColor="text-brand-600">
            <Counter value={324} className="text-lg font-bold text-ink-900 sm:text-xl" />
          </StatCard>
          <StatCard label="Tables" delta="High" deltaColor="text-warm-600">
            <span className="text-lg font-bold text-ink-900 sm:text-xl">
              22<span className="text-xs text-ink-400 sm:text-sm">/28</span>
            </span>
          </StatCard>
        </div>

        {/* Chart card */}
        <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50/50 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-ink-500">Revenue · last 7 days</div>
              <div className="text-sm font-bold text-ink-900 sm:text-base">₹12.4L collected</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-ink-600 ring-1 ring-ink-200">7D</span>
              <span className="rounded-md bg-brand-500 px-2 py-1 text-[10px] font-semibold text-white shadow-sm shadow-brand-500/30">
                30D
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-ink-600 ring-1 ring-ink-200">YTD</span>
            </div>
          </div>
          <SparkChart />
        </div>

        {/* Bottom rows */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-500">Top items</span>
              <span className="font-semibold text-emerald-600">Live</span>
            </div>
            <div className="space-y-1.5 text-[11px] sm:text-xs">
              {[
                { e: '🍕', name: 'Margherita', n: 82 },
                { e: '🥗', name: 'Caesar Salad', n: 61 },
                { e: '🍔', name: 'Truffle Burger', n: 48 },
              ].map((it) => (
                <div key={it.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate text-ink-700">
                    <span>{it.e}</span>
                    <span className="truncate">{it.name}</span>
                  </span>
                  <span className="shrink-0 font-bold text-ink-900">{it.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-500">Order sources</span>
            </div>
            <div className="flex items-center gap-3">
              <Donut />
              <div className="space-y-1 text-[10px] sm:text-[11px]">
                <Legend color="bg-brand-500" label="QR · 47%" />
                <Legend color="bg-warm-500" label="Waiter · 33%" />
                <Legend color="bg-cool-500" label="Aggreg. · 20%" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating cards (desktop only — they were spilling off mobile) */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.7, duration: 0.7 }}
        className="absolute -top-6 -left-8 z-20 hidden xl:block floaty-2"
      >
        <FloatingCard
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          tint="bg-emerald-100"
          title="Order #1284 · ready"
          subtitle="Table 7 · 4 items · 6m 12s"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20, y: -8 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.9, duration: 0.7 }}
        className="absolute -top-2 -right-4 z-20 hidden xl:block floaty"
      >
        <FloatingCard
          icon={<Sparkles className="h-3.5 w-3.5 text-brand-600" />}
          tint="bg-brand-100"
          title="AI · peak in 18 min"
          subtitle="Suggest +1 captain at counter"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.7 }}
        className="absolute -bottom-6 -left-2 z-20 hidden xl:block floaty"
      >
        <FloatingCard
          icon={<ChefHat className="h-3.5 w-3.5 text-cool-600" />}
          tint="bg-cool-50"
          title="KDS · 4 stations live"
          subtitle="Hot · Cold · Bar · Dessert"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16, x: 8 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ delay: 1.3, duration: 0.7 }}
        className="absolute -bottom-3 -right-8 z-20 hidden xl:block floaty-2"
      >
        <FloatingCard
          icon={<Bell className="h-3.5 w-3.5 text-warm-600" />}
          tint="bg-warm-50"
          title="3 new QR orders"
          subtitle="Auto-accepted · KOT printed"
        />
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  children,
  delta,
  deltaColor,
}: {
  label: string;
  children: React.ReactNode;
  delta: string;
  deltaColor: string;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-2.5 shadow-sm sm:p-3">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-500 sm:text-[10px]">{label}</div>
      <div className="mt-1">{children}</div>
      <div className={`mt-1 flex items-center gap-1 text-[10px] font-semibold sm:text-[11px] ${deltaColor}`}>
        <ArrowUpRight className="h-3 w-3 shrink-0" />
        <span className="truncate">{delta}</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="font-medium text-ink-700">{label}</span>
    </div>
  );
}

function FloatingCard({
  icon,
  title,
  subtitle,
  tint,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tint: string;
}) {
  return (
    <div className="card-elevated w-56 rounded-2xl p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}>{icon}</div>
        <div className="text-xs font-semibold text-ink-900">{title}</div>
      </div>
      <div className="text-[11px] text-ink-500">{subtitle}</div>
    </div>
  );
}

function SparkChart() {
  return (
    <svg viewBox="0 0 320 110" className="h-20 w-full sm:h-24">
      <defs>
        <linearGradient id="chart1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EC1B7C" stopOpacity=".30" />
          <stop offset="100%" stopColor="#EC1B7C" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="line1" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#EC1B7C" />
          <stop offset="100%" stopColor="#A60C5C" />
        </linearGradient>
      </defs>
      <path
        d="M0,80 C40,60 60,90 100,70 C140,50 160,30 200,40 C240,50 260,20 300,15 L320,15 L320,110 L0,110 Z"
        fill="url(#chart1)"
      />
      <path
        className="draw"
        d="M0,80 C40,60 60,90 100,70 C140,50 160,30 200,40 C240,50 260,20 300,15 L320,15"
        fill="none"
        stroke="url(#line1)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx="100" cy="70" r="3" fill="#F97316" />
      <circle cx="200" cy="40" r="3" fill="#EC1B7C" />
      <circle cx="300" cy="15" r="4" fill="#A60C5C" />
      <circle cx="300" cy="15" r="9" fill="#EC1B7C" opacity={0.18} />
    </svg>
  );
}

function Donut() {
  return (
    <svg width="48" height="48" viewBox="0 0 36 36" className="-rotate-90 sm:h-14 sm:w-14">
      <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth={4} />
      <motion.circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        stroke="#EC1B7C"
        strokeWidth={4}
        strokeDasharray="40 100"
        initial={{ strokeDashoffset: 100 }}
        whileInView={{ strokeDashoffset: 0 }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <circle cx="18" cy="18" r="14" fill="none" stroke="#F97316" strokeWidth={4} strokeDasharray="28 100" strokeDashoffset={-40} />
      <circle cx="18" cy="18" r="14" fill="none" stroke="#14B8A6" strokeWidth={4} strokeDasharray="20 100" strokeDashoffset={-68} />
    </svg>
  );
}
