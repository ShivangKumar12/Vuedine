import { ordersRepo } from '../orders/orders.repository.js';
import { serializeOrder } from '../orders/orders.serializer.js';

/**
 * Kitchen Display System (KDS) service.
 *
 * KDS is a read-only projection over Orders filtered to active states
 * (ACCEPTED, PREPARING, READY) and optionally narrowed to a station.
 *
 * The frontend KDS.tsx splits incoming tickets into three columns by
 * channel (Dine-In / Online / Takeaway) and a station rail (Hot / Cold /
 * Bar / Dessert). The shape we return mirrors a regular Order so the
 * frontend can reuse the same line-prepared toggle endpoint.
 */

export const kdsService = {
  async listTickets({ tenantId, branchId, station }) {
    const tickets = await ordersRepo.listKdsTickets({ tenantId, branchId, station });
    return tickets.map(serializeOrder);
  },
};
