import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  Receipt,
  Sparkles,
  Star,
  Utensils,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { cn } from '../lib/cn';
import { GuestShell } from './GuestShell';
import { useGuestSession } from './cartStore';
import { guestItems } from './menuData';
import { publicApi } from '../services/public';
import type { Order } from '../services/orders';

type Step = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Served';

const SERVER_STATUS_TO_STEP: Record<string, Step> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Ready',
  DELIVERED: 'Served',
  SERVED: 'Served',
  CANCELLED: 'Pending',
};

const steps: { key: Step; label: string; sub: string; icon: React.ElementType }[] = [
  { key: 'Pending', label: 'Order placed', sub: 'We received your order', icon: Receipt },
  { key: 'Accepted', label: 'Accepted', sub: 'Counter has confirmed', icon: CheckCircle2 },
  { key: 'Preparing', label: 'In the kitchen', sub: 'Chef is on it', icon: ChefHat },
  { key: 'Ready', label: 'Ready', sub: 'On its way to your table', icon: Sparkles },
  { key: 'Served', label: 'Served · enjoy!', sub: 'Anything else?', icon: Utensils },
];

export default function GuestTracking() {
  const params = useParams<{ branch: string; orderId: string }>();
  const branch = params.branch ?? 'bandra';
  const orderId = params.orderId ?? 'RND-0000';
  const session = useGuestSession();
  const round = session.rounds.find((r) => r.id === orderId);

  const [serverOrder, setServerOrder] = useState<Order | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [showRing, setShowRing] = useState(false);
  const [askedBill, setAskedBill] = useState(false);
  const [feedback, setFeedback] = useState<number | null>(null);
  const [signalPending, setSignalPending] = useState(false);

  // Live track via the public endpoint. Polls every 5s as a fallback if
  // sockets aren't available on the public PWA.
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const fetchOnce = async () => {
      try {
        const order = await publicApi.trackOrder(orderId);
        if (cancelled) return;
        setServerOrder(order);
        const step = SERVER_STATUS_TO_STEP[order.status] ?? 'Pending';
        const idx = steps.findIndex((s) => s.key === step);
        setStepIdx(idx >= 0 ? idx : 0);
      } catch {
        // Order id might be a legacy local-only id (RND-XXXX) — just simulate.
        if (cancelled) return;
        setStepIdx((i) => (i < steps.length - 1 ? i + 1 : i));
      }
    };
    fetchOnce();
    timer = window.setInterval(fetchOnce, 5_000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [orderId]);

  const currentStep = steps[stepIdx];
  const allDone = stepIdx === steps.length - 1;

  // Server is authoritative for money once we have it.
  const subtotal = serverOrder?.subtotal ?? (round
    ? round.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0)
    : 0);
  const tax = serverOrder?.taxTotal ?? subtotal * 0.05;
  const service = serverOrder?.serviceTotal ?? subtotal * 0.05;
  const total = serverOrder?.grandTotal ?? subtotal + tax + service;

  const ringWaiter = async () => {
    if (signalPending) return;
    setSignalPending(true);
    try {
      await publicApi.signal(orderId, 'WAITER_RING');
    } catch {
      // Show but don't block the UI; the existing modal already gives
      // verbal confirmation.
    } finally {
      setSignalPending(false);
      setShowRing(true);
    }
  };

  const requestBill = async () => {
    if (askedBill || signalPending) return;
    setSignalPending(true);
    try {
      await publicApi.signal(orderId, 'BILL_REQUEST');
      setAskedBill(true);
    } catch {
      setAskedBill(true); // optimistic
    } finally {
      setSignalPending(false);
    }
  };

  const submitFeedback = async (n: number) => {
    setFeedback(n);
    try {
      await publicApi.signal(orderId, 'FEEDBACK', { rating: n });
    } catch {
      // optimistic — UI shows the rating regardless
    }
  };

  return (
    <GuestShell>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur lg:rounded-t-[40px]">
        <Link
          to={`/m/${branch}/${session.table}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">
            Order · {orderId}
          </div>
          <div className="text-[14px] font-extrabold text-ink-900">{session.table}</div>
        </div>
        <Logo size={28} />
      </header>

      {/* Hero progress card */}
      <section className="px-4 pt-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'relative overflow-hidden rounded-3xl p-6 text-white shadow-lg',
            'bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500',
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur ring-1 ring-white/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Live
              </div>
              <div className="mt-3 text-3xl font-extrabold leading-tight">{currentStep.label}</div>
              <div className="mt-1 text-[13px] text-white/85">{currentStep.sub}</div>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
              <currentStep.icon className="h-6 w-6" />
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/20">
            <motion.div
              animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full bg-white"
            />
          </div>

          <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-white/85">
            <Clock className="h-3 w-3" />
            ETA · ~{Math.max(2, 14 - stepIdx * 3)} min
          </div>
        </motion.div>
      </section>

      {/* Step timeline */}
      <section className="px-5 py-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Status</div>
        <ul className="relative mt-3 space-y-1">
          <span className="absolute left-3 top-3 h-[calc(100%-1.5rem)] w-0.5 bg-ink-100" />
          {steps.map((s, i) => {
            const reached = i <= stepIdx;
            const current = i === stepIdx;
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative flex items-start gap-3 py-2 pl-1">
                <span
                  className={cn(
                    'relative z-10 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                    reached ? 'bg-brand-500 text-white' : 'bg-ink-200 text-ink-400',
                  )}
                >
                  {current && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-50" />
                  )}
                  {reached ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </span>
                <div className="flex-1">
                  <div
                    className={cn(
                      'text-[13px]',
                      reached ? 'font-bold text-ink-900' : 'font-medium text-ink-400',
                    )}
                  >
                    {s.label}
                  </div>
                  <div className={cn('text-[11px]', reached ? 'text-ink-500' : 'text-ink-400')}>
                    {s.sub}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Items + bill */}
      {round && (
        <section className="px-5 pb-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Your order</div>
          <ul className="mt-2 space-y-1.5 rounded-2xl border border-ink-100 bg-white p-2">
            {round.lines.map((l) => {
              const item = guestItems.find((i) => i.id === l.itemId);
              if (!item) return null;
              return (
                <li
                  key={l.uid}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 via-warm-50 to-amber-50 text-lg ring-1 ring-ink-100">
                    {item.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-ink-900">
                      {l.qty}× {item.name}
                    </div>
                    {l.notes && (
                      <div className="truncate text-[11px] text-ink-500">{l.notes}</div>
                    )}
                  </div>
                  <div className="text-[13px] font-bold text-ink-900">
                    ${(l.unitPrice * l.qty).toFixed(2)}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 space-y-1.5 rounded-2xl border border-ink-100 bg-ink-50/40 p-3 text-[13px]">
            <Line label="Subtotal">${subtotal.toFixed(2)}</Line>
            <Line label="Tax (5%)">${tax.toFixed(2)}</Line>
            <Line label="Service (5%)">${service.toFixed(2)}</Line>
            <div className="my-1 border-t border-dashed border-ink-200" />
            <Line label="Total" emphasis>
              ${total.toFixed(2)}
            </Line>
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-2 px-5 py-5">
        <button
          onClick={ringWaiter}
          className="rounded-2xl border border-ink-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Bell className="h-4 w-4" />
          </span>
          <div className="mt-2 text-[13px] font-extrabold text-ink-900">Call waiter</div>
          <div className="text-[11px] text-ink-500">Get attention at your table</div>
        </button>

        <button
          onClick={requestBill}
          className={cn(
            'rounded-2xl border p-3 text-left transition hover:shadow-md',
            askedBill
              ? 'border-emerald-300 bg-emerald-50/60'
              : 'border-ink-200 bg-white hover:border-brand-300',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl ring-1',
              askedBill
                ? 'bg-emerald-500 text-white ring-emerald-500'
                : 'bg-warm-50 text-warm-600 ring-warm-100',
            )}
          >
            <Receipt className="h-4 w-4" />
          </span>
          <div className="mt-2 text-[13px] font-extrabold text-ink-900">
            {askedBill ? 'Bill requested ✓' : 'Request bill'}
          </div>
          <div className="text-[11px] text-ink-500">
            {askedBill ? 'A waiter will bring it shortly' : 'Ready to settle up'}
          </div>
        </button>
      </section>

      {/* Re-order */}
      <section className="px-5 pb-32">
        <Link
          to={`/m/${branch}/${session.table}`}
          className="flex items-center justify-between rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 p-4 transition hover:bg-brand-50"
        >
          <div>
            <div className="text-[13px] font-extrabold text-brand-700">Order another round?</div>
            <div className="mt-0.5 text-[12px] text-ink-600">
              Add more items — they'll go straight to the kitchen.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-brand-600" />
        </Link>

        {/* Feedback (after order is served) */}
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
          >
            <div className="text-[13px] font-extrabold text-amber-800">How was it?</div>
            <div className="mt-0.5 text-[12px] text-amber-700">
              A 30-second rating helps the team a lot.
            </div>
            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => submitFeedback(n)}
                  className="p-1"
                  aria-label={`Rate ${n}`}
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition',
                      feedback !== null && n <= feedback
                        ? 'text-amber-500'
                        : 'text-ink-300',
                    )}
                    fill={feedback !== null && n <= feedback ? 'currentColor' : 'transparent'}
                  />
                </button>
              ))}
            </div>
            {feedback !== null && (
              <div className="mt-2 text-center text-[12px] font-bold text-emerald-700">
                Thanks for the {feedback}-star rating!
              </div>
            )}
          </motion.div>
        )}
      </section>

      {/* Sticky footer help bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-ink-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-ink-500">
            <span className="font-bold text-ink-700">Need help?</span> Tap the call-waiter button.
          </div>
          <Link
            to={`/m/${branch}/${session.table}`}
            className="text-[12px] font-bold text-brand-600 hover:text-brand-700"
          >
            Back to menu →
          </Link>
        </div>
      </div>

      <RingModal open={showRing} onClose={() => setShowRing(false)} table={session.table} />
    </GuestShell>
  );
}

function Line({
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
                  <X className="h-3.5 w-3.5" />
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
