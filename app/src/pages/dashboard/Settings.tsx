import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  Clock,
  Code2,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe2,
  IndianRupee,
  Key,
  Languages,
  Laptop,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Package,
  Palette,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  RefreshCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  User,
  Users,
  Wallet,
  Webhook,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { branchesApi } from '../../services/branches';
import { paymentSettingsApi, type PaymentSettings } from '../../services/paymentSettings';
import {
  settingsApi,
  type HardwareDevice,
  type HardwareType,
  type NotificationPreference,
  type TaxSlab,
} from '../../services/settings';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';

/* ============================================================ */
/*  Section nav                                                 */
/* ============================================================ */

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  desc?: string;
};

type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'restaurant', label: 'Restaurant', icon: Building2 },
      { id: 'branches', label: 'Branches', icon: MapPin },
      { id: 'branding', label: 'Branding & QR menu', icon: Palette },
      { id: 'localization', label: 'Localization', icon: Languages },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'taxes', label: 'Taxes & Bills', icon: Receipt },
      { id: 'payments', label: 'Payments', icon: Wallet },
      { id: 'hardware', label: 'Hardware', icon: Printer },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Platform',
    items: [
      { id: 'security', label: 'Security', icon: ShieldCheck },
      { id: 'data', label: 'Data & privacy', icon: Database },
      { id: 'subscription', label: 'Subscription', icon: CreditCard },
      { id: 'developer', label: 'Developer', icon: Code2 },
      { id: 'danger', label: 'Danger zone', icon: AlertTriangle },
    ],
  },
];

const flatNav: NavItem[] = navGroups.flatMap((g) => g.items);

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Settings() {
  const [active, setActive] = useState<string>(flatNav[0].id);
  const [dirty, setDirty] = useState(false);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  // Hash sync
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && flatNav.some((n) => n.id === hash)) {
      setActive(hash);
      const el = refs.current[hash];
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
      }
    }
  }, []);

  // Scroll-spy
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    flatNav.forEach((n) => {
      const el = refs.current[n.id];
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(n.id);
          });
        },
        { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75] },
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const goTo = (id: string) => {
    const el = refs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top, behavior: 'smooth' });
    setActive(id);
    history.replaceState(null, '', `#${id}`);
  };

  const setRef = (id: string) => (el: HTMLElement | null) => {
    refs.current[id] = el;
  };

  return (
    <div className="space-y-5 pb-32">
      {/* Breadcrumb + heading */}
      <Breadcrumb />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl font-extrabold text-ink-900 sm:text-4xl">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Configure your restaurant from billing to branches, taxes to integrations. Changes save per
            section.
          </p>
        </div>
      </div>

      {/* Mobile section picker */}
      <MobileSectionPicker active={active} onChange={goTo} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Rail */}
        <DesktopRail active={active} onPick={goTo} />

        {/* Sections */}
        <div className="space-y-8">
          <SectionWrap setRef={setRef('profile')} icon={User} label="Profile" desc="Your personal Vuedine account">
            <ProfileSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('restaurant')} icon={Building2} label="Restaurant" desc="Public information about your restaurant">
            <RestaurantSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('branches')} icon={MapPin} label="Branches" desc="Manage every outlet from one place">
            <BranchesSection />
          </SectionWrap>
          <SectionWrap setRef={setRef('branding')} icon={Palette} label="Branding & QR menu" desc="How your customers see your brand">
            <BrandingSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('localization')} icon={Languages} label="Localization" desc="Currency, language, dates and time">
            <LocalizationSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('taxes')} icon={Receipt} label="Taxes & Bills" desc="GST, slabs, bill format and round-off">
            <TaxesSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('payments')} icon={Wallet} label="Payments" desc="Gateway, methods and settlement">
            <PaymentsSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('hardware')} icon={Printer} label="Hardware" desc="Printers, cash drawers and KDS screens">
            <HardwareSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('notifications')} icon={Bell} label="Notifications" desc="Choose what you get and where">
            <NotificationsSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('security')} icon={ShieldCheck} label="Security" desc="2FA, sessions, IP allowlist and audit logs">
            <SecuritySection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('data')} icon={Database} label="Data & privacy" desc="Backup, export and retention">
            <DataSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('subscription')} icon={CreditCard} label="Subscription" desc="Plan, invoices and seats">
            <SubscriptionSection />
          </SectionWrap>
          <SectionWrap setRef={setRef('developer')} icon={Code2} label="Developer" desc="API keys, webhooks and logs">
            <DeveloperSection onChange={() => setDirty(true)} />
          </SectionWrap>
          <SectionWrap setRef={setRef('danger')} icon={AlertTriangle} label="Danger zone" desc="Pause or close your account">
            <DangerSection />
          </SectionWrap>
        </div>
      </div>

      {/* Sticky save bar */}
      <SaveBar dirty={dirty} onDiscard={() => setDirty(false)} onSave={() => setDirty(false)} />
    </div>
  );
}

/* ============================================================ */
/*  Layout primitives                                           */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">Settings</span>
    </nav>
  );
}

