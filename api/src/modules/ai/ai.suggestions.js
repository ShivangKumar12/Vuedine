/**
 * Rule-driven smart suggestions derived from the grounded context.
 *
 * These are deterministic and explainable (no LLM needed). When an OpenAI
 * key is configured the chat assistant can elaborate on them, but the
 * suggestions themselves are anchored to real aggregates so they're always
 * defensible.
 */

function fmtHour(h) {
  if (h === null || h === undefined) return 'peak hours';
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${am ? 'am' : 'pm'}`;
}

export function buildSuggestions(ctx) {
  const out = [];

  // Pricing — lean on the top seller's pull.
  if (ctx.topItems[0] && ctx.topItems[0].sold > 0) {
    const t = ctx.topItems[0];
    out.push({
      id: 'pricing-top',
      kind: 'pricing',
      title: `Test a small price lift on ${t.name}`,
      detail: `${t.emoji} ${t.name} is your #1 seller (${t.sold} sold in ${ctx.rangeDays} days). A 5–8% price test rarely dents demand on a proven favourite and drops straight to margin.`,
      impact: 'Revenue',
      confidence: ctx.topItems[0].sold > 20 ? 'High' : 'Medium',
    });
  }

  // Menu — prune or promote the weakest of the top list.
  if (ctx.topItems.length >= 3) {
    const weak = ctx.topItems[ctx.topItems.length - 1];
    out.push({
      id: 'menu-weak',
      kind: 'menu',
      title: `Bundle ${weak.name} to lift attach rate`,
      detail: `${weak.emoji} ${weak.name} trails your other bestsellers. Pair it as an add-on with ${ctx.topItems[0].name} to raise average order value (currently ₹${ctx.avgOrderValue}).`,
      impact: 'AOV',
      confidence: 'Medium',
    });
  }

  // Staffing — peak hour.
  if (ctx.peakHour !== null) {
    out.push({
      id: 'staffing-peak',
      kind: 'staffing',
      title: `Add cover around ${fmtHour(ctx.peakHour)}`,
      detail: `Your revenue peaks near ${fmtHour(ctx.peakHour)}. Rostering one extra hand 30 minutes before the rush protects ticket times and upsell quality.`,
      impact: 'Service',
      confidence: 'Medium',
    });
  }

  // Inventory — prep ahead for top sellers.
  if (ctx.topItems[0] && ctx.topItems[0].sold > 0) {
    out.push({
      id: 'inventory-prep',
      kind: 'inventory',
      title: 'Prep your top 3 ahead of service',
      detail: `${ctx.topItems
        .slice(0, 3)
        .map((t) => t.name)
        .join(', ')} drive most volume. Batch-prep their components before the rush to avoid 86ing and slow tickets.`,
      impact: 'Operations',
      confidence: 'High',
    });
  }

  // Cancellations — flag if elevated.
  if (ctx.orderCount > 0 && ctx.cancelledCount / Math.max(1, ctx.orderCount) > 0.1) {
    out.push({
      id: 'ops-cancellations',
      kind: 'staffing',
      title: 'Cancellation rate is above 10%',
      detail: `${ctx.cancelledCount} of ${ctx.orderCount} orders were cancelled. Review kitchen capacity at peak and item availability sync with aggregators.`,
      impact: 'Retention',
      confidence: 'High',
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'empty',
      kind: 'menu',
      title: 'Not enough data yet',
      detail: 'Once a few orders come through, Vuedine AI will surface pricing, staffing and inventory moves grounded in your real numbers.',
      impact: '—',
      confidence: 'Low',
    });
  }

  return out;
}
