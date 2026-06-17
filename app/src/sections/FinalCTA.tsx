import { motion } from 'framer-motion';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { Particles } from '../components/effects/Particles';
import { Reveal } from '../components/Reveal';

export function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden py-28 md:py-40">
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Hot pink hero background like FoodKing */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at top, #FF5C9C 0%, #EC1B7C 40%, #A60C5C 100%)',
          }}
        />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_50%_60%,rgba(255,255,255,0.20),transparent_60%)]" />
        <Particles density={50} color="rgba(255,255,255,0.7)" />

        {/* Floating decorative shapes */}
        <div aria-hidden className="absolute left-[8%] top-[18%] h-12 w-12 rotate-12 rounded-2xl bg-white/15 backdrop-blur-sm floaty" />
        <div aria-hidden className="absolute right-[10%] top-[26%] h-16 w-16 rounded-full bg-white/15 backdrop-blur-sm floaty-2" />
        <div aria-hidden className="absolute left-[14%] bottom-[18%] h-10 w-10 rotate-45 rounded-xl bg-white/20 backdrop-blur-sm floaty" />
        <div aria-hidden className="absolute right-[12%] bottom-[12%] h-14 w-14 rounded-full bg-white/15 backdrop-blur-sm floaty-2" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <Reveal>
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md ring-1 ring-white/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            14-day free trial · No card required
          </div>

          <h2 className="display text-[2.6rem] font-extrabold leading-[1.02] text-white sm:text-5xl md:text-6xl lg:text-[5rem] lg:leading-[0.98]">
            The future of <br />
            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">restaurant management</span>{' '}
            <span className="display-serif text-white">starts</span> tonight.
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-lg text-white/85">
            Switch your POS, QR ordering, KDS, reservations and analytics to one platform — and watch your service speed, repeat rate and margin lift in the first month.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-bold text-brand-700 shadow-lg shadow-black/10 transition hover:scale-[1.02] hover:bg-white"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-6 py-4 text-base font-semibold text-white ring-1 ring-white/40 backdrop-blur-md transition hover:bg-white/25"
            >
              <CalendarCheck className="h-4 w-4" />
              Book a live demo
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 text-left text-sm sm:grid-cols-4">
            {[
              { v: '< 24h', l: 'Average go-live' },
              { v: '0', l: 'Setup fee' },
              { v: '99.99%', l: 'Uptime SLA' },
              { v: '24×7', l: 'WhatsApp support' },
            ].map((t, i) => (
              <motion.div
                key={t.l}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                className="rounded-2xl bg-white/15 p-4 text-center ring-1 ring-white/25 backdrop-blur-md"
              >
                <div className="text-2xl font-extrabold text-white">{t.v}</div>
                <div className="mt-1 text-xs font-medium text-white/80">{t.l}</div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
