import { api } from '../lib/api';
import { branchesStore, type Branch } from '../stores/branches';

export type CreateBranchInput = {
  name: string;
  code: string;
  qrSlug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  manager?: string | null;
  isLive?: boolean;
  timezoneCode?: string | null;
  defaultPrep?: number;
  serviceCharge?: number;
  taxInclusive?: boolean;
  diningSections?: string[];
  openingHours?: Record<string, [string, string] | string[]> | null;
};

export type UpdateBranchInput = Partial<CreateBranchInput>;

export const branchesApi = {
  async fetchAll(): Promise<Branch[]> {
    branchesStore.setLoading(true);
    try {
      const list = await api.get<Branch[]>('/v1/branches', { query: { pageSize: 200 } });
      branchesStore.setList(list);
      return list;
    } catch (err) {
      branchesStore.setError(err instanceof Error ? err.message : 'Failed to load branches');
      throw err;
    }
  },

  get(id: string): Promise<Branch> {
    return api.get<Branch>(`/v1/branches/${id}`);
  },

  async create(input: CreateBranchInput): Promise<Branch> {
    const branch = await api.post<Branch>('/v1/branches', input);
    branchesStore.upsert(branch);
    return branch;
  },

  async update(id: string, patch: UpdateBranchInput): Promise<Branch> {
    const branch = await api.patch<Branch>(`/v1/branches/${id}`, patch);
    branchesStore.upsert(branch);
    return branch;
  },

  async toggleLive(id: string, isLive?: boolean): Promise<Branch> {
    const branch = await api.post<Branch>(
      `/v1/branches/${id}/toggle-live`,
      isLive === undefined ? {} : { isLive },
    );
    branchesStore.upsert(branch);
    return branch;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/v1/branches/${id}`);
    branchesStore.remove(id);
  },

  sections(id: string): Promise<string[]> {
    return api.get<string[]>(`/v1/branches/${id}/sections`);
  },
};
