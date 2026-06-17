import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

type Props = {
  className?: string;
  density?: number;
  color?: string;
};

/**
 * Lightweight canvas particle field, prefers-reduced-motion aware, pauses when
 * not visible and DPR-capped to keep the laptop fans quiet.
 */
export function Particles({ className, density = 60, color = 'rgba(199,210,254,0.6)' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    let particles: P[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / (1600000 / density));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.6 + 0.2,
      }));
    };

    const tick = () => {
      if (!visible) {
        frame = requestAnimationFrame(tick);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath();
        ctx.fillStyle = color.replace(/[\d.]+\)$/g, `${p.a})`);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      io.disconnect();
    };
  }, [density, color]);

  return <canvas ref={ref} aria-hidden className={cn('absolute inset-0 h-full w-full', className)} />;
}
