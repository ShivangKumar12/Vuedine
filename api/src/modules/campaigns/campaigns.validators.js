import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';
import { ruleSchema } from '../segments/segments.validators.js';

const campaignType = z.enum(['PUSH', 'EMAIL', 'SMS', 'WHATSAPP']);
const campaignStatus = z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']);
const eventType = z.enum(['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'UNSUBSCRIBED', 'BOUNCED']);

const idParam = z.object({ id: z.string().min(8).max(40) });

export const listSchema = z.object({
  query: z.object({
    status: campaignStatus.optional(),
    type: campaignType.optional(),
  }),
});

export const idParamSchema = z.object({ params: idParam });

const audienceQuery = ruleSchema.extend({
  whatsappTemplate: z.string().max(120).optional(),
}).partial().optional();

const campaignBody = z.object({
  type: campaignType,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  imageUrl: z.string().url().max(500).optional().nullable(),
  imageEmoji: z.string().max(8).optional().nullable(),
  ctaLabel: z.string().max(60).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  audience: z.string().max(60).optional(),
  audienceQuery,
});

export const createSchema = z.object({ body: campaignBody });

export const updateSchema = z.object({
  params: idParam,
  body: campaignBody.partial(),
});

export const scheduleSchema = z.object({
  params: idParam,
  body: z.object({ at: z.string().min(1) }),
});

export const eventsSchema = z.object({
  params: idParam,
  query: offsetSchema.extend({ type: eventType.optional() }),
});

export const previewAudienceSchema = z.object({
  body: z.object({
    type: campaignType.optional(),
    audience: z.string().max(60).optional(),
    audienceQuery: audienceQuery,
    rule: ruleSchema.optional(),
  }),
});
