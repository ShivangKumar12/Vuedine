import { AppError } from '../../utils/AppError.js';

/**
 * Order status state machine.
 *
 *   PENDING → ACCEPTED → PREPARING → READY → SERVED         (dine-in / takeaway)
 *   PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED   (delivery)
 *   <any pre-terminal> → CANCELLED
 *
 *  - SERVED, DELIVERED, CANCELLED are terminal.
 *  - You can RECALL from READY back to PREPARING (kitchen made a mistake).
 *  - The frontend's LiveOrders/POSOrders use friendly strings ('New', 'Accepted',
 *    'Preparing', 'Ready', 'Served', 'Cancelled', 'Out for Delivery', 'Delivered',
 *    'Pending'). We translate at the API boundary in serializers.js.
 */

const TRANSITIONS = {
  PENDING:          ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:         ['PREPARING', 'CANCELLED'],
  PREPARING:        ['READY', 'CANCELLED'],
  READY:            ['SERVED', 'OUT_FOR_DELIVERY', 'PREPARING', 'CANCELLED'], // PREPARING = recall
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED:        [],
  SERVED:           [],
  CANCELLED:        [],
};

export const TERMINAL = new Set(['DELIVERED', 'SERVED', 'CANCELLED']);
export const ACTIVE = new Set(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']);

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw AppError.badRequest(
      `Order cannot move from ${from} to ${to}`,
      'ORDER_INVALID_TRANSITION',
    );
  }
}

/**
 * Default route — given order type, returns the "happy path" advance target
 * for the given status. Used by the dashboard's single "Advance" button.
 */
export function nextStatus({ status, type }) {
  switch (status) {
    case 'PENDING':
      return 'ACCEPTED';
    case 'ACCEPTED':
      return 'PREPARING';
    case 'PREPARING':
      return 'READY';
    case 'READY':
      return type === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'SERVED';
    case 'OUT_FOR_DELIVERY':
      return 'DELIVERED';
    default:
      return null;
  }
}
