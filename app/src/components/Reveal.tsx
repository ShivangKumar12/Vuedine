import { motion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

type Props = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  amount?: number;
  once?: boolean;
};

export function Reveal({ children, delay = 0, y = 24, className, amount = 0.3, once = true }: Props) {
  const variants: Variants = {
    hidden: { opacity: 0, y, filter: 'blur(6px)' },
    show: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] },
    },
  };
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={variants}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({
  children,
  className,
  delay = 0,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export const stagItem: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] },
  },
};
