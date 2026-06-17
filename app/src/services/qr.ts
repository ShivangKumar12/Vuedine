import { api, API_BASE } from '../lib/api';
import { authStore } from '../stores/auth';

/**
 * QR codes service — backs QRCodes.tsx (manage tab).
 */

export type QrTypeCode = 'TABLE' | 'COUNTER' | 'TAKEAWAY' | 'DELIVERY' | 'MARKETING';
export type QrStatusCode = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type QrTypeLabel = 'Table' | 'Counter' | 'Takeaway' | 'Delivery' | 'Marketing';
export type QrStatusLabel = 'Active' | 'Inactive' | 'Pending';

export type QrEntry = {
  id: string;
  label: string;
  type: QrTypeLabel;
  typeCode: QrTypeCode;
  branch: string;
  branchId: string;
  branchSlug: string | null;
  url: string;
  token: string;
  status: QrStatusLabel;
  statusCode: QrStatusCode;
  scans: number;
  ordersToday: number;
  ordersCount: number;
  tableId: string | null;
  thumbnail: string | null;
  createdAt: string;
  createdIso: string | null;
};

export type QrStats = { total: number; active: number; scans: number; orders: number };

export type QrAnalytics = {
  id: string;
  label: string;
  totalScans: number;
  scans30d: number;
  orders: number;
  conversionRate: number;
  series: { date: string; scans: number }[];
};

export type QrListResult = { entries: QrEntry[]; stats: QrStats };

export const qrApi = {
  async list(query: { branchId?: string; type?: QrTypeCode } = {}): Promise<QrListResult> {
    const { data, meta } = await api.getWithMeta<QrEntry[]>('/v1/qr-codes', { query });
    const stats = (meta?.stats as QrStats) ?? { total: data.length, active: 0, scans: 0, orders: 0 };
    return { entries: data, stats };
  },

  get(id: string): Promise<QrEntry> {
    return api.get<QrEntry>(`/v1/qr-codes/${id}`);
  },

  create(input: { branchId: string; type: Exclude<QrTypeCode, 'TABLE'>; label: string }): Promise<QrEntry> {
    return api.post<QrEntry>('/v1/qr-codes', input);
  },

  update(id: string, patch: { label?: string; status?: QrStatusCode }): Promise<QrEntry> {
    return api.patch<QrEntry>(`/v1/qr-codes/${id}`, patch);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/v1/qr-codes/${id}`);
  },

  regenerate(id: string): Promise<QrEntry> {
    return api.post<QrEntry>(`/v1/qr-codes/${id}/regenerate`);
  },

  analytics(id: string): Promise<QrAnalytics> {
    return api.get<QrAnalytics>(`/v1/qr-codes/${id}/analytics`);
  },

  /** Fetch the bulk-print PDF as a Blob (binary — bypasses the envelope unwrap). */
  async bulkPrint(body: { branchId?: string; type?: QrTypeCode; ids?: string[] } = {}): Promise<Blob> {
    const token = authStore.getAccessToken();
    const res = await fetch(`${API_BASE}/v1/qr-codes/bulk-print`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Bulk print failed (${res.status})`);
    return res.blob();
  },
};
