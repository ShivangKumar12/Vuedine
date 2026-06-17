# API Keys — Vuedine

Last reviewed: 2026-06-09

## Purpose

Long-lived bearer credentials for server-to-server integrations: webhook
receivers, POS hardware sync, partner platforms. **Not** for end users —
human flows go through the JWT auth path.

## Key shape

```
sk_live_<43 chars base64url>     production
sk_test_<43 chars base64url>     sandbox / dev (optional)
```

- `sk_` prefix: scanner-friendly. GitHub secret scanning + truffleHog match
  on it.
- `live`/`test` segment: tells humans + tools which environment the key
  belongs to. Useful in incident triage.
- 43 chars in base64url ≈ 256 bits of entropy. Brute force is not a credible
  threat.

## Storage

| Column      | Purpose                                                         |
| ----------- | --------------------------------------------------------------- |
| `id`        | cuid PK                                                         |
| `tenantId`  | scope — every API key is tenant-bound, no platform-wide keys    |
| `prefix`    | first 12 chars, cleartext, indexed for fast candidate filtering |
| `hash`      | argon2id over the full raw key                                  |
| `scopes`    | `[]string` — exactly the permissions issued                     |
| `expiresAt` | optional hard expiry                                            |
| `revokedAt` | soft-delete; verify() filters these out                         |

The raw key is **never persisted**. If a user loses it, they rotate.

## Why argon2id over bcrypt

- **Bcrypt has a 72-byte input limit.** Anything beyond is silently
  truncated, which means our 43-char keys are fine today but the moment
  someone bumps key length to 80+ chars we'd compare prefixes only.
- **OWASP recommendation.** Argon2id is the modern PHC winner.
- **PHC string format.** Hash output is self-describing: algorithm,
  parameters, salt, hash. Upgrade paths (e.g., raise memory cost) work
  without a schema change.

Cost parameters in `apiKeys.service.js`:

```js
{ type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }
```

That's the OWASP minimum (19 MiB RAM, 2 iterations). On commodity hardware
verify is ~50ms — acceptable for integration traffic, painful for brute
force.

## Verify hot path

For high-traffic public endpoints, layer a Redis cache:

```
key:   apiKey:sha256(<raw>)
value: { tenantId, scopes }   TTL 5 min
```

Lookup is O(1) and constant-time on the cache hit. Cache miss falls back to
the DB + argon2 path. On revoke, `DEL` the cache entry to evict immediately.

This optimisation is **not** wired in Phase 9 (no traffic shape demands it
yet). Add it when the integrations module ships.

## Scopes

Defined in `apiKeys.validators.js`:

```
orders:read        items:read         payments:read
orders:write       items:write        webhooks:write
                                       reports:read
```

Scope checks live in `requireScope(...)` middleware. Human users (JWT auth)
bypass scope checks — their role grants them everything; scopes are the
fine-grained gate **for API keys only**.

## Operational runbook

### Rotation

1. UI / CLI: issue a new key with the same scopes.
2. Roll the new key into the integration's config.
3. Verify traffic flows on the new key (`lastUsedAt` advances).
4. Revoke the old key. Verify the integration is still happy.

### Suspected compromise

1. Revoke immediately (`DELETE /v1/api-keys/:id`).
2. Audit log the revocation reason.
3. Search audit logs for `API_KEY_*` actions in the suspected window.
4. Issue a fresh key, communicate via out-of-band channel.

### Lost key

There is no recovery. Issue a new one and revoke the old.

## Threat model

| Threat                                | Mitigated? | How                                                  |
| ------------------------------------- | ---------- | ---------------------------------------------------- |
| Key in git                            | ✅         | `sk_live_` prefix is a scanner trip wire             |
| DB dump → key replay                  | ✅         | argon2id hash; raw key not stored                    |
| Cross-tenant access                   | ✅         | `tenantId` on every row; service queries scope       |
| Privilege escalation via key          | ✅         | Scopes capped at issuance; `requireScope` enforces   |
| Key stays valid after employee leaves | ⚠️         | Process: revoke when access is revoked (manual)      |
| Forgotten / orphaned keys             | ⚠️         | Quarterly review — flag keys idle > 90d in dashboard |

## See also

- `src/modules/apiKeys/apiKeys.service.js` — implementation
- `src/middleware/auth.middleware.js` — `apiKeyAuth`, `apiKeyOrJwtAuth`
- `src/middleware/rbac.middleware.js` — `requireScope`
