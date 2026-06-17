import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';
import { Spotlight } from '../components/effects/Spotlight';
import { cn } from '../lib/cn';

type Plan = {
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  cta: string;
  highlight?: boolean;
  features: string[];
  accent: string;
};

const plans: Plan[] = [
  {
    name: 'Starter',
    blurb: 'For new outlets just getting set up',
    monthly: 999,
    yearly: 799,
    cta: 'Start free trial',
    accent: 'from-cool-50 to-white',
    features: [
      'Smart POS · unlimited bills',
      'QR ordering · up to 25 tables',
      'KDS for 1 station',
      'Daily reports · email digests',
      '5 staff accounts',
      'WhatsApp / SMS billing',
    ],
  },
  {
    name: 'Growth',
    blurb: 'Most popular · for growing 1-3 outlet brands',
    monthly: 2499,
    yearly: 1999,
    cta: 'Start free trial',
    highlight: true,
    accent: 'from-brand-100 to-warm-50',
    features: [
      'Everything in Starter',
      'Unlimited tables · multi-station KDS',
      'Inventory + recipe + wastage',
      'Loyalty + CRM + campaigns',
      'Up to 3 outlets',
      'Vuedine AI insights · daily',
      'Aggregator integrations',
    ],
  },
  {
    name: 'Enterprise',
    blurb: 'For chains, franchises and groups',
    monthly: 0,
    yearly: 0,
    cta: 'Talk to sales',
    accent: 'from-amber-50 to-warm-50',
    features: [
      'Everything in Growth',
      'Unlimited outlets · central kitchen',
      'Custom roles + audit logs',
      'SSO · SAML · IP allowlisting',
      'Dedicated success manager',
      'Vuedine AI · custom models',
      '99.99% SLA · priority support',
    ],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100/50 via-warm-50 to-amber-50 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto mb-12 max-w-3xl text-center">
          <SectionLabel className="mx-auto mb-4">Simple pricing</SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Pick a plan. <span className="gradient-text-warm">Outgrow it later.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            14-day free trial. No card. No setup fee. Switch plans anytime — keep all your data.
          </p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-2xl border border-ink-200 bg-white p-1 shadow-sm">
            {(['monthly', 'yearly'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setYearly(k === 'yearly')}
                className={cn(
                  'relative rounded-xl px-4 py-1.5 text-sm font-semibold transition',
                  (yearly ? 'yearly' : 'monthly') === k ? 'text-white' : 'text-ink-600',
                )}
              >
                {(yearly ? 'yearly' : 'monthly') === k && (
                  <motion.span
                    layoutId="pricing-toggle"
                    className="absolute inset-0 rounded-xl bg-brand-500 shadow-md shadow-brand-500/30"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  />
                )}
                <span className="relative">
                  {k === 'monthly' ? 'Monthly' : 'Yearly'}
                  {k === 'yearly' && (
                    <span className={cn(
                      'ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold',
                      yearly ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700',
                    )}>
                      −20%
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
              whileHover={{ y: -6 }}
              className={cn('relative', p.highlight && 'lg:-mt-4')}
            >
              <Spotlight
                color="rgba(236,27,124,0.12)"
                className={cn('relative h-full overflow-hidden rounded-3xl', p.highlight && 'gradient-border')}
              >
                <div
                  className={cn(
                    'card-elevated relative h-full p-7',
                    p.highlight && 'shadow-[0_30px_80px_-30px_rgba(236,27,124,0.45)]',
                  )}
                >
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full blur-3xl opacity-70',
                      `bg-gradient-to-br ${p.accent}`,
                    )}
                  />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-ink-900">{p.name}</div>
                      <div className="mt-1 text-xs text-ink-600">{p.blurb}</div>
                    </div>
                    {p.highlight && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-1 text-[11px] font-bold text-white shadow-md shadow-brand-500/30">
                        <Sparkles className="h-3 w-3" /> Most popular
                      </span>
                    )}
                  </div>

                  <div className="mt-6">
                    {p.monthly === 0 ? (
                      <div className="text-4xl font-extrabold text-ink-900">Custom</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="display text-5xl font-extrabold text-ink-900">
                          ₹{(yearly ? p.yearly : p.monthly).toLocaleString('en-IN')}
                        </span>
                        <span className="text-sm font-medium text-ink-500">/ outlet / mo</span>
                      </div>
                    )}
                    <div className="mt-1 text-xs font-medium text-ink-500">
                      {yearly ? 'Billed yearly · 20% off' : 'Billed monthly · cancel anytime'}
                    </div>
                  </div>

                  <a
                    href="#cta"
                    className={cn(
                      'mt-6 block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition',
                      p.highlight ? 'btn-primary shine' : 'btn-ghost',
                    )}
                  >
                    {p.cta}
                  </a>

                  <ul className="mt-6 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-ink-700">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-100">
                          <Check className="h-3 w-3 text-brand-700" strokeWidth={3} />
                        </span>
                        <span className="font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Spotlight>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
