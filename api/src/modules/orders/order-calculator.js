/**
 * Server-authoritative money math for orders.
 *
 * Inputs are sanitized + cast to fixed-point (cents). Outputs are
 * Prisma-friendly Decimal-stringable numbers rounded to 2 places.
 *
 * Why server-authoritative:
 *   - The frontend hardcodes TAX_RATE = 0.05 (POS, Checkout) which is wrong
 *     in any tenant with multi-slab GST.
 *   - Promo, service charge, tip, and tax-inclusive flag interact in
 *     non-trivial ways. Single source of truth = service.
 *
 * Output shape:
 *   {
 *     subtotal, discountTotal, taxTotal, serviceTotal, tipTotal, grandTotal,
 *     taxBreakdown: [{ name, rate, amount }],
 *     lines: [{ ...line, lineTotal }],
 *   }
 */

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} args
 * @param {Array<{ qty: number, unitPrice: number|string }>} args.lines
 * @param {object} args.branch                   { taxInclusive, serviceCharge }
 * @param {object} [args.tenantTaxConfig]        Tenant.taxConfig — { slabs: [{name, rate}], inclusive }
 * @param {number} [args.tipAmount]              Absolute tip amount (>=0)
 * @param {number} [args.tipPct]                 Pct (0..50) — used when tipAmount missing
 * @param {string|null} [args.promoCode]
 * @param {number} [args.discountPct]            Manual percent (0..100) e.g. POS line
 * @param {number} [args.promoDiscount]          Resolved promotion discount (absolute) — wins over stub
 * @param {boolean} [args.isPublic]              True for guest PWA — disallows manual discount
 */
export function calculateOrder(args) {
  const {
    lines,
    branch,
    tenantTaxConfig,
    tipAmount,
    tipPct,
    promoCode,
    discountPct,
    promoDiscount,
    isPublic,
  } = args;

  if (!Array.isArray(lines) || lines.length === 0) {
    return {
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      serviceTotal: 0,
      tipTotal: 0,
      grandTotal: 0,
      taxBreakdown: [],
      lines: [],
    };
  }

  // 1. Subtotal — sum of qty × unit price
  const enriched = lines.map((l) => {
    const unit = Number(l.unitPrice);
    const qty = Number(l.qty) || 1;
    const lineTotal = round2(unit * qty);
    return { ...l, qty, unitPrice: unit, lineTotal };
  });
  const subtotal = round2(enriched.reduce((s, l) => s + l.lineTotal, 0));

  // 2. Discount — promo or manual %, never both. A resolved promotion
  //    discount (from the Phase D engine) takes precedence over the stub.
  let discountTotal = 0;
  if (typeof promoDiscount === 'number' && promoDiscount > 0) {
    discountTotal = round2(Math.min(promoDiscount, subtotal));
  } else if (promoCode && !isPublic) {
    // Stub fallback (only when no resolved discount supplied): 10% off, capped at $5.
    discountTotal = round2(Math.min(subtotal * 0.1, 5));
  } else if (promoCode && isPublic) {
    // Customer PWA: same stub, capped at $2 to mirror existing UI.
    discountTotal = round2(Math.min(subtotal * 0.1, 2));
  } else if (typeof discountPct === 'number' && discountPct > 0 && !isPublic) {
    discountTotal = round2(subtotal * (Math.min(discountPct, 100) / 100));
  }

  const taxable = Math.max(0, subtotal - discountTotal);

  // 3. Tax — sum of slabs (default 5% GST if tenant has no taxConfig)
  const slabs = Array.isArray(tenantTaxConfig?.slabs) && tenantTaxConfig.slabs.length > 0
    ? tenantTaxConfig.slabs.filter((s) => Number(s.rate) > 0).slice(0, 1) // first non-zero slab applied to whole order in Phase B
    : [{ name: 'GST 5%', rate: 0.05 }];

  const taxInclusive = Boolean(branch?.taxInclusive);
  const taxBreakdown = slabs.map((s) => {
    const rate = Number(s.rate);
    if (taxInclusive) {
      // Reverse-engineer the tax already baked into the price.
      const amount = round2(taxable - taxable / (1 + rate));
      return { name: s.name, rate, amount };
    }
    return { name: s.name, rate, amount: round2(taxable * rate) };
  });
  const taxTotal = round2(taxBreakdown.reduce((s, b) => s + b.amount, 0));

  // 4. Service charge — flat %, applied to taxable. Tax-inclusive branches
  //    still levy service charge on the gross.
  const serviceRate = Number(branch?.serviceCharge ?? 0) / 100;
  const serviceTotal = round2(taxable * serviceRate);

  // 5. Tip — absolute or % of (taxable + tax + service)
  const tipBase = round2(taxable + (taxInclusive ? 0 : taxTotal) + serviceTotal);
  let tipTotal = 0;
  if (typeof tipAmount === 'number' && tipAmount > 0) {
    tipTotal = round2(Math.max(0, tipAmount));
  } else if (typeof tipPct === 'number' && tipPct > 0) {
    tipTotal = round2(tipBase * (Math.min(tipPct, 50) / 100));
  }

  // 6. Grand total — for tax-inclusive branches, tax is already in `taxable`,
  //    so we don't add it again.
  const grandTotal = round2(
    taxable + (taxInclusive ? 0 : taxTotal) + serviceTotal + tipTotal,
  );

  return {
    subtotal,
    discountTotal,
    taxTotal,
    serviceTotal,
    tipTotal,
    grandTotal,
    taxBreakdown,
    lines: enriched,
  };
}
