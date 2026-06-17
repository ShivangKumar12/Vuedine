import { api, API_BASE } from '../lib/api';
import { authStore } from '../stores/auth';

/**
 * Reports service — backs Dashboard.tsx and SalesReport.tsx.
 *
 * Every number on those pages is sourced from /v1/reports/* aggregates
 * (base-table aggregation, tenant-timezone-aware, cached 60s server-side).
 * Binary exports (CSV/PDF) bypass the envelope unwrap (see qr.ts pattern).
 */

/* ---------- Dashboard ---------- */

export type KpiValue = { value: number; delta: string; up: boolean };

export type DashboardPayload = {
  kpis: {
    totalSales: KpiValue;
    totalOrders: KpiValue;
    totalCustomers: KpiValue;
    totalMenuItems: KpiValue;
  };
  orderStatusCounts: {
    total: number;
    pending: number;
    accepted: number;
    preparing: number;
    prepared: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
  };
  salesSummary: { bars: number[]; totalSales: number; avgPerDay: number };
  ordersSummary: { delivered: number; returned: number; cancelled: number; rejected: number };
  customerStats: { new: KpiValue; returning: KpiValue; inactive: KpiValue };
  topCustomers: { name: string; spend: number; orders: number }[];
  featuredItems: { e: string; name: string; price: number; sold: number; tag: string }[];
  mostPopularItems: { e: string; name: string; sold: number; p: number }[];
  range: { from: string; to: string };
};

/* ---------- Sales report ---------- */

export type PaymentType = 'Cash' | 'Card' | 'UPI' | 'Wallet' | 'Online';
export type PayStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';
export type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery' | 'QR';

export type SalesRow = {
  id: string;
  iso: string;
  total: number;
  discount: number;
  delivery: number;
  payment: PaymentType;
  status: PayStatus;
  type: OrderType;
  customer: string;
};

export type SalesPayload = {
  kpis: { orders: number; earnings: number; discounts: number; delivery: number };
  hourly: { h: number; v: number }[];
  paymentMix: { m: PaymentType; v: number; share: number }[];
  typeMix: { t: OrderType; v: number; share: number }[];
  rows: SalesRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RangeQuery = { from?: string; to?: string; branchId?: string };

export type SalesQuery = RangeQuery & {
  type?: 'All' | OrderType;
  payment?: 'All' | PaymentType;
  status?: 'All' | PayStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'gst';

export const reportsApi = {
  dashboard(query: RangeQuery = {}): Promise<DashboardPayload> {
    return api.get<DashboardPayload>('/v1/reports/dashboard', { query });
  },

  async sales(query: SalesQuery = {}): Promise<SalesPayload> {
    const { data, meta } = await api.getWithMeta<Omit<SalesPayload, 'total' | 'page' | 'pageSize' | 'totalPages'>>(
      '/v1/reports/sales',
      { query },
    );
    return {
      ...data,
      total: Number(meta?.total ?? data.rows.length),
      page: Number(meta?.page ?? query.page ?? 1),
      pageSize: Number(meta?.pageSize ?? query.pageSize ?? 10),
      totalPages: Number(meta?.totalPages ?? 1),
    };
  },

  itemsPopularity(query: { period?: '7d' | '30d' | '90d'; branchId?: string } = {}) {
    return api.get<{ name: string; emoji: string; sold: number; share: number }[]>(
      '/v1/reports/items/popularity',
      { query },
    );
  },

  topCustomers(query: { period?: '7d' | '30d' | '90d'; branchId?: string; take?: number } = {}) {
    return api.get<{ rank: number; name: string; spend: number; orders: number }[]>(
      '/v1/reports/customers/top',
      { query },
    );
  },

  staffPerformance(query: RangeQuery = {}) {
    return api.get<{ cashiers: { cashierId: string; name: string; sales: number; transactions: number }[] }>(
      '/v1/reports/staff/performance',
      { query },
    );
  },

  /** Queue an async export (emailed to the owner when ready). */
  enqueueExport(query: SalesQuery & { format: ExportFormat }): Promise<{ queued: boolean; jobId: string | null; message: string }> {
    return api.get('/v1/reports/sales/export', { query: { ...query, async: 'true' } });
  },

  /**
   * Download the sales export as a Blob (binary — bypasses the envelope).
   * `excel` and `gst` are served as CSV; `pdf` as a PDF document.
   */
  async download(query: SalesQuery & { format: ExportFormat }): Promise<{ blob: Blob; filename: string }> {
    const token = authStore.getAccessToken();
    const url = new URL(`${API_BASE}/v1/reports/sales/export`);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
    const accept = query.format === 'pdf' ? 'application/pdf' : 'text/csv';
    const res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: accept,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const filename = query.format === 'pdf' ? 'sales-report.pdf' : 'sales-report.csv';
    return { blob, filename };
  },
};

/** Trigger a browser download for a fetched Blob. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
