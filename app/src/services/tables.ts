import { api } from '../lib/api';

export type TableShape = 'round' | 'square' | 'rect';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'BILL';
export type HousekeepingStatus = 'FREE' | 'CLEANING';

export type Table = {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  section: string;
  capacity: number;
  shape: TableShape;
  status: TableStatus;
  active: boolean;
  qrToken: string;
  posLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTableInput = {
  name: string;
  section: string;
  capacity: number;
  shape: TableShape;
  active?: boolean;
  posLabel?: string | null;
};

export type UpdateTableInput = Partial<CreateTableInput>;

export const tablesApi = {
  listForBranch(branchId: string): Promise<Table[]> {
    return api.get<Table[]>(`/v1/branches/${branchId}/tables`, { query: { pageSize: 500 } });
  },

  get(id: string): Promise<Table> {
    return api.get<Table>(`/v1/tables/${id}`);
  },

  create(branchId: string, input: CreateTableInput): Promise<Table> {
    return api.post<Table>(`/v1/branches/${branchId}/tables`, input);
  },

  update(id: string, patch: UpdateTableInput): Promise<Table> {
    return api.patch<Table>(`/v1/tables/${id}`, patch);
  },

  setStatus(id: string, status: HousekeepingStatus): Promise<Table> {
    return api.patch<Table>(`/v1/tables/${id}/status`, { status });
  },

  regenerateQr(id: string): Promise<Table> {
    return api.post<Table>(`/v1/tables/${id}/qr/regenerate`);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/v1/tables/${id}`);
  },
};
