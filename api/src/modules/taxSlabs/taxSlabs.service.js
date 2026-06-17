import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { taxSlabsRepo } from './taxSlabs.repository.js';

const CACHE_PREFIX = 'settings';

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

function serialize(s) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    branchId: s.branchId ?? null,
    name: s.name,
    rate: num(s.rate),
    hsnCodes: s.hsnCodes ?? [],
    inclusive: s.inclusive,
    isDefault: s.isDefault,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export const taxSlabsService = {
  async list({ tenantId, branchId }) {
    const cacheKey = `svc:taxSlabs:${tenantId}:${branchId ?? 'all'}`;
    const rows = await withCache(
      { key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX },
      () => taxSlabsRepo.list({ tenantId, branchId }),
    );
    return rows.map(serialize);
  },

  async getById({ tenantId, id }) {
    const s = await taxSlabsRepo.findById({ tenantId, id });
    if (!s) throw AppError.notFound('Tax slab not found', 'TAX_SLAB_NOT_FOUND');
    return serialize(s);
  },

  async create({ tenantId, body, actor }) {
    if (body.isDefault) {
      await taxSlabsRepo.clearDefaults({ tenantId, branchId: body.branchId ?? null });
    }
    const slab = await taxSlabsRepo.create({
      tenantId,
      branchId: body.branchId ?? null,
      name: body.name,
      rate: body.rate,
      hsnCodes: body.hsnCodes ?? [],
      inclusive: body.inclusive ?? false,
      isDefault: body.isDefault ?? false,
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TAX_SLAB_CREATED',
      entityType: 'TaxSlab',
      entityId: slab.id,
      metadata: { name: slab.name, rate: num(slab.rate) },
    });
    return serialize(slab);
  },

  async update({ tenantId, id, body, actor }) {
    const cur = await taxSlabsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Tax slab not found', 'TAX_SLAB_NOT_FOUND');

    if (body.isDefault) {
      await taxSlabsRepo.clearDefaults({ tenantId, branchId: body.branchId ?? cur.branchId ?? null });
    }
    const data = {};
    for (const k of ['name', 'rate', 'hsnCodes', 'inclusive', 'isDefault']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.branchId !== undefined) data.branchId = body.branchId ?? null;

    const updated = await taxSlabsRepo.update({ tenantId, id, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TAX_SLAB_UPDATED',
      entityType: 'TaxSlab',
      entityId: id,
      metadata: Object.keys(data),
    });
    return serialize(updated);
  },

  async remove({ tenantId, id, actor }) {
    const count = await taxSlabsRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Tax slab not found', 'TAX_SLAB_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TAX_SLAB_DELETED',
      entityType: 'TaxSlab',
      entityId: id,
    });
  },
};
