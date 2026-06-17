import { prisma } from '../../db/prisma.js';

/**
 * Billing repository — Plan / Subscription / Invoice / UsageRollup access.
 * Subscriptions are 1:1 with a tenant (tenantId unique).
 */
export const billingRepo = {
  /* ---- Plans ---- */
  listPlans() {
    return prisma.plan.findMany({ where: { active: true }, orderBy: { monthly: 'asc' } });
  },
  findPlan(slug) {
    return prisma.plan.findUnique({ where: { slug } });
  },

  /* ---- Subscription ---- */
  findSubscription({ tenantId }) {
    return prisma.subscription.findUnique({ where: { tenantId } });
  },
  createSubscription({ data }) {
    return prisma.subscription.create({ data });
  },
  updateSubscription({ id, data }) {
    return prisma.subscription.update({ where: { id }, data });
  },
  listActiveSubscriptions({ statuses }) {
    return prisma.subscription.findMany({ where: { status: { in: statuses } } });
  },
  dueSubscriptions({ now }) {
    return prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING'] }, renewsAt: { lte: now } },
    });
  },
  pastDueSubscriptions() {
    return prisma.subscription.findMany({ where: { status: 'PAST_DUE' } });
  },

  /* ---- Invoices ---- */
  createInvoice({ data }) {
    return prisma.invoice.create({ data });
  },
  listInvoices({ tenantId, take = 50 }) {
    return prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { issuedAt: 'desc' },
      take,
    });
  },
  findInvoice({ tenantId, id }) {
    return prisma.invoice.findFirst({ where: { tenantId, id } });
  },
  findInvoiceByRef({ paymentRef }) {
    return prisma.invoice.findFirst({ where: { paymentRef }, orderBy: { issuedAt: 'desc' } });
  },
  latestOpenInvoice({ tenantId }) {
    return prisma.invoice.findFirst({
      where: { tenantId, status: { in: ['OPEN', 'FAILED'] } },
      orderBy: { issuedAt: 'desc' },
    });
  },
  updateInvoice({ id, data }) {
    return prisma.invoice.update({ where: { id }, data });
  },
  countInvoicesInYear({ year }) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    return prisma.invoice.count({ where: { issuedAt: { gte: from, lt: to } } });
  },

  /* ---- Usage ---- */
  createUsageRollup({ subscriptionId, metric, value }) {
    return prisma.usageRollup.create({ data: { subscriptionId, metric, value } });
  },
  latestUsage({ subscriptionId, metric }) {
    return prisma.usageRollup.findFirst({
      where: { subscriptionId, metric },
      orderBy: { capturedAt: 'desc' },
    });
  },

  /* ---- Live counts for usage metrics ---- */
  countBranches({ tenantId }) {
    return prisma.branch.count({ where: { tenantId, deletedAt: null } });
  },
  countSeats({ tenantId }) {
    return prisma.user.count({ where: { tenantId, deletedAt: null, status: { not: 'SUSPENDED' } } });
  },
};
