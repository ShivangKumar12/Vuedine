import { api } from '../lib/api';
import type { Order, OrderStation } from './orders';

export const kdsApi = {
  listTickets(branchId?: string, station?: OrderStation): Promise<Order[]> {
    return api.get<Order[]>('/v1/kds/tickets', {
      query: { branchId, station },
    });
  },
};
