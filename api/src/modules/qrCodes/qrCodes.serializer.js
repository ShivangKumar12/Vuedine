/**
 * QR serializer — maps a QrCode row to the exact shape QRCodes.tsx expects:
 *   { id, label, type, branch, url, status, scans, ordersToday, createdAt, thumbnail? }
 */

const TYPE_LABEL = {
  TABLE: 'Table',
  COUNTER: 'Counter',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  MARKETING: 'Marketing',
};

const STATUS_LABEL = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PENDING: 'Pending',
};

function fmtDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function serializeQr(q) {
  return {
    id: q.id,
    label: q.label,
    type: TYPE_LABEL[q.type] ?? q.type,
    typeCode: q.type,
    branch: q.branch?.name ?? '—',
    branchId: q.branchId,
    branchSlug: q.branch?.qrSlug ?? null,
    url: q.url,
    token: q.token,
    status: STATUS_LABEL[q.status] ?? q.status,
    statusCode: q.status,
    scans: q.scans ?? 0,
    ordersToday: q.ordersCount ?? 0,
    ordersCount: q.ordersCount ?? 0,
    tableId: q.tableId ?? null,
    thumbnail: q.thumbnail ?? null,
    createdAt: fmtDate(q.createdAt),
    createdIso: q.createdAt?.toISOString?.() ?? null,
  };
}
