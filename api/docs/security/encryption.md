# Field-level encryption — Vuedine

Last reviewed: 2026-06-09

## Why we have this

Some PII has to land in the database (gov ID for KYC, full bank details for
payouts, customer identifiers we are legally required to retain) but is read
only on rare events (compliance request, payout). Storing it in plaintext
means a single SELECT \* dump is a regulator-reportable breach. AES-256-GCM
at the application layer means an attacker who exfiltrates the database
without also stealing `FIELD_ENCRYPTION_KEY` from Vault gets ciphertext and
nothing else.

## Threat model

| Threat                                  | Mitigated? | How                                                |
| --------------------------------------- | ---------- | -------------------------------------------------- |
| DB backup theft                         | ✅         | App key not in DB; backups carry ciphertext only   |
| Cloud snapshot leak                     | ✅         | Same — column values are random-IV ciphertext      |
| Read replica compromise                 | ✅         | Replica has same ciphertext, no key                |
| Application server RCE                  | ❌         | App holds the key — out of scope for this control  |
| Insider with prod console + Vault token | ❌         | Out of scope — RBAC + audit on Vault token usage   |
| Brute-force ciphertext                  | ✅         | 256-bit AES-GCM, IV per encryption, auth tag check |

## Implementation

`src/utils/crypto.js`

- AES-256-GCM (`aes-256-gcm`)
- 12-byte random IV per encryption (NIST SP 800-38D)
- 16-byte GCM auth tag (integrity)
- Key derived via SHA-256 over `FIELD_ENCRYPTION_KEY` so any-length input
  yields a 32-byte key. Production should still set a 32+ char key.
- 1-byte version prefix on every ciphertext so we can rotate keys without a
  Stop-The-World migration.

Storage format:

```
base64( v1 | iv(12) | tag(16) | ciphertext(*) )
```

## Currently encrypted columns

> 🚧 As of Phase 9, no columns are encrypted in the schema. This module is
> ready; the orders / customers / payments modules (Phase 11+) will adopt it
> when PCI scope arrives.

When a column lands here, document it in this table:

| Column     | Module | Adopted in | Blind index? | Rotated last |
| ---------- | ------ | ---------- | ------------ | ------------ |
| _none yet_ |        |            |              |              |

## Key management

- `FIELD_ENCRYPTION_KEY` lives in Vault at the path
  `secret/vuedine/api/FIELD_ENCRYPTION_KEY`.
- Dev / CI use the value in `.env` (committed default in `.env.example` is a
  placeholder; CI overrides with a generated value).
- **Rotation cadence: annually**, or immediately upon any suspected compromise.

## Rotation procedure

The `v1` byte in every ciphertext makes rotation incremental:

1. Generate a new key, store as `FIELD_ENCRYPTION_KEY_V2` in Vault.
2. Update `crypto.js` to recognize `0x02` in `decrypt()`, and change `encrypt()`
   to produce v2 ciphertext.
3. Deploy. New writes are v2; old reads are still v1 (decrypted with the v1 key
   pulled from the rotation cache).
4. Background job re-encrypts v1 rows over time.
5. After the v1→v2 backfill finishes, delete `FIELD_ENCRYPTION_KEY` (the v1
   key) from Vault.

## What this does not protect

- Logs, traces, error messages — never log encrypted-field plaintexts. Add the
  field name to the logger redaction list before adding the column.
- Memory dumps / core dumps — the key and plaintext live in process memory by
  necessity. Disable core dumps in prod (`ulimit -c 0`).
- Application bugs — a controller that returns the decrypted value to an
  unauthorised user is the same risk as a plaintext column. RBAC + scope
  checks gate the controller layer.

## See also

- `src/utils/crypto.js` — implementation
- `src/config/secrets.js` — Vault bootstrap
- `docs/security/api-keys.md` — sibling control
