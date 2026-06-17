import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Lightbulb, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { aiApi, type AiSuggestion, type AiUsage, type ChatMessage } from '../services/ai';
import { branchesStore } from '../stores/branches';

const KIND_TONE: Record<string, string> = {
  pricing: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inventory: 'bg-cool-50 text-cool-700 ring-cool-200',
  staffing: 'bg-amber-50 text-amber-700 ring-amber-200',
  menu: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function AiHelper() {
  const [open, setOpen] = useState(false);
  const branches = branchesStore.use();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lazy-load suggestions + usage the first time the panel opens.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    aiApi.usage().then(setUsage).catch(() => {});
    aiApi
      .suggestions(branches.activeId ?? undefined)
      .then((r) => setSuggestions(r.suggestions))
      .catch(() => {});
  }, [open, loaded, branches.activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setSending(true);
    try {
      const res = await aiApi.chat({ message, history, branchId: branches.activeId ?? undefined });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
      setUsage(res.usage);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'AI_QUOTA_EXCEEDED') {
        setQuotaBlocked(true);
        setMessages((m) => [...m, { role: 'assistant', content: err.message ?? 'AI quota reached.' }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: err.message ?? 'Something went wrong. Try again.' }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-brand-500/40 transition hover:-translate-y-0.5"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        AI Helper
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-ink-900/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-0"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed bottom-6 right-6 z-50 flex h-[560px] max-h-[80vh] w-[calc(100vw-3rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="relative flex items-center gap-3 bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-4 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold">Vuedine AI</div>
                  <div className="text-[11px] text-white/85">
                    {usage ? `${usage.remaining.toLocaleString('en-IN')} of ${usage.limit.toLocaleString('en-IN')} requests left` : 'Co-pilot for owners'}
                  </div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50/40 p-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-[13px] text-ink-600">
                      Ask about sales, pricing, staffing or your best sellers — grounded in your real data. Or start with a suggestion:
                    </p>
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => send(`Tell me more: ${s.title}`)}
                        className="block w-full rounded-xl border border-ink-100 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1', KIND_TONE[s.kind] ?? KIND_TONE.menu)}>
                            <Lightbulb className="h-2.5 w-2.5" />
                            {s.kind}
                          </span>
                          <span className="ml-auto text-[10px] font-bold text-ink-400">{s.confidence}</span>
                        </div>
                        <div className="mt-1.5 text-[13px] font-bold text-ink-900">{s.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-600">{s.detail}</div>
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm',
                        m.role === 'user' ? 'bg-brand-500 text-white' : 'border border-ink-100 bg-white text-ink-800',
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-ink-100 bg-white px-3.5 py-2.5 shadow-sm">
                      <span className="flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}

                {quotaBlocked && (
                  <Link
                    to="/dashboard/subscription"
                    onClick={() => setOpen(false)}
                    className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-[12px] font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Upgrade your plan to keep using Vuedine AI →
                  </Link>
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
                className="flex items-end gap-2 border-t border-ink-100 bg-white p-3"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Ask Vuedine AI…"
                  disabled={quotaBlocked}
                  className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:bg-ink-50"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim() || quotaBlocked}
                  aria-label="Send"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-md transition hover:bg-brand-600 disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
