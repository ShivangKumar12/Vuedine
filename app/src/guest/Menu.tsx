import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Clock,
  Flame,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { cn } from '../lib/cn';
import { GuestShell } from './GuestShell';
import { guestActions, lineSubtotal, useGuestSession, type CartLine } from './cartStore';
import { guestCategories, guestItems, type GuestItem } from './menuData';
import { publicApi, type PublicMenuItem } from '../services/public';

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function GuestMenu() {
  const params = useParams<{ branch: string; table: string }>();
  const navigate = useNavigate();
  const branch = params.branch ?? 'bandra';
  const table = params.table ?? 'T-7';

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [openItem, setOpenItem] = useState<GuestItem | null>(null);
  const [showRing, setShowRing] = useState(false);
  const [serverMenu, setServerMenu] = useState<PublicMenuItem[] | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const session = useGuestSession();

  // Sync URL params into store
  useEffect(() => {
    guestActions.setContext(branch, table);
  }, [branch, table]);

  // Resolve QR + fetch real menu in parallel. Best-effort — if the public
  // endpoints aren't reachable we keep the local fallback so the demo still
  // works offline. When server menu loads, it overrides the local dataset.
  useEffect(() => {
    let cancelled = false;
    publicApi
      .resolveQr(branch, table)
      .catch(() => null);
    publicApi
      .getMenu(branch)
      .then((data) => {
        if (cancelled) return;
        setServerMenu(data.items);
      })
      .catch((e) => {
        if (cancelled) return;
        setResolveError(e instanceof Error ? e.message : null);
        setServerMenu(null);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, table]);

  void resolveError;

  // Build the menu list — when a server menu is available, use it (with the
  // local guestItems entries layered for variants/addons/spice/allergens
  // metadata which the server doesn't yet model).
  const menuItems = useMemo<GuestItem[]>(() => {
    if (!serverMenu) return guestItems;
    return serverMenu.map((s, idx) => {
      const local = guestItems.find((g) => g.name.toLowerCase() === s.name.toLowerCase());
      return {
        id: idx + 1, // synthetic id for cart line dedup
        name: s.name,
        category: s.category,
        price: s.price,
        emoji: s.emoji ?? local?.emoji ?? '🍽️',
        veg: s.veg,
        bestseller: s.bestseller || local?.bestseller,
        desc: s.description ?? local?.desc,
        prepMin: local?.prepMin,
        spice: local?.spice,
        allergens: local?.allergens,
        variants: local?.variants,
        addons: local?.addons,
      };
    });
  }, [serverMenu]);

  const filtered = useMemo(() => {
    return menuItems.filter((it) => {
      if (vegOnly && !it.veg) return false;
      if (activeCat === 'Bestsellers' && !it.bestseller) return false;
      else if (activeCat !== 'all' && activeCat !== 'Bestsellers' && it.category !== activeCat)
        return false;
      if (search) {
        const s = search.toLowerCase();
        if (!it.name.toLowerCase().includes(s) && !(it.desc ?? '').toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [search, activeCat, vegOnly, menuItems]);

  const cartCount = session.cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = session.cart.reduce((s, l) => s + lineSubtotal(l), 0);

  return (
    <GuestShell>
      <Hero branch={branch} table={table} onCallWaiter={() => setShowRing(true)} />

      {/* Search + filters */}
      <div className="sticky top-0 z-20 border-b border-ink-100 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="vue-input pl-10"
            style={{ height: 44 }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => setVegOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition',
              vegOnly
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-ink-200 bg-white text-ink-600 hover:border-emerald-300',
            )}
          >
            <Leaf className="h-3 w-3" />
            Veg only
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
            {filtered.length} items
          </span>
        </div>
      </div>

      {/* Category strip */}
      <CategoryStrip active={activeCat} onPick={setActiveCat} />

      {/* Items */}
      <div className="space-y-2.5 px-5 pb-32 pt-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white py-10 text-center">
            <div className="text-sm font-bold text-ink-700">No matches</div>
            <div className="mt-1 text-[12px] text-ink-500">Try a different search or category.</div>
          </div>
        ) : (
          filtered.map((it, i) => (
            <ItemRow
              key={it.id}
              item={it}
              index={i}
              cartQty={session.cart
                .filter((c) => c.itemId === it.id)
                .reduce((s, l) => s + l.qty, 0)}
              onOpen={() => setOpenItem(it)}
              onQuickAdd={() =>
                guestActions.add({
                  itemId: it.id,
                  unitPrice: it.price,
                })
              }
            />
          ))
        )}
      </div>

      {/* Floating cart bar */}
      <FloatingCart
        count={cartCount}
        total={cartTotal}
        onOpen={() => navigate(`/m/${branch}/${table}/checkout`)}
      />

      {/* Item detail */}
      <ItemSheet
        item={openItem}
        onClose={() => setOpenItem(null)}
        onAdd={(line) => {
          guestActions.add(line);
          setOpenItem(null);
        }}
      />

      {/* Call-waiter */}
      <RingModal open={showRing} onClose={() => setShowRing(false)} table={table} />
    </GuestShell>
  );
}

/* ============================================================ */
/*  Hero                                                        */
/* ============================================================ */

function Hero({
  branch,
  table,
  onCallWaiter,
}: {
  branch: string;
  table: string;
  onCallWaiter: () => void;
}) {
  return (
    <header className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 px-5 pb-6 pt-7 text-white lg:rounded-t-[40px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/15 blur-2xl"
      />
      <div className="relative flex items-start justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold backdrop-blur hover:bg-white/30"
          >
            About
          </Link>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">
          {branch.toUpperCase()} · {table}
        </div>
        <h1 className="display mt-1 text-3xl font-extrabold leading-tight">
          What would you like to <span className="text-amber-200">eat?</span>
        </h1>
        <p className="mt-2 text-[13px] text-white/85">
          Order straight from your phone. Pay when you're ready, or ask the waiter to settle.
        </p>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur ring-1 ring-white/30">
          <Wifi className="h-3 w-3" />
          Wi-Fi · vuedine-guest
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur ring-1 ring-white/30">
          <Clock className="h-3 w-3" />
          Avg ~12 min
        </span>
        <button
          onClick={onCallWaiter}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-brand-700 shadow-md hover:bg-amber-50"
        >
          <Bell className="h-3 w-3" />
          Call waiter
        </button>
      </div>
    </header>
  );
}

/* ============================================================ */
/*  Category strip                                              */
/* ============================================================ */

function CategoryStrip({
  active,
  onPick,
}: {
  active: string;
  onPick: (k: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="border-b border-ink-100 bg-white">
      <div
        ref={ref}
        className="no-scrollbar flex gap-3 overflow-x-auto px-5 py-3 scroll-smooth"
      >
        {guestCategories.map((c) => {
          const on = active === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onPick(c.key)}
              className={cn(
                'group relative flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2 transition',
                on
                  ? 'border-brand-500 bg-brand-50/60 shadow-sm shadow-brand-500/10'
                  : 'border-transparent bg-ink-50/60 hover:border-ink-200 hover:bg-white',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl text-2xl ring-1 transition',
                  on ? 'bg-white ring-brand-300' : 'bg-white ring-ink-100',
                )}
              >
                {c.emoji}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[10px] font-bold transition',
                  on ? 'text-brand-700' : 'text-ink-700',
                )}
              >
                {c.label}
              </span>
              {on && (
                <motion.span
                  layoutId="guest-cat"
                  className="absolute -bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-brand-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Item row                                                    */
/* ============================================================ */

function ItemRow({
  item,
  index,
  cartQty,
  onOpen,
  onQuickAdd,
}: {
  item: GuestItem;
  index: number;
  cartQty: number;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
      className={cn(
        'group flex w-full items-stretch gap-3 overflow-hidden rounded-2xl border bg-white p-3 text-left transition',
        cartQty > 0
          ? 'border-brand-300 ring-1 ring-brand-200'
          : 'border-ink-200 hover:border-brand-200 hover:shadow-md',
      )}
    >
      {/* Photo / emoji */}
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50">
        <span className="text-5xl transition-transform duration-500 group-hover:scale-110">
          {item.emoji}
        </span>
        {item.bestseller && (
          <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm">
            <Star className="h-2 w-2" fill="currentColor" />
            TOP
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border',
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
          <span className="truncate text-[14px] font-bold text-ink-900">{item.name}</span>
          {item.spice && <SpiceDots level={item.spice} />}
        </div>
        {item.desc && (
          <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-500">{item.desc}</div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {item.prepMin && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-500">
              <Clock className="h-2.5 w-2.5" />
              {item.prepMin}m
            </span>
          )}
          {item.allergens && item.allergens.length > 0 && (
            <span className="text-[10px] font-medium text-ink-400">
              {item.allergens.slice(0, 2).join(' · ')}
            </span>
          )}
        </div>
      </div>

      {/* Price + add */}
      <div className="flex flex-col items-end justify-between">
        <div className="text-base font-extrabold text-ink-900">${item.price.toFixed(2)}</div>
        <AnimatePresence mode="popLayout" initial={false}>
          {cartQty === 0 ? (
            <motion.span
              key="add"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                if (item.variants || item.addons) onOpen();
                else onQuickAdd();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-500 hover:text-white"
            >
              <Plus className="h-3 w-3" strokeWidth={3} />
              Add
            </motion.span>
          ) : (
            <motion.span
              key="qty"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
            >
              <ShoppingBag className="h-3 w-3" />
              {cartQty} in cart
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

function SpiceDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Flame
          key={i}
          className={cn('h-2.5 w-2.5', i < level ? 'text-rose-500' : 'text-ink-200')}
          fill={i < level ? 'currentColor' : 'transparent'}
        />
      ))}
    </span>
  );
}

/* ============================================================ */
/*  Item detail bottom sheet                                    */
/* ============================================================ */

function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: GuestItem | null;
  onClose: () => void;
  onAdd: (line: Omit<CartLine, 'uid' | 'qty'> & { qty?: number }) => void;
}) {
  const [variantId, setVariantId] = useState<string | undefined>();
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setVariantId(item?.variants?.[0]?.id);
    setAddonIds([]);
    setQty(1);
    setNotes('');
  }, [item?.id]);

  if (!item) return <AnimatePresence />;

  const variantDelta = item.variants?.find((v) => v.id === variantId)?.delta ?? 0;
  const addonsTotal = (item.addons ?? [])
    .filter((a) => addonIds.includes(a.id))
    .reduce((s, a) => s + a.price, 0);
  const unit = item.price + variantDelta + addonsTotal;
  const total = unit * qty;

  return (
    <AnimatePresence>
      {item && (
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 lg:inset-0 lg:flex lg:items-end lg:justify-center"
          >
            <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:mb-6 lg:rounded-3xl">
              <div className="relative">
                <div className="relative h-44 overflow-hidden bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50">
                  <span className="absolute inset-0 flex items-center justify-center text-7xl">
                    {item.emoji}
                  </span>
                  {item.bestseller && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                      <Star className="h-2.5 w-2.5" fill="currentColor" />
                      Bestseller
                    </span>
                  )}
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink-700 shadow-md hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
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
                        <h2 className="text-lg font-extrabold text-ink-900">{item.name}</h2>
                        {item.spice && <SpiceDots level={item.spice} />}
                      </div>
                      {item.desc && <p className="mt-1 text-[13px] text-ink-600">{item.desc}</p>}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-1">
                          {item.allergens.map((a) => (
                            <span
                              key={a}
                              className="rounded-full border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-bold text-ink-500"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-brand-600">${unit.toFixed(2)}</div>
                      {item.prepMin && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-ink-500">
                          <Clock className="h-2.5 w-2.5" />
                          {item.prepMin} min
                        </div>
                      )}
                    </div>
                  </div>

                  {item.variants && item.variants.length > 0 && (
                    <Section title="Choose size">
                      <div className="grid grid-cols-3 gap-2">
                        {item.variants.map((v) => {
                          const on = variantId === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setVariantId(v.id)}
                              className={cn(
                                'rounded-xl border px-2 py-2 text-center text-[12px] font-bold transition',
                                on
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                              )}
                            >
                              <div>{v.label}</div>
                              <div className="mt-0.5 text-[10px] text-ink-500">
                                {v.delta > 0 ? `+$${v.delta.toFixed(2)}` : v.delta < 0 ? `−$${Math.abs(v.delta).toFixed(2)}` : 'Standard'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  {item.addons && item.addons.length > 0 && (
                    <Section title="Add-ons">
                      <div className="space-y-1.5">
                        {item.addons.map((a) => {
                          const on = addonIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                                on ? 'border-brand-300 bg-brand-50/40' : 'border-ink-200 bg-white',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() =>
                                  setAddonIds((ids) =>
                                    on ? ids.filter((x) => x !== a.id) : [...ids, a.id],
                                  )
                                }
                                className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-500 checked:bg-brand-500"
                              />
                              <span className="flex-1 text-[13px] font-bold text-ink-800">
                                {a.label}
                              </span>
                              <span className="text-[12px] font-bold text-brand-600">
                                +${a.price.toFixed(2)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  <Section title="Special instructions">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g. no onions, extra spicy"
                      className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    />
                  </Section>
                </div>

                {/* Sticky bottom bar */}
                <div className="sticky bottom-0 flex items-center gap-3 border-t border-ink-100 bg-white p-4 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.08)]">
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white p-1">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-50"
                      aria-label="Decrease"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    <span className="min-w-[24px] text-center text-[13px] font-extrabold text-ink-900">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty((q) => q + 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-50"
                      aria-label="Increase"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      onAdd({
                        itemId: item.id,
                        unitPrice: unit,
                        variantId,
                        addonIds,
                        notes: notes.trim() || undefined,
                        qty,
                      })
                    }
                    className="btn-primary shine flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold"
                  >
                    Add · ${total.toFixed(2)}
                    <ArrowRight className="h-4 w-4" />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-500">{title}</div>
      {children}
    </section>
  );
}

/* ============================================================ */
/*  Floating cart                                               */
/* ============================================================ */

function FloatingCart({
  count,
  total,
  onOpen,
}: {
  count: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed inset-x-0 bottom-3 z-30 mx-auto w-full max-w-[480px] px-3"
        >
          <button
            onClick={onOpen}
            className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-white shadow-2xl shadow-brand-500/40"
          >
            <div className="inline-flex items-center gap-2">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand-700">
                  {count}
                </span>
              </span>
              <span className="text-[12px] font-bold uppercase tracking-wider">View cart</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-base font-extrabold">
              ${total.toFixed(2)}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================ */
/*  Call-waiter modal                                           */
/* ============================================================ */

function RingModal({
  open,
  onClose,
  table,
}: {
  open: boolean;
  onClose: () => void;
  table: string;
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
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-center text-white">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
                  <Bell className="h-6 w-6" />
                </span>
                <div className="mt-3 text-2xl font-extrabold">Calling waiter…</div>
                <div className="mt-1 text-[13px] text-white/85">
                  Someone will be at <strong>{table}</strong> shortly.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onClose}
                  className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Got it
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
