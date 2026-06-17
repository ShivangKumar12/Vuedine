import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

/**
 * Branch validators.
 *
 *  - `code` — short uppercase tag used in receipts / order serials. Must be
 *    unique within the tenant. 3–6 chars, alphanumeric.
 *  - `qrSlug` — public URL component. lowercase + dashes only. Globally
 *    unique (so any printed QR resolves cleanly).
 *  - `diningSections` — free-form string array of section labels the
 *    Tables UI uses for grouping.
 */

// eslint-disable-next-line security/detect-unsafe-regex -- input is anchored + length-capped (≤60) by .max(60) below
export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const codeRegex = /^[A-Z0-9]{2,6}$/;

const branchBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().toUpperCase().regex(codeRegex, 'Code must be 2–6 uppercase alphanum'),
  qrSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(slugRegex, 'qrSlug must be lowercase letters/numbers separated by single dashes'),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  manager: z.string().max(120).optional().nullable(),
  isLive: z.boolean().default(true),
  timezoneCode: z.string().max(60).optional().nullable(),
  defaultPrep: z.coerce.number().int().min(0).max(180).default(15),
  serviceCharge: z.coerce.number().min(0).max(50).default(0),
  taxInclusive: z.boolean().default(false),
  diningSections: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  openingHours: z.record(z.any()).optional().nullable(),
});

export const listSchema = z.object({
  query: offsetSchema.extend({
    search: z.string().max(100).optional(),
    isLive: z
      .enum(['true', 'false'])
      .optional()
      .transform((s) => (s === undefined ? undefined : s === 'true')),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(8).max(40),
  }),
});

export const createSchema = z.object({
  body: branchBody,
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: branchBody.partial(),
});

export const toggleLiveSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z
    .object({
      isLive: z.boolean().optional(),
    })
    .optional(),
});
