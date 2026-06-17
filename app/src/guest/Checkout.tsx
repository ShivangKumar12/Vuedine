import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Lock,
  Minus,
  Plus,
  ShoppingBag,
  Smartphone,
  Tag,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/cn';
import { GuestShell } from './GuestShell';
import { guestActions, lineSubtotal, useGuestSession } from './cartStore';
import { guestItems } from './menuData';
import { publicApi } from '../services/public';

type PayMode = 'pay-now-upi' | 'pay-now-card' | 'pay-at-counter';

export default function GuestCheckout() {
  const navigate = useNavigate();
  const params = useParams<{ branch: string; table: string }>();
  const branch = params.branch ?? 'bandra';
  const table = params.table ?? 'T-7';

  const session = useGuestSession();
  const [tipPct, setTipPct] = useState(10);
  const [tipCustom, setTipCustom] = useState<number | null>(null);
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [name, setName] = useState(session.guestName ?? '');
  const [phone, setPhone] = useState(session.phone ?? '');
  const [pay, setPay] = useState<PayMode>('pay-at-counter');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    serviceTotal: number;
    tipTotal: number;
    grandTotal: number;
  } | null>(null);

  const lines = session.cart;

  // Build the server line payload from cart lines.
  const serverLines = useMemo(
    () =>
      lines.map((l) => {
        const item = guestItems.find((i) => i.id === l.itemId);
        return {
          itemName: item?.name ?? 'Item',
          emoji: item?.emoji ?? undefined,
          qty: l.qty,
          unitPrice: l.unitPrice,
          variantId: l.variantId ?? null,
          variantLabel: item?.variants?.find((v) => v.id === l.variantId)?.label ?? null,
          addons: (item?.addons ?? [])
            .filter((a) => (l.addonIds ?? []).includes(a.id))
            .map((a) => ({ id: a.id, label: a.label, price: a.price })),
          notes: l.notes ?? null,
          category: item?.category ?? null,
          spice: item?.spice ?? null,
        };
      }),
    [lines],
  );

  // Live server totals — debounced.
  useEffect(() => {
    if (lines.length === 0) {
      setServerTotals(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const totals = await publicApi.calculate({
          branchSlug: branch,
          lines: serverLines,
          promoCode: promoApplied ? promo : undefined,
          tipAmount: tipCustom !== null ? tipCustom : undefined,
          tipPct: tipCustom === null ? tipPct : undefined,
        });
        setServerTotals(totals);
      } catch {
        setServerTotals(null);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [serverLines, branch, promo, promoApplied, tipPct, tipCustom, lines.length]);

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      await publicApi.applyCoupon({
        branchSlug: branch,
        code,
        customerId: phone.trim() || undefined,
        lines: serverLines.map((l) => ({
          itemName: l.itemName,
          category: l.category ?? undefined,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      });
      setPromoApplied(true);
    } catch (err) {
      setPromoApplied(false);
      setPromoError(err instanceof Error ? err.message : 'Coupon not valid');
    } finally {
      setPromoChecking(false);
    }
  };

  const totals = useMemo(() => {
    if (serverTotals) {
      return {
        subtotal: serverTotals.subtotal,
        promoOff: serverTotals.discountTotal,
        tax: serverTotals.taxTotal,
        service: serverTotals.serviceTotal,
        tipAmount: serverTotals.tipTotal,
        total: serverTotals.grandTotal,
      };
    }
    // Client preview while server is computing.
    const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
    const promoOff = promoApplied ? Math.min(2, subtotal * 0.1) : 0;
    const taxable = subtotal - promoOff;
    const tax = taxable * 0.05;
    const service = taxable * 0.05;
    const tipAmount = tipCustom !== null ? tipCustom : (taxable * tipPct) / 100;
    const total = taxable + tax + service + tipAmount;
    return { subtotal, promoOff, tax, service, tipAmount, total };
  }, [serverTotals, lines, promoApplied, tipCustom, tipPct]);

  const placeOrder = async () => {
    if (lines.length === 0 || placing) return;
    setPlacing(true);
    setPlaceError(null);
    guestActions.setGuest(name.trim() || undefined, phone.trim() || undefined);

    // Use the table param as the qrToken when present in URL (the original
    // /m/:branch/:table flow uses the table slug as the qr token).
    const qrToken = table;

    try {
      const order = await publicApi.placeOrder({
        branchSlug: branch,
        qrToken,
        lines: serverLines,
        guestName: name.trim() || undefined,
        guestPhone: phone.trim() || undefined,
        promoCode: promoApplied ? promo : undefined,
        tipAmount: tipCustom !== null ? tipCustom : undefined,
        tipPct: tipCustom === null ? tipPct : undefined,
        payMode: pay,
      });
      // Local round bookkeeping mirrors the server but keeps the UI snappy.
      guestActions.placeOrder();
      window.setTimeout(() => navigate(`/m/${branch}/order/${order.id}`), 600);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place your order. Try again.');
      setPlacing(false);
    }
  };

  const empty = lines.length === 0;

  return (
    <GuestShell>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur lg:rounded-t-[40px]">
        <Link
          to={`/m/${branch}/${table}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
            Your order · {table}
          </div>
          <div className="text-[14px] font-extrabold text-ink-900">Review & pay</div>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">
          {lines.length} {lines.length === 1 ? 'item' : 'items'}
        </span>
      </header>

      {empty ? (
        <EmptyCart branch={branch} table={table} />
      ) : (
        <div className="space-y-5 px-5 pb-32 pt-5">
          {/* Items */}
          <Section title="Items">
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {lines.map((line) => {
                  const item = guestItems.find((i) => i.id === line.itemId);
                  if (!item) return null;
                  return (
                    <motion.li
                      key={line.uid}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-2xl ring-1 ring-ink-100">
                        {item.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-ink-900">{item.name}</div>
                        {(line.variantId || (line.addonIds && line.addonIds.length > 0)) && (
                          <div className="mt-0.5 truncate text-[11px] text-ink-500">
                            {item.variants?.find((v) => v.id === line.variantId)?.label}
                            {line.addonIds && line.addonIds.length > 0 &&
                              ` · ${(item.addons ?? [])
                                .filter((a) => line.addonIds!.includes(a.id))
                                .map((a) => a.label)
                                .join(', ')}`}
                          </div>
                        )}
                        {line.notes && (
                          <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            📝 {line.notes}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="inline-flex items-center gap-0.5 rounded-lg bg-brand-50 p-0.5 ring-1 ring-brand-200">
                            <button
                              onClick={() => guestActions.setQty(line.uid, line.qty - 1)}
                              aria-label="Decrease"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-brand-600 hover:bg-white"
                            >
                              <Minus className="h-3 w-3" strokeWidth={3} />
                            </button>
                            <span className="min-w-[18px] text-center text-[12px] font-bold text-brand-700">
                              {line.qty}
                            </span>
                            <button
                              onClick={() => guestActions.setQty(line.uid, line.qty + 1)}
                              aria-label="Increase"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-brand-600 hover:bg-white"
                            >
                              <Plus className="h-3 w-3" strokeWidth={3} />
                            </button>
                          </div>
                          <span className="text-[10px] text-ink-500">${line.unitPrice.toFixed(2)} ea</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[14px] font-extrabold text-ink-900">
                          ${lineSubtotal(line).toFixed(2)}
                        </span>
                        <button
                          onClick={() => guestActions.remove(line.uid)}
                          aria-label="Remove"
                          className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <Link
              to={`/m/${branch}/${table}`}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 hover:text-brand-700"
            >
              <Plus className="h-3 w-3" strokeWidth={3} />
              Add more items
            </Link>
          </Section>

          {/* Promo */}
          <Section title="Promo code">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => {
                    setPromo(e.target.value.toUpperCase());
                    setPromoApplied(false);
                    setPromoError(null);
                  }}
                  placeholder="WELCOME10"
                  className="vue-input pl-9 uppercase tracking-wider"
                />
              </div>
              <button
                onClick={applyPromo}
                disabled={!promo.trim() || promoApplied || promoChecking}
                className={cn(
                  'rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition disabled:cursor-not-allowed',
                  promoApplied
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-50',
                )}
              >
                {promoApplied ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    Applied
                  </span>
                ) : (
                  'Apply'
                )}
              </button>
            </div>
            {promoError && (
              <div className="mt-2 text-[11px] font-bold text-rose-600">{promoError}</div>
            )}
            {promoApplied && (
              <div className="mt-2 text-[11px] font-bold text-emerald-600">
                Coupon applied — discount shown below.
              </div>
            )}
          </Section>

          {/* Tip */}
          <Section title="Add a tip" subtitle="100% goes to the team">
            <div className="grid grid-cols-4 gap-2">
              {[0, 5, 10, 15].map((p) => {
                const on = tipCustom === null && tipPct === p;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setTipPct(p);
                      setTipCustom(null);
                    }}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-center text-[13px] font-bold transition',
                      on
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                    )}
                  >
                    {p === 0 ? 'No tip' : `${p}%`}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-ink-500">Custom</span>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={tipCustom ?? ''}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setTipCustom(Number.isFinite(v) ? Math.max(0, v) : null);
                  }}
                  placeholder="0.00"
                  className="vue-input pl-7"
                />
              </div>
            </div>
          </Section>

          {/* Guest details */}
          <Section title="Your details" subtitle="So the team can reach you when ready">
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="vue-input"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional · for SMS updates)"
                className="vue-input"
              />
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <div className="space-y-2">
              {(
                [
                  { id: 'pay-at-counter', label: 'Pay at counter', desc: 'Pay when you leave or ask the waiter to bring the bill', icon: Banknote },
                  { id: 'pay-now-upi', label: 'UPI · pay now', desc: 'GPay · PhonePe · Paytm · BHIM', icon: Smartphone },
                  { id: 'pay-now-card', label: 'Card · pay now', desc: 'Visa · Mastercard · RuPay · Amex', icon: CreditCard },
                ] as const
              ).map((p) => {
                const Icon = p.icon;
                const on = pay === p.id;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition',
                      on ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-200' : 'border-ink-200 bg-white hover:border-brand-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="pay"
                      value={p.id}
                      checked={on}
                      onChange={() => setPay(p.id as PayMode)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
                        on ? 'bg-brand-500 text-white ring-brand-500' : 'bg-ink-50 text-ink-500 ring-ink-100',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-ink-900">{p.label}</div>
                      <div className="text-[11px] text-ink-500">{p.desc}</div>
                    </div>
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border-2',
                        on ? 'border-brand-500' : 'border-ink-300',
                      )}
                    >
                      {on && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>

          {/* Totals */}
          <Section title="Order summary">
            <div className="space-y-1.5 rounded-2xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
              <Row label="Subtotal">${totals.subtotal.toFixed(2)}</Row>
              {promoApplied && (
                <Row label={`Promo · ${promo}`}>
                  <span className="text-emerald-600">−${totals.promoOff.toFixed(2)}</span>
                </Row>
              )}
              <Row label="Tax (5%)">${totals.tax.toFixed(2)}</Row>
              <Row label="Service charge (5%)">${totals.service.toFixed(2)}</Row>
              <Row label="Tip">${totals.tipAmount.toFixed(2)}</Row>
              <div className="my-1 border-t border-dashed border-ink-200" />
              <Row label="Total" emphasis>
                ${totals.total.toFixed(2)}
              </Row>
            </div>
          </Section>

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-ink-100 bg-white px-3 py-2 text-[11px] text-ink-500">
            <Lock className="h-3 w-3" />
            Payments are encrypted. We never store your card details.
          </div>

          {placeError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-700">
              {placeError}
            </div>
          )}
        </div>
      )}

      {/* Sticky place-order bar */}
      {!empty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed inset-x-0 bottom-3 z-30 mx-auto w-full max-w-[480px] px-3"
        >
          <button
            onClick={placeOrder}
            disabled={placing}
            className="btn-primary shine flex w-full items-center justify-between rounded-2xl px-4 py-3 text-white shadow-2xl shadow-brand-500/40 disabled:cursor-not-allowed disabled:opacity-80"
          >
            <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider">
              {pay === 'pay-at-counter' ? 'Send to kitchen' : 'Pay & send'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-base font-extrabold">
              ${totals.total.toFixed(2)}
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </motion.div>
      )}
    </GuestShell>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">{title}</div>
        {subtitle && <div className="text-[11px] text-ink-500">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        emphasis ? 'text-base font-extrabold text-ink-900' : 'text-ink-700',
      )}
    >
      <span className={cn(emphasis ? 'font-extrabold' : 'font-medium')}>{label}</span>
      <span className={cn('font-bold', emphasis && 'text-brand-600')}>{children}</span>
    </div>
  );
}

function EmptyCart({ branch, table }: { branch: string; table: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 ring-1 ring-brand-100">
        <ShoppingBag className="h-7 w-7 text-brand-500" />
      </span>
      <div>
        <div className="text-base font-extrabold text-ink-900">Your cart is empty</div>
        <div className="mt-1 text-[13px] text-ink-500">Pick a few dishes to get started.</div>
      </div>
      <Link
        to={`/m/${branch}/${table}`}
        className="btn-primary shine inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
      >
        Browse menu
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
