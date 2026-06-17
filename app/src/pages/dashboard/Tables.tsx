import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { ApiError, API_BASE } from '../../lib/api';
import { cn } from '../../lib/cn';
import { tablesApi, type Table as ApiTable, type TableShape, type TableStatus } from '../../services/tables';
import { branchesStore, type Branch } from '../../stores/branches';

/* ============================================================ */
/*  Display types                                               */
/* ============================================================ */

type StatusLabel = 'Free' | 'Occupied' | 'Reserved' | 'Cleaning' | 'Bill';

const STATUS_API_TO_LABEL: Record<TableStatus, StatusLabel> = {
  FREE: 'Free',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning',
  BILL: 'Bill',
};

type DiningTable = {
  id: string;
  name: string;
  section: string;
  size: number;
  shape: TableShape;
  status: StatusLabel;
  active: boolean;
  qrToken: string;
  posLabel: string | null;
};

const statusOrder: StatusLabel[] = ['Free', 'Occupied', 'Bill', 'Reserved', 'Cleaning'];

function fromApi(row: ApiTable): DiningTable {
  return {
    id: row.id,
    name: row.name,
    section: row.section,
    size: row.capacity,
    shape: row.shape,
    status: STATUS_API_TO_LABEL[row.status],
    active: row.active,
    qrToken: row.qrToken,
    posLabel: row.posLabel,
  };
}

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Tables() {
  const branchesState = branchesStore.use();
  const activeBranch = branchesState.list.find((b) => b.id === branchesState.activeId) ?? null;

  const [view, setView] = useState<'plan' | 'list'>('plan');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('All sections');
  const [status, setStatus] = useState<'All' | StatusLabel>('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const [bulkPrint, setBulkPrint] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DiningTable | null>(null);

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async () => {
    if (!activeBranch) return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await tablesApi.listForBranch(activeBranch.id);
      setTables(rows.map(fromApi));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeBranch) {
      setTables([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    tablesApi
      .listForBranch(activeBranch.id)
      .then((rows) => {
        if (cancelled) return;
        setTables(rows.map(fromApi));
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load tables');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBranch?.id]);

  const sections = useMemo(() => {
    const fromBranch = activeBranch?.diningSections ?? [];
    const fromTables = Array.from(new Set(tables.map((t) => t.section)));
    const merged = Array.from(new Set([...fromBranch, ...fromTables]));
    return ['All sections', ...merged];
  }, [activeBranch, tables]);

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (section !== 'All sections' && t.section !== section) return false;
      if (status !== 'All' && t.status !== status) return false;
      return true;
    });
  }, [tables, search, section, status]);

  const counts = useMemo(() => {
    const base: Record<StatusLabel, number> = {
      Free: 0,
      Occupied: 0,
      Bill: 0,
      Reserved: 0,
      Cleaning: 0,
    };
    tables.forEach((t) => {
      base[t.status]++;
    });
    return base;
  }, [tables]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const grouped = useMemo(() => {
    const map = new Map<string, DiningTable[]>();
    filtered.forEach((t) => {
      if (!map.has(t.section)) map.set(t.section, []);
      map.get(t.section)!.push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const onSetCleaning = async (table: DiningTable) => {
    const next: TableStatus = table.status === 'Cleaning' ? 'FREE' : 'CLEANING';
    try {
      const updated = await tablesApi.setStatus(table.id, next);
      setTables((cur) => cur.map((t) => (t.id === updated.id ? fromApi(updated) : t)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const onRegenerate = async (table: DiningTable) => {
    try {
      const updated = await tablesApi.regenerateQr(table.id);
      const fresh = fromApi(updated);
      setTables((cur) => cur.map((t) => (t.id === fresh.id ? fresh : t)));
      if (qrTable?.id === fresh.id) setQrTable(fresh);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate QR');
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await tablesApi.remove(deleteCandidate.id);
      setTables((cur) => cur.filter((t) => t.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete table');
    }
  };

  const onExport = (kind: 'csv' | 'xlsx' | 'pdf') => {
    const csv = buildCsv(tables);
    if (kind === 'csv') downloadBlob(csv, 'text/csv', `tables-${activeBranch?.code ?? 'all'}.csv`);
    else if (kind === 'xlsx')
      downloadBlob(csv, 'application/vnd.ms-excel', `tables-${activeBranch?.code ?? 'all'}.xls`);
    else {
      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) return;
      w.document.write(buildPrintableTable(tables, activeBranch));
      w.document.close();
      w.focus();
      w.print();
    }
  };

  if (!activeBranch && !branchesState.loading && branchesState.list.length === 0) {
    return (
      <div className="space-y-5">
        <Breadcrumb />
        <EmptyState
          title="No branches yet"
          desc="Add a branch in Settings → Branches to start managing dining tables."
          ctaLabel="Open Settings"
          ctaTo="/dashboard/settings#branches"
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <Breadcrumb />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile label="Total tables" value={tables.length} tone="brand" />
          {statusOrder.map((s) => (
            <KpiTile key={s} label={s} value={counts[s]} tone={statusTone[s].tone} />
          ))}
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink-900">Dining Tables</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                {filtered.length}
              </span>
              {activeBranch && (
                <span className="hidden truncate rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-ink-600 sm:inline-flex">
                  {activeBranch.name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
              />
              <ViewToggle value={view} onChange={setView} />
              <FilterMenu
                section={section}
                sections={sections}
                setSection={(s) => {
                  setSection(s);
                  setPage(1);
                }}
                status={status}
                setStatus={(s) => {
                  setStatus(s);
                  setPage(1);
                }}
              />
              <ExportMenu onBulkPrint={() => setBulkPrint(true)} onExport={onExport} />
              <button
                onClick={refresh}
                aria-label="Refresh"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
              >
                <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
              <button
                onClick={() => setCreating(true)}
                className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                Add table
              </button>
            </div>
          </div>

          {loadError && (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[13px] font-semibold text-rose-700">
              {loadError}{' '}
              <button onClick={refresh} className="underline-offset-2 hover:underline">
                Retry
              </button>
            </div>
          )}

          {/* Body */}
          <AnimatePresence mode="wait">
            {loading && tables.length === 0 ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              </div>
            ) : view === 'plan' ? (
              <motion.div
                key="plan"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 p-4 sm:p-6"
              >
                {grouped.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="text-base font-bold text-ink-700">
                      {tables.length === 0 ? 'No tables yet' : 'No tables match'}
                    </div>
                    <div className="mt-1 text-sm text-ink-500">
                      {tables.length === 0
                        ? 'Click "Add table" to create your first one.'
                        : 'Try clearing the filters.'}
                    </div>
                  </div>
                )}
                {grouped.map(([sectionName, list]) => (
                  <div key={sectionName}>
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-500">
                        {sectionName}
                      </h3>
                      <span className="text-[11px] font-semibold text-ink-400">
                        {list.length} tables
                      </span>
                      <div className="h-px flex-1 bg-ink-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {list.map((t, i) => (
                        <TableCard
                          key={t.id}
                          table={t}
                          index={i}
                          onQR={() => setQrTable(t)}
                          onEdit={() => setEditing(t)}
                          onClean={() => onSetCleaning(t)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                {grouped.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 pt-5 text-[11px] font-semibold text-ink-600">
                    <span className="font-bold text-ink-500">Legend:</span>
                    {statusOrder.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', statusTone[s].dot)} />
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ink-100">
                    <thead>
                      <tr className="bg-ink-50/60 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
                        <Th>Name</Th>
                        <Th>Section</Th>
                        <Th>Size</Th>
                        <Th>Status</Th>
                        <Th>QR token</Th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-sm">
                      {visible.map((t, idx) => (
                        <Row
                          key={t.id}
                          table={t}
                          index={idx}
                          onQR={() => setQrTable(t)}
                          onEdit={() => setEditing(t)}
                          onDelete={() => setDeleteCandidate(t)}
                        />
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-16 text-center">
                            <div className="text-base font-bold text-ink-700">
                              {tables.length === 0 ? 'No tables yet' : 'No tables match'}
                            </div>
                            <div className="mt-1 text-sm text-ink-500">
                              {tables.length === 0
                                ? 'Click "Add table" to create your first one.'
                                : 'Try clearing the filters.'}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
                  <div className="text-[12px] font-medium text-ink-500">
                    Showing{' '}
                    <span className="font-bold text-ink-900">
                      {filtered.length === 0 ? 0 : start + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-bold text-ink-900">
                      {Math.min(start + pageSize, filtered.length)}
                    </span>{' '}
                    of <span className="font-bold text-ink-900">{filtered.length}</span> entries
                  </div>
                  <Pagination current={safePage} total={totalPages} onChange={setPage} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <QrModal
        table={qrTable}
        branch={activeBranch}
        onClose={() => setQrTable(null)}
        onRegenerate={onRegenerate}
      />
      <BulkPrintModal
        open={bulkPrint}
        tables={tables}
        branch={activeBranch}
        onClose={() => setBulkPrint(false)}
      />
      <TableFormModal
        open={creating || !!editing}
        initial={editing ?? undefined}
        branch={activeBranch}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(t) => {
          if (editing) {
            setTables((cur) => cur.map((x) => (x.id === t.id ? t : x)));
          } else {
            setTables((cur) => [...cur, t]);
          }
        }}
      />
      <ConfirmDelete
        table={deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

/* ============================================================ */
/*  Empty state                                                 */
/* ============================================================ */

function EmptyState({
  title,
  desc,
  ctaLabel,
  ctaTo,
}: {
  title: string;
  desc: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <Sparkles className="h-5 w-5 text-brand-600" />
      </div>
      <h3 className="mt-3 text-base font-extrabold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600">{desc}</p>
      <Link
        to={ctaTo}
        className="btn-primary shine mt-4 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

/* ============================================================ */
/*  KPI                                                         */
/* ============================================================ */

function KpiTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = toneStyles[tone];
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span
          className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1', t.bg, t.ring)}
        >
          <span className={cn('h-2 w-2 rounded-full', t.dot)} />
        </span>
        <span className="text-2xl font-extrabold text-ink-900">{value}</span>
      </div>
      <div className="mt-2 truncate text-[12px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
    </div>
  );
}

/* ============================================================ */
/*  Floor-plan card                                             */
/* ============================================================ */

function TableCard({
  table,
  index,
  onQR,
  onEdit,
  onClean,
}: {
  table: DiningTable;
  index: number;
  onQR: () => void;
  onEdit: () => void;
  onClean: () => void;
}) {
  const meta = statusTone[table.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.025, ease: [0.2, 0.8, 0.2, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 p-3.5 transition-shadow hover:shadow-md',
        meta.cardBg,
        meta.cardBorder,
      )}
    >
      {table.status === 'Occupied' && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-extrabold text-ink-900">{table.name}</div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-500">
            <Users className="h-3 w-3" />
            {table.size > 0 ? `${table.size} seats` : 'Counter'}
          </div>
        </div>
      </div>

      <div className="my-3 flex h-16 items-center justify-center">
        <Shape table={table} />
      </div>

      <StatusPill status={table.status} />

      <div className="mt-2 min-h-[20px] text-[11px] font-semibold text-ink-600">
        {table.status === 'Occupied' && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-ink-400" />
            <span className="truncate">Active session</span>
          </div>
        )}
        {table.status === 'Bill' && <div className="truncate text-amber-700">Awaiting payment</div>}
        {table.status === 'Reserved' && <div className="truncate text-blue-700">Reserved</div>}
        {table.status === 'Cleaning' && <div className="text-violet-700">Cleaning in progress</div>}
        {table.status === 'Free' && (
          <div className="text-emerald-700">Ready for guests</div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-white/60 pt-3">
        <CardAction tone="warm" label="Show QR" onClick={onQR}>
          <QrCode className="h-3.5 w-3.5" />
        </CardAction>
        <CardAction
          tone="brand"
          label={table.status === 'Cleaning' ? 'Mark free' : 'Mark cleaning'}
          onClick={onClean}
        >
          <Eye className="h-3.5 w-3.5" />
        </CardAction>
        <CardAction tone="emerald" label="Edit" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </CardAction>
      </div>
    </motion.div>
  );
}

function Shape({ table }: { table: DiningTable }) {
  const meta = statusTone[table.status];
  const seats = Math.min(8, Math.max(table.size, 1));

  return (
    <div className="relative h-16 w-16">
      {Array.from({ length: seats }).map((_, i) => {
        const angle = (i * 360) / seats;
        return (
          <span
            key={i}
            className={cn(
              'absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full',
              meta.dot,
            )}
            style={{ transform: `rotate(${angle}deg) translateY(-30px)` }}
          />
        );
      })}
      {table.shape === 'round' && (
        <div className={cn('absolute inset-3 rounded-full ring-2', meta.shapeBg, meta.shapeRing)} />
      )}
      {table.shape === 'square' && (
        <div className={cn('absolute inset-3 rounded-md ring-2', meta.shapeBg, meta.shapeRing)} />
      )}
      {table.shape === 'rect' && (
        <div className={cn('absolute inset-2 inset-y-3 rounded-md ring-2', meta.shapeBg, meta.shapeRing)} />
      )}
    </div>
  );
}

function CardAction({
  tone,
  label,
  children,
  onClick,
}: {
  tone: 'warm' | 'brand' | 'emerald';
  label: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const cls =
    tone === 'warm'
      ? 'border-warm-200 bg-warm-50 text-warm-600 hover:bg-warm-500 hover:text-white hover:border-warm-500'
      : tone === 'brand'
        ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
        : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg border transition', cls)}
    >
      {children}
    </button>
  );
}

/* ============================================================ */
/*  List view row                                               */
/* ============================================================ */

function Row({
  table,
  index,
  onQR,
  onEdit,
  onDelete,
}: {
  table: DiningTable;
  index: number;
  onQR: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className="group transition-colors hover:bg-ink-50/60"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-ink-100">
            <Shape table={{ ...table, size: Math.min(table.size, 4) }} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink-900">{table.name}</div>
            <div className="text-[11px] font-medium text-ink-500">
              {table.posLabel ?? table.id.slice(0, 8)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className="rounded-md bg-ink-100/70 px-2 py-1 text-[12px] font-semibold text-ink-700">
          {table.section}
        </span>
      </td>
      <td className="px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700">
          <Users className="h-3.5 w-3.5 text-ink-400" />
          {table.size > 0 ? `${table.size} seats` : 'Counter'}
        </span>
      </td>
      <td className="px-5 py-3">
        <StatusPill status={table.status} />
      </td>
      <td className="px-5 py-3 font-mono text-[11px] font-bold text-ink-600">
        {table.qrToken.slice(0, 10)}…
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          <ListAction tone="warm" label="QR code" onClick={onQR}>
            <QrCode className="h-3.5 w-3.5" />
          </ListAction>
          <ListAction tone="brand" label="View / Open">
            <Eye className="h-3.5 w-3.5" />
          </ListAction>
          <ListAction tone="emerald" label="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </ListAction>
          <ListAction tone="rose" label="Delete" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </ListAction>
        </div>
      </td>
    </motion.tr>
  );
}

function ListAction({
  tone,
  label,
  children,
  onClick,
}: {
  tone: 'warm' | 'brand' | 'emerald' | 'rose';
  label: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const cls = {
    warm: 'border-warm-200 bg-warm-50 text-warm-600 hover:bg-warm-500 hover:text-white hover:border-warm-500',
    brand:
      'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500',
  }[tone];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition', cls)}
    >
      {children}
    </button>
  );
}

/* ============================================================ */
/*  Status                                                      */
/* ============================================================ */

type Tone = 'brand' | 'emerald' | 'amber' | 'blue' | 'violet';

const toneStyles: Record<Tone, { bg: string; ring: string; dot: string; pill: string }> = {
  brand: {
    bg: 'bg-brand-50',
    ring: 'ring-brand-100',
    dot: 'bg-brand-500',
    pill: 'bg-brand-50 text-brand-700 ring-brand-200',
  },
  emerald: {
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-100',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  amber: {
    bg: 'bg-amber-50',
    ring: 'ring-amber-100',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  blue: {
    bg: 'bg-blue-50',
    ring: 'ring-blue-100',
    dot: 'bg-blue-500',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  violet: {
    bg: 'bg-violet-50',
    ring: 'ring-violet-100',
    dot: 'bg-violet-500',
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
};

const statusTone: Record<
  StatusLabel,
  {
    tone: Tone;
    dot: string;
    pill: string;
    cardBg: string;
    cardBorder: string;
    shapeBg: string;
    shapeRing: string;
  }
> = {
  Free: {
    tone: 'emerald',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    cardBg: 'bg-emerald-50/50',
    cardBorder: 'border-emerald-200',
    shapeBg: 'bg-white',
    shapeRing: 'ring-emerald-300',
  },
  Occupied: {
    tone: 'brand',
    dot: 'bg-brand-500',
    pill: 'bg-brand-50 text-brand-700 ring-brand-200',
    cardBg: 'bg-brand-50/40',
    cardBorder: 'border-brand-200',
    shapeBg: 'bg-brand-100',
    shapeRing: 'ring-brand-400',
  },
  Bill: {
    tone: 'amber',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
    cardBg: 'bg-amber-50/50',
    cardBorder: 'border-amber-200',
    shapeBg: 'bg-amber-100',
    shapeRing: 'ring-amber-400',
  },
  Reserved: {
    tone: 'blue',
    dot: 'bg-blue-500',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    cardBg: 'bg-blue-50/50',
    cardBorder: 'border-blue-200',
    shapeBg: 'bg-blue-100',
    shapeRing: 'ring-blue-400',
  },
  Cleaning: {
    tone: 'violet',
    dot: 'bg-violet-500',
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
    cardBg: 'bg-violet-50/40',
    cardBorder: 'border-violet-200',
    shapeBg: 'bg-violet-100',
    shapeRing: 'ring-violet-400',
  },
};

function StatusPill({ status }: { status: StatusLabel }) {
  const meta = statusTone[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        meta.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status === 'Bill' ? 'Awaiting payment' : status}
    </span>
  );
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
      <span className="text-ink-900">Dining Tables</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-56">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search tables…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: 'plan' | 'list'; onChange: (v: 'plan' | 'list') => void }) {
  return (
    <div className="relative inline-flex h-9 items-center gap-0.5 rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      {(['plan', 'list'] as const).map((v) => {
        const active = v === value;
        const Icon = v === 'plan' ? LayoutGrid : List;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold transition',
              active ? 'text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {active && (
              <motion.span
                layoutId="tables-view-toggle"
                className="absolute inset-0 rounded-lg bg-brand-500 shadow-sm shadow-brand-500/30"
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {v === 'plan' ? 'Floor plan' : 'List'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FilterMenu({
  section,
  sections,
  setSection,
  status,
  setStatus,
}: {
  section: string;
  sections: string[];
  setSection: (s: string) => void;
  status: 'All' | StatusLabel;
  setStatus: (s: 'All' | StatusLabel) => void;
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-64 space-y-3 p-2">
          <div>
            <DropHeader>Section</DropHeader>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="vue-input mt-1 h-9 text-[13px]"
            >
              {sections.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <DropHeader>Status</DropHeader>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['All', ...statusOrder] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition',
                    status === s
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                  )}
                >
                  {s === 'Bill' ? 'Awaiting payment' : s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function ExportMenu({
  onBulkPrint,
  onExport,
}: {
  onBulkPrint?: () => void;
  onExport: (kind: 'csv' | 'xlsx' | 'pdf') => void;
}) {
  return (
    <Dropdown label="Export" icon={<Download className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Export as</DropHeader>
          <DropItem
            onClick={() => {
              close();
              onExport('csv');
            }}
          >
            CSV
          </DropItem>
          <DropItem
            onClick={() => {
              close();
              onExport('xlsx');
            }}
          >
            Excel (.xlsx)
          </DropItem>
          <DropItem
            onClick={() => {
              close();
              onExport('pdf');
            }}
          >
            PDF
          </DropItem>
          <DropItem
            onClick={() => {
              close();
              onBulkPrint?.();
            }}
          >
            Print QR codes
          </DropItem>
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
              className="absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-black/10"
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
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
        className={cn(
          btn,
          'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700',
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              btn,
              p === current
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        aria-label="Next"
        className={cn(
          btn,
          'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700',
        )}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============================================================ */
/*  QR helpers                                                  */
/* ============================================================ */

function buildQrUrl(branch: Branch | null, table: DiningTable): string {
  const slug = branch?.qrSlug ?? 'demo';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vuedine.com';
  return `${origin}/m/${slug}/${table.qrToken}`;
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function buildCsv(rows: DiningTable[]): string {
  const header = ['id', 'name', 'section', 'capacity', 'shape', 'status', 'active', 'qrToken', 'posLabel'];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.id, r.name, r.section, r.size, r.shape, r.status, r.active, r.qrToken, r.posLabel ?? '']
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}

function buildPrintableTable(rows: DiningTable[], branch: Branch | null): string {
  const body = rows
    .map(
      (r) => `<tr>
        <td>${r.name}</td>
        <td>${r.section}</td>
        <td>${r.size}</td>
        <td>${r.shape}</td>
        <td>${r.status}</td>
        <td>${r.qrToken}</td>
      </tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tables — ${branch?.name ?? ''}</title>
    <style>
      body{font:14px/1.4 -apple-system,Segoe UI,sans-serif;padding:24px}
      h1{font-size:18px;margin:0 0 16px}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}
      th{background:#f8fafc}
    </style>
  </head><body>
    <h1>${branch?.name ?? 'Tables'} — ${rows.length} tables</h1>
    <table><thead><tr>
      <th>Name</th><th>Section</th><th>Size</th><th>Shape</th><th>Status</th><th>QR token</th>
    </tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}

/* ============================================================ */
/*  QR modal — single table                                     */
/* ============================================================ */

function QrModal({
  table,
  branch,
  onClose,
  onRegenerate,
}: {
  table: DiningTable | null;
  branch: Branch | null;
  onClose: () => void;
  onRegenerate: (t: DiningTable) => void | Promise<void>;
}) {
  const url = table ? buildQrUrl(branch, table) : '';
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const onDownload = () => {
    if (!table) return;
    const svg = document.getElementById(`qr-${table.id}`);
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vuedine-${table.name.replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const onPrint = () => window.print();

  const handleRegenerate = async () => {
    if (!table) return;
    setRegenerating(true);
    try {
      await onRegenerate(table);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {table && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm print:hidden"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 print:static print:translate-x-0 print:translate-y-0"
          >
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl print:shadow-none">
              <div className="relative flex items-center justify-between bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-5 text-white print:hidden">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-white/85">
                    Table QR
                  </div>
                  <div className="text-xl font-extrabold">{table.name}</div>
                  <div className="text-[12px] text-white/85">{table.section}</div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-gradient-to-b from-white via-brand-50/30 to-warm-50/40 p-6">
                <div className="mx-auto w-[280px] overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-md">
                  <div className="bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-center text-white">
                    <div className="flex items-center justify-center gap-2">
                      <Logo size={28} />
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/85">
                      Scan to order
                    </div>
                  </div>
                  <div className="flex items-center justify-center p-4">
                    <div className="rounded-xl border-2 border-ink-100 bg-white p-2">
                      <QRCodeSVG
                        id={`qr-${table.id}`}
                        value={url}
                        size={200}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0F172A"
                      />
                    </div>
                  </div>
                  <div className="border-t border-ink-100 p-3 text-center">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-ink-400">Table</div>
                    <div className="mt-0.5 text-2xl font-extrabold text-ink-900">{table.name}</div>
                    <div className="mt-1 text-[10px] font-medium text-ink-500">
                      Open camera · point at QR
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-ink-100 px-5 py-3 print:hidden">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Public link
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/40 p-1.5 pl-3">
                  <span className="truncate font-mono text-[11px] text-ink-700">{url}</span>
                  <button
                    onClick={onCopy}
                    className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-brand-700"
                    aria-label="Copy URL"
                    title={copied ? 'Copied!' : 'Copy link'}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 border-t border-ink-100 bg-white p-4 print:hidden">
                <button
                  onClick={onDownload}
                  className="rounded-xl border border-ink-200 bg-white px-2 py-2 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <Download className="h-3 w-3" />
                    SVG
                  </span>
                </button>
                <button
                  onClick={onPrint}
                  className="rounded-xl border border-ink-200 bg-white px-2 py-2 text-xs font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <Printer className="h-3 w-3" />
                    Print
                  </span>
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="rounded-xl border border-ink-200 bg-white px-2 py-2 text-xs font-bold text-ink-700 transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-50"
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <RefreshCcw className={cn('h-3 w-3', regenerating && 'animate-spin')} />
                    Rotate
                  </span>
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary shine inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold"
                >
                  Preview
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Bulk-print modal                                            */
/* ============================================================ */

function BulkPrintModal({
  open,
  tables,
  branch,
  onClose,
}: {
  open: boolean;
  tables: DiningTable[];
  branch: Branch | null;
  onClose: () => void;
}) {
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
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm print:hidden"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl print:static print:rounded-none print:shadow-none"
          >
            <div className="flex items-center justify-between border-b border-ink-100 bg-white px-5 py-3 print:hidden">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
                  Bulk QR sheet
                </div>
                <div className="text-base font-extrabold text-ink-900">
                  {tables.length} tables · ready to print
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-rose-200 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-ink-50 p-4 print:overflow-visible print:bg-white">
              <div className="mx-auto max-w-3xl bg-white p-6 shadow-sm print:max-w-none print:p-0 print:shadow-none">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {tables.map((t) => (
                    <div key={t.id} className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
                      <div className="bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-3 py-2 text-center text-white">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/85">
                          Vuedine
                        </div>
                      </div>
                      <div className="flex items-center justify-center p-3">
                        <QRCodeSVG
                          value={buildQrUrl(branch, t)}
                          size={140}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#0F172A"
                        />
                      </div>
                      <div className="border-t border-ink-100 p-2 text-center">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-ink-400">Table</div>
                        <div className="text-base font-extrabold text-ink-900">{t.name}</div>
                        <div className="text-[9px] font-medium text-ink-500">
                          {t.section.split('·')[0]?.trim()}
                        </div>
                      </div>
                    </div>
                  ))}
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
/*  Add / Edit form modal                                       */
/* ============================================================ */

function TableFormModal({
  open,
  initial,
  branch,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial?: DiningTable;
  branch: Branch | null;
  onClose: () => void;
  onSaved: (t: DiningTable) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>('round');
  const [active, setActive] = useState(true);
  const [posLabel, setPosLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setSection(initial.section);
      setCapacity(initial.size);
      setShape(initial.shape);
      setActive(initial.active);
      setPosLabel(initial.posLabel ?? '');
    } else {
      setName('');
      setSection(branch?.diningSections?.[0] ?? '');
      setCapacity(4);
      setShape('round');
      setActive(true);
      setPosLabel('');
    }
    setError(null);
  }, [open, initial, branch?.id, branch?.diningSections]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    setSubmitting(true);
    setError(null);
    try {
      let result: ApiTable;
      if (isEdit && initial) {
        result = await tablesApi.update(initial.id, {
          name: name.trim(),
          section: section.trim(),
          capacity,
          shape,
          active,
          posLabel: posLabel.trim() || null,
        });
      } else {
        result = await tablesApi.create(branch.id, {
          name: name.trim(),
          section: section.trim(),
          capacity,
          shape,
          active,
          posLabel: posLabel.trim() || null,
        });
      }
      onSaved(fromApi(result));
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TABLE_NAME_TAKEN')
          setError(`A table named "${name}" already exists in this branch`);
        else if (err.code === 'VALIDATION_FAILED') setError('Please double-check the form values');
        else setError(err.message);
      } else {
        setError('Could not reach the server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sectionsOptions = useMemo(() => {
    const fromBranch = branch?.diningSections ?? [];
    return Array.from(new Set([...fromBranch]));
  }, [branch?.diningSections]);

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
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2"
          >
            <form
              onSubmit={onSubmit}
              className="overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
                    {branch?.name ?? 'No branch'}
                  </div>
                  <div className="text-lg font-extrabold text-ink-900">
                    {isEdit ? 'Edit table' : 'Add new table'}
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

              <div className="space-y-4 p-5">
                <Field label="Name" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Table 7 / Bar 1 / Takeaway"
                    className="vue-input"
                  />
                </Field>

                <Field label="Section" required>
                  <input
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                    list="sections-list"
                    placeholder="Indoor · Window"
                    className="vue-input"
                  />
                  <datalist id="sections-list">
                    {sectionsOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Capacity">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={capacity}
                      onChange={(e) => setCapacity(Math.max(0, Number(e.target.value) || 0))}
                      className="vue-input"
                    />
                  </Field>
                  <Field label="Shape">
                    <div className="flex gap-2">
                      {(['round', 'square', 'rect'] as TableShape[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setShape(s)}
                          className={cn(
                            'flex-1 rounded-lg border px-2 py-2 text-[12px] font-bold capitalize transition',
                            shape === s
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label="POS label (optional)">
                  <input
                    value={posLabel}
                    onChange={(e) => setPosLabel(e.target.value)}
                    placeholder="T-7"
                    className="vue-input"
                  />
                </Field>

                <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
                  />
                  Active — accept orders + render QR
                </label>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
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
                  disabled={submitting || !branch}
                  className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isEdit ? 'Save changes' : 'Create table'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Confirm delete                                              */
/* ============================================================ */

function ConfirmDelete({
  table,
  onClose,
  onConfirm,
}: {
  table: DiningTable | null;
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
      {table && (
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
                  <div className="text-base font-extrabold text-ink-900">Delete this table?</div>
                  <p className="mt-1 text-[13px] text-ink-600">
                    "{table.name}" will be archived. The QR token stops working immediately. Active orders must be
                    closed first.
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
                  {busy ? 'Deleting…' : 'Delete table'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Field primitive                                             */
/* ============================================================ */

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </div>
      {children}
    </div>
  );
}

/* Force the API_BASE import to be retained — used at build time for prod env wiring. */
void API_BASE;
