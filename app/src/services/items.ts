import { api } from '../lib/api';

export type Item = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  category: string;
  price: number | string;
  status: 'ACTIVE' | 'SOLD_OUT' | 'DRAFT';
  emoji: string | null;
  imageUrl: string | null;
  veg: boolean;
  bestseller: boolean;
  branchIds: string[];
  createdAt: string;
  updatedAt: string;
};

export const itemsApi = {
  listAll(): Promise<Item[]> {
    return api.get<Item[]>('/v1/items', { query: { pageSize: 500 } });
  },
  get(id: string): Promise<Item> {
    return api.get<Item>(`/v1/items/${id}`);
  },
};
