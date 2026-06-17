import { randomBytes } from 'node:crypto';

import { prisma } from '../../db/prisma.js';
import { enqueueTenantExport } from '../../queues/settings.queue.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { paymentMethodConfigsService } from '../paymentMethodConfigs/paymentMethodConfigs.service.js';
import { taxSlabsService } from '../taxSlabs/taxSlabs.service.js';

const CACHE_PREFIX = 'settings';

/**
 * Settings service — owns the tenant-level settings row (identity, branding,
 * localization, invoice/receipt config) and assembles the read bundle the
 * frontend store hydrates from.
 *
 * The tenant row is a singleton per tenant, so we update by id directly
 * (mirrors paymentSettings). taxConfig (Json) carries receipt-level extras
 * the relational schema doesn't model (footer, round-off, service charge).
 */

function serializeTenant(t) {
  const tax = t.taxConfig ?? {};
  return {
    id: t.id,
    name: t.name,
    legalName: t.legalName ?? '',
    slug: t.slug,
    type: t.type,
    gstin: t.gstin ?? '',
    pan: t.pan ?? '',
    fssai: t.fssai ?? '',
    description: t.description ?? '',
    logoUrl: t.logoUrl ?? null,
    bannerUrl: t.bannerUrl ?? null,
    contactEmail: t.contactEmail ?? '',
    contactPhone: t.contactPhone ?? '',
    // Branding
    brandColor: t.brandColor,
    brandTheme: t.brandTheme,
    customDomain: t.customDomain ?? null,
    // Localization
    currency: t.currency,
    timezone: t.timezone,
    locale: t.locale,
    numberLocale: t.numberLocale,
    weekStart: t.weekStart,
    weightUnit: t.weightUnit,
    // Invoice / receipt
    invoicePrefix: t.invoicePrefix,
    invoiceSequence: t.invoiceSequence,
    receiptFooter: tax.receiptFooter ?? '',
    roundOff: tax.roundOff ?? true,
    logoOnReceipt: tax.logoOnReceipt ?? true,
    serviceChargeEnabled: tax.serviceChargeEnabled ?? false,
    serviceChargePct: tax.serviceChargePct ?? 0,
    taxInclusive: tax.inclusive ?? false,
    igstInterState: tax.igstInterState ?? false,
    demoMode: t.demoMode,
    updatedAt: t.updatedAt,
  };
}

async function getTenant(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw AppError.notFound('Tenant not found', 'TENANT_NOT_FOUND');
  return t;
}

