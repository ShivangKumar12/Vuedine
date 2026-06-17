import { z } from 'zod';

export const changePlanSchema = z.object({
  body: z.object({
    planSlug: z.enum(['starter', 'growth', 'enterprise']),
    cycle: z.enum(['monthly', 'yearly']).default('monthly'),
  }),
});

export const addonParamSchema = z.object({
  params: z.object({ id: z.string().min(2).max(40) }),
});

export const invoiceParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});
