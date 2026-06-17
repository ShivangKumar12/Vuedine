import { api, API_BASE } from '../lib/api';
import { authStore } from '../stores/auth';

/**
 * Billing service — backs Subscription.tsx.
 * Plan/usage/invoice state is owned by the server; the page keeps only
 * presentational metadata (icons, accents) locally.
 */

export type PlanFeature = { label: string; included: boolean | string };

export type ApiPlan = {
  slug: 'starter' | 'growth' | 'enterprise';
  name: string;
  blurb: string | null;
  monthly: number;
  yearly: number;
  features: PlanFeature[];
  active: boolean;
};

export type ApiSubscription = {
  id: string;
  planSlug: string;
  cycle: 'monthly' | 'yearly';
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  statusLabel: string;
  startedAt: string;
  renewsAt: string;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  seatLimit: number;
  branchLimit: number;
  storageLimitGb: number;
  aiQuota: number;
  addons: string[];
  frozen: boolean;
  card: { last4: string; brand?: string; exp?: string } | null;
};

export type UsageMetric = { used: number; limit: number };
export type ApiUsage = {
  outlets: UsageMetric;
  seats: UsageMetric;
  aiRequests: UsageMetric;
  storage: UsageMetric;
};

export type ApiInvoice = {
  id: string;
  number: string;
  period: string;
  amount: number;
  taxAmount: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'FAILED' | 'VOID';
  statusLabel: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  date: string;
};

export type AddonDef = { id: string; name: string; desc: string; price: number };

export type BillingPayload = {
  plan: ApiPlan | null;
  plans: ApiPlan[];
  addonsCatalog: AddonDef[];
  subscription: ApiSubscription;
  usage: ApiUsage;
  invoices: ApiInvoice[];
};

export type Mandate = {
  provider: string | null;
  required: boolean;
  subscriptionRef: string | null;
  shortUrl: string | null;
};

export type ChangePlanResult = {
  subscription: ApiSubscription;
  invoice: ApiInvoice | null;
  mandate: Mandate;
};

export const billingApi = {
  current(): Promise<BillingPayload> {
    return api.get<BillingPayload>('/v1/subscription');
  },

  changePlan(planSlug: string, cycle: 'monthly' | 'yearly'): Promise<ChangePlanResult> {
    return api.post<ChangePlanResult>('/v1/subscription/change-plan', { planSlug, cycle });
  },

  cancel(): Promise<ApiSubscription> {
    return api.post<ApiSubscription>('/v1/subscription/cancel');
  },

  resume(): Promise<ApiSubscription> {
    return api.post<ApiSubscription>('/v1/subscription/resume');
  },

  toggleAddon(id: string): Promise<{ subscription: ApiSubscription; enabled: boolean }> {
    return api.post(`/v1/subscription/addons/${id}/toggle`);
  },

  invoices(): Promise<ApiInvoice[]> {
    return api.get<ApiInvoice[]>('/v1/invoices');
  },

  async downloadInvoice(id: string, number: string): Promise<void> {
    const token = authStore.getAccessToken();
    const res = await fetch(`${API_BASE}/v1/invoices/${id}/download`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
