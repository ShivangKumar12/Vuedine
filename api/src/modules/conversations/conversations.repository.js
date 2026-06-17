import { prisma } from '../../db/prisma.js';

/**
 * Conversations + messages repository. Tenant-scoped.
 */
export const conversationsRepo = {
  list({ tenantId, where = {}, take = 100, skip = 0 }) {
    return prisma.$transaction([
      prisma.conversation.findMany({
        where: { tenantId, ...where },
        orderBy: { lastAt: 'desc' },
        take,
        skip,
      }),
      prisma.conversation.count({ where: { tenantId, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.conversation.findFirst({
      where: { id, tenantId },
      include: { messages: { orderBy: { at: 'asc' } } },
    });
  },

  findByExternalRef({ tenantId, externalRef }) {
    return prisma.conversation.findFirst({ where: { tenantId, externalRef } });
  },

  findByChannelPhone({ tenantId, channel, customerPhone }) {
    return prisma.conversation.findFirst({ where: { tenantId, channel, customerPhone } });
  },

  create(data) {
    return prisma.conversation.create({ data });
  },

  update({ id, data }) {
    return prisma.conversation.update({ where: { id }, data });
  },

  addMessage(data) {
    return prisma.message.create({ data });
  },

  markMessagesRead({ conversationId }) {
    return prisma.message.updateMany({
      where: { conversationId, sender: 'CUSTOMER', read: false },
      data: { read: true },
    });
  },

  countByStatus({ tenantId }) {
    return prisma.conversation.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } });
  },

  unreadTotal({ tenantId }) {
    return prisma.conversation.aggregate({ where: { tenantId }, _sum: { unread: true } });
  },
};
