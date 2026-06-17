import { motion } from 'framer-motion';
import { Brain, ChartArea, Clock, Gauge, Sparkles, TrendingUp } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

const insights = [
  { icon: TrendingUp, color: 'text-brand-600', bg: 'bg-brand-100', label: 'Sales Forecast', val: '₹2.18L', sub: 'Tonight · 92% confidence' },
  { icon: Clock, color: 'text-warm-600', bg: 'bg-warm-50', label: 'Peak hour', val: '8:30 PM', sub: 'Add 1 captain at counter' },
  { icon: ChartArea, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Margin alert', val: 'Margherita ↓', sub: 'Cheese cost up 14%' },
  { icon: Gauge, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Inventory', val: 'Reorder 4 SKUs', sub: 'Suggested on Monday' },
];

export function AISection() {
  return (
    <section
      id="ai"
      className="relative overflow-hidden border-y border-ink-100 py-24 md:py-32"
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(236,27,124,0.10), transparent 55%), radial-gradient(ellipse at bottom right, rgba(249,115,22,0.10), transparent 55%), #fdf6fa',
      }}
    >
      {/* soft network */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <NeuralWeb />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto mb-14 max-w-3xl text-center">
          <SectionLabel dot="brand" className="mx-auto mb-4">
            Vuedine AI · co-pilot for owners
          </SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            An <span className="gradient-text-warm">intelligence layer</span>
            <br className="hidden md:block" /> on top of your restaurant.
          </h2>
          <p className="mt-4 text-ink-600">
            Vuedine AI quietly studies every order, every shift, every dish. Then it tells you exactly what to fix, what to push, and when to staff up — in plain English.
          </p>
        </Reveal>

        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Assistant chat */}
          <Reveal className="lg:col-span-7">
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] bg-[conic-gradient(from_0deg,#EC1B7C_0%,#F97316_40%,#FACC15_70%,#EC1B7C_100%)] opacity-25 blur-2xl"
              />
              <div className="card-elevated relative overflow-hidden p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 shadow-lg shadow-brand-500/30">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-900">Vuedine AI</div>
                    <div className="text-[11px] font-medium text-ink-500">Live · streaming insights</div>
                  </div>
                  <span className="ml-auto rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                    GPT-OS · 4.0
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <Bubble side="user">What should I do tonight?</Bubble>
                  <Bubble side="ai">
                    <div className="space-y-2.5">
                      <p className="text-ink-700">
                        Tonight will likely peak at <strong className="text-ink-900">8:30 PM</strong> with{' '}
                        <strong className="text-ink-900">~218 orders</strong>. Three fast moves:
                      </p>
                      <ul className="space-y-1.5 text-ink-700">
                        <li className="flex gap-2">
                          <span className="font-bold text-emerald-600">→</span>Add 1 captain at counter from 8 PM (saves ~9 min/order).
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-warm-600">→</span>Push <em>Truffle Burger</em> on QR — 84% pickup last 7 days.
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-brand-600">→</span>Pre-prep 12 Margheritas at 7:45 — your repeat from last Sat.
                        </li>
                      </ul>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {insights.slice(0, 3).map((i) => {
                          const Icon = i.icon;
                          return (
                            <div key={i.label} className="rounded-xl border border-ink-100 bg-white p-2.5 shadow-sm">
                              <div className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-md ${i.bg}`}>
                                <Icon className={`h-3.5 w-3.5 ${i.color}`} />
                              </div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{i.label}</div>
                              <div className="text-[13px] font-extrabold text-ink-900">{i.val}</div>
                              <div className="mt-0.5 text-[10px] text-ink-500">{i.sub}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Bubble>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-2xl border border-ink-200 bg-white p-2 pl-4">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <input
                    type="text"
                    readOnly
                    placeholder="Ask Vuedine — “What's my slowest dish?”"
                    className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
                  />
                  <button className="btn-primary shine rounded-xl px-3 py-1.5 text-xs font-semibold">Ask</button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Insight grid */}
          <div className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3">
              {insights.map((i, idx) => {
                const Icon = i.icon;
                return (
                  <motion.div
                    key={i.label}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ delay: idx * 0.08, duration: 0.6 }}
                    className="card-elevated relative overflow-hidden p-5"
                  >
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full ${i.bg} blur-2xl opacity-60`}
                    />
                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${i.bg}`}>
                      <Icon className={`h-5 w-5 ${i.color}`} />
                    </div>
                    <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{i.label}</div>
                    <div className="mt-1 text-2xl font-extrabold text-ink-900">{i.val}</div>
                    <div className="mt-1 text-xs text-ink-600">{i.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({ side, children }: { side: 'user' | 'ai'; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
      className={`flex ${side === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={
          side === 'user'
            ? 'max-w-[80%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-brand-500/30'
            : 'max-w-[92%] rounded-2xl rounded-bl-sm border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-ink-700'
        }
      >
        {children}
      </div>
    </motion.div>
  );
}

function NeuralWeb() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="nLine" x1="0" x2="1">
          <stop offset="0%" stopColor="#EC1B7C" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
      </defs>
      {Array.from({ length: 22 }).map((_, i) => {
        const x1 = (i * 53) % 1200;
        const y1 = (i * 71) % 600;
        const x2 = (x1 + 200 + (i % 5) * 60) % 1200;
        const y2 = (y1 + 120 + (i % 7) * 40) % 600;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#nLine)" strokeWidth="0.6" />;
      })}
      {Array.from({ length: 30 }).map((_, i) => {
        const cx = (i * 79) % 1200;
        const cy = (i * 47) % 600;
        return <circle key={i} cx={cx} cy={cy} r={1.6} fill="#EC1B7C" opacity={0.6} />;
      })}
    </svg>
  );
}
