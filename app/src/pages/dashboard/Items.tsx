import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/* ============================================================ */
/*  Mock data                                                   */
/* ============================================================ */

type Item = {
  id: number;
  name: string;
  category: string;
  price: number;
  status: 'Active' | 'Sold out' | 'Draft';
  emoji: string;
  veg: boolean;
  bestseller?: boolean;
};

const allItems: Item[] = [
  { id: 1, name: 'Soda (Can)', category: 'Beverages', price: 1.5, status: 'Active', emoji: '🥤', veg: true },
  { id: 2, name: 'Soda (Bottle)', category: 'Beverages', price: 1.0, status: 'Active', emoji: '🧃', veg: true },
  { id: 3, name: 'Mojito', category: 'Beverages', price: 2.0, status: 'Active', emoji: '🍹', veg: true, bestseller: true },
  { id: 4, name: 'Iced Coffee', category: 'Beverages', price: 1.5, status: 'Active', emoji: '🧊', veg: true },
  { id: 5, name: 'Homemade Lemonade', category: 'Beverages', price: 1.5, status: 'Active', emoji: '🍋', veg: true },
  { id: 6, name: 'Espresso', category: 'Beverages', price: 1.0, status: 'Active', emoji: '☕', veg: true },
  { id: 7, name: 'Chai Latte', category: 'Beverages', price: 1.0, status: 'Active', emoji: '🫖', veg: true },
  { id: 8, name: 'Cappuccino', category: 'Beverages', price: 1.5, status: 'Active', emoji: '☕', veg: true, bestseller: true },
  { id: 9, name: 'Potato Pancakes', category: 'Side Orders', price: 1.5, status: 'Active', emoji: '🥔', veg: true },
  { id: 10, name: 'Onion Rings', category: 'Side Orders', price: 1.0, status: 'Active', emoji: '🧅', veg: true },
  { id: 11, name: 'French Fries', category: 'Side Orders', price: 1.0, status: 'Active', emoji: '🍟', veg: true },
  { id: 12, name: 'Garlic Bread', category: 'Side Orders', price: 1.5, status: 'Active', emoji: '🥖', veg: true },
  { id: 13, name: 'Margherita', category: 'Pizza', price: 4.5, status: 'Active', emoji: '🍕', veg: true, bestseller: true },
  { id: 14, name: 'Pepperoni', category: 'Pizza', price: 5.0, status: 'Active', emoji: '🍕', veg: false },
  { id: 15, name: 'Truffle Burger', category: 'Burgers', price: 5.9, status: 'Active', emoji: '🍔', veg: false, bestseller: true },
  { id: 16, name: 'Classic Cheeseburger', category: 'Burgers', price: 4.0, status: 'Active', emoji: '🍔', veg: false },
  { id: 17, name: 'Veggie Burger', category: 'Burgers', price: 3.8, status: 'Active', emoji: '🍔', veg: true },
  { id: 18, name: 'Caesar Salad', category: 'Salads', price: 3.3, status: 'Active', emoji: '🥗', veg: true },
  { id: 19, name: 'Greek Salad', category: 'Salads', price: 3.0, status: 'Active', emoji: '🥗', veg: true },
  { id: 20, name: 'Burrata', category: 'Salads', price: 4.5, status: 'Active', emoji: '🧀', veg: true },
  { id: 21, name: 'Carbonara', category: 'Pasta', price: 4.2, status: 'Active', emoji: '🍝', veg: false },
  { id: 22, name: 'Penne Arrabbiata', category: 'Pasta', price: 3.8, status: 'Active', emoji: '🍝', veg: true },
  { id: 23, name: 'Lasagna', category: 'Pasta', price: 4.6, status: 'Active', emoji: '🍝', veg: false },
  { id: 24, name: 'Sushi Set', category: 'Sushi', price: 7.5, status: 'Active', emoji: '🍣', veg: false, bestseller: true },
  { id: 25, name: 'Spicy Tuna Roll', category: 'Sushi', price: 5.5, status: 'Active', emoji: '🍣', veg: false },
  { id: 26, name: 'Salmon Nigiri', category: 'Sushi', price: 6.0, status: 'Active', emoji: '🍣', veg: false },
  { id: 27, name: 'Tiramisu', category: 'Desserts', price: 2.5, status: 'Active', emoji: '🍰', veg: true },
  { id: 28, name: 'Cheesecake', category: 'Desserts', price: 2.8, status: 'Active', emoji: '🍰', veg: true },
  { id: 29, name: 'Brownie', category: 'Desserts', price: 1.8, status: 'Active', emoji: '🍫', veg: true },
  { id: 30, name: 'Ice Cream Sundae', category: 'Desserts', price: 2.2, status: 'Active', emoji: '🍨', veg: true },
  { id: 31, name: 'Pinot Noir', category: 'Wines', price: 6.0, status: 'Active', emoji: '🍷', veg: true },
  { id: 32, name: 'Chardonnay', category: 'Wines', price: 5.5, status: 'Active', emoji: '🥂', veg: true },
  { id: 33, name: 'Prosecco', category: 'Wines', price: 6.5, status: 'Active', emoji: '🍾', veg: true },
  { id: 34, name: 'Old Fashioned', category: 'Cocktails', price: 5.0, status: 'Active', emoji: '🥃', veg: true },
  { id: 35, name: 'Negroni', category: 'Cocktails', price: 5.0, status: 'Active', emoji: '🍸', veg: true },
  { id: 36, name: 'Pad Thai', category: 'Asian', price: 4.0, status: 'Sold out', emoji: '🍜', veg: false },
  { id: 37, name: 'Ramen', category: 'Asian', price: 4.5, status: 'Active', emoji: '🍜', veg: false },
  { id: 38, name: 'Dim Sum Platter', category: 'Asian', price: 5.0, status: 'Draft', emoji: '🥟', veg: false },
  { id: 39, name: 'Mango Lassi', category: 'Beverages', price: 1.5, status: 'Active', emoji: '🥭', veg: true },
  { id: 40, name: 'Masala Chai', category: 'Beverages', price: 0.8, status: 'Active', emoji: '🍵', veg: true },
  { id: 41, name: 'Chicken Tikka', category: 'Indian', price: 4.5, status: 'Active', emoji: '🍗', veg: false },
  { id: 42, name: 'Butter Chicken', category: 'Indian', price: 5.0, status: 'Active', emoji: '🍛', veg: false, bestseller: true },
  { id: 43, name: 'Paneer Tikka', category: 'Indian', price: 4.0, status: 'Active', emoji: '🧀', veg: true },
  { id: 44, name: 'Garlic Naan', category: 'Indian', price: 1.2, status: 'Active', emoji: '🫓', veg: true },
  { id: 45, name: 'Hummus & Pita', category: 'Mediterranean', price: 3.0, status: 'Active', emoji: '🥙', veg: true },
  { id: 46, name: 'Falafel Wrap', category: 'Mediterranean', price: 3.5, status: 'Active', emoji: '🌯', veg: true },
  { id: 47, name: 'Greek Gyros', category: 'Mediterranean', price: 4.2, status: 'Active', emoji: '🥙', veg: false },
  { id: 48, name: 'Fish & Chips', category: 'Mains', price: 5.5, status: 'Active', emoji: '🐟', veg: false },
  { id: 49, name: 'Grilled Salmon', category: 'Mains', price: 7.0, status: 'Active', emoji: '🐟', veg: false },
  { id: 50, name: 'Steak Frites', category: 'Mains', price: 8.5, status: 'Active', emoji: '🥩', veg: false },
  { id: 51, name: 'Roast Chicken', category: 'Mains', price: 5.5, status: 'Active', emoji: '🍗', veg: false },
  { id: 52, name: 'Mushroom Risotto', category: 'Mains', price: 4.8, status: 'Active', emoji: '🍚', veg: true },
  { id: 53, name: 'BBQ Ribs', category: 'Mains', price: 7.5, status: 'Active', emoji: '🍖', veg: false },
  { id: 54, name: 'Cobb Salad', category: 'Salads', price: 3.8, status: 'Active', emoji: '🥗', veg: false },
  { id: 55, name: 'Affogato', category: 'Desserts', price: 2.0, status: 'Active', emoji: '☕', veg: true },
];

