import { randomUUID } from 'node:crypto';

import { SessionStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

/**
 * Auth-specific Prisma queries. Services should never touch Prisma directly —
 * keeping repository code here means we can mock it in tests and swap to
 * a different store later (e.g. extract to a microservice) without touching
 * the service layer.
 */
export const authRepo = {
  /**
   * Find a user by email, optionally scoped to a tenant slug.
   * Includes the tenant relation so the service can short-circuit on
   * disabled tenants without an extra round trip.
   */
  findUserByEmail({ tenantSlug, email }) {
    return prisma.user.findFirst({
      where: {
        email,
        ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
      },
      include: { tenant: true },
    });
  },

  findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  createSession({ userId, tenantId, refreshHash, expiresAt, ip, userAgent, family }) {
    return prisma.session.create({
      data: {
        userId,
        tenantId,
        refreshTokenHash: refreshHash,
        family: family ?? randomUUID(),
        expiresAt,
        ip,
        userAgent,
      },
    });
  },

  findSessionByHash(refreshHash) {
    return prisma.session.findUnique({
      where: { refreshTokenHash: refreshHash },
      include: { user: true },
    });
  },

  /**
   * Atomically: create the new (rotated) session and mark the old one as
   * rotated/revoked. The transaction guarantees we can't end up with two
   * active sessions for the same family.
   */
  rotateSession({ oldId, newSessionData }) {
    return prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({ data: newSessionData });
      await tx.session.update({
        where: { id: oldId },
        data: {
          rotatedToId: newSession.id,
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
      return newSession;
    });
  },

  /** Revoke every session in a family. Used on reuse detection + password reset. */
  revokeFamily(family) {
    return prisma.session.updateMany({
      where: { family, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  },

  revokeFamilyForUser(userId) {
    return prisma.session.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  },

  revokeSession(id) {
    return prisma.session.update({
      where: { id },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  },

  /* ----- Brute-force protection ----- */

  bumpFailedLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
  },

  lockUser(userId, until) {
    return prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: until, failedLoginCount: 0 },
    });
  },

  resetFailedLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  },

  /* ----- Password reset ----- */

  setPassword(userId, passwordHash) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },
};
