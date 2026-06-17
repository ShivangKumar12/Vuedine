import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Counter } from '../components/Counter';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

export function Analytics() {
  const bars = [42, 56, 30, 72, 88, 64, 95, 78, 60, 84, 52, 70, 48, 90];
  const heat = Array.from({ length: 7 * 12 }, (_, i) => {
    const v = (Math.sin(i * 0.7) + 1) / 2 + (i % 5 === 0 ? 0.4 : 0);
    return Math.min(1, v);
  });

  return (
    <section className="relative py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[820px] max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-100/40 via-warm-50 to-amber-50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 max-w-3xl">
          <SectionLabel dot="warm" className="mb-4">
            Realtime analytics
          </SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Decisions that used to take a week,{' '}
            <span className="gradient-text-warm">now take a glance.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            Live revenue, peak hours, dish margin, repeat rate, staff performance — every signal your restaurant emits, distilled into a dashboard you'll actually want to open.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-12">
          {/* Big revenue card */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
            className="md:col-span-8"
          >
            <div className="card-elevated relative overflow-hidden p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-ink-500">Net revenue</div>
                  <div className="mt-2 text-4xl font-extrabold text-ink-900 sm:text-5xl">
                    <Counter value={8420000} prefix="₹" />
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    <ArrowUpRight className="h-3 w-3" /> +24% MoM
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] md:max-w-xs">
                  {[
                    { l: 'AOV', v: '₹712', d: '+8%', c: 'text-emerald-600' },
                    { l: 'Repeat', v: '37%', d: '+3%', c: 'text-emerald-600' },
                    { l: 'Wait', v: '4m 12s', d: '-12%', c: 'text-cool-600' },
                  ].map((m) => (
                    <div key={m.l} className="rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
                      <div className="font-medium text-ink-500">{m.l}</div>
                      <div className="text-sm font-extrabold text-ink-900 sm:text-base">{m.v}</div>
                      <div className={`flex items-center gap-1 font-semibold ${m.c}`}>
                        {m.d.startsWith('-') ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {m.d}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex h-44 items-end gap-1.5 rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0.05 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 1.1, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                    style={{ height: `${h}%`, transformOrigin: 'bottom' }}
                    className="flex-1 rounded-t bg-gradient-to-t from-brand-500 via-rose-500 to-warm-500"
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Heatmap */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="md:col-span-4"
          >
            <div className="card-elevated relative h-full overflow-hidden p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-500">Peak hour heatmap</div>
              <div className="mt-1 text-2xl font-extrabold text-ink-900">Mon → Sun</div>
              <div className="text-xs font-medium text-ink-500">11am — 11pm</div>
              <div className="mt-5 grid grid-cols-12 gap-1">
                {heat.map((v, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: v, scale: 1 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: i * 0.005 }}
                    className="aspect-square rounded-sm"
                    style={{
                      background: `linear-gradient(135deg, rgba(236,27,124,${v * 0.95}), rgba(249,115,22,${v * 0.85}))`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-ink-500">
                <span>Cool</span>
                <div className="mx-2 h-1.5 flex-1 rounded-full bg-gradient-to-r from-brand-200 via-warm-400 to-rose-600" />
                <span>Hot</span>
              </div>
            </div>
          </motion.div>

          {/* Top dishes */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
            className="md:col-span-5"
          >
            <div className="card-elevated h-full p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-500">Top performing dishes</div>
              <ul className="mt-4 space-y-3">
                {[
                  { e: '🍕', n: 'Margherita', v: 420, p: 92, c: 'from-brand-500 to-warm-500' },
                  { e: '🍔', n: 'Truffle Burger', v: 318, p: 78, c: 'from-warm-500 to-amber-500' },
                  { e: '🥗', n: 'Caesar Salad', v: 261, p: 64, c: 'from-rose-500 to-brand-500' },
                  { e: '🍣', n: 'Sushi Set', v: 184, p: 48, c: 'from-amber-500 to-warm-500' },
                ].map((d, i) => (
                  <li key={d.n} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold text-ink-900">
                        <span>{d.e}</span>
                        {d.n}
                      </span>
                      <span className="font-medium text-ink-500">{d.v} · 30d</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${d.p}%` }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 1.2, delay: i * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                        className={`h-full rounded-full bg-gradient-to-r ${d.c}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Channels donut */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="md:col-span-7"
          >
            <div className="card-elevated flex h-full flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-widest text-ink-500">Channel mix</div>
                <div className="mt-1 text-2xl font-extrabold text-ink-900">QR is winning.</div>
                <ul className="mt-5 space-y-2 text-sm">
                  {[
                    { label: 'QR Ordering', v: 47, c: 'bg-brand-500' },
                    { label: 'Waiter / POS', v: 33, c: 'bg-warm-500' },
                    { label: 'Aggregators', v: 14, c: 'bg-rose-500' },
                    { label: 'Direct online', v: 6, c: 'bg-amber-500' },
                  ].map((r) => (
                    <li key={r.label} className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.c}`} />
                      <span className="font-medium text-ink-700">{r.label}</span>
                      <span className="ml-auto font-mono font-bold text-ink-900">{r.v}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mx-auto shrink-0 sm:mx-0">
                <svg viewBox="0 0 36 36" className="h-44 w-44 -rotate-90 sm:h-48 sm:w-48 lg:h-52 lg:w-52">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth={4} />
                  {[
                    { v: 47, off: 0, c: '#EC1B7C' },
                    { v: 33, off: 47, c: '#F97316' },
                    { v: 14, off: 80, c: '#F43F5E' },
                    { v: 6, off: 94, c: '#EAB308' },
                  ].map((s, i) => (
                    <motion.circle
                      key={i}
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={s.c}
                      strokeWidth={4}
                      strokeDasharray={`${s.v} 100`}
                      strokeDashoffset={-s.off}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 1, delay: i * 0.15 }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">Orders</div>
                  <div className="text-2xl font-extrabold text-ink-900 sm:text-3xl">
                    <Counter value={18420} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
