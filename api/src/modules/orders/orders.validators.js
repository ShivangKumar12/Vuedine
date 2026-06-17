import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

/* Enums (mirroring Prisma) */
export const orderType = z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']);
export const orderChannel = z.enum(['POS', 'WAITER', 'QR', 'ONLINE']);
export const orderSource = z.enum([
  'POS',
  'WAITER',
  'QR',
  'ZOMATO',
  'SWIGGY',
  'VUEDINE_DIRECT',
  'WHATSAPP',
  'QR_PAY',
]);
export const orderStatus = z.enum([
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SERVED',
  'CANCELLED',
]);
export const orderPriority = z.enum(['NORMAL', 'RUSH']);
export const orderStation = z.enum(['HOT', 'COLD', 'BAR', 'DESSERT']);
export const paymentMode = z.enum(['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'PAY_LATER']);

/* Lines */
const orderLineSchema = z.object({
  itemId: z.string().min(1).max(40).optional().nullable(),
  itemName: z.string().min(1).max(120),
  emoji: z.string().max(8).optional().nullable(),
  qty: z.coerce.number().int().min(1).max(200),
  unitPrice: z.coerce.number().min(0).max(100000),
  variantId: z.string().max(60).optional().nullable(),
  variantLabel: z.string().max(120).optional().nullable(),
  addons: z
    .array(
      z.object({
        id: z.string().max(60),
        label: z.string().max(120),
        price: z.coerce.number().min(0).max(100000),
      }),
    )
    .max(20)
    .optional()
    .nullable(),
  notes: z.string().max(300).optional().nullable(),
  spice: z.coerce.number().int().min(1).max(3).optional().nullable(),
  station: orderStation.optional(),
  category: z.string().max(60).optional().nullable(),
});

const baseListQuery = offsetSchema.extend({
  branchId: z.string().min(8).max(40).optional(),
  search: z.string().max(120).optional(),
  status: orderStatus.optional(),
  channel: orderChannel.optional(),
  source: orderSource.optional(),
  type: orderType.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((s) => (s === undefined ? undefined : s === 'true')),
});

export const listSchema = z.object({ query: baseListQuery });

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

const createBody = z.object({
  branchId: z.string().min(8).max(40),
  type: orderType,
  channel: orderChannel.default('POS'),
  source: orderSource.optional(),
  station: orderStation.optional(),
  priority: orderPriority.default('NORMAL'),
  tableId: z.string().min(8).max(40).optional().nullable(),
  tableLabel: z.string().max(80).optional().nullable(),
  sessionId: z.string().min(8).max(40).optional().nullable(),
  guestName: z.string().max(120).optional().nullable(),
  guestPhone: z.string().max(40).optional().nullable(),
  deliveryAddress: z.string().max(400).optional().nullable(),
  deliveryNotes: z.string().max(300).optional().nullable(),
  driverName: z.string().max(120).optional().nullable(),
  driverPhone: z.string().max(40).optional().nullable(),
  etaMinutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
  paymentMode: paymentMode.optional(),
  promoCode: z.string().max(40).optional().nullable(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  tipAmount: z.coerce.number().min(0).max(100000).optional(),
  tipPct: z.coerce.number().min(0).max(50).optional(),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(orderLineSchema).min(1).max(100),
});

export const createSchema = z.object({ body: createBody });

export const calculateSchema = z.object({
  body: createBody.partial({ type: true, channel: true }).extend({
    type: orderType.optional(),
    channel: orderChannel.optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    notes: z.string().max(500).optional().nullable(),
    priority: orderPriority.optional(),
    paymentMode: paymentMode.optional(),
    paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional(),
    deliveryAddress: z.string().max(400).optional().nullable(),
    deliveryNotes: z.string().max(300).optional().nullable(),
    driverName: z.string().max(120).optional().nullable(),
    driverPhone: z.string().max(40).optional().nullable(),
    etaMinutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
  }),
});

export const setStatusSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    status: orderStatus,
    reason: z.string().max(300).optional().nullable(),
  }),
});

export const setLinePreparedSchema = z.object({
  params: z.object({
    id: z.string().min(8).max(40),
    lineId: z.string().min(8).max(40),
  }),
  body: z.object({
    prepared: z.boolean().default(true),
  }),
});

export const cancelSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    reason: z.string().max(300).optional().nullable(),
  }),
});
