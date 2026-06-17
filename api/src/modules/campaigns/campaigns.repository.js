import { prisma } from '../../db/prisma.js';

/**
 * Campaign repository. Tenant-scoped; soft-delete via deletedAt.
 */
export const campaignsRepo = {
  list({ tenantId, where = {}, take = 200, skip = 0 }) {
    return prisma.$transaction([
      prisma.notificationCampaign.findMany({
        where: { tenantId, deletedAt: null, ...where },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      prisma.notificationCampaign.count({ where: { tenantId, deletedAt: null, ...where } }),
    ]);
  },

  findById({ tenantId, id }) {
    return prisma.notificationCampaign.findFirst({ where: { id, tenantId, deletedAt: null } });
  },

  create(data) {
    return prisma.notificationCampaign.create({ data });
  },

  async update({ tenantId, id, data }) {
    const res = await prisma.notificationCampaign.updateMany({
      where: { id, tenantId, deletedAt: null },
      data,
    });
    if (res.count === 0) return null;
    return prisma.notificationCampaign.findFirst({ where: { id } });
  },

  async softDelete({ tenantId, id }) {
    const res = await prisma.notificationCampaign.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count;
  },

  /** Update by id only — used by the worker (no tenant in job context). */
  updateById({ id, data }) {
    return prisma.notificationCampaign.update({ where: { id }, data });
  },

  createEvent(data) {
    return prisma.campaignEvent.create({ data });
  },

  createEventsMany(rows) {
    return prisma.campaignEvent.createMany({ data: rows });
  },

  listEvents({ campaignId, type, take = 50, skip = 0 }) {
    const where = { campaignId, ...(type ? { type } : {}) };
    return prisma.$transaction([
      prisma.campaignEvent.findMany({ where, orderBy: { at: 'desc' }, take, skip }),
      prisma.campaignEvent.count({ where }),
    ]);
  },
};
