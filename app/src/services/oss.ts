import { api } from '../lib/api';

export type OssTokenProjection = {
  id: string;
  token: string;
  serial: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  ageSec: number;
  readyAt: string | null;
};

export type OssBoard = {
  branch: { id: string; name: string; qrSlug: string };
  preparing: OssTokenProjection[];
  ready: OssTokenProjection[];
  now: string;
};

export const ossApi = {
  getBoard(branchSlug: string): Promise<OssBoard> {
    return api.get<OssBoard>(`/v1/oss/${branchSlug}/tokens`);
  },
};
