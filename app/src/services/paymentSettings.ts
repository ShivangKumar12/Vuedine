import { api } from '../lib/api';

export type PaymentSettings = {
  cashEnabled: boolean;
  cardEnabled: boolean;
  upiEnabled: boolean;
  walletEnabled: boolean;
  onlineEnabled: boolean;
  loyaltyEnabled: boolean;
  payOnDeliveryEnabled: boolean;
  gateway: string;
  razorpayKeyId: string | null;
  /** Returned masked from the server — only the last 4 chars are visible. */
  razorpayKeySecret: string | null;
  webhookSecret: string | null;
  autoCapture: boolean;
  partialPayments: boolean;
  settlementSchedule: 't-0' | 't-1' | 't-2';
  refundPolicy: 'full' | 'partial' | 'none';
  updatedAt: string;
};

export const paymentSettingsApi = {
  get(): Promise<PaymentSettings> {
    return api.get<PaymentSettings>('/v1/settings/payments');
  },

  update(patch: Partial<PaymentSettings>): Promise<PaymentSettings> {
    return api.patch<PaymentSettings>('/v1/settings/payments', patch);
  },
};
