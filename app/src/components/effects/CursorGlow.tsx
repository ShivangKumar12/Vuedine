import { useEffect, useRef } from 'react';

/**
 * Subtle pink halo following the cursor on light surfaces. Uses transform so
 * it stays 60fps and cancels animation when idle.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const supportsHover = window.matchMedia('(hover: hover)').matches;
    if (!supportsHover) {
      el.style.display = 'none';
      return;
    }
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[1] h-[420px] w-[420px] -ml-[210px] -mt-[210px] mix-blend-multiply"
      style={{
        background:
          'radial-gradient(circle, rgba(236,27,124,0.12), rgba(249,115,22,0.05) 40%, transparent 65%)',
      }}
    />
  );
}
