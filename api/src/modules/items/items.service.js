import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';

import { itemsRepo } from './items.repository.js';

/**
 * Items service — business rules. No HTTP concerns here.
 *
 * Caching:
 *  - List queries cache for 60s.
 *  - The cache namespace is `items` and we include tenantId in the key.
 *  - The route-level cache (cacheRoute middleware) shares this `items` prefix
 *    so one `bumpVersion('items')` call invalidates both layers in O(1).
 *  - Detail GETs are not cached (single-row lookup is cheap; tracking
 *    invalidation per item-id isn't worth the cache key explosion).
 */

const CACHE_PREFIX = 'items';

export const itemsService = {
  async list({ tenantId, page, pageSize, search, category, status, veg }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(veg !== undefined ? { veg } : {}),
    };

    const cacheKey = `service:items:${tenantId}:${page}:${pageSize}:${search ?? ''}:${category ?? ''}:${status ?? ''}:${veg ?? ''}`;

    return withCache({ key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX }, async () => {
      const [rows, total] = await itemsRepo.list({
        tenantId,
        where,
        take: pageSize,
        skip,
      });
      return { rows, total };
    });
  },

  async getById({ tenantId, id }) {
    const item = await itemsRepo.findById({ tenantId, id });
    if (!item) throw AppError.notFound('Item not found', 'ITEM_NOT_FOUND');
    return item;
  },

  async create({ tenantId, data }) {
    // Soft duplicate guard — same tenant + same name (case-insensitive) is
    // almost always an operator typo. Surface it as a 409 they can confirm
    // through with a `?force=true` flag (left for a future iteration).
    const existing = await itemsRepo.findByName({ tenantId, name: data.name });
    if (existing) {
      throw AppError.conflict(`An item named "${data.name}" already exists`, 'ITEM_DUPLICATE');
    }
    const item = await itemsRepo.create({ ...data, tenantId });
    await bumpVersion(CACHE_PREFIX);
    return item;
  },

  async update({ tenantId, id, data }) {
    const updated = await itemsRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('Item not found', 'ITEM_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    return updated;
  },

  async remove({ tenantId, id }) {
    const count = await itemsRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Item not found', 'ITEM_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
  },
};
