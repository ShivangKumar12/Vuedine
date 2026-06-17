import { prisma } from '../../db/prisma.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { enqueueCampaignDispatch } from '../../queues/messaging.queue.js';
import { enqueueNotification } from '../../queues/notification.queue.js';
import { emitToTenant } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { buildCustomerWhere, channelForCampaignType } from '../segments/audience.js';
import { segmentsService } from '../segments/segments.service.js';

import { campaignsRepo } from './campaigns.repository.js';
import { serializeCampaign } from './campaigns.serializer.js';

const CACHE_PREFIX = 'campaigns';
const MAX_RECIPIENTS = 5000;

function assertWhatsappTemplate(campaign) {
  // Pitfall #1: outside the 24h care window only approved templates can send.
  // We validate at the API before queueing — a WHATSAPP campaign must carry a
  // template name in audienceQuery.whatsappTemplate.
  if (campaign.type === 'WHATSAPP' && !campaign.audienceQuery?.whatsappTemplate) {
    throw AppError.badRequest(
      'WhatsApp campaigns require an approved template name (audienceQuery.whatsappTemplate)',
      'WHATSAPP_TEMPLATE_REQUIRED',
    );
  }
}

export const campaignsService = {
  async list({ tenantId, query }) {
    const { status, type } = query;
    const where = { ...(status ? { status } : {}), ...(type ? { type } : {}) };
    const cacheKey = `svc:campaigns:${tenantId}:${status ?? 'all'}:${type ?? 'all'}`;
    const { rows, total } = await withCache(
      { key: cacheKey, ttlSec: 15, prefix: CACHE_PREFIX },
      async () => {
        const [list, count] = await campaignsRepo.list({ tenantId, where });
        return { rows: list, total: count };
      },
    );
    return { rows: rows.map(serializeCampaign), total };
  },

  async getById({ tenantId, id }) {
    const c = await campaignsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    return serializeCampaign(c);
  },

  async create({ tenantId, body, actor }) {
    const rule = await segmentsService.resolveRule({
      tenantId,
      audience: body.audience,
      audienceQuery: body.audienceQuery,
    });
    const channel = channelForCampaignType(body.type);
    const where = buildCustomerWhere({ tenantId, rule, requireConsent: true, channel });
    const audienceSize = await prisma.user.count({ where });

    const c = await campaignsRepo.create({
      tenantId,
      type: body.type,
      title: body.title,
      body: body.body,
      imageUrl: body.imageUrl ?? null,
      imageEmoji: body.imageEmoji ?? null,
      ctaLabel: body.ctaLabel ?? null,
      ctaUrl: body.ctaUrl ?? null,
      audience: body.audience ?? 'all',
      audienceQuery: body.audienceQuery ?? null,
      audienceSize,
      status: 'DRAFT',
      createdById: actor?.id ?? 'system',
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_CREATED',
      entityType: 'NotificationCampaign',
      entityId: c.id,
      metadata: { type: c.type, title: c.title },
    });
    return serializeCampaign(c);
  },

  async update({ tenantId, id, body, actor }) {
    const cur = await campaignsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    if (cur.status === 'SENT' || cur.status === 'SENDING') {
      throw AppError.badRequest('A sent or sending campaign cannot be edited', 'CAMPAIGN_LOCKED');
    }
    const data = {};
    for (const k of ['type', 'title', 'body', 'imageUrl', 'imageEmoji', 'ctaLabel', 'ctaUrl', 'audience', 'audienceQuery']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    // Recompute audience size if audience changed.
    if (data.audience !== undefined || data.audienceQuery !== undefined || data.type !== undefined) {
      const rule = await segmentsService.resolveRule({
        tenantId,
        audience: data.audience ?? cur.audience,
        audienceQuery: data.audienceQuery ?? cur.audienceQuery,
      });
      const channel = channelForCampaignType(data.type ?? cur.type);
      data.audienceSize = await prisma.user.count({
        where: buildCustomerWhere({ tenantId, rule, requireConsent: true, channel }),
      });
    }
    const updated = await campaignsRepo.update({ tenantId, id, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_UPDATED',
      entityType: 'NotificationCampaign',
      entityId: id,
      metadata: Object.keys(data),
    });
    return serializeCampaign(updated);
  },

  async remove({ tenantId, id, actor }) {
    const count = await campaignsRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_DELETED',
      entityType: 'NotificationCampaign',
      entityId: id,
    });
  },

  async previewAudience({ tenantId, body }) {
    const rule = body.rule ?? (await segmentsService.resolveRule({
      tenantId,
      audience: body.audience,
      audienceQuery: body.audienceQuery,
    }));
    const channel = body.type ? channelForCampaignType(body.type) : null;
    return segmentsService.previewAudience({ tenantId, rule, requireConsent: true, channel });
  },

  async sendNow({ tenantId, id, actor }) {
    const cur = await campaignsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    if (cur.status === 'SENT' || cur.status === 'SENDING') {
      throw AppError.badRequest('Campaign is already sent or sending', 'CAMPAIGN_ALREADY_SENT');
    }
    assertWhatsappTemplate(cur);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_SENT',
      entityType: 'NotificationCampaign',
      entityId: id,
    });
    return this.dispatch({ campaignId: id });
  },

  async schedule({ tenantId, id, at, actor }) {
    const cur = await campaignsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    if (cur.status === 'SENT' || cur.status === 'SENDING') {
      throw AppError.badRequest('Campaign is already sent or sending', 'CAMPAIGN_ALREADY_SENT');
    }
    assertWhatsappTemplate(cur);
    const when = new Date(at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      throw AppError.badRequest('Schedule time must be in the future', 'BAD_SCHEDULE_TIME');
    }
    const updated = await campaignsRepo.update({
      tenantId,
      id,
      data: { status: 'SCHEDULED', scheduledFor: when },
    });
    await bumpVersion(CACHE_PREFIX);
    try {
      await enqueueCampaignDispatch({ campaignId: id, tenantId }, { delayMs: Math.max(0, when.getTime() - Date.now()) });
    } catch {
      /* queue offline — segment-eval/manual send-now still works */
    }
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_SCHEDULED',
      entityType: 'NotificationCampaign',
      entityId: id,
      metadata: { at: when.toISOString() },
    });
    return serializeCampaign(updated);
  },

  async cancel({ tenantId, id, actor }) {
    const cur = await campaignsRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    if (cur.status === 'SENT') {
      throw AppError.badRequest('A sent campaign cannot be cancelled', 'CAMPAIGN_ALREADY_SENT');
    }
    const updated = await campaignsRepo.update({ tenantId, id, data: { status: 'CANCELLED' } });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CAMPAIGN_CANCELLED',
      entityType: 'NotificationCampaign',
      entityId: id,
    });
    return serializeCampaign(updated);
  },

  async listEvents({ tenantId, id, query }) {
    const c = await campaignsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [rows, total] = await campaignsRepo.listEvents({
      campaignId: id,
      type: query.type,
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return { rows, total };
  },

  /**
   * Core fan-out. Resolves the audience (consent-filtered), records a SENT
   * event per recipient, enqueues the real per-channel delivery, updates the
   * denorm counters, marks the campaign SENT, and emits `campaign:status`.
   * Idempotent-ish: bails if the campaign is already SENT/CANCELLED.
   */
  async dispatch({ campaignId }) {
    const campaign = await prisma.notificationCampaign.findFirst({
      where: { id: campaignId, deletedAt: null },
    });
    if (!campaign) return { skipped: true, reason: 'NOT_FOUND' };
    if (campaign.status === 'CANCELLED' || campaign.status === 'SENT') {
      return { skipped: true, reason: campaign.status };
    }

    await campaignsRepo.updateById({ id: campaignId, data: { status: 'SENDING' } });

    const rule = await segmentsService.resolveRule({
      tenantId: campaign.tenantId,
      audience: campaign.audience,
      audienceQuery: campaign.audienceQuery,
    });
    const channelLabel = channelForCampaignType(campaign.type); // 'Push'|'Email'|...
    const channelKey = (channelLabel ?? 'push').toLowerCase();
    const where = buildCustomerWhere({
      tenantId: campaign.tenantId,
      rule,
      requireConsent: true, // pitfall #4 — never send without marketingConsent
      channel: channelLabel,
    });

    const recipients = await prisma.user.findMany({
      where,
      take: MAX_RECIPIENTS,
      select: { id: true, email: true, phone: true },
    });

    // Record a SENT event per recipient.
    if (recipients.length > 0) {
      await campaignsRepo.createEventsMany(
        recipients.map((r) => ({ campaignId, customerId: r.id, type: 'SENT', channel: channelKey })),
      );
    }

    // Enqueue the real per-recipient delivery (best-effort; downstream workers
    // dispatch to push/email/messaging providers).
    let delivered = 0;
    for (const r of recipients) {
      try {
        if (campaign.type === 'PUSH') {
          // eslint-disable-next-line no-await-in-loop
          await enqueueNotification({ channel: 'push', tenantId: campaign.tenantId, userId: r.id, title: campaign.title, body: campaign.body, data: { url: campaign.ctaUrl } });
        } else if (campaign.type === 'EMAIL' && r.email) {
          // eslint-disable-next-line no-await-in-loop
          await enqueueEmail({ to: r.email, subject: campaign.title, template: 'welcome', data: { name: campaign.title } });
        } else if (campaign.type === 'SMS' || campaign.type === 'WHATSAPP') {
          // eslint-disable-next-line no-await-in-loop
          await enqueueNotification({ channel: channelKey, userId: r.id, title: campaign.title, body: campaign.body });
        }
        delivered += 1;
      } catch {
        /* queue offline — still counted as sent; delivery retried by ops */
      }
    }

    const finalCampaign = await campaignsRepo.updateById({
      id: campaignId,
      data: {
        status: 'SENT',
        sentAt: new Date(),
        audienceSize: recipients.length,
        delivered,
      },
    });
    await bumpVersion(CACHE_PREFIX);

    emitToTenant(campaign.tenantId, 'campaign:status', {
      campaignId,
      status: 'SENT',
      delivered,
      audienceSize: recipients.length,
    });

    return { sent: true, recipients: recipients.length, delivered, campaign: serializeCampaign(finalCampaign) };
  },
};
