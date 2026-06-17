import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useRef, type ReactNode, type MouseEvent } from 'react';
import { cn } from '../lib/cn';

type Props = {
  children: ReactNode;
  href?: string;
  className?: string;
  intensity?: number;
  onClick?: () => void;
};

/**
 * Magnetic hover effect with spring physics. Pointer is mapped to a small
 * translation that snaps back when leaving.
 */
export function MagneticButton({ children, href = '#', className, intensity = 18, onClick }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.5 });

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    x.set(dx * intensity);
    y.set(dy * intensity);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={cn('inline-flex items-center justify-center', className)}
    >
      {children}
    </motion.a>
  );
}
