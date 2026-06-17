import { motion } from 'framer-motion';
import { Bell, ChefHat, CreditCard, QrCode, Smartphone, UtensilsCrossed } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

const steps = [
  { icon: QrCode, color: 'from-brand-500 to-rose-500', title: 'Scan QR', desc: 'Customer scans the table code · zero install' },
  { icon: Smartphone, color: 'from-rose-500 to-warm-500', title: 'Browse Menu', desc: 'Photos, customizations, veg filter' },
  { icon: UtensilsCrossed, color: 'from-warm-500 to-amber-500', title: 'Place Order', desc: 'Cart auto-saved, multi-round ordering' },
  { icon: ChefHat, color: 'from-amber-500 to-warm-500', title: 'Kitchen Receives', desc: 'KOT prints · KDS card appears live' },
  { icon: Bell, color: 'from-warm-500 to-rose-500', title: 'Status Updates', desc: 'Preparing → Ready → Served, in real time' },
  { icon: CreditCard, color: 'from-rose-500 to-brand-500', title: 'Pay Instantly', desc: 'UPI, card or split — settle in-seat' },
];

export function QrFlow() {
  return (
    <section id="solutions" className="relative py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/40 via-warm-100/40 to-amber-100/30 blur-3xl" />
        <div className="absolute inset-0 dot-bg opacity-60" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 max-w-3xl text-center md:mx-auto">
          <SectionLabel dot="warm" className="mx-auto mb-4">
            QR Ordering · the modern dine-in
          </SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Scan to{' '}
            <span className="gradient-text-warm">happiness</span>{' '}
            <span className="display-serif text-ink-900">in six steps.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            No app downloads. No waiter waving. Vuedine QR turns every table into a self-serve digital host that keeps your kitchen and counter perfectly in sync.
          </p>
        </Reveal>

        <div className="relative">
          {/* Connector line */}
          <svg
            aria-hidden
            viewBox="0 0 1200 200"
            className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-32 -translate-y-1/2 md:block"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flowLine" x1="0" x2="1">
                <stop offset="0%" stopColor="#EC1B7C" />
                <stop offset="50%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#FACC15" />
              </linearGradient>
            </defs>
            <motion.path
              d="M40,100 C200,20 360,180 540,100 C720,20 880,180 1060,100 C1120,70 1160,90 1180,100"
              fill="none"
              stroke="url(#flowLine)"
              strokeWidth="2"
              strokeDasharray="4 6"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 2, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </svg>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: i * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                  whileHover={{ y: -6 }}
                  className="card-elevated relative p-5 text-center"
                >
                  <div
                    className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg shadow-brand-500/30`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-400">
                    Step {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink-900">{s.title}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-ink-600">{s.desc}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
