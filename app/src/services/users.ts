import { api } from '../lib/api';

/**
 * Users service — backs AllUsers.tsx, UserRoles.tsx, Subscribers.tsx
 * and the Invite flow.
 */

export type UserRoleCode = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'CHEF' | 'CUSTOMER';
export type UserStatusCode = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DELETED';
export type CustomerTierCode = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type CustomRole = {
  id: string;
  name: string;
  color: string;
};

export type CustomerProfile = {
  id: string;
  tier: string;
  tierCode: CustomerTierCode;
  totalSpend: number;
  totalOrders: number;
  lastOrderAt: string | null;
  birthday: string | null;
  city: string | null;
  channels: string[];
  tags: string[];
  notes: string | null;
  loyaltyPoints: number;
  marketingConsent: boolean;
  unsubscribedAt: string | null;
  anonymizedAt: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  initials: string;
  role: string;         // friendly label: 'Owner' | 'Manager' | …
  roleCode: UserRoleCode;
  customRole: CustomRole | null;
  status: string;       // 'Active' | 'Invited' | 'Suspended'
  statusCode: UserStatusCode;
  tenantId: string | null;
  branchIds: string[];
  joinedAt: string;
  joinedIso: string | null;
  lastActive: string;
  lastActiveIso: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  salary: number | null;
  hourlyRate: number | null;
  activeShiftId: string | null;
  spendOrSalary: string;
  ordersOrShifts: string;
  customer: CustomerProfile | null;
  createdAt: string;
  updatedAt: string;
};

export type InviteInput = {
  email: string;
  name: string;
  role: Exclude<UserRoleCode, 'OWNER' | 'CUSTOMER'>;
  branchIds?: string[];
  salary?: number | null;
};

export type UpdateUserInput = {
  name?: string;
  phone?: string | null;
  role?: UserRoleCode;
  branchIds?: string[];
  salary?: number | null;
  hourlyRate?: number | null;
  avatarUrl?: string | null;
};

export type UsersListFilter = {
  group?: 'All' | 'Staff' | 'Customers';
  role?: UserRoleCode;
  status?: UserStatusCode;
  branchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type Role = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  systemRole: boolean;
  color: string;
  members: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRoleInput = {
  name: string;
  description?: string | null;
  color?: string;
  permissions?: string[];
};

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  channels: string[];
  tier: string;
  tierCode: CustomerTierCode;
  city: string;
  joinedAt: string;
  lastOrderAt: string | null;
  orders: number;
  spend: number;
  tags: string[];
  status: 'Subscribed' | 'Unsubscribed' | 'Bounced';
  marketingConsent: boolean;
  loyaltyPoints: number;
  anonymizedAt: string | null;
};

export type CustomerOrder = {
  id: string;
  serial: string;
  type: string;
  channel: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: string | null;
};

export type CustomerDetail = Subscriber & {
  orders: CustomerOrder[];
  ltv: number;
  orderCount: number;
};

export type SubscriberInput = {
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  tier?: CustomerTierCode;
  channels?: string[];
  tags?: string[];
  marketingConsent?: boolean;
  birthday?: string | null;
  notes?: string | null;
};

export type Shift = {
  id: string;
  tenantId: string;
  branchId: string;
  userId: string;
  userName: string | null;
  startedAt: string;
  endedAt: string | null;
  cashIn: number | null;
  cashOut: number | null;
  variance: number | null;
  note: string | null;
  open: boolean;
};

