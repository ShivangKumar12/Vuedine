import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Counter } from '../../components/Counter';
import { cn } from '../../lib/cn';
import { usersApi, type User as ApiUser, type InviteInput } from '../../services/users';
import { branchesStore } from '../../stores/branches';

/* ============================================================ */
/*  Types                                                       */
/* ============================================================ */

type Role =
  | 'Owner'
  | 'Manager'
  | 'Cashier'
  | 'Waiter'
  | 'Chef'
  | 'Kitchen Staff'
  | 'Delivery'
  | 'Customer';

type Status = 'Active' | 'Invited' | 'Suspended';

type Person = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: Status;
  branch: string;
  joinedAt: string;
  lastActive: string;
  spendOrSalary?: string;
  ordersOrShifts?: string;
};

function adaptUser(u: ApiUser, branchMap: Record<string, string>): Person {
  const branchLabel =
    (u.branchIds ?? []).map((id) => branchMap[id]).filter(Boolean).join(', ') || '—';
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '—',
    role: u.role as Role,
    status: u.status as Status,
    branch: branchLabel,
    joinedAt: u.joinedAt,
    lastActive: u.lastActive,
    spendOrSalary: u.spendOrSalary,
    ordersOrShifts: u.ordersOrShifts,
  };
}

const roles: Role[] = [
  'Owner', 'Manager', 'Cashier', 'Waiter', 'Chef', 'Kitchen Staff', 'Delivery', 'Customer',
];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function AllUsers() {
  const branches = branchesStore.use();
  const branchMap = useMemo(
    () => Object.fromEntries(branches.list.map((b) => [b.id, b.name])),
    [branches.list],
  );
  const branchOptions = useMemo(
    () => ['All branches', ...branches.list.map((b) => b.name)],
    [branches.list],
  );

  const [allUsers, setAllUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'All' | 'Staff' | 'Customers'>('All');
  const [role, setRole] = useState<'All' | Role>('All');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Person | null>(null);

  const refresh = () => {
    setLoading(true);
    setApiError(null);
    usersApi
      .list({ pageSize: 200 })
      .then((users) => setAllUsers(users.map((u) => adaptUser(u, branchMap))))
      .catch((err) => setApiError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async (data: InviteInput) => {
    try {
      await usersApi.invite(data);
      setInviteOpen(false);
      refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Invite failed');
    }
  };

  const handleSuspend = async (id: string) => {
    try {
      await usersApi.suspend(id);
      refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Suspend failed');
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this user? This action cannot be undone.')) return;
    try {
      await usersApi.remove(id);
      refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Remove failed');
    }
  };
  const [status, setStatus] = useState<'All' | Status>('All');
  const [branch, setBranch] = useState('All branches');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return allUsers.filter((u) => {
      if (group === 'Staff' && u.role === 'Customer') return false;
      if (group === 'Customers' && u.role !== 'Customer') return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !u.name.toLowerCase().includes(s) &&
          !u.email.toLowerCase().includes(s) &&
          !u.phone.includes(s)
        )
          return false;
      }
      if (role !== 'All' && u.role !== role) return false;
      if (status !== 'All' && u.status !== status) return false;
      if (branch !== 'All branches' && u.branch !== branch) return false;
      return true;
    });
  }, [search, group, role, status, branch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const stats = useMemo(() => {
    const active = allUsers.filter((u) => u.status === 'Active').length;
    const staff = allUsers.filter((u) => u.role !== 'Customer').length;
    const customers = allUsers.filter((u) => u.role === 'Customer').length;
    const invited = allUsers.filter((u) => u.status === 'Invited').length;
    return { active, staff, customers, invited };
  }, [allUsers]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      All: allUsers.length,
      Staff: allUsers.filter((u) => u.role !== 'Customer').length,
      Customers: allUsers.filter((u) => u.role === 'Customer').length,
    };
    return map;
  }, [allUsers]);

  const toggleAll = (c: boolean) => setSelected(c ? visible.map((u) => u.id) : []);
  const toggleOne = (id: string, c: boolean) =>
    setSelected((prev) => (c ? [...prev, id] : prev.filter((x) => x !== id)));

  const clearFilters = () => {
    setSearch('');
    setRole('All');
    setStatus('All');
    setBranch('All branches');
    setPage(1);
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(role !== 'All') +
    Number(status !== 'All') +
    Number(branch !== 'All branches');

  return (
    <div className="space-y-5">
      <Breadcrumb />

      {/* Error banner */}
      {apiError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-700">
          {apiError}
          <button onClick={() => setApiError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total members" value={allUsers.length} tone="brand" icon={Users} />
        <Kpi label="Active staff" value={stats.staff} tone="emerald" icon={ShieldCheck} />
        <Kpi label="Customers" value={stats.customers} tone="cool" icon={Users} />
        <Kpi label="Pending invites" value={stats.invited} tone="amber" icon={Mail} />
      </div>

      {/* Group toggle */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {(['All', 'Staff', 'Customers'] as const).map((g) => {
          const active = group === g;
          return (
            <button
              key={g}
              onClick={() => {
                setGroup(g);
                setPage(1);
              }}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
                active
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
              )}
            >
              {g}
              <span
                className={cn(
                  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                  active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
                )}
              >
                {counts[g]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-ink-900">All Users</h2>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
              {filtered.length}
            </span>
            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[11px] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-600"
              >
                <RefreshCcw className="h-3 w-3" />
                Clear · {activeFilters}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
            <FilterMenu
              role={role}
              setRole={(r) => { setRole(r); setPage(1); }}
              status={status}
              setStatus={(s) => { setStatus(s); setPage(1); }}
              branch={branch}
              setBranch={(b) => { setBranch(b); setPage(1); }}
              branchOptions={branchOptions}
            />
            <ImportMenu />
            <ExportMenu />
            <button
              onClick={() => setInviteOpen(true)}
              className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              Invite member
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-b border-brand-100 bg-brand-50/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="font-bold text-brand-700">{selected.length} selected</div>
                <div className="flex flex-wrap gap-2">
                  <BulkButton>Resend invite</BulkButton>
                  <BulkButton>Change role</BulkButton>
                  <BulkButton>Move branch</BulkButton>
                  <BulkButton tone="danger">Suspend</BulkButton>
                  <button
                    onClick={() => setSelected([])}
                    className="text-[12px] font-semibold text-ink-500 hover:text-ink-900"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100">
            <thead>
              <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                <th className="px-5 py-3 w-10">
                  <Check
                    checked={visible.length > 0 && visible.every((v) => selected.includes(v.id))}
                    onChange={toggleAll}
                    indeterminate={
                      selected.length > 0 &&
                      !visible.every((v) => selected.includes(v.id)) &&
                      visible.some((v) => selected.includes(v.id))
                    }
                  />
                </th>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>Branch</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>Performance</Th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-sm">
              {visible.map((u, i) => (
                <Row
                  key={u.id}
                  user={u}
                  index={i}
                  selected={selected.includes(u.id)}
                  onToggle={(c) => toggleOne(u.id, c)}
                  onSuspend={() => handleSuspend(u.id)}
                  onRemove={() => handleRemove(u.id)}
                  onEdit={() => setEditingUser(u)}
                />
              ))}
              {loading && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && <EmptyState onReset={clearFilters} />}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
          <div className="text-[12px] font-medium text-ink-500">
            Showing <span className="font-bold text-ink-900">{filtered.length === 0 ? 0 : start + 1}</span> to{' '}
            <span className="font-bold text-ink-900">{Math.min(start + pageSize, filtered.length)}</span> of{' '}
            <span className="font-bold text-ink-900">{filtered.length}</span> members
          </div>
          <Pagination current={safePage} total={totalPages} onChange={setPage} />
        </div>
      </div>

      {/* Invite member modal */}
      <AnimatePresence>
        {inviteOpen && (
          <InviteMemberModal
            branches={branches.list}
            onClose={() => setInviteOpen(false)}
            onInvite={handleInvite}
          />
        )}
      </AnimatePresence>

      {/* Edit user modal */}
      <AnimatePresence>
        {editingUser && (
          <EditUserModal
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={async (id, patch) => {
              try {
                await usersApi.update(id, patch);
                setEditingUser(null);
                refresh();
              } catch (err) {
                setApiError(err instanceof Error ? err.message : 'Update failed');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================ */
/*  Row                                                         */
/* ============================================================ */

function Row({
  user,
  index,
  selected,
  onToggle,
  onSuspend,
  onRemove,
  onEdit,
}: {
  user: Person;
  index: number;
  selected: boolean;
  onToggle: (c: boolean) => void;
  onSuspend?: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn(
        'group cursor-pointer transition-colors',
        selected ? 'bg-brand-50/40' : 'hover:bg-ink-50/60',
      )}
    >
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <Check checked={selected} onChange={onToggle} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-bold text-white shadow-sm',
              avatarGradient(user.name),
            )}
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink-900">{user.name}</div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink-500">
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />
                {user.email}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {user.phone}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <RolePill role={user.role} />
      </td>
      <td className="px-5 py-3">
        <span className="rounded-md bg-ink-100/70 px-2 py-1 text-[12px] font-semibold text-ink-700">
          {user.branch}
        </span>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={user.status} />
        <div className="mt-1 text-[10px] font-medium text-ink-400">{user.lastActive}</div>
      </td>
      <td className="px-5 py-3 text-[13px] font-semibold text-ink-700">{user.joinedAt}</td>
      <td className="px-5 py-3">
        <div className="text-[12px] font-bold text-ink-900">{user.spendOrSalary ?? '—'}</div>
        <div className="text-[10px] font-medium text-ink-500">{user.ordersOrShifts ?? '—'}</div>
      </td>
      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          {user.status === 'Active' ? (
            <ActionButton tone="amber" label="Suspend" onClick={onSuspend}>
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            </ActionButton>
          ) : null}
          <ActionButton tone="rose" label="Remove" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </motion.tr>
  );
}

/* ============================================================ */
/*  Status / role badges                                        */
/* ============================================================ */

const roleMeta: Record<Role, { pill: string }> = {
  Owner: { pill: 'bg-amber-100 text-amber-800 ring-amber-200' },
  Manager: { pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
  Cashier: { pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  Waiter: { pill: 'bg-warm-50 text-warm-700 ring-warm-200' },
  Chef: { pill: 'bg-rose-50 text-rose-700 ring-rose-200' },
  'Kitchen Staff': { pill: 'bg-rose-50 text-rose-700 ring-rose-200' },
  Delivery: { pill: 'bg-cool-50 text-cool-700 ring-cool-200' },
  Customer: { pill: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

function RolePill({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        roleMeta[role].pill,
      )}
    >
      {role}
    </span>
  );
}

const statusMeta: Record<Status, { pill: string; dot: string }> = {
  Active: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Invited: { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  Suspended: { pill: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
};

function StatusPill({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        meta.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

function avatarGradient(name: string) {
  const palette = [
    'from-brand-500 via-rose-500 to-warm-500',
    'from-warm-500 via-amber-500 to-brand-500',
    'from-cool-500 via-emerald-500 to-brand-500',
    'from-violet-500 via-pink-500 to-brand-500',
    'from-blue-500 via-cool-500 to-brand-500',
    'from-rose-500 via-brand-500 to-warm-500',
  ];
  const idx = Array.from(name).reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return palette[idx];
}
function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/* ============================================================ */
/*  Header controls                                             */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">All Users</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by name, email, phone…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function FilterMenu({
  role,
  setRole,
  status,
  setStatus,
  branch,
  setBranch,
  branchOptions: branchOpts,
}: {
  role: 'All' | Role;
  setRole: (v: 'All' | Role) => void;
  status: 'All' | Status;
  setStatus: (v: 'All' | Status) => void;
  branch: string;
  setBranch: (v: string) => void;
  branchOptions: string[];
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-72 space-y-3 p-2">
          <div>
            <DropHeader>Role</DropHeader>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(['All', ...roles] as const).map((r) => (
                <FilterChip key={r} active={role === r} onClick={() => setRole(r)}>
                  {r}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <DropHeader>Status</DropHeader>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['All', 'Active', 'Invited', 'Suspended'] as const).map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>
          <div>
            <DropHeader>Branch</DropHeader>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="vue-input mt-1 h-9 text-[13px]"
            >
              {branchOpts.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
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

function ImportMenu() {
  return (
    <Dropdown label="Import" icon={<Upload className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Import from</DropHeader>
          {['CSV file', 'Excel (.xlsx)', 'Google Contacts', 'From other Vuedine outlet'].map((t) => (
            <DropItem key={t} onClick={close}>
              {t}
            </DropItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function ExportMenu() {
  return (
    <Dropdown label="Export" icon={<Download className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Export as</DropHeader>
          {['CSV', 'Excel (.xlsx)', 'PDF directory'].map((t) => (
            <DropItem key={t} onClick={close}>
              {t}
            </DropItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function Dropdown({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        {icon}
        {label}
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-40 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-black/10"
            >
              {children(() => setOpen(false))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">
      {children}
    </div>
  );
}

function DropItem({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-ink-700 transition hover:bg-ink-50"
    >
      {children}
    </button>
  );
}

function BulkButton({ children, tone }: { children: React.ReactNode; tone?: 'danger' }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-lg border px-2.5 py-1 text-[12px] font-bold transition',
        tone === 'danger'
          ? 'border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
      )}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
}

function ActionButton({
  tone,
  label,
  children,
  onClick,
}: {
  tone: 'brand' | 'rose' | 'amber';
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500'
        : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition', cls)}
    >
      {children}
    </button>
  );
}

function Check({
  checked,
  onChange,
  indeterminate,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  indeterminate?: boolean;
}) {
  return (
    <label className="relative inline-flex cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate && !checked;
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-500 checked:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40"
      />
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8l3.5 3.5L13 5" />
      </svg>
      {indeterminate && !checked && (
        <span className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2 rounded-full bg-brand-500" />
      )}
    </label>
  );
}

const tones = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  cool: { bg: 'bg-cool-50', text: 'text-cool-600', ring: 'ring-cool-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
} as const;

function Kpi({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: keyof typeof tones;
  icon: React.ElementType;
}) {
  const t = tones[tone];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', t.bg, t.ring)}>
          <Icon className={cn('h-4 w-4', t.text)} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
          <div className="text-2xl font-extrabold text-ink-900">
            <Counter value={value} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <tr>
      <td colSpan={8} className="px-5 py-16 text-center">
        <div className="text-base font-bold text-ink-700">No members match</div>
        <div className="mt-1 text-sm text-ink-500">Try clearing filters or invite someone new.</div>
        <button
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
        >
          <RefreshCcw className="h-3 w-3" />
          Reset filters
        </button>
      </td>
    </tr>
  );
}

/* ============================================================ */
/*  Pagination                                                  */
/* ============================================================ */

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (n: number) => void;
}) {
  const pages: (number | 'ellipsis')[] = useMemo(() => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const arr: (number | 'ellipsis')[] = [1];
    if (current > 3) arr.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) arr.push(i);
    if (current < total - 2) arr.push('ellipsis');
    arr.push(total);
    return arr;
  }, [current, total]);

  const btn =
    'inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border text-[12px] font-bold transition';

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        aria-label="Previous"
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40')}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1 text-ink-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(btn, p === current ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30' : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700')}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        aria-label="Next"
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40')}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Invite member modal                                         */
/* ============================================================ */

function InviteMemberModal({
  branches: branchesList,
  onClose,
  onInvite,
}: {
  branches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onInvite: (data: InviteInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleVal, setRoleVal] = useState<InviteInput['role']>('WAITER');
  const [branchId, setBranchId] = useState(branchesList[0]?.id ?? '');
  const [salary, setSalary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const staffRoles: Array<{ code: InviteInput['role']; label: string }> = [
    { code: 'ADMIN', label: 'Manager / Admin' },
    { code: 'MANAGER', label: 'Manager' },
    { code: 'CASHIER', label: 'Cashier' },
    { code: 'WAITER', label: 'Waiter' },
    { code: 'CHEF', label: 'Chef' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
            <button onClick={onClose} className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">Invite member</div>
            <div className="mt-1 text-2xl font-extrabold">Add to your team</div>
            <div className="mt-1 text-[13px] text-white/85">They'll receive an email with a secure sign-up link.</div>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="vue-input" placeholder="Aman Kapoor" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="vue-input" placeholder="aman@restaurant.com" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Role</label>
              <select value={roleVal} onChange={(e) => setRoleVal(e.target.value as InviteInput['role'])} className="vue-input">
                {staffRoles.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            {branchesList.length > 0 && (
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Branch</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="vue-input">
                  {branchesList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Salary (optional, ₹)</label>
              <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="vue-input" placeholder="₹ per month" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-4">
            <button onClick={onClose} className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300">Cancel</button>
            <button
              disabled={!name.trim() || !email.trim() || submitting}
              onClick={async () => {
                setSubmitting(true);
                await onInvite({
                  name: name.trim(),
                  email: email.trim(),
                  role: roleVal,
                  branchIds: branchId ? [branchId] : [],
                  salary: salary ? parseFloat(salary) : null,
                }).finally(() => setSubmitting(false));
              }}
              className="btn-primary shine rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================ */
/*  Edit user modal                                             */
/* ============================================================ */

function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: Person;
  onClose: () => void;
  onSave: (id: string, patch: { name: string; phone?: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone === '—' ? '' : user.phone);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4"
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <div className="text-base font-extrabold text-ink-900">Edit member</div>
            <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="vue-input" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-ink-500">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="vue-input" placeholder="+91 98xxx xxxxx" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-4">
            <button onClick={onClose} className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300">Cancel</button>
            <button
              disabled={!name.trim() || saving}
              onClick={async () => {
                setSaving(true);
                await onSave(user.id, { name: name.trim(), phone: phone.trim() || null }).finally(() => setSaving(false));
              }}
              className="btn-primary shine rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
