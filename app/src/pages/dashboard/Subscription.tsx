import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  Lock,
  RefreshCcw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import {
  billingApi,
  type AddonDef,
  type ApiInvoice,
  type ApiUsage,
  type BillingPayload,
} from '../../services/billing';

/* ============================================================ */
/*  Presentational metadata (merged with live API data)         */
/* ============================================================ */

type BillingCycle = 'monthly' | 'yearly';
type PlanSlug = 'starter' | 'growth' | 'enterprise';

type Plan = {
  id: PlanSlug;
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  cta: string;
  highlight?: boolean;
  features: { label: string; included: boolean | string }[];
  accent: string;
  icon: LucideIcon;
};

// Presentation defaults — prices/features are overridden by the API at render.
const PLAN_PRESENTATION: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    blurb: 'For new outlets just getting set up',
    monthly: 999,
    yearly: 799,
    cta: 'Switch to Starter',
    accent: 'from-cool-500 to-blue-500',
    icon: Zap,
    features: [
      { label: 'Smart POS · unlimited bills', included: true },
      { label: 'QR ordering · up to 25 tables', included: '25 tables' },
      { label: 'KDS · 1 station', included: '1 station' },
      { label: 'Daily email reports', included: true },
      { label: '5 staff seats', included: '5 seats' },
      { label: 'Inventory + recipe', included: false },
      { label: 'Multi-branch', included: false },
      { label: 'Vuedine AI insights', included: false },
      { label: 'Priority 24×7 support', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    blurb: 'For 1–3 outlet brands · most popular',
    monthly: 2499,
    yearly: 1999,
    cta: 'Switch to Growth',
    highlight: true,
    accent: 'from-brand-500 via-rose-500 to-warm-500',
    icon: Rocket,
    features: [
      { label: 'Everything in Starter', included: true },
      { label: 'Unlimited tables · multi-station KDS', included: true },
      { label: 'Inventory + recipe + wastage', included: true },
      { label: 'Loyalty + CRM + campaigns', included: true },
      { label: 'Up to 3 outlets', included: '3 outlets' },
      { label: 'Vuedine AI · daily insights', included: true },
      { label: 'Aggregator integrations', included: true },
      { label: 'Custom roles + audit logs', included: false },
      { label: 'SSO · SAML · IP allowlisting', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    blurb: 'For chains, franchises and groups',
    monthly: 0,
    yearly: 0,
    cta: 'Talk to sales',
    accent: 'from-amber-500 via-orange-500 to-rose-500',
    icon: Crown,
    features: [
      { label: 'Everything in Growth', included: true },
      { label: 'Unlimited outlets · central kitchen', included: 'Unlimited' },
      { label: 'Custom roles + audit logs', included: true },
      { label: 'SSO · SAML · IP allowlisting', included: true },
      { label: 'Dedicated success manager', included: true },
      { label: 'Vuedine AI · custom models', included: true },
      { label: '99.99% SLA · priority support', included: true },
      { label: 'On-prem / private cloud option', included: true },
      { label: 'Custom contract terms', included: true },
    ],
  },
];

const ADDON_ICONS: Record<string, LucideIcon> = {
  priority: ShieldCheck,
  whatsapp: Sparkles,
  'extra-branch': Building2,
};

const featureMatrix = [
  { group: 'Operations', rows: ['Smart POS', 'KDS', 'OSS', 'Reservations', 'Multi-branch'] },
  { group: 'Customer', rows: ['QR ordering', 'CRM & loyalty', 'Campaigns', 'Reviews'] },
  { group: 'Intelligence', rows: ['Live analytics', 'Sales forecasts', 'Vuedine AI co-pilot', 'Custom models'] },
  { group: 'Security', rows: ['Audit logs', 'Custom roles', 'SSO / SAML', 'IP allowlist'] },
  { group: 'Support', rows: ['Email support', 'Chat support', 'Dedicated CSM', '99.99% SLA'] },
];

const matrixValue: Record<string, PlanSlug[]> = {
  'Smart POS': ['starter', 'growth', 'enterprise'],
  KDS: ['starter', 'growth', 'enterprise'],
  OSS: ['starter', 'growth', 'enterprise'],
  Reservations: ['growth', 'enterprise'],
  'Multi-branch': ['growth', 'enterprise'],
  'QR ordering': ['starter', 'growth', 'enterprise'],
  'CRM & loyalty': ['growth', 'enterprise'],
  Campaigns: ['growth', 'enterprise'],
  Reviews: ['growth', 'enterprise'],
  'Live analytics': ['starter', 'growth', 'enterprise'],
  'Sales forecasts': ['growth', 'enterprise'],
  'Vuedine AI co-pilot': ['growth', 'enterprise'],
  'Custom models': ['enterprise'],
  'Audit logs': ['growth', 'enterprise'],
  'Custom roles': ['enterprise'],
  'SSO / SAML': ['enterprise'],
  'IP allowlist': ['enterprise'],
  'Email support': ['starter', 'growth', 'enterprise'],
  'Chat support': ['growth', 'enterprise'],
  'Dedicated CSM': ['enterprise'],
  '99.99% SLA': ['enterprise'],
};

const PLAN_ORDER: PlanSlug[] = ['starter', 'growth', 'enterprise'];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Subscription() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  const [comparing, setComparing] = useState(false);
  const [pending, setPending] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await billingApi.current();
      setData(payload);
      setCycle(payload.subscription.cycle);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Merge presentation defaults with live plan prices/features.
  const plansView = useMemo<Plan[]>(() => {
    const bySlug = new Map((data?.plans ?? []).map((p) => [p.slug, p]));
    return PLAN_PRESENTATION.map((p) => {
      const a = bySlug.get(p.id);
      return a ? { ...p, monthly: a.monthly, yearly: a.yearly, blurb: a.blurb ?? p.blurb, features: a.features ?? p.features } : p;
    });
  }, [data]);

  const sub = data?.subscription ?? null;
  const currentSlug = (sub?.planSlug as PlanSlug) ?? 'growth';
  const currentPlan = plansView.find((p) => p.id === currentSlug) ?? plansView[1];
  const usage = data?.usage ?? null;
  const invoices = data?.invoices ?? [];
  const cardLast4 = sub?.card?.last4 ?? null;
  const isCancelled = sub?.status === 'CANCELLED';

  const renewal = useMemo(() => {
    const iso = sub?.renewsAt ?? new Date().toISOString();
    const d = new Date(iso);
    const diff = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      iso: d.toISOString(),
      pretty: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      daysLeft: Math.max(0, diff),
      isSoon: diff < 14 && diff >= 0,
    };
  }, [sub?.renewsAt]);

  const outlets = usage?.outlets.used ?? 1;
  const cyclePrice = cycle === 'monthly' ? currentPlan.monthly : currentPlan.yearly;

  /* ---- Actions ---- */
  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const confirmPlan = async (plan: Plan) => {
    if (plan.monthly === 0 && plan.yearly === 0) {
      alert('Our team will reach out about Enterprise pricing.');
      setPending(null);
      return;
    }
    setBusy('change');
    try {
      const res = await billingApi.changePlan(plan.id, cycle);
      await refetch();
      setPending(null);
      if (res.mandate?.required) {
        if (res.mandate.shortUrl) window.open(res.mandate.shortUrl, '_blank');
        else alert('Upgrade applied. A payment mandate authorization will be requested at your next renewal.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not change plan');
    } finally {
      setBusy(null);
    }
  };

  const addonsView = useMemo(
    () =>
      (data?.addonsCatalog ?? []).map((a) => ({
        ...a,
        icon: ADDON_ICONS[a.id] ?? Sparkles,
        included: sub?.addons.includes(a.id) ?? false,
      })),
    [data, sub],
  );

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <span>{error}</span>
            <button onClick={() => void refetch()} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        {sub?.frozen && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <Lock className="h-4 w-4" />
            Your account is frozen for non-payment. Settle the outstanding invoice to restore write access.
          </div>
        )}

        {/* Hero */}
        <CurrentPlanHero
          plan={currentPlan}
          cycle={cycle}
          spendPerMonth={cyclePrice * outlets}
          outlets={outlets}
          renewal={renewal}
          cardLast4={cardLast4}
          statusLabel={sub?.statusLabel ?? '—'}
          onDownloadLatest={() => invoices[0] && billingApi.downloadInvoice(invoices[0].id, invoices[0].number)}
        />

        {/* Usage */}
        {usage && <UsageGrid usage={usage} />}

        {/* Renewal alert */}
        {renewal.isSoon && !isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-amber-900">Renewing in {renewal.daysLeft} days</div>
              <div className="text-[12px] text-amber-800">
                Your plan auto-renews on <strong>{renewal.pretty}</strong>
                {cardLast4 ? `. Card ending in ${cardLast4} on file.` : '.'}
              </div>
            </div>
          </motion.div>
        )}

        {/* Plans */}
        <section>
          <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="display text-2xl font-extrabold text-ink-900">Plans</h2>
              <p className="text-[13px] text-ink-600">Switch any time. Keep all your data.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CycleToggle value={cycle} onChange={setCycle} />
              <button
                onClick={() => setComparing((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[12px] font-bold text-ink-700 shadow-sm hover:border-brand-300 hover:text-brand-700"
              >
                {comparing ? 'Hide compare' : 'Compare features'}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {plansView.map((p) => (
              <PlanCard key={p.id} plan={p} cycle={cycle} isCurrent={p.id === currentSlug} onSelect={() => setPending(p)} />
            ))}
          </div>

          <AnimatePresence>
            {comparing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden"
              >
                <CompareMatrix plans={plansView} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Add-ons */}
        <Addons addons={addonsView} busy={busy} onToggle={(id) => runAction(`addon:${id}`, () => billingApi.toggleAddon(id))} />

        {/* Payment + invoices */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PaymentCard last4={cardLast4} />
          <InvoiceList
            invoices={invoices}
            loading={loading}
            onDownload={(inv) => billingApi.downloadInvoice(inv.id, inv.number)}
          />
        </div>

        {/* Cancel / resume */}
        <CancelStrip
          cancelled={isCancelled}
          renewalPretty={renewal.pretty}
          busy={busy}
          onCancel={() => runAction('cancel', () => billingApi.cancel())}
          onResume={() => runAction('resume', () => billingApi.resume())}
        />
      </div>

      <ChangePlanDrawer
        plan={pending}
        cycle={cycle}
        currentSlug={currentSlug}
        outlets={outlets}
        busy={busy === 'change'}
        onConfirm={confirmPlan}
        onClose={() => setPending(null)}
      />
    </>
  );
}

/* ============================================================ */
/*  Current plan hero                                           */
/* ============================================================ */

function CurrentPlanHero({
  plan,
  cycle,
  spendPerMonth,
  outlets,
  renewal,
  cardLast4,
  statusLabel,
  onDownloadLatest,
}: {
  plan: Plan;
  cycle: BillingCycle;
  spendPerMonth: number;
  outlets: number;
  renewal: { pretty: string; daysLeft: number; isSoon: boolean };
  cardLast4: string | null;
  statusLabel: string;
  onDownloadLatest: () => void;
}) {
  const unit = cycle === 'monthly' ? plan.monthly : plan.yearly;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-300 bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white shadow-lg">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur ring-1 ring-white/30">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            {statusLabel} subscription
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <h1 className="display text-4xl font-extrabold tracking-tight">{plan.name}</h1>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest">
              {cycle === 'monthly' ? 'Monthly billing' : 'Yearly billing'}
            </span>
          </div>
          <p className="mt-1 max-w-md text-sm text-white/85">{plan.blurb}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur ring-1 ring-white/30">
              <Calendar className="h-3.5 w-3.5" />
              Renews · {renewal.pretty}
            </span>
            {cardLast4 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur ring-1 ring-white/30">
                <CreditCard className="h-3.5 w-3.5" />
                Card · •••• {cardLast4}
              </span>
            )}
            {renewal.isSoon && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 font-extrabold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                {renewal.daysLeft} days left
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/85">Current spend</div>
          <div className="mt-1 text-4xl font-extrabold leading-tight">
            ₹{Math.round(spendPerMonth).toLocaleString('en-IN')}
            <span className="ml-1 text-base font-bold text-white/85">/mo</span>
          </div>
          <div className="text-[11px] text-white/85">
            ₹{unit.toLocaleString('en-IN')} × {outlets} outlet{outlets === 1 ? '' : 's'}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={onDownloadLatest}
              className="rounded-xl bg-white/15 px-3 py-2 text-[12px] font-bold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
            >
              <span className="inline-flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                Latest invoice
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Usage                                                       */
/* ============================================================ */

function UsageGrid({ usage }: { usage: ApiUsage }) {
  const items: { key: string; label: string; used: number; limit: number; suffix?: string; tone: 'brand' | 'cool' | 'amber' | 'emerald' }[] = [
    { key: 'outlets', label: 'Outlets', used: usage.outlets.used, limit: usage.outlets.limit, tone: 'brand' },
    { key: 'seats', label: 'Staff seats', used: usage.seats.used, limit: usage.seats.limit, tone: 'cool' },
    { key: 'ai', label: 'AI requests', used: usage.aiRequests.used, limit: usage.aiRequests.limit, tone: 'amber' },
    { key: 'storage', label: 'Storage', used: usage.storage.used, limit: usage.storage.limit, suffix: 'GB', tone: 'emerald' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ key, ...rest }) => (
        <UsageTile key={key} {...rest} />
      ))}
    </div>
  );
}