export const usersApi = {
  /* ---- Staff ---- */
  list(filter: UsersListFilter = {}): Promise<User[]> {
    return api.get<User[]>('/v1/users', {
      query: {
        page: filter.page ?? 1,
        pageSize: filter.pageSize ?? 100,
        group: filter.group,
        role: filter.role,
        status: filter.status,
        branchId: filter.branchId,
        search: filter.search,
      },
    });
  },

  get(id: string): Promise<User> {
    return api.get<User>(`/v1/users/${id}`);
  },

  invite(input: InviteInput): Promise<User & { inviteUrl: string }> {
    return api.post<User & { inviteUrl: string }>('/v1/users/invite', input);
  },

  update(id: string, input: UpdateUserInput): Promise<User> {
    return api.patch<User>(`/v1/users/${id}`, input);
  },

  suspend(id: string): Promise<User> {
    return api.post<User>(`/v1/users/${id}/suspend`);
  },

  restore(id: string): Promise<User> {
    return api.post<User>(`/v1/users/${id}/restore`);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/v1/users/${id}`);
  },

  assignRole(id: string, input: { roleId?: string | null; role?: UserRoleCode }): Promise<User> {
    return api.post<User>(`/v1/users/${id}/role`, input);
  },

  resetPin(id: string, pin: string): Promise<User> {
    return api.post<User>(`/v1/users/${id}/reset-pin`, { pin });
  },

  verifyPin(id: string, pin: string): Promise<{ verified: boolean; userId: string }> {
    return api.post<{ verified: boolean; userId: string }>(`/v1/users/${id}/verify-pin`, { pin });
  },

  getActivity(id: string, take = 20): Promise<Record<string, unknown>[]> {
    return api.get<Record<string, unknown>[]>(`/v1/users/${id}/activity`, { query: { take } });
  },

  /* ---- Invite acceptance (public) ---- */
  resolveInvite(token: string): Promise<{ userId: string; email: string; name: string; role: string }> {
    return api.get(`/v1/users/invite/${token}`);
  },

  acceptInvite(token: string, input: { password: string; name?: string; phone?: string }): Promise<User> {
    return api.post<User>(`/v1/users/invite/${token}/accept`, input);
  },

  /* ---- Roles ---- */
  listRoles(): Promise<Role[]> {
    return api.get<Role[]>('/v1/roles');
  },

  getRole(id: string): Promise<Role> {
    return api.get<Role>(`/v1/roles/${id}`);
  },

  createRole(input: CreateRoleInput): Promise<Role> {
    return api.post<Role>('/v1/roles', input);
  },

  updateRole(id: string, patch: Partial<CreateRoleInput>): Promise<Role> {
    return api.patch<Role>(`/v1/roles/${id}`, patch);
  },

  deleteRole(id: string): Promise<void> {
    return api.delete(`/v1/roles/${id}`);
  },

  /* ---- Customers ---- */
  listCustomers(query: {
    segment?: string;
    tier?: CustomerTierCode;
    search?: string;
    branchId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<Subscriber[]> {
    return api.get<Subscriber[]>('/v1/users/customers', { query: { pageSize: 200, ...query } });
  },

  getCustomer(id: string): Promise<CustomerDetail> {
    return api.get<CustomerDetail>(`/v1/users/customers/${id}`);
  },

  updateCustomerTags(id: string, tags: string[]): Promise<Subscriber> {
    return api.patch<Subscriber>(`/v1/users/customers/${id}/tags`, { tags });
  },

  updateCustomerPreferences(id: string, prefs: {
    channels?: string[];
    marketingConsent?: boolean;
    birthday?: string | null;
    city?: string | null;
    notes?: string | null;
  }): Promise<Subscriber> {
    return api.patch<Subscriber>(`/v1/users/customers/${id}/preferences`, prefs);
  },

  anonymize(id: string): Promise<void> {
    return api.post(`/v1/users/customers/${id}/anonymize`);
  },

  /* ---- Subscribers ---- */
  listSubscribers(query: {
    segment?: string;
    tier?: CustomerTierCode;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<Subscriber[]> {
    return api.get<Subscriber[]>('/v1/users/customers', {
      query: { pageSize: 200, ...query },
    });
  },

  createSubscriber(input: SubscriberInput): Promise<Subscriber> {
    return api.post<Subscriber>('/v1/users/subscribers', input);
  },

  updateSubscriber(id: string, input: SubscriberInput): Promise<Subscriber> {
    return api.patch<Subscriber>(`/v1/users/subscribers/${id}`, input);
  },

  deleteSubscriber(id: string): Promise<void> {
    return api.delete(`/v1/users/subscribers/${id}`);
  },

  importCustomers(csv: string): Promise<{ created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] }> {
    return api.post('/v1/users/customers/import', { csv });
  },

  bulkCustomers(input: { ids: string[]; action: 'unsubscribe' | 'subscribe' | 'channels' | 'tag' | 'delete'; tags?: string[]; channels?: string[] }): Promise<{ affected: number }> {
    return api.post('/v1/users/customers/bulk', input);
  },

  /* ---- Shifts ---- */
  startShift(branchId: string, cashIn?: number): Promise<Shift> {
    return api.post<Shift>('/v1/shifts/start', { branchId, cashIn });
  },

  endShift(id: string, cashOut?: number, note?: string): Promise<Shift> {
    return api.post<Shift>(`/v1/shifts/${id}/end`, { cashOut, note });
  },

  listShifts(query: { userId?: string; branchId?: string; from?: string; to?: string } = {}): Promise<Shift[]> {
    return api.get<Shift[]>('/v1/shifts', { query });
  },
};
