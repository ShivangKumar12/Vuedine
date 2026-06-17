import { prisma } from '../../db/prisma.js';
import { enqueueGeoipEnrich } from '../../queues/qr.queue.js';
import { emitToBranch } from '../../realtime/socket.js';
import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { buildAppRedirect, buildQrUrl, mintQrToken, qrPngDataUrl } from '../../utils/qr.js';
import { auditService } from '../audit/audit.service.js';
import { branchesRepo } from '../branches/branches.repository.js';

import { qrCodesRepo } from './qrCodes.repository.js';
import { serializeQr } from './qrCodes.serializer.js';

const CACHE_PREFIX = 'qrcodes';

async function ensureBranch({ tenantId, branchId }) {
  const branch = await branchesRepo.findById({ tenantId, id: branchId });
  if (!branch) throw AppError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
  return branch;
}

/** Attach a lightweight `branch` object so the serializer can show its name. */
function withBranch(row, branch) {
  return { ...row, branch: branch ? { id: branch.id, name: branch.name, qrSlug: branch.qrSlug } : null };
}

async function attachBranches({ tenantId, rows }) {
  const ids = [...new Set(rows.map((r) => r.branchId))];
  const branches = await Promise.all(ids.map((id) => branchesRepo.findById({ tenantId, id })));
  const map = new Map(branches.filter(Boolean).map((b) => [b.id, b]));
  return rows.map((r) => withBranch(r, map.get(r.branchId)));
}

async function uniqueToken() {
  let token = mintQrToken();
  for (let i = 0; i < 5; i += 1) {
    const existing = await qrCodesRepo.findByToken({ token });
    if (!existing) break;
    token = mintQrToken();
  }
  return token;
}

