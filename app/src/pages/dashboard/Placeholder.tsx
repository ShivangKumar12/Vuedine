import { ArrowRight, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { dashboardLinkLookup } from './nav';

export default function Placeholder() {
  const { pathname } = useLocation();
  const link = dashboardLinkLookup.find((l) => l.to === pathname);
  const Icon = link?.icon;
  const label = link?.label ?? 'Module';

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">
          Vuedine · dashboard
        </div>
        <h1 className="display mt-1 text-3xl font-extrabold text-ink-900 sm:text-4xl">{label}</h1>
        <p className="mt-1 max-w-xl text-[14px] text-ink-600">
          This module is wired into the dashboard shell. The full UI for {label.toLowerCase()} hooks into
          the same design system — colour, typography, motion — as the rest of Vuedine.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50 p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gradient-to-br from-brand-200/60 to-warm-200/60 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-warm-500 text-white shadow-lg shadow-brand-500/30">
              {Icon ? <Icon className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </span>
            <div>
              <div className="text-base font-extrabold text-brand-700">{label} workspace</div>
              <p className="mt-0.5 text-sm text-ink-600">
                Coming next: full data tables, filters, inline editing, exports, audit logs.
              </p>
            </div>
          </div>
          <button className="btn-primary shine inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold">
            Request early access
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { t: 'Filters', d: 'Date range, status, branch, channel' },
          { t: 'Bulk actions', d: 'Select, edit, export, archive' },
          { t: 'Audit logs', d: 'Every change attributed to a user' },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-extrabold text-ink-900">{c.t}</div>
            <div className="mt-1 text-[13px] text-ink-600">{c.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
