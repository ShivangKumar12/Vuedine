import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Plug,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import {
  integrationsApi,
  relativeTime,
  type ApiIntegration,
  type ApiIntegrationStatus,
} from '../../services/integrations';

/* ============================================================ */
/*  Types & data                                                */
/* ============================================================ */

type Category =
  | 'Aggregator'
  | 'Payments'
  | 'Messaging'
  | 'Accounting'
  | 'Reviews'
  | 'Marketing'
  | 'Hardware'
  | 'AI';

type Status = 'Connected' | 'Available' | 'Coming soon';

type CredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  hint?: string;
  copyable?: boolean;
};

type Integration = {
  id: string;
  name: string;
  category: Category;
  desc: string;
  long: string;
  iconBg: string;
  iconText: string;
  status: Status;
  popular?: boolean;
  features: string[];
  fields?: CredentialField[];
  webhookUrl?: string;
  docsUrl?: string;
  lastSync?: string;
};

const integrations: Integration[] = [
  // Aggregators
  {
    id: 'zomato',
    name: 'Zomato',
    category: 'Aggregator',
    desc: 'Sync menu, accept orders, mark items unavailable',
    long: 'Bring every Zomato order directly into your POS. Push menu, prices and item availability automatically. No more switching tabs.',
    iconBg: 'bg-rose-100',
    iconText: '🍴',
    status: 'Connected',
    popular: true,
    lastSync: '2 min ago',
    features: ['Real-time order sync', 'Menu push', 'Item availability sync', 'Settlement reports'],
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', placeholder: 'ZOMATO-12345' },
      { key: 'api_key', label: 'API Key', type: 'password', hint: 'Find in Zomato partner panel' },
    ],
    webhookUrl: 'https://api.vuedine.com/webhooks/zomato/abc123',
  },
  {
    id: 'swiggy',
    name: 'Swiggy',
    category: 'Aggregator',
    desc: 'Receive Swiggy orders directly into POS',
    long: 'Direct Swiggy partner integration with auto-accept, KOT routing and full menu sync.',
    iconBg: 'bg-warm-100',
    iconText: '🛵',
    status: 'Connected',
    popular: true,
    lastSync: '4 min ago',
    features: ['Auto-accept orders', 'Menu sync', 'Item 86 (sold-out) sync', 'Commission tracking'],
    fields: [
      { key: 'partner_id', label: 'Partner ID', placeholder: 'SWG-99812' },
      { key: 'secret', label: 'Secret', type: 'password' },
    ],
    webhookUrl: 'https://api.vuedine.com/webhooks/swiggy/def456',
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    category: 'Aggregator',
    desc: 'Receive orders from Uber Eats and Postmates',
    long: 'Single connection covers Uber Eats and Postmates. Available in select markets.',
    iconBg: 'bg-emerald-100',
    iconText: '🚲',
    status: 'Available',
    features: ['Real-time orders', 'Menu sync', 'Order status updates'],
  },
  {
    id: 'doordash',
    name: 'DoorDash',
    category: 'Aggregator',
    desc: 'DoorDash Drive and Marketplace orders',
    long: 'Connect DoorDash to receive both Marketplace orders and offer DoorDash Drive for your own deliveries.',
    iconBg: 'bg-rose-100',
    iconText: '🛍️',
    status: 'Available',
    features: ['Marketplace orders', 'Drive integration', 'Menu sync'],
  },
  {
    id: 'magicpin',
    name: 'Magicpin',
    category: 'Aggregator',
    desc: 'Magicpin and SaveIN local discovery orders',
    iconBg: 'bg-amber-100',
    iconText: '✨',
    status: 'Available',
    long: 'Local discovery and dine-in deal partner.',
    features: ['Discovery listings', 'Promo sync'],
  },

  // Payments
  {
    id: 'razorpay',
    name: 'Razorpay',
    category: 'Payments',
    desc: 'Primary payment gateway · UPI, cards, wallets',
    long: 'Razorpay is the recommended gateway. UPI auto-capture, card payments, wallets, BNPL and refunds — all in one.',
    iconBg: 'bg-blue-100',
    iconText: '💳',
    status: 'Connected',
    popular: true,
    lastSync: 'Live',
    features: ['UPI · Card · Wallet · BNPL', 'Auto-capture', 'Refunds', 'Settlement reports'],
    fields: [
      { key: 'key_id', label: 'Key ID', placeholder: 'rzp_live_...' },
      { key: 'key_secret', label: 'Key Secret', type: 'password' },
    ],
    webhookUrl: 'https://api.vuedine.com/webhooks/razorpay',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Payments',
    desc: 'Cards and global payment methods',
    long: 'For international markets — Stripe handles cards, ACH, SEPA and 130+ currencies.',
    iconBg: 'bg-violet-100',
    iconText: '🟣',
    status: 'Available',
    features: ['Global cards', 'Apple Pay · Google Pay', 'Multi-currency'],
  },
  {
    id: 'payu',
    name: 'PayU',
    category: 'Payments',
    desc: 'Backup payment gateway',
    iconBg: 'bg-blue-100',
    iconText: '💸',
    status: 'Available',
    long: 'Failover gateway — automatically routes if Razorpay is down.',
    features: ['UPI · Card · Wallet', 'Failover routing', 'Settlement reports'],
  },
  {
    id: 'phonepe',
    name: 'PhonePe Business',
    category: 'Payments',
    desc: 'Direct UPI merchant integration',
    iconBg: 'bg-indigo-100',
    iconText: '📲',
    status: 'Available',
    long: 'Lower transaction fees with PhonePe Business direct integration.',
    features: ['Direct UPI capture', 'Real-time settlements', 'Lower fees'],
  },
  {
    id: 'paytm',
    name: 'Paytm Business',
    category: 'Payments',
    desc: 'Paytm wallet & UPI direct',
    iconBg: 'bg-cool-100',
    iconText: '💰',
    status: 'Available',
    long: 'Direct Paytm Business merchant integration.',
    features: ['Paytm wallet', 'UPI direct', 'Soundbox sync'],
  },

  // Messaging
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    category: 'Messaging',
    desc: 'Send bills, OTPs and order updates',
    long: 'Official WhatsApp Cloud API integration. Send transactional messages for orders, OTPs and bill receipts.',
    iconBg: 'bg-emerald-100',
    iconText: '💬',
    status: 'Connected',
    popular: true,
    lastSync: 'Live',
    features: ['Order updates', 'Bill PDFs', 'OTP delivery', 'Marketing campaigns'],
    fields: [
      { key: 'phone_id', label: 'Phone Number ID', placeholder: '105...' },
      { key: 'access_token', label: 'Access Token', type: 'password' },
    ],
  },
  {
    id: 'msg91',
    name: 'MSG91',
    category: 'Messaging',
    desc: 'Transactional SMS provider',
    long: 'High-deliverability SMS gateway with DLT support for Indian regulations.',
    iconBg: 'bg-cool-100',
    iconText: '📱',
    status: 'Connected',
    lastSync: '12 min ago',
    features: ['DLT-compliant', 'OTP delivery', 'Bulk SMS', 'Delivery receipts'],
    fields: [
      { key: 'auth_key', label: 'Auth Key', type: 'password' },
      { key: 'sender_id', label: 'Sender ID', placeholder: 'VUEDIN' },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'Messaging',
    desc: 'Global SMS and voice',
    iconBg: 'bg-rose-100',
    iconText: '📞',
    status: 'Available',
    long: 'For international SMS and voice OTP delivery.',
    features: ['Global SMS', 'Voice OTP', 'WhatsApp via Twilio'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'Messaging',
    desc: 'Transactional email at scale',
    iconBg: 'bg-blue-100',
    iconText: '✉️',
    status: 'Available',
    long: 'Use SendGrid as your transactional email backend.',
    features: ['Email receipts', 'Bounce handling', 'Email analytics'],
  },

  // Accounting
  {
    id: 'tally',
    name: 'Tally',
    category: 'Accounting',
    desc: 'Daily sales export to Tally',
    long: 'Auto-export daily sales summary, GST and refunds into Tally Prime XML.',
    iconBg: 'bg-blue-100',
    iconText: '📒',
    status: 'Available',
    features: ['Daily auto-sync', 'GST-compliant XML', 'Multi-outlet rollup'],
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    category: 'Accounting',
    desc: 'Cloud accounting for India and global',
    iconBg: 'bg-rose-100',
    iconText: '📚',
    status: 'Available',
    long: 'Sync invoices, expenses, GST and inventory to Zoho Books.',
    features: ['Invoice sync', 'GSTR-1 export', 'Inventory match'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'Accounting',
    desc: 'QuickBooks Online for international markets',
    iconBg: 'bg-emerald-100',
    iconText: '📊',
    status: 'Available',
    long: 'Push sales, expenses and reconciliation to QuickBooks Online.',
    features: ['Sales sync', 'Expense tracking', 'Reconciliation'],
  },

  // Reviews
  {
    id: 'google-reviews',
    name: 'Google Reviews',
    category: 'Reviews',
    desc: 'Auto-request reviews after each visit',
    long: 'Send a Google review request via WhatsApp/SMS after each customer visit. Boost rating & visibility.',
    iconBg: 'bg-amber-100',
    iconText: '⭐',
    status: 'Connected',
    lastSync: '1 hr ago',
    features: ['Auto request after visit', 'Direct review link', 'Rating analytics'],
    fields: [{ key: 'place_id', label: 'Google Place ID', placeholder: 'ChIJ...' }],
  },
  {
    id: 'tripadvisor',
    name: 'TripAdvisor',
    category: 'Reviews',
    desc: 'Listing sync and review monitoring',
    iconBg: 'bg-emerald-100',
    iconText: '🦉',
    status: 'Available',
    long: 'Sync your TripAdvisor listing and pull reviews into Vuedine CRM.',
    features: ['Listing sync', 'Review pull', 'Rating dashboard'],
  },

  // Marketing
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'Marketing',
    desc: 'Sync customer list for newsletters',
    long: 'Sync your CRM contacts, segments and preferences to Mailchimp audiences.',
    iconBg: 'bg-violet-100',
    iconText: '🐵',
    status: 'Available',
    features: ['Customer sync', 'Segment sync', 'Campaign tracking'],
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    category: 'Marketing',
    desc: 'Facebook & Instagram conversion tracking',
    iconBg: 'bg-blue-100',
    iconText: 'ƒ',
    status: 'Available',
    long: 'Forward QR menu and online order conversions to Meta for ad attribution.',
    features: ['Pixel events', 'Conversions API', 'Audience sync'],
  },
  {
    id: 'google-ads',
    name: 'Google Ads',
    category: 'Marketing',
    desc: 'Conversion tracking & remarketing audiences',
    iconBg: 'bg-amber-100',
    iconText: 'G',
    status: 'Available',
    long: 'Send order completion events to Google Ads for ROI measurement.',
    features: ['Enhanced conversions', 'Remarketing audiences'],
  },

  // Hardware
  {
    id: 'epson-printers',
    name: 'Epson Cloud',
    category: 'Hardware',
    desc: 'Cloud-print receipts to any Epson printer',
    long: 'Print to any Epson TM thermal printer over the cloud, with multi-printer routing and automatic failover.',
    iconBg: 'bg-cool-100',
    iconText: '🖨️',
    status: 'Connected',
    lastSync: 'Live',
    features: ['Multi-printer routing', 'Cloud queue', 'Failover'],
  },
  {
    id: 'star-micronics',
    name: 'Star Micronics',
    category: 'Hardware',
    desc: 'Cloud-print to Star printers',
    iconBg: 'bg-emerald-100',
    iconText: '🌟',
    status: 'Available',
    long: 'Connect Star TSP series cloud printers.',
    features: ['Cloud printing', 'Drawer kick', 'Auto-cut'],
  },

  // AI
  {
    id: 'vuedine-ai',
    name: 'Vuedine AI',
    category: 'AI',
    desc: 'AI co-pilot · sales forecasts, insights, ops',
    long: 'Built-in. Forecasts, peak prediction, dish margin alerts and a chat-based co-pilot for owners.',
    iconBg: 'bg-brand-100',
    iconText: '✨',
    status: 'Connected',
    popular: true,
    lastSync: 'Live',
    features: ['Sales forecasting', 'Peak prediction', 'Margin alerts', 'AI chat'],
  },
  {
    id: 'openai',
    name: 'Bring your own OpenAI',
    category: 'AI',
    desc: 'Use your own OpenAI key for custom AI workloads',
    iconBg: 'bg-emerald-100',
    iconText: '🧠',
    status: 'Available',
    long: 'Bring your own OpenAI key to power custom AI workflows like menu copywriting and review responses.',
    features: ['Bring-your-own key', 'Menu copywriting', 'Review reply drafts'],
  },
];

const categories: Category[] = [
  'Aggregator',
  'Payments',
  'Messaging',
  'Accounting',
  'Reviews',
  'Marketing',
  'Hardware',
  'AI',
];

const categoryMeta: Record<Category, { tone: string; icon: string }> = {
  Aggregator: { tone: 'bg-rose-50 text-rose-700 ring-rose-200', icon: '🍴' },
  Payments: { tone: 'bg-blue-50 text-blue-700 ring-blue-200', icon: '💳' },
  Messaging: { tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: '💬' },
  Accounting: { tone: 'bg-violet-50 text-violet-700 ring-violet-200', icon: '📒' },
  Reviews: { tone: 'bg-amber-50 text-amber-700 ring-amber-200', icon: '⭐' },
  Marketing: { tone: 'bg-cool-50 text-cool-700 ring-cool-200', icon: '📣' },
  Hardware: { tone: 'bg-warm-50 text-warm-700 ring-warm-200', icon: '🖨️' },
  AI: { tone: 'bg-brand-50 text-brand-700 ring-brand-200', icon: '✨' },
};

/* ============================================================ */
/*  Live-state merge (catalog presentation + API connection)    */
/* ============================================================ */

type Live = Integration & {
  connected: boolean;
  supportsSync: boolean;
  supportsTest: boolean;
  connectedFields: string[];
  lastError: string | null;
};

function mapApiStatus(s: ApiIntegrationStatus): Status {
  if (s === 'CONNECTED') return 'Connected';
  if (s === 'COMING_SOON') return 'Coming soon';
  return 'Available'; // AVAILABLE + ERROR both render as connectable
}

function mergeLive(it: Integration, apiItem?: ApiIntegration): Live {
  if (!apiItem) {
    return {
      ...it,
      connected: it.status === 'Connected',
      supportsSync: false,
      supportsTest: !!it.fields?.length,
      connectedFields: [],
      lastError: null,
    };
  }
  return {
    ...it,
    status: mapApiStatus(apiItem.status),
    lastSync: relativeTime(apiItem.lastSyncAt) ?? undefined,
    webhookUrl: apiItem.webhookUrl ?? it.webhookUrl,
    connected: apiItem.connected,
    supportsSync: apiItem.supportsSync,
    supportsTest: apiItem.supportsTest,
    connectedFields: apiItem.connectedFields,
    lastError: apiItem.lastError,
  };
}

/* ============================================================ */
/*  Page                                                        */
/* ============================================================ */

export default function Integrations() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');
  const [status, setStatus] = useState<'All' | Status>('All');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [apiMap, setApiMap] = useState<Map<string, ApiIntegration>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await integrationsApi.list();
      setApiMap(new Map(list.map((i) => [i.provider, i])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const merged = useMemo<Live[]>(
    () => integrations.map((it) => mergeLive(it, apiMap.get(it.id))),
    [apiMap],
  );

  const active = useMemo(() => merged.find((m) => m.id === activeId) ?? null, [merged, activeId]);

  const filtered = useMemo(() => {
    return merged.filter((it) => {
      if (showInstalledOnly && it.status !== 'Connected') return false;
      if (category !== 'All' && it.category !== category) return false;
      if (status !== 'All' && it.status !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !it.name.toLowerCase().includes(s) &&
          !it.desc.toLowerCase().includes(s) &&
          !it.category.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [merged, search, category, status, showInstalledOnly]);

  const stats = useMemo(() => {
    return {
      total: merged.length,
      connected: merged.filter((i) => i.status === 'Connected').length,
      popular: merged.filter((i) => i.popular).length,
      categories: categories.length,
    };
  }, [merged]);

  const popularList = merged.filter((i) => i.popular).slice(0, 4);
  const connectedList = merged.filter((i) => i.status === 'Connected');

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setStatus('All');
    setShowInstalledOnly(false);
  };
  const activeFilters =
    Number(search.length > 0) +
    Number(category !== 'All') +
    Number(status !== 'All') +
    Number(showInstalledOnly);

  return (
    <>
      <div className="space-y-6">
        <Breadcrumb />

        {/* Hero */}
        <Hero stats={stats} />

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <span>{error}</span>
            <button
              onClick={() => void refetch()}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}
        {loading && apiMap.size === 0 && (
          <div className="rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-500">
            Loading marketplace…
          </div>
        )}

        {/* Connected strip */}
        {connectedList.length > 0 && (
          <ConnectedStrip
            list={connectedList}
            onView={(it) => setActiveId(it.id)}
          />
        )}

        {/* Popular */}
        <section>
          <SectionHead
            title="Popular this week"
            subtitle="What every Vuedine restaurant connects first"
            icon={Sparkles}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularList.map((it, i) => (
              <PopularCard key={it.id} integration={it} index={i} onView={() => setActiveId(it.id)} />
            ))}
          </div>
        </section>

        {/* Browse */}
        <section className="space-y-4">
          <SectionHead
            title="All integrations"
            subtitle="Search the full marketplace"
            icon={Plug}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <SearchBox value={search} onChange={setSearch} />
                <FilterMenu
                  status={status}
                  setStatus={setStatus}
                  showInstalledOnly={showInstalledOnly}
                  setShowInstalledOnly={setShowInstalledOnly}
                />
                {activeFilters > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-600"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    Clear · {activeFilters}
                  </button>
                )}
              </div>
            }
          />

          {/* Category strip */}
          <CategoryStrip value={category} onChange={setCategory} />

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState onReset={clearFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((it, i) => (
                <IntegrationCard
                  key={it.id}
                  integration={it}
                  index={i}
                  onView={() => setActiveId(it.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <IntegrationDrawer integration={active} onClose={() => setActiveId(null)} onChanged={refetch} />
    </>
  );
}

/* ============================================================ */
/*  Hero                                                        */
/* ============================================================ */

function Hero({ stats }: { stats: { total: number; connected: number; popular: number; categories: number } }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-rose-50 to-warm-50 p-6 shadow-sm sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-brand-200/60 to-warm-200/60 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-brand-700">
            <Plug className="h-3 w-3" />
            Marketplace
          </span>
          <h1 className="display mt-3 text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">
            Connect every tool your <span className="gradient-text-warm">restaurant runs on.</span>
          </h1>
          <p className="mt-2 max-w-lg text-[14px] text-ink-600">
            Aggregators, payments, messaging, accounting, hardware and AI — all in one place. One-click connect, instant sync.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Connected" value={stats.connected} accent="text-emerald-600" />
          <Stat label="Available" value={stats.total - stats.connected} accent="text-brand-600" />
          <Stat label="Popular" value={stats.popular} accent="text-amber-600" />
          <Stat label="Categories" value={stats.categories} accent="text-cool-600" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/80 px-3 py-2 text-center shadow-sm backdrop-blur">
      <div className={cn('text-2xl font-extrabold', accent)}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
    </div>
  );
}

/* ============================================================ */
/*  Connected strip                                             */
/* ============================================================ */

function ConnectedStrip({
  list,
  onView,
}: {
  list: Integration[];
  onView: (it: Integration) => void;
}) {
  return (
    <section>
      <SectionHead
        title={`Your apps · ${list.length} connected`}
        subtitle="Quick access to everything that's live"
        icon={CheckCircle2}
      />
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {list.map((it) => (
          <button
            key={it.id}
            onClick={() => onView(it)}
            className="group flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 pr-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            style={{ minWidth: 240 }}
          >
            <span
              className={cn(
                'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ring-1 ring-ink-100',
                it.iconBg,
              )}
            >
              {it.iconText}
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                <Check className="h-2.5 w-2.5" strokeWidth={4} />
              </span>
            </span>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13px] font-extrabold text-ink-900">{it.name}</div>
              <div className="text-[11px] text-ink-500">
                {it.lastSync ? `Synced ${it.lastSync}` : 'Connected'}
              </div>
            </div>
            <Settings className="h-4 w-4 text-ink-400 transition group-hover:text-brand-600" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/*  Section header                                              */
/* ============================================================ */

function SectionHead({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100">
          <Icon className="h-4 w-4 text-brand-600" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">{title}</h2>
          {subtitle && <p className="text-[12px] text-ink-600">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

/* ============================================================ */
/*  Category strip                                              */
/* ============================================================ */

function CategoryStrip({
  value,
  onChange,
}: {
  value: 'All' | Category;
  onChange: (v: 'All' | Category) => void;
}) {
  const counts: Record<string, number> = { All: integrations.length };
  categories.forEach((c) => {
    counts[c] = integrations.filter((i) => i.category === c).length;
  });

  const list: ('All' | Category)[] = ['All', ...categories];

  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {list.map((c) => {
        const active = value === c;
        const meta = c === 'All' ? null : categoryMeta[c];
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:text-brand-700',
            )}
          >
            {meta && <span>{meta.icon}</span>}
            {c}
            <span
              className={cn(
                'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600',
              )}
            >
              {counts[c]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ */
/*  Cards                                                       */
/* ============================================================ */

function PopularCard({
  integration,
  index,
  onView,
}: {
  integration: Integration;
  index: number;
  onView: () => void;
}) {
  return (
    <motion.button
      onClick={onView}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-brand-100/60 to-warm-100/60 blur-2xl"
      />
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl text-xl ring-1 ring-ink-100',
            integration.iconBg,
          )}
        >
          {integration.iconText}
        </span>
        <StatusPill status={integration.status} />
      </div>
      <div className="mt-3 text-[14px] font-extrabold text-ink-900">{integration.name}</div>
      <div className="mt-0.5 text-[12px] font-bold uppercase tracking-wider text-ink-400">
        {integration.category}
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] text-ink-600">{integration.desc}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 transition group-hover:gap-2">
        {integration.status === 'Connected' ? 'Manage' : 'View'}
        <ArrowRight className="h-3 w-3" />
      </div>
    </motion.button>
  );
}

function IntegrationCard({
  integration,
  index,
  onView,
}: {
  integration: Integration;
  index: number;
  onView: () => void;
}) {
  return (
    <motion.button
      onClick={onView}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ring-1 ring-ink-100',
            integration.iconBg,
          )}
        >
          {integration.iconText}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-extrabold text-ink-900">
              {integration.name}
            </span>
            {integration.popular && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                <Sparkles className="h-2.5 w-2.5" />
                Popular
              </span>
            )}
          </div>
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
              categoryMeta[integration.category].tone,
            )}
          >
            {categoryMeta[integration.category].icon}
            {integration.category}
          </span>
          <p className="mt-2 line-clamp-2 text-[12px] text-ink-600">{integration.desc}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
        <StatusPill status={integration.status} />
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 transition group-hover:gap-2">
          {integration.status === 'Connected' ? 'Manage' : integration.status === 'Coming soon' ? 'Notify me' : 'Connect'}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </motion.button>
  );
}

/* ============================================================ */
/*  Pills                                                       */
/* ============================================================ */

function StatusPill({ status }: { status: Status }) {
  const meta = {
    Connected: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    Available: { pill: 'bg-ink-100 text-ink-600 ring-ink-200', dot: 'bg-ink-400' },
    'Coming soon': { pill: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  }[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
        meta.pill,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {status}
    </span>
  );
}

/* ============================================================ */
/*  Header controls                                             */
/* ============================================================ */

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
      <Link to="/dashboard" className="transition hover:text-brand-600">
        Dashboard
      </Link>
      <span className="text-ink-300">/</span>
      <span className="text-ink-900">Integrations</span>
    </nav>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        placeholder="Search by name or category…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 transition focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
      />
    </div>
  );
}

function FilterMenu({
  status,
  setStatus,
  showInstalledOnly,
  setShowInstalledOnly,
}: {
  status: 'All' | Status;
  setStatus: (v: 'All' | Status) => void;
  showInstalledOnly: boolean;
  setShowInstalledOnly: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-bold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-40 mt-2 w-64 space-y-3 rounded-xl border border-ink-200 bg-white p-3 shadow-2xl shadow-black/10"
            >
              <div>
                <div className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Status
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['All', 'Connected', 'Available', 'Coming soon'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                        status === s
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-200',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50/40 p-2.5">
                <span className="text-[12px] font-bold text-ink-800">Installed only</span>
                <input
                  type="checkbox"
                  checked={showInstalledOnly}
                  onChange={(e) => setShowInstalledOnly(e.target.checked)}
                  className="h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-white transition checked:border-brand-500 checked:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/40"
                />
              </label>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-100">
        <Search className="h-5 w-5 text-brand-500" />
      </div>
      <div className="mt-3 text-base font-bold text-ink-900">No integrations match</div>
      <div className="mt-1 text-sm text-ink-500">Try a different search or category.</div>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-brand-300 hover:text-brand-700"
      >
        <RefreshCcw className="h-3 w-3" />
        Reset filters
      </button>
    </div>
  );
}

/* ============================================================ */
/*  Drawer                                                      */
/* ============================================================ */

function IntegrationDrawer({
  integration,
  onClose,
  onChanged,
}: {
  integration: Live | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const provider = integration?.id ?? '';

  useEffect(() => {
    setForm({});
    setMsg(null);
    setShowSecret({});
  }, [provider]);

  const canDisconnect = !!integration?.connected && (integration?.fields?.length ?? 0) > 0;

  async function run(action: string, fn: () => Promise<unknown>, okText?: string) {
    setBusy(action);
    setMsg(null);
    try {
      await fn();
      if (okText) setMsg({ kind: 'ok', text: okText });
      await onChanged();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  }

  const handleConnect = () => {
    if (!integration) return;
    const missing = (integration.fields ?? []).filter((f) => !form[f.key]?.trim());
    if (missing.length > 0) {
      setMsg({ kind: 'err', text: `Enter: ${missing.map((f) => f.label).join(', ')}` });
      return;
    }
    void run('connect', async () => {
      await integrationsApi.connect(provider, form);
      setForm({});
    }, `${integration.name} connected`);
  };

  const handleDisconnect = () =>
    run('disconnect', () => integrationsApi.disconnect(provider), `${integration?.name} disconnected`);

  const handleTest = () =>
    run('test', async () => {
      const r = await integrationsApi.test(provider);
      setMsg({ kind: 'ok', text: r.message });
    });

  const handleSync = () =>
    run('sync', async () => {
      const r = await integrationsApi.sync(provider);
      setMsg({ kind: 'ok', text: r.message });
    });

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <AnimatePresence>
      {integration && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-brand-500 via-rose-500 to-warm-500 p-6 text-white">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl text-xl ring-2 ring-white/30',
                    integration.iconBg,
                  )}
                >
                  {integration.iconText}
                </span>
                <div>
                  <div className="text-2xl font-extrabold">{integration.name}</div>
                  <div className="mt-0.5 text-[12px] font-bold uppercase tracking-widest text-white/85">
                    {integration.category}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">{integration.long}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-bold">
                {integration.status === 'Connected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-white">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                )}
                {integration.status === 'Available' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                    Available
                  </span>
                )}
                {integration.status === 'Coming soon' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5">
                    Coming soon
                  </span>
                )}
                {integration.lastSync && integration.status === 'Connected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
                    Last sync · {integration.lastSync}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-5 p-6">
              {/* Features */}
              <Section title="What you get">
                <ul className="grid grid-cols-1 gap-1.5">
                  {integration.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white p-2.5 text-[13px] font-semibold text-ink-800"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Credentials */}
              {integration.fields && integration.fields.length > 0 && (
                <Section title="Credentials">
                  <div className="space-y-3">
                    {integration.fields.map((f) => {
                      const isSecret = f.type === 'password';
                      const visible = showSecret[f.key];
                      const isSet = integration.connectedFields.includes(f.key);
                      return (
                        <div key={f.key}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-[12px] font-bold text-ink-800">{f.label}</label>
                            {isSet ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                <Check className="h-3 w-3" strokeWidth={3} /> Saved
                              </span>
                            ) : (
                              f.hint && <span className="text-[10px] text-ink-500">{f.hint}</span>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type={isSecret && !visible ? 'password' : 'text'}
                              value={form[f.key] ?? ''}
                              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                              placeholder={isSet ? '•••••••••• (saved — re-enter to replace)' : f.placeholder ?? ''}
                              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 pr-10 text-[13px] font-medium text-ink-900 placeholder:text-ink-400 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                            />
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => setShowSecret((s) => ({ ...s, [f.key]: !s[f.key] }))}
                                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                              >
                                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Webhook */}
              {integration.webhookUrl && (
                <Section title="Webhook URL" subtitle="Add this to the partner dashboard for real-time events">
                  <div className="relative">
                    <input
                      readOnly
                      value={integration.webhookUrl}
                      className="h-10 w-full rounded-xl border border-ink-200 bg-ink-50/40 px-3 pr-10 font-mono text-[12px] font-medium text-ink-900 shadow-sm"
                    />
                    <button
                      type="button"
                      aria-label="Copy"
                      onClick={() => copy('webhook', integration.webhookUrl ?? '')}
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      {copied === 'webhook' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </Section>
              )}

              {/* Permissions */}
              <Section title="Permissions">
                <ul className="space-y-1.5">
                  {[
                    { label: 'Read your menu items', icon: Eye },
                    { label: 'Read & write orders', icon: Zap },
                    { label: 'Update item availability', icon: TrendingUp },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <li
                        key={p.label}
                        className="flex items-center gap-2.5 rounded-xl border border-ink-100 bg-white p-2.5 text-[13px] font-semibold text-ink-800"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cool-50 text-cool-600 ring-1 ring-cool-100">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {p.label}
                      </li>
                    );
                  })}
                </ul>
              </Section>

              {/* Privacy */}
              <div className="flex items-start gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                <p className="text-[11px] text-ink-600">
                  Credentials are encrypted with AES-256 at rest. Vuedine can disconnect this app at any
                  time without losing your data.
                </p>
              </div>

              {/* Last error (if the provider reported one) */}
              {integration.lastError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-semibold text-rose-700">
                  Last error: {integration.lastError}
                </div>
              )}

              {/* Action result */}
              {msg && (
                <div
                  className={cn(
                    'rounded-xl border p-3 text-[12px] font-semibold',
                    msg.kind === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700',
                  )}
                >
                  {msg.text}
                </div>
              )}

              {/* Connected actions */}
              {integration.connected && (integration.supportsTest || integration.supportsSync) && (
                <div className="flex flex-wrap gap-2">
                  {integration.supportsTest && (
                    <button
                      onClick={handleTest}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {busy === 'test' ? 'Testing…' : 'Test connection'}
                    </button>
                  )}
                  {integration.supportsSync && (
                    <button
                      onClick={handleSync}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-[13px] font-bold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                    >
                      <RefreshCcw className={cn('h-3.5 w-3.5', busy === 'sync' && 'animate-spin')} />
                      {busy === 'sync' ? 'Syncing…' : 'Sync now'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-ink-100 bg-white p-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-bold text-ink-700 transition hover:border-ink-300"
              >
                Close
              </button>
              {canDisconnect ? (
                <button
                  onClick={handleDisconnect}
                  disabled={busy !== null}
                  className="rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-600 disabled:opacity-50"
                >
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : integration.status === 'Coming soon' ? (
                <button
                  onClick={() => setMsg({ kind: 'ok', text: "We'll email you when this launches." })}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  Notify me
                </button>
              ) : integration.connected ? (
                <button
                  onClick={onClose}
                  className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold"
                >
                  Done
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={busy !== null}
                  className="btn-primary shine inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {busy === 'connect' ? 'Connecting…' : 'Connect'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-widest text-ink-500">{title}</h3>
      {subtitle && <p className="mb-2 text-[12px] text-ink-500">{subtitle}</p>}
      {children}
    </section>
  );
}
