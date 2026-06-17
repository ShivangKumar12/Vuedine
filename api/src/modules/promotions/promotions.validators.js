import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

export const promotionType = z.enum(['COUPON', 'OFFER']);
export const promotionKind = z.enum([
  'PERCENTAGE',
  'FLAT',
  'BOGO',
  'FREE_ITEM',
  'COMBO',
  'HAPPY_HOUR',
  'LOYALTY',
  'FESTIVAL',
]);
export const promotionStatus = z.enum(['ACTIVE', 'SCHEDULED', 'PAUSED', 'EXPIRED', 'ENDED']);
export const promotionScope = z.enum(['WHOLE_ORDER', 'ITEMS', 'CATEGORIES']);
export const dayOfWeek = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM')
  .optional()
  .nullable();

export const listSchema = z.object({
  query: offsetSchema.extend({
    type: promotionType.optional(),
    status: promotionStatus.optional(),
    kind: promotionKind.optional(),
    search: z.string().max(120).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

const promotionBody = z.object({
  type: promotionType,
  kind: promotionKind,
  status: promotionStatus.optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  summary: z.string().max(200).optional().nullable(),
  emoji: z.string().max(8).optional().nullable(),
  hero: z.string().max(200).optional().nullable(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be alphanumeric / dash / underscore')
    .optional()
    .nullable(),
  value: z.coerce.number().min(0).max(10_000_000).default(0),
  minOrder: z.coerce.number().min(0).max(10_000_000).default(0),
  maxDiscount: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  startsAt: z.string().min(4),
  endsAt: z.string().min(4),
  startTime: hhmm,
  endTime: hhmm,
  days: z.array(dayOfWeek).max(7).default([]),
  channels: z.array(z.string().max(20)).max(8).default([]),
  usageLimit: z.coerce.number().int().min(0).max(10_000_000).default(0),
  perUserLimit: z.coerce.number().int().min(1).max(1000).default(1),
  scope: promotionScope.default('WHOLE_ORDER'),
  targetItemIds: z.array(z.string().max(40)).max(500).default([]),
  targetCategories: z.array(z.string().max(60)).max(100).default([]),
  autoApply: z.boolean().default(false),
  trigger: z.record(z.any()).optional().nullable(),
});

export const createSchema = z.object({
  body: promotionBody.superRefine((data, ctx) => {
    if (data.type === 'COUPON' && !data.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Coupons require a code',
      });
    }
    if (new Date(data.endsAt) < new Date(data.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'endsAt must be after startsAt',
      });
    }
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: promotionBody.partial(),
});

export const idemParamSchema = idParamSchema;

const cartLine = z.object({
  itemId: z.string().max(40).optional().nullable(),
  itemName: z.string().max(160).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  qty: z.coerce.number().int().min(1).max(500),
  unitPrice: z.coerce.number().min(0).max(10_000_000),
});

export const applyCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(1).max(40),
    branchId: z.string().min(8).max(40).optional(),
    channel: z.string().max(20).optional(),
    customerId: z.string().max(120).optional().nullable(),
    lines: z.array(cartLine).min(1).max(200),
  }),
});

export const autoOffersSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40).optional(),
    channel: z.string().max(20).optional(),
    lines: z.array(cartLine).min(1).max(200),
  }),
});