const categories = ['All categories', ...Array.from(new Set(allItems.map((i) => i.category)))];

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Items() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [status, setStatus] = useState<'All' | Item['status']>('All');
  const [selected, setSelected] = useState<number[]>([]);

  const filtered = useMemo(() => {
    return allItems.filter((it) => {
      if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== 'All categories' && it.category !== category) return false;
      if (status !== 'All' && it.status !== status) return false;
      return true;
    });
  }, [search, category, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(visible.map((i) => i.id));
    else setSelected([]);
  };
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Card */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-ink-900">Items</h2>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
              {filtered.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
            <PageSizeMenu value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
            <FilterMenu
              category={category}
              setCategory={(c) => { setCategory(c); setPage(1); }}
              status={status}
              setStatus={(s) => { setStatus(s); setPage(1); }}
            />
            <ExportMenu />
            <ImportMenu />
            <button className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold">
              <Plus className="h-3.5 w-3.5" />
              Add item
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
                <div className="font-bold text-brand-700">
                  {selected.length} selected
                </div>
                <div className="flex flex-wrap gap-2">
                  <BulkButton>Mark Active</BulkButton>
                  <BulkButton>Mark Sold-out</BulkButton>
                  <BulkButton>Change category</BulkButton>
                  <BulkButton tone="danger">Archive</BulkButton>
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
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Price</Th>
                <Th>Status</Th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 text-sm">
              {visible.map((it, idx) => (
                <Row
                  key={it.id}
                  item={it}
                  index={idx}
                  selected={selected.includes(it.id)}
                  onToggle={(c) => toggleOne(it.id, c)}
                />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="text-base font-bold text-ink-700">No items match your filters</div>
                    <div className="mt-1 text-sm text-ink-500">Try clearing the search or category.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 p-4 sm:flex-row sm:p-5">
          <div className="text-[12px] font-medium text-ink-500">
            Showing <span className="font-bold text-ink-900">{filtered.length === 0 ? 0 : start + 1}</span> to{' '}
            <span className="font-bold text-ink-900">{Math.min(start + pageSize, filtered.length)}</span> of{' '}
            <span className="font-bold text-ink-900">{filtered.length}</span> entries
          </div>
          <Pagination current={safePage} total={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Sub-components                                              */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">Items</span>
    </nav>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-bold">{children}</th>;
}

function Row({
  item,
  index,
  selected,
  onToggle,
}: {
  item: Item;
  index: number;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
      className={cn(
        'group transition-colors',
        selected ? 'bg-brand-50/40' : 'hover:bg-ink-50/60',
      )}
    >
      <td className="px-5 py-3">
        <Check checked={selected} onChange={onToggle} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
            {item.emoji}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-ink-900">{item.name}</span>
              {item.bestseller && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  TOP
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex h-3 w-3 items-center justify-center rounded-sm border',
                  item.veg ? 'border-emerald-500' : 'border-rose-500',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    item.veg ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
              </span>
              <span className="text-[11px] font-medium text-ink-500">
                {item.veg ? 'Vegetarian' : 'Non-veg'} · #{item.id.toString().padStart(4, '0')}
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className="rounded-md bg-ink-100/70 px-2 py-1 text-[12px] font-semibold text-ink-700">
          {item.category}
        </span>
      </td>
      <td className="px-5 py-3 font-mono text-sm font-bold text-ink-900">
        ${item.price.toFixed(2)}
      </td>
      <td className="px-5 py-3">
        <StatusPill status={item.status} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          <ActionButton tone="brand" label="View">
            <Eye className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="emerald" label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton tone="rose" label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </td>
    </motion.tr>
  );
}

function StatusPill({ status }: { status: Item['status'] }) {
  const styles =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'Sold out'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-ink-100 text-ink-600 ring-ink-200';
  const dot =
    status === 'Active' ? 'bg-emerald-500' : status === 'Sold out' ? 'bg-rose-500' : 'bg-ink-400';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1',
        styles,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {status}
    </span>
  );
}

function ActionButton({
  tone,
  label,
  children,
}: {
  tone: 'brand' | 'emerald' | 'rose';
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white hover:border-brand-500'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
        : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        cls,
      )}
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

/* ============================================================ */
/*  Header controls                                             */
/* ============================================================ */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search items…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function PageSizeMenu({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Dropdown
      label={String(value)}
      icon={<Settings2 className="h-3.5 w-3.5" />}
      tone="brand"
    >
      {(close) => (
        <>
          <DropHeader>Rows per page</DropHeader>
          {[10, 25, 50, 100].map((n) => (
            <DropItem
              key={n}
              active={n === value}
              onClick={() => {
                onChange(n);
                close();
              }}
            >
              {n} entries
            </DropItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function FilterMenu({
  category,
  setCategory,
  status,
  setStatus,
}: {
  category: string;
  setCategory: (c: string) => void;
  status: 'All' | Item['status'];
  setStatus: (s: 'All' | Item['status']) => void;
}) {
  return (
    <Dropdown label="Filter" icon={<Filter className="h-3.5 w-3.5" />}>
      {() => (
        <div className="w-64 space-y-3 p-2">
          <div>
            <DropHeader>Category</DropHeader>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="vue-input mt-1 h-9 text-[13px]"
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <DropHeader>Status</DropHeader>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['All', 'Active', 'Sold out', 'Draft'] as const).map((s) => (
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
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
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
          {['CSV', 'Excel (.xlsx)', 'PDF', 'JSON'].map((t) => (
            <DropItem key={t} onClick={close}>
              {t}
            </DropItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function ImportMenu() {
  return (
    <Dropdown label="Import" icon={<Upload className="h-3.5 w-3.5" />}>
      {(close) => (
        <>
          <DropHeader>Import from</DropHeader>
          <DropItem onClick={close}>CSV file</DropItem>
          <DropItem onClick={close}>Excel (.xlsx)</DropItem>
          <DropItem onClick={close}>From Petpooja</DropItem>
          <DropItem onClick={close}>From Square POS</DropItem>
        </>
      )}
    </Dropdown>
  );
}

function Dropdown({
  label,
  icon,
  tone,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  tone?: 'brand';
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold shadow-sm transition',
          tone === 'brand'
            ? 'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100'
            : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
        )}
      >
        {icon}
        {label}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
              aria-hidden
            />
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

function DropItem({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-ink-700 hover:bg-ink-50',
      )}
    >
      {children}
      {active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
    </button>
  );
}

function BulkButton({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'danger';
}) {
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

  const btn = 'inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border text-[12px] font-bold transition';

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        aria-label="Previous"
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700')}
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
        className={cn(btn, 'border-ink-200 bg-white px-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-700')}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
