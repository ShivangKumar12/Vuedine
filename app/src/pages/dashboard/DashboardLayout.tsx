import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  Languages,
  LogOut,
  Maximize,
  Menu,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AiHelper } from '../../components/AiHelper';
import { Logo } from '../../components/Logo';
import { cn } from '../../lib/cn';
import { useLiveOrders } from '../../lib/liveOrders';
import { authApi } from '../../services/auth';
import { branchesApi } from '../../services/branches';
import { authStore } from '../../stores/auth';
import { branchesStore } from '../../stores/branches';
import { settingsStore } from '../../stores/settings';
import { dashboardNav } from './nav';

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Load the branch list once when the dashboard mounts. The active branch
  // selection is restored from localStorage by branchesStore.
  useEffect(() => {
    branchesApi.fetchAll().catch(() => {
      /* error surfaced via store; banner is local to BranchSelector */
    });
    // Load tenant settings (currency, tax, branding) into the app-wide store.
    settingsStore.load().catch(() => {
      /* error surfaced via store */
    });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main column */}
      <div className="lg:pl-[260px]">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* AI helper FAB + chat panel */}
      <AiHelper />
    </div>
  );
}

/* ============================================================ */

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const live = useLiveOrders();
  const liveActiveCount = live.filter(
    (o) => o.status !== 'Served' && o.status !== 'Cancelled',
  ).length;
  return (
    <>
      {/* Mobile scrim */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[260px] flex-col border-r border-ink-200 bg-white transition-transform duration-300 ease-out lg:flex lg:translate-x-0',
          mobileOpen ? 'translate-x-0 flex' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex h-[64px] items-center justify-between border-b border-ink-100 px-5">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <Logo size={32} />
          </Link>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick search */}
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              placeholder="Search…"
              className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/60 pl-9 pr-12 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/15"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-500">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {dashboardNav.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && 'mt-5')}>
              {group.label && (
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isLiveOrders = item.to === '/dashboard/live-orders';
                  const displayBadge = isLiveOrders
                    ? liveActiveCount > 0
                      ? String(liveActiveCount)
                      : undefined
                    : item.badge;
                  const isHotLive = isLiveOrders && liveActiveCount > 0;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/dashboard'}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-ink-700 hover:bg-ink-100/60 hover:text-ink-900',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="dashboard-active"
                                className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-brand-500"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                              />
                            )}
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0 transition-colors',
                                isActive ? 'text-brand-600' : 'text-ink-500 group-hover:text-ink-700',
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                            {displayBadge && (
                              <span
                                className={cn(
                                  'ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                                  isHotLive
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/40'
                                    : isActive
                                      ? 'bg-brand-500 text-white'
                                      : 'bg-ink-100 text-ink-600 group-hover:bg-white group-hover:ring-1 group-hover:ring-ink-200',
                                )}
                              >
                                {isHotLive && (
                                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                )}
                                {displayBadge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer card */}
        <div className="border-t border-ink-100 p-3">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-rose-500 p-4 text-white shadow-lg shadow-brand-500/30">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              Vuedine Pro
            </div>
            <div className="mt-2 text-sm font-semibold leading-snug">
              Unlock AI insights & multi-branch
            </div>
            <button className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-amber-50">
              Upgrade plan
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ============================================================ */

function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur-md backdrop-saturate-150 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <BranchSelector />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <IconButton label="Language" hint="EN">
          <Languages className="h-4 w-4" />
        </IconButton>
        <IconButton label="Notifications" badge="4">
          <Bell className="h-4 w-4" />
        </IconButton>
        <IconButton label="Fullscreen">
          <Maximize className="h-4 w-4" />
        </IconButton>
        <UserMenu />
      </div>
    </header>
  );
}

function BranchSelector() {
  const [open, setOpen] = useState(false);
  const { list, activeId, loading } = branchesStore.use();
  const active = list.find((b) => b.id === activeId);

  const display = active
    ? active.name.replace(/^[^·]+·\s*/, '') // strip leading "Mumbai · " for the topbar
    : loading
      ? 'Loading…'
      : 'No branch';

  const handlePick = (id: string) => {
    branchesStore.setActive(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading || list.length === 0}
        className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 shadow-sm transition hover:border-brand-300 disabled:opacity-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-warm-500 text-white">
          <BranchIcon />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Branch
          </span>
          <span className="block max-w-[180px] truncate text-[13px] font-bold text-ink-900">
            {display}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-500 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-black/10"
          >
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">
              Switch branch
            </div>
            {list.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-ink-500">
                {loading ? 'Loading…' : 'No branches yet. Add one in Settings.'}
              </div>
            ) : (
              list.map((b) => {
                const isActive = b.id === activeId;
                return (
                  <button
                    key={b.id}
                    onClick={() => handlePick(b.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50',
                    )}
                  >
                    <span className="truncate">{b.name}</span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[11px] font-semibold',
                        b.isLive ? 'text-emerald-600' : 'text-ink-400',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          b.isLive ? 'animate-pulse bg-emerald-500' : 'bg-ink-300',
                        )}
                      />
                      {b.isLive ? 'Live' : 'Offline'}
                    </span>
                  </button>
                );
              })
            )}
            <div className="mt-1 border-t border-ink-100 px-3 py-2">
              <Link
                to="/dashboard/settings#branches"
                onClick={() => setOpen(false)}
                className="text-[12px] font-bold text-brand-600 hover:text-brand-700"
              >
                + Manage branches
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M3 21V10l4-3 5 3 5-3 4 3v11" />
      <path d="M9 21v-7h6v7" />
    </svg>
  );
}

function IconButton({
  children,
  label,
  hint,
  badge,
}: {
  children: ReactNode;
  label: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <button
      aria-label={label}
      className="relative inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
    >
      {children}
      {hint && <span className="hidden text-[11px] font-bold sm:inline">{hint}</span>}
      {badge && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const auth = authStore.use();
  const user = auth.user;
  const displayName = user?.name ?? user?.email ?? 'Account';
  const firstName = displayName.split(' ')[0] ?? displayName;

  const handleSignOut = async () => {
    setOpen(false);
    await authApi.logout();
    // Navigate handled by RequireAuth on next render.
    window.location.href = '/login';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white py-1 pl-2 pr-3 shadow-sm transition hover:border-brand-300"
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 ring-2 ring-white" />
        <div className="hidden text-left sm:block">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Hello</div>
          <div className="max-w-[140px] truncate text-[13px] font-bold text-ink-900">{firstName}</div>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-500 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl shadow-black/10"
          >
            <div className="border-b border-ink-100 p-3">
              <div className="truncate text-[13px] font-bold text-ink-900">{displayName}</div>
              <div className="truncate text-[11px] text-ink-500">{user?.email ?? ''}</div>
              {user?.role && (
                <div className="mt-1 inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                  {user.role}
                </div>
              )}
            </div>
            <div className="p-1">
              {[
                { icon: User, label: 'My profile', to: '/dashboard/settings#profile' },
                { icon: Bell, label: 'Notifications', to: '/dashboard/settings#notifications' },
              ].map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.label}
                    to={it.to}
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    <Icon className="h-4 w-4 text-ink-500" />
                    {it.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-ink-100 p-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
