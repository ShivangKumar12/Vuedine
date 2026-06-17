import { z } from 'zod';

const providerParam = z.object({
  params: z.object({ provider: z.string().min(2).max(40) }),
});

export const providerParamSchema = providerParam;

export const connectSchema = z.object({
  params: z.object({ provider: z.string().min(2).max(40) }),
  body: z.object({
    branchId: z.string().min(8).max(40).optional(),
    credentials: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    config: z.record(z.string(), z.unknown()).optional(),
  }),
});
