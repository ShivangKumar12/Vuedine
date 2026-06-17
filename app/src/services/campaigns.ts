import { api } from '../lib/api';

/**
 * Campaigns service — backs PushNotifications.tsx and the broadcast composer.
 */

export type CampaignType = 'PUSH' | 'EMAIL' | 'SMS' | 'WHATSAPP';
export type CampaignStatusCode = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type SegmentRule = {
  kind: 'all' | 'vip' | 'loyal' | 'lapsed' | 'new' | 'custom';
  tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  tags?: string[];
  minOrders?: number;
  lapsedDays?: number;
  whatsappTemplate?: string;
};

export type Campaign = {
  id: string;
  type: CampaignType;
  title: string;
  body: string;
  imageUrl: string | null;
  imageEmoji: string | null;
  ctaLabel: string;
  ctaUrl: string;
  audience: string; // display label
  audienceKey: string;
  audienceQuery: SegmentRule | null;
  audienceSize: number;
  status: string; // display label: 'Draft' | 'Sent' | ...
  statusCode: CampaignStatusCode;
  scheduledFor: string | null;
  sentAt: string | null;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  unsubscribed: number;
  createdById: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CampaignInput = {
  type: CampaignType;
  title: string;
  body: string;
  imageEmoji?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  audience?: string;
  audienceQuery?: SegmentRule | null;
};

export type AudiencePreview = {
  count: number;
  sample: { id: string; name: string; email: string; phone: string | null }[];
};

export type CampaignEvent = {
  id: string;
  type: string;
  channel: string;
  customerId: string | null;
  at: string;
};

export const campaignsApi = {
  async list(query: { status?: CampaignStatusCode; type?: CampaignType } = {}): Promise<Campaign[]> {
    return api.get<Campaign[]>('/v1/campaigns', { query });
  },
  get(id: string): Promise<Campaign> {
    return api.get<Campaign>(`/v1/campaigns/${id}`);
  },
  create(input: CampaignInput): Promise<Campaign> {
    return api.post<Campaign>('/v1/campaigns', input);
  },
  update(id: string, patch: Partial<CampaignInput>): Promise<Campaign> {
    return api.patch<Campaign>(`/v1/campaigns/${id}`, patch);
  },
  remove(id: string): Promise<void> {
    return api.delete(`/v1/campaigns/${id}`);
  },
  sendNow(id: string): Promise<{ sent: boolean; recipients: number; delivered: number; campaign: Campaign }> {
    return api.post(`/v1/campaigns/${id}/send-now`);
  },
  schedule(id: string, at: string): Promise<Campaign> {
    return api.post<Campaign>(`/v1/campaigns/${id}/schedule`, { at });
  },
  cancel(id: string): Promise<Campaign> {
    return api.post<Campaign>(`/v1/campaigns/${id}/cancel`);
  },
  events(id: string, query: { type?: string; page?: number; pageSize?: number } = {}): Promise<CampaignEvent[]> {
    return api.get<CampaignEvent[]>(`/v1/campaigns/${id}/events`, { query });
  },
  previewAudience(body: { type?: CampaignType; audience?: string; audienceQuery?: SegmentRule; rule?: SegmentRule }): Promise<AudiencePreview> {
    return api.post<AudiencePreview>('/v1/campaigns/preview-audience', body);
  },
};
