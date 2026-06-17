import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

const faqs = [
  {
    q: 'Do my customers need to download an app to order?',
    a: 'No. Vuedine QR is a Progressive Web App — guests scan the table code with any smartphone camera and the menu opens in the browser. No App Store. No friction.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most outlets are live in under 24 hours. Our team handles menu import, printer configuration, QR generation and staff training. Multi-outlet brands typically migrate in 7–14 days.',
  },
  {
    q: 'Will Vuedine work without internet?',
    a: 'Yes. Billing, KOTs and KDS keep working offline and sync automatically when the connection returns. Zero dropped orders, even on patchy WiFi.',
  },
  {
    q: 'Can I import my existing menu and customers?',
    a: 'Absolutely. Bring CSV exports from Petpooja, Posist, Square or any legacy POS — we map the fields, preserve loyalty points and order history, and you start fresh without losing anything.',
  },
  {
    q: 'Is my data secure?',
    a: 'Vuedine is SOC 2 Type II certified, encrypted at rest with AES-256 and in transit with TLS 1.3. Daily backups, role-based access, audit logs, and optional SSO/SAML on Enterprise.',
  },
  {
    q: 'What hardware do I need?',
    a: 'A web browser. Vuedine runs on the tablet, laptop or POS terminal you already own. We support all common ESC/POS thermal printers, cash drawers and KDS bump bars.',
  },
  {
    q: 'How is the AI pricing structured?',
    a: 'Vuedine AI insights are included in Growth and Enterprise. We do not charge per query, per token or per agent — predictable monthly pricing tied only to your outlet count.',
  },
  {
    q: 'What happens after the 14-day free trial?',
    a: 'You can switch to a paid plan or do nothing — your account simply pauses. No automatic charges, no credit card required during trial. Your data stays safe for 90 days.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal className="mb-12 text-center">
          <SectionLabel className="mx-auto mb-4">FAQ</SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            The <span className="gradient-text-warm">straight</span> answers.
          </h2>
          <p className="mt-4 text-ink-600">
            Still curious? Talk to a Vuedine specialist who has set up over a thousand outlets.
          </p>
        </Reveal>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                  isOpen ? 'border-brand-300 shadow-brand-500/10' : 'border-ink-200'
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`text-[15px] font-bold ${isOpen ? 'text-brand-700' : 'text-ink-900'}`}>{f.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      isOpen ? 'border-brand-500 bg-brand-500' : 'border-ink-200 bg-white'
                    }`}
                  >
                    <Plus className={`h-4 w-4 ${isOpen ? 'text-white' : 'text-ink-700'}`} strokeWidth={2.5} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-sm leading-relaxed text-ink-600">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
