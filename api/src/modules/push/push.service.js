import { prisma } from '../../db/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { getVapidPublicKey, isPushConfigured, sendWebPush } from '../../utils/webpush.js';
import { auditService } from '../audit/audit.service.js';

/**
 * Web Push subscriptions — register browser endpoints, test, and fan-out.
 */
export const pushService = {
  publicKey() {
    return { publicKey: getVapidPublicKey(), configured: isPushConfigured() };
  },

  async subscribe({ tenantId, userId, body, userAgent }) {
    const { endpoint, keys, platform = 'web', deviceId = null } = body;
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    let sub;
    if (existing) {
      sub = await prisma.pushSubscription.update({
        where: { endpoint },
        data: { userId, tenantId, keys, platform, deviceId, userAgent, lastSeenAt: new Date() },
      });
    } else {
      sub = await prisma.pushSubscription.create({
        data: { tenantId, userId, endpoint, keys, platform, deviceId, userAgent },
      });
    }
    await auditService.record({
      tenantId,
      userId,
      action: 'PUSH_SUBSCRIBED',
      entityType: 'PushSubscription',
      entityId: sub.id,
      metadata: { platform },
    });
    return { id: sub.id, platform: sub.platform, createdAt: sub.createdAt };
  },

  async unsubscribe({ tenantId, userId, id }) {
    const res = await prisma.pushSubscription.deleteMany({ where: { id, tenantId } });
    if (res.count === 0) throw AppError.notFound('Subscription not found', 'PUSH_SUB_NOT_FOUND');
    await auditService.record({
      tenantId,
      userId,
      action: 'PUSH_UNSUBSCRIBED',
      entityType: 'PushSubscription',
      entityId: id,
    });
  },

  async listForUser({ tenantId, userId }) {
    const rows = await prisma.pushSubscription.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, platform: r.platform, deviceId: r.deviceId, lastSeenAt: r.lastSeenAt }));
  },

  /** Send a test push to the caller's own devices. */
  async test({ tenantId, userId }) {
    const result = await this.sendToUser({
      tenantId,
      userId,
      payload: {
        title: 'Vuedine test push 🔔',
        body: 'If you can read this, web push is working.',
        url: '/dashboard',
      },
    });
    if (!isPushConfigured()) {
      return { ...result, note: 'VAPID keys not configured — push skipped in this environment.' };
    }
    if (result.targets === 0) {
      throw AppError.badRequest('No push subscriptions registered for your account', 'NO_PUSH_SUBS');
    }
    return result;
  },

  /**
   * Deliver a payload to every subscription of a user. Prunes dead endpoints.
   * @returns {{ targets, delivered, removed, skipped }}
   */
  async sendToUser({ tenantId, userId, payload }) {
    const subs = await prisma.pushSubscription.findMany({ where: { tenantId, userId } });
    let delivered = 0;
    let removed = 0;
    let skipped = 0;
    for (const sub of subs) {
      // eslint-disable-next-line no-await-in-loop
      const res = await sendWebPush({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      if (res.ok) delivered += 1;
      else if (res.gone) {
        // eslint-disable-next-line no-await-in-loop
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        removed += 1;
      } else if (res.skipped) skipped += 1;
    }
    return { targets: subs.length, delivered, removed, skipped };
  },
};
