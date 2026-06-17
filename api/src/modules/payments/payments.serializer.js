/**
 * Serialize Payment for the dashboard frontend (Transactions.tsx).
 *
 * The frontend uses friendly labels: 'Cash', 'Card', 'UPI', 'Wallet',
 * 'Online', 'Loyalty' for method, 'Sale', 'Refund', 'Tip', 'Settlement',
 * 'Comp' for type, 'Success', 'Pending', 'Failed', 'Refunded' for status.
 */

const METHOD_TO_LABEL = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  WALLET: 'Wallet',
  ONLINE: 'Online',
  LOYALTY: 'Loyalty',
};

const TYPE_TO_LABEL = {
  SALE: 'Sale',
  REFUND: 'Refund',
  TIP: 'Tip',
  COMP: 'Comp',
  SETTLEMENT: 'Settlement',
};

const STATUS_TO_LABEL = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

export function serializePayment(p) {
  const dt = new Date(p.createdAt);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    id: p.serial, // UI uses TXN-... as the visible identifier
    serverId: p.id,
    serial: p.serial,
    tenantId: p.tenantId,
    branchId: p.branchId,
    orderId: p.orderId,
    orderSerial: p.order?.serial ? `ORD-${p.order.serial.replace(/[^A-Za-z0-9]/g, '')}` : '—',
    method: METHOD_TO_LABEL[p.method] ?? p.method,
    methodCode: p.method,
    type: TYPE_TO_LABEL[p.type] ?? p.type,
    typeCode: p.type,
    status: STATUS_TO_LABEL[p.status] ?? p.status,
    statusCode: p.status,
    amount: num(p.amount),
    fee: num(p.fee),
    currency: p.currency,
    cashier: p.cashierName,
    cashierId: p.cashierId,
    customer: p.customerName,
    reference: p.reference,
    gateway: p.gateway,
    channel: p.channel ?? p.order?.channel ?? null,
    parentPaymentId: p.parentPaymentId,
    capturedAt: p.capturedAt,
    failedReason: p.failedReason,
    date: `${pad(dt.getHours())}:${pad(dt.getMinutes())}, ${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`,
    iso: dt.toISOString(),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    refunds: (p.children ?? []).map((c) => ({
      id: c.serial,
      amount: num(c.amount),
      type: TYPE_TO_LABEL[c.type] ?? c.type,
      status: STATUS_TO_LABEL[c.status] ?? c.status,
      createdAt: c.createdAt,
    })),
  };
}

export function serializeSettlement(s) {
  return {
    id: s.id,
    gateway: s.gateway,
    reference: s.reference,
    grossAmount: num(s.grossAmount),
    feeAmount: num(s.feeAmount),
    netAmount: num(s.netAmount),
    paymentCount: s.paymentCount,
    settledAt: s.settledAt,
    bankReference: s.bankReference,
    createdAt: s.createdAt,
  };
}
