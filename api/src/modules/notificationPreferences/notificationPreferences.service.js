import { prisma } from '../../db/prisma.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

const CACHE_PREFIX = 'settings';

function serialize(p) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    branchId: p.branchId ?? null,
    userId: p.userId ?? null,
    event: p.event,
    channel: p.channel,
    enabled: p.enabled,
  };
}

export const notificationPreferencesService = {
  async list({ tenantId, branchId = null, userId = null }) {
    const cacheKey = `svc:notifprefs:${tenantId}:${branchId ?? 'T'}:${userId ?? 'T'}`;
    const rows = await withCache(
      { key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX },
      () => prisma.notificationPreference.findMany({
        where: { tenantId, branchId, userId },
        orderBy: [{ event: 'asc' }, { channel: 'asc' }],
      }),
    );
    return rows.map(serialize);
  },

  /** Set the whole matrix in one call (idempotent upserts). */
  async bulkSet({ tenantId, prefs, branchId = null, userId = null, actor }) {
    // Prisma rejects null inside a compound-unique where, so resolve each row
    // with a manual find-then-write keyed on (tenantId, branchId, userId, event, channel).
    const rows = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const p of prefs) {
        const rowBranch = p.branchId ?? branchId;
        const rowUser = p.userId ?? userId;
        const existing = await tx.notificationPreference.findFirst({
          where: { tenantId, branchId: rowBranch, userId: rowUser, event: p.event, channel: p.channel },
          select: { id: true },
        });
        if (existing) {
          out.push(await tx.notificationPreference.update({ where: { id: existing.id }, data: { enabled: p.enabled } }));
        } else {
          out.push(await tx.notificationPreference.create({
            data: { tenantId, branchId: rowBranch, userId: rowUser, event: p.event, channel: p.channel, enabled: p.enabled },
          }));
        }
      }
      return out;
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'NOTIFICATION_PREFS_CHANGED',
      entityType: 'NotificationPreference',
      entityId: tenantId,
      metadata: { count: rows.length },
    });
    return rows.map(serialize);
  },
};
