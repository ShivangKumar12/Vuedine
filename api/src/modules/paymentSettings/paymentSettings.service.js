import { prisma } from '../../db/prisma.js';
import { auditService } from '../audit/audit.service.js';

/**
 * Per-tenant payment settings — driven by Settings → Payments.
 *
 * Sensitive fields: razorpayKeySecret + webhookSecret. We mask them on
 * read (return only the last 4 chars + asterisks) so an XSS leak can't
 * exfiltrate the raw value. The frontend Input shows
 * `************************` which is what the original UI already does.
 */

const MASK = (raw) => {
  if (!raw) return null;
  if (raw.length <= 4) return '****';
  return '*'.repeat(Math.max(8, raw.length - 4)) + raw.slice(-4);
};

function serialize(s, { unmask = false } = {}) {
  if (!s) return null;
  return {
    cashEnabled: s.cashEnabled,
    cardEnabled: s.cardEnabled,
    upiEnabled: s.upiEnabled,
    walletEnabled: s.walletEnabled,
    onlineEnabled: s.onlineEnabled,
    loyaltyEnabled: s.loyaltyEnabled,
    payOnDeliveryEnabled: s.payOnDeliveryEnabled,
    gateway: s.gateway,
    razorpayKeyId: s.razorpayKeyId ?? null,
    razorpayKeySecret: unmask ? s.razorpayKeySecret : MASK(s.razorpayKeySecret),
    webhookSecret: unmask ? s.webhookSecret : MASK(s.webhookSecret),
    autoCapture: s.autoCapture,
    partialPayments: s.partialPayments,
    settlementSchedule: s.settlementSchedule,
    refundPolicy: s.refundPolicy,
    updatedAt: s.updatedAt,
  };
}

async function ensure(tenantId) {
  let s = await prisma.paymentSettings.findUnique({ where: { tenantId } });
  if (!s) {
    s = await prisma.paymentSettings.create({ data: { tenantId } });
  }
  return s;
}

export const paymentSettingsService = {
  async get({ tenantId }) {
    const s = await ensure(tenantId);
    return serialize(s);
  },

  async update({ tenantId, data, actor }) {
    const cur = await ensure(tenantId);
    // Whitelist update — only allow keys we know about.
    const updateData = {};
    const allowedBool = [
      'cashEnabled', 'cardEnabled', 'upiEnabled', 'walletEnabled',
      'onlineEnabled', 'loyaltyEnabled', 'payOnDeliveryEnabled',
      'autoCapture', 'partialPayments',
    ];
    for (const k of allowedBool) {
      if (data[k] !== undefined) updateData[k] = Boolean(data[k]);
    }
    for (const k of ['gateway', 'razorpayKeyId', 'settlementSchedule', 'refundPolicy']) {
      if (data[k] !== undefined) updateData[k] = data[k];
    }
    // Don't overwrite secrets if the client sent the masked value.
    if (data.razorpayKeySecret !== undefined && !/^\*+/.test(data.razorpayKeySecret ?? '')) {
      updateData.razorpayKeySecret = data.razorpayKeySecret;
    }
    if (data.webhookSecret !== undefined && !/^\*+/.test(data.webhookSecret ?? '')) {
      updateData.webhookSecret = data.webhookSecret;
    }

    const updated = await prisma.paymentSettings.update({
      where: { tenantId },
      data: updateData,
    });
    void cur;

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'PAYMENT_SETTINGS_UPDATED',
      entityType: 'PaymentSettings',
      entityId: tenantId,
      metadata: Object.keys(updateData),
    });

    return serialize(updated);
  },

  /** Internal: get with secrets unmasked — used by the webhook + gateway client. */
  async getInternal({ tenantId }) {
    const s = await ensure(tenantId);
    return serialize(s, { unmask: true });
  },
};
