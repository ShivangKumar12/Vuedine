import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { paymentMethodConfigsRepo } from './paymentMethodConfigs.repository.js';

const CACHE_PREFIX = 'settings';

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

function serialize(c) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    branchId: c.branchId ?? null,
    method: c.method,
    enabled: c.enabled,
    preferred: c.preferred,
    serviceCharge: num(c.serviceCharge),
    meta: c.meta ?? null,
    updatedAt: c.updatedAt,
  };
}

export const paymentMethodConfigsService = {
  async list({ tenantId, branchId }) {
    const cacheKey = `svc:pmc:${tenantId}:${branchId ?? 'all'}`;
    const rows = await withCache(
      { key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX },
      () => paymentMethodConfigsRepo.list({ tenantId, branchId }),
    );
    return rows.map(serialize);
  },

  /** Create or update a per-method config (idempotent on tenant+branch+method). */
  async upsert({ tenantId, body, actor }) {
    const branchId = body.branchId ?? null;
    if (body.preferred) {
      await paymentMethodConfigsRepo.clearPreferred({ tenantId, branchId });
    }
    const data = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.preferred !== undefined) data.preferred = body.preferred;
    if (body.serviceCharge !== undefined) data.serviceCharge = body.serviceCharge;
    if (body.meta !== undefined) data.meta = body.meta;

    const row = await paymentMethodConfigsRepo.upsert({ tenantId, branchId, method: body.method, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_METHOD_CONFIG_CHANGED',
      entityType: 'PaymentMethodConfig',
      entityId: row.id,
      metadata: { method: body.method, branchId },
    });
    return serialize(row);
  },

  async remove({ tenantId, id, actor }) {
    const count = await paymentMethodConfigsRepo.remove({ tenantId, id });
    if (count === 0) throw AppError.notFound('Config not found', 'PMC_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_METHOD_CONFIG_CHANGED',
      entityType: 'PaymentMethodConfig',
      entityId: id,
      metadata: { deleted: true },
    });
  },
};
