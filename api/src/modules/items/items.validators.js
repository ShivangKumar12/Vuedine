import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

/* ============================================================
 *  Item field constraints
 *  ----
 *  Mirror the frontend Item type (app/src/pages/dashboard/Items.tsx) but
 *  enforce server-side. Status is uppercase here (Postgres enum convention)
 *  and the controller maps to display strings if needed.
 * ============================================================ */

const itemBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().trim().min(1).max(50),
  // Money: accept number with up to 2 decimals OR a numeric string.
  price: z.coerce.number().nonnegative().multipleOf(0.01).max(999_999),
  status: z.enum(['ACTIVE', 'SOLD_OUT', 'DRAFT']).default('ACTIVE'),
  emoji: z.string().max(8).optional(),
  imageUrl: z.string().url().max(500).optional().nullable(),
  veg: z.boolean().default(true),
  bestseller: z.boolean().default(false),
  branchIds: z.array(z.string().min(8).max(40)).default([]),
});

export const listSchema = z.object({
  query: offsetSchema.extend({
    search: z.string().max(100).optional(),
    category: z.string().max(50).optional(),
    status: z.enum(['ACTIVE', 'SOLD_OUT', 'DRAFT']).optional(),
    veg: z
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
  body: itemBody,
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: itemBody.partial(),
});
