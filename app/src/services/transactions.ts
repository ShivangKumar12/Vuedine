import { api } from '../lib/api';

/**
 * Transactions / Payments service — backs the Transactions page,
 * Transaction drawer, refund flow, and POS payment-mode buttons.
 */

export type PaymentMethodCode = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'LOYALTY';
export type PaymentTypeCode = 'SALE' | 'REFUND' | 'TIP' | 'COMP' | 'SETTLEMENT';
export type PaymentStatusCode = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type Transaction = {
  /** UI id — equals the human-readable serial like 'TXN-BAN-1003'. */
  id: string;
  /** Server CUID — used for refund/recapture endpoints. */
  serverId: string;
  serial: string;
  tenantId: string;
  branchId: string;
  orderId: string | null;
  orderSerial: string;
  method: 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Online' | 'Loyalty';
  methodCode: PaymentMethodCode;
  type: 'Sale' | 'Refund' | 'Tip' | 'Comp' | 'Settlement';
  typeCode: PaymentTypeCode;
  status: 'Success' | 'Pending' | 'Failed' | 'Refunded';
  statusCode: PaymentStatusCode;
  amount: number;
  fee: number;
  currency: string;
  cashier: string | null;
  cashierId: string | null;
  customer: string | null;
  reference: string | null;
  gateway: string | null;
  channel: string | null;
  parentPaymentId: string | null;
  capturedAt: string | null;
  failedReason: string | null;
  date: string;
  iso: string;
  createdAt: string;
  updatedAt: string;
  refunds: Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    createdAt: string;
  }>;
};

export type TransactionsListFilter = {
  branchId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  method?: PaymentMethodCode;
  type?: PaymentTypeCode;
  status?: PaymentStatusCode;
  fromDate?: string;
  toDate?: string;
};

export type TransactionsStats = {
  grossSales: number;
  refunds: number;
  tips: number;
  fees: number;
  net: number;
  methodMix: Array<{
    method: PaymentMethodCode;
    amount: number;
    count: number;
    share: number;
  }>;
};

export type CreatePaymentInput = {
  method: PaymentMethodCode;
  amount: number;
  fee?: number;
  reference?: string | null;
  gateway?: string | null;
  type?: 'SALE' | 'TIP';
  customerName?: string | null;
  /** Force SUCCESS immediately. Cash always captures; for non-cash this lets
      you record an authorize-and-capture flow inline (e.g. a card terminal
      that reports success synchronously). */
  capture?: boolean;
};

export type Settlement = {
  id: string;
  gateway: string;
  reference: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  paymentCount: number;
  settledAt: string;
  bankReference: string | null;
  createdAt: string;
};

let idempoCounter = 0;
function newKey() {
  idempoCounter += 1;
  return `vue-tx-${Date.now()}-${idempoCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const transactionsApi = {
  list(filter: TransactionsListFilter = {}): Promise<Transaction[]> {
    return api.get<Transaction[]>('/v1/transactions', {
      query: {
        page: filter.page ?? 1,
        pageSize: filter.pageSize ?? 50,
        branchId: filter.branchId,
        search: filter.search,
        method: filter.method,
        type: filter.type,
        status: filter.status,
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      },
    });
  },

  stats(branchId?: string, fromDate?: string, toDate?: string): Promise<TransactionsStats> {
    return api.get<TransactionsStats>('/v1/transactions/stats', {
      query: { branchId, fromDate, toDate },
    });
  },

  get(id: string): Promise<Transaction> {
    return api.get<Transaction>(`/v1/transactions/${id}`);
  },

  createForOrder(orderId: string, input: CreatePaymentInput): Promise<Transaction> {
    return api.post<Transaction>(`/v1/orders/${orderId}/payments`, input, {
      headers: { 'Idempotency-Key': newKey() },
    });
  },

  refund(orderId: string, paymentId: string, amount: number, reason?: string): Promise<Transaction> {
    return api.post<Transaction>(
      `/v1/orders/${orderId}/payments/${paymentId}/refund`,
      { amount, reason },
      { headers: { 'Idempotency-Key': newKey() } },
    );
  },

  comp(orderId: string, amount: number, reason?: string): Promise<Transaction> {
    return api.post<Transaction>(
      `/v1/orders/${orderId}/comp`,
      { amount, reason },
      { headers: { 'Idempotency-Key': newKey() } },
    );
  },

  recapture(paymentId: string): Promise<Transaction> {
    return api.post<Transaction>(`/v1/payments/${paymentId}/recapture`);
  },

  listSettlements(gateway?: string): Promise<Settlement[]> {
    return api.get<Settlement[]>('/v1/settlements', { query: { gateway, pageSize: 100 } });
  },

  syncSettlement(gateway: string): Promise<Settlement> {
    return api.post<Settlement>(`/v1/settlements/sync/${gateway}`);
  },
};
