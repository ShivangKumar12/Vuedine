import { api } from '../lib/api';

/**
 * Web Push service — VAPID subscription management + test push.
 */
export type PushSubscriptionRow = {
  id: string;
  platform: string;
  deviceId: string | null;
  lastSeenAt: string;
};

export const pushApi = {
  publicKey(): Promise<{ publicKey: string | null; configured: boolean }> {
    return api.get('/v1/push/public-key');
  },
  list(): Promise<PushSubscriptionRow[]> {
    return api.get<PushSubscriptionRow[]>('/v1/push/subscriptions');
  },
  subscribe(input: { endpoint: string; keys: { p256dh: string; auth: string }; platform?: string; deviceId?: string }): Promise<{ id: string; platform: string; createdAt: string }> {
    return api.post('/v1/push/subscribe', input);
  },
  unsubscribe(id: string): Promise<void> {
    return api.delete(`/v1/push/subscribe/${id}`);
  },
  test(): Promise<{ targets: number; delivered: number; note?: string }> {
    return api.post('/v1/push/test');
  },
};
