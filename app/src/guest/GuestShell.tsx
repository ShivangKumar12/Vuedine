import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * The customer-facing PWA lives in a tighter, mobile-first shell. No dashboard
 * sidebar, no dashboard chrome, full-width on mobile, centered with a phone-like
 * frame on desktop so it always feels purpose-built for a phone.
 */
export function GuestShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/50 via-white to-warm-50/40">
      {/* Soft halos */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-[140%] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-200/40 via-warm-100/30 to-transparent blur-3xl" />
      </div>

      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-white/85 shadow-xl shadow-brand-500/5 backdrop-blur lg:my-6 lg:min-h-[calc(100vh-3rem)] lg:rounded-[40px] lg:border lg:border-ink-200 lg:bg-white">
        <div className={cn('relative', className)}>{children}</div>
      </div>
    </div>
  );
}
