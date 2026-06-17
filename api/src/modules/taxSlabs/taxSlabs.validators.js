import { z } from 'zod';

const idParam = z.object({ id: z.string().min(8).max(40) });

export const listSchema = z.object({
  query: z.object({
    branchId: z.string().min(8).max(40).optional(),
  }),
});

export const idParamSchema = z.object({ params: idParam });

const slabBody = z.object({
  branchId: z.string().min(8).max(40).optional().nullable(),
  name: z.string().trim().min(1).max(60),
  rate: z.coerce.number().min(0).max(100),
  hsnCodes: z.array(z.string().trim().min(1).max(20)).max(50).optional(),
  inclusive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const createSchema = z.object({ body: slabBody });

export const updateSchema = z.object({
  params: idParam,
  body: slabBody.partial(),
});
