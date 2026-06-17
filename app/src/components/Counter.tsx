import { animate, useInView, useMotionValue, useTransform } from 'framer-motion';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

type CounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  format?: 'number' | 'currency-inr' | 'compact';
  duration?: number;
  className?: string;
};

const formatters: Record<NonNullable<CounterProps['format']>, (v: number, d: number) => string> = {
  number: (v, d) => v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }),
  'currency-inr': (v) =>
    v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
  compact: (v) =>
    v.toLocaleString('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }),
};

export function Counter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  format = 'number',
  duration = 2.4,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const mv = useMotionValue(0);
  const out = useTransform(mv, (v) => `${prefix}${formatters[format](v, decimals)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return controls.stop;
  }, [inView, value, duration, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {out}
    </motion.span>
  );
}
