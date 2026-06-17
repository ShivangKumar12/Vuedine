import 'dotenv/config';
import { z } from 'zod';

/* eslint-disable no-process-env -- this is the single allowed entry point */

/**
 * Truthy/falsy parser for env strings.
 *
 * `z.coerce.boolean()` treats any non-empty string — including 'false' — as
 * true. That's a foot-gun in env config (PROMETHEUS_ENABLED=false would be
 * silently `true`). This helper accepts the canonical truthy/falsy strings
 * we actually use in env files and rejects anything else.
 */
const boolish = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
    throw new Error(`Expected boolean-ish value, got "${v}"`);
  });

/**
 * Environment schema — every variable is validated at startup.
 * A missing or malformed value crashes the process with a clear message
 * instead of silently defaulting (which is how secrets-in-source bugs happen).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('vuedine-api'),
  APP_VERSION: z.string().default('0.0.0'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // ---- Database (used in Phase 2) ----
  DATABASE_URL: z.string().url().optional(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  DATABASE_LOG_QUERIES: boolish.default(false),
  DATABASE_SLOW_QUERY_MS: z.coerce.number().default(200),

  // ---- Redis (Phase 3) ----
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: boolish.default(false),
  REDIS_KEY_PREFIX: z.string().default('vuedine:'),

  // ---- Auth (Phase 4) ----
  // Required even in Phase 1 so the deployment never starts without a real secret.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  PASSWORD_RESET_TTL_MIN: z.coerce.number().int().positive().default(30),
  EMAIL_VERIFY_TTL_HOURS: z.coerce.number().int().positive().default(24),

  // ---- Rate limiting ----
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().positive().default(900_000),

  // ---- CORS ----
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .refine(
      (origins) => {
        // In production, every origin must be HTTPS. Localhost-anything in
        // a prod CORS list is a deploy-time misconfiguration — fail loud.
        // eslint-disable-next-line no-process-env -- this validator runs before env is frozen
        if (process.env.NODE_ENV !== 'production') return true;
        return origins.every((o) => /^https:\/\//.test(o));
      },
      { message: 'CORS_ORIGINS must be HTTPS-only in production' },
    ),

  // ---- Observability (Phase 7) ----
  PROMETHEUS_ENABLED: boolish.default(true),
  METRICS_AUTH_TOKEN: z.string().min(8).optional(),
  SENTRY_DSN: z.string().optional(),

  // ---- Email (Phase 6) ----
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // ---- Object storage (Phase 5) ----
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  // ---- Public QR (Phase G) ----
  // Base where the scan resolver (GET /m/:branchSlug/:token) is served — the
  // QR encodes this. PUBLIC_APP_URL is the guest PWA the resolver redirects to.
  PUBLIC_QR_BASE: z.string().default('http://localhost:4000'),
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),

  // ---- Web Push + messaging webhooks (Phase H) ----
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:notifications@vuedine.com'),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),
  SMS_WEBHOOK_SECRET: z.string().optional(),
  INSTAGRAM_WEBHOOK_SECRET: z.string().optional(),

  // ---- Feature flags ----
  FEATURE_REALTIME_ORDERS: boolish.default(true),
  FEATURE_OAUTH_GOOGLE: boolish.default(false),
  FEATURE_OAUTH_GITHUB: boolish.default(false),

  // ---- OAuth (Phase 4 — only validated when feature flag flips) ----
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_CALLBACK_BASE: z.string().optional(),

  // ---- Vault (Phase 9) ----
  VAULT_ADDR: z.string().optional(),
  VAULT_TOKEN: z.string().optional(),
  VAULT_SECRET_PATH: z.string().default('secret/vuedine/api'),

  // ---- Field-level encryption (Phase 9) ----
  FIELD_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console -- logger is not yet available at this point
  console.error('❌  Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
