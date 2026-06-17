import { useRef, type HTMLAttributes, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';

type SpotlightProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
  color?: string;
};

/**
 * Pointer-following radial spotlight. Pure CSS via custom properties so it
 * doesn't trigger React renders.
 */
export function Spotlight({
  className,
  size = 600,
  color = 'rgba(236,27,124,0.10)',
  children,
  style,
  ...rest
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }}
      className={cn('relative', className)}
      style={
        {
          ...style,
          ['--spot-size' as never]: `${size}px`,
          ['--spot-color' as never]: color,
        } as CSSProperties
      }
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background] duration-150"
        style={{
          background:
            'radial-gradient(var(--spot-size) circle at var(--mx,50%) var(--my,50%), var(--spot-color), transparent 40%)',
        }}
      />
      {children}
    </div>
  );
}
