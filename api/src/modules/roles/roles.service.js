import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { authService } from '../auth/auth.service.js';

import { rolesRepo } from './roles.repository.js';

const CACHE_PREFIX = 'roles';

const PALETTE = [
  'from-brand-500 via-rose-500 to-warm-500',
  'from-violet-500 to-indigo-500',
  'from-blue-500 to-cool-500',
  'from-warm-500 to-amber-500',
  'from-rose-500 to-brand-500',
  'from-emerald-500 to-cool-500',
  'from-rose-400 to-rose-500',
  'from-cool-500 to-emerald-500',
];

function serialize(r) {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description ?? '',
    systemRole: r.systemRole,
    color: r.color,
    members: r._count?.users ?? r.members ?? 0,
    permissions: r.permissions ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const rolesService = {
  async list({ tenantId }) {
    const cacheKey = `svc:roles:${tenantId}`;
    const rows = await withCache(
      { key: cacheKey, ttlSec: 60, prefix: CACHE_PREFIX },
      () => rolesRepo.list({ tenantId }),
    );
    return rows.map(serialize);
  },

  async getById({ tenantId, id }) {
    const r = await rolesRepo.findById({ tenantId, id });
    if (!r) throw AppError.notFound('Role not found', 'ROLE_NOT_FOUND');
    return serialize(r);
  },

  async create({ tenantId, body, actor }) {
    const dup = await rolesRepo.findByName({ tenantId, name: body.name });
    if (dup) throw AppError.conflict(`Role "${body.name}" already exists`, 'ROLE_NAME_TAKEN');

    const existingCount = await rolesRepo.list({ tenantId });
    const color = body.color ?? PALETTE[existingCount.length % PALETTE.length];

    const role = await rolesRepo.create({
      tenantId,
      name: body.name,
      description: body.description ?? null,
      color,
      permissions: body.permissions ?? [],
      systemRole: false,
    });

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PERMISSION_CHANGED',
      entityType: 'Role',
      entityId: role.id,
      metadata: { name: role.name, created: true },
    });

    return serialize(role);
  },

  async update({ tenantId, id, body, actor }) {
    const cur = await rolesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Role not found', 'ROLE_NOT_FOUND');
    if (cur.systemRole) throw AppError.forbidden('System roles cannot be modified', 'SYSTEM_ROLE_LOCKED');

    if (body.name && body.name !== cur.name) {
      const dup = await rolesRepo.findByName({ tenantId, name: body.name });
      if (dup && dup.id !== id) throw AppError.conflict(`Role "${body.name}" already exists`, 'ROLE_NAME_TAKEN');
    }

    const data = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.color !== undefined) data.color = body.color;
    if (body.permissions !== undefined) data.permissions = body.permissions;

    const updated = await rolesRepo.update({ tenantId, id, data });
    await bumpVersion(CACHE_PREFIX);

    // Pitfall #1: a role edit must invalidate every JWT currently issued for
    // users in that role. Force-revoke their sessions so the new permission
    // set takes effect on the very next request (Phase 4 force-revoke path).
    if (data.permissions !== undefined) {
      const members = await prisma.user.findMany({
        where: { customRoleId: id, tenantId, deletedAt: null },
        select: { id: true },
      });
      await Promise.all(members.map((m) => authService.forceRevoke({ userId: m.id })));
    }

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PERMISSION_CHANGED',
      entityType: 'Role',
      entityId: id,
      metadata: Object.keys(data),
    });

    return serialize(updated);
  },

  async remove({ tenantId, id, actor }) {
    const cur = await rolesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Role not found', 'ROLE_NOT_FOUND');
    if (cur.systemRole) throw AppError.forbidden('System roles cannot be deleted', 'SYSTEM_ROLE_LOCKED');

    const count = await rolesRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Role not found', 'ROLE_NOT_FOUND');

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PERMISSION_CHANGED',
      entityType: 'Role',
      entityId: id,
      metadata: { deleted: true },
    });
  },
};
