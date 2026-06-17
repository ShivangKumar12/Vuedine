import { randomBytes } from 'node:crypto';

import { prisma } from '../../db/prisma.js';
import { enqueueIntegrationSync } from '../../queues/integration.queue.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion } from '../../utils/cache.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import { auditService } from '../audit/audit.service.js';

import { getAdapter } from './integrations.adapters.js';
import { getCatalogEntry, secretKeys } from './integrations.catalog.js';
import { integrationsRepo } from './integrations.repository.js';
import { serializeCatalog, serializeIntegration } from './integrations.serializer.js';

const CACHE_PREFIX = 'integrations';

async function tenantSlug(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return t?.slug ?? null;
}

function entryOrThrow(provider) {
  const entry = getCatalogEntry(provider);
  if (!entry) throw AppError.notFound('Unknown integration provider', 'INTEGRATION_NOT_FOUND');
  return entry;
}

/** Encrypt only the fields flagged `secret` in the catalog; keep the rest plain. */
function encryptCredentials(provider, credentials) {
  const secrets = new Set(secretKeys(provider));
  const out = {};
  for (const [k, v] of Object.entries(credentials ?? {})) {
    if (v == null || v === '') continue;
    out[k] = secrets.has(k) ? encrypt(String(v)) : v;
  }
  return out;
}

/** Decrypt secret fields for adapter use (never returned to the client). */
function decryptCredentials(provider, stored) {
  const secrets = new Set(secretKeys(provider));
  const out = {};
  for (const [k, v] of Object.entries(stored ?? {})) {
    out[k] = secrets.has(k) && typeof v === 'string' ? safeDecrypt(v) : v;
  }
  return out;
}

function safeDecrypt(v) {
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

export const integrationsService = {
  async list({ tenantId }) {
    const [rows, slug] = await Promise.all([integrationsRepo.list({ tenantId }), tenantSlug(tenantId)]);
    return serializeCatalog(rows, { tenantSlug: slug });
  },

  async get({ tenantId, provider }) {
    const entry = entryOrThrow(provider);
    const [row, slug] = await Promise.all([
      integrationsRepo.findByProvider({ tenantId, provider }),
      tenantSlug(tenantId),
    ]);
    return serializeIntegration(entry, row, { tenantSlug: slug });
  },

  async connect({ tenantId, provider, branchId = null, credentials, config, actor }) {
    const entry = entryOrThrow(provider);
    if (entry.comingSoon) {
      throw AppError.badRequest('This integration is not available yet', 'INTEGRATION_COMING_SOON');
    }
    if (entry.builtin) {
      throw AppError.badRequest('This integration is built-in and always connected', 'INTEGRATION_BUILTIN');
    }

    // Validate required credential fields are present.
    const missing = entry.fields.filter((f) => credentials?.[f.key] == null || credentials[f.key] === '');
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Missing credential(s): ${missing.map((f) => f.label).join(', ')}`,
        'INTEGRATION_MISSING_CREDENTIALS',
      );
    }

    const encrypted = encryptCredentials(provider, credentials);
    // Mint a webhook signing secret for providers that receive callbacks.
    const webhookSecret = entry.webhookProvider ? randomBytes(24).toString('hex') : null;

    const row = await integrationsRepo.upsert({
      tenantId,
      provider,
      branchId,
      create: {
        category: entry.category,
        status: 'CONNECTED',
        credentials: encrypted,
        config: config ?? {},
        webhookSecret,
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
      update: {
        status: 'CONNECTED',
        credentials: encrypted,
        ...(config ? { config } : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
        lastError: null,
        lastErrorAt: null,
      },
    });

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'INTEGRATION_CONNECTED',
      entityType: 'Integration',
      entityId: row.id,
      metadata: { provider }, // never log credential values
    });

    const slug = await tenantSlug(tenantId);
    return serializeIntegration(entry, row, { tenantSlug: slug });
  },

  async disconnect({ tenantId, provider, actor }) {
    const entry = entryOrThrow(provider);
    const existing = await integrationsRepo.findByProvider({ tenantId, provider });
    if (!existing) throw AppError.notFound('Integration is not connected', 'INTEGRATION_NOT_CONNECTED');

    const row = await integrationsRepo.update({
      id: existing.id,
      data: { status: 'AVAILABLE', credentials: {}, webhookSecret: null },
    });

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'INTEGRATION_DISCONNECTED',
      entityType: 'Integration',
      entityId: row.id,
      metadata: { provider },
    });

    const slug = await tenantSlug(tenantId);
    return serializeIntegration(entry, row, { tenantSlug: slug });
  },

  async test({ tenantId, provider, actor }) {
    entryOrThrow(provider);
    const existing = await integrationsRepo.findByProvider({ tenantId, provider });
    if (!existing || existing.status !== 'CONNECTED') {
      throw AppError.badRequest('Connect the integration before testing', 'INTEGRATION_NOT_CONNECTED');
    }

    const creds = decryptCredentials(provider, existing.credentials);
    let result;
    try {
      result = await getAdapter(provider).test(creds);
    } catch (err) {
      await integrationsRepo.update({
        id: existing.id,
        data: { status: 'ERROR', lastError: err.message, lastErrorAt: new Date() },
      });
      await bumpVersion(CACHE_PREFIX);
      throw AppError.badRequest(`Connection test failed: ${err.message}`, 'INTEGRATION_TEST_FAILED');
    }

    await integrationsRepo.update({
      id: existing.id,
      data: { status: 'CONNECTED', lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'INTEGRATION_TESTED',
      entityType: 'Integration',
      entityId: existing.id,
      metadata: { provider, ok: result?.ok ?? true },
    });
    return { ok: true, message: result?.message ?? 'Connection healthy' };
  },

  async sync({ tenantId, provider, actor }) {
    const entry = entryOrThrow(provider);
    if (!entry.supportsSync) {
      throw AppError.badRequest('This integration does not support manual sync', 'INTEGRATION_SYNC_UNSUPPORTED');
    }
    const existing = await integrationsRepo.findByProvider({ tenantId, provider });
    if (!existing || existing.status !== 'CONNECTED') {
      throw AppError.badRequest('Connect the integration before syncing', 'INTEGRATION_NOT_CONNECTED');
    }

    let jobId = null;
    try {
      const job = await enqueueIntegrationSync({ tenantId, provider, integrationId: existing.id });
      jobId = job?.id ?? null;
    } catch {
      throw AppError.dependencyDown('Sync queue unavailable', 'QUEUE_UNAVAILABLE');
    }

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'INTEGRATION_SYNCED',
      entityType: 'Integration',
      entityId: existing.id,
      metadata: { provider, jobId },
    });
    return { queued: true, jobId, message: 'Sync queued — menu and availability will update shortly.' };
  },

  /** Internal — decrypt creds for the sync worker / adapters. */
  async getInternalCredentials({ tenantId, provider }) {
    const row = await integrationsRepo.findByProvider({ tenantId, provider });
    if (!row) return null;
    return { row, credentials: decryptCredentials(provider, row.credentials) };
  },
};
