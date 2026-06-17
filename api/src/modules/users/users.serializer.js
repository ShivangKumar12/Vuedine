/**
 * User serializer — maps DB row to the exact shape expected by AllUsers.tsx
 * and the customer/subscriber surfaces (Subscribers.tsx).
 */

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

const ROLE_TO_LABEL = {
  SUPER_ADMIN: 'Owner',
  OWNER: 'Owner',
  ADMIN: 'Manager',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  WAITER: 'Waiter',
  CHEF: 'Chef',
  CUSTOMER: 'Customer',
};

const STATUS_TO_LABEL = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  DELETED: 'Deleted',
};

const TIER_TO_LABEL = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function fmtJoined(dt) {
  if (!dt) return 'Pending';
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function relativeActive(dt) {
  if (!dt) return '—';
  const ms = Date.now() - new Date(dt).getTime();
  if (ms < 60_000) return 'Now';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)} hr ago`;
  if (ms < 7 * 86400_000) return `${Math.round(ms / 86400_000)} days ago`;
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function serializeUser(u) {
  const cp = u.customerProfile;
  const isCustomer = u.role === 'CUSTOMER';
  const activeShift = u.shifts?.[0] ?? null;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '—',
    avatarUrl: u.avatarUrl ?? null,
    initials: initials(u.name),
    role: ROLE_TO_LABEL[u.role] ?? u.role,
    roleCode: u.role,
    customRole: u.customRole
      ? { id: u.customRole.id, name: u.customRole.name, color: u.customRole.color }
      : null,
    status: STATUS_TO_LABEL[u.status] ?? u.status,
    statusCode: u.status,
    tenantId: u.tenantId,
    branchIds: u.branchIds ?? [],
    joinedAt: fmtJoined(u.emailVerifiedAt ?? u.createdAt),
    joinedIso: (u.emailVerifiedAt ?? u.createdAt)?.toISOString?.() ?? null,
    lastActive: relativeActive(u.lastActiveAt ?? u.lastLoginAt),
    lastActiveIso: (u.lastActiveAt ?? u.lastLoginAt)?.toISOString?.() ?? null,
    invitedAt: u.invitedAt?.toISOString?.() ?? null,
    inviteExpiresAt: u.inviteExpiresAt?.toISOString?.() ?? null,
    salary: u.salary ? num(u.salary) : null,
    hourlyRate: u.hourlyRate ? num(u.hourlyRate) : null,
    activeShiftId: activeShift?.id ?? null,
    // Performance column (AllUsers.tsx)
    spendOrSalary: isCustomer
      ? cp
        ? `₹${cp.totalSpend.toLocaleString('en-IN')} LTV`
        : '—'
      : u.salary
        ? `₹${Number(u.salary).toLocaleString('en-IN')}`
        : '—',
    ordersOrShifts: isCustomer
      ? cp
        ? `${cp.totalOrders} orders`
        : '—'
      : activeShift
        ? `On shift`
        : '—',
    // Customer-specific
    customer: cp
      ? {
          id: cp.id,
          tier: TIER_TO_LABEL[cp.tier],
          tierCode: cp.tier,
          totalSpend: num(cp.totalSpend),
          totalOrders: cp.totalOrders,
          lastOrderAt: cp.lastOrderAt?.toISOString?.() ?? null,
          birthday: cp.birthday?.toISOString?.() ?? null,
          city: cp.city,
          channels: cp.channels,
          tags: cp.tags,
          notes: cp.notes,
          loyaltyPoints: cp.loyaltyPoints,
          marketingConsent: cp.marketingConsent,
          unsubscribedAt: cp.unsubscribedAt?.toISOString?.() ?? null,
          anonymizedAt: cp.anonymizedAt?.toISOString?.() ?? null,
        }
      : null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function serializeSubscriber(u) {
  const cp = u.customerProfile;
  // Note: serializeUser is available if extended fields are needed in future.
  return {
    id: u.id,
    serverId: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '—',
    initials: initials(u.name),
    channels: cp?.channels ?? [],
    tier: cp ? TIER_TO_LABEL[cp.tier] : 'Bronze',
    tierCode: cp?.tier ?? 'BRONZE',
    city: cp?.city ?? '—',
    joinedAt: (u.createdAt ?? new Date()).toISOString().slice(0, 10),
    lastOrderAt: cp?.lastOrderAt?.toISOString?.()?.slice(0, 10) ?? null,
    orders: cp?.totalOrders ?? 0,
    spend: cp ? num(cp.totalSpend) : 0,
    tags: cp?.tags ?? [],
    status: cp?.unsubscribedAt
      ? 'Unsubscribed'
      : u.status === 'ACTIVE'
        ? 'Subscribed'
        : 'Unsubscribed',
    marketingConsent: cp?.marketingConsent ?? false,
    loyaltyPoints: cp?.loyaltyPoints ?? 0,
    anonymizedAt: cp?.anonymizedAt?.toISOString?.() ?? null,
  };
}

// serializeUser / serializeSubscriber are the two public exports of this module.
