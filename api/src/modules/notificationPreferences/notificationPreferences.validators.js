import { z } from 'zod';

export const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
    userId: z.string().min(8).max(40).optional(),
  }),
});

export const bulkSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40).optional().nullable(),
    userId: z.string().min(8).max(40).optional().nullable(),
    prefs: z
      .array(
        z.object({
          event: z.string().trim().min(1).max(60),
          channel: z.enum(['sound', 'push', 'email', 'sms']),
          enabled: z.boolean(),
          branchId: z.string().min(8).max(40).optional().nullable(),
          userId: z.string().min(8).max(40).optional().nullable(),
        }),
      )
      .min(1)
      .max(200),
  }),
});
