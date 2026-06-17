import { logger } from '../../config/logger.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';

import {
  ADDON_DEFS,
  DEFAULT_PLAN,
  TRIAL_DAYS,
  isUpgrade,
  planLimits,
} from './billing.plans.js';
import { billingRepo } from './billing.repository.js';
import { serializeInvoice, serializePlan, serializeSubscription } from './billing.serializer.js';

const DAY_MS = 86_400_000;

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function periodLabel(date) {
  return new Date(date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

async function nextInvoiceNumber(now = new Date()) {
  const year = now.getUTCFullYear();
  const seq = (await billingRepo.countInvoicesInYear({ year })) + 1;
  return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

/** Price-per-outlet for a plan + cycle (cycle: 'MONTHLY' | 'YEARLY'). */
function unitPrice(plan, cycle) {
  return cycle === 'YEARLY' ? num(plan.yearly) : num(plan.monthly);
}

export const billingService = {
  /** Lazily provision a default subscription for a tenant that has none. */
  async ensure({ tenantId, actor } = {}) {
    const existing = await billingRepo.findSubscription({ tenantId });
    if (existing) return existing;

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
    const limits = planLimits(DEFAULT_PLAN);
    const sub = await billingRepo.createSubscription({
      data: {
        tenantId,
        planSlug: DEFAULT_PLAN,
        cycle: 'YEARLY',
        status: 'TRIALING',
        startedAt: now,
        renewsAt: trialEndsAt,
        trialEndsAt,
        seatLimit: limits.seatLimit,
        branchLimit: limits.branchLimit,
        storageLimitGb: limits.storageLimitGb,
        aiQuota: limits.aiQuota,
        meta: { addons: [] },
      },
    });
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'Subscription',
      entityId: sub.id,
      metadata: { planSlug: DEFAULT_PLAN, status: 'TRIALING' },
    });
    return sub;
  },

  /** Live usage snapshot (counts from base tables + last captured rollups). */
  async computeUsage({ tenantId, sub }) {
    const [outlets, seats, aiRollup, storageRollup] = await Promise.all([
      billingRepo.countBranches({ tenantId }),
      billingRepo.countSeats({ tenantId }),
      billingRepo.latestUsage({ subscriptionId: sub.id, metric: 'aiRequests' }),
      billingRepo.latestUsage({ subscriptionId: sub.id, metric: 'storageGb' }),
    ]);
    return {
      outlets: { used: outlets, limit: sub.branchLimit },
      seats: { used: seats, limit: sub.seatLimit },
      aiRequests: { used: aiRollup ? Math.round(num(aiRollup.value)) : 0, limit: sub.aiQuota },
      storage: { used: storageRollup ? num(storageRollup.value) : 0, limit: num(sub.storageLimitGb) },
    };
  },

  async getCurrent({ tenantId, actor }) {
    const sub = await this.ensure({ tenantId, actor });
    const [plans, usage, invoices] = await Promise.all([
      billingRepo.listPlans(),
      this.computeUsage({ tenantId, sub }),
      billingRepo.listInvoices({ tenantId, take: 12 }),
    ]);
    const plan = plans.find((p) => p.slug === sub.planSlug) ?? null;
    return {
      plan: plan ? serializePlan(plan) : null,
      plans: plans.map(serializePlan),
      addonsCatalog: ADDON_DEFS,
      subscription: serializeSubscription(sub),
      usage,
      invoices: invoices.map(serializeInvoice),
    };
  },

  /** Create an invoice for a subscription period. */
  async _generateInvoice({ tenantId, sub, plan, status = 'OPEN', now = new Date(), dueInDays = 7 }) {
    const outlets = Math.max(1, await billingRepo.countBranches({ tenantId }));
    const amount = +(unitPrice(plan, sub.cycle) * outlets).toFixed(2);
    const taxAmount = +(amount * 0.18).toFixed(2);
    const number = await nextInvoiceNumber(now);
    const invoice = await billingRepo.createInvoice({
      data: {
        tenantId,
        subscriptionId: sub.id,
        number,
        period: periodLabel(now),
        amount,
        taxAmount,
        status,
        issuedAt: now,
        dueAt: new Date(now.getTime() + dueInDays * DAY_MS),
      },
    });
    await auditService.record({
      tenantId,
      action: 'INVOICE_GENERATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { number, amount, status },
    });
    return invoice;
  },

  async changePlan({ tenantId, planSlug, cycle, actor }) {
    const sub = await this.ensure({ tenantId, actor });
    const plan = await billingRepo.findPlan(planSlug);
    if (!plan || !plan.active) throw AppError.notFound('Unknown plan', 'PLAN_NOT_FOUND');

    const limits = planLimits(planSlug);
    const dbCycle = cycle === 'monthly' ? 'MONTHLY' : 'YEARLY';

    // Downgrade guard — can't move to a plan whose limits are below current usage.
    const [branches, seats] = await Promise.all([
      billingRepo.countBranches({ tenantId }),
      billingRepo.countSeats({ tenantId }),
    ]);
    if (branches > limits.branchLimit) {
      throw new AppError(
        `Your account has ${branches} outlets but ${plan.name} allows ${limits.branchLimit}. Remove outlets before downgrading.`,
        { statusCode: 402, code: 'PLAN_LIMIT_EXCEEDED', details: { metric: 'outlets', used: branches, limit: limits.branchLimit, upgrade: '/dashboard/subscription' } },
      );
    }
    if (seats > limits.seatLimit) {
      throw new AppError(
        `Your account has ${seats} staff seats but ${plan.name} allows ${limits.seatLimit}.`,
        { statusCode: 402, code: 'PLAN_LIMIT_EXCEEDED', details: { metric: 'seats', used: seats, limit: limits.seatLimit, upgrade: '/dashboard/subscription' } },
      );
    }

    const upgrade = isUpgrade(sub.planSlug, planSlug);
    const now = new Date();
    const keepTrial = sub.status === 'TRIALING';
    const renewsAt = keepTrial ? sub.renewsAt : addMonths(now, dbCycle === 'YEARLY' ? 12 : 1);

    const updated = await billingRepo.updateSubscription({
      id: sub.id,
      data: {
        planSlug,
        cycle: dbCycle,
        status: keepTrial ? 'TRIALING' : 'ACTIVE',
        renewsAt,
        cancelledAt: null,
        seatLimit: limits.seatLimit,
        branchLimit: limits.branchLimit,
        storageLimitGb: limits.storageLimitGb,
        aiQuota: limits.aiQuota,
      },
    });

    // Upgrades with a paid plan generate a pro-rated invoice and require a
    // gateway mandate (Razorpay subscription) before the next cycle.
    let invoice = null;
    const price = unitPrice(plan, dbCycle);
    if (upgrade && price > 0 && !keepTrial) {
      invoice = await this._generateInvoice({ tenantId, sub: updated, plan, status: 'OPEN', now });
    }

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SUBSCRIPTION_PLAN_CHANGED',
      entityType: 'Subscription',
      entityId: sub.id,
      metadata: { from: sub.planSlug, to: planSlug, cycle: dbCycle, upgrade },
    });

    const mandate = {
      provider: 'razorpay',
      required: upgrade && price > 0,
      // A real impl creates a Razorpay subscription + returns its short_url for
      // the customer to authorize the mandate. Stubbed reference here.
      subscriptionRef: upgrade && price > 0 ? `sub_${updated.id.slice(-12)}` : null,
      shortUrl: null,
    };

    return {
      subscription: serializeSubscription(updated),
      invoice: invoice ? serializeInvoice(invoice) : null,
      mandate,
    };
  },

  async cancel({ tenantId, actor }) {
    const sub = await this.ensure({ tenantId, actor });
    const updated = await billingRepo.updateSubscription({
      id: sub.id,
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Subscription',
      entityId: sub.id,
      metadata: { activeUntil: sub.renewsAt },
    });
    return serializeSubscription(updated);
  },

  async resume({ tenantId, actor }) {
    const sub = await this.ensure({ tenantId, actor });
    if (sub.status !== 'CANCELLED') {
      throw AppError.badRequest('Subscription is not cancelled', 'SUBSCRIPTION_NOT_CANCELLED');
    }
    const updated = await billingRepo.updateSubscription({
      id: sub.id,
      data: { status: 'ACTIVE', cancelledAt: null },
    });
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SUBSCRIPTION_RESUMED',
      entityType: 'Subscription',
      entityId: sub.id,
    });
    return serializeSubscription(updated);
  },

  async toggleAddon({ tenantId, addonId, actor }) {
    const def = ADDON_DEFS.find((a) => a.id === addonId);
    if (!def) throw AppError.notFound('Unknown add-on', 'ADDON_NOT_FOUND');
    const sub = await this.ensure({ tenantId, actor });
    const current = Array.isArray(sub.meta?.addons) ? sub.meta.addons : [];
    const enabled = current.includes(addonId);
    const next = enabled ? current.filter((a) => a !== addonId) : [...current, addonId];
    const updated = await billingRepo.updateSubscription({
      id: sub.id,
      data: { meta: { ...(sub.meta ?? {}), addons: next } },
    });
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SUBSCRIPTION_ADDON_TOGGLED',
      entityType: 'Subscription',
      entityId: sub.id,
      metadata: { addonId, enabled: !enabled },
    });
    return { subscription: serializeSubscription(updated), enabled: !enabled };
  },

  /** Throw if adding one more branch would exceed the plan's outlet limit. */
  async assertBranchQuota({ tenantId }) {
    const sub = await this.ensure({ tenantId });
    const count = await billingRepo.countBranches({ tenantId });
    if (count >= sub.branchLimit) {
      throw new AppError(
        `Your ${sub.planSlug} plan allows ${sub.branchLimit} outlet(s). Upgrade to add more.`,
        {
          statusCode: 402,
          code: 'PLAN_LIMIT_EXCEEDED',
          details: { metric: 'outlets', used: count, limit: sub.branchLimit, upgrade: '/dashboard/subscription' },
        },
      );
    }
  },

  /* ---- Invoices ---- */
  async listInvoices({ tenantId }) {
    const invoices = await billingRepo.listInvoices({ tenantId, take: 50 });
    return invoices.map(serializeInvoice);
  },
  async getInvoice({ tenantId, id }) {
    const inv = await billingRepo.findInvoice({ tenantId, id });
    if (!inv) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
    return inv;
  },

  /** Apply a gateway payment result to the matching invoice. */
  async applyPayment({ tenantId, paymentRef, success, gatewayEvent }) {
    const sub = await billingRepo.findSubscription({ tenantId });
    if (!sub) return { ignored: true };
    let invoice = paymentRef ? await billingRepo.findInvoiceByRef({ paymentRef }) : null;
    if (!invoice) invoice = await billingRepo.latestOpenInvoice({ tenantId });
    if (!invoice) return { ignored: true };

    if (success) {
      const paid = await billingRepo.updateInvoice({
        id: invoice.id,
        data: { status: 'PAID', paidAt: new Date(), paymentRef: paymentRef ?? invoice.paymentRef },
      });
      await billingRepo.updateSubscription({
        id: sub.id,
        data: { status: 'ACTIVE', meta: { ...(sub.meta ?? {}), frozen: false } },
      });
      await auditService.record({
        tenantId,
        action: 'INVOICE_PAID',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { number: invoice.number, gatewayEvent },
      });
      return { invoiceId: paid.id, status: 'PAID' };
    }

    await billingRepo.updateInvoice({ id: invoice.id, data: { status: 'FAILED' } });
    await billingRepo.updateSubscription({ id: sub.id, data: { status: 'PAST_DUE' } });
    await auditService.record({
      tenantId,
      action: 'INVOICE_FAILED',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { number: invoice.number, gatewayEvent },
    });
    return { invoiceId: invoice.id, status: 'FAILED' };
  },

  /* ---- Scheduled jobs ---- */

  /** Hourly: snapshot usage metrics for every subscription (or one tenant). */
  async runUsageCapture({ tenantId } = {}) {
    const subs = tenantId
      ? [await billingRepo.findSubscription({ tenantId })].filter(Boolean)
      : await billingRepo.listActiveSubscriptions({ statuses: ['TRIALING', 'ACTIVE', 'PAST_DUE'] });
    let captured = 0;
    for (const sub of subs) {
      const [outlets, seats] = await Promise.all([
        billingRepo.countBranches({ tenantId: sub.tenantId }),
        billingRepo.countSeats({ tenantId: sub.tenantId }),
      ]);
      await billingRepo.createUsageRollup({ subscriptionId: sub.id, metric: 'outlets', value: outlets });
      await billingRepo.createUsageRollup({ subscriptionId: sub.id, metric: 'seats', value: seats });
      captured += 1;
    }
    return { captured };
  },

  /** Daily: generate invoices for subscriptions whose renewsAt has passed. */
  async runInvoiceCycle({ now = new Date() } = {}) {
    const due = await billingRepo.dueSubscriptions({ now });
    const plans = await billingRepo.listPlans();
    let generated = 0;
    for (const sub of due) {
      const plan = plans.find((p) => p.slug === sub.planSlug);
      if (!plan) continue;
      const price = unitPrice(plan, sub.cycle);
      const months = sub.cycle === 'YEARLY' ? 12 : 1;
      // Free/enterprise-custom plans (price 0) skip invoicing but still roll renewal.
      if (price > 0) {
        await this._generateInvoice({ tenantId: sub.tenantId, sub, plan, status: 'OPEN', now });
        generated += 1;
      }
      await billingRepo.updateSubscription({
        id: sub.id,
        data: { status: 'ACTIVE', renewsAt: addMonths(sub.renewsAt, months) },
      });
    }
    return { generated };
  },

  /** Daily: past-due escalation — day 3 email, day 7 SMS, day 14 freeze. */
  async runDunning({ now = new Date() } = {}) {
    const subs = await billingRepo.pastDueSubscriptions();
    const summary = { emailed: 0, smsed: 0, frozen: 0 };
    for (const sub of subs) {
      const invoice = await billingRepo.latestOpenInvoice({ tenantId: sub.tenantId });
      if (!invoice) continue;
      const daysOverdue = Math.floor((now.getTime() - new Date(invoice.dueAt).getTime()) / DAY_MS);
      if (daysOverdue >= 14) {
        await billingRepo.updateSubscription({
          id: sub.id,
          data: { meta: { ...(sub.meta ?? {}), frozen: true } },
        });
        summary.frozen += 1;
      } else if (daysOverdue >= 7) {
        summary.smsed += 1; // SMS provider call stubbed
      } else if (daysOverdue >= 3) {
        try {
          await enqueueEmail({
            to: `owner+${sub.tenantId}@vuedine.invalid`,
            subject: `Payment overdue — invoice ${invoice.number}`,
            template: 'welcome',
            data: { number: invoice.number },
          });
          summary.emailed += 1;
        } catch (err) {
          logger.warn('billing.dunning.email_failed', { message: err.message });
        }
      }
    }
    return summary;
  },
};
