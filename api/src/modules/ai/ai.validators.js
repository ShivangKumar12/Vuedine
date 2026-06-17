import { z } from 'zod';

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(2000),
    branchId: z.string().min(8).max(40).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(4000),
        }),
      )
      .max(20)
      .optional(),
  }),
});

export const contextQuerySchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
  }),
});
