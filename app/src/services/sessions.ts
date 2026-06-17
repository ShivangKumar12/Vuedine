import { api } from '../lib/api';
import type { Order } from './orders';

export type TableSessionStatus = 'OPEN' | 'PREPARING' | 'SERVED' | 'AWAITING_PAYMENT' | 'CLOSED';

export type SessionRound = {
  id: string;
  serial: string;
  label: string;
  placedAt: string;
  status: string;
  lines: Array<{
    id: string;
    name: string;
    emoji: string | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    variantLabel: string | null;
    notes: string | null;
  }>;
  subtotal: number;
  grandTotal: number;
};

export type TableSession = {
  id: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  guestName: string | null;
  guestPhone: string | null;
  partySize: number;
  status: TableSessionStatus;
  statusLabel: string;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED';
  openedAt: string;
  closedAt: string | null;
  subtotal: number;
  taxTotal: number;
  serviceTotal: number;
  tipTotal: number;
  discountTotal: number;
  grandTotal: number;
  rounds: SessionRound[];
  orders: Order[];
};

export const sessionsApi = {
  list(branchId?: string, status?: TableSessionStatus): Promise<TableSession[]> {
    return api.get<TableSession[]>('/v1/table-sessions', { query: { branchId, status } });
  },

  get(id: string): Promise<TableSession> {
    return api.get<TableSession>(`/v1/table-sessions/${id}`);
  },

  open(input: {
    branchId: string;
    tableId: string;
    guestName?: string | null;
    guestPhone?: string | null;
    partySize?: number;
  }): Promise<TableSession> {
    return api.post<TableSession>('/v1/table-sessions', input);
  },

  close(id: string): Promise<TableSession> {
    return api.post<TableSession>(`/v1/table-sessions/${id}/close`);
  },

  requestBill(id: string): Promise<TableSession> {
    return api.post<TableSession>(`/v1/table-sessions/${id}/request-bill`);
  },

  update(id: string, patch: Partial<TableSession>): Promise<TableSession> {
    return api.patch<TableSession>(`/v1/table-sessions/${id}`, patch);
  },
};