function UsageTile({
  label,
  used,
  limit,
  suffix,
  tone,
}: {
  label: string;
  used: number;
  limit: number;
  suffix?: string;
  tone: 'brand' | 'cool' | 'amber' | 'emerald';
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isHot = pct >= 100;
  const isWarn = pct >= 80 && !isHot;
  const tones = {
    brand: { bar: 'from-brand-500 to-rose-500', text: 'text-brand-600' },
    cool: { bar: 'from-cool-500 to-blue-500', text: 'text-cool-600' },
    amber: { bar: 'from-amber-500 to-orange-500', text: 'text-amber-600' },
    emerald: { bar: 'from-emerald-500 to-teal-500', text: 'text-emerald-600' },
  } as const;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md',
        isHot ? 'border-rose-300' : isWarn ? 'border-amber-300' : 'border-ink-200',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
          <div className={cn('mt-1 text-2xl font-extrabold', tones[tone].text)}>
            <Counter value={used} suffix={suffix ? ` ${suffix}` : ''} />
          </div>
          <div className="text-[11px] text-ink-500">
            of {limit.toLocaleString('en-IN')}
            {suffix ? ` ${suffix}` : ''}
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
            isHot ? 'bg-rose-50 text-rose-700 ring-rose-200' : isWarn ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-ink-100 text-ink-600 ring-ink-200',
          )}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn('h-full rounded-full bg-gradient-to-r', tones[tone].bar)}
        />
      </div>
    </motion.div>
  );
}