export const qrCodesService = {
  async list({ tenantId, query }) {
    const { branchId, type, status } = query;
    const where = {
      ...(branchId ? { branchId } : {}),
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    };
    const cacheKey = `svc:qr:${tenantId}:${branchId ?? 'all'}:${type ?? 'all'}:${status ?? 'all'}`;
    const { rows, total, stats } = await withCache(
      { key: cacheKey, ttlSec: 20, prefix: CACHE_PREFIX },
      async () => {
        const [list, count] = await qrCodesRepo.list({ tenantId, where });
        const since = new Date(Date.now() - 30 * 86400_000);
        const scans30d = await qrCodesRepo.countScansSince({ tenantId, since });
        const withBranches = await attachBranches({ tenantId, rows: list });
        const s = {
          total: count,
          active: list.filter((q) => q.status === 'ACTIVE').length,
          scans: scans30d,
          orders: list.reduce((acc, q) => acc + (q.ordersCount ?? 0), 0),
        };
        return { rows: withBranches, total: count, stats: s };
      },
    );
    return { rows: rows.map(serializeQr), total, stats };
  },

  async getById({ tenantId, id }) {
    const q = await qrCodesRepo.findById({ tenantId, id });
    if (!q) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');
    const branch = await branchesRepo.findById({ tenantId, id: q.branchId });
    return serializeQr(withBranch(q, branch));
  },

  async create({ tenantId, body, actor }) {
    const branch = await ensureBranch({ tenantId, branchId: body.branchId });
    const token = await uniqueToken();
    const url = buildQrUrl({ branchSlug: branch.qrSlug, token });
    const thumbnail = await qrPngDataUrl(url);

    const qr = await qrCodesRepo.create({
      tenantId,
      branchId: body.branchId,
      type: body.type,
      label: body.label,
      url,
      token,
      status: body.status ?? 'ACTIVE',
      thumbnail,
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'QR_CODE_CREATED',
      entityType: 'QrCode',
      entityId: qr.id,
      metadata: { type: qr.type, label: qr.label, branchId: qr.branchId },
    });
    return serializeQr(withBranch(qr, branch));
  },

  async update({ tenantId, id, body, actor }) {
    const data = {};
    if (body.label !== undefined) data.label = body.label;
    if (body.status !== undefined) data.status = body.status;
    const updated = await qrCodesRepo.update({ tenantId, id, data });
    if (!updated) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'QR_CODE_UPDATED',
      entityType: 'QrCode',
      entityId: id,
      metadata: Object.keys(data),
    });
    const branch = await branchesRepo.findById({ tenantId, id: updated.branchId });
    return serializeQr(withBranch(updated, branch));
  },

  async remove({ tenantId, id, actor }) {
    const cur = await qrCodesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');
    const count = await qrCodesRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'QR_CODE_DELETED',
      entityType: 'QrCode',
      entityId: id,
    });
  },

  /** New token → old URL resolves to an "invalidated" page. Keeps the table in sync. */
  async regenerate({ tenantId, id, actor }) {
    const cur = await qrCodesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');
    const branch = await ensureBranch({ tenantId, branchId: cur.branchId });

    const token = await uniqueToken();
    const url = buildQrUrl({ branchSlug: branch.qrSlug, token });
    const thumbnail = await qrPngDataUrl(url);

    // TABLE-type QR shares the table's qrToken — keep them in lockstep.
    const updated = await prisma.$transaction(async (tx) => {
      if (cur.tableId) {
        await tx.table.update({ where: { id: cur.tableId }, data: { qrToken: token } });
      }
      await tx.qrCode.update({ where: { id }, data: { token, url, thumbnail, status: 'ACTIVE' } });
      return tx.qrCode.findFirst({ where: { id } });
    });

    await bumpVersion(CACHE_PREFIX);
    await bumpVersion('tables');
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'QR_CODE_REGENERATED',
      entityType: 'QrCode',
      entityId: id,
    });
    return serializeQr(withBranch(updated, branch));
  },

  /** Daily scan series + order-conversion for one QR (last 30 days). */
  async analytics({ tenantId, id }) {
    const qr = await qrCodesRepo.findById({ tenantId, id });
    if (!qr) throw AppError.notFound('QR code not found', 'QR_NOT_FOUND');

    const days = 30;
    const since = new Date(Date.now() - days * 86400_000);
    const scans = await qrCodesRepo.scanSeries({ qrCodeId: id, since });

    // Bucket by YYYY-MM-DD.
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    for (const s of scans) {
      const d = new Date(s.at).toISOString().slice(0, 10);
      if (buckets.has(d)) buckets.set(d, buckets.get(d) + 1);
    }
    const series = Array.from(buckets.entries()).map(([date, count]) => ({ date, scans: count }));
    const totalScans = qr.scans ?? 0;
    const orders = qr.ordersCount ?? 0;

    return {
      id: qr.id,
      label: qr.label,
      totalScans,
      scans30d: scans.length,
      orders,
      conversionRate: totalScans > 0 ? Math.round((orders / totalScans) * 1000) / 10 : 0,
      series,
    };
  },

  /** Rows for the bulk-print PDF (filtered, active by default). */
  async listForPrint({ tenantId, query }) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
    };
    const [rows] = await qrCodesRepo.list({ tenantId, where, take: 500 });
    return attachBranches({ tenantId, rows });
  },

  /* ============================================================
   *  Public scan resolver (GET /m/:branchSlug/:token)
   * ============================================================ */
  async resolveScan({ branchSlug, token, ip, userAgent, referrer }) {
    // Pitfall #2: 404 for soft-deleted / non-live branches.
    const branch = await branchesRepo.findBySlug({ qrSlug: branchSlug });
    if (!branch || !branch.isLive) {
      return { status: 'invalid', reason: 'BRANCH_NOT_FOUND' };
    }

    const qr = await qrCodesRepo.findByToken({ token });
    if (!qr || qr.branchId !== branch.id) {
      return { status: 'invalid', reason: 'QR_NOT_FOUND' };
    }
    if (qr.status !== 'ACTIVE') {
      return { status: 'invalidated', reason: 'QR_INACTIVE' };
    }

    // Record the scan (best-effort) + bump denorm counter.
    let scanId = null;
    try {
      const [, scan] = await qrCodesRepo.recordScan({ qrCodeId: qr.id, ip, userAgent, referrer });
      scanId = scan?.id ?? null;
      await bumpVersion(CACHE_PREFIX);
    } catch {
      /* never block a guest scan on analytics write */
    }

    // Real-time nudge for Live Orders ("new guest at table N").
    emitToBranch(branch.id, 'qr:scan', {
      qrCodeId: qr.id,
      type: qr.type,
      label: qr.label,
      tableId: qr.tableId,
      at: new Date().toISOString(),
    });

    // Async GeoIP enrich.
    if (scanId) enqueueGeoipEnrich({ scanId, ip }).catch(() => {});

    return {
      status: 'ok',
      redirect: buildAppRedirect({ branchSlug, token }),
      qr: { id: qr.id, type: qr.type, label: qr.label, tableId: qr.tableId },
    };
  },

  /* ============================================================
   *  Internal hooks used by other modules
   * ============================================================ */

  /** Auto-mint a TABLE-type QR row sharing the table's qrToken. */
  async autoMintForTable({ tenantId, branchId, branchSlug, table }) {
    const url = buildQrUrl({ branchSlug, token: table.qrToken });
    const thumbnail = await qrPngDataUrl(url);
    try {
      const qr = await qrCodesRepo.create({
        tenantId,
        branchId,
        type: 'TABLE',
        label: table.name,
        url,
        token: table.qrToken,
        status: 'ACTIVE',
        thumbnail,
        tableId: table.id,
      });
      await bumpVersion(CACHE_PREFIX);
      return qr;
    } catch {
      // Don't fail table creation if the QR row can't be minted.
      return null;
    }
  },

  /** Keep the TABLE-type QR in sync when a table's qrToken is regenerated. */
  async syncTableToken({ tenantId, branchSlug, table }) {
    const existing = await qrCodesRepo.findByTableId({ tableId: table.id });
    const url = buildQrUrl({ branchSlug, token: table.qrToken });
    const thumbnail = await qrPngDataUrl(url);
    if (existing) {
      await prisma.qrCode.update({
        where: { id: existing.id },
        data: { token: table.qrToken, url, thumbnail, label: table.name, status: 'ACTIVE' },
      });
    } else {
      await this.autoMintForTable({ tenantId, branchId: table.branchId, branchSlug, table });
    }
    await bumpVersion(CACHE_PREFIX);
  },

  /** Soft-delete the TABLE-type QR when its table is deleted. */
  async removeForTable({ tableId }) {
    const existing = await qrCodesRepo.findByTableId({ tableId });
    if (existing) {
      await prisma.qrCode.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
      await bumpVersion(CACHE_PREFIX);
    }
  },

  /** Increment the order-conversion counter for a table's QR. */
  async incrementOrdersForTable({ tableId }) {
    if (!tableId) return;
    const qr = await qrCodesRepo.findByTableId({ tableId });
    if (qr) {
      await qrCodesRepo.incrementOrders({ qrCodeId: qr.id });
      await bumpVersion(CACHE_PREFIX);
    }
  },
};
