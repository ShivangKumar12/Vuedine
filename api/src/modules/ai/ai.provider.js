import { logger } from '../../config/logger.js';
import { integrationsService } from '../integrations/integrations.service.js';

import { summarize } from './ai.context.js';

/**
 * LLM provider adapter.
 *
 * If the tenant connected the `openai` integration (Phase J) with an API key,
 * we call OpenAI's chat completions grounded on the tenant context. Otherwise
 * we fall back to a deterministic, context-grounded local responder so the
 * assistant works out-of-the-box without any external dependency.
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

function systemPrompt(ctx) {
  return [
    'You are Vuedine AI, a concise co-pilot for restaurant owners.',
    'Only use the figures provided in CONTEXT. Never invent numbers. Currency is INR (₹).',
    'Answer in 2-4 short sentences with one concrete, actionable recommendation.',
    `CONTEXT: ${summarize(ctx)}`,
  ].join('\n');
}

async function callOpenAI({ apiKey, ctx, message, history }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const messages = [
      { role: 'system', content: systemPrompt(ctx) },
      ...history.slice(-6).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') })),
      { role: 'user', content: message },
    ];
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, temperature: 0.4, max_tokens: 300 }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Deterministic grounded fallback — genuinely useful, no external call. */
export function localReply({ ctx, message }) {
  const q = message.toLowerCase();
  const top = ctx.topItems[0];

  if (/sell|popular|best|top/.test(q)) {
    return top
      ? `Your top seller over the last ${ctx.rangeDays} days is ${top.emoji} ${top.name} with ${top.sold} sold. It's a safe candidate for a small price test or a featured slot on the QR menu.`
      : `There aren't enough completed orders yet to rank items. Once sales come in I'll highlight your best performers.`;
  }
  if (/revenue|sales|earn|money|how much|today|week/.test(q)) {
    return `Over the last ${ctx.rangeDays} days you've done ₹${ctx.totalSales} across ${ctx.completedCount} completed orders — that's an average ticket of ₹${ctx.avgOrderValue}. ${
      ctx.peakHour !== null ? `Revenue peaks around ${ctx.peakHour}:00, so protect staffing there.` : ''
    }`.trim();
  }
  if (/staff|busy|peak|rush|roster|shift/.test(q)) {
    return ctx.peakHour !== null
      ? `Your busiest window is around ${ctx.peakHour}:00. Add one extra hand ~30 minutes before to keep ticket times down without over-staffing the rest of the day.`
      : `I need a bit more order history to pinpoint your rush. Keep taking orders and I'll map your peak hours.`;
  }
  if (/price|pricing|margin|increase|raise/.test(q)) {
    return top
      ? `For pricing, start with ${top.name} (${top.sold} sold) — a 5–8% test on a proven favourite usually holds demand and lifts margin. Avoid raising slow movers; bundle those instead.`
      : `Once a few items build a sales history I can recommend specific price tests grounded in your volumes.`;
  }
  if (/cancel|refund|complain/.test(q)) {
    return `You've had ${ctx.cancelledCount} cancellations out of ${ctx.orderCount} orders in the last ${ctx.rangeDays} days. If that's trending up, check kitchen capacity at peak and aggregator item-availability sync.`;
  }

  // Default: lead with the headline number + a nudge.
  return `Here's where you stand over the last ${ctx.rangeDays} days: ₹${ctx.totalSales} revenue, ${ctx.completedCount} completed orders, avg ticket ₹${ctx.avgOrderValue}.${
    top ? ` ${top.name} is leading sales.` : ''
  } Ask me about pricing, staffing, inventory or your best sellers.`;
}

export const aiProvider = {
  /** Returns { reply, engine }. Tries OpenAI when configured, else local. */
  async respond({ tenantId, ctx, message, history = [] }) {
    try {
      const conn = await integrationsService.getInternalCredentials({ tenantId, provider: 'openai' });
      const apiKey = conn?.row?.status === 'CONNECTED' ? conn.credentials?.api_key : null;
      if (apiKey) {
        const reply = await callOpenAI({ apiKey, ctx, message, history });
        if (reply) return { reply, engine: 'openai' };
      }
    } catch (err) {
      logger.warn('ai.openai_failed_fallback', { message: err.message });
    }
    return { reply: localReply({ ctx, message }), engine: 'local' };
  },
};
