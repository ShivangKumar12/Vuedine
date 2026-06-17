import { AppError } from '../../utils/AppError.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { ordersRepo } from '../orders/orders.repository.js';

/**
 * Order Status Screen — public, token-only customer board.
 *
 * Mounted on a TV near the counter. Shows two columns:
 *   - Preparing  (orders in PREPARING)
 *   - Ready      (orders in READY)
 *
 * No PII leaks; we expose only token, serial (last 4), age, and type.
 */

export const ossService = {
  async getTokens({ branchSlug }) {
    const branch = await branchesRepo.findBySlug({ qrSlug: branchSlug });
    if (!branch || !branch.isLive) {
      throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    }
    const rows = await ordersRepo.listOssTokens({ branchId: branch.id });

    const preparing = [];
    const ready = [];
    for (const r of rows) {
      const ageSec = Math.max(0, Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 1000));
      const projection = {
        id: r.id,
        token: r.token,
        serial: r.serial,
        type: r.type,
        ageSec,
        readyAt: r.readyAt,
      };
      if (r.status === 'READY') ready.push(projection);
      else preparing.push(projection);
    }

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        qrSlug: branch.qrSlug,
      },
      preparing,
      ready,
      now: new Date().toISOString(),
    };
  },
};