function DesktopRail({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[88px] overflow-hidden rounded-2xl border border-ink-200 bg-white p-3 shadow-sm">
        {navGroups.map((g, gi) => (
          <div key={g.title} className={cn(gi > 0 && 'mt-4')}>
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
              {g.title}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.id;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => onPick(it.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-700 hover:bg-ink-50/80 hover:text-ink-900',
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="settings-active"
                          className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-brand-500"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-brand-600' : 'text-ink-500 group-hover:text-ink-700',
                        )}
                      />
                      <span className="truncate">{it.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

function MobileSectionPicker({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="lg:hidden">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {flatNav.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
                isActive
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionWrap({
  setRef,
  icon: Icon,
  label,
  desc,
  children,
}: {
  setRef: (el: HTMLElement | null) => void;
  icon: React.ElementType;
  label: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section ref={setRef} className="scroll-mt-28">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100">
          <Icon className="h-4 w-4 text-brand-600" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink-900">{label}</h2>
          <p className="text-[13px] text-ink-600">{desc}</p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SaveBar({
  dirty,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed inset-x-3 bottom-3 z-30 lg:left-[280px] lg:right-6"
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-2xl shadow-black/10">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Save className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-ink-900">You have unsaved changes</div>
                <div className="text-[11px] text-ink-500">Review before applying.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDiscard}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-bold text-ink-700 transition hover:border-ink-300"
              >
                Discard
              </button>
              <button
                onClick={onSave}
                className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold"
              >
                <Save className="h-3.5 w-3.5" />
                Save changes
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Form primitives                                             */
/* ============================================================ */

function Card({
  title,
  desc,
  children,
  action,
}: {
  title?: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      {(title || desc || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 p-5">
          <div className="min-w-0">
            {title && <div className="text-[14px] font-extrabold text-ink-900">{title}</div>}
            {desc && <p className="mt-0.5 text-[12px] text-ink-600">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="space-y-5 p-5">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-6">
      <div>
        <div className="text-[13px] font-bold text-ink-900">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-2', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
          checked ? 'bg-brand-500' : 'bg-ink-200 hover:bg-ink-300',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-md', checked ? 'ml-auto mr-0.5' : 'ml-0.5')}
        />
      </button>
      {label && <span className="text-[13px] font-semibold text-ink-700">{label}</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  type = 'text',
  copyable,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  type?: string;
  copyable?: boolean;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-xl border border-ink-200 bg-white text-[13px] font-medium text-ink-900 placeholder:text-ink-400 shadow-sm transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
          prefix ? 'pl-9' : 'pl-3',
          suffix || copyable ? 'pr-9' : 'pr-3',
        )}
      />
      {(suffix || copyable) && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400">
          {copyable ? (
            <button
              type="button"
              aria-label="Copy"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          ) : (
            suffix
          )}
        </span>
      )}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-medium text-ink-900 placeholder:text-ink-400 shadow-sm transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-900 shadow-sm transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      {options.map((o) => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex items-center rounded-lg px-3 py-1 text-[12px] font-bold transition',
              isActive ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join('-')}`}
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Inline save button with idle/saving/saved/error states. Used by the Phase F
 * settings sections that persist to the API directly (instead of the global
 * SaveBar, which only covers the not-yet-wired sections).
 */
function SaveButton({
  onSave,
  idle = 'Save changes',
  disabled,
}: {
  onSave: () => Promise<void>;
  idle?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setState('saving');
    setMsg(null);
    try {
      await onSave();
      setState('saved');
      window.setTimeout(() => setState('idle'), 2200);
    } catch (e) {
      setState('error');
      setMsg(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state === 'saving' || disabled}
        className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60"
      >
        {state === 'saving' ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-r-transparent" />
            Saving…
          </>
        ) : state === 'saved' ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Saved
          </>
        ) : (
          <>
            <Save className="h-3.5 w-3.5" />
            {idle}
          </>
        )}
      </button>
      {state === 'error' && msg && (
        <span className="text-[12px] font-semibold text-rose-600">{msg}</span>
      )}
    </div>
  );
}


/* ============================================================ */
/*  Section 1 · Profile                                         */
/* ============================================================ */

function ProfileSection({ onChange }: { onChange: () => void }) {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@vuedine.demo');
  const [phone, setPhone] = useState('+91 98xxxx0001');
  const [title, setTitle] = useState('Owner');
  const [tz, setTz] = useState('Asia/Kolkata');

  const handle = (set: (v: string) => void) => (v: string) => {
    set(v);
    onChange();
  };

  return (
    <Card title="Personal details" desc="This is what your team will see in audit logs and chat.">
      <Row label="Photo" hint="JPG or PNG · max 4 MB · square works best">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 text-xl font-bold text-white shadow-md shadow-brand-500/30 ring-2 ring-white">
            {name
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join('')}
          </span>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-rose-200 hover:text-rose-600">
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      </Row>
      <Row label="Full name">
        <Input value={name} onChange={handle(setName)} placeholder="Jane Doe" />
      </Row>
      <Row label="Job title" hint="Optional · helps team know your role">
        <Input value={title} onChange={handle(setTitle)} placeholder="Owner / Operator" />
      </Row>
      <Row label="Email" hint="Used for login and critical alerts">
        <Input value={email} onChange={handle(setEmail)} prefix={<Mail className="h-3.5 w-3.5" />} />
      </Row>
      <Row label="Phone">
        <Input value={phone} onChange={handle(setPhone)} prefix={<Phone className="h-3.5 w-3.5" />} />
      </Row>
      <Row label="Time zone">
        <Select
          value={tz}
          onChange={handle(setTz)}
          options={[
            { value: 'Asia/Kolkata', label: 'Asia/Kolkata · IST' },
            { value: 'Asia/Dubai', label: 'Asia/Dubai · GST' },
            { value: 'Asia/Singapore', label: 'Asia/Singapore · SGT' },
            { value: 'Europe/London', label: 'Europe/London · BST' },
            { value: 'America/New_York', label: 'America/New_York · EDT' },
          ]}
        />
      </Row>
    </Card>
  );
}

/* ============================================================ */
/*  Section 2 · Restaurant                                      */
/* ============================================================ */

function RestaurantSection({ onChange }: { onChange: () => void }) {
  const settings = settingsStore.use();
  const branches = branchesStore.use();
  const activeBranch = branches.list.find((b) => b.id === branches.activeId) ?? null;
  const t = settings.tenant;

  const [legal, setLegal] = useState('');
  const [trade, setTrade] = useState('');
  const [type, setType] = useState('restaurant');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');

  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  type Day = (typeof DAYS)[number];
  type HourRow = { open: string; close: string; closed: boolean };
  const [hours, setHours] = useState<Record<Day, HourRow>>(() =>
    Object.fromEntries(DAYS.map((d) => [d, { open: '11:00', close: '23:00', closed: false }])) as Record<Day, HourRow>,
  );

  // Hydrate identity from the settings store once loaded.
  useEffect(() => {
    if (!t) return;
    setLegal(t.legalName ?? '');
    setTrade(t.name ?? '');
    setType(t.type ?? 'restaurant');
    setPhone(t.contactPhone ?? '');
    setEmail(t.contactEmail ?? '');
    setBio(t.description ?? '');
  }, [t]);

  // Hydrate business hours from the active branch.
  useEffect(() => {
    const oh = (activeBranch?.openingHours ?? null) as Record<string, string[]> | null;
    if (!oh) return;
    setHours((prev) => {
      const next = { ...prev };
      for (const d of DAYS) {
        const v = oh[d];
        if (Array.isArray(v) && v.length === 2) next[d] = { open: v[0], close: v[1], closed: false };
        else if (v === null || (Array.isArray(v) && v.length === 0)) next[d] = { ...next[d], closed: true };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch?.id]);

  const update = (d: Day, patch: Partial<HourRow>) => {
    setHours((h) => ({ ...h, [d]: { ...h[d], ...patch } }));
    onChange();
  };

  const saveIdentity = async () => {
    const updated = await settingsApi.updateTenant({
      legalName: legal || null,
      name: trade,
      type,
      contactPhone: phone || null,
      contactEmail: email || null,
      description: bio || null,
    });
    settingsStore.setTenant(updated);
  };

  const saveHours = async () => {
    if (!activeBranch) throw new Error('Pick a branch first');
    const openingHours: Record<string, string[]> = {};
    for (const d of DAYS) {
      openingHours[d] = hours[d].closed ? [] : [hours[d].open, hours[d].close];
    }
    await branchesApi.update(activeBranch.id, { openingHours });
  };

  return (
    <>
      <Card title="Public details" desc="Shown on QR menus, receipts and customer messaging.">
        <Row label="Legal name" hint="As registered with the tax department">
          <Input value={legal} onChange={(v) => { setLegal(v); onChange(); }} />
        </Row>
        <Row label="Trading name" hint="What customers see">
          <Input value={trade} onChange={(v) => { setTrade(v); onChange(); }} />
        </Row>
        <Row label="Restaurant type">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'restaurant', label: 'Fine dining' },
              { value: 'qsr', label: 'Quick service' },
              { value: 'cafe', label: 'Café' },
              { value: 'bar', label: 'Bar / Pub' },
              { value: 'cloud', label: 'Cloud kitchen' },
              { value: 'hotel', label: 'Hotel restaurant' },
            ].map((o) => (
              <Chip key={o.value} active={type === o.value} onClick={() => { setType(o.value); onChange(); }}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Row>
        <Row label="Contact" hint="Used on receipts and notifications">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={phone} onChange={(v) => { setPhone(v); onChange(); }} prefix={<Phone className="h-3.5 w-3.5" />} />
            <Input value={email} onChange={(v) => { setEmail(v); onChange(); }} prefix={<Mail className="h-3.5 w-3.5" />} />
          </div>
        </Row>
        <Row label="About" hint="Optional · printed below the QR menu hero">
          <Textarea value={bio} onChange={(v) => { setBio(v); onChange(); }} rows={3} />
        </Row>
        <div className="flex justify-end pt-1">
          <SaveButton onSave={saveIdentity} />
        </div>
      </Card>

      <Card title="Business hours" desc={`Used for QR ordering and reservations${activeBranch ? ` · ${activeBranch.name}` : ''}.`}>
        <div className="grid grid-cols-1 gap-2">
          {DAYS.map((d) => (
            <div key={d} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
              <div className="w-12 text-[13px] font-extrabold uppercase text-ink-900">{d}</div>
              <Switch checked={!hours[d].closed} onChange={(v) => update(d, { closed: !v })} label={hours[d].closed ? 'Closed' : 'Open'} />
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="time"
                  value={hours[d].open}
                  onChange={(e) => update(d, { open: e.target.value })}
                  disabled={hours[d].closed}
                  className="h-9 w-28 rounded-lg border border-ink-200 bg-white px-2 text-[12px] font-semibold text-ink-800 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:opacity-40"
                />
                <span className="text-ink-400">→</span>
                <input
                  type="time"
                  value={hours[d].close}
                  onChange={(e) => update(d, { close: e.target.value })}
                  disabled={hours[d].closed}
                  className="h-9 w-28 rounded-lg border border-ink-200 bg-white px-2 text-[12px] font-semibold text-ink-800 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:opacity-40"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <SaveButton onSave={saveHours} idle="Save hours" disabled={!activeBranch} />
        </div>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 3 · Branches                                        */
/* ============================================================ */

type BranchRow = {
  id: string;
  name: string;
  code: string;
  qrSlug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  isLive: boolean;
  diningSections: string[];
  serviceCharge: number | string;
  taxInclusive: boolean;
  defaultPrep: number;
  _count?: { tables: number };
};

function BranchesSection() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BranchRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await branchesApi.fetchAll();
      setBranches(list as BranchRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    branchesApi
      .fetchAll()
      .then((list) => {
        if (!cancelled) setBranches(list as BranchRow[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load branches');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggleLive = async (b: BranchRow) => {
    try {
      const updated = await branchesApi.toggleLive(b.id);
      setBranches((cur) => cur.map((x) => (x.id === updated.id ? (updated as BranchRow) : x)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle branch');
    }
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    try {
      await branchesApi.remove(pendingDelete.id);
      setBranches((cur) => cur.filter((x) => x.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete branch');
    }
  };

  return (
    <>
      <Card
        title="Branches"
        desc="Each branch has its own staff, menu pricing, taxes and KDS."
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add branch
          </button>
        }
      >
        {error && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
            {error}{' '}
            <button onClick={refresh} className="underline-offset-2 hover:underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white p-10 text-center">
            <div className="text-base font-bold text-ink-900">No branches yet</div>
            <p className="mt-1 text-sm text-ink-600">
              Add your first branch — it powers the topbar selector and every other page.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="btn-primary shine mt-4 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              Add branch
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {branches.map((b) => (
              <li
                key={b.id}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-warm-500 text-white shadow-md shadow-brand-500/30">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-ink-900">{b.name}</span>
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ink-700">
                          {b.code}
                        </span>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-600">{b.address ?? '—'}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-500">
                        {b.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {b.phone}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="h-3 w-3" />
                          /m/{b.qrSlug}
                        </span>
                        {b._count && (
                          <span className="inline-flex items-center gap-1">
                            {b._count.tables} tables
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleLive(b)}
                    title="Toggle live"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 transition',
                      b.isLive
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        b.isLive ? 'bg-emerald-500' : 'bg-rose-500',
                      )}
                    />
                    {b.isLive ? 'Live' : 'Paused'}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-ink-100 pt-3">
                  <Link
                    to="/dashboard/tables"
                    onClick={() => branchesStore.setActive(b.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    <Eye className="h-3 w-3" />
                    Open
                  </Link>
                  <Link
                    to="/dashboard/items"
                    onClick={() => branchesStore.setActive(b.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    Manage menu
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-700 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(b)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-700 hover:border-rose-200 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BranchFormModal
        open={creating || !!editing}
        initial={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(b) => {
          setBranches((cur) => {
            const i = cur.findIndex((x) => x.id === b.id);
            if (i === -1) return [...cur, b];
            const next = cur.slice();
            next[i] = b;
            return next;
          });
        }}
      />

      <BranchDeleteConfirm
        branch={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={onDelete}
      />
    </>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function BranchFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: BranchRow | null;
  onClose: () => void;
  onSaved: (b: BranchRow) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [qrSlug, setQrSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [manager, setManager] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [defaultPrep, setDefaultPrep] = useState(15);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [sectionsCsv, setSectionsCsv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    if (initial) {
      setName(initial.name);
      setCode(initial.code);
      setQrSlug(initial.qrSlug);
      setAddress(initial.address ?? '');
      setPhone(initial.phone ?? '');
      setEmail(initial.email ?? '');
      setManager(initial.manager ?? '');
      setIsLive(initial.isLive);
      setDefaultPrep(initial.defaultPrep ?? 15);
      setServiceCharge(Number(initial.serviceCharge ?? 0));
      setSectionsCsv((initial.diningSections ?? []).join(', '));
    } else {
      setName('');
      setCode('');
      setQrSlug('');
      setAddress('');
      setPhone('');
      setEmail('');
      setManager('');
      setIsLive(true);
      setDefaultPrep(15);
      setServiceCharge(0);
      setSectionsCsv('Indoor · Window, Indoor · Center, Outdoor · Patio');
    }
  }, [open, initial]);

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched && !isEdit) setQrSlug(slugify(v));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const sections = sectionsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      qrSlug: qrSlug.trim().toLowerCase(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      manager: manager.trim() || null,
      isLive,
      defaultPrep,
      serviceCharge,
      diningSections: sections,
    };

    try {
      const result = isEdit && initial
        ? await branchesApi.update(initial.id, payload)
        : await branchesApi.create(payload);
      onSaved(result as BranchRow);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'BRANCH_CODE_TAKEN') setError(`Branch code "${code}" is already used`);
        else if (err.code === 'BRANCH_SLUG_TAKEN') setError(`Slug "${qrSlug}" is already used`);
        else if (err.code === 'VALIDATION_FAILED') setError('Please double-check the form values');
        else setError(err.message);
      } else {
        setError('Could not reach the server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
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
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 max-h-[calc(100vh-48px)] overflow-y-auto"
          >
            <form onSubmit={onSubmit} className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Branches</div>
                  <div className="text-lg font-extrabold text-ink-900">
                    {isEdit ? `Edit ${initial!.name}` : 'Add new branch'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel required>Branch name</FieldLabel>
                  <input
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    required
                    placeholder="Mumbai · Bandra (Main)"
                    className="vue-input"
                  />
                </div>
                <div>
                  <FieldLabel required>Code</FieldLabel>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                    required
                    placeholder="BAN"
                    className="vue-input font-mono uppercase"
                  />
                  <div className="mt-1 text-[11px] text-ink-500">2–6 uppercase letters/numbers</div>
                </div>
                <div>
                  <FieldLabel required>QR slug</FieldLabel>
                  <input
                    value={qrSlug}
                    onChange={(e) => {
                      setQrSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    required
                    placeholder="bandra"
                    className="vue-input font-mono lowercase"
                  />
                  <div className="mt-1 text-[11px] text-ink-500">Public URL: /m/{qrSlug || 'slug'}/...</div>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Address</FieldLabel>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Linking Rd, Bandra West, Mumbai 400050"
                    className="vue-input"
                  />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="vue-input" />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="vue-input"
                  />
                </div>
                <div>
                  <FieldLabel>Manager</FieldLabel>
                  <input value={manager} onChange={(e) => setManager(e.target.value)} className="vue-input" />
                </div>
                <div>
                  <FieldLabel>Default prep (minutes)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={defaultPrep}
                    onChange={(e) => setDefaultPrep(Number(e.target.value) || 0)}
                    className="vue-input"
                  />
                </div>
                <div>
                  <FieldLabel>Service charge (%)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                    className="vue-input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Dining sections</FieldLabel>
                  <input
                    value={sectionsCsv}
                    onChange={(e) => setSectionsCsv(e.target.value)}
                    placeholder="Indoor · Window, Outdoor · Patio, Terrace"
                    className="vue-input"
                  />
                  <div className="mt-1 text-[11px] text-ink-500">Comma-separated</div>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                    <input
                      type="checkbox"
                      checked={isLive}
                      onChange={(e) => setIsLive(e.target.checked)}
                      className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
                    />
                    Live — accept orders + show in branch selector
                  </label>
                </div>

                {error && (
                  <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60"
                >
                  {isEdit ? 'Save changes' : 'Create branch'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function BranchDeleteConfirm({
  branch,
  onClose,
  onConfirm,
}: {
  branch: BranchRow | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AnimatePresence>
      {branch && (
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
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start gap-3 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-base font-extrabold text-ink-900">Delete this branch?</div>
                  <p className="mt-1 text-[13px] text-ink-600">
                    "{branch.name}" and all of its tables ({branch._count?.tables ?? 0}) will be archived. The
                    branch's QR codes stop working immediately. Active orders must be closed first.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handle}
                  disabled={busy}
                  className="rounded-xl border border-rose-300 bg-rose-500 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
                >
                  {busy ? 'Deleting…' : 'Delete branch'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </div>
  );
}

/* ============================================================ */
/*  Section 4 · Branding & QR menu                              */
/* ============================================================ */

function BrandingSection({ onChange }: { onChange: () => void }) {
  const settings = settingsStore.use();
  const branches = branchesStore.use();
  const activeBranch = branches.list.find((b) => b.id === branches.activeId) ?? null;
  const t = settings.tenant;

  const [color, setColor] = useState('#EC1B7C');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [tagline, setTagline] = useState('From counter to kitchen, in one tap.');
  const [showAllergens, setShowAllergens] = useState(true);
  const [showCalories, setShowCalories] = useState(false);
  const [showVeg, setShowVeg] = useState(true);
  const [tipsEnabled, setTipsEnabled] = useState(true);

  useEffect(() => {
    if (!t) return;
    setColor(t.brandColor ?? '#EC1B7C');
    setTheme(t.brandTheme ?? 'light');
  }, [t]);

  const publicLink = activeBranch
    ? `https://menu.vuedine.com/m/${activeBranch.qrSlug}`
    : 'https://menu.vuedine.com';

  const saveBranding = async () => {
    const updated = await settingsApi.updateBranding({ brandColor: color, brandTheme: theme });
    settingsStore.setTenant(updated); // applies the CSS brand color live
  };

  return (
    <>
      <Card title="Brand identity" desc="Used across QR menus, receipts and emails.">
        <Row label="Logo" hint="Square logo · transparent background recommended">
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-300 bg-ink-50">
              {t?.logoUrl ? (
                <img src={t.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <Sparkles className="h-5 w-5 text-ink-400" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <LogoUploadButton />
              {t?.logoUrl && (
                <button
                  onClick={async () => {
                    const updated = await settingsApi.updateBranding({ logoUrl: null });
                    settingsStore.setTenant(updated);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-rose-200 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </Row>
        <Row label="Brand color" hint="Buttons, links and accents on QR menu">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={(e) => { setColor(e.target.value); onChange(); }}
                className="h-10 w-14 cursor-pointer rounded-xl border border-ink-200 bg-white p-1"
              />
            </div>
            <Input value={color.toUpperCase()} onChange={(v) => { setColor(v); onChange(); }} />
            <div className="flex gap-1">
              {['#EC1B7C', '#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#0F172A'].map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); onChange(); }}
                  style={{ background: c }}
                  className={cn(
                    'h-7 w-7 rounded-lg ring-2 transition',
                    color.toLowerCase() === c.toLowerCase() ? 'ring-brand-500' : 'ring-transparent',
                  )}
                />
              ))}
            </div>
          </div>
        </Row>
        <Row label="Menu theme">
          <Segmented
            value={theme}
            onChange={(v) => { setTheme(v); onChange(); }}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row label="Tagline" hint="Shows under the logo on the QR menu">
          <Input value={tagline} onChange={(v) => { setTagline(v); onChange(); }} />
        </Row>
        <div className="flex justify-end pt-1">
          <SaveButton onSave={saveBranding} idle="Save branding" />
        </div>
      </Card>

      <Card title="QR menu options" desc="Behaviour for guests scanning the QR.">
        <Row label="Show veg / non-veg dot">
          <Switch checked={showVeg} onChange={(v) => { setShowVeg(v); onChange(); }} label={showVeg ? 'Visible' : 'Hidden'} />
        </Row>
        <Row label="Show allergen badges">
          <Switch checked={showAllergens} onChange={(v) => { setShowAllergens(v); onChange(); }} label={showAllergens ? 'Visible' : 'Hidden'} />
        </Row>
        <Row label="Show calorie info">
          <Switch checked={showCalories} onChange={(v) => { setShowCalories(v); onChange(); }} label={showCalories ? 'Visible' : 'Hidden'} />
        </Row>
        <Row label="Allow tips" hint="Show a tip selector on payment">
          <Switch checked={tipsEnabled} onChange={(v) => { setTipsEnabled(v); onChange(); }} label={tipsEnabled ? 'Enabled' : 'Disabled'} />
        </Row>
        <Row label="Public QR link" hint="Share this link, also available via QR code">
          <Input value={publicLink} copyable />
        </Row>
      </Card>
    </>
  );
}

/** Logo uploader — presigned-URL upload via the settings branding endpoint. */
function LogoUploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) {
      setErr('PNG, JPEG, SVG or WebP only');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Max 2 MB');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Inline data URL keeps the demo self-contained without S3 wiring;
      // the branding endpoint accepts any URL string.
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const updated = await settingsApi.updateBranding({ logoUrl: dataUrl.slice(0, 480) });
      settingsStore.setTenant(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? 'Uploading…' : 'Upload'}
      </button>
      {err && <span className="text-[11px] font-semibold text-rose-600">{err}</span>}
    </>
  );
}

/* ============================================================ */
/*  Section 5 · Localization                                    */
/* ============================================================ */

function LocalizationSection({ onChange }: { onChange: () => void }) {
  const settings = settingsStore.use();
  const t = settings.tenant;

  const [currency, setCurrency] = useState('INR');
  const [position, setPosition] = useState<'before' | 'after'>('before');
  const [language, setLanguage] = useState('en-IN');
  const [dateFmt, setDateFmt] = useState('DD-MM-YYYY');
  const [timeFmt, setTimeFmt] = useState<'12h' | '24h'>('24h');
  const [firstDay, setFirstDay] = useState<'mon' | 'sun'>('mon');

  useEffect(() => {
    if (!t) return;
    setCurrency(t.currency ?? 'INR');
    setLanguage(t.locale ?? 'en-IN');
    setFirstDay(t.weekStart === 'SUNDAY' ? 'sun' : 'mon');
  }, [t]);

  const handle = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    onChange();
  };

  const save = async () => {
    const updated = await settingsApi.updateLocalization({
      currency,
      locale: language,
      numberLocale: language,
      weekStart: firstDay === 'sun' ? 'SUNDAY' : 'MONDAY',
    });
    settingsStore.setTenant(updated);
  };

  return (
    <Card title="Locale & formats" desc="How numbers, dates and money are displayed everywhere.">
      <Row label="Currency">
        <div className="flex flex-wrap gap-2">
          <Select
            value={currency}
            onChange={handle(setCurrency)}
            options={[
              { value: 'INR', label: '₹ Indian Rupee · INR' },
              { value: 'USD', label: '$ US Dollar · USD' },
              { value: 'AED', label: 'د.إ UAE Dirham · AED' },
              { value: 'GBP', label: '£ British Pound · GBP' },
              { value: 'SGD', label: 'S$ Singapore Dollar · SGD' },
            ]}
          />
        </div>
      </Row>
      <Row label="Symbol position">
        <Segmented
          value={position}
          onChange={handle(setPosition)}
          options={[
            { value: 'before', label: 'Before · ₹100' },
            { value: 'after', label: 'After · 100₹' },
          ]}
        />
      </Row>
      <Row label="Language">
        <Select
          value={language}
          onChange={handle(setLanguage)}
          options={[
            { value: 'en-IN', label: 'English (India)' },
            { value: 'en-US', label: 'English (US)' },
            { value: 'hi-IN', label: 'हिन्दी' },
            { value: 'mr-IN', label: 'मराठी' },
            { value: 'ta-IN', label: 'தமிழ்' },
            { value: 'ar-AE', label: 'العربية' },
          ]}
        />
      </Row>
      <Row label="Date format">
        <Segmented
          value={dateFmt}
          onChange={handle(setDateFmt)}
          options={[
            { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
            { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ]}
        />
      </Row>
      <Row label="Time format">
        <Segmented
          value={timeFmt}
          onChange={handle(setTimeFmt)}
          options={[
            { value: '24h', label: '24-hour' },
            { value: '12h', label: '12-hour' },
          ]}
        />
      </Row>
      <Row label="Week starts on">
        <Segmented
          value={firstDay}
          onChange={handle(setFirstDay)}
          options={[
            { value: 'mon', label: 'Monday' },
            { value: 'sun', label: 'Sunday' },
          ]}
        />
      </Row>
      <div className="flex justify-end pt-1">
        <SaveButton onSave={save} idle="Save locale" />
      </div>
    </Card>
  );
}

/* ============================================================ */
/*  Section 6 · Taxes & Bills                                   */
/* ============================================================ */

function TaxesSection({ onChange }: { onChange: () => void }) {
  const settings = settingsStore.use();
  const t = settings.tenant;

  const [gstin, setGstin] = useState('');
  const [taxMode, setTaxMode] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [igst, setIgst] = useState(false);
  const [serviceCharge, setServiceCharge] = useState(true);
  const [scPct, setScPct] = useState('5');
  const [roundOff, setRoundOff] = useState(true);
  const [billPrefix, setBillPrefix] = useState('VUE');
  const [billStart, setBillStart] = useState('1001');
  const [footer, setFooter] = useState('Thank you · come back soon!');
  const [logoOnReceipt, setLogoOnReceipt] = useState(true);

  const [slabs, setSlabs] = useState<TaxSlab[]>([]);
  const [newSlabName, setNewSlabName] = useState('');
  const [newSlabRate, setNewSlabRate] = useState('');

  useEffect(() => {
    if (!t) return;
    setGstin(t.gstin ?? '');
    setTaxMode(t.taxInclusive ? 'inclusive' : 'exclusive');
    setIgst(t.igstInterState);
    setServiceCharge(t.serviceChargeEnabled);
    setScPct(String(t.serviceChargePct ?? 0));
    setRoundOff(t.roundOff);
    setBillPrefix(t.invoicePrefix ?? 'INV');
    setBillStart(String(t.invoiceSequence ?? 1));
    setFooter(t.receiptFooter ?? '');
    setLogoOnReceipt(t.logoOnReceipt);
  }, [t]);

  useEffect(() => {
    setSlabs(settings.taxSlabs);
  }, [settings.taxSlabs]);

  const saveTax = async () => {
    const updated = await settingsApi.updateTenant({
      gstin: gstin || null,
      taxInclusive: taxMode === 'inclusive',
      igstInterState: igst,
      serviceChargeEnabled: serviceCharge,
      serviceChargePct: Number(scPct) || 0,
      roundOff,
      invoicePrefix: billPrefix,
      invoiceSequence: Number(billStart) || 1,
      receiptFooter: footer || null,
      logoOnReceipt,
    });
    settingsStore.setTenant(updated);
  };

  const addSlab = async () => {
    const rate = Number(newSlabRate);
    if (!newSlabName.trim() || !Number.isFinite(rate)) return;
    const created = await settingsApi.createTaxSlab({ name: newSlabName.trim(), rate });
    const next = [...slabs, created];
    setSlabs(next);
    settingsStore.setTaxSlabs(next);
    setNewSlabName('');
    setNewSlabRate('');
  };

  const setDefaultSlab = async (id: string) => {
    const updated = await settingsApi.updateTaxSlab(id, { isDefault: true });
    const next = slabs.map((s) => ({ ...s, isDefault: s.id === updated.id }));
    setSlabs(next);
    settingsStore.setTaxSlabs(next);
  };

  const deleteSlab = async (id: string) => {
    await settingsApi.deleteTaxSlab(id);
    const next = slabs.filter((s) => s.id !== id);
    setSlabs(next);
    settingsStore.setTaxSlabs(next);
  };

  const handleString = (set: (v: string) => void) => (v: string) => {
    set(v);
    onChange();
  };

  return (
    <>
      <Card title="GST / VAT" desc="Compliant tax handling on every bill.">
        <Row label="GSTIN" hint="Used on every invoice">
          <Input value={gstin} onChange={handleString(setGstin)} />
        </Row>
        <Row label="Tax mode">
          <Segmented
            value={taxMode}
            onChange={(v) => { setTaxMode(v); onChange(); }}
            options={[
              { value: 'exclusive', label: 'Exclusive (added)' },
              { value: 'inclusive', label: 'Inclusive (in price)' },
            ]}
          />
        </Row>
        <Row label="IGST for inter-state" hint="Apply IGST instead of CGST + SGST when shipping out of state">
          <Switch checked={igst} onChange={(v) => { setIgst(v); onChange(); }} label={igst ? 'Enabled' : 'Disabled'} />
        </Row>
        <Row label="Tax slabs" hint="The default slab applies when an item has no slab of its own">
          <div className="w-full space-y-2">
            {slabs.length === 0 && <div className="text-[12px] text-ink-500">No slabs yet — add one below.</div>}
            {slabs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white p-2.5">
                <span className="text-[13px] font-bold text-ink-900">{s.name}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700">{s.rate}%</span>
                {s.isDefault ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-brand-200">Default</span>
                ) : (
                  <button onClick={() => setDefaultSlab(s.id)} className="text-[11px] font-bold text-ink-500 hover:text-brand-600">
                    Set default
                  </button>
                )}
                <button
                  onClick={() => deleteSlab(s.id)}
                  className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:border-rose-200 hover:text-rose-600"
                  aria-label="Delete slab"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={newSlabName}
                onChange={(e) => setNewSlabName(e.target.value)}
                placeholder="GST 5%"
                className="h-9 flex-1 rounded-lg border border-ink-200 bg-white px-2 text-[12px] font-semibold text-ink-800 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
              />
              <input
                value={newSlabRate}
                onChange={(e) => setNewSlabRate(e.target.value)}
                placeholder="5"
                inputMode="decimal"
                className="h-9 w-20 rounded-lg border border-ink-200 bg-white px-2 text-[12px] font-semibold text-ink-800 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
              />
              <span className="text-[12px] font-bold text-ink-400">%</span>
              <button
                onClick={addSlab}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        </Row>
      </Card>

      <Card title="Service charge & round-off">
        <Row label="Service charge">
          <Switch checked={serviceCharge} onChange={(v) => { setServiceCharge(v); onChange(); }} />
        </Row>
        <Row label="Service charge %" hint="Disabled when service charge is off">
          <Input
            value={scPct}
            onChange={(v) => { setScPct(v); onChange(); }}
            suffix={<span className="text-[12px] font-bold text-ink-400">%</span>}
          />
        </Row>
        <Row label="Round-off totals" hint="Round to nearest rupee on the final bill">
          <Switch checked={roundOff} onChange={(v) => { setRoundOff(v); onChange(); }} label={roundOff ? 'On' : 'Off'} />
        </Row>
      </Card>

      <Card title="Invoice format" desc="How your bill numbers and footer print.">
        <Row label="Bill prefix">
          <Input value={billPrefix} onChange={handleString(setBillPrefix)} />
        </Row>
        <Row label="Starting number">
          <Input value={billStart} onChange={handleString(setBillStart)} />
        </Row>
        <Row label="Footer text" hint="Printed at the bottom of every receipt">
          <Textarea value={footer} onChange={handleString(setFooter)} rows={2} />
        </Row>
        <Row label="Logo on receipt">
          <Switch checked={logoOnReceipt} onChange={(v) => { setLogoOnReceipt(v); onChange(); }} label={logoOnReceipt ? 'Show' : 'Hide'} />
        </Row>
        <div className="flex justify-end pt-1">
          <SaveButton onSave={saveTax} idle="Save tax & bills" />
        </div>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 7 · Payments                                        */
/* ============================================================ */

function PaymentsSection({ onChange }: { onChange: () => void }) {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    paymentSettingsApi
      .get()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load payment settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (patch: Partial<PaymentSettings>) => {
    setSaving(true);
    setError(null);
    try {
      const next = await paymentSettingsApi.update(patch);
      setSettings(next);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (k: keyof PaymentSettings) => {
    if (!settings) return;
    persist({ [k]: !settings[k as keyof PaymentSettings] });
  };

  if (loading || !settings) {
    return (
      <Card title="Payment methods" desc="Loading…">
        <div className="py-6 text-center text-[12px] font-semibold text-ink-500">
          Loading payment settings…
        </div>
      </Card>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
          {error}
        </div>
      )}
      {saving && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-bold text-ink-600">
          <span className="h-2 w-2 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          Saving…
        </div>
      )}

      <Card title="Payment methods" desc="Turn methods on or off — applies everywhere instantly.">
        <Row label="Accept">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { k: 'cashEnabled', label: 'Cash', icon: IndianRupee, sub: 'Counter & dine-in' },
              { k: 'cardEnabled', label: 'Card', icon: CreditCard, sub: 'Visa · Mastercard · RuPay · Amex' },
              { k: 'upiEnabled', label: 'UPI', icon: Smartphone, sub: 'GPay · PhonePe · Paytm · BHIM' },
              { k: 'walletEnabled', label: 'Wallet', icon: Wallet, sub: 'Paytm · Mobikwik · Freecharge' },
              { k: 'onlineEnabled', label: 'Online checkout', icon: Wallet, sub: 'For QR & online orders' },
              { k: 'loyaltyEnabled', label: 'Loyalty points', icon: Sparkles, sub: 'Redeem at counter' },
              { k: 'payOnDeliveryEnabled', label: 'Pay on delivery', icon: Truck, sub: 'Cash or UPI on doorstep' },
            ].map((it) => {
              const Icon = it.icon;
              const on = Boolean(settings[it.k as keyof PaymentSettings]);
              return (
                <div
                  key={it.k}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition',
                    on ? 'border-brand-200 bg-brand-50/40' : 'border-ink-200 bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg ring-1',
                      on ? 'bg-brand-500 text-white ring-brand-500' : 'bg-ink-50 text-ink-500 ring-ink-100',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ink-900">{it.label}</div>
                    <div className="text-[11px] text-ink-500">{it.sub}</div>
                  </div>
                  <Switch checked={on} onChange={() => toggle(it.k as keyof PaymentSettings)} />
                </div>
              );
            })}
          </div>
        </Row>
      </Card>

      <Card
        title="Razorpay"
        desc="Primary payment gateway for online orders, QR pay and links."
        action={
          settings.razorpayKeyId ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <Check className="h-3 w-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Not configured
            </span>
          )
        }
      >
        <Row label="Key ID">
          <Input
            value={settings.razorpayKeyId ?? ''}
            onChange={(v) => persist({ razorpayKeyId: v })}
            copyable
          />
        </Row>
        <Row label="Key Secret" hint="Keep this safe — anyone with it can capture payments">
          <Input
            value={secretInput || (settings.razorpayKeySecret ?? '')}
            onChange={(v) => setSecretInput(v)}
            type={showKey ? 'text' : 'password'}
            suffix={
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                {secretInput && (
                  <button
                    type="button"
                    onClick={() => {
                      persist({ razorpayKeySecret: secretInput });
                      setSecretInput('');
                    }}
                    className="rounded-md bg-brand-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-brand-600"
                  >
                    Save
                  </button>
                )}
              </div>
            }
          />
        </Row>
        <Row label="Webhook URL" hint="Add this to Razorpay dashboard for real-time settlement events">
          <Input
            value={`${typeof window !== 'undefined' ? window.location.origin.replace(/^https?:\/\/[^/]+/, 'https://api.vuedine.com') : 'https://api.vuedine.com'}/v1/webhooks/razorpay`}
            copyable
          />
        </Row>
        <Row label="Auto-capture" hint="Capture immediately on success (recommended for QR / takeaway)">
          <Switch
            checked={settings.autoCapture}
            onChange={(v) => persist({ autoCapture: v })}
            label={settings.autoCapture ? 'On' : 'Manual'}
          />
        </Row>
      </Card>

      <Card title="Settlement & policy">
        <Row label="Settlement schedule">
          <Select
            value={settings.settlementSchedule}
            onChange={(v) => persist({ settlementSchedule: v as PaymentSettings['settlementSchedule'] })}
            options={[
              { value: 't-0', label: 'Same day (T+0)' },
              { value: 't-1', label: 'Next business day (T+1)' },
              { value: 't-2', label: 'T+2 banking days' },
            ]}
          />
        </Row>
        <Row label="Allow partial payments" hint="Customers can pay multiple times until total is settled">
          <Switch
            checked={settings.partialPayments}
            onChange={(v) => persist({ partialPayments: v })}
            label={settings.partialPayments ? 'On' : 'Off'}
          />
        </Row>
        <Row label="Refund policy">
          <Select
            value={settings.refundPolicy}
            onChange={(v) => persist({ refundPolicy: v as PaymentSettings['refundPolicy'] })}
            options={[
              { value: 'full', label: 'Full refund (auto-credit)' },
              { value: 'partial', label: 'Partial refund only · manager approval' },
              { value: 'none', label: 'No refunds (offer credit)' },
            ]}
          />
        </Row>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 8 · Hardware                                        */
/* ============================================================ */

function HardwareSection({ onChange }: { onChange: () => void }) {
  void onChange;
  const branches = branchesStore.use();
  const activeBranch = branches.list.find((b) => b.id === branches.activeId) ?? null;

  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pairToken, setPairToken] = useState<{ label: string; token: string } | null>(null);

  const refresh = async (branchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await settingsApi.listHardware(branchId ? { branchId } : {});
      setDevices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(activeBranch?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranch?.id]);

  const onTest = async (d: HardwareDevice) => {
    try {
      const updated = await settingsApi.heartbeatHardware(d.id);
      setDevices((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const onPair = async (d: HardwareDevice) => {
    try {
      const updated = await settingsApi.pairHardware(d.id);
      setDevices((cur) => cur.map((x) => (x.id === updated.id ? { ...updated, pairingToken: undefined } : x)));
      if (updated.pairingToken) setPairToken({ label: updated.label, token: updated.pairingToken });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pair failed');
    }
  };

  const onDelete = async (d: HardwareDevice) => {
    try {
      await settingsApi.deleteHardware(d.id);
      setDevices((cur) => cur.filter((x) => x.id !== d.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const printers = devices.filter((d) => d.type === 'RECEIPT_PRINTER' || d.type === 'KOT_PRINTER');
  const peripherals = devices.filter((d) => ['CASH_DRAWER', 'CUSTOMER_DISPLAY', 'WEIGHING_SCALE'].includes(d.type));
  const displays = devices.filter((d) => d.type === 'KDS_DISPLAY' || d.type === 'OSS_DISPLAY');

  const TYPE_LABEL: Record<HardwareType, string> = {
    RECEIPT_PRINTER: 'Bill',
    KOT_PRINTER: 'Kitchen',
    KDS_DISPLAY: 'KDS',
    OSS_DISPLAY: 'OSS',
    CASH_DRAWER: 'Drawer',
    CUSTOMER_DISPLAY: 'Display',
    WEIGHING_SCALE: 'Scale',
  };

  if (!activeBranch) {
    return (
      <Card title="Hardware">
        <div className="py-6 text-center text-[13px] text-ink-500">Select a branch to manage its hardware.</div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Printers"
        desc={`ESC/POS thermal and dot-matrix printers · ${activeBranch.name}`}
        action={
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add device
          </button>
        }
      >
        {error && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
            {error} <button onClick={() => refresh(activeBranch.id)} className="underline">Retry</button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          </div>
        ) : printers.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-ink-500">No printers yet.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {printers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Printer className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-ink-900">{p.label}</div>
                  <div className="text-[11px] text-ink-500">{[p.model, p.ip].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', p.online ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', p.online ? 'bg-emerald-500' : 'bg-rose-500')} />
                  {p.online ? 'Online' : 'Offline'}
                </span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-700">{TYPE_LABEL[p.type]}</span>
                <button onClick={() => onPair(p)} className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">Pair</button>
                <button onClick={() => onTest(p)} className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">Test</button>
                <button onClick={() => onDelete(p)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:border-rose-200 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Cash drawer & devices">
        {peripherals.length === 0 ? (
          <div className="py-2 text-[13px] text-ink-500">No peripherals registered. Use “Add device”.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {peripherals.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cool-50 text-cool-600 ring-1 ring-cool-100"><Package className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-ink-900">{d.label}</div>
                  <div className="text-[11px] text-ink-500">{TYPE_LABEL[d.type]}</div>
                </div>
                <Switch checked={d.active} onChange={async (v) => {
                  const updated = await settingsApi.updateHardware(d.id, { active: v });
                  setDevices((cur) => cur.map((x) => (x.id === updated.id ? updated : x)));
                }} label={d.active ? 'On' : 'Off'} />
                <button onClick={() => onDelete(d)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:border-rose-200 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="KDS screens" desc="Each station can have its own screen.">
        {displays.length === 0 ? (
          <div className="py-2 text-[13px] text-ink-500">No KDS/OSS displays registered yet.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {displays.map((k) => (
              <li key={k.id} className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cool-50 text-cool-600 ring-1 ring-cool-100"><Monitor className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-ink-900">{k.label}</div>
                  <div className="text-[11px] text-ink-500">{k.station ? `${k.station} station` : TYPE_LABEL[k.type]}</div>
                </div>
                <Link to="/dashboard/kds" className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">Open KDS</Link>
                <button onClick={() => onDelete(k)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:border-rose-200 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <HardwareAddModal
        open={adding}
        branchId={activeBranch.id}
        onClose={() => setAdding(false)}
        onCreated={(d) => setDevices((cur) => [...cur, d])}
      />

      <PairTokenModal token={pairToken} onClose={() => setPairToken(null)} />
    </>
  );
}

function HardwareAddModal({
  open,
  branchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  branchId: string;
  onClose: () => void;
  onCreated: (d: HardwareDevice) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<HardwareType>('RECEIPT_PRINTER');
  const [model, setModel] = useState('');
  const [ip, setIp] = useState('');
  const [station, setStation] = useState<'HOT' | 'COLD' | 'BAR' | 'DESSERT' | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(''); setType('RECEIPT_PRINTER'); setModel(''); setIp(''); setStation(''); setError(null);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const created = await settingsApi.createHardware({
        branchId, type, label: label.trim(),
        model: model.trim() || null,
        ip: ip.trim() || null,
        station: type === 'KOT_PRINTER' && station ? station : null,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add device');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2">
            <form onSubmit={submit} className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div className="text-lg font-extrabold text-ink-900">Add hardware device</div>
                <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <FieldLabel required>Label</FieldLabel>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Counter · Bill printer" className="vue-input" />
                </div>
                <div>
                  <FieldLabel required>Type</FieldLabel>
                  <select value={type} onChange={(e) => setType(e.target.value as HardwareType)} className="vue-input">
                    <option value="RECEIPT_PRINTER">Receipt printer</option>
                    <option value="KOT_PRINTER">Kitchen (KOT) printer</option>
                    <option value="KDS_DISPLAY">KDS display</option>
                    <option value="OSS_DISPLAY">OSS display</option>
                    <option value="CASH_DRAWER">Cash drawer</option>
                    <option value="CUSTOMER_DISPLAY">Customer display</option>
                    <option value="WEIGHING_SCALE">Weighing scale</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Model</FieldLabel>
                    <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Epson TM-T82" className="vue-input" />
                  </div>
                  <div>
                    <FieldLabel>IP address</FieldLabel>
                    <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.41" className="vue-input" />
                  </div>
                </div>
                {type === 'KOT_PRINTER' && (
                  <div>
                    <FieldLabel>Station</FieldLabel>
                    <select value={station} onChange={(e) => setStation(e.target.value as typeof station)} className="vue-input">
                      <option value="">—</option>
                      <option value="HOT">Hot</option>
                      <option value="COLD">Cold</option>
                      <option value="BAR">Bar</option>
                      <option value="DESSERT">Dessert</option>
                    </select>
                  </div>
                )}
                {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{error}</div>}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                <button type="button" onClick={onClose} className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">Cancel</button>
                <button type="submit" disabled={busy} className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60">{busy ? 'Adding…' : 'Add device'}</button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PairTokenModal({ token, onClose }: { token: { label: string; token: string } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {token && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2">
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="p-5">
                <div className="text-base font-extrabold text-ink-900">Pairing token · {token.label}</div>
                <p className="mt-1 text-[13px] text-ink-600">Enter this token on the device to pair it. For security it is shown only once and rotates on every pair.</p>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 p-3">
                  <code className="flex-1 break-all font-mono text-[13px] font-bold text-ink-900">{token.token}</code>
                  <button onClick={() => navigator.clipboard?.writeText(token.token)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-label="Copy"><Copy className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                <button type="button" onClick={onClose} className="btn-primary shine rounded-xl px-4 py-2 text-[13px] font-bold">Done</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Section 9 · Notifications                                   */
/* ============================================================ */

function NotificationsSection({ onChange }: { onChange: () => void }) {
  type Channel = 'sound' | 'push' | 'email' | 'sms';
  type Row = Record<Channel, boolean>;
  const defaultMatrix = {
    newOrder: { sound: true, push: true, email: false, sms: false } as Row,
    lowStock: { sound: false, push: true, email: true, sms: false } as Row,
    paymentFailed: { sound: false, push: true, email: true, sms: true } as Row,
    review: { sound: false, push: true, email: false, sms: false } as Row,
    dayClose: { sound: false, push: false, email: true, sms: false } as Row,
  };
  const [matrix, setMatrix] = useState(defaultMatrix);
  const [loaded, setLoaded] = useState(false);

  // Hydrate from saved preferences (tenant-wide defaults).
  useEffect(() => {
    let cancelled = false;
    settingsApi
      .listNotificationPrefs()
      .then((prefs: NotificationPreference[]) => {
        if (cancelled || prefs.length === 0) {
          setLoaded(true);
          return;
        }
        setMatrix((cur) => {
          const next = JSON.parse(JSON.stringify(cur)) as typeof cur;
          for (const p of prefs) {
            const ev = p.event as keyof typeof next;
            if (next[ev] && p.channel in next[ev]) next[ev][p.channel as Channel] = p.enabled;
          }
          return next;
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (k: keyof typeof matrix, ch: Channel) => {
    setMatrix((m) => ({ ...m, [k]: { ...m[k], [ch]: !m[k][ch] } }));
    onChange();
  };

  const save = async () => {
    const prefs: { event: string; channel: Channel; enabled: boolean }[] = [];
    for (const [event, channels] of Object.entries(matrix)) {
      for (const [channel, enabled] of Object.entries(channels)) {
        prefs.push({ event, channel: channel as Channel, enabled });
      }
    }
    await settingsApi.bulkSetNotificationPrefs(prefs);
  };

  const rows: { key: keyof typeof matrix; label: string; desc: string }[] = [
    { key: 'newOrder', label: 'New order', desc: 'POS, QR, online · all channels' },
    { key: 'lowStock', label: 'Low stock', desc: 'When inventory hits threshold' },
    { key: 'paymentFailed', label: 'Payment failed', desc: 'Online or card decline' },
    { key: 'review', label: 'New customer review', desc: 'Google or in-app rating' },
    { key: 'dayClose', label: 'Day-end summary', desc: 'Sent at closing time' },
  ];

  return (
    <Card title="Alert preferences" desc="Pick where each event lands.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-ink-500">
              <th className="py-2 pr-4">Event</th>
              <th className="px-2">In-app</th>
              <th className="px-2">Push</th>
              <th className="px-2">Email</th>
              <th className="px-2">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-3 pr-4">
                  <div className="font-bold text-ink-900">{r.label}</div>
                  <div className="text-[11px] text-ink-500">{r.desc}</div>
                </td>
                {(['sound', 'push', 'email', 'sms'] as const).map((ch) => (
                  <td key={ch} className="px-2 py-3">
                    <Switch checked={matrix[r.key][ch]} onChange={() => toggle(r.key, ch)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end">
        <SaveButton onSave={save} idle="Save preferences" disabled={!loaded} />
      </div>
    </Card>
  );
}

/* ============================================================ */
/*  Section 11 · Security                                       */
/* ============================================================ */

function SecuritySection({ onChange }: { onChange: () => void }) {
  const [twofa, setTwofa] = useState(true);
  const [pinAuth, setPinAuth] = useState(true);
  const [allowlist, setAllowlist] = useState(false);
  const [autoLogout, setAutoLogout] = useState('30');
  const [showSessions, setShowSessions] = useState(true);

  return (
    <>
      <Card title="Authentication" desc="How you and your team sign in.">
        <Row label="2-factor auth" hint="OTP via authenticator app or SMS — required on Owner & Admin">
          <Switch checked={twofa} onChange={(v) => { setTwofa(v); onChange(); }} label={twofa ? 'Enforced' : 'Optional'} />
        </Row>
        <Row label="PIN-based POS login" hint="Quick 4-digit PIN for waiters and cashiers">
          <Switch checked={pinAuth} onChange={(v) => { setPinAuth(v); onChange(); }} label={pinAuth ? 'On' : 'Off'} />
        </Row>
        <Row label="Auto-logout" hint="Idle session timeout in minutes">
          <Select
            value={autoLogout}
            onChange={(v) => { setAutoLogout(v); onChange(); }}
            options={[
              { value: '5', label: '5 minutes' },
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes' },
              { value: '60', label: '1 hour' },
              { value: '0', label: 'Never · risky' },
            ]}
          />
        </Row>
        <Row label="IP allowlist" hint="Limit admin login to specific IPs — Enterprise feature">
          <Switch checked={allowlist} onChange={(v) => { setAllowlist(v); onChange(); }} label={allowlist ? 'Enabled' : 'Disabled'} />
        </Row>
        <Row label="Single Sign-On (SAML)">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
            <Key className="h-3.5 w-3.5" />
            Configure SSO
          </button>
        </Row>
      </Card>

      <Card
        title="Active sessions"
        desc="Devices currently signed in to your account."
        action={
          <button
            onClick={() => setShowSessions((v) => !v)}
            className="text-[12px] font-bold text-brand-600 hover:text-brand-700"
          >
            {showSessions ? 'Hide' : 'Show'}
          </button>
        }
      >
        {showSessions && (
          <ul className="grid grid-cols-1 gap-2">
            {[
              { device: 'Chrome on macOS', loc: 'Mumbai · 49.207.x.x', current: true, when: 'Now' },
              { device: 'Safari on iPad', loc: 'Mumbai · 49.207.x.x', when: '12 min ago' },
              { device: 'Chrome on Windows', loc: 'Pune · 103.51.x.x', when: '2 days ago' },
            ].map((s) => (
              <li
                key={s.device + s.when}
                className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cool-50 text-cool-600 ring-1 ring-cool-100">
                  <Laptop className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink-900">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-700">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {s.loc} · {s.when}
                  </div>
                </div>
                {!s.current && (
                  <button className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500">
                    <LogOut className="h-3 w-3" />
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Audit log" desc="Every change to settings, prices and roles is recorded.">
        <ul className="space-y-1.5">
          {[
            { who: 'John Doe', what: 'Updated tax slab Margherita', when: '12 min ago' },
            { who: 'Aman K.', what: 'Voided bill #1284', when: '34 min ago' },
            { who: 'System', what: 'Auto-settled UPI ₹38.40', when: '1 hr ago' },
            { who: 'Nikita J.', what: 'Closed cash register · ₹14,800', when: '8 hr ago' },
          ].map((l, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-3 text-[12px]"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-warm-500 text-[10px] font-bold text-white">
                  {l.who
                    .split(' ')
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')}
                </span>
                <div>
                  <span className="font-bold text-ink-900">{l.who}</span>
                  <span className="text-ink-500"> · {l.what}</span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-ink-400">{l.when}</span>
            </li>
          ))}
        </ul>
        <button className="text-[12px] font-bold text-brand-600 hover:text-brand-700">
          View full audit log →
        </button>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 12 · Data & privacy                                 */
/* ============================================================ */

function DataSection({ onChange }: { onChange: () => void }) {
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [anonBusy, setAnonBusy] = useState(false);
  const [anonMsg, setAnonMsg] = useState<string | null>(null);

  const runExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await settingsApi.exportData();
      setExportMsg(res.message ?? 'Export queued.');
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const runAnonymize = async () => {
    if (!window.confirm('Anonymize this workspace? This scrubs tenant + customer PII (revenue rows are kept). This cannot be undone.')) {
      return;
    }
    setAnonBusy(true);
    setAnonMsg(null);
    try {
      await settingsApi.anonymizeTenant();
      setAnonMsg('Workspace anonymized.');
    } catch (e) {
      setAnonMsg(e instanceof Error ? e.message : 'Anonymize failed');
    } finally {
      setAnonBusy(false);
    }
  };

  return (
    <>
      <Card title="Backups">
        <Row label="Automatic backup">
          <Switch checked={true} onChange={() => onChange()} label="Daily · 03:00" />
        </Row>
        <Row label="Last backup">
          <div className="text-[13px] font-bold text-ink-900">Today · 03:00 IST · 142 MB</div>
        </Row>
        <Row label="Retention">
          <Select
            value="365"
            onChange={() => onChange()}
            options={[
              { value: '90', label: '90 days' },
              { value: '180', label: '180 days' },
              { value: '365', label: '1 year' },
              { value: '730', label: '2 years' },
            ]}
          />
        </Row>
      </Card>

      <Card title="Export" desc="Builds a full account archive and emails the owner a secure link.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { l: 'Orders & sales (CSV)', icon: Receipt },
            { l: 'Items & menu (CSV)', icon: Package },
            { l: 'Customers (CSV)', icon: Users },
            { l: 'Inventory snapshot (CSV)', icon: Package },
            { l: 'Full account archive (.zip)', icon: Database },
          ].map((e) => {
            const Icon = e.icon;
            return (
              <button
                key={e.l}
                onClick={runExport}
                disabled={exporting}
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-white p-3 transition hover:border-brand-200 disabled:opacity-60"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-bold text-ink-900">{e.l}</span>
                </div>
                <Download className="h-4 w-4 text-ink-400" />
              </button>
            );
          })}
        </div>
        {exportMsg && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
            {exportMsg}
          </div>
        )}
      </Card>

      <Card title="Customer data" desc="GDPR / DPDP-style controls.">
        <Row label="Anonymize after">
          <Select
            value="730"
            onChange={() => onChange()}
            options={[
              { value: 'never', label: 'Never · keep forever' },
              { value: '365', label: '1 year of inactivity' },
              { value: '730', label: '2 years of inactivity' },
            ]}
          />
        </Row>
        <Row label="Right-to-erasure" hint="Allow customers to request deletion via QR menu">
          <Switch checked={true} onChange={() => onChange()} label="Enabled" />
        </Row>
        <Row label="Cookie banner on QR menu">
          <Switch checked={false} onChange={() => onChange()} label="Off" />
        </Row>
        <Row label="Anonymize workspace now" hint="Scrub tenant + customer PII (revenue rows retained)">
          <div className="flex items-center gap-3">
            <button
              onClick={runAnonymize}
              disabled={anonBusy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {anonBusy ? 'Working…' : 'Anonymize'}
            </button>
            {anonMsg && <span className="text-[12px] font-semibold text-ink-600">{anonMsg}</span>}
          </div>
        </Row>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 13 · Subscription                                   */
/* ============================================================ */

function SubscriptionSection() {
  return (
    <>
      <Card title="Plan" desc="Switch any time — keep all your data.">
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-brand-700">
                Current plan
              </div>
              <div className="mt-1 text-2xl font-extrabold text-ink-900">Vuedine Growth</div>
              <div className="text-[12px] text-ink-600">Up to 3 outlets · Vuedine AI included</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-brand-600">₹1,999<span className="text-sm font-bold text-ink-500">/outlet/mo</span></div>
              <div className="text-[11px] text-ink-500">Billed yearly · −20%</div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-brand-200 border-t border-brand-200 sm:grid-cols-4">
            {[
              { l: 'Outlets', v: '3 / 3' },
              { l: 'Seats', v: '24 / 50' },
              { l: 'AI requests', v: '12.4k / 50k' },
              { l: 'Renews', v: '01 Jul 2026' },
            ].map((m) => (
              <div key={m.l} className="px-3 py-2 text-center sm:px-5 sm:py-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{m.l}</div>
                <div className="text-[13px] font-extrabold text-ink-900">{m.v}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-brand-200 bg-white p-4">
            <button className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold">
              Upgrade plan
            </button>
            <button className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
              Change to monthly
            </button>
            <button className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-bold text-ink-700 hover:border-rose-200 hover:text-rose-600">
              Cancel subscription
            </button>
          </div>
        </div>
      </Card>

      <Card title="Payment method">
        <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3">
          <span className="flex h-10 w-14 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-extrabold text-blue-700 ring-1 ring-blue-100">
            VISA
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink-900">•••• •••• •••• 4242</div>
            <div className="text-[11px] text-ink-500">Expires 09 / 2028 · billing@vuedine.demo</div>
          </div>
          <button className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
            Change
          </button>
        </div>
      </Card>

      <Card title="Invoices">
        <ul className="grid grid-cols-1 gap-1.5">
          {[
            { id: 'INV-2026-0521', date: '01 May 2026', amount: 1999 * 3, status: 'Paid' },
            { id: 'INV-2026-0421', date: '01 Apr 2026', amount: 1999 * 3, status: 'Paid' },
            { id: 'INV-2026-0321', date: '01 Mar 2026', amount: 1999 * 3, status: 'Paid' },
          ].map((iv) => (
            <li
              key={iv.id}
              className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-3"
            >
              <Receipt className="h-4 w-4 text-brand-500" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[13px] font-extrabold text-ink-900">{iv.id}</div>
                <div className="text-[11px] text-ink-500">{iv.date}</div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                {iv.status}
              </span>
              <div className="text-[13px] font-bold text-ink-900">₹{iv.amount.toLocaleString('en-IN')}</div>
              <button className="rounded-lg border border-ink-200 bg-white p-1.5 text-ink-400 hover:border-brand-300 hover:text-brand-700">
                <Download className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 14 · Developer                                      */
/* ============================================================ */

function DeveloperSection({ onChange }: { onChange: () => void }) {
  const [showLive, setShowLive] = useState(false);
  return (
    <>
      <Card title="API keys" desc="Use these to call Vuedine APIs from your own apps.">
        <Row label="Test mode key">
          <Input value="vd_test_4LGYzKQ8yV9pXrBn7sM2cE3T6dHbA" copyable />
        </Row>
        <Row label="Live mode key" hint="Treat like a password">
          <Input
            value={showLive ? 'vd_live_pK9R3xWv2QcTbHnYfMzL5sJ8aE6dG' : '••••••••••••••••••••••••••••••'}
            type={showLive ? 'text' : 'password'}
            suffix={
              <button
                type="button"
                onClick={() => setShowLive((v) => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                {showLive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            }
          />
        </Row>
        <Row label="Rotate keys">
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-rose-200 hover:text-rose-600">
            <RefreshCcw className="h-3.5 w-3.5" />
            Rotate live key
          </button>
        </Row>
      </Card>

      <Card
        title="Webhooks"
        desc="Receive real-time events from Vuedine."
        action={
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[12px] font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700">
            <Plus className="h-3.5 w-3.5" />
            Add endpoint
          </button>
        }
      >
        <ul className="space-y-2">
          {[
            { url: 'https://api.acme.com/vuedine/orders', events: ['order.created', 'order.updated'], status: 'OK' },
            { url: 'https://accounting.acme.com/hooks', events: ['payment.captured'], status: 'OK' },
            { url: 'https://kitchen.acme.com/in', events: ['kds.bumped'], status: 'Failing' },
          ].map((w) => (
            <li
              key={w.url}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <Webhook className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12px] font-bold text-ink-900">{w.url}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {w.events.map((e) => (
                    <span
                      key={e}
                      className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink-600"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                  w.status === 'OK'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-rose-50 text-rose-700 ring-rose-200',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', w.status === 'OK' ? 'bg-emerald-500' : 'bg-rose-500')} />
                {w.status}
              </span>
              <button onClick={onChange} className="rounded-lg border border-ink-200 bg-white p-1.5 text-ink-400 hover:border-rose-200 hover:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Branded QR template" desc="A code snippet to embed Vuedine QR menu on your own site.">
        <pre className="overflow-x-auto rounded-xl border border-ink-100 bg-ink-50/40 p-3 font-mono text-[11px] text-ink-800">
{`<iframe
  src="https://menu.vuedine.com/r/bandra"
  style="border:0; width:100%; height:100vh"
  title="Vuedine menu"
/>`}
        </pre>
      </Card>
    </>
  );
}

/* ============================================================ */
/*  Section 15 · Danger zone                                    */
/* ============================================================ */function DangerSection() {
  return (
    <Card>
      <div className="space-y-3">
        {[
          {
            title: 'Pause restaurant',
            desc: 'Temporarily stop accepting QR / online orders. POS keeps working.',
            cta: 'Pause',
            tone: 'amber' as const,
            icon: Clock,
          },
          {
            title: 'Reset demo data',
            desc: 'Wipe all sample data and start with a clean slate.',
            cta: 'Reset data',
            tone: 'amber' as const,
            icon: RefreshCcw,
          },
          {
            title: 'Transfer ownership',
            desc: 'Move the workspace to another email. The current Owner becomes a Manager.',
            cta: 'Transfer',
            tone: 'rose' as const,
            icon: User,
          },
          {
            title: 'Close account',
            desc: 'Delete every outlet, branch, customer and order. Irreversible after 90 days.',
            cta: 'Close account',
            tone: 'rose' as const,
            icon: Trash2,
          },
        ].map((d) => {
          const Icon = d.icon;
          return (
            <div
              key={d.title}
              className={cn(
                'flex flex-wrap items-start gap-3 rounded-2xl border p-4',
                d.tone === 'rose' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
                  d.tone === 'rose'
                    ? 'bg-rose-50 text-rose-600 ring-rose-100'
                    : 'bg-amber-50 text-amber-600 ring-amber-100',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-ink-900">{d.title}</div>
                <div className="mt-0.5 text-[12px] text-ink-600">{d.desc}</div>
              </div>
              <button
                className={cn(
                  'rounded-xl border px-3 py-2 text-[12px] font-bold transition',
                  d.tone === 'rose'
                    ? 'border-rose-200 bg-white text-rose-600 hover:border-rose-500 hover:bg-rose-500 hover:text-white'
                    : 'border-amber-200 bg-white text-amber-700 hover:border-amber-500 hover:bg-amber-500 hover:text-white',
                )}
              >
                {d.cta}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
