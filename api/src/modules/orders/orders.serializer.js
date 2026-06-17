/**
 * Translate DB enum / shape into the friendly form the React frontend
 * expects. The frontend uses 'New' / 'Pending' / 'Out for Delivery'
 * verbatim — we keep them quoted as literals here so any drift jumps
 * out in code review.
 */

const STATUS_TO_LABEL = {
  PENDING:           'Pending',
  ACCEPTED:          'Accepted',
  PREPARING:         'Preparing',
  READY:             'Ready',
  OUT_FOR_DELIVERY:  'Out for Delivery',
  DELIVERED:         'Delivered',
  SERVED:            'Served',
  CANCELLED:         'Cancelled',
};

const TYPE_TO_LABEL = {
  DINE_IN:  'Dine-In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};

const CHANNEL_TO_LABEL = {
  POS:    'POS',
  WAITER: 'Waiter',
  QR:     'QR',
  ONLINE: 'Online',
};

const SOURCE_TO_LABEL = {
  POS:            'POS',
  WAITER:         'Waiter',
  QR:             'QR',
  ZOMATO:         'Zomato',
  SWIGGY:         'Swiggy',
  VUEDINE_DIRECT: 'Vuedine Direct',
  WHATSAPP:       'WhatsApp',
  QR_PAY:         'QR Pay',
};

const PAYMENT_TO_LABEL = {
  CASH:      'Cash',
  CARD:      'Card',
  UPI:       'UPI',
  WALLET:    'Wallet',
  ONLINE:    'Online',
  PAY_LATER: 'Pay later',
};

const PAYMENT_STATUS_TO_LABEL = {
  UNPAID:   'Pay on delivery',
  PARTIAL:  'Partial',
  PAID:     'Paid',
  REFUNDED: 'Refunded',
};

const STATION_TO_LABEL = {
  HOT:     'Hot',
  COLD:    'Cold',
  BAR:     'Bar',
  DESSERT: 'Dessert',
};

function num(d) {
  if (d === null || d === undefined) return 0;
  return typeof d === 'object' && d.toNumber ? d.toNumber() : Number(d);
}

export function serializeOrderItem(item) {
  return {
    id: item.id,
    itemId: item.itemId,
    name: item.itemName,
    emoji: item.emoji,
    qty: item.qty,
    unitPrice: num(item.unitPrice),
    lineTotal: num(item.lineTotal),
    variantLabel: item.variantLabel,
    variantId: item.variantId,
    addons: item.addons ?? [],
    notes: item.notes,
    spice: item.spice,
    station: item.station,
    stationLabel: STATION_TO_LABEL[item.station] ?? item.station,
    prepared: item.prepared,
    preparedAt: item.preparedAt,
    preparedBy: item.preparedBy,
  };
}

export function serializeOrderEvent(e) {
  return {
    id: e.id,
    type: e.type,
    actorId: e.actorId,
    actorName: e.actorName,
    message: e.message,
    metadata: e.metadata,
    createdAt: e.createdAt,
  };
}

export function serializeOrder(order) {
  return {
    id: order.id,
    serial: order.serial,
    token: order.token,
    tenantId: order.tenantId,
    branchId: order.branchId,
    sessionId: order.sessionId,
    tableId: order.tableId,
    type: order.type,
    typeLabel: TYPE_TO_LABEL[order.type] ?? order.type,
    channel: order.channel,
    channelLabel: CHANNEL_TO_LABEL[order.channel] ?? order.channel,
    source: order.source,
    sourceLabel: SOURCE_TO_LABEL[order.source] ?? order.source,
    station: order.station,
    stationLabel: STATION_TO_LABEL[order.station] ?? order.station,
    priority: order.priority,
    status: order.status,
    statusLabel: STATUS_TO_LABEL[order.status] ?? order.status,
    guestName: order.guestName,
    guestPhone: order.guestPhone,
    tableLabel: order.tableLabel,
    deliveryAddress: order.deliveryAddress,
    deliveryNotes: order.deliveryNotes,
    driverName: order.driverName,
    driverPhone: order.driverPhone,
    etaMinutes: order.etaMinutes,
    subtotal: num(order.subtotal),
    discountTotal: num(order.discountTotal),
    taxTotal: num(order.taxTotal),
    serviceTotal: num(order.serviceTotal),
    tipTotal: num(order.tipTotal),
    grandTotal: num(order.grandTotal),
    promoCode: order.promoCode,
    taxBreakdown: order.taxBreakdown ?? [],
    paymentMode: order.paymentMode,
    paymentModeLabel: PAYMENT_TO_LABEL[order.paymentMode] ?? order.paymentMode,
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_TO_LABEL[order.paymentStatus] ?? order.paymentStatus,
    acceptedAt: order.acceptedAt,
    startedAt: order.startedAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    dispatchedAt: order.dispatchedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items ?? []).map(serializeOrderItem),
    events: (order.events ?? []).map(serializeOrderEvent),
  };
}
