import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Secrets-source abstraction.
 *
 * Production pulls from HashiCorp Vault (KV v2). Dev / CI fall back to the
 * already-validated `env` object. The contract is identical:
 *
 *   const source = buildSecretsSource();
 *   const dbPwd = await source.get('DB_PASSWORD');
 *
 * Why an abstraction at all?
 *   - Lets us switch to AWS Secrets Manager / GCP Secret Manager / k8s
 *     external-secrets without touching call sites.
 *   - Lets tests inject a `MockSource` deterministically.
 *   - Centralises caching (Vault charges/throttles per-request).
 *
 *  ⚠️  NEVER log the value returned by `.get()`. Log the key name only.
 *  ⚠️  Cache is in-memory; for rotation, restart the pod or call `.refresh()`.
 */

class EnvSource {
  // eslint-disable-next-line require-await -- contract expects async
  async get(key) {
    return env[key] ?? null;
  }
  // eslint-disable-next-line require-await -- contract expects async
  async refresh() {
    /* env is read once at boot — nothing to refresh. */
  }
}

class VaultSource {
  /**
   * @param {{ addr: string, token: string, path: string }} opts
   */
  constructor({ addr, token, path }) {
    this.addr = addr.replace(/\/$/, '');
    this.token = token;
    this.path = path; // e.g. "secret/data/vuedine/api" for KV v2
    this.cache = new Map();
    this.fetchedAt = 0;
  }

  async _fetch() {
    const url = `${this.addr}/v1/${this.path}`;
    const res = await fetch(url, {
      headers: { 'X-Vault-Token': this.token },
    });
    if (!res.ok) {
      logger.error('vault.fetch_failed', { status: res.status, path: this.path });
      throw new Error(`Vault fetch failed: ${res.status}`);
    }
    const body = await res.json();
    // KV v2 wraps payload under data.data; KV v1 is just data.
    const data = body?.data?.data ?? body?.data ?? {};
    this.cache = new Map(Object.entries(data));
    this.fetchedAt = Date.now();
    logger.info('vault.fetch_ok', { path: this.path, keys: this.cache.size });
  }

  async get(key) {
    if (this.cache.size === 0) {
      try {
        await this._fetch();
      } catch (err) {
        // Fall back to env so a Vault outage during boot doesn't take the
        // service down if every key is also reachable via env.
        logger.warn('vault.fallback_to_env', { key, error: err.message });
        return env[key] ?? null;
      }
    }
    return this.cache.get(key) ?? env[key] ?? null;
  }

  async refresh() {
    await this._fetch();
  }
}

let _source = null;

/**
 * Build the secrets source for this process. Idempotent — calling twice
 * returns the same instance.
 *
 * @returns {{ get: (k: string) => Promise<string | null>, refresh: () => Promise<void> }}
 */
export function buildSecretsSource() {
  if (_source) return _source;

  if (env.VAULT_ADDR && env.VAULT_TOKEN) {
    logger.info('secrets.source', { kind: 'vault', addr: env.VAULT_ADDR });
    _source = new VaultSource({
      addr: env.VAULT_ADDR,
      token: env.VAULT_TOKEN,
      path: env.VAULT_SECRET_PATH,
    });
  } else {
    logger.info('secrets.source', { kind: 'env' });
    _source = new EnvSource();
  }
  return _source;
}

/** Tests only — drop the cached singleton. */
export function _resetSecretsSource() {
  _source = null;
}
