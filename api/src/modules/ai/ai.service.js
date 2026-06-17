import { buildContext, summarize } from './ai.context.js';
import { aiProvider } from './ai.provider.js';
import { buildSuggestions } from './ai.suggestions.js';
import { aiUsage } from './ai.usage.js';

/**
 * Vuedine AI service — context-grounded chat + smart suggestions.
 *
 * Chat consumes AI quota (Phase K); suggestions are free (they back the
 * dashboard surface and are polled). Everything is grounded on the tenant's
 * real aggregates via ai.context.
 */
export const aiService = {
  async chat({ tenantId, branchId, message, history = [] }) {
    await aiUsage.assertQuota(tenantId);
    const ctx = await buildContext({ tenantId, branchId });
    const { reply, engine } = await aiProvider.respond({ tenantId, ctx, message, history });
    const used = await aiUsage.record(tenantId);
    const { limit } = await aiUsage.snapshot(tenantId);
    return {
      reply,
      engine,
      context: summarize(ctx),
      usage: { used, limit, remaining: Math.max(0, limit - used) },
    };
  },

  async suggestions({ tenantId, branchId }) {
    const ctx = await buildContext({ tenantId, branchId });
    return {
      suggestions: buildSuggestions(ctx),
      context: {
        totalSales: ctx.totalSales,
        orderCount: ctx.orderCount,
        avgOrderValue: ctx.avgOrderValue,
        topItems: ctx.topItems,
        peakHour: ctx.peakHour,
        rangeDays: ctx.rangeDays,
      },
    };
  },

  usage({ tenantId }) {
    return aiUsage.snapshot(tenantId);
  },
};
