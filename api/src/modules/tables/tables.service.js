import { randomBytes } from 'node:crypto';

import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';
import { qrCodesService } from '../qrCodes/qrCodes.service.js';

import { tablesRepo } from './tables.repository.js';

/**
 * Tables service.
 *
 * Cache prefix: `tables`. Branch updates (qrSlug change) also bump this prefix
 * since QR URLs are composed from `branch.qrSlug` + `table.qrToken`.
 *
 * Status state machine:
 *   - Direct CRUD allows FREE ↔ CLEANING only. Housekeeping flips.
 *   - OCCUPIED / BILL are owned by the orders pipeline (Phase B).
 *   - RESERVED is owned by reservations (Phase F).
 *   - The state machine guard rejects mutations that would skip those flows.
 */

const CACHE_PREFIX = 'tables';
const QR_TOKEN_BYTES = 12; // 16 chars in base64url

function mintQrToken() {
  return randomBytes(QR_TOKEN_BYTES).toString('base64url');
}

async function ensureBranchOwnedByTenant({ tenantId, branchId }) {
  const branch = await branchesRepo.findById({ tenantId, id: branchId });
  if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
  return branch;
}

export const tablesService = {
  async listByBranch({ tenantId, branchId, page = 1, pageSize = 200, search, section, status }) {
    await ensureBranchOwnedByTenant({ tenantId, branchId });

    const skip = (page - 1) * pageSize;
    const where = {
      branchId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(section ? { section } : {}),
      ...(status ? { status } : {}),
    };

    const cacheKey = `service:tables:${tenantId}:${branchId}:${page}:${pageSize}:${search ?? ''}:${section ?? ''}:${status ?? ''}`;

    return withCache({ key: cacheKey, ttlSec: 30, prefix: CACHE_PREFIX }, async () => {
      const [rows, total] = await tablesRepo.list({
        tenantId,
        where,
        take: pageSize,
        skip,
      });
      return { rows, total };
    });
  },

  async listForTenant({ tenantId, page = 1, pageSize = 500, branchId, search, section, status }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(section ? { section } : {}),
      ...(status ? { status } : {}),
    };

    const cacheKey = `service:tables-tenant:${tenantId}:${page}:${pageSize}:${branchId ?? ''}:${search ?? ''}:${section ?? ''}:${status ?? ''}`;

    return withCache({ key: cacheKey, ttlSec: 30, prefix: CACHE_PREFIX }, async () => {
      const [rows, total] = await tablesRepo.list({ tenantId, where, take: pageSize, skip });
      return { rows, total };
    });
  },

  async getById({ tenantId, id }) {
    const table = await tablesRepo.findById({ tenantId, id });
    if (!table) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    return table;
  },

  async create({ tenantId, branchId, data, actor }) {
    const branch = await ensureBranchOwnedByTenant({ tenantId, branchId });

    const dup = await tablesRepo.findByName({ branchId, name: data.name });
    if (dup) {
      throw AppError.conflict(
        `A table named "${data.name}" already exists in this branch`,
        'TABLE_NAME_TAKEN',
      );
    }

    // Mint a unique qrToken — collision is astronomically unlikely but guard anyway.
    let qrToken = mintQrToken();
    for (let i = 0; i < 5; i += 1) {
      const existing = await tablesRepo.findByQrToken({ qrToken });
      if (!existing) break;
      qrToken = mintQrToken();
    }

    const table = await tablesRepo.create({ ...data, branchId, tenantId, qrToken });
    await bumpVersion(CACHE_PREFIX);

    // Auto-mint the TABLE-type QrCode (Phase G) sharing this token.
    await qrCodesService.autoMintForTable({ tenantId, branchId, branchSlug: branch.qrSlug, table });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_CREATED',
      entityType: 'Table',
      entityId: table.id,
      metadata: { name: table.name, branchId, qrToken: table.qrToken.slice(0, 6) + '…' },
    });

    return table;
  },

  async update({ tenantId, id, data, actor }) {
    if (data.name) {
      const cur = await tablesRepo.findById({ tenantId, id });
      if (!cur) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
      const dup = await tablesRepo.findByName({ branchId: cur.branchId, name: data.name });
      if (dup && dup.id !== id) {
        throw AppError.conflict(
          `A table named "${data.name}" already exists in this branch`,
          'TABLE_NAME_TAKEN',
        );
      }
    }

    const updated = await tablesRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_UPDATED',
      entityType: 'Table',
      entityId: updated.id,
      metadata: Object.keys(data),
    });

    return updated;
  },

  /**
   * Housekeeping status flip (FREE ↔ CLEANING). OCCUPIED / BILL / RESERVED are
   * owned by other modules.
   */
  async setStatus({ tenantId, id, status, actor }) {
    const cur = await tablesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');

    if (cur.status === 'OCCUPIED' || cur.status === 'BILL' || cur.status === 'RESERVED') {
      throw AppError.badRequest(
        `Table is ${cur.status.toLowerCase()} — close the active session first`,
        'TABLE_IN_USE',
      );
    }
    if (status !== 'FREE' && status !== 'CLEANING') {
      throw AppError.badRequest(
        'Direct status changes are limited to FREE or CLEANING',
        'TABLE_STATUS_RESERVED',
      );
    }

    const updated = await tablesRepo.update({ tenantId, id, data: { status } });
    if (!updated) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_UPDATED',
      entityType: 'Table',
      entityId: id,
      metadata: { from: cur.status, to: status },
    });

    return updated;
  },

  async regenerateQr({ tenantId, id, actor }) {
    const cur = await tablesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');

    let qrToken = mintQrToken();
    for (let i = 0; i < 5; i += 1) {
      const existing = await tablesRepo.findByQrToken({ qrToken });
      if (!existing || existing.id === id) break;
      qrToken = mintQrToken();
    }

    const updated = await tablesRepo.update({ tenantId, id, data: { qrToken } });
    await bumpVersion(CACHE_PREFIX);

    // Keep the TABLE-type QrCode in lockstep (old URL stops resolving).
    const branch = await branchesRepo.findById({ tenantId, id: updated.branchId });
    if (branch) {
      await qrCodesService.syncTableToken({ tenantId, branchSlug: branch.qrSlug, table: updated });
    }

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_QR_REGENERATED',
      entityType: 'Table',
      entityId: id,
    });

    return updated;
  },

  async remove({ tenantId, id, actor }) {
    const cur = await tablesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');

    if (cur.status === 'OCCUPIED' || cur.status === 'BILL' || cur.status === 'RESERVED') {
      throw AppError.badRequest(
        `Table is ${cur.status.toLowerCase()} — close the active session before deleting`,
        'TABLE_IN_USE',
      );
    }

    await tablesRepo.softDelete({ tenantId, id });
    await bumpVersion(CACHE_PREFIX);

    // Soft-delete the linked TABLE-type QrCode too.
    await qrCodesService.removeForTable({ tableId: id });

    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'TABLE_DELETED',
      entityType: 'Table',
      entityId: id,
    });
  },

  /**
   * Public resolver for guest PWA — `/m/:branchSlug/:qrToken`.
   * Returns table + branch (only the public-safe fields).
   */
  async resolveByQrToken({ branchSlug, qrToken }) {
    const branch = await branchesRepo.findBySlug({ qrSlug: branchSlug });
    if (!branch || !branch.isLive) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');

    const table = await tablesRepo.findByQrToken({ qrToken });
    if (!table || !table.active || table.branchId !== branch.id) {
      throw AppError.notFound('Table not found', 'TABLE_NOT_FOUND');
    }

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        qrSlug: branch.qrSlug,
        timezoneCode: branch.timezoneCode,
        defaultPrep: branch.defaultPrep,
        serviceCharge: branch.serviceCharge,
        taxInclusive: branch.taxInclusive,
      },
      table: {
        id: table.id,
        name: table.name,
        section: table.section,
        capacity: table.capacity,
        shape: table.shape,
        status: table.status,
      },
    };
  },
};
