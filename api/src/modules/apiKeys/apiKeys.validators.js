import { z } from 'zod';

/**
 * Allowed scopes — the union of every permission an integration could need.
 * Keep this list tight; every entry is a key the integrations team will
 * eventually have to support.
 *
 * Convention: `<resource>:<action>` with `*` only for super-admins.
 */
export const API_KEY_SCOPES = [
  'orders:read',
  'orders:write',
  'items:read',
  'items:write',
  'payments:read',
  'webhooks:write',
  'reports:read',
];

export const issueApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).max(API_KEY_SCOPES.length),
    expiresAt: z.coerce.date().optional(),
    envTag: z.enum(['live', 'test']).default('live'),
  }),
});

export const revokeApiKeySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
