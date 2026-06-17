/**
 * Provider catalog — the canonical registry of every integration the
 * marketplace exposes. The DB only stores *connection state* per tenant;
 * this catalog supplies the static metadata (category, credential field
 * specs, capabilities) the service merges with each tenant's rows.
 *
 * `fields[].secret` flags values that must be encrypted at rest (crypto.js)
 * and never returned to the client.
 */

/** @typedef {{ key: string, label: string, secret?: boolean, placeholder?: string }} CredField */

export const CATEGORY_BY_PROVIDER = {};

function def(provider, category, opts = {}) {
  return {
    provider,
    category,
    name: opts.name ?? provider,
    popular: opts.popular ?? false,
    builtin: opts.builtin ?? false, // always-connected (no creds), e.g. Vuedine AI
    comingSoon: opts.comingSoon ?? false,
    fields: opts.fields ?? [],
    supportsTest: opts.supportsTest ?? (opts.fields?.length ?? 0) > 0,
    supportsSync: opts.supportsSync ?? false,
    webhookProvider: opts.webhookProvider ?? null, // path segment under /v1/webhooks/*
  };
}

export const CATALOG = [
  // ---- Aggregators ----
  def('zomato', 'AGGREGATOR', {
    name: 'Zomato',
    popular: true,
    supportsSync: true,
    webhookProvider: 'zomato',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID' },
      { key: 'api_key', label: 'API Key', secret: true },
    ],
  }),
  def('swiggy', 'AGGREGATOR', {
    name: 'Swiggy',
    popular: true,
    supportsSync: true,
    webhookProvider: 'swiggy',
    fields: [
      { key: 'partner_id', label: 'Partner ID' },
      { key: 'secret', label: 'Secret', secret: true },
    ],
  }),
  def('ubereats', 'AGGREGATOR', { name: 'Uber Eats' }),
  def('doordash', 'AGGREGATOR', { name: 'DoorDash' }),
  def('magicpin', 'AGGREGATOR', { name: 'Magicpin' }),

  // ---- Payments ----
  def('razorpay', 'PAYMENTS', {
    name: 'Razorpay',
    popular: true,
    webhookProvider: 'razorpay',
    fields: [
      { key: 'key_id', label: 'Key ID' },
      { key: 'key_secret', label: 'Key Secret', secret: true },
    ],
  }),
  def('stripe', 'PAYMENTS', { name: 'Stripe' }),
  def('payu', 'PAYMENTS', { name: 'PayU' }),
  def('phonepe', 'PAYMENTS', { name: 'PhonePe Business' }),
  def('paytm', 'PAYMENTS', { name: 'Paytm Business' }),

  // ---- Messaging ----
  def('whatsapp', 'MESSAGING', {
    name: 'WhatsApp Business',
    popular: true,
    webhookProvider: 'whatsapp',
    fields: [
      { key: 'phone_id', label: 'Phone Number ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  }),
  def('msg91', 'MESSAGING', {
    name: 'MSG91',
    fields: [
      { key: 'auth_key', label: 'Auth Key', secret: true },
      { key: 'sender_id', label: 'Sender ID' },
    ],
  }),
  def('twilio', 'MESSAGING', { name: 'Twilio' }),
  def('sendgrid', 'MESSAGING', { name: 'SendGrid' }),

  // ---- Accounting ----
  def('tally', 'ACCOUNTING', { name: 'Tally', supportsSync: true }),
  def('zoho', 'ACCOUNTING', { name: 'Zoho Books', supportsSync: true }),
  def('quickbooks', 'ACCOUNTING', { name: 'QuickBooks', supportsSync: true }),

  // ---- Reviews ----
  def('google-reviews', 'REVIEWS', {
    name: 'Google Reviews',
    fields: [{ key: 'place_id', label: 'Google Place ID' }],
  }),
  def('tripadvisor', 'REVIEWS', { name: 'TripAdvisor' }),

  // ---- Marketing ----
  def('mailchimp', 'MARKETING', { name: 'Mailchimp', supportsSync: true }),
  def('meta-ads', 'MARKETING', { name: 'Meta Ads' }),
  def('google-ads', 'MARKETING', { name: 'Google Ads' }),

  // ---- Hardware ----
  def('epson-printers', 'HARDWARE', { name: 'Epson Cloud' }),
  def('star-micronics', 'HARDWARE', { name: 'Star Micronics' }),

  // ---- AI ----
  def('vuedine-ai', 'AI', { name: 'Vuedine AI', popular: true, builtin: true }),
  def('openai', 'AI', {
    name: 'Bring your own OpenAI',
    fields: [{ key: 'api_key', label: 'OpenAI API Key', secret: true }],
  }),
];

const BY_PROVIDER = new Map(CATALOG.map((c) => [c.provider, c]));
for (const c of CATALOG) CATEGORY_BY_PROVIDER[c.provider] = c.category;

export function getCatalogEntry(provider) {
  return BY_PROVIDER.get(provider) ?? null;
}

/** Field keys that must be encrypted for a given provider. */
export function secretKeys(provider) {
  return (getCatalogEntry(provider)?.fields ?? []).filter((f) => f.secret).map((f) => f.key);
}
