import { env } from '../../config/index.js';

import { CATALOG, getCatalogEntry } from './integrations.catalog.js';

/**
 * Merge the static catalog with a tenant's Integration rows into the shape
 * the marketplace UI consumes. Credentials are NEVER serialized — we only
 * expose which field keys are set (`connectedFields`).
 */

function webhookUrlFor(entry, tenantSlug) {
  if (!entry.webhookProvider) return null;
  const base = env.PUBLIC_QR_BASE ?? 'http://localhost:4000';
  const slug = tenantSlug ? `?tenant=${encodeURIComponent(tenantSlug)}` : '';
  return `${base.replace(/\/$/, '')}/v1/webhooks/${entry.webhookProvider}${slug}`;
}

function deriveStatus(entry, row) {
  if (row?.status === 'CONNECTED') return 'CONNECTED';
  if (row?.status === 'ERROR') return 'ERROR';
  if (entry.builtin) return 'CONNECTED';
  if (entry.comingSoon) return 'COMING_SOON';
  return 'AVAILABLE';
}

function connectedFields(entry, row) {
  const creds = row?.credentials ?? {};
  return entry.fields.filter((f) => creds[f.key] != null).map((f) => f.key);
}

export function serializeIntegration(entry, row, { tenantSlug } = {}) {
  return {
    provider: entry.provider,
    name: entry.name,
    category: entry.category,
    popular: entry.popular,
    builtin: entry.builtin,
    comingSoon: entry.comingSoon,
    supportsTest: entry.supportsTest,
    supportsSync: entry.supportsSync,
    fields: entry.fields.map((f) => ({ key: f.key, label: f.label, secret: !!f.secret })),
    status: deriveStatus(entry, row),
    connected: deriveStatus(entry, row) === 'CONNECTED',
    connectedFields: connectedFields(entry, row),
    config: row?.config ?? null,
    webhookUrl: webhookUrlFor(entry, tenantSlug),
    lastSyncAt: row?.lastSyncAt ?? null,
    lastErrorAt: row?.lastErrorAt ?? null,
    lastError: row?.lastError ?? null,
  };
}

/** Full catalog merged with the tenant's rows (rows keyed by provider). */
export function serializeCatalog(rows, { tenantSlug } = {}) {
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return CATALOG.map((entry) => serializeIntegration(entry, byProvider.get(entry.provider), { tenantSlug }));
}

export { getCatalogEntry };
