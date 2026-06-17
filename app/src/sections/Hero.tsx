import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { Aurora } from '../components/effects/Aurora';
import { HeroDashboard } from '../components/dashboard/HeroDashboard';
import { Reveal } from '../components/Reveal';
import { Counter } from '../components/Counter';

// Floating food chips — only displayed on lg+ to avoid overlapping the copy on mobile
const floatingFood: { x: string; y: string; emoji: string; delay: number }[] = [
  { x: '4%', y: '22%', emoji: '🥐', delay: 0 },
  { x: '92%', y: '28%', emoji: '🍕', delay: 0.4 },
  { x: '6%', y: '78%', emoji: '☕', delay: 0.2 },
  { x: '93%', y: '82%', emoji: '🍣', delay: 0.6 },
];

export function Hero() {
  return (
    <header className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <Aurora />

      {/* Floating food (desktop only — they overlap copy on mobile) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {floatingFood.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 + f.delay }}
            style={{ left: f.x, top: f.y }}
            className="absolute"
          >
            <div className="card floaty rounded-2xl p-3 text-2xl shadow-lg shadow-brand-500/10" style={{ animationDelay: `${-i * 0.7}s` }}>
              {f.emoji}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-6">
            <a href="#ai" className="label-pill mb-6 transition hover:bg-brand-50">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              New · Vuedine AI is live for every restaurant
            </a>

            <h1 className="display text-[2.6rem] font-extrabold leading-[1.02] text-ink-900 sm:text-5xl md:text-6xl lg:text-[4.6rem] lg:leading-[0.98]">
              Run your entire
              <br />
              <span className="gradient-text-warm">restaurant</span>{' '}
              <span className="display-serif text-ink-900">from one</span>
              <br />
              beautiful platform.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-600 md:mt-7 md:text-lg lg:text-xl">
              POS, QR ordering, kitchen display, reservations, payments, CRM and analytics — unified into a
              single, AI-powered Restaurant OS that feels effortless from counter to kitchen.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#cta"
                className="btn-primary shine inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold"
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#showcase"
                className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Play className="h-3 w-3 fill-white text-white" />
                </span>
                Watch 90-sec demo
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:max-w-lg">
              <Trust label="Outlets" value={12000} suffix="+" />
              <Trust label="Processed" value={4200} prefix="₹" suffix=" Cr" />
              <Trust label="Uptime" value={99.99} decimals={2} suffix="%" />
              <div>
                <div className="star-shimmer text-2xl font-extrabold">4.9 ★</div>
                <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">G2 Rating</div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="relative mx-auto w-full max-w-[560px] lg:col-span-6 lg:max-w-none">
            <HeroDashboard />
          </Reveal>
        </div>
      </div>
    </header>
  );
}

function Trust({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-ink-900">
        <Counter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
    </div>
  );
}
