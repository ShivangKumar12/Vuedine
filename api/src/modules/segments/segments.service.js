import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { buildCustomerWhere } from './audience.js';

const CACHE_PREFIX = 'segments';

// Built-in segments mirror the Phase E hardcoded ones + the frontend chips.
const SYSTEM_SEGMENTS = [
  { systemKey: 'all', name: 'All subscribers', rule: { kind: 'all' } },
  { systemKey: 'new', name: 'New customers', rule: { kind: 'new' } },
  { systemKey: 'loyal', name: 'Loyal diners', rule: { kind: 'loyal', minOrders: 30 } },
  { systemKey: 'lapsed', name: 'Lapsed', rule: { kind: 'lapsed', lapsedDays: 30 } },
  { systemKey: 'vip', name: 'VIP', rule: { kind: 'vip' } },
];

async function countFor({ tenantId, rule }) {
  const where = buildCustomerWhere({ tenantId, rule });
  return prisma.user.count({ where });
}

function serializeSaved(s) {
  return {
    id: s.id,
    name: s.name,
    rule: s.rule,
    systemKey: s.systemKey ?? null,
    system: false,
    createdAt: s.createdAt,
  };
}

export const segmentsService = {
  /** List built-in + saved segments, each with a live audience count. */
  async list({ tenantId }) {
    return withCache({ key: `svc:segments:${tenantId}`, ttlSec: 300, prefix: CACHE_PREFIX }, async () => {
      const saved = await prisma.segment.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      const systemWithCounts = await Promise.all(
        SYSTEM_SEGMENTS.map(async (s) => ({
          id: `sys:${s.systemKey}`,
          name: s.name,
          rule: s.rule,
          systemKey: s.systemKey,
          system: true,
          count: await countFor({ tenantId, rule: s.rule }),
        })),
      );

      const savedWithCounts = await Promise.all(
        saved.map(async (s) => ({ ...serializeSaved(s), count: await countFor({ tenantId, rule: s.rule }) })),
      );

      return [...systemWithCounts, ...savedWithCounts];
    });
  },

  async create({ tenantId, body, actor }) {
    const dup = await prisma.segment.findFirst({ where: { tenantId, name: body.name, deletedAt: null } });
    if (dup) throw AppError.conflict(`Segment "${body.name}" already exists`, 'SEGMENT_NAME_TAKEN');

    const seg = await prisma.segment.create({
      data: { tenantId, name: body.name, rule: body.rule },
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SEGMENT_CREATED',
      entityType: 'Segment',
      entityId: seg.id,
      metadata: { name: seg.name },
    });
    return { ...serializeSaved(seg), count: await countFor({ tenantId, rule: seg.rule }) };
  },

  async remove({ tenantId, id, actor }) {
    const res = await prisma.segment.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw AppError.notFound('Segment not found', 'SEGMENT_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'SEGMENT_DELETED',
      entityType: 'Segment',
      entityId: id,
    });
  },

  /** Resolve a segment reference (system key, saved id, or inline rule) to a rule object. */
  async resolveRule({ tenantId, audience, audienceQuery }) {
    if (audienceQuery && typeof audienceQuery === 'object' && audienceQuery.kind) {
      return audienceQuery;
    }
    if (typeof audience === 'string') {
      const sys = SYSTEM_SEGMENTS.find((s) => s.systemKey === audience || `sys:${s.systemKey}` === audience);
      if (sys) return sys.rule;
      if (audience === 'custom') return audienceQuery ?? { kind: 'all' };
      const saved = await prisma.segment.findFirst({ where: { id: audience, tenantId, deletedAt: null } });
      if (saved) return saved.rule;
    }
    return { kind: 'all' };
  },

  /** Count + sample subscribers for an ad-hoc rule (campaign editor). */
  async previewAudience({ tenantId, rule, requireConsent = false, channel = null }) {
    const where = buildCustomerWhere({ tenantId, rule, requireConsent, channel });
    const [count, sample] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, phone: true },
      }),
    ]);
    return { count, sample };
  },
};
