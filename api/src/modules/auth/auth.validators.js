import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(8).max(200),
    tenantSlug: z.string().min(2).max(64).optional(),
  }),
});

export const refreshSchema = z.object({
  // Refresh token usually arrives as a cookie; falling back to body is allowed
  // for non-browser clients (mobile apps, integrations).
  body: z.object({ refreshToken: z.string().optional() }).optional(),
});

export const resetStartSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
  }),
});

export const resetCompleteSchema = z.object({
  body: z.object({
    token: z.string().min(20).max(200),
    newPassword: z.string().min(8).max(200),
  }),
});
