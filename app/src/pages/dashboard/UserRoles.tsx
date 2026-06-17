import { AnimatePresence, motion } from 'framer-motion';
import {
  ChefHat,
  Copy,
  CreditCard,
  IndianRupee,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { usersApi, type Role as ApiRole } from '../../services/users';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type PermKey =
  | 'pos.create_order'
  | 'pos.discount'
  | 'pos.void_bill'
  | 'pos.refund'
  | 'kitchen.kds'
  | 'kitchen.recall'
  | 'menu.view'
  | 'menu.edit'
  | 'menu.toggle_availability'
  | 'tables.view'
  | 'tables.assign'
  | 'reports.view_sales'
  | 'reports.view_staff'
  | 'reports.export'
  | 'cash.day_close'
  | 'cash.cash_drawer'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'crm.view'
  | 'crm.message'
  | 'settings.outlet'
  | 'settings.users'
  | 'settings.billing'
  | 'delivery.assign'
  | 'delivery.driver_app';

type PermGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  perms: { key: PermKey; label: string; risk?: 'low' | 'medium' | 'high' }[];
};

const groups: PermGroup[] = [
  {
    key: 'pos',
    label: 'Point of Sale',
    icon: ShoppingBag,
    perms: [
      { key: 'pos.create_order', label: 'Create new orders' },
      { key: 'pos.discount', label: 'Apply discounts', risk: 'medium' },
      { key: 'pos.void_bill', label: 'Void bills', risk: 'high' },
      { key: 'pos.refund', label: 'Process refunds', risk: 'high' },
    ],
  },
  {
    key: 'kitchen',
    label: 'Kitchen / KDS',
    icon: ChefHat,
    perms: [
      { key: 'kitchen.kds', label: 'View Kitchen Display' },
      { key: 'kitchen.recall', label: 'Recall completed orders', risk: 'medium' },
    ],
  },
  {
    key: 'menu',
    label: 'Menu',
    icon: Utensils,
    perms: [
      { key: 'menu.view', label: 'View menu' },
      { key: 'menu.toggle_availability', label: 'Toggle item availability' },
      { key: 'menu.edit', label: 'Edit menu items', risk: 'medium' },
    ],
  },
  {
    key: 'tables',
    label: 'Tables',
    icon: Users,
    perms: [
      { key: 'tables.view', label: 'View floor plan' },
      { key: 'tables.assign', label: 'Assign / merge tables' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: ShieldCheck,
    perms: [
      { key: 'reports.view_sales', label: 'View sales reports' },
      { key: 'reports.view_staff', label: 'View staff performance' },
      { key: 'reports.export', label: 'Export data', risk: 'medium' },
    ],
  },
  {
    key: 'cash',
    label: 'Cash',
    icon: IndianRupee,
    perms: [
      { key: 'cash.day_close', label: 'Day-end close', risk: 'high' },
      { key: 'cash.cash_drawer', label: 'Open cash drawer' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: ShoppingBag,
    perms: [
      { key: 'inventory.view', label: 'View inventory' },
      { key: 'inventory.adjust', label: 'Adjust stock', risk: 'medium' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: Users,
    perms: [
      { key: 'crm.view', label: 'View customer data' },
      { key: 'crm.message', label: 'Send messages / campaigns', risk: 'medium' },
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery',
    icon: ShoppingBag,
    perms: [
      { key: 'delivery.assign', label: 'Assign delivery agent' },
      { key: 'delivery.driver_app', label: 'Use driver mobile app' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Lock,
    perms: [
      { key: 'settings.outlet', label: 'Outlet settings', risk: 'high' },
      { key: 'settings.users', label: 'Manage users & roles', risk: 'high' },
      { key: 'settings.billing', label: 'Billing & subscription', risk: 'high' },
    ],
  },
];

const allPermKeys: PermKey[] = groups.flatMap((g) => g.perms.map((p) => p.key));

type Role = {
  id: string;
  name: string;
  description: string;
  members: number;
  color: string; // gradient
  systemRole?: boolean;
  permissions: Set<PermKey>;
};

const initialRoles: Role[] = [];
void initialRoles; // Replaced by API call in useEffect

function adaptApiRole(r: ApiRole): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    members: r.members,
    color: r.color,
    systemRole: r.systemRole,
    permissions: new Set<PermKey>(r.permissions as PermKey[]),
  };
}

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function UserRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    setLoading(true);
    usersApi
      .listRoles()
      .then((list) => {
        const adapted = list.map(adaptApiRole);
        setRoles(adapted);
        if (!activeId && adapted.length > 0) setActiveId(adapted[0].id);
      })
      .catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = roles.find((r) => r.id === activeId) ?? roles[0];

  const filteredRoles = useMemo(
    () =>
      roles.filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s);
      }),
    [roles, search],
  );

  const togglePerm = async (key: PermKey) => {
    if (active?.systemRole) return;
    const next = new Set(active.permissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Optimistic update
    setRoles((prev) => prev.map((r) => r.id === active.id ? { ...r, permissions: next } : r));
    try {
      await usersApi.updateRole(active.id, { permissions: [...next] });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Save failed');
      refresh(); // revert
    }
  };

  const setGroupPerms = async (groupKey: string, value: boolean) => {
    if (active?.systemRole) return;
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const next = new Set(active.permissions);
    group.perms.forEach((p) => (value ? next.add(p.key) : next.delete(p.key)));
    setRoles((prev) => prev.map((r) => r.id === active.id ? { ...r, permissions: next } : r));
    try {
      await usersApi.updateRole(active.id, { permissions: [...next] });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Save failed');
      refresh();
    }
  };

  const addRole = async (data: { name: string; description: string }) => {
    try {
      const created = await usersApi.createRole({ name: data.name, description: data.description, permissions: ['menu.view', 'tables.view'] });
      setRoles((prev) => [...prev, adaptApiRole(created)]);
      setActiveId(created.id);
      setCreating(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const duplicateRole = async (id: string) => {
    const r = roles.find((x) => x.id === id);
    if (!r) return;
    try {
      const created = await usersApi.createRole({
        name: `${r.name} (copy)`,
        description: r.description,
        color: r.color,
        permissions: [...r.permissions],
      });
      setRoles((prev) => [...prev, adaptApiRole(created)]);
      setActiveId(created.id);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  const deleteRole = async (id: string) => {
    const r = roles.find((x) => x.id === id);
    if (!r || r.systemRole) return;
    if (!window.confirm(`Delete role "${r.name}"? Users with this role will lose their custom permissions.`)) return;
    try {
      await usersApi.deleteRole(id);
      setRoles((prev) => prev.filter((x) => x.id !== id));
      setActiveId(roles[0]?.id ?? '');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const renameRole = async (id: string, name: string, description: string) => {
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, name, description } : r));
    try {
      await usersApi.updateRole(id, { name, description });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Rename failed');
      refresh();
    }
  };

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {apiError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-700">
            {apiError}
            <button onClick={() => setApiError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-3xl font-extrabold text-ink-900 sm:text-4xl">User Roles</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-600">
              Define what each kind of person on your team can see and do. Owner is always full access.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            Create role
          </button>
        </div>

        {loading && roles.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-ink-200 bg-white py-24">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          </div>
        ) : (
        /* Body */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Roles list */}
          <aside className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            <div className="border-b border-ink-100 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  placeholder="Search roles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                />
              </div>
            </div>
            <ul className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
              {filteredRoles.map((r) => {
                const isActive = r.id === activeId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveId(r.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                        isActive
                          ? 'border-brand-300 bg-brand-50/60 shadow-sm'
                          : 'border-transparent hover:border-ink-200 hover:bg-ink-50/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                          r.color,
                        )}
                      >
                        <UserCog className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-ink-900">{r.name}</span>
                          {r.systemRole && (
                            <Lock className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <div className="truncate text-[11px] text-ink-500">{r.description}</div>
                        <div className="mt-1 inline-flex items-center gap-2 text-[10px] font-bold">
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-ink-600">
                            {r.members} members
                          </span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
                            {r.permissions.size}/{allPermKeys.length} perms
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <motion.span
                          layoutId="role-active"
                          className="absolute left-0 top-2 h-[calc(100%-16px)] w-[3px] rounded-r bg-brand-500"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Role detail */}
          <RoleEditor
            role={active}
            onTogglePerm={togglePerm}
            onSetGroupPerms={setGroupPerms}
            onDuplicate={() => duplicateRole(active.id)}
            onDelete={() => deleteRole(active.id)}
            onRename={(name, description) => renameRole(active.id, name, description)}
          />
        </div>
        )} {/* end loading ternary */}
      </div>

      <CreateRoleModal open={creating} onClose={() => setCreating(false)} onCreate={addRole} />
    </>
  );
}

/* ============================================================ */
/*  Role editor                                                 */
/* ============================================================ */

function RoleEditor({
  role,
  onTogglePerm,
  onSetGroupPerms,
  onDuplicate,
  onDelete,
  onRename,
}: {
  role: Role;
  onTogglePerm: (k: PermKey) => void;
  onSetGroupPerms: (g: string, v: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string, description: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description);

  // Reset edit fields when role changes
  useMemo(() => {
    setName(role.name);
    setDesc(role.description);
    setEditing(false);
  }, [role.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      {/* Hero */}
      <header
        className={cn(
          'relative overflow-hidden bg-gradient-to-br p-6 text-white',
          role.color,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
        />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
              <UserCog className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent text-2xl font-extrabold tracking-tight text-white outline-none placeholder:text-white/60 sm:text-3xl"
                />
              ) : (
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {role.name}
                  {role.systemRole && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-widest">
                      <Lock className="h-2.5 w-2.5" />
                      SYSTEM
                    </span>
                  )}
                </h2>
              )}
              {editing ? (
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm font-medium text-white/85 outline-none placeholder:text-white/60"
                />
              ) : (
                <p className="mt-1 text-sm text-white/85">{role.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                  <Users className="h-3 w-3" />
                  {role.members} members
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  {role.permissions.size}/{allPermKeys.length} permissions
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={onDuplicate}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/20 px-2.5 text-[11px] font-bold text-white ring-1 ring-white/30 hover:bg-white/30"
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </button>
            {!role.systemRole && (
              <>
                {editing ? (
                  <button
                    onClick={() => {
                      onRename(name.trim() || role.name, desc.trim() || role.description);
                      setEditing(false);
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-bold text-ink-900 ring-1 ring-white"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/20 px-2.5 text-[11px] font-bold text-white ring-1 ring-white/30 hover:bg-white/30"
                  >
                    <Pencil className="h-3 w-3" />
                    Rename
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 text-[11px] font-bold text-white hover:bg-rose-500"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* System role notice */}
      {role.systemRole && (
        <div className="flex items-start gap-2 border-b border-ink-100 bg-amber-50/60 px-5 py-3 text-[12px] font-semibold text-amber-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The Owner role has full access by design and cannot be edited. Duplicate it to create a custom admin
          role.
        </div>
      )}

      {/* Permissions */}
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Permissions</div>
            <div className="text-sm font-bold text-ink-900">
              Pick exactly what this role can do
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <PermGroupCard
              key={g.key}
              group={g}
              role={role}
              onToggle={onTogglePerm}
              onToggleAll={(v) => onSetGroupPerms(g.key, v)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Permission group card                                       */
/* ============================================================ */

function PermGroupCard({
  group,
  role,
  onToggle,
  onToggleAll,
}: {
  group: PermGroup;
  role: Role;
  onToggle: (k: PermKey) => void;
  onToggleAll: (v: boolean) => void;
}) {
  const Icon = group.icon;
  const enabled = group.perms.filter((p) => role.permissions.has(p.key)).length;
  const total = group.perms.length;
  const all = enabled === total;
  const some = enabled > 0 && enabled < total;
  const locked = role.systemRole;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-white transition',
        enabled === 0 ? 'border-ink-200' : 'border-brand-200 shadow-sm shadow-brand-500/5',
      )}
    >
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg ring-1',
              enabled > 0
                ? 'bg-brand-50 text-brand-600 ring-brand-100'
                : 'bg-ink-50 text-ink-500 ring-ink-100',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-extrabold text-ink-900">{group.label}</div>
            <div className="text-[11px] font-medium text-ink-500">
              {enabled}/{total} enabled
            </div>
          </div>
        </div>
        <Switch
          checked={all}
          indeterminate={some}
          disabled={locked}
          onChange={(v) => onToggleAll(v)}
        />
      </div>
      <ul className="divide-y divide-ink-100">
        {group.perms.map((p) => {
          const on = role.permissions.has(p.key);
          return (
            <li
              key={p.key}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-2.5 transition',
                on ? 'bg-emerald-50/30' : 'hover:bg-ink-50/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-800">{p.label}</span>
                  {p.risk === 'high' && (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-700">
                      <Lock className="h-2 w-2" />
                      Sensitive
                    </span>
                  )}
                  {p.risk === 'medium' && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                      Manager
                    </span>
                  )}
                </div>
              </div>
              <Switch
                checked={on}
                disabled={locked}
                onChange={() => onToggle(p.key)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================ */
/*  Switch                                                      */
/* ============================================================ */

function Switch({
  checked,
  onChange,
  disabled,
  indeterminate,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
        disabled
          ? 'cursor-not-allowed bg-ink-200 opacity-50'
          : checked
            ? 'bg-brand-500'
            : indeterminate
              ? 'bg-brand-200'
              : 'bg-ink-200 hover:bg-ink-300',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-md',
          checked ? 'ml-auto mr-0.5' : 'ml-0.5',
        )}
      />
    </button>
  );
}

/* ============================================================ */
/*  Create role modal                                           */
/* ============================================================ */

function CreateRoleModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useMemo(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const presets = [
    { name: 'Branch Manager', desc: 'Run a single outlet end-to-end', icon: ShieldCheck },
    { name: 'POS Operator', desc: 'Take orders & payments', icon: ShoppingBag },
    { name: 'Waiter', desc: 'Take dine-in orders, manage tables', icon: Utensils },
    { name: 'Chef', desc: 'KDS and menu availability', icon: ChefHat },
    { name: 'Cashier', desc: 'Bills, cash drawer, day-end', icon: CreditCard },
    { name: 'Custom role', desc: 'Start from scratch', icon: Sparkles },
  ];

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
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-2xl shadow-black/20">
              <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">New role</div>
                <div className="mt-1 text-2xl font-extrabold">Create a custom role</div>
                <div className="mt-1 text-sm text-white/85">
                  Name it after a job in your restaurant. You'll set permissions next.
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-800">Role name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bar Captain, Floor Supervisor"
                    className="vue-input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-bold text-ink-800">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this role does day-to-day"
                    className="vue-input"
                  />
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">
                    Quick presets
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {presets.map((p) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.name}
                          onClick={() => {
                            setName(p.name);
                            setDescription(p.desc);
                          }}
                          className="group rounded-xl border border-ink-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="mt-2 text-[12px] font-extrabold text-ink-900">{p.name}</div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-500">{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-bold text-ink-700 transition hover:border-ink-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!name.trim()) return;
                      onCreate({
                        name: name.trim(),
                        description: description.trim() || 'Custom role',
                      });
                    }}
                    disabled={!name.trim()}
                    className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create role
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Header                                                      */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">User Roles</span>
    </nav>
  );
}
