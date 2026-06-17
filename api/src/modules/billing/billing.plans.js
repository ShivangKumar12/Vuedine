/**
 * Plan catalog + per-plan quota limits.
 *
 * Prices are per-outlet, in INR. `yearly` is the per-month equivalent when
 * billed annually (~20% off). Limits drive quota enforcement on the
 * Subscription row (set at provision / plan-change time).
 */

export const DEFAULT_PLAN = 'growth';
export const TRIAL_DAYS = 14;

/** Quota limits applied to a Subscription when a tenant is on each plan. */
export const PLAN_LIMITS = {
  starter: { seatLimit: 5, branchLimit: 1, storageLimitGb: 5, aiQuota: 0 },
  growth: { seatLimit: 50, branchLimit: 3, storageLimitGb: 25, aiQuota: 50000 },
  enterprise: { seatLimit: 100000, branchLimit: 100000, storageLimitGb: 1000, aiQuota: 1000000 },
};

/** Order for upgrade/downgrade comparison. */
export const PLAN_ORDER = ['starter', 'growth', 'enterprise'];

export const PLAN_DEFS = [
  {
    slug: 'starter',
    name: 'Starter',
    blurb: 'For new outlets just getting set up',
    monthly: 999,
    yearly: 799,
    active: true,
    features: [
      { label: 'Smart POS · unlimited bills', included: true },
      { label: 'QR ordering · up to 25 tables', included: '25 tables' },
      { label: 'KDS · 1 station', included: '1 station' },
      { label: 'Daily email reports', included: true },
      { label: '5 staff seats', included: '5 seats' },
      { label: 'Inventory + recipe', included: false },
      { label: 'Multi-branch', included: false },
      { label: 'Vuedine AI insights', included: false },
      { label: 'Priority 24×7 support', included: false },
    ],
  },
  {
    slug: 'growth',
    name: 'Growth',
    blurb: 'For 1–3 outlet brands · most popular',
    monthly: 2499,
    yearly: 1999,
    active: true,
    features: [
      { label: 'Everything in Starter', included: true },
      { label: 'Unlimited tables · multi-station KDS', included: true },
      { label: 'Inventory + recipe + wastage', included: true },
      { label: 'Loyalty + CRM + campaigns', included: true },
      { label: 'Up to 3 outlets', included: '3 outlets' },
      { label: 'Vuedine AI · daily insights', included: true },
      { label: 'Aggregator integrations', included: true },
      { label: 'Custom roles + audit logs', included: false },
      { label: 'SSO · SAML · IP allowlisting', included: false },
    ],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    blurb: 'For chains, franchises and groups',
    monthly: 0,
    yearly: 0,
    active: true,
    features: [
      { label: 'Everything in Growth', included: true },
      { label: 'Unlimited outlets · central kitchen', included: 'Unlimited' },
      { label: 'Custom roles + audit logs', included: true },
      { label: 'SSO · SAML · IP allowlisting', included: true },
      { label: 'Dedicated success manager', included: true },
      { label: 'Vuedine AI · custom models', included: true },
      { label: '99.99% SLA · priority support', included: true },
      { label: 'On-prem / private cloud option', included: true },
      { label: 'Custom contract terms', included: true },
    ],
  },
];

/** Add-on catalog (toggled on the Subscription.meta.addons array). */
export const ADDON_DEFS = [
  { id: 'priority', name: 'Priority support', desc: '24×7 phone + WhatsApp · 1 hr SLA', price: 1499 },
  { id: 'whatsapp', name: 'WhatsApp Business · extra 5k msgs', desc: 'Top-up beyond your monthly allowance', price: 999 },
  { id: 'extra-branch', name: 'Extra outlet slot', desc: 'Add an outlet beyond your plan limit', price: 1999 },
];

export function planLimits(slug) {
  return PLAN_LIMITS[slug] ?? PLAN_LIMITS[DEFAULT_PLAN];
}

export function isUpgrade(fromSlug, toSlug) {
  return PLAN_ORDER.indexOf(toSlug) > PLAN_ORDER.indexOf(fromSlug);
}
