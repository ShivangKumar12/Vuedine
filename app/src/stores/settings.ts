import { createStore } from './store';
import {
  settingsApi,
  type PaymentMethodConfig,
  type SettingsBundle,
  type TaxSlab,
  type TenantSettings,
} from '../services/settings';

/**
 * Settings store — single source of truth for tenant-level settings that the
 * whole dashboard reads from: currency symbol, default tax rate, service
 * charge, brand color. Replaces the hardcoded TAX_RATE / ₹ / #EC1B7C constants.
 */

type State = {
  tenant: TenantSettings | null;
  taxSlabs: TaxSlab[];
  paymentMethods: PaymentMethodConfig[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  AED: 'د.إ',
  GBP: '£',
  SGD: 'S$',
  EUR: '€',
};

const store = createStore<State>({
  tenant: null,
  taxSlabs: [],
  paymentMethods: [],
  loaded: false,
  loading: false,
  error: null,
});

/** Apply branding (brand color CSS var + theme) to the document root. */
function applyBranding(tenant: TenantSettings | null) {
  if (!tenant || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-color', tenant.brandColor);
  root.dataset.brandTheme = tenant.brandTheme;
}

export const settingsStore = {
  use: () => store.use(),
  get: () => store.get(),

  async load(force = false): Promise<void> {
    const cur = store.get();
    if (cur.loaded && !force) return;
    store.set((s) => ({ ...s, loading: true, error: null }));
    try {
      const bundle: SettingsBundle = await settingsApi.getBundle();
      store.set({
        tenant: bundle.tenant,
        taxSlabs: bundle.taxSlabs,
        paymentMethods: bundle.paymentMethods,
        loaded: true,
        loading: false,
        error: null,
      });
      applyBranding(bundle.tenant);
    } catch (err) {
      store.set((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load settings',
      }));
    }
  },

  setTenant(tenant: TenantSettings) {
    store.set((s) => ({ ...s, tenant }));
    applyBranding(tenant);
  },
  setTaxSlabs(taxSlabs: TaxSlab[]) {
    store.set((s) => ({ ...s, taxSlabs }));
  },
  setPaymentMethods(paymentMethods: PaymentMethodConfig[]) {
    store.set((s) => ({ ...s, paymentMethods }));
  },

  /* ---- Derived helpers (read by POS / receipts / lists) ---- */

  currency(): string {
    return store.get().tenant?.currency ?? 'INR';
  },

  currencySymbol(): string {
    const c = this.currency();
    return CURRENCY_SYMBOLS[c] ?? c;
  },

  /** Format a number as money using the tenant's symbol + locale. */
  formatMoney(amount: number): string {
    const sym = this.currencySymbol();
    const locale = store.get().tenant?.numberLocale ?? 'en-IN';
    const n = Number.isFinite(amount) ? amount : 0;
    return `${sym}${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  },

  /** Default tax rate as a fraction (e.g. 0.05). Reads the default slab. */
  defaultTaxRate(): number {
    const { taxSlabs, tenant } = store.get();
    if (tenant?.taxInclusive) return 0;
    const def = taxSlabs.find((s) => s.isDefault) ?? taxSlabs[0];
    return def ? def.rate / 100 : 0;
  },

  /** Service charge rate as a fraction (e.g. 0.05) — 0 when disabled. */
  serviceChargeRate(): number {
    const t = store.get().tenant;
    if (!t?.serviceChargeEnabled) return 0;
    return (t.serviceChargePct ?? 0) / 100;
  },

  roundOffEnabled(): boolean {
    return store.get().tenant?.roundOff ?? false;
  },
};
