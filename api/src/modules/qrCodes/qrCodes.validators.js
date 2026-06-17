import { z } from 'zod';

const qrType = z.enum(['TABLE', 'COUNTER', 'TAKEAWAY', 'DELIVERY', 'MARKETING']);
const qrStatus = z.enum(['ACTIVE', 'INACTIVE', 'PENDING']);

const idParam = z.object({ id: z.string().min(8).max(40) });

export const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
    branch: z.string().min(8).max(40).optional(), // spec alias ?branch=
    type: qrType.optional(),
    status: qrStatus.optional(),
  }),
});

export const idParamSchema = z.object({ params: idParam });

export const createSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40),
    // Manual mint is for non-table types.
    type: z.enum(['COUNTER', 'TAKEAWAY', 'DELIVERY', 'MARKETING']),
    label: z.string().trim().min(1).max(80),
    status: qrStatus.optional(),
  }),
});

export const updateSchema = z.object({
  params: idParam,
  body: z.object({
    label: z.string().trim().min(1).max(80).optional(),
    status: qrStatus.optional(),
  }),
});

export const bulkPrintSchema = z.object({
  body: z.object({
    branchId: z.string().min(8).max(40).optional(),
    type: qrType.optional(),
    ids: z.array(z.string().min(8).max(40)).max(500).optional(),
  }),
});

export const scanParamSchema = z.object({
  params: z.object({
    branchSlug: z.string().min(2).max(60),
    token: z.string().min(8).max(64),
  }),
});
