/**
 * Vuedine API client.
 *
 * One thin fetch wrapper for the entire frontend. Responsibilities:
 *   1. Prepend the API base URL.
 *   2. Inject the Bearer access token if we have one.
 *   3. Auto-refresh once on a 401 (single-flight, no thundering herd).
 *   4. Unwrap the standard envelope `{ success, data, meta, error, requestId }`.
 *   5. Throw a typed `ApiError` so callers can pattern-match on `code`.
 *
 * Token lifecycle:
 *   - `accessToken` lives in memory only (never localStorage — XSS exposure).
 *   - The refresh cookie is httpOnly + Path=/v1/auth + SameSite=Lax.
 *   - On 401, we POST /v1/auth/refresh once. If it succeeds, replay the
 *     original request. If it fails, clear the access token and bubble up
 *     so the caller can navigate to /login.
 */

import { authStore } from '../stores/auth';

const API_BASE =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL ??
  'http://localhost:4000';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error: { code: string; message: string; details?: unknown } | null;
  requestId: string;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(opts: { status: number; code: string; message: string; details?: unknown; requestId?: string }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }
}

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the auto-refresh on 401 (used by the refresh call itself). */
  skipRefresh?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
      if (!json.success || !json.data?.accessToken) return false;
      authStore.setAccessToken(json.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function call<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  const token = authStore.getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    signal: opts.signal,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // 204 — no content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError({
        status: res.status,
        code: 'BAD_RESPONSE',
        message: `Server returned ${res.status} with non-JSON body`,
      });
    }
  }

  if (res.ok && parsed?.success) return parsed.data;

  // 401 → try refresh once, replay
  if (res.status === 401 && !opts.skipRefresh && parsed?.error?.code !== 'NO_TOKEN') {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return call<T>(method, path, { ...opts, skipRefresh: true });
    }
    authStore.signOut();
  }

  throw new ApiError({
    status: res.status,
    code: parsed?.error?.code ?? `HTTP_${res.status}`,
    message: parsed?.error?.message ?? `Request failed with status ${res.status}`,
    details: parsed?.error?.details,
    requestId: parsed?.requestId,
  });
}

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return call<T>('GET', path, opts);
  },
  post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) {
    return call<T>('POST', path, { ...opts, body });
  },
  patch<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) {
    return call<T>('PATCH', path, { ...opts, body });
  },
  put<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) {
    return call<T>('PUT', path, { ...opts, body });
  },
  delete<T>(path: string, opts?: RequestOptions) {
    return call<T>('DELETE', path, opts);
  },

  /**
   * Get the meta block alongside data (for paginated lists).
   */
  async getWithMeta<T>(path: string, opts?: RequestOptions): Promise<{ data: T; meta?: Record<string, unknown> }> {
    const url = buildUrl(path, opts?.query);
    const token = authStore.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    };
    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: opts?.signal,
    });
    if (res.status === 204) return { data: undefined as T };

    const text = await res.text();
    const parsed = (text ? JSON.parse(text) : null) as ApiEnvelope<T> | null;

    if (res.ok && parsed?.success) {
      return { data: parsed.data, meta: parsed.meta };
    }
    if (res.status === 401 && parsed?.error?.code !== 'NO_TOKEN') {
      const refreshed = await attemptRefresh();
      if (refreshed) return this.getWithMeta<T>(path, opts);
      authStore.signOut();
    }
    throw new ApiError({
      status: res.status,
      code: parsed?.error?.code ?? `HTTP_${res.status}`,
      message: parsed?.error?.message ?? `Request failed with status ${res.status}`,
      details: parsed?.error?.details,
      requestId: parsed?.requestId,
    });
  },
};

export { API_BASE };
