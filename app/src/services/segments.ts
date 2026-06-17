import { api } from '../lib/api';
import type { SegmentRule } from './campaigns';

/**
 * Segments service — built-in + saved audience segments.
 */
export type Segment = {
  id: string;
  name: string;
  rule: SegmentRule;
  systemKey: string | null;
  system: boolean;
  count: number;
};

export const segmentsApi = {
  list(): Promise<Segment[]> {
    return api.get<Segment[]>('/v1/segments');
  },
  create(input: { name: string; rule: SegmentRule }): Promise<Segment> {
    return api.post<Segment>('/v1/segments', input);
  },
  remove(id: string): Promise<void> {
    return api.delete(`/v1/segments/${id}`);
  },
  preview(body: { rule?: SegmentRule; audience?: string; requireConsent?: boolean; channel?: string }): Promise<{ count: number; sample: { id: string; name: string; email: string; phone: string | null }[] }> {
    return api.post('/v1/segments/preview', body);
  },
};
