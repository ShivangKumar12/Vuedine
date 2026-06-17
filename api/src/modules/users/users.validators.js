import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

const userRole = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF', 'CUSTOMER']);
const userStatus = z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED']);

const baseListQuery = offsetSchema.extend({
  group: z.enum(['All', 'Staff', 'Customers']).optional(),
  role: userRole.optional(),
  status: userStatus.optional(),
  branchId: z.string().max(40).optional(),
  search: z.string().max(120).optional(),
});

export const listSchema = z.object({ query: baseListQuery });

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
});

export const inviteSchema = z.object({
  body: z.object({
    email: z.string().email().max(200),
    name: z.string().min(1).max(120),
    role: userRole.exclude(['OWNER', 'CUSTOMER']),
    branchIds: z.array(z.string().min(8).max(40)).max(50).optional().default([]),
    salary: z.coerce.number().min(0).optional().nullable(),
  }),
});

export const acceptInviteSchema = z.object({
  params: z.object({ token: z.string().min(10).max(100) }),
  body: z.object({
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional().nullable(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional().nullable(),
    role: userRole.optional(),
    branchIds: z.array(z.string().min(8).max(40)).max(50).optional(),
    salary: z.coerce.number().min(0).optional().nullable(),
    hourlyRate: z.coerce.number().min(0).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
  }),
});

export const assignRoleSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    roleId: z.string().min(8).max(40).nullable(),
    role: userRole.optional(),
  }),
});

export const pinSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    pin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits'),
  }),
});

export const verifyPinSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    pin: z.string().length(4).regex(/^\d{4}$/, 'PIN must be 4 digits'),
  }),
});

export const activitySchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  query: z.object({ take: z.coerce.number().int().min(1).max(100).default(20) }),
});

export const customerTagsSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    tags: z.array(z.string().min(1).max(60)).max(20),
  }),
});

export const customerPrefsSchema = z.object({
  params: z.object({ id: z.string().min(8).max(40) }),
  body: z.object({
    channels: z.array(z.enum(['Email', 'SMS', 'WhatsApp', 'Push'])).optional(),
    marketingConsent: z.boolean().optional(),
    birthday: z.string().optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  }),
});

const baseCustomerListQuery = offsetSchema.extend({
  segment: z.string().max(40).optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  search: z.string().max(120).optional(),
  branchId: z.string().max(40).optional(),
});
export const customerListSchema = z.object({ query: baseCustomerListQuery });

export const importCustomersSchema = z.object({
  body: z.object({
    csv: z.string().max(5_000_000).optional(),
    rows: z.array(z.record(z.any())).max(20000).optional(),
  }).refine((b) => b.csv || b.rows, { message: 'Provide csv or rows' }),
});

export const bulkCustomersSchema = z.object({
  body: z.object({
    ids: z.array(z.string().min(8).max(40)).min(1).max(5000),
    action: z.enum(['unsubscribe', 'subscribe', 'channels', 'tag', 'delete']),
    tags: z.array(z.string().min(1).max(60)).max(20).optional(),
    channels: z.array(z.enum(['Email', 'SMS', 'WhatsApp', 'Push'])).optional(),
  }),
});

export const subscriberUpsertSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    phone: z.string().max(40).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
    channels: z.array(z.enum(['Email', 'SMS', 'WhatsApp', 'Push'])).optional(),
    tags: z.array(z.string().max(60)).max(20).optional(),
    marketingConsent: z.boolean().optional(),
    birthday: z.string().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  }),
});
