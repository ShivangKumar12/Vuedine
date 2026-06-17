import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { cn } from '../lib/cn';

const links = [
  { href: '#features', label: 'Features' },
  { href: '#solutions', label: 'Solutions' },
  { href: '#ai', label: 'AI' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#testimonials', label: 'Stories' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar() {
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('');
  const lastY = useRef(0);

  // Scroll-driven chrome state + hide-on-scroll-down
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 16);
    if (open) return;
    const delta = y - lastY.current;
    if (y > 200 && delta > 8) setHidden(true);
    else if (delta < -4 || y < 100) setHidden(false);
    lastY.current = y;
  });

  // Section-aware active state
  useEffect(() => {
    const ids = links.map((l) => l.href.slice(1));
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: hidden ? -100 : 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pt-4">
          <motion.nav
            animate={{
              boxShadow: scrolled
                ? '0 4px 14px -6px rgba(15,23,42,0.10), 0 24px 48px -28px rgba(236,27,124,0.30)'
                : '0 1px 2px rgba(15,23,42,0.05), 0 8px 22px -14px rgba(236,27,124,0.20)',
              backgroundColor: scrolled ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.78)',
              borderColor: scrolled ? 'rgba(15,23,42,0.10)' : 'rgba(15,23,42,0.06)',
            }}
            transition={{ duration: 0.35 }}
            style={{ WebkitBackdropFilter: 'blur(22px) saturate(170%)', backdropFilter: 'blur(22px) saturate(170%)' }}
            className="relative flex h-[60px] items-center justify-between rounded-2xl border px-3 pr-2 sm:px-4 sm:pr-3"
          >
            {/* Logo */}
            <a
              href="#"
              className="group flex items-center gap-2.5 rounded-xl py-1.5 pl-1 pr-2 outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <Logo size={34} />
              <span className="hidden rounded-md border border-ink-200 bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-500 md:inline">
                v2.6
              </span>
            </a>

            {/* Desktop nav with sliding pill */}
            <DesktopLinks active={active} />

            {/* Right cluster */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/login"
                className="hidden rounded-xl px-3.5 py-2 text-[13px] font-semibold text-ink-700 transition hover:bg-ink-100/70 hover:text-ink-900 md:inline-flex"
              >
                Sign in
              </Link>
              <a
                href="#cta"
                className="hidden rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 sm:inline-flex"
              >
                Book demo
              </a>
              <a
                href="#cta"
                className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold"
              >
                Start free
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                className="ml-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 transition hover:border-brand-300 hover:text-brand-700 lg:hidden"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>

            {/* Bottom progress bar */}
            <motion.span
              aria-hidden
              style={{ width: progress }}
              className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-b-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 opacity-80"
            />
          </motion.nav>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <MobileDrawer open={open} onClose={() => setOpen(false)} active={active} />
    </>
  );
}

/* ------------ Desktop links with sliding pill ------------ */
function DesktopLinks({ active }: { active: string }) {
  const wrapRef = useRef<HTMLUListElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const target = hover ?? active;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (!target) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const li = wrap.querySelector<HTMLElement>(`[data-href="${target}"]`);
    if (!li) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    setPill({ left: liRect.left - wrapRect.left, width: liRect.width, opacity: 1 });
  }, [target]);

  return (
    <ul
      ref={wrapRef}
      onMouseLeave={() => setHover(null)}
      className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0 rounded-xl bg-ink-50/60 p-1 lg:flex"
    >
      <motion.span
        aria-hidden
        animate={{ left: pill.left, width: pill.width, opacity: pill.opacity }}
        transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 0.6 }}
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm ring-1 ring-ink-200"
      />
      {links.map((l) => {
        const isActive = active === l.href;
        return (
          <li key={l.href} data-href={l.href} className="relative">
            <a
              href={l.href}
              onMouseEnter={() => setHover(l.href)}
              className={cn(
                'relative inline-flex items-center rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                isActive ? 'text-brand-700' : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {l.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------ Mobile drawer ------------ */
function MobileDrawer({
  open,
  onClose,
  active,
}: {
  open: boolean;
  onClose: () => void;
  active: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            key="sheet"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-x-3 top-[80px] z-50 lg:hidden"
          >
            <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl shadow-black/10">
              <ul className="divide-y divide-ink-100">
                {links.map((l, i) => {
                  const isActive = active === l.href;
                  return (
                    <motion.li
                      key={l.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <a
                        href={l.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center justify-between px-5 py-4 text-[15px] font-semibold transition-colors',
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-800 hover:bg-ink-50',
                        )}
                      >
                        <span>{l.label}</span>
                        <ArrowRight
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isActive ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-700',
                          )}
                        />
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="grid grid-cols-2 gap-2 border-t border-ink-100 bg-ink-50/40 p-3">
                <a
                  href="#cta"
                  onClick={onClose}
                  className="rounded-xl border border-ink-200 bg-white py-2.5 text-center text-sm font-semibold text-ink-700 shadow-sm hover:border-brand-300 hover:text-brand-700"
                >
                  Book demo
                </a>
                <a
                  href="#cta"
                  onClick={onClose}
                  className="btn-primary shine rounded-xl py-2.5 text-center text-sm font-semibold"
                >
                  Start free
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
