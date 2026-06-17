import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';

/**
 * Premium smooth scrolling for marketing pages only. Disabled on dashboard and
 * auth routes (those should feel instant + native). Plays nicely with Framer
 * Motion's `useScroll` because Lenis still drives `window.scrollY`.
 */
export function SmoothScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Only smooth-scroll the marketing landing page
    const isMarketing = pathname === '/' || pathname === '';
    if (!isMarketing) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduce || isCoarse) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      lerp: 0.1,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const id = link.getAttribute('href');
      if (!id || id === '#' || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -16, duration: 1.4 });
    };
    document.addEventListener('click', onAnchorClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onAnchorClick);
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
