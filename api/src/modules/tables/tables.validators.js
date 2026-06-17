import { z } from 'zod';

/**
 * Tables validators.
 *
 * Status mutation rules — see service. The CRUD endpoints accept FREE and
 * CLEANING as direct status sets (housekeeping). OCCUPIED / BILL / RESERVED
 * are reserved for the orders pipeline (Phase B) and reservations (Phase F).
 */

export const tableShape = z.enum(['round', 'square', 'rect']);
export const tableStatus = z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BILL']);
export const housekeepingStatus = z.enum(['FREE', 'CLEANING']);

const baseTableBody = z.object({
  name: z.string().trim().min(1).max(60),
  section: z.string().trim().min(1).max(60),
  capacity: z.coerce.number().int().min(0).max(50).default(4),
  shape: tableShape.default('round'),
  active: z.boolean().default(true),
  posLabel: z.string().max(40).optional().nullable(),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

const tableListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
  search: z.string().max(60).optional(),
  section: z.string().max(60).optional(),
  status: tableStatus.optional(),
});

export const listSchema = z.object({
  params: z.object({ branchId: z.string().min(8).max(40) }),
  query: tableListQuery,
});

export const listByTenantSchema = z.object({
  query: tableListQuery.extend({
    branchId: z.string().min(8).max(40).optional(),
  }),
});

export const createSchema = z.object({
  params: z.object({ branchId: z.string().min(8).max(40) }),
  body: baseTableBody,
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: baseTableBody.partial(),
});

export const setStatusSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    status: housekeepingStatus,
  }),
});
