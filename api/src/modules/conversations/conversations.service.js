import { enqueueOutboundMessage } from '../../queues/messaging.queue.js';
import { emitToTenant } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { conversationsRepo } from './conversations.repository.js';
import { serializeConversation, serializeMessage } from './conversations.serializer.js';

const CACHE_PREFIX = 'conversations';

export const conversationsService = {
  async list({ tenantId, query }) {
    const { status, channel, search } = query;
    const where = {
      ...(status ? { status: status.toUpperCase() } : {}),
      ...(channel ? { channel: channel.toUpperCase() } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
              { lastSnippet: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const cacheKey = `svc:conv:${tenantId}:${status ?? 'all'}:${channel ?? 'all'}:${search ?? ''}`;
    const { rows, total, stats } = await withCache(
      { key: cacheKey, ttlSec: 30, prefix: CACHE_PREFIX },
      async () => {
        const [list, count] = await conversationsRepo.list({ tenantId, where });
        const byStatus = await conversationsRepo.countByStatus({ tenantId });
        const unread = await conversationsRepo.unreadTotal({ tenantId });
        const s = {
          open: byStatus.find((b) => b.status === 'OPEN')?._count._all ?? 0,
          pending: byStatus.find((b) => b.status === 'PENDING')?._count._all ?? 0,
          resolved: byStatus.find((b) => b.status === 'RESOLVED')?._count._all ?? 0,
          unread: unread._sum.unread ?? 0,
        };
        return { rows: list, total: count, stats: s };
      },
    );
    return { rows: rows.map((c) => serializeConversation(c)), total, stats };
  },

  async getById({ tenantId, id, markRead = true }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    if (markRead && c.unread > 0) {
      await conversationsRepo.markMessagesRead({ conversationId: id });
      await conversationsRepo.update({ id, data: { unread: 0 } });
      await bumpVersion(CACHE_PREFIX);
      emitToTenant(tenantId, 'conversation:read', { conversationId: id });
      c.unread = 0;
    }
    return serializeConversation(c, { withMessages: true });
  },

  async reply({ tenantId, id, body, actor }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');

    const message = await conversationsRepo.addMessage({
      conversationId: id,
      sender: 'AGENT',
      body: body.body,
      attachments: body.attachments ?? null,
      read: true,
    });
    await conversationsRepo.update({
      id,
      data: {
        lastAt: new Date(),
        lastSnippet: body.body.slice(0, 140),
        status: c.status === 'RESOLVED' ? 'OPEN' : c.status,
        agentId: c.agentId ?? actor?.id ?? null,
      },
    });
    await bumpVersion(CACHE_PREFIX);

    // Dispatch to the provider (stub) for non-webchat channels.
    if (c.channel !== 'WEBCHAT') {
      try {
        await enqueueOutboundMessage({ conversationId: id, messageId: message.id, channel: c.channel, tenantId });
      } catch {
        /* queue offline */
      }
    }
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'MESSAGE_SENT',
      entityType: 'Conversation',
      entityId: id,
    });
    emitToTenant(tenantId, 'conversation:reply', { conversationId: id, message: serializeMessage(message) });
    return serializeMessage(message);
  },

  async assign({ tenantId, id, agentId, actor }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    await conversationsRepo.update({ id, data: { agentId: agentId ?? null } });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CONVERSATION_ASSIGNED',
      entityType: 'Conversation',
      entityId: id,
      metadata: { agentId },
    });
    return this.getById({ tenantId, id, markRead: false });
  },

  async setStatus({ tenantId, id, status, actor }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    await conversationsRepo.update({ id, data: { status: status.toUpperCase() } });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'CONVERSATION_STATUS_CHANGED',
      entityType: 'Conversation',
      entityId: id,
      metadata: { status },
    });
    return this.getById({ tenantId, id, markRead: false });
  },

  async setTags({ tenantId, id, tags }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    await conversationsRepo.update({ id, data: { tags } });
    await bumpVersion(CACHE_PREFIX);
    return this.getById({ tenantId, id, markRead: false });
  },

  async star({ tenantId, id, starred }) {
    const c = await conversationsRepo.findById({ tenantId, id });
    if (!c) throw AppError.notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    const next = typeof starred === 'boolean' ? starred : !c.starred;
    await conversationsRepo.update({ id, data: { starred: next } });
    await bumpVersion(CACHE_PREFIX);
    return this.getById({ tenantId, id, markRead: false });
  },

  /**
   * Ingest an inbound provider message — upsert the conversation, append the
   * message, bump unread, emit `conversation:new`. Used by the webhook routes.
   */
  async ingestInbound({ tenantId, channel, externalConversationId, externalMessageId, from, name, body, branchId = null }) {
    let conversation = externalConversationId
      ? await conversationsRepo.findByExternalRef({ tenantId, externalRef: externalConversationId })
      : null;
    if (!conversation && from) {
      conversation = await conversationsRepo.findByChannelPhone({ tenantId, channel, customerPhone: from });
    }
    if (!conversation) {
      conversation = await conversationsRepo.create({
        tenantId,
        branchId,
        channel,
        externalRef: externalConversationId ?? null,
        status: 'OPEN',
        customerName: name ?? from ?? 'Guest',
        customerPhone: from ?? null,
        unread: 0,
        lastAt: new Date(),
      });
    }

    const message = await conversationsRepo.addMessage({
      conversationId: conversation.id,
      sender: 'CUSTOMER',
      body,
      externalRef: externalMessageId ?? null,
      read: false,
    });
    const updated = await conversationsRepo.update({
      id: conversation.id,
      data: {
        unread: { increment: 1 },
        lastAt: new Date(),
        lastSnippet: body.slice(0, 140),
        status: conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status,
      },
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      action: 'MESSAGE_RECEIVED',
      entityType: 'Conversation',
      entityId: conversation.id,
      metadata: { channel },
    });
    emitToTenant(tenantId, 'conversation:new', {
      conversation: serializeConversation(updated),
      message: serializeMessage(message),
    });
    return { conversationId: conversation.id, messageId: message.id };
  },
};
