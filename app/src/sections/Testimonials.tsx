import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

const stories = [
  {
    name: 'Aarav Mehta',
    role: 'Owner · Bandra Bistro · 4 outlets',
    avatar: 'from-brand-500 via-rose-500 to-warm-500',
    quote:
      'Vuedine cut our average bill time from 9 minutes to 2. QR ordering alone added 18% to weekend revenue. It just feels alive.',
    metric: { label: 'Bill time', value: '−78%' },
    color: 'from-brand-100 to-warm-50',
  },
  {
    name: 'Priya Iyer',
    role: 'Founder · Indigo Pour-Over (Café chain)',
    avatar: 'from-rose-500 via-brand-500 to-warm-500',
    quote:
      'I run 7 cafés from one phone. The AI tells me which barista is faster, which dish is dying, what to push next weekend.',
    metric: { label: 'Outlets', value: '7 · 1 phone' },
    color: 'from-rose-100 to-brand-50',
  },
  {
    name: 'Rohit Sharma',
    role: 'Director · Mainland Group · 28 outlets',
    avatar: 'from-warm-500 via-amber-500 to-brand-500',
    quote:
      'We migrated from a legacy POS in 11 days. Onboarding was unreal. Reports we used to wait days for, are now live on a screen.',
    metric: { label: 'Migration', value: '11 days' },
    color: 'from-warm-50 to-amber-50',
  },
  {
    name: 'Neha Kapoor',
    role: 'Chef Owner · Salt House · Mumbai',
    avatar: 'from-amber-500 via-warm-500 to-brand-500',
    quote:
      'The KDS is the prettiest I have used. My chefs actually look up at it. Tickets stopped getting lost on Saturday nights.',
    metric: { label: 'Lost tickets', value: '0 / mo' },
    color: 'from-amber-50 to-warm-50',
  },
  {
    name: 'Vikram Reddy',
    role: 'Operator · Hyderabad Biryani Co.',
    avatar: 'from-cool-500 via-brand-500 to-warm-500',
    quote:
      'QR + UPI on the menu changed our cash leakage problem overnight. Reconciliation went from 3 hours to 3 minutes.',
    metric: { label: 'Reconcile', value: '3h → 3m' },
    color: 'from-cool-50 to-brand-50',
  },
  {
    name: 'Sana Khan',
    role: 'Owner · Olive Bistro · Bengaluru',
    avatar: 'from-pink-500 via-brand-500 to-rose-500',
    quote:
      'Our customers actually compliment the menu now. The brand feels modern. That alone is worth the subscription.',
    metric: { label: 'NPS', value: '+34 pts' },
    color: 'from-pink-100 to-brand-50',
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 max-w-3xl">
          <SectionLabel className="mb-4">Loved by operators</SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            Real restaurants. <span className="gradient-text-warm">Real numbers.</span>
          </h2>
          <p className="mt-4 text-ink-600">
            From single-outlet bistros to 28-outlet chains, Vuedine is what restaurant owners switch to and stop shopping for software.
          </p>
        </Reveal>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {stories.map((s, i) => (
            <motion.figure
              key={s.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.06, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="group relative break-inside-avoid"
            >
              <div className="card-elevated relative overflow-hidden p-6">
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -top-20 -right-12 h-44 w-44 rounded-full bg-gradient-to-br ${s.color} blur-3xl opacity-80`}
                />
                <Quote className="h-5 w-5 text-brand-500" />
                <blockquote className="mt-3 text-[15px] leading-relaxed text-ink-700">
                  "{s.quote}"
                </blockquote>
                <div className="mt-5 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${s.avatar} shadow-md shadow-brand-500/20`} />
                  <div>
                    <div className="text-sm font-bold text-ink-900">{s.name}</div>
                    <div className="text-xs text-ink-500">{s.role}</div>
                  </div>
                  <div className="ml-auto rounded-xl border border-ink-100 bg-ink-50/50 px-3 py-1.5 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{s.metric.label}</div>
                    <div className="text-sm font-extrabold text-brand-600">{s.metric.value}</div>
                  </div>
                </div>
              </div>
            </motion.figure>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-1 star-shimmer">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
            <span className="ml-2 text-sm font-bold text-ink-900">4.9 / 5</span>
          </div>
          <div className="text-sm font-medium text-ink-500">Across 2,400+ verified G2, Capterra and Google reviews</div>
        </div>
      </div>
    </section>
  );
}
