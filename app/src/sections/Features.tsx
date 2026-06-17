import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Cpu,
  LineChart,
  QrCode,
  ScanLine,
  Sparkles,
  Store,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Spotlight } from '../components/effects/Spotlight';
import { SectionLabel } from '../components/SectionLabel';
import { Reveal } from '../components/Reveal';

type Feature = {
  title: string;
  desc: string;
  icon: typeof Cpu;
  accent: string;
  iconBg: string;
  iconColor: string;
  glow: string;
  span?: string;
  illustration: () => ReactNode;
};

const features: Feature[] = [
  {
    title: 'Smart POS',
    desc: 'Two-tap billing, KOTs, GST, splits and refunds. Built for the rush, indistinguishable from instant.',
    icon: Zap,
    accent: 'from-brand-100 to-white',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    glow: 'rgba(236,27,124,0.12)',
    span: 'md:col-span-2',
    illustration: () => (
      <div className="flex items-center gap-3 text-xs">
        <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
          <div className="text-[10px] font-medium text-ink-500">Bill #1284</div>
          <div className="mt-1 font-medium text-ink-700">2× Truffle Burger · 1× Caesar</div>
          <div className="mt-2 text-base font-extrabold text-ink-900">₹2,245</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {['UPI', 'Card', 'Cash', 'Split'].map((p) => (
            <div key={p} className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] font-semibold text-ink-700">
              {p}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'QR Ordering',
    desc: 'No app, no friction. Scan, browse, customize, pay — synced live to KDS.',
    icon: QrCode,
    accent: 'from-warm-50 to-white',
    iconBg: 'bg-warm-50',
    iconColor: 'text-warm-600',
    glow: 'rgba(249,115,22,0.12)',
    illustration: () => (
      <div className="flex items-center justify-center">
        <div className="grid grid-cols-9 grid-rows-9 gap-px overflow-hidden rounded-lg border border-ink-200 bg-white p-2">
          {Array.from({ length: 81 }).map((_, i) => {
            const on = (i * 13) % 7 < 3 || i % 8 === 0;
            return <div key={i} className={`h-1.5 w-1.5 ${on ? 'bg-ink-900' : 'bg-transparent'}`} />;
          })}
        </div>
      </div>
    ),
  },
  {
    title: 'Kitchen Display',
    desc: 'Station-aware tickets · live timers · audio cues · offline-first sync.',
    icon: ScanLine,
    accent: 'from-rose-50 to-white',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    glow: 'rgba(244,63,94,0.12)',
    illustration: () => (
      <div className="grid grid-cols-3 gap-1.5 text-[9px]">
        {[
          { c: 'border-emerald-200 bg-emerald-50 text-emerald-700', t: 'NEW' },
          { c: 'border-amber-200 bg-amber-50 text-amber-700', t: 'PREP' },
          { c: 'border-brand-200 bg-brand-50 text-brand-700', t: 'READY' },
        ].map((s) => (
          <div key={s.t} className={`rounded-lg border p-2 ${s.c}`}>
            <div className="font-mono font-bold">{s.t}</div>
            <div className="mt-1 text-[9px] text-ink-600">3 items</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Reservations',
    desc: 'Floor plan, waitlist, prepayments, SMS reminders — turn tables 2× faster.',
    icon: Store,
    accent: 'from-cool-50 to-white',
    iconBg: 'bg-cool-50',
    iconColor: 'text-cool-600',
    glow: 'rgba(20,184,166,0.12)',
    illustration: () => (
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`h-7 rounded-md border-2 ${
              i % 4 === 0
                ? 'border-brand-300 bg-brand-100'
                : i % 3 === 0
                ? 'border-amber-300 bg-amber-100'
                : 'border-ink-200 bg-white'
            }`}
          />
        ))}
      </div>
    ),
  },
  {
    title: 'CRM & Loyalty',
    desc: 'Auto-capture customers, track LTV, run birthday and reactivation campaigns.',
    icon: Users,
    accent: 'from-pink-50 to-white',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    glow: 'rgba(236,72,153,0.12)',
    illustration: () => (
      <div className="space-y-1.5 text-[10px]">
        {['Aarav · ₹38k LTV', 'Priya · ₹26k LTV', 'Rahul · ₹19k LTV'].map((c, i) => (
          <div key={c} className="flex items-center justify-between rounded-md border border-ink-100 bg-white px-2 py-1.5 shadow-sm">
            <span className="flex items-center gap-2 font-medium text-ink-700">
              <span
                className={`h-5 w-5 rounded-full bg-gradient-to-br text-center text-[10px] font-bold leading-5 text-white ${
                  ['from-brand-500 to-warm-500', 'from-rose-500 to-brand-500', 'from-warm-500 to-amber-500'][i]
                }`}
              >
                {c[0]}
              </span>
              {c}
            </span>
            <span className="rounded bg-brand-100 px-1.5 text-[9px] font-bold text-brand-700">VIP</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Vuedine AI',
    desc: 'Sales forecasting, peak prediction, dish performance, smart reorder.',
    icon: Sparkles,
    accent: 'from-brand-100 to-warm-50',
    iconBg: 'bg-gradient-to-br from-brand-100 to-warm-100',
    iconColor: 'text-brand-700',
    glow: 'rgba(236,27,124,0.18)',
    illustration: () => (
      <div className="flex items-center justify-center gap-1">
        {[40, 65, 88, 70, 95, 60, 78, 92].map((h, i) => (
          <div
            key={i}
            className="bar w-1.5 rounded-sm bg-gradient-to-t from-brand-500 to-warm-500"
            style={{ height: h * 0.5, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    ),
  },
  {
    title: 'Reports & Analytics',
    desc: 'Live revenue, peak hours, dish margin, staff performance — beautiful charts.',
    icon: LineChart,
    accent: 'from-amber-50 to-white',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    glow: 'rgba(250,204,21,0.18)',
    span: 'md:col-span-2',
    illustration: () => (
      <svg viewBox="0 0 240 80" className="h-20 w-full">
        <defs>
          <linearGradient id="aLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#EC1B7C" />
            <stop offset="100%" stopColor="#A60C5C" />
          </linearGradient>
          <linearGradient id="aFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#EC1B7C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EC1B7C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,60 C30,50 50,30 80,40 C110,50 130,15 160,25 C190,35 210,10 240,5 L240,80 L0,80 Z" fill="url(#aFill)" />
        <path
          className="draw"
          d="M0,60 C30,50 50,30 80,40 C110,50 130,15 160,25 C190,35 210,10 240,5"
          fill="none"
          stroke="url(#aLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: 'Multi-Branch',
    desc: 'Centralized menu, prices, staff and reports across every outlet you own.',
    icon: Store,
    accent: 'from-brand-50 to-white',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
    glow: 'rgba(236,27,124,0.12)',
    illustration: () => (
      <div className="space-y-1 text-[10px]">
        {['Bandra · 184k', 'BKC · 142k', 'Andheri · 96k'].map((b) => (
          <div key={b} className="flex items-center justify-between rounded-md border border-ink-100 bg-white px-2 py-1.5 shadow-sm">
            <span className="font-medium text-ink-700">{b}</span>
            <span className="font-semibold text-emerald-600">live</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Payments',
    desc: 'UPI, cards, wallets, BNPL, dynamic QR — settle instantly, reconcile automatically.',
    icon: Wallet,
    accent: 'from-amber-50 to-white',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    glow: 'rgba(250,204,21,0.16)',
    illustration: () => (
      <div className="flex items-center gap-2">
        {['Visa', 'UPI', '₹', 'Card', 'Net'].map((c) => (
          <div key={c} className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] font-bold text-ink-700">
            {c}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Integrations',
    desc: 'Zomato, Swiggy, WhatsApp, Razorpay, Tally, Google — synced out of the box.',
    icon: Cpu,
    accent: 'from-cool-50 to-white',
    iconBg: 'bg-cool-50',
    iconColor: 'text-cool-600',
    glow: 'rgba(20,184,166,0.12)',
    illustration: () => (
      <div className="grid grid-cols-4 gap-1">
        {['Z', 'S', 'WA', '₹', 'TL', 'G', 'PG', 'Whk'].map((c) => (
          <div key={c} className="rounded-md border border-ink-200 bg-white py-1.5 text-center text-[10px] font-bold text-ink-700">
            {c}
          </div>
        ))}
      </div>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10">
        <div className="mx-auto h-[280px] max-w-5xl bg-gradient-to-b from-brand-100/40 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 max-w-3xl">
          <SectionLabel className="mb-4">Everything you need · nothing you don't</SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Ten products. <span className="gradient-text-warm">One restaurant OS.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            We rebuilt every screen restaurant operators touch — POS, kitchen, customer, owner — into one calm, fast, beautiful platform.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, delay }: { feature: Feature; delay: number }) {
  const Icon = feature.icon;
  const Illustration = feature.illustration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={feature.span ?? ''}
    >
      <Spotlight color={feature.glow} className="group relative h-full overflow-hidden rounded-3xl">
        <div className="card-elevated relative h-full p-6 transition-colors duration-300 hover:border-brand-200">
          <div
            aria-hidden
            className={`pointer-events-none absolute -top-32 -right-20 h-60 w-60 rounded-full bg-gradient-to-br ${feature.accent} blur-3xl opacity-80`}
          />
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.iconBg}`}>
              <Icon className={`h-5 w-5 ${feature.iconColor}`} />
            </div>
            <div className="text-base font-bold text-ink-900">{feature.title}</div>
          </div>
          <p className="mt-3 text-sm text-ink-600">{feature.desc}</p>
          <div className="relative mt-5 rounded-2xl border border-ink-100 bg-ink-50/40 p-4">
            <Illustration />
          </div>
        </div>
      </Spotlight>
    </motion.div>
  );
}
