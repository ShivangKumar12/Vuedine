import { randomBytes } from 'node:crypto';

import argon2 from 'argon2';

import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';

/**
 * API Key issuance + verification.
 *
 * Key shape: `sk_live_<43 chars base64url>`
 *   - prefix `sk_live_` (or `sk_test_`) tells humans / scanners what they
 *     have at a glance — handy for git secret scanners.
 *   - 43 chars = 32 random bytes in base64url ≈ 256 bits of entropy.
 *
 * Storage strategy:
 *   - `prefix` (first 12 chars cleartext) → fast O(log N) DB filter.
 *   - `hash` (argon2id over full key) → constant-time verification.
 *   We DO NOT store the full key; lost keys must be rotated.
 *
 * Verification cost:
 *   argon2 verify is intentionally slow (~50ms). For high-traffic public
 *   endpoints, layer a Redis cache of `(key → tenantId, scopes)` keyed by
 *   the SHA-256 of the key (constant-time lookup, expiry on revocation).
 *   That optimisation lands when integrations module needs it.
 */

const KEY_BYTES = 32;
const PREFIX_LEN = 12;

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — OWASP minimum
  timeCost: 2,
  parallelism: 1,
};

function generateRawKey(envTag = 'live') {
  const random = randomBytes(KEY_BYTES).toString('base64url');
  return `sk_${envTag}_${random}`;
}

/**
 * Issue a new API key. Returns the raw key value ONCE — caller must surface
 * it to the user immediately and discard. There is no recovery path.
 *
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string} input.name
 * @param {string[]} input.scopes
 * @param {string} input.createdBy
 * @param {Date | null} [input.expiresAt]
 * @param {string} [input.envTag] - 'live' (prod) | 'test' (sandbox)
 * @returns {Promise<{ id: string, key: string, prefix: string, expiresAt: Date | null }>}
 */
async function issue({ tenantId, name, scopes, createdBy, expiresAt = null, envTag = 'live' }) {
  if (!tenantId) throw AppError.badRequest('tenantId is required', 'TENANT_REQUIRED');
  if (!name) throw AppError.badRequest('name is required', 'NAME_REQUIRED');
  if (!Array.isArray(scopes)) throw AppError.badRequest('scopes must be an array', 'SCOPES_TYPE');

  const raw = generateRawKey(envTag);
  const prefix = raw.slice(0, PREFIX_LEN);
  const hash = await argon2.hash(raw, ARGON2_OPTS);

  const row = await prisma.apiKey.create({
    data: { tenantId, name, prefix, hash, scopes, expiresAt, createdBy },
  });

  await auditService.record({
    tenantId,
    userId: createdBy,
    action: 'API_KEY_ISSUED',
    entityType: 'ApiKey',
    entityId: row.id,
    metadata: { name, scopes, prefix },
  });

  return { id: row.id, key: raw, prefix, expiresAt: row.expiresAt };
}

/**
 * Verify a raw API key. Returns the matched key row + scopes, or null.
 *
 * Constant-time-ish: prefix narrows the candidate set (typically 1 row), and
 * argon2.verify is constant time across hashes. We don't early-return false
 * for unknown prefixes BEFORE running at least one argon2 verify, otherwise
 * a timing oracle could enumerate prefixes — but the ROI is marginal vs the
 * argon2 cost we pay anyway, so we accept a 1ms timing skew for clarity.
 *
 * @param {string} raw
 * @returns {Promise<{ id: string, tenantId: string, scopes: string[] } | null>}
 */
async function verify(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('sk_')) return null;
  const prefix = raw.slice(0, PREFIX_LEN);

  const candidates = await prisma.apiKey.findMany({
    where: {
      prefix,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  for (const candidate of candidates) {
    let ok = false;
    try {
      ok = await argon2.verify(candidate.hash, raw);
    } catch {
      ok = false;
    }
    if (ok) {
      // Best-effort lastUsedAt update — failure here must not block the request.
      prisma.apiKey
        .update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});
      return {
        id: candidate.id,
        tenantId: candidate.tenantId,
        scopes: candidate.scopes,
      };
    }
  }
  return null;
}

/**
 * Revoke an API key by id. Idempotent.
 */
async function revoke({ id, tenantId, revokedBy }) {
  const updated = await prisma.apiKey.updateMany({
    where: { id, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (updated.count === 0) {
    throw AppError.notFound('API key not found or already revoked', 'API_KEY_NOT_FOUND');
  }

  await auditService.record({
    tenantId,
    userId: revokedBy,
    action: 'API_KEY_REVOKED',
    entityType: 'ApiKey',
    entityId: id,
  });
}

/**
 * List keys for a tenant — never include the hash. The raw key is gone forever
 * after issuance; UI only ever sees prefix + name + scopes + timestamps.
 */
async function list({ tenantId }) {
  const rows = await prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdBy: true,
      createdAt: true,
      revokedAt: true,
    },
  });
  return rows;
}

export const apiKeysService = { issue, verify, revoke, list };
