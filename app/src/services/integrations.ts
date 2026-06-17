import { api } from '../lib/api';

/**
 * Integrations service — backs Integrations.tsx.
 *
 * The backend owns the canonical connection state (status, lastSync,
 * webhook URL, which credential fields are set). The page keeps presentational
 * metadata (icons, colours, copy) locally and merges this in.
 */

export type ApiIntegrationStatus = 'CONNECTED' | 'AVAILABLE' | 'COMING_SOON' | 'ERROR';

export type ApiCredentialField = { key: string; label: string; secret: boolean };

export type ApiIntegration = {
  provider: string;
  name: string;
  category: string;
  popular: boolean;
  builtin: boolean;
  comingSoon: boolean;
  supportsTest: boolean;
  supportsSync: boolean;
  fields: ApiCredentialField[];
  status: ApiIntegrationStatus;
  connected: boolean;
  connectedFields: string[];
  config: Record<string, unknown> | null;
  webhookUrl: string | null;
  lastSyncAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
};

export const integrationsApi = {
  list(): Promise<ApiIntegration[]> {
    return api.get<ApiIntegration[]>('/v1/integrations');
  },

  get(provider: string): Promise<ApiIntegration> {
    return api.get<ApiIntegration>(`/v1/integrations/${provider}`);
  },

  connect(
    provider: string,
    credentials: Record<string, string>,
    config?: Record<string, unknown>,
  ): Promise<ApiIntegration> {
    return api.post<ApiIntegration>(`/v1/integrations/${provider}/connect`, { credentials, config });
  },

  disconnect(provider: string): Promise<ApiIntegration> {
    return api.post<ApiIntegration>(`/v1/integrations/${provider}/disconnect`);
  },

  test(provider: string): Promise<{ ok: boolean; message: string }> {
    return api.post(`/v1/integrations/${provider}/test`);
  },

  sync(provider: string): Promise<{ queued: boolean; jobId: string | null; message: string }> {
    return api.post(`/v1/integrations/${provider}/sync`);
  },
};

/** Relative "x min ago" label from an ISO timestamp. */
export function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
