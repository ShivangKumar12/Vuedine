import { cn } from '../../lib/cn';

export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="absolute inset-0 grid-bg opacity-60" />
    </div>
  );
}
