/**
 * Promotion discount engine.
 *
 * Given a promotion row + a cart (lines with unitPrice/qty/category/itemId)
 * and the cart subtotal, returns the discount amount (positive number,
 * clamped so it never exceeds the discountable base).
 *
 * Supported kinds:
 *   PERCENTAGE  — value% off the scoped base, capped by maxDiscount.
 *   FLAT        — flat `value` off (never more than the scoped base).
 *   BOGO        — buy-one-get-one: cheapest matching unit free for every
 *                 pair of matching units. Lowest-priced item is the free one.
 *   FREE_ITEM   — cheapest scoped item free (one), once min order met.
 *   COMBO       — bundle price: `value` is the bundle price; discount =
 *                 scoped base − value (clamped ≥ 0).
 *   HAPPY_HOUR  — same as PERCENTAGE but time-gated (gating happens in the
 *                 eligibility check, not here).
 *   LOYALTY     — treated like FLAT/PERCENTAGE depending on value semantics;
 *                 we use PERCENTAGE when value ≤ 100 else FLAT. The roadmap
 *                 models the "10th meal free" as a FLAT capped by maxDiscount.
 *   FESTIVAL    — same as PERCENTAGE/FLAT; we branch on whether maxDiscount
 *                 is set. Defaults to PERCENTAGE when value ≤ 100.
 *
 * Scope:
 *   WHOLE_ORDER — base = subtotal.
 *   ITEMS       — base = sum of lines whose itemId ∈ targetItemIds.
 *   CATEGORIES  — base = sum of lines whose category ∈ targetCategories.
 */

const round2 = (n) => Math.round(n * 100) / 100;

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

/** Expand cart lines into per-unit prices for the scoped set. */
function scopedUnits(lines, promo) {
  const inScope = (l) => {
    if (promo.scope === 'ITEMS') {
      const ids = promo.targetItemIds ?? [];
      return ids.length === 0 || (l.itemId != null && ids.includes(l.itemId));
    }
    if (promo.scope === 'CATEGORIES') {
      const cats = promo.targetCategories ?? [];
      return cats.length === 0 || (l.category != null && cats.includes(l.category));
    }
    return true; // WHOLE_ORDER
  };
  const units = [];
  for (const l of lines) {
    if (!inScope(l)) continue;
    const qty = Number(l.qty) || 1;
    const price = Number(l.unitPrice) || 0;
    for (let i = 0; i < qty; i += 1) units.push(price);
  }
  return units;
}

function scopedBase(lines, promo) {
  return round2(scopedUnits(lines, promo).reduce((s, p) => s + p, 0));
}

/**
 * @param {object} promo                       Promotion row (Prisma)
 * @param {object} ctx
 * @param {Array}  ctx.lines                   [{ itemId, category, qty, unitPrice }]
 * @param {number} ctx.subtotal                Whole-cart subtotal
 * @returns {number} discount amount (positive, clamped)
 */
