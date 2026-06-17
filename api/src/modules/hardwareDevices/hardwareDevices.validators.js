import { z } from 'zod';

const hardwareType = z.enum([
  'RECEIPT_PRINTER', 'KOT_PRINTER', 'KDS_DISPLAY', 'OSS_DISPLAY',
  'CASH_DRAWER', 'CUSTOMER_DISPLAY', 'WEIGHING_SCALE',
]);
const station = z.enum(['HOT', 'COLD', 'BAR', 'DESSERT']);

const idParam = z.object({ id: z.string().min(8).max(40) });

export const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
    type: hardwareType.optional(),
  }),
});

export const idParamSchema = z.object({ params: idParam });

const deviceBody = z.object({
  branchId: z.string().min(8).max(40),
  type: hardwareType,
  label: z.string().trim().min(1).max(80),
  model: z.string().max(80).optional().nullable(),
  ip: z.string().max(60).optional().nullable(),
  macAddress: z.string().max(40).optional().nullable(),
  station: station.optional().nullable(),
  active: z.boolean().optional(),
});

export const createSchema = z.object({ body: deviceBody });

export const updateSchema = z.object({
  params: idParam,
  body: deviceBody.partial(),
});
