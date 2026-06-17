import { logger } from '../../config/logger.js';
import { auditFailuresTotal } from '../../observability/metrics.js';

import { auditRepo } from './audit.repository.js';

/**
 * Audit writes are append-only and best-effort.
 *
 *   auditService.record({ tenantId, userId, action: 'AUTH_LOGIN', ... })
 *
 * Critical: audit MUST NOT break the request path. If the audit row fails,
 * we log it AND increment the `audit_failures_total` metric so dashboards
 * surface gaps even when nobody's reading the logs.
 */
export const auditService = {
  async record(event) {
    try {
      await auditRepo.create(event);
    } catch (err) {
      auditFailuresTotal.labels(event.action ?? 'unknown').inc();
      logger.error('audit.write_failed', {
        message: err.message,
        action: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    }
  },
};
