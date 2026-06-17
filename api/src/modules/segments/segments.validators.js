import { z } from 'zod';

export const ruleSchema = z.object({
  kind: z.enum(['all', 'vip', 'loyal', 'lapsed', 'new', 'custom']).default('all'),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
  minOrders: z.coerce.number().int().min(0).max(100000).optional(),
  lapsedDays: z.coerce.number().int().min(1).max(3650).optional(),
});

export const createSegmentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80),
    rule: ruleSchema,
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

export const previewSchema = z.object({
  body: z.object({
    audience: z.string().max(60).optional(),
    rule: ruleSchema.optional(),
    requireConsent: z.boolean().optional(),
    channel: z.enum(['Push', 'Email', 'SMS', 'WhatsApp']).optional(),
  }),
});
