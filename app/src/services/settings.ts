import { api } from '../lib/api';

/**
 * Settings service — backs Settings.tsx (Restaurant, Branding, Localization,
 * Taxes, Hardware, Notifications, Data) and hydrates the app-wide settings
 * store (currency symbol, tax rate, brand color).
 */

export type WeekStart = 'MONDAY' | 'SUNDAY' | 'SATURDAY';

export type TenantSettings = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  type: string;
  gstin: string | null;
  pan: string | null;
  fssai: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  brandColor: string;
  brandTheme: 'light' | 'dark';
  customDomain: string | null;
  currency: string;
  timezone: string;
  locale: string;
  numberLocale: string;
  weekStart: WeekStart;
  weightUnit: string;
  invoicePrefix: string;
  invoiceSequence: number;
  receiptFooter: string | null;
  roundOff: boolean;
  logoOnReceipt: boolean;
  serviceChargeEnabled: boolean;
  serviceChargePct: number;
  taxInclusive: boolean;
  igstInterState: boolean;
  demoMode: boolean;
  updatedAt: string;
};

export type TaxSlab = {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  rate: number;
  hsnCodes: string[];
  inclusive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentMethodCode = 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'ONLINE' | 'LOYALTY';

export type PaymentMethodConfig = {
  id: string;
  tenantId: string;
  branchId: string | null;
  method: PaymentMethodCode;
  enabled: boolean;
  preferred: boolean;
  serviceCharge: number;
  meta: Record<string, unknown> | null;
  updatedAt: string;
};

export type HardwareType =
  | 'RECEIPT_PRINTER' | 'KOT_PRINTER' | 'KDS_DISPLAY' | 'OSS_DISPLAY'
  | 'CASH_DRAWER' | 'CUSTOMER_DISPLAY' | 'WEIGHING_SCALE';

export type HardwareDevice = {
  id: string;
  tenantId: string;
  branchId: string;
  type: HardwareType;
  label: string;
  model: string | null;
  ip: string | null;
  macAddress: string | null;
  station: 'HOT' | 'COLD' | 'BAR' | 'DESSERT' | null;
  active: boolean;
  online: boolean;
  paired: boolean;
  pairedAt: string | null;
  lastSeenAt: string | null;
  pairingToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreference = {
  id: string;
  tenantId: string;
  branchId: string | null;
  userId: string | null;
  event: string;
  channel: 'sound' | 'push' | 'email' | 'sms';
  enabled: boolean;
};

export type SettingsBundle = {
  tenant: TenantSettings;
  taxSlabs: TaxSlab[];
  paymentMethods: PaymentMethodConfig[];
};

export const settingsApi = {
  /* ---- Bundle + tenant ---- */
  getBundle(): Promise<SettingsBundle> {
    return api.get<SettingsBundle>('/v1/settings');
  },
  updateTenant(patch: Partial<TenantSettings>): Promise<TenantSettings> {
    return api.patch<TenantSettings>('/v1/settings/tenant', patch);
  },
  updateBranding(patch: Partial<Pick<TenantSettings, 'brandColor' | 'brandTheme' | 'customDomain' | 'logoUrl' | 'bannerUrl'>>): Promise<TenantSettings> {
    return api.patch<TenantSettings>('/v1/settings/branding', patch);
  },
  updateLocalization(patch: Partial<Pick<TenantSettings, 'currency' | 'timezone' | 'locale' | 'numberLocale' | 'weekStart' | 'weightUnit'>>): Promise<TenantSettings> {
    return api.patch<TenantSettings>('/v1/settings/localization', patch);
  },
  exportData(): Promise<{ queued: boolean; jobId: string | null; message: string }> {
    return api.post('/v1/settings/data/export');
  },
  anonymizeTenant(): Promise<{ anonymized: boolean }> {
    return api.post('/v1/settings/data/anonymize-tenant', { confirm: true });
  },

  /* ---- Tax slabs ---- */
  listTaxSlabs(branchId?: string): Promise<TaxSlab[]> {
    return api.get<TaxSlab[]>('/v1/tax-slabs', { query: { branchId } });
  },
  createTaxSlab(input: { name: string; rate: number; branchId?: string | null; hsnCodes?: string[]; inclusive?: boolean; isDefault?: boolean }): Promise<TaxSlab> {
    return api.post<TaxSlab>('/v1/tax-slabs', input);
  },
  updateTaxSlab(id: string, patch: Partial<{ name: string; rate: number; branchId: string | null; hsnCodes: string[]; inclusive: boolean; isDefault: boolean }>): Promise<TaxSlab> {
    return api.patch<TaxSlab>(`/v1/tax-slabs/${id}`, patch);
  },
  deleteTaxSlab(id: string): Promise<void> {
    return api.delete(`/v1/tax-slabs/${id}`);
  },

  /* ---- Payment-method configs ---- */
  listPaymentMethodConfigs(branchId?: string): Promise<PaymentMethodConfig[]> {
    return api.get<PaymentMethodConfig[]>('/v1/payment-method-configs', { query: { branchId } });
  },
  upsertPaymentMethodConfig(input: { method: PaymentMethodCode; branchId?: string | null; enabled?: boolean; preferred?: boolean; serviceCharge?: number }): Promise<PaymentMethodConfig> {
    return api.post<PaymentMethodConfig>('/v1/payment-method-configs', input);
  },
  deletePaymentMethodConfig(id: string): Promise<void> {
    return api.delete(`/v1/payment-method-configs/${id}`);
  },

  /* ---- Hardware ---- */
  listHardware(query: { branchId?: string; type?: HardwareType } = {}): Promise<HardwareDevice[]> {
    return api.get<HardwareDevice[]>('/v1/hardware-devices', { query });
  },
  createHardware(input: { branchId: string; type: HardwareType; label: string; model?: string | null; ip?: string | null; macAddress?: string | null; station?: string | null }): Promise<HardwareDevice> {
    return api.post<HardwareDevice>('/v1/hardware-devices', input);
  },
  updateHardware(id: string, patch: Partial<{ label: string; model: string | null; ip: string | null; macAddress: string | null; station: string | null; active: boolean }>): Promise<HardwareDevice> {
    return api.patch<HardwareDevice>(`/v1/hardware-devices/${id}`, patch);
  },
  pairHardware(id: string): Promise<HardwareDevice> {
    return api.post<HardwareDevice>(`/v1/hardware-devices/${id}/pair`);
  },
  heartbeatHardware(id: string): Promise<HardwareDevice> {
    return api.post<HardwareDevice>(`/v1/hardware-devices/${id}/heartbeat`);
  },
  deleteHardware(id: string): Promise<void> {
    return api.delete(`/v1/hardware-devices/${id}`);
  },

  /* ---- Notification preferences ---- */
  listNotificationPrefs(query: { branchId?: string; userId?: string } = {}): Promise<NotificationPreference[]> {
    return api.get<NotificationPreference[]>('/v1/notification-preferences', { query });
  },
  bulkSetNotificationPrefs(prefs: { event: string; channel: 'sound' | 'push' | 'email' | 'sms'; enabled: boolean }[]): Promise<NotificationPreference[]> {
    return api.post<NotificationPreference[]>('/v1/notification-preferences/bulk', { prefs });
  },
};