export const settingsService = {
  async getBundle({ tenantId }) {
    const cacheKey = `svc:settings:bundle:${tenantId}`;
    return withCache({ key: cacheKey, ttlSec: 30, prefix: CACHE_PREFIX }, async () => {
      const t = await getTenant(tenantId);
      const [taxSlabs, paymentMethods] = await Promise.all([
        taxSlabsService.list({ tenantId }),
        paymentMethodConfigsService.list({ tenantId }),
      ]);
      return {
        tenant: serializeTenant(t),
        taxSlabs,
        paymentMethods,
      };
    });
  },

  async getTenantSettings({ tenantId }) {
    return serializeTenant(await getTenant(tenantId));
  },

  /** Restaurant identity + invoice + receipt extras. */
  async updateTenant({ tenantId, body, actor }) {
    const cur = await getTenant(tenantId);
    const data = {};
    for (const k of [
      'name', 'legalName', 'gstin', 'pan', 'fssai', 'description',
      'logoUrl', 'bannerUrl', 'contactEmail', 'contactPhone', 'type',
      'invoicePrefix',
    ]) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.invoiceSequence !== undefined) data.invoiceSequence = body.invoiceSequence;

    // Receipt / tax extras live in the taxConfig Json blob.
    const taxKeys = ['receiptFooter', 'roundOff', 'logoOnReceipt', 'serviceChargeEnabled', 'serviceChargePct', 'taxInclusive', 'igstInterState'];
    if (taxKeys.some((k) => body[k] !== undefined)) {
      const tax = { ...(cur.taxConfig ?? {}) };
      if (body.receiptFooter !== undefined) tax.receiptFooter = body.receiptFooter;
      if (body.roundOff !== undefined) tax.roundOff = body.roundOff;
      if (body.logoOnReceipt !== undefined) tax.logoOnReceipt = body.logoOnReceipt;
      if (body.serviceChargeEnabled !== undefined) tax.serviceChargeEnabled = body.serviceChargeEnabled;
      if (body.serviceChargePct !== undefined) tax.serviceChargePct = body.serviceChargePct;
      if (body.taxInclusive !== undefined) tax.inclusive = body.taxInclusive;
      if (body.igstInterState !== undefined) tax.igstInterState = body.igstInterState;
      data.taxConfig = tax;
    }

    const updated = await prisma.tenant.update({ where: { id: tenantId }, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SETTINGS_CHANGED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { section: 'restaurant', keys: Object.keys(data) },
    });
    return serializeTenant(updated);
  },

  async updateBranding({ tenantId, body, actor }) {
    const data = {};
    for (const k of ['brandColor', 'brandTheme', 'logoUrl', 'bannerUrl']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.customDomain !== undefined) {
      data.customDomain = body.customDomain || null;
      if (data.customDomain) {
        const dup = await prisma.tenant.findFirst({
          where: { customDomain: data.customDomain, NOT: { id: tenantId } },
          select: { id: true },
        });
        if (dup) throw AppError.conflict('That custom domain is already in use', 'CUSTOM_DOMAIN_TAKEN');
      }
    }
    const updated = await prisma.tenant.update({ where: { id: tenantId }, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SETTINGS_CHANGED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { section: 'branding', keys: Object.keys(data) },
    });
    return serializeTenant(updated);
  },

  async updateLocalization({ tenantId, body, actor }) {
    const data = {};
    for (const k of ['currency', 'timezone', 'locale', 'numberLocale', 'weightUnit']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.weekStart !== undefined) data.weekStart = body.weekStart;
    const updated = await prisma.tenant.update({ where: { id: tenantId }, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SETTINGS_CHANGED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { section: 'localization', keys: Object.keys(data) },
    });
    return serializeTenant(updated);
  },

  /** Kick off the async ZIP/JSON export → S3 → email owner. */
  async exportData({ tenantId, actor }) {
    let jobId = null;
    try {
      const job = await enqueueTenantExport({ tenantId, requestedBy: actor?.id });
      jobId = job?.id ?? null;
    } catch (err) {
      throw AppError.dependencyDown('Export queue unavailable', 'QUEUE_UNAVAILABLE');
    }
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TENANT_DATA_EXPORTED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { jobId },
    });
    return { queued: true, jobId, message: 'Export queued — the owner will receive an email when it is ready.' };
  },

  /**
   * GDPR close-tenant flow. Scrubs tenant + customer PII (keeps revenue rows
   * for continuity) and marks the workspace anonymized. Requires explicit
   * confirmation. Billing teardown is coordinated in Phase K.
   */
  async anonymizeTenant({ tenantId, confirm, actor }) {
    if (confirm !== true) {
      throw AppError.badRequest('Anonymization must be explicitly confirmed', 'CONFIRM_REQUIRED');
    }
    const anon = `anon-${randomBytes(6).toString('hex')}`;
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          legalName: null,
          gstin: null,
          pan: null,
          fssai: null,
          description: null,
          contactEmail: `${anon}@anon.vuedine.internal`,
          contactPhone: null,
          demoMode: false,
        },
      });
      // Scrub customer PII but retain the rows for revenue continuity.
      const customers = await tx.user.findMany({
        where: { tenantId, role: 'CUSTOMER', deletedAt: null },
        select: { id: true },
      });
      for (const c of customers) {
        const tag = `anon-${randomBytes(6).toString('hex')}`;
        await tx.user.update({
          where: { id: c.id },
          data: {
            name: 'Anonymized user',
            email: `${tag}@anon.vuedine.internal`,
            phone: null,
            avatarUrl: null,
          },
        });
        await tx.customerProfile.updateMany({
          where: { userId: c.id },
          data: { city: null, birthday: null, notes: null, anonymizedAt: new Date() },
        });
      }
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TENANT_ANONYMIZED',
      entityType: 'Tenant',
      entityId: tenantId,
    });
    return { anonymized: true };
  },
};
