import { prisma } from '../../db/prisma.js';

/**
 * Integrations repository — tenant-scoped CRUD over Integration + the
 * append-only WebhookEvent log. Tenant scoping is enforced on every read.
 */
export const integrationsRepo = {
  list({ tenantId }) {
    return prisma.integration.findMany({ where: { tenantId }, orderBy: { provider: 'asc' } });
  },

  findByProvider({ tenantId, provider, branchId = null }) {
    // The (tenantId, branchId, provider) unique includes a nullable column,
    // which Prisma can't target via findUnique when branchId is null — use
    // findFirst so a tenant-wide (branchId=null) connection resolves.
    return prisma.integration.findFirst({ where: { tenantId, provider, branchId } });
  },

  async upsert({ tenantId, provider, branchId = null, create, update }) {
    const existing = await prisma.integration.findFirst({ where: { tenantId, provider, branchId } });
    if (existing) {
      return prisma.integration.update({ where: { id: existing.id }, data: update });
    }
    return prisma.integration.create({ data: { tenantId, branchId, provider, ...create } });
  },

  update({ id, data }) {
    return prisma.integration.update({ where: { id }, data });
  },

  /**
   * Record a webhook event, relying on the (provider, externalId) unique
   * constraint for idempotency. Returns `{ created, event }`; `created=false`
   * means we've already seen this external id (duplicate delivery).
   */
  async recordEvent({ provider, externalId, integrationId = null, signature = null, rawPayload }) {
    try {
      const event = await prisma.webhookEvent.create({
        data: { provider, externalId, integrationId, signature, rawPayload },
      });
      return { created: true, event };
    } catch (err) {
      if (err?.code === 'P2002') {
        const event = await prisma.webhookEvent.findUnique({
          where: { provider_externalId: { provider, externalId } },
        });
        return { created: false, event };
      }
      throw err;
    }
  },

  markEventProcessed({ id, errorMessage = null }) {
    return prisma.webhookEvent.update({
      where: { id },
      data: { processedAt: new Date(), errorMessage },
    });
  },
};
