import { z } from 'zod';

const idParam = z.object({ id: z.string().min(8).max(40) });

export const listSchema = z.object({
  query: z.object({
    status: z.enum(['open', 'pending', 'resolved']).optional(),
    channel: z.enum(['whatsapp', 'sms', 'instagram', 'webchat']).optional(),
    search: z.string().max(120).optional(),
  }),
});

export const idParamSchema = z.object({ params: idParam });

export const replySchema = z.object({
  params: idParam,
  body: z.object({
    body: z.string().trim().min(1).max(4000),
    attachments: z.array(z.object({ url: z.string().url(), kind: z.string().max(20) })).max(10).optional(),
  }),
});

export const assignSchema = z.object({
  params: idParam,
  body: z.object({ agentId: z.string().min(8).max(40).nullable() }),
});

export const statusSchema = z.object({
  params: idParam,
  body: z.object({ status: z.enum(['open', 'pending', 'resolved']) }),
});

export const tagsSchema = z.object({
  params: idParam,
  body: z.object({ tags: z.array(z.string().min(1).max(60)).max(20) }),
});

export const starSchema = z.object({
  params: idParam,
  body: z.object({ starred: z.boolean().optional() }).optional(),
});
