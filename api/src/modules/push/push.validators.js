import { z } from 'zod';

export const subscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().min(1).max(200),
      auth: z.string().min(1).max(200),
    }),
    platform: z.enum(['web', 'ios', 'android']).optional(),
    deviceId: z.string().max(100).optional().nullable(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});
