import { z } from 'zod';

const dateStr = z.string().min(4).max(40);

export const dashboardSchema = z.object({
  query: z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    branchId: z.string().min(8).max(40).optional(),
  }),
});

export const salesSchema = z.object({
  query: z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    branchId: z.string().min(8).max(40).optional(),
    type: z.enum(['All', 'Dine-In', 'Takeaway', 'Delivery', 'QR']).optional(),
    payment: z.enum(['All', 'Cash', 'Card', 'UPI', 'Wallet', 'Online']).optional(),
    status: z.enum(['All', 'Paid', 'Pending', 'Refunded', 'Failed']).optional(),
    search: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(10),
  }),
});

export const exportSchema = z.object({
  query: z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    branchId: z.string().min(8).max(40).optional(),
    type: z.enum(['All', 'Dine-In', 'Takeaway', 'Delivery', 'QR']).optional(),
    payment: z.enum(['All', 'Cash', 'Card', 'UPI', 'Wallet', 'Online']).optional(),
    status: z.enum(['All', 'Paid', 'Pending', 'Refunded', 'Failed']).optional(),
    search: z.string().max(120).optional(),
    format: z.enum(['csv', 'excel', 'pdf', 'gst']).default('csv'),
    async: z.enum(['true', 'false']).optional(),
  }),
});

export const itemsPopularitySchema = z.object({
  query: z.object({
    period: z.enum(['7d', '30d', '90d']).default('30d'),
    branchId: z.string().min(8).max(40).optional(),
  }),
});

export const topCustomersSchema = z.object({
  query: z.object({
    period: z.enum(['7d', '30d', '90d']).optional(),
    branchId: z.string().min(8).max(40).optional(),
    take: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const staffSchema = z.object({
  query: z.object({
    from: dateStr.optional(),
    to: dateStr.optional(),
    branchId: z.string().min(8).max(40).optional(),
  }),
});
