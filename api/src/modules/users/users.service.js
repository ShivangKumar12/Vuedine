import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcrypt';

import { env } from '../../config/index.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { emitToTenant } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { authService } from '../auth/auth.service.js';
import { emailService } from '../email/email.service.js';

import { usersRepo } from './users.repository.js';
import { serializeUser, serializeSubscriber } from './users.serializer.js';

const CACHE_PREFIX = 'users';
const INVITE_TTL_HOURS = 72; // 3 days

const PIN_BCRYPT_COST = 4; // 4-digit PIN — small key space, always lock after 5 misses
const PIN_MAX_ATTEMPTS = 5; // pitfall #2: lock after 5 wrong PINs
const PIN_LOCK_TTL_SEC = 15 * 60; // lockout window for the attempt counter

function mintToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/* ============================================================ */
/*  Staff CRUD                                                  */
/* ============================================================ */

export const usersService = {
  async list({ tenantId, query }) {
    const {
      page = 1,
      pageSize = 100,
      group,
      role,
      status,
      branchId,
      search,
    } = query;
    const skip = (page - 1) * pageSize;
    const where = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(group === 'Staff' ? { NOT: { role: 'CUSTOMER' } } : {}),
      ...(group === 'Customers' ? { role: 'CUSTOMER' } : {}),
      ...(branchId ? { branchIds: { has: branchId } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const cacheKey = `svc:users:${tenantId}:${page}:${pageSize}:${JSON.stringify(where)}`;
    const { rows, total } = await withCache(
      { key: cacheKey, ttlSec: 10, prefix: CACHE_PREFIX },
      async () => {
        const [r, t] = await usersRepo.list({ tenantId, where, take: pageSize, skip });
        return { rows: r, total: t };
      },
    );
    return { rows: rows.map(serializeUser), total };
  },

  async getById({ tenantId, id }) {
    const u = await usersRepo.findById({ tenantId, id });
    if (!u) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    return serializeUser(u);
  },

  /* -------- Invite flow -------- */
  async invite({ tenantId, body, actor, origin = 'https://app.vuedine.com' }) {
    const dup = await usersRepo.findByEmail({ tenantId, email: body.email });
    if (dup) throw AppError.conflict(`${body.email} is already a member`, 'USER_ALREADY_EXISTS');

    const raw = mintToken();
    const hashed = hashToken(raw);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000);

    const user = await usersRepo.create({
      tenantId,
      email: body.email,
      name: body.name,
      passwordHash: '',
      role: body.role,
      status: 'INVITED',
      branchIds: body.branchIds ?? [],
      inviteToken: hashed,
      inviteExpiresAt: expiresAt,
      invitedAt: new Date(),
      invitedBy: actor?.id ?? null,
      salary: body.salary ?? null,
    });

    const inviteUrl = `${origin}/invite/${raw}`;
    try {
      await emailService.send({
        to: body.email,
        subject: "You've been invited to Vuedine",
        template: 'invite',
        data: {
          name: body.name,
          inviterName: actor?.name ?? 'Your admin',
          inviteUrl,
          expiresIn: `${INVITE_TTL_HOURS} hours`,
        },
      });
    } catch (err) {
      // Email failure must not roll back the invite row.
      // eslint-disable-next-line no-console
      console.warn('[users.invite] email failed:', err?.message);
    }

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_INVITED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: body.email, role: body.role, inviteUrl },
    });

    return { ...serializeUser(user), inviteUrl };
  },

  async resolveInvite({ token }) {
    const hashed = hashToken(token);
    const user = await usersRepo.findByInviteToken({ token: hashed });
    if (!user) throw AppError.notFound('Invite link not found', 'INVITE_NOT_FOUND');
    if (new Date() > new Date(user.inviteExpiresAt)) {
      throw AppError.badRequest('Invite link has expired', 'INVITE_EXPIRED');
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };
  },

  async acceptInvite({ token, body }) {
    const hashed = hashToken(token);
    const user = await usersRepo.findByInviteToken({ token: hashed });
    if (!user) throw AppError.notFound('Invite link not found', 'INVITE_NOT_FOUND');
    if (new Date() > new Date(user.inviteExpiresAt)) {
      throw AppError.badRequest('Invite link has expired', 'INVITE_EXPIRED');
    }
    if (user.status !== 'INVITED') {
      throw AppError.badRequest('Invite already accepted', 'INVITE_ALREADY_ACCEPTED');
    }

    const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_COST);
    const updated = await usersRepo.update({
      tenantId: user.tenantId,
      id: user.id,
      data: {
        passwordHash,
        name: body.name ?? user.name,
        phone: body.phone ?? null,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiresAt: null,
        emailVerifiedAt: new Date(),
      },
    });

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'USER_INVITE_ACCEPTED',
      entityType: 'User',
      entityId: user.id,
    });

    emitToTenant(user.tenantId, 'user:online', { userId: user.id });
    return serializeUser(updated);
  },

  /* -------- Update -------- */
  async update({ tenantId, id, body, actor }) {
    const updated = await usersRepo.update({ tenantId, id, data: body });
    if (!updated) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: Object.keys(body),
    });
    return serializeUser(updated);
  },

  /* -------- Suspend / restore -------- */
  async suspend({ tenantId, id, actor }) {
    const cur = await usersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    if (cur.role === 'OWNER') throw AppError.badRequest('Owner cannot be suspended', 'CANNOT_SUSPEND_OWNER');
    const updated = await usersRepo.update({ tenantId, id, data: { status: 'SUSPENDED' } });
    await authService.forceRevoke({ userId: id });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: id,
    });
    emitToTenant(tenantId, 'user:offline', { userId: id });
    return serializeUser(updated);
  },

  async restore({ tenantId, id, actor }) {
    const updated = await usersRepo.update({ tenantId, id, data: { status: 'ACTIVE' } });
    if (!updated) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_RESTORED',
      entityType: 'User',
      entityId: id,
    });
    return serializeUser(updated);
  },

  /* -------- Delete -------- */
  async remove({ tenantId, id, actor }) {
    const cur = await usersRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    if (cur.role === 'OWNER') throw AppError.badRequest('Owner cannot be deleted', 'CANNOT_DELETE_OWNER');
    await usersRepo.softDelete({ tenantId, id });
    await authService.forceRevoke({ userId: id });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
    });
  },

  /* -------- Assign role -------- */
  async assignRole({ tenantId, id, body, actor }) {
    const data = {};
    if (body.role) data.role = body.role;
    if (body.roleId !== undefined) data.customRoleId = body.roleId;
    const updated = await usersRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    // Force token refresh so the new role takes effect immediately.
    await authService.forceRevoke({ userId: id });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_ROLE_ASSIGNED',
      entityType: 'User',
      entityId: id,
      metadata: body,
    });
    return serializeUser(updated);
  },

  /* -------- PIN management -------- */
  async resetPin({ tenantId, id, pin, actor }) {
    const pinHash = await bcrypt.hash(pin, PIN_BCRYPT_COST);
    const updated = await usersRepo.update({ tenantId, id, data: { pinHash } });
    if (!updated) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_PIN_RESET',
      entityType: 'User',
      entityId: id,
    });
    return serializeUser(updated);
  },

  /* -------- PIN verify (POS quick re-auth) -------- */
  async verifyPin({ tenantId, id, pin, actor }) {
    const u = await usersRepo.findById({ tenantId, id });
    if (!u) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    if (!u.pinHash) throw AppError.badRequest('No PIN set for this user', 'PIN_NOT_SET');

    const attemptsKey = `pin:attempts:${id}`;
    const attempts = Number((await redis.get(attemptsKey)) ?? 0);

    // Pitfall #2: a 4-digit PIN is a 10k space — lock after 5 wrong tries.
    if (attempts >= PIN_MAX_ATTEMPTS) {
      throw AppError.forbidden('PIN locked after too many failed attempts', 'PIN_LOCKED');
    }

    const valid = await bcrypt.compare(pin, u.pinHash);
    if (!valid) {
      const next = await redis.incr(attemptsKey);
      if (next === 1) await redis.expire(attemptsKey, PIN_LOCK_TTL_SEC);
      if (next >= PIN_MAX_ATTEMPTS) {
        await auditService.record({
          tenantId,
          userId: actor?.id,
          action: 'USER_PIN_LOCKED',
          entityType: 'User',
          entityId: id,
          metadata: { attempts: next },
        });
        throw AppError.forbidden('PIN locked after too many failed attempts', 'PIN_LOCKED');
      }
      throw AppError.unauthorized('Incorrect PIN', 'PIN_INVALID');
    }

    // Success — clear the counter and stamp presence.
    await redis.del(attemptsKey);
    await usersRepo.update({ tenantId, id, data: { lastActiveAt: new Date() } }).catch(() => {});
    await auditService.record({
      tenantId,
      userId: actor?.id ?? id,
      action: 'USER_PIN_VERIFIED',
      entityType: 'User',
      entityId: id,
    });
    emitToTenant(tenantId, 'user:online', { userId: id });
    return { verified: true, userId: id };
  },

  /* -------- Audit trail -------- */
  async getActivity({ tenantId, id, take }) {
    const u = await usersRepo.findById({ tenantId, id });
    if (!u) throw AppError.notFound('User not found', 'USER_NOT_FOUND');
    return usersRepo.auditLog({ userId: id, take });
  },

  /* ============================================================
   *  Customer surface
   * ============================================================ */

  async listCustomers({ tenantId, query }) {
    const { page = 1, pageSize = 50, segment, tier, search } = query;
    const skip = (page - 1) * pageSize;

    const cpWhere = {
      tenantId,
      ...(tier ? { tier } : {}),
      ...(segment === 'vip'
        ? { OR: [{ tags: { has: 'VIP' } }, { tier: 'PLATINUM' }] }
        : {}),
      ...(segment === 'loyal'
        ? { totalOrders: { gte: 30 } }
        : {}),
      ...(segment === 'lapsed'
        ? { lastOrderAt: { lt: new Date(Date.now() - 30 * 86400_000) } }
        : {}),
      ...(segment === 'new'
        ? { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }
        : {}),
    };

    const where = {
      role: 'CUSTOMER',
      deletedAt: null,
      ...(tenantId ? { tenantId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      customerProfile: Object.keys(cpWhere).length > 1 ? { is: cpWhere } : undefined,
    };

    const [rows, total] = await usersRepo.list({ tenantId, where, take: pageSize, skip });
    return { rows: rows.map(serializeSubscriber), total };
  },

  async getCustomerById({ tenantId, id }) {
    const u = await usersRepo.findById({ tenantId, id });
    if (!u || u.role !== 'CUSTOMER') {
      throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const base = serializeSubscriber(u);

    // API spec: "profile + last 20 orders + LTV". Orders are linked to a
    // customer by guestPhone (no FK). Compute LTV/order-count live so the
    // profile reflects reality even between nightly tier-recompute runs.
    const phone = u.phone && u.phone !== '—' ? u.phone : null;
    let orders = [];
    let ltv = 0;
    let orderCount = 0;

    if (phone) {
      const where = { tenantId, guestPhone: phone, deletedAt: null };
      const [recent, agg] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            serial: true,
            type: true,
            channel: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            createdAt: true,
          },
        }),
        prisma.order.aggregate({
          where,
          _sum: { grandTotal: true },
          _count: { _all: true },
        }),
      ]);
      orders = recent.map((o) => ({
        id: o.id,
        serial: o.serial,
        type: o.type,
        channel: o.channel,
        status: o.status,
        paymentStatus: o.paymentStatus,
        grandTotal: Number(o.grandTotal),
        createdAt: o.createdAt?.toISOString?.() ?? null,
      }));
      ltv = Number(agg._sum.grandTotal ?? 0);
      orderCount = agg._count._all ?? 0;
    }

    return { ...base, orders, ltv, orderCount };
  },

  async updateCustomerTags({ tenantId, id, tags, actor }) {
    await ensureCustomerProfile({ tenantId, userId: id });
    await prisma.customerProfile.update({
      where: { userId: id },
      data: { tags },
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CUSTOMER_TAGGED',
      entityType: 'CustomerProfile',
      entityId: id,
      metadata: { tags },
    });
    return this.getCustomerById({ tenantId, id });
  },

  async updateCustomerPreferences({ tenantId, id, body, actor }) {
    await ensureCustomerProfile({ tenantId, userId: id });
    const data = {};
    if (body.channels !== undefined) data.channels = body.channels;
    if (body.marketingConsent !== undefined) data.marketingConsent = body.marketingConsent;
    if (body.birthday !== undefined) data.birthday = body.birthday ? new Date(body.birthday) : null;
    if (body.city !== undefined) data.city = body.city;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.marketingConsent === false) data.unsubscribedAt = new Date();
    else if (body.marketingConsent === true) data.unsubscribedAt = null;

    await prisma.customerProfile.update({ where: { userId: id }, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CUSTOMER_PREFERENCES_UPDATED',
      entityType: 'CustomerProfile',
      entityId: id,
      metadata: Object.keys(data),
    });
    return this.getCustomerById({ tenantId, id });
  },

  async anonymize({ tenantId, id, actor }) {
    const u = await usersRepo.findById({ tenantId, id });
    if (!u) throw AppError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

    const anon = `anon-${randomBytes(8).toString('hex')}`;
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: `Anonymized user`,
          email: `${anon}@anon.vuedine.internal`,
          phone: null,
          avatarUrl: null,
          passwordHash: '',
          deletedAt: new Date(),
          status: 'DELETED',
        },
      }),
      prisma.customerProfile.upsert({
        where: { userId: id },
        create: { userId: id, tenantId, anonymizedAt: new Date() },
        update: {
          city: null,
          birthday: null,
          notes: null,
          anonymizedAt: new Date(),
        },
      }),
    ]);

    await authService.forceRevoke({ userId: id });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CUSTOMER_ANONYMIZED',
      entityType: 'User',
      entityId: id,
    });
  },

  /* -------- Subscriber CRUD (Subscribers.tsx) -------- */
  async createSubscriber({ tenantId, body, actor }) {
    const dup = await usersRepo.findByEmail({ tenantId, email: body.email });
    if (dup) {
      // If already a customer, just update preferences.
      if (dup.role === 'CUSTOMER') {
        return this.updateSubscriberProfile({ tenantId, id: dup.id, body, actor });
      }
      throw AppError.conflict(`${body.email} is already a member`, 'USER_ALREADY_EXISTS');
    }

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId,
          email: body.email,
          name: body.name,
          passwordHash: '',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          phone: body.phone ?? null,
          emailVerifiedAt: new Date(),
          branchIds: [],
        },
      });
      await tx.customerProfile.create({
        data: {
          userId: u.id,
          tenantId,
          city: body.city ?? null,
          channels: body.channels ?? ['Email'],
          tags: body.tags ?? [],
          marketingConsent: body.marketingConsent ?? true,
          birthday: body.birthday ? new Date(body.birthday) : null,
          notes: body.notes ?? null,
        },
      });
      return u;
    });

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: 'CUSTOMER', email: body.email },
    });

    return this.getCustomerById({ tenantId, id: user.id });
  },

  async updateSubscriberProfile({ tenantId, id, body, actor }) {
    await ensureCustomerProfile({ tenantId, userId: id });

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: body.name,
          phone: body.phone ?? null,
        },
      }),
      prisma.customerProfile.update({
        where: { userId: id },
        data: {
          city: body.city ?? null,
          channels: body.channels ?? undefined,
          tags: body.tags ?? undefined,
          marketingConsent: body.marketingConsent ?? undefined,
          birthday: body.birthday ? new Date(body.birthday) : undefined,
          notes: body.notes ?? undefined,
        },
      }),
    ]);

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: Object.keys(body),
    });

    return this.getCustomerById({ tenantId, id });
  },

  async deleteSubscriber({ tenantId, id, actor }) {
    await usersRepo.softDelete({ tenantId, id });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'USER_DELETED',
      entityType: 'User',
      entityId: id,
    });
  },

  /* -------- Presence -------- */
  async touchActive({ tenantId, id }) {
    await usersRepo.update({ tenantId, id, data: { lastActiveAt: new Date() } }).catch(() => {});
    emitToTenant(tenantId, 'user:online', { userId: id });
  },

  /* -------- CSV import (Phase H) -------- */
  async importCustomers({ tenantId, rows, actor }) {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] ?? {};
      const email = String(r.email ?? r.Email ?? '').trim().toLowerCase();
      const name = String(r.name ?? r.Name ?? '').trim() || (email ? email.split('@')[0] : '');
      const phone = String(r.phone ?? r.Phone ?? '').trim() || null;
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        skipped += 1;
        errors.push({ row: i + 1, reason: 'invalid or missing email' });
        continue;
      }
      const channels = String(r.channels ?? r.Channels ?? 'Email')
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
      const tags = String(r.tags ?? r.Tags ?? '')
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean);
      const consent = ['true', '1', 'yes', 'y'].includes(String(r.marketingConsent ?? r.consent ?? 'true').toLowerCase());

      // eslint-disable-next-line no-await-in-loop
      const dup = await usersRepo.findByEmail({ tenantId, email });
      if (dup) {
        if (dup.role === 'CUSTOMER') {
          // eslint-disable-next-line no-await-in-loop
          await ensureCustomerProfile({ tenantId, userId: dup.id });
          // eslint-disable-next-line no-await-in-loop
          await prisma.customerProfile.update({
            where: { userId: dup.id },
            data: { channels: channels.length ? channels : undefined, marketingConsent: consent },
          });
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            tenantId, email, name, passwordHash: '', role: 'CUSTOMER',
            status: 'ACTIVE', phone, emailVerifiedAt: new Date(), branchIds: [],
          },
        });
        await tx.customerProfile.create({
          data: {
            userId: u.id, tenantId,
            channels: channels.length ? channels : ['Email'],
            tags,
            marketingConsent: consent,
            city: String(r.city ?? r.City ?? '').trim() || null,
          },
        });
      });
      created += 1;
    }

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CUSTOMER_IMPORTED',
      entityType: 'User',
      entityId: tenantId,
      metadata: { created, updated, skipped },
    });
    return { created, updated, skipped, errors: errors.slice(0, 50) };
  },

  /* -------- Bulk customer actions (Phase H) -------- */
  async bulkUpdateCustomers({ tenantId, ids, action, tags, channels, actor }) {
    if (!ids?.length) throw AppError.badRequest('No customers selected', 'NO_IDS');
    // Tenant-scope: only act on this tenant's customers.
    const profiles = await prisma.user.findMany({
      where: { id: { in: ids }, tenantId, role: 'CUSTOMER', deletedAt: null },
      select: { id: true },
    });
    const validIds = profiles.map((p) => p.id);
    let affected = 0;

    if (action === 'unsubscribe') {
      const res = await prisma.customerProfile.updateMany({
        where: { userId: { in: validIds } },
        data: { marketingConsent: false, unsubscribedAt: new Date() },
      });
      affected = res.count;
    } else if (action === 'subscribe') {
      const res = await prisma.customerProfile.updateMany({
        where: { userId: { in: validIds } },
        data: { marketingConsent: true, unsubscribedAt: null },
      });
      affected = res.count;
    } else if (action === 'channels' && Array.isArray(channels)) {
      const res = await prisma.customerProfile.updateMany({
        where: { userId: { in: validIds } },
        data: { channels },
      });
      affected = res.count;
    } else if (action === 'tag' && Array.isArray(tags)) {
      // Add tags (merge) per profile.
      for (const userId of validIds) {
        // eslint-disable-next-line no-await-in-loop
        const cp = await prisma.customerProfile.findUnique({ where: { userId }, select: { tags: true } });
        const merged = Array.from(new Set([...(cp?.tags ?? []), ...tags]));
        // eslint-disable-next-line no-await-in-loop
        await prisma.customerProfile.update({ where: { userId }, data: { tags: merged } });
        affected += 1;
      }
    } else if (action === 'delete') {
      for (const id of validIds) {
        // eslint-disable-next-line no-await-in-loop
        await usersRepo.softDelete({ tenantId, id });
        affected += 1;
      }
    } else {
      throw AppError.badRequest('Unknown bulk action', 'BAD_BULK_ACTION');
    }

    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CUSTOMER_BULK_UPDATED',
      entityType: 'User',
      entityId: tenantId,
      metadata: { action, affected },
    });
    return { affected };
  },
};

/* -------- Helpers -------- */
async function ensureCustomerProfile({ tenantId, userId }) {
  const exists = await prisma.customerProfile.findUnique({ where: { userId } });
  if (!exists) {
    await prisma.customerProfile.create({
      data: { userId, tenantId },
    });
  }
}