/* ============================================================ */
/*  Plans                                                       */
/* ============================================================ */

function CycleToggle({ value, onChange }: { value: BillingCycle; onChange: (v: BillingCycle) => void }) {
  return (
    <div className="inline-flex h-9 items-center rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      {(['monthly', 'yearly'] as const).map((c) => {
        const isActive = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-bold transition',
              isActive ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="cycle-toggle"
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative">
              {c === 'monthly' ? 'Monthly' : 'Yearly'}
              {c === 'yearly' && (
                <span className={cn('ml-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold', isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700')}>
                  −20%
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({ plan, cycle, isCurrent, onSelect }: { plan: Plan; cycle: BillingCycle; isCurrent: boolean; onSelect: () => void }) {
  const Icon = plan.icon;
  const price = cycle === 'monthly' ? plan.monthly : plan.yearly;
  const showCustom = price === 0;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={cn('relative overflow-hidden rounded-2xl border bg-white shadow-sm transition', plan.highlight ? 'border-brand-300 shadow-md shadow-brand-500/10' : 'border-ink-200')}
    >
      {plan.highlight && <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-brand-200/60 to-warm-200/60 blur-2xl" />}
      {isCurrent && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Current plan
        </div>
      )}
      <div className="relative p-6">
        <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md', plan.accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-ink-900">{plan.name}</h3>
        <p className="mt-0.5 text-[12px] text-ink-600">{plan.blurb}</p>

        <div className="mt-5">
          {showCustom ? (
            <div className="text-3xl font-extrabold text-ink-900">Custom</div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-ink-900">₹{price.toLocaleString('en-IN')}</span>
              <span className="text-[12px] font-bold text-ink-500">/ outlet / mo</span>
            </div>
          )}
          <div className="mt-1 text-[11px] font-medium text-ink-500">
            {showCustom ? 'Tailored to your scale' : cycle === 'yearly' ? 'Billed yearly · 20% off' : 'Billed monthly · cancel anytime'}
          </div>
        </div>

        <button
          onClick={onSelect}
          disabled={isCurrent}
          className={cn(
            'mt-5 block w-full rounded-xl px-4 py-2.5 text-center text-sm font-bold transition disabled:cursor-not-allowed',
            isCurrent ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : plan.highlight ? 'btn-primary shine' : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
          )}
        >
          {isCurrent ? "✓ You're on this plan" : plan.cta}
        </button>

        <ul className="mt-5 space-y-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[12px]">
              {typeof f.included === 'string' ? (
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : f.included ? (
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : (
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400 ring-1 ring-ink-200">
                  <X className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className={cn(f.included ? 'font-semibold text-ink-800' : 'text-ink-400')}>
                {f.label}
                {typeof f.included === 'string' && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">{f.included}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function CompareMatrix({ plans }: { plans: Plan[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-ink-100">
        <thead>
          <tr className="bg-ink-50/60 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
            <th className="px-5 py-3 text-left">Feature</th>
            {plans.map((p) => (
              <th key={p.id} className="px-5 py-3 text-center">
                <div className={cn('font-extrabold', p.id === 'growth' ? 'text-brand-600' : 'text-ink-900')}>{p.name}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 text-sm">
          {featureMatrix.flatMap((g) => [
            <tr key={`g-${g.group}`} className="bg-ink-50/40">
              <td colSpan={4} className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">{g.group}</td>
            </tr>,
            ...g.rows.map((row) => (
              <tr key={row}>
                <td className="px-5 py-3 text-[13px] font-semibold text-ink-800">{row}</td>
                {PLAN_ORDER.map((pid) => (
                  <td key={pid} className="px-5 py-3 text-center">
                    {(matrixValue[row] ?? []).includes(pid) ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-ink-400 ring-1 ring-ink-200">
                        <X className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================ */
/*  Add-ons                                                     */
/* ============================================================ */

type AddonView = AddonDef & { icon: LucideIcon; included: boolean };

function Addons({ addons, busy, onToggle }: { addons: AddonView[]; busy: string | null; onToggle: (id: string) => void }) {
  return (
    <section>
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="display text-2xl font-extrabold text-ink-900">Add-ons</h2>
          <p className="text-[13px] text-ink-600">Boost your plan without upgrading.</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {addons.map((a) => {
          const Icon = a.icon;
          const working = busy === `addon:${a.id}`;
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-ink-900">{a.name}</div>
                <div className="mt-0.5 text-[12px] text-ink-600">{a.desc}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[14px] font-extrabold text-brand-600">+₹{a.price.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-500">/ month</span>
                </div>
              </div>
              <button
                onClick={() => onToggle(a.id)}
                disabled={working}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-50',
                  a.included
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                    : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-500 hover:text-white hover:border-brand-500',
                )}
              >
                {working ? '…' : a.included ? 'Added' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Payment & invoices                                          */
/* ============================================================ */

function PaymentCard({ last4 }: { last4: string | null }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="border-b border-ink-100 p-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Payment method</div>
        <div className="mt-0.5 text-base font-extrabold text-ink-900">{last4 ? 'Card on file' : 'No card on file'}</div>
      </div>
      <div className="p-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-5 text-white shadow-lg">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-brand-500/40 to-warm-500/40 blur-2xl" />
          <div className="flex items-start justify-between">
            <Logo />
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur ring-1 ring-white/20">Visa</span>
          </div>
          <div className="mt-6 font-mono text-lg font-bold tracking-wider">•••• •••• •••• {last4 ?? '____'}</div>
          <div className="mt-3 flex items-end justify-between text-[10px] font-bold">
            <div>
              <div className="text-white/60">CARDHOLDER</div>
              <div className="mt-0.5">ON FILE</div>
            </div>
            <div>
              <div className="text-white/60">VIA</div>
              <div className="mt-0.5">RAZORPAY</div>
            </div>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-ink-500">
          <Lock className="h-3 w-3" />
          PCI-DSS compliant · cards never stored on our servers
        </div>
      </div>
    </section>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg shadow-md" style={{ background: 'linear-gradient(135deg, #EC1B7C 0%, #F43F5E 55%, #F97316 100%)' }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M3 14a9 9 0 0 1 18 0" />
          <path d="M2.5 14h19" />
        </svg>
      </span>
      <span className="text-[13px] font-bold tracking-tight">Vuedine</span>
    </div>
  );
}

function InvoiceList({ invoices, loading, onDownload }: { invoices: ApiInvoice[]; loading: boolean; onDownload: (inv: ApiInvoice) => void }) {
  const statusTone: Record<string, string> = {
    Paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Open: 'border-amber-200 bg-amber-50 text-amber-700',
    Failed: 'border-rose-200 bg-rose-50 text-rose-700',
    Draft: 'border-ink-200 bg-ink-50 text-ink-600',
    Void: 'border-ink-200 bg-ink-50 text-ink-500',
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between border-b border-ink-100 p-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Invoices</div>
          <div className="mt-0.5 text-base font-extrabold text-ink-900">Recent activity</div>
        </div>
      </div>
      {invoices.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-400">{loading ? 'Loading invoices…' : 'No invoices yet. Your first invoice appears at renewal.'}</div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {invoices.map((iv) => (
            <li key={iv.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Calendar className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px] font-extrabold text-ink-900">{iv.number}</div>
                <div className="text-[11px] text-ink-500">{iv.date} · {iv.period}</div>
              </div>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', statusTone[iv.statusLabel] ?? statusTone.Open)}>{iv.statusLabel}</span>
              <div className="text-[13px] font-extrabold text-ink-900">₹{iv.amount.toLocaleString('en-IN')}</div>
              <button onClick={() => onDownload(iv)} aria-label="Download invoice" className="rounded-lg border border-ink-200 bg-white p-1.5 text-ink-400 hover:border-brand-300 hover:text-brand-700">
                <Download className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ============================================================ */
/*  Cancel / resume strip                                       */
/* ============================================================ */

function CancelStrip({
  cancelled,
  renewalPretty,
  busy,
  onCancel,
  onResume,
}: {
  cancelled: boolean;
  renewalPretty: string;
  busy: string | null;
  onCancel: () => void;
  onResume: () => void;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
          <RefreshCcw className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-ink-900">Pause subscription</div>
          <div className="mt-0.5 text-[12px] text-ink-600">Keep your data, stop billing for up to 90 days.</div>
        </div>
        <button
          onClick={() => alert('To pause billing, contact support@vuedine.com — we keep your data for up to 90 days.')}
          className="shrink-0 rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px] font-bold text-amber-700 hover:border-amber-500 hover:bg-amber-500 hover:text-white"
        >
          Pause
        </button>
      </div>

      {cancelled ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <RefreshCcw className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold text-ink-900">Resume subscription</div>
            <div className="mt-0.5 text-[12px] text-ink-600">Cancelled — active until {renewalPretty}.</div>
          </div>
          <button
            onClick={onResume}
            disabled={busy === 'resume'}
            className="shrink-0 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[12px] font-bold text-emerald-700 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white disabled:opacity-50"
          >
            {busy === 'resume' ? '…' : 'Resume'}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <X className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold text-ink-900">Cancel subscription</div>
            <div className="mt-0.5 text-[12px] text-ink-600">Stay live until {renewalPretty}.</div>
          </div>
          <button
            onClick={() => {
              if (confirm('Cancel your subscription? You stay live until the end of the current period.')) onCancel();
            }}
            disabled={busy === 'cancel'}
            className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-[12px] font-bold text-rose-600 hover:border-rose-500 hover:bg-rose-500 hover:text-white disabled:opacity-50"
          >
            {busy === 'cancel' ? '…' : 'Cancel'}
          </button>
        </div>
      )}

      <Link to="/dashboard/integrations" className="flex items-start gap-3 rounded-2xl border border-cool-200 bg-cool-50/40 p-4 transition hover:border-cool-400">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cool-50 text-cool-600 ring-1 ring-cool-100">
          <Settings className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-ink-900">Account settings</div>
          <div className="mt-0.5 text-[12px] text-ink-600">Manage roles, branches and integrations.</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-cool-600" />
      </Link>
    </section>
  );
}

/* ============================================================ */
/*  Change-plan drawer                                          */
/* ============================================================ */

function ChangePlanDrawer({
  plan,
  cycle,
  currentSlug,
  outlets,
  busy,
  onConfirm,
  onClose,
}: {
  plan: Plan | null;
  cycle: BillingCycle;
  currentSlug: PlanSlug;
  outlets: number;
  busy: boolean;
  onConfirm: (plan: Plan) => void;
  onClose: () => void;
}) {
  if (!plan) return <AnimatePresence />;
  const isUpgrade = PLAN_ORDER.indexOf(plan.id) > PLAN_ORDER.indexOf(currentSlug);
  const newPrice = cycle === 'monthly' ? plan.monthly : plan.yearly;
  const showCustom = newPrice === 0;

  return (
    <AnimatePresence>
      {plan && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className={cn('relative bg-gradient-to-br p-6 text-white', plan.accent)}>
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30">
                <X className="h-4 w-4" />
              </button>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/85">
                {showCustom ? 'Get a quote' : isUpgrade ? 'Upgrade to' : 'Switch to'}
              </div>
              <div className="mt-1 text-3xl font-extrabold">{plan.name}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="rounded-full bg-white/20 px-2 py-0.5">{cycle === 'monthly' ? 'Monthly' : 'Yearly · −20%'}</span>
                {!showCustom && <span className="rounded-full bg-white/20 px-2 py-0.5">₹{newPrice.toLocaleString('en-IN')} / outlet / mo</span>}
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              {showCustom ? (
                <div className="space-y-3">
                  <div className="text-[13px] text-ink-700">
                    Enterprise pricing is tailored to your scale — outlets, seats, AI usage and SLA. A Vuedine specialist will reach out within one business day.
                  </div>
                  <input className="vue-input" placeholder="Work email" defaultValue="" />
                  <input className="vue-input" placeholder="Phone" defaultValue="" />
                  <textarea
                    rows={3}
                    placeholder="What problem are we solving?"
                    className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-900 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                  />
                </div>
              ) : (
                <>
                  <Section title="What changes">
                    <ul className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
                      {plan.features
                        .filter((f) => f.included !== false)
                        .slice(0, 6)
                        .map((f, i) => (
                          <li key={i} className="flex items-center gap-2 font-semibold text-ink-800">
                            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                            {f.label}
                          </li>
                        ))}
                    </ul>
                  </Section>

                  <Section title="Charges">
                    <div className="space-y-1.5 rounded-xl border border-ink-100 bg-white p-3 text-[13px]">
                      <RowKv label={`${plan.name} · ${outlets} outlet${outlets === 1 ? '' : 's'}`}>
                        ₹{(newPrice * outlets).toLocaleString('en-IN')} / mo
                      </RowKv>
                      {isUpgrade && (
                        <RowKv label="Mandate">
                          <span className="text-brand-600">Razorpay authorization</span>
                        </RowKv>
                      )}
                      <div className="my-1 border-t border-dashed border-ink-200" />
                      <RowKv label={isUpgrade ? 'Billed from next cycle' : 'New monthly'} emphasis>
                        ₹{(newPrice * outlets).toLocaleString('en-IN')}
                      </RowKv>
                    </div>
                  </Section>

                  <div className="flex items-start gap-2 rounded-xl border border-ink-100 bg-white p-3 text-[12px] text-ink-600">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>Your data stays intact. You can switch plans anytime. Cancellation is one click.</span>
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-ink-100 bg-white p-4">
              <button onClick={onClose} className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-ink-300">
                Cancel
              </button>
              <button
                onClick={() => onConfirm(plan)}
                disabled={busy}
                className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {busy ? 'Working…' : showCustom ? 'Request quote' : `Confirm ${isUpgrade ? 'upgrade' : 'switch'}`}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">{title}</h3>
      {children}
    </section>
  );
}

function RowKv({ label, emphasis, children }: { label: string; emphasis?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between', emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700')}>
      <span className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</span>
      <span className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</span>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">Subscription</span>
    </nav>
  );
}
