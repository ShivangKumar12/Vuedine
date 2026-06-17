import { cn } from '../lib/cn';

/**
 * Vuedine wordmark with a custom restaurant/POS-inspired glyph.
 * Designed to read crisply at 36px and scale to large hero sizes.
 */
export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] shadow-md shadow-brand-500/25 ring-1 ring-brand-500/20"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #EC1B7C 0%, #F43F5E 55%, #F97316 100%)',
        }}
      >
        {/* highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 opacity-80"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)',
          }}
        />
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative z-10 text-white"
        >
          {/* Plate / dish */}
          <path d="M3 14a9 9 0 0 1 18 0" />
          <path d="M2.5 14h19" />
          {/* Steam dots */}
          <circle cx="9" cy="6.5" r="0.9" fill="currentColor" />
          <circle cx="12" cy="5" r="0.9" fill="currentColor" />
          <circle cx="15" cy="6.5" r="0.9" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight text-ink-900">Vuedine</span>
    </div>
  );
}
