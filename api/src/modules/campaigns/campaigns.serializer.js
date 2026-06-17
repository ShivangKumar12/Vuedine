/**
 * Campaign serializer — maps a NotificationCampaign row to the shape
 * PushNotifications.tsx expects (label-friendly status/audience).
 */

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

const SYSTEM_AUDIENCE_LABEL = {
  all: 'All subscribers',
  new: 'New customers',
  loyal: 'Loyal diners',
  lapsed: 'Lapsed',
  vip: 'VIP',
};

function audienceLabel(audience) {
  if (!audience) return 'All subscribers';
  const key = audience.startsWith('sys:') ? audience.slice(4) : audience;
  if (SYSTEM_AUDIENCE_LABEL[key]) return SYSTEM_AUDIENCE_LABEL[key];
  if (audience === 'custom') return 'Custom segment';
  return 'Custom segment';
}

export function serializeCampaign(c) {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    body: c.body,
    imageUrl: c.imageUrl ?? null,
    imageEmoji: c.imageEmoji ?? null,
    ctaLabel: c.ctaLabel ?? '',
    ctaUrl: c.ctaUrl ?? '',
    audience: audienceLabel(c.audience),
    audienceKey: c.audience,
    audienceQuery: c.audienceQuery ?? null,
    audienceSize: c.audienceSize ?? 0,
    status: STATUS_LABEL[c.status] ?? c.status,
    statusCode: c.status,
    scheduledFor: c.scheduledFor?.toISOString?.() ?? null,
    sentAt: c.sentAt?.toISOString?.() ?? null,
    delivered: c.delivered ?? 0,
    opened: c.opened ?? 0,
    clicked: c.clicked ?? 0,
    failed: c.failed ?? 0,
    unsubscribed: c.unsubscribed ?? 0,
    createdById: c.createdById,
    createdAt: c.createdAt?.toISOString?.() ?? null,
    updatedAt: c.updatedAt?.toISOString?.() ?? null,
  };
}
