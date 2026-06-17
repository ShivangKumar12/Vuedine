import { randomBytes } from 'node:crypto';

import { AppError } from '../../utils/AppError.js';
import { bumpVersion, withCache } from '../../utils/cache.js';
import { auditService } from '../audit/audit.service.js';

import { hardwareDevicesRepo } from './hardwareDevices.repository.js';

const CACHE_PREFIX = 'hardware';

function mintToken() {
  return randomBytes(24).toString('base64url');
}

/**
 * Serialize a device. The raw `pairingToken` is NEVER returned on list/detail
 * reads (Pitfall #2 — a leaked DB dump must not grant permanent print access).
 * It is only returned once, from the explicit /pair endpoint.
 */
function serialize(d, { includeToken = false } = {}) {
  const online = Boolean(d.active && d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60_000);
  return {
    id: d.id,
    tenantId: d.tenantId,
    branchId: d.branchId,
    type: d.type,
    label: d.label,
    model: d.model ?? null,
    ip: d.ip ?? null,
    macAddress: d.macAddress ?? null,
    station: d.station ?? null,
    active: d.active,
    online,
    paired: Boolean(d.pairedAt),
    pairedAt: d.pairedAt?.toISOString?.() ?? null,
    lastSeenAt: d.lastSeenAt?.toISOString?.() ?? null,
    ...(includeToken ? { pairingToken: d.pairingToken } : {}),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// Fields whose change must rotate the pairing token (Pitfall #2).
const SENSITIVE = ['ip', 'macAddress'];

export const hardwareDevicesService = {
  async list({ tenantId, branchId, type }) {
    const cacheKey = `svc:hardware:${tenantId}:${branchId ?? 'all'}:${type ?? 'all'}`;
    const rows = await withCache(
      { key: cacheKey, ttlSec: 30, prefix: CACHE_PREFIX },
      () => hardwareDevicesRepo.list({ tenantId, branchId, type }),
    );
    return rows.map((d) => serialize(d));
  },

  async getById({ tenantId, id }) {
    const d = await hardwareDevicesRepo.findById({ tenantId, id });
    if (!d) throw AppError.notFound('Device not found', 'DEVICE_NOT_FOUND');
    return serialize(d);
  },

  async create({ tenantId, body, actor }) {
    const device = await hardwareDevicesRepo.create({
      tenantId,
      branchId: body.branchId,
      type: body.type,
      label: body.label,
      model: body.model ?? null,
      ip: body.ip ?? null,
      macAddress: body.macAddress ?? null,
      station: body.station ?? null,
      pairingToken: mintToken(),
      active: body.active ?? true,
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'HARDWARE_DEVICE_CREATED',
      entityType: 'HardwareDevice',
      entityId: device.id,
      metadata: { type: device.type, label: device.label },
    });
    return serialize(device);
  },

  async update({ tenantId, id, body, actor }) {
    const cur = await hardwareDevicesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Device not found', 'DEVICE_NOT_FOUND');

    const data = {};
    for (const k of ['label', 'model', 'ip', 'macAddress', 'station', 'active', 'branchId', 'type']) {
      if (body[k] !== undefined) data[k] = body[k];
    }

    // Rotate the pairing token whenever a network identifier changes so a
    // previously-leaked token can't keep authenticating.
    const rotated = SENSITIVE.some((k) => body[k] !== undefined && body[k] !== cur[k]);
    if (rotated) {
      data.pairingToken = mintToken();
      data.pairedAt = null;
    }

    const updated = await hardwareDevicesRepo.update({ tenantId, id, data });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'HARDWARE_DEVICE_UPDATED',
      entityType: 'HardwareDevice',
      entityId: id,
      metadata: { keys: Object.keys(data), tokenRotated: rotated },
    });
    return serialize(updated);
  },

  /** Issue a fresh pairing token and return it ONCE. */
  async pair({ tenantId, id, actor }) {
    const cur = await hardwareDevicesRepo.findById({ tenantId, id });
    if (!cur) throw AppError.notFound('Device not found', 'DEVICE_NOT_FOUND');

    const updated = await hardwareDevicesRepo.update({
      tenantId,
      id,
      data: { pairingToken: mintToken(), pairedAt: new Date(), lastSeenAt: new Date(), active: true },
    });
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'HARDWARE_DEVICE_PAIRED',
      entityType: 'HardwareDevice',
      entityId: id,
    });
    return serialize(updated, { includeToken: true });
  },

  /** Heartbeat from a device — bumps lastSeenAt (used by the test button + agents). */
  async heartbeat({ tenantId, id }) {
    const updated = await hardwareDevicesRepo.update({
      tenantId,
      id,
      data: { lastSeenAt: new Date(), active: true },
    });
    if (!updated) throw AppError.notFound('Device not found', 'DEVICE_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    return serialize(updated);
  },

  async remove({ tenantId, id, actor }) {
    const count = await hardwareDevicesRepo.softDelete({ tenantId, id });
    if (count === 0) throw AppError.notFound('Device not found', 'DEVICE_NOT_FOUND');
    await bumpVersion(CACHE_PREFIX);
    await auditService.record({
      tenantId,
      userId: actor?.id,
      action: 'HARDWARE_DEVICE_DELETED',
      entityType: 'HardwareDevice',
      entityId: id,
    });
  },
};
