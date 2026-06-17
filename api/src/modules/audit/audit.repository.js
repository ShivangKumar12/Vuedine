import { prisma } from '../../db/prisma.js';

/**
 * Audit log writes go through this repository. The service wraps each call
 * in try/catch so a DB blip never propagates to the request handler.
 */
export const auditRepo = {
  create({ tenantId, userId, action, entityType, entityId, ip, userAgent, metadata }) {
    return prisma.auditLog.create({
      data: { tenantId, userId, action, entityType, entityId, ip, userAgent, metadata },
    });
  },
};