export function computePromotionDiscount(promo, { lines, subtotal }) {
  const base = promo.scope === 'WHOLE_ORDER' ? round2(subtotal) : scopedBase(lines, promo);
  if (base <= 0) return 0;

  const value = num(promo.value);
  const maxDiscount = promo.maxDiscount != null ? num(promo.maxDiscount) : null;
  const kind = promo.kind;

  let discount = 0;

  switch (kind) {
    case 'PERCENTAGE':
    case 'HAPPY_HOUR': {
      discount = base * (Math.min(Math.max(value, 0), 100) / 100);
      break;
    }
    case 'FLAT': {
      discount = Math.min(value, base);
      break;
    }
    case 'BOGO': {
      // Sort scoped per-unit prices descending; every 2nd unit (the cheaper
      // of each pair) is free.
      const units = scopedUnits(lines, promo).sort((a, b) => b - a);
      for (let i = 1; i < units.length; i += 2) discount += units[i];
      break;
    }
    case 'FREE_ITEM': {
      // Cheapest scoped unit free (one).
      const units = scopedUnits(lines, promo);
      if (units.length > 0) discount = Math.min(...units);
      break;
    }
    case 'COMBO': {
      // value = bundle price; discount = base − bundle (clamp ≥ 0).
      discount = Math.max(0, base - value);
      break;
    }
    case 'LOYALTY':
    case 'FESTIVAL': {
      // Percentage when value looks like a percent (≤100 and no explicit
      // FLAT intent via maxDiscount==value); otherwise flat.
      if (value > 0 && value <= 100 && maxDiscount !== value) {
        discount = base * (value / 100);
      } else {
        discount = Math.min(value, base);
      }
      break;
    }
    default:
      discount = 0;
  }

  if (maxDiscount != null && maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  // Never discount more than the scoped base (clamp so totals never go neg).
  discount = Math.min(discount, base);
  return round2(Math.max(0, discount));
}

/* ------------------------------------------------------------------ */
/*  Eligibility                                                        */
/* ------------------------------------------------------------------ */

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Is the promotion eligible right now for the given cart + channel?
 *
 * Returns { eligible: boolean, reason?: string }.
 *
 * @param {object} promo
 * @param {object} ctx
 * @param {number} ctx.subtotal
 * @param {Array}  ctx.lines
 * @param {string} [ctx.channel]   'POS' | 'QR' | 'Online' | 'WhatsApp'
 * @param {Date}   [ctx.now]       defaults to new Date()
 * @param {string} [ctx.timezone]  branch timezone for happy-hour gating
 */
export function checkEligibility(promo, ctx) {
  const { subtotal, lines, channel, now = new Date() } = ctx;

  if (promo.status !== 'ACTIVE') {
    return { eligible: false, reason: 'PROMO_NOT_ACTIVE' };
  }

  const startsAt = new Date(promo.startsAt);
  const endsAt = new Date(promo.endsAt);
  if (now < startsAt) return { eligible: false, reason: 'PROMO_NOT_STARTED' };
  if (now > endsAt) return { eligible: false, reason: 'PROMO_EXPIRED' };

  // Min order
  if (num(promo.minOrder) > 0 && round2(subtotal) < num(promo.minOrder)) {
    return { eligible: false, reason: 'PROMO_MIN_ORDER_NOT_MET' };
  }

  // Usage limit
  if (promo.usageLimit > 0 && promo.used >= promo.usageLimit) {
    return { eligible: false, reason: 'PROMO_USAGE_LIMIT_REACHED' };
  }

  // Channel restriction
  if (Array.isArray(promo.channels) && promo.channels.length > 0 && channel) {
    const allowed = promo.channels.map((c) => c.toUpperCase());
    if (!allowed.includes('ALL') && !allowed.includes(channel.toUpperCase())) {
      return { eligible: false, reason: 'PROMO_CHANNEL_NOT_ALLOWED' };
    }
  }

  // Day-of-week + time-of-day gating (offers / happy hour).
  // Use branch-local time. We approximate with the host clock here; the
  // service passes a tz-adjusted `now` when available.
  if (Array.isArray(promo.days) && promo.days.length > 0) {
    const dayCode = DAY_CODES[now.getDay()];
    if (!promo.days.includes(dayCode)) {
      return { eligible: false, reason: 'PROMO_DAY_NOT_ALLOWED' };
    }
  }
  if (promo.startTime && promo.endTime) {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Handle windows that don't wrap midnight (the common case).
    if (promo.startTime <= promo.endTime) {
      if (hhmm < promo.startTime || hhmm > promo.endTime) {
        return { eligible: false, reason: 'PROMO_OUTSIDE_HOURS' };
      }
    } else {
      // Wrapping window (e.g. 22:00–02:00)
      if (hhmm < promo.startTime && hhmm > promo.endTime) {
        return { eligible: false, reason: 'PROMO_OUTSIDE_HOURS' };
      }
    }
  }

  // Scope must actually match something
  if (promo.scope !== 'WHOLE_ORDER') {
    const base = scopedBase(lines, promo);
    if (base <= 0) return { eligible: false, reason: 'PROMO_NO_MATCHING_ITEMS' };
  }

  return { eligible: true };
}
