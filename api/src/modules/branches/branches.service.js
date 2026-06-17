import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { billingService } from '../billing/billing.service.js';

import { branchesRepo } from './branches.repository.js';

/**
 * Branches service.
 *
 * Caching:
 *   - List queries cached for 60s, prefix `branches`. The route-level cache
 *     middleware also uses this same prefix so a single bumpVersion('branches')
 *     invalidates both layers in O(1).
 *   - Detail GETs are uncached (single row lookup is cheap; per-id keys
 *     would explode).
 */

const CACHE_PREFIX = 'branches';

export const branchesService = {
  async list({ tenantId, page = 1, pageSize = 50, search, isLive }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isLive !== undefined ? { isLive } : {}),
    };

    const cacheKey = `service:branches:${tenantId}:${page}:${pageSize}:${search ?? ''}:${isLive ?? ''}`;

    return withCache({ key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX }, async () => {
      const [rows, total] = await branchesRepo.list({ tenantId, where, take: pageSize, skip });
      return { rows, total };
    });
  },

  async getById({ tenantId, id }) {
    const branch = await branchesRepo.findById({ tenantId, id });
    if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    return branch;
  },

  async create({ tenantId, data, actor }) {
    await billingService.assertBranchQuota({ tenantId });
    const dupCode = await branchesRepo.findByCode({ tenantId, code: data.code });
    if (dupCode) {
      throw AppError.conflict(`Branch code "${data.code}" is already used`, 'BRANCH_CODE_TAKEN');
    }
    const dupSlug = await branchesRepo.findBySlug({ qrSlug: data.qrSlug });
    if (dupSlug) {
      throw AppError.conflict(`Slug "${data.qrSlug}" is already used`, 'BRANCH_SLUG_TAKEN');
    }

    const branch = await branchesRepo.create({ ...data, tenantId });
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'BRANCH_CREATED',
      entityType: 'Branch',
      entityId: branch.id,
      metadata: { name: branch.name, code: branch.code, qrSlug: branch.qrSlug },
    });

    return branch;
  },

  async update({ tenantId, id, data, actor }) {
    if (data.code) {
      const dup = await branchesRepo.findByCode({ tenantId, code: data.code });
      if (dup && dup.id !== id) {
        throw AppError.conflict(`Branch code "${data.code}" is already used`, 'BRANCH_CODE_TAKEN');
      }
    }
    if (data.qrSlug) {
      const dup = await branchesRepo.findBySlug({ qrSlug: data.qrSlug });
      if (dup && dup.id !== id) {
        throw AppError.conflict(`Slug "${data.qrSlug}" is already used`, 'BRANCH_SLUG_TAKEN');
      }
    }

    const updated = await branchesRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    // Tables share branch context (qrSlug printed on QR). Invalidate them too.
    await bumpVersion('tables');

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'BRANCH_UPDATED',
      entityType: 'Branch',
      entityId: updated.id,
      metadata: Object.keys(data),
    });

    return updated;
  },

  async toggleLive({ tenantId, id, isLive, actor }) {
    const current = await branchesRepo.findById({ tenantId, id });
    if (!current) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');

    const next = typeof isLive === 'boolean' ? isLive : !current.isLive;
    const updated = await branchesRepo.update({ tenantId, id, data: { isLive: next } });
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'BRANCH_TOGGLED_LIVE',
      entityType: 'Branch',
      entityId: id,
      metadata: { isLive: next },
    });

    return updated;
  },

  async remove({ tenantId, id, actor }) {
    const count = await branchesRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await bumpVersion('tables');

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'BRANCH_DELETED',
      entityType: 'Branch',
      entityId: id,
    });
  },

  async listSections({ tenantId, branchId }) {
    const branch = await branchesRepo.findById({ tenantId, id: branchId });
    if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    return branch.diningSections ?? [];
  },
};
