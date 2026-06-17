import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

export const paymentMethod = z.enum(['CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'LOYALTY']);
export const paymentType = z.enum(['SALE', 'REFUND', 'TIP', 'COMP', 'SETTLEMENT']);
export const paymentTxStatus = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']);

const baseListQuery = offsetSchema.extend({
  branchId: z.string().min(8).max(40).optional(),
  search: z.string().max(120).optional(),
  method: paymentMethod.optional(),
  type: paymentType.optional(),
  status: paymentTxStatus.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const listSchema = z.object({ query: baseListQuery });

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

const orderIdParamSchema = z.object({ id: z.string().min(8).max(40) });

export const createPaymentSchema = z.object({
  params: orderIdParamSchema,
  body: z.object({
    method: paymentMethod,
    amount: z.coerce.number().positive().max(10_000_000),
    fee: z.coerce.number().min(0).optional(),
    reference: z.string().max(120).optional().nullable(),
    gateway: z.string().max(40).optional().nullable(),
    type: z.enum(['SALE', 'TIP']).default('SALE'),
    customerName: z.string().max(120).optional().nullable(),
    capture: z.boolean().optional(), // mark SUCCESS immediately (cash flow)
  }),
});

export const refundSchema = z.object({
  params: z.object({
    id: z.string().min(8).max(40),
    paymentId: z.string().min(8).max(40),
  }),
  body: z.object({
    amount: z.coerce.number().positive().max(10_000_000),
    reason: z.string().max(300).optional().nullable(),
  }),
});

export const compSchema = z.object({
  params: orderIdParamSchema,
  body: z.object({
    amount: z.coerce.number().positive().max(10_000_000),
    reason: z.string().max(300).optional().nullable(),
  }),
});

export const settlementListSchema = z.object({
  query: offsetSchema.extend({
    gateway: z.string().max(40).optional(),
  }),
});

export const settlementSyncSchema = z.object({
  params: z.object({ gateway: z.string().min(2).max(40) }),
});

export const recaptureSchema = idParamSchema;

export const paymentSettingsSchema = z.object({
  body: z.object({
    cashEnabled: z.boolean().optional(),
    cardEnabled: z.boolean().optional(),
    upiEnabled: z.boolean().optional(),
    walletEnabled: z.boolean().optional(),
    onlineEnabled: z.boolean().optional(),
    loyaltyEnabled: z.boolean().optional(),
    payOnDeliveryEnabled: z.boolean().optional(),
    gateway: z.string().max(40).optional(),
    razorpayKeyId: z.string().max(120).optional().nullable(),
    razorpayKeySecret: z.string().max(200).optional().nullable(),
    webhookSecret: z.string().max(200).optional().nullable(),
    autoCapture: z.boolean().optional(),
    partialPayments: z.boolean().optional(),
    settlementSchedule: z.enum(['t-0', 't-1', 't-2']).optional(),
    refundPolicy: z.enum(['full', 'partial', 'none']).optional(),
  }),
});
