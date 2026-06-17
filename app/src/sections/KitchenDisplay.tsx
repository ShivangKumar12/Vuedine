import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChefHat, Flame, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Reveal } from '../components/Reveal';
import { SectionLabel } from '../components/SectionLabel';

type Ticket = {
  id: number;
  table: string;
  state: 'new' | 'prep' | 'ready';
  items: string[];
  age: number;
};

const seed: Ticket[] = [
  { id: 1284, table: 'T-7', state: 'new', items: ['Margherita', 'Iced Latte'], age: 1 },
  { id: 1285, table: 'T-12', state: 'prep', items: ['Truffle Burger', 'Caesar Salad', 'Coke'], age: 5 },
  { id: 1286, table: 'T-3', state: 'prep', items: ['Carbonara', 'Tiramisu'], age: 3 },
  { id: 1287, table: 'TKW', state: 'ready', items: ['Sushi Set', 'Miso Soup'], age: 9 },
  { id: 1288, table: 'T-9', state: 'new', items: ['Burrata', 'Sparkling'], age: 0 },
  { id: 1289, table: 'T-1', state: 'ready', items: ['Pinot 2x', 'Cheese Plate'], age: 7 },
];

const stateMeta: Record<Ticket['state'], { label: string; classes: string; dot: string }> = {
  new: { label: 'NEW', classes: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500' },
  prep: { label: 'PREPARING', classes: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500' },
  ready: { label: 'READY', classes: 'border-brand-200 bg-brand-50', dot: 'bg-brand-500' },
};

export function KitchenDisplay() {
  const [tickets, setTickets] = useState<Ticket[]>(seed);

  useEffect(() => {
    const id = setInterval(() => {
      setTickets((prev) => {
        const next = prev.map((t) => ({ ...t, age: t.age + 1 }));
        const newest = [...next].sort((a, b) => b.age - a.age);
        const promotePrep = newest.find((t) => t.state === 'new');
        const promoteReady = newest.find((t) => t.state === 'prep');
        const removeIdx = next.findIndex((t) => t.state === 'ready');
        let updated = next.map((t) => {
          if (t.id === promotePrep?.id) return { ...t, state: 'prep' as const };
          if (t.id === promoteReady?.id) return { ...t, state: 'ready' as const };
          return t;
        });
        if (removeIdx >= 0 && Math.random() > 0.4) {
          updated = updated.filter((_, i) => i !== removeIdx);
          const newId = (updated[updated.length - 1]?.id ?? 1290) + 1;
          const dishes = [
            ['Spicy Tuna Roll', 'Edamame'],
            ['Lasagna', 'Garlic Bread'],
            ['Pad Thai', 'Mango Lassi'],
            ['Risotto', 'Bruschetta'],
            ['Chicken Tikka', 'Naan'],
          ];
          const tables = ['T-2', 'T-4', 'T-5', 'T-8', 'T-11', 'TKW'];
          updated.push({
            id: newId,
            table: tables[Math.floor(Math.random() * tables.length)],
            state: 'new',
            items: dishes[Math.floor(Math.random() * dishes.length)],
            age: 0,
          });
        }
        return updated.slice(-6);
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-0 top-1/2 h-[420px] w-[600px] -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-100/60 to-warm-50 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
        <Reveal>
          <SectionLabel dot="brand" className="mb-4">
            Kitchen Display System · live
          </SectionLabel>
          <h2 className="display text-4xl font-extrabold text-ink-900 md:text-6xl">
            A command center your <span className="gradient-text-warm">chefs</span> will love.
          </h2>
          <p className="mt-4 text-ink-600">
            Tickets pulse, timers count, sounds chime. Stations stay independent. Recipes stay accurate. The whole kitchen runs at one tempo, even on the loudest Saturday night.
          </p>
          <ul className="mt-7 space-y-3 text-sm">
            {[
              { icon: Flame, text: 'Auto-routing by station: hot, cold, bar, dessert' },
              { icon: Volume2, text: 'Audio + visual cues for new and overdue tickets' },
              { icon: CheckCircle2, text: 'Tap to bump · supports physical bump bars' },
              { icon: ChefHat, text: 'Offline-first · 0 dropped orders, ever' },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100">
                    <Icon className="h-4 w-4 text-brand-600" />
                  </span>
                  <span className="font-medium text-ink-700">{b.text}</span>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="app-frame relative overflow-hidden p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-ink-500">Hot Kitchen · Bandra</span>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live · 6 tickets
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {tickets.map((t) => {
                  const meta = stateMeta[t.state];
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, y: -12 }}
                      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
                      className={`flex flex-col rounded-xl border-2 p-3 ${meta.classes}`}
                    >
                      <div className="flex items-center justify-between text-ink-900">
                        <span className="text-sm font-bold">#{t.id}</span>
                        <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold ring-1 ring-ink-200">
                          {t.table}
                        </span>
                      </div>
                      <ul className="mt-2 flex-1 space-y-1 text-xs text-ink-700">
                        {t.items.map((it) => (
                          <li key={it} className="flex items-center gap-2 font-medium">
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {it}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-ink-700">{meta.label}</span>
                        <span className={t.age > 7 ? 'text-rose-600' : 'text-ink-500'}>{t.age}m</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
