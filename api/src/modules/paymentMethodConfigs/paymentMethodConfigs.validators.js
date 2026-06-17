import { z } from 'zod';

const method = z.enum(['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'LOYALTY']);

export const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

export const upsertSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40).optional().nullable(),
    method,
    enabled: z.boolean().optional(),
    preferred: z.boolean().optional(),
    serviceCharge: z.coerce.number().min(0).max(100).optional(),
    meta: z.record(z.any()).optional().nullable(),
  }),
});
