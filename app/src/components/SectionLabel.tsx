import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

export function SectionLabel({
  children,
  className,
  dot = 'brand',
}: {
  children: ReactNode;
  className?: string;
  dot?: 'brand' | 'warm' | 'cool' | 'sun';
}) {
  const dotColor = {
    brand: 'bg-brand-500',
    warm: 'bg-warm-500',
    cool: 'bg-cool-500',
    sun: 'bg-sun-500',
  }[dot];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn('label-pill', className)}
    >
      <span className="relative flex h-2 w-2">
        <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-70', dotColor)} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotColor)} />
      </span>
      {children}
    </motion.div>
  );
}
