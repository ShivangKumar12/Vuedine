import { motion } from 'framer-motion';
import { Building2, ShoppingBag, IndianRupee, Smile } from 'lucide-react';
import { Counter } from '../components/Counter';
import { Reveal, StaggerGroup, stagItem } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

const stats = [
  {
    icon: Building2,
    label: 'Restaurants served',
    value: 12480,
    suffix: '+',
    tint: 'from-brand-100 to-white',
    iconBg: 'bg-brand-100',
    color: 'text-brand-600',
  },
  {
    icon: ShoppingBag,
    label: 'Orders processed',
    value: 84,
    suffix: 'M+',
    tint: 'from-warm-50 to-white',
    iconBg: 'bg-warm-50',
    color: 'text-warm-600',
  },
  {
    icon: IndianRupee,
    label: 'Revenue managed',
    value: 4200,
    suffix: ' Cr',
    prefix: '₹',
    tint: 'from-amber-50 to-white',
    iconBg: 'bg-amber-100',
    color: 'text-amber-600',
  },
  {
    icon: Smile,
    label: 'Customer satisfaction',
    value: 4.9,
    decimals: 1,
    suffix: '/5',
    tint: 'from-cool-50 to-white',
    iconBg: 'bg-cool-50',
    color: 'text-cool-600',
  },
];

export function Stats() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 text-center">
          <SectionLabel className="mx-auto mb-5">Numbers, not promises</SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Powering modern <span className="gradient-text-warm">restaurants</span>
            <br className="hidden md:block" /> at every scale.
          </h2>
        </Reveal>

        <StaggerGroup className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                variants={stagItem}
                whileHover={{ y: -4 }}
                className="card-elevated relative overflow-hidden p-6 md:p-7"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br ${s.tint} blur-2xl opacity-90`}
                />
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${s.iconBg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div className="display text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
                  <Counter
                    value={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals ?? 0}
                  />
                </div>
                <div className="mt-2 text-sm font-medium text-ink-500">{s.label}</div>
              </motion.div>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
