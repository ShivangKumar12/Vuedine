import { serializeOrder } from '../orders/orders.serializer.js';

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

const STATUS_TO_LABEL = {
  OPEN: 'Open',
  PREPARING: 'Preparing',
  SERVED: 'Served',
  AWAITING_PAYMENT: 'Awaiting payment',
  CLOSED: 'Closed',
};

export function serializeSession(s) {
  // Compute totals from child orders for an authoritative view (the persisted
  // totals are kept in sync but recomputing avoids drift).
  const orders = (s.orders ?? []).filter((o) => o.deletedAt === null || o.deletedAt === undefined);
  const subtotal = orders.reduce((acc, o) => acc + num(o.subtotal), 0);
  const taxTotal = orders.reduce((acc, o) => acc + num(o.taxTotal), 0);
  const serviceTotal = orders.reduce((acc, o) => acc + num(o.serviceTotal), 0);
  const tipTotal = orders.reduce((acc, o) => acc + num(o.tipTotal), 0);
  const discountTotal = orders.reduce((acc, o) => acc + num(o.discountTotal), 0);
  const grandTotal = orders.reduce((acc, o) => acc + num(o.grandTotal), 0);

  return {
    id: s.id,
    tenantId: s.tenantId,
    branchId: s.branchId,
    tableId: s.tableId,
    guestName: s.guestName,
    guestPhone: s.guestPhone,
    partySize: s.partySize,
    status: s.status,
    statusLabel: STATUS_TO_LABEL[s.status] ?? s.status,
    paymentStatus: s.paymentStatus,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    subtotal,
    taxTotal,
    serviceTotal,
    tipTotal,
    discountTotal,
    grandTotal,
    rounds: orders.map((o, i) => ({
      id: o.id,
      serial: o.serial,
      label: `Round ${i + 1}`,
      placedAt: o.createdAt,
      status: o.status,
      lines: serializeOrder(o).items,
      subtotal: num(o.subtotal),
      grandTotal: num(o.grandTotal),
    })),
    orders: orders.map((o) => serializeOrder(o)),
  };
}
