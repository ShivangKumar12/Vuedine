import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../config/index.js';

/**
 * Field-level encryption for at-rest PII (gov IDs, full bank details, etc.).
 *
 * Algorithm: AES-256-GCM
 *   - 12-byte random IV per encryption (NIST SP 800-38D recommendation)
 *   - 16-byte auth tag for integrity
 *   - Key derived via SHA-256 over FIELD_ENCRYPTION_KEY so we can accept any
 *     length input but always feed AES a 32-byte key.
 *
 * Format on disk:
 *   base64( v1 | iv(12) | tag(16) | ciphertext(*) )
 *
 * The leading version byte is critical — it lets us rotate keys without a
 * Stop-The-World migration. Add a `v2` codepath when the key rotates and
 * decrypt picks the right key based on the version prefix.
 *
 *   ⚠️ NEVER import this from a context that doesn't have FIELD_ENCRYPTION_KEY
 *   set. The module crashes loudly at first use rather than silently writing
 *   plaintext to columns advertised as encrypted.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION_V1 = 0x01;

let _keyCache = null;

function deriveKey() {
  if (_keyCache) return _keyCache;
  const raw = env.FIELD_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY missing or too short (need ≥16 chars). ' +
        'Set it in env (Vault in prod) before using encrypted fields.',
    );
  }
  _keyCache = createHash('sha256').update(raw).digest();
  return _keyCache;
}

/**
 * Encrypt a plaintext string. Returns base64 ciphertext, or null for null/undefined.
 *
 * @param {string | number | null | undefined} plaintext
 * @returns {string | null}
 */
export function encrypt(plaintext) {
  if (plaintext == null) return null;

  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([Buffer.from([VERSION_V1]), iv, tag, ct]).toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext produced by `encrypt`.
 *
 * @param {string | null | undefined} b64
 * @returns {string | null}
 */
export function decrypt(b64) {
  if (b64 == null) return null;
  const buf = Buffer.from(b64, 'base64');

  if (buf.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext too short — corrupt or not produced by encrypt()');
  }

  const version = buf[0];
  if (version !== VERSION_V1) {
    throw new Error(`Unknown ciphertext version: 0x${version.toString(16)}`);
  }

  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN + TAG_LEN);

  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Stable, deterministic hash for blind-equality lookups on encrypted columns.
 *
 * Useful when you need to find a row by an encrypted value: store both
 * `email_encrypted` (AES-GCM, randomized) and `email_lookup` (HMAC-SHA-256,
 * deterministic). Equality search uses the lookup column; the random IV
 * prevents adversaries from confirming a guess by seeing the same ciphertext
 * twice.
 *
 * For Phase 9 we only ship the helper — no current columns use blind index;
 * orders / payments columns will adopt it in Phase 11+ when PCI scope arrives.
 */
export function blindIndex(value) {
  if (value == null) return null;
  const key = deriveKey();
  return createHash('sha256').update(key).update(String(value)).digest('hex');
}

/** For tests only — let suite force a fresh key derivation. */
export function _resetKeyCache() {
  _keyCache = null;
}
