# Vuedine — Product Roadmap (Backend)

> Companion to `BACKEND_PHASES.md`. That doc built the **platform** (auth,
> infra, security, observability, CI/CD, OpenAPI). This one builds the
> **product** — the actual restaurant-POS domain that the dashboard sidebar
> promises.
>
> Every phase here clones the pattern Phase 5 (Items) demonstrated:
> Prisma model → repository → service → controller → routes → zod
> validators → tests → OpenAPI annotations → cache wiring → audit log
> → real-time events where appropriate.
>
> The frontend is **the contract**. Field names, enum values, and shapes
> below are quoted verbatim from the React code so the API matches the UI
> exactly. Drift is a regression.

---

## Status overview

**Done (Phases 0–13)** — platform layer:
Auth + RBAC + audit, multi-tenant Prisma schema (Tenant, Branch, User,
Session, AuditLog, ApiKey), tenant-scoped repository pattern, Redis cache

- rate limiting + sliding window, BullMQ queues (email, notification,
  report, webhook, dlq) with one consumer wired (email), Items module end-to-end,
  socket.io fan-out, observability, Docker, CI/CD, OpenAPI.

**Pending — product layer:** **Phases A–L**, defined in this document.

**Critical-path-only for an MVP launch:** A + B + C + E + F + G + I.
Everything else is high-value but can ship after first paying customers.

---

## How to read each phase

Each phase block contains the same skeleton (no exceptions, even when a
section is short — keeps reviews predictable):

- **📌 Goal** — one paragraph, no jargon.
- **📐 Frontend contract** — exact files / interfaces / mock data the API
  has to match. Drift hurts.
- **🗄 Domain model** — Prisma models with full field list, indexes,
  relations, soft-delete strategy, multi-tenancy notes.
- **🔌 API surface** — every endpoint with method, path, auth/scope, zod
  shape, response shape, status codes.
- **📡 Real-time events** — socket.io rooms + event names + payload shape.
- **⏰ Async work** — BullMQ jobs the module enqueues or consumes.
- **🗃 Cache strategy** — what's cached, the prefix, the TTL, how
  invalidation works.
- **🔒 Permissions** — RBAC matrix per endpoint / scope on API-key path.
- **🧪 Tests** — unit + integration coverage required before declaring done.
- **✅ Acceptance** — checklist of behaviors that must pass end-to-end.
- **⚠️ Pitfalls** — the bugs every team hits in this domain. Documented so
  we skip them.

---

## Frontend audit — exhaustive findings

Read this section carefully. Every entry below is a **backend obligation**
the dashboard already has UI for. Anything the UI mocks today, the API
needs to power tomorrow.

### Sidebar inventory

| #   | Module             | Route                      | Frontend file           | Status       |
| --- | ------------------ | -------------------------- | ----------------------- | ------------ |
| 1   | Dashboard (KPIs)   | `/dashboard`               | `Dashboard.tsx`         | mock-data    |
| 2   | Items              | `/dashboard/items`         | `Items.tsx`             | wired ✅     |
| 3   | Dining Tables      | `/dashboard/tables`        | `Tables.tsx`            | mock-data    |
| 4   | POS                | `/dashboard/pos`           | `POS.tsx`               | mock-data    |
| 5   | Live Orders        | `/dashboard/live-orders`   | `LiveOrders.tsx`        | localStorage |
| 6   | POS Orders         | `/dashboard/pos-orders`    | `POSOrders.tsx`         | mock-data    |
| 7   | Online Orders      | `/dashboard/online-orders` | `OnlineOrders.tsx`      | mock-data    |
| 8   | Table Orders       | `/dashboard/table-orders`  | `TableOrders.tsx`       | mock-data    |
| 9   | KDS                | `/dashboard/kds`           | `KDS.tsx`               | mock-data    |
| 10  | OSS                | `/dashboard/oss`           | `OSS.tsx`               | mock-data    |
| 11  | Coupons            | `/dashboard/coupons`       | `Coupons.tsx`           | mock-data    |
| 12  | Offers             | `/dashboard/offers`        | `Offers.tsx`            | mock-data    |
| 13  | Push Notifications | `/dashboard/push`          | `PushNotifications.tsx` | mock-data    |
| 14  | Messages           | `/dashboard/messages`      | `Messages.tsx`          | mock-data    |
| 15  | Subscribers        | `/dashboard/subscribers`   | `Subscribers.tsx`       | mock-data    |
| 16  | All Users          | `/dashboard/users`         | `AllUsers.tsx`          | mock-data    |
| 17  | User Roles         | `/dashboard/roles`         | `UserRoles.tsx`         | mock-data    |
| 18  | Transactions       | `/dashboard/transactions`  | `Transactions.tsx`      | mock-data    |
| 19  | Subscription       | `/dashboard/subscription`  | `Subscription.tsx`      | mock-data    |
| 20  | Sales Report       | `/dashboard/reports/sales` | `SalesReport.tsx`       | mock-data    |
| 21  | QR Codes           | `/dashboard/qr-codes`      | `QRCodes.tsx`           | mock-data    |
| 22  | Integrations       | `/dashboard/integrations`  | `Integrations.tsx`      | mock-data    |
| 23  | Settings           | `/dashboard/settings`      | `Settings.tsx`          | mock-data    |

Plus the **customer-facing PWA** (also fully built, runs on `localStorage`):

| Page                 | Route                        | File                      |
| -------------------- | ---------------------------- | ------------------------- |
| Guest Menu           | `/m/:branch/:table`          | `guest/Menu.tsx`          |
| Guest Checkout       | `/m/:branch/:table/checkout` | `guest/Checkout.tsx`      |
| Guest Order Tracking | `/m/:branch/order/:orderId`  | `guest/OrderTracking.tsx` |

And the topbar carries a **branch selector**, **notification bell with
counter**, **language switcher**, **AI Helper FAB**, plus a **demo data
reset banner** that disappears in "live mode".

### Per-module deep dive

#### 1. Dashboard (KPIs landing page) — `Dashboard.tsx`

Renders 18 distinct metric cards. Every one is an aggregation:

- **Top KPI grid (4)**: Total Sales (₹), Total Orders, Total Customers,
  Total Menu Items — each with month-over-month delta percent.
- **Order Statistics (8)**: counts of Pending / Accepted / Preparing /
  Prepared / Out for Delivery / Delivered / Cancelled (matches
  `Order.status` enum across pages).
- **Sales Summary**: 14-bar daily-revenue chart (configurable date range),
  total sales + avg/day side cards.
- **Orders Summary**: Delivered / Returned / Cancelled / Rejected
  percentage rows.
- **Customer Stats**: New / Returning / Inactive over a sparkline.
- **Top Customers**: top-5 by 30-day spend (rank + spend + order count).
- **Featured Items** + **Most Popular Items**: carousels driven by
  curated tags + sales-volume aggregations.

Backend obligations: **aggregation endpoints by date range + branch**,
fast paths for totals/percent-deltas, plus the curated "featured" toggle on
items (already in schema as `bestseller: Boolean` — extend).

#### 2. Items — `Items.tsx` ✅ wired

Already covered by Phase 5. UI also implies (not yet built):

- **Bulk actions** — Mark Active / Mark Sold-out / Change category / Archive.
- **Import** — CSV, Excel, Petpooja, Square POS.
- **Export** — CSV, Excel, PDF, JSON.

These translate to `POST /v1/items:bulk` and `POST /v1/items:import` /
`GET /v1/items:export?format=csv`.

#### 3. Tables — `Tables.tsx`

```ts
type Status = "Free" | "Occupied" | "Reserved" | "Cleaning" | "Bill";
type Shape = "round" | "square" | "rect";

type DiningTable = {
  id: number;
  name: string; // 'Table 1', 'Bar 1', 'Takeaway'
  section: string; // 'Indoor · Window', 'Outdoor · Patio', 'Terrace', 'Counter'
  size: number; // seat count, 0 for counter
  shape: Shape;
  status: Status;
  active: boolean;
  occupiedFor?: number; // minutes since seated
  currentBill?: number; // running total
  guestName?: string; // for occupied/reserved/bill
};
```

Two views: **floor plan** (grouped by section, animated cards with
running pulse on Occupied) and **list** (paginated). Modals for **per-table
QR view** (uses `qrcode.react`) and **bulk QR print**. Floor-plan is
real-time (no `liveOrders.ts` hook, but topbar branch selector implies
multi-branch state is per-page).

Backend obligations:

- `Table` model with section, shape, capacity, branch FK, soft-delete.
- Status state machine driven by orders module (Phase B).
- `DiningSection` (or just a free-text `section` string with a tenant-level
  list).
- Per-table QR token mint (Phase G ties in here — table.qrToken column).
- Reservation linkage (introduced in Phase F when reservations land — for
  now `Reserved` status is set manually by waiter UI).

#### 4. POS — `POS.tsx`

The POS module is the operational heart of the dashboard. Long file (~1000+
lines). What it does:

- **Menu side**: search, category strip (14 categories: All, Appetizers,
  Pizza, Burgers, Pasta, Sushi, Salads, Indian, Asian, Mains, Desserts,
  Beverages, Wines, Cocktails), grid of item cards with bestseller +
  veg/non-veg dots and inline qty stepper.
- **Cart side**: customer select (Walking Customer / +Add Customer modal),
  token number (auto-generated `TKN-####`), order type tabs
  (`Dine-In | Takeaway | Delivery`), table picker (when Dine-In), per-line
  qty controls with remove, discount % input, totals breakdown
  (subtotal, discount, tax 5%, total), Clear / Save / Place Order CTAs.
- **Mobile cart bar** + **Summary modal** with full bill preview.

Type-level evidence the API needs:

```ts
type CartLine    = { itemId: number; qty: number; };
type OrderType   = 'Dine-In' | 'Takeaway' | 'Delivery';
const TAX_RATE   = 0.05;
const TABLES     = ['Table 1', ..., 'Table 12'];   // hardcoded — must come from API
```

Backend obligations: cart calculation endpoint (server-side total — the
client computing tax is a security anti-pattern; coupons + offers + tip +
service charge all need server math), order placement endpoint, kitchen
ticket emission (socket fan-out + KDS module), token sequence per
branch + day.

#### 5. Live Orders — `LiveOrders.tsx`

Today: subscribes to `useLiveOrders()` (the `localStorage`-backed bus in
`lib/liveOrders.ts`). Renders cards by status with status pills, pulse
indicator, age timer (re-renders every second), bell sound on incoming,
auto-accept toggle, mute toggle, fullscreen, search.

Status enum on the bus:

```ts
type LiveOrderStatus =
  | "New"
  | "Accepted"
  | "Preparing"
  | "Ready"
  | "Served"
  | "Cancelled";
```

Sidebar badge counts non-Served, non-Cancelled — i.e. active operational
load.

The shape of `LiveOrder`:

```ts
type LiveOrder = {
  id: string;
  token: string; // e.g. 'TKN-1284'
  branch: string;
  table: string;
  receivedAt: number; // ms epoch
  channel: "QR"; // currently only QR; will expand to POS / Online / Waiter
  items: LiveOrderItem[];
  subtotal: number;
  tax: number;
  service: number;
  tip: number;
  total: number;
  payMode: "pay-at-counter" | "pay-now-upi" | "pay-now-card";
  guestName?: string;
  phone?: string;
  status: LiveOrderStatus;
};

type LiveOrderItem = {
  id: number;
  name: string;
  emoji: string;
  qty: number;
  unitPrice: number;
  variantLabel?: string;
  addons?: string[];
  notes?: string;
};
```

Backend obligation: replace the `localStorage` bus with a socket.io stream
of `liveOrder:created`, `liveOrder:status`, `liveOrder:cancelled` events
emitted from the orders module. Persist orders in DB; the socket payload
is a denormalized snapshot for the dashboard.

#### 6. POS Orders — `POSOrders.tsx`

Filter + paginate historical POS orders. Filters: search (id + customer
name), order type, status, channel (`POS | Waiter | QR | Online`), payment
method (`Cash | Card | UPI | Wallet | Online`), date range, page size.

```ts
type Order = {
  id: string;
  type: "Dine-In" | "Takeaway" | "Delivery" | "QR";
  customer: string;
  customerPhone?: string;
  table?: string;
  amount: number;
  date: string;
  iso: string;
  status:
    | "Pending"
    | "Accepted"
    | "Preparing"
    | "Prepared"
    | "Out for Delivery"
    | "Delivered"
    | "Cancelled";
  channel: "POS" | "Waiter" | "QR" | "Online";
  payment: "Cash" | "Card" | "UPI" | "Wallet" | "Online";
  items: number; // count
};
```

Bulk actions, drawer for full order detail, KPI strip (revenue / completed
/ in-progress / cancelled).

#### 7. Online Orders — `OnlineOrders.tsx`

```ts
type Source = 'Zomato' | 'Swiggy' | 'Vuedine Direct' | 'WhatsApp' | 'QR Pay';
type Mode   = 'Delivery' | 'Pickup';
type Status = 'New' | 'Accepted' | 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
type PayStatus = 'Paid' | 'Pay on delivery' | 'Failed' | 'Refunded';

type OnlineOrder = {
  ...Order...
  source: Source; mode: Mode; pay: PayStatus;
  address: string; area: string;
  prepMinutes: number; etaMinutes: number;
  driver?: string; driverPhone?: string;
  isLate?: boolean;       // SLA breach flag
};
```

Implies: external aggregator integrations (Zomato/Swiggy/etc.) writing in
via webhooks; ETA calculation (prep + drive time); driver assignment.

#### 8. Table Orders — `TableOrders.tsx`

A "live floor running totals" view — every active dine-in table showing
multiple rounds (each round = the dishes ordered together).

```ts
type Round = {
  id: string;
  at: string;
  items: { name: string; emoji: string; qty: number; price: number }[];
};
type TableOrder = {
  id: string; // 'TBL-1841'
  table: string;
  section: string;
  guests: number;
  channel: "Waiter" | "QR" | "POS";
  waiter?: string;
  guestName?: string;
  startedAt: string;
  durationMin: number;
  status: "Open" | "Preparing" | "Served" | "Awaiting payment";
  rounds: Round[];
  tags?: string[]; // 'Birthday', 'VIP'
};
```

Implies: orders carry a `roundId` so multiple add-on orders within one
table session aggregate; the table session itself is a parent entity
(`TableSession`) with `closedAt` set when payment lands.

#### 9. KDS — `KDS.tsx`

Kitchen Display System. Drives prep behavior:

```ts
type Channel = "Dine-In" | "Online" | "Takeaway";
type State = "Confirmed" | "Preparing" | "Done";
type Priority = "Normal" | "Rush";
type Station = "Hot" | "Cold" | "Bar" | "Dessert";

type LineItem = {
  id: string;
  name: string;
  emoji: string;
  qty: number;
  station: Station;
  notes?: string;
  prepared?: boolean;
};
type Ticket = {
  id: string;
  channel: Channel;
  state: State;
  priority: Priority;
  table?: string;
  guest?: string;
  waiter?: string;
  source?: string;
  receivedAt: number;
  items: LineItem[];
};
```

Implies: every `Item` has a `station` field (or recipe-level routing in
later phases); KDS subscribes to socket events; mutating a single line's
`prepared` flag is a separate API call from advancing the whole ticket
state.

#### 10. OSS (Order Status Screen) — `OSS.tsx`

Customer-facing "your order is X" board. Two columns: Preparing, Ready.
Token-only display (no PII). Auto-rotates oldest ready out after 8s.
Synthesized bell on new ready.

Implies: a public-ish, branch-scoped read endpoint with token + state
only (no addresses, no phone numbers). Authenticated only via a per-screen
device token (Phase J / hardware integration).

#### 11. Coupons — `Coupons.tsx`

```ts
type CouponKind = "Percentage" | "Flat" | "BOGO" | "Free Item";
type CouponStatus = "Active" | "Scheduled" | "Paused" | "Expired";
type Channel = "POS" | "QR" | "Online" | "All";

type Coupon = {
  id: string;
  code: string;
  title: string;
  kind: CouponKind;
  value: number;
  minOrder: number;
  maxDiscount?: number;
  status: CouponStatus;
  channel: Channel;
  startsAt: string;
  endsAt: string;
  usageLimit: number;
  used: number;
  perUser: number;
  description?: string;
};
```

Toggle-pause, drawer detail, edit modal, exhaustive validators on the
modal (date order, value range, max-discount only when kind=Percentage,
etc). Conversion KPI (avg utilisation) implies ratio calculations.
**Auto-applied** birthday coupon implies a customer-event-trigger system.

#### 12. Offers — `Offers.tsx`

```ts
type OfferKind = "Happy Hour" | "Combo" | "Festival" | "Loyalty" | "Featured";
type OfferStatus = "Live" | "Scheduled" | "Paused" | "Ended";
type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type Offer = {
  id: string;
  title: string;
  emoji: string;
  hero: string;
  kind: OfferKind;
  status: OfferStatus;
  discount: string; // human-readable display
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string; // HH:MM
  days: Day[];
  channels: string[];
  redemptions: number;
  revenue: number;
  description: string;
};
```

Different from Coupons in that Offers are **time-window driven** (Happy
Hour 5–7 PM weekdays) and **bundle-typed** (Combo = price-fixed group
purchase). Backend obligation: a unified `Promotion` model with a
discriminator on kind, plus a `PromotionRule` set the cart engine
evaluates at check-out.

#### 13. Push Notifications — `PushNotifications.tsx`

```ts
type PushStatus = "Sent" | "Scheduled" | "Draft" | "Failed";
type Audience =
  | "All subscribers"
  | "New customers"
  | "Loyal diners"
  | "Lapsed"
  | "VIP"
  | "Custom segment";

type PushCampaign = {
  id: string;
  title: string;
  body: string;
  imageEmoji?: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: Audience;
  audienceSize: number;
  status: PushStatus;
  scheduledFor?: string;
  sentAt?: string;
  delivered: number;
  opened: number;
  clicked: number;
};
```

CTR calculated client-side from `clicked / delivered`. Implies:

- A `NotificationCampaign` model
- Audience evaluator (segment rule engine — see Subscribers below)
- BullMQ `notification` queue (already exists in Phase 6 — needs a
  consumer that pushes to FCM/APNS/web push)
- Per-recipient `delivered`, `opened`, `clicked` events tracked back to
  the campaign

#### 14. Messages — `Messages.tsx`

Two-pane WhatsApp-style inbox.

```ts
type Channel = "whatsapp" | "sms" | "instagram" | "webchat";
type Status = "open" | "pending" | "resolved";
type Sender = "customer" | "agent" | "bot";

type Message = {
  id: string;
  sender: Sender;
  body: string;
  at: string;
  read?: boolean;
};
type Conversation = {
  id: string;
  customer: string;
  phone: string;
  initials: string;
  channel: Channel;
  status: Status;
  unread: number;
  lastAt: string;
  tags: string[];
  starred?: boolean;
  agent?: string;
  messages: Message[];
};
```

Channels imply integrations: WhatsApp Business Cloud API, SMS provider
(MSG91 / Twilio), Instagram DMs (Meta Graph), in-app web chat widget.
Bot replies are part of the conversation timeline — implies a basic
template-bot service.

#### 15. Subscribers — `Subscribers.tsx`

```ts
type SubChannel = "Email" | "SMS" | "WhatsApp" | "Push";
type SubStatus = "Subscribed" | "Unsubscribed" | "Bounced";
type Tier = "Bronze" | "Silver" | "Gold" | "Platinum";

type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  channels: SubChannel[];
  tier: Tier;
  city: string;
  joinedAt: string;
  lastOrderAt?: string;
  orders: number;
  spend: number;
  tags: string[];
  status: SubStatus;
};
```

**Segment rule engine** is visible in the UI:

```ts
const segments = [
  { id: 'all',    rule: () => true },
  { id: 'vip',    rule: s => s.tags.includes('VIP') || s.tier === 'Platinum' },
  { id: 'loyal',  rule: s => s.orders >= 30 },
  { id: 'lapsed', rule: s => (now - lastOrderAt) > 30d },
  { id: 'new',    rule: s => (now - joinedAt) < 30d },
];
```

Implies: backend computes tier (Bronze<5 / Silver≥5 / Gold≥30 / Platinum≥50
or LTV thresholds — pick one and document); segment-evaluation must run
both **interactively** (audience size on a campaign editor) and
**asynchronously** (campaign send time). CSV import + export. **GDPR
unsubscribe** is a hard requirement.

#### 16. All Users — `AllUsers.tsx`

Combined staff + customer directory. Roles seen in UI:

```
'Owner' | 'Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Kitchen Staff'
| 'Delivery' | 'Customer'
```

Statuses: `Active | Invited | Suspended`. Per-user metadata varies by
role: staff have salary + shifts; customers have LTV + order count.
Branch column. Group toggle (`All | Staff | Customers`).

Backend obligation: extend `User` model with `salary`, `shiftCount` (or
move shifts to a separate `Shift` model — recommended), `lastActiveAt`
(already exists as `lastLoginAt`). Add an **Invite flow** (email magic
link with role + branch pre-set).

#### 17. User Roles — `UserRoles.tsx`

Permission matrix designer.

```ts
type PermKey =
  | "pos.create_order"
  | "pos.discount"
  | "pos.void_bill"
  | "pos.refund"
  | "kitchen.kds"
  | "kitchen.recall"
  | "menu.view"
  | "menu.edit"
  | "menu.toggle_availability"
  | "tables.view"
  | "tables.assign"
  | "reports.view_sales"
  | "reports.view_staff"
  | "reports.export"
  | "cash.day_close"
  | "cash.cash_drawer"
  | "inventory.view"
  | "inventory.adjust"
  | "crm.view"
  | "crm.message"
  | "settings.outlet"
  | "settings.users"
  | "settings.billing"
  | "delivery.assign"
  | "delivery.driver_app";
```

23 permissions across 10 groups. System role `Owner` is read-only with
`systemRole: true`. Permissions have a `risk: 'low' | 'medium' | 'high'`
flag the UI uses to color-code dangerous toggles.

Backend obligation: replace simple `UserRole` enum with a richer
`Role` + `RolePermission` join. Keep the enum for legacy + JWT payload
size; add a `permissions: string[]` claim to the JWT generated from the
role's perm set at login.

#### 18. Transactions — `Transactions.tsx`

Payment ledger separate from orders.

```ts
type Method = "Cash" | "Card" | "UPI" | "Wallet" | "Online" | "Loyalty";
type TxType = "Sale" | "Refund" | "Tip" | "Settlement" | "Comp";
type TxStatus = "Success" | "Pending" | "Failed" | "Refunded";

type Transaction = {
  id: string; // TXN-####
  orderSerial: string; // ORD-####
  date: string;
  iso: string;
  method: Method;
  type: TxType;
  status: TxStatus;
  amount: number; // negative for Refund / Comp
  channel: "POS" | "Online" | "QR" | "Waiter";
  cashier?: string;
  customer?: string;
  reference?: string; // 'utr-...', 'rzp_pay_...', 'auth-...'
  fee?: number; // gateway fee
};
```

Implies: a `Payment` (or `Transaction`) model bound to `Order`, with type
discriminator. Settlement reconciliation (provider settles in batches —
`Settlement` rows reference the `Payment` rows they cover). Tips tracked
separately for staff payouts. Loyalty point burns recorded as a `Comp`
type.

#### 19. Subscription — `Subscription.tsx`

This is **Vuedine's own SaaS billing**, not the restaurant's customer
subscriptions.

```ts
type Plan = {
  id: 'starter' | 'growth' | 'enterprise';
  monthly: number; yearly: number;     // ₹ per outlet
  features: { label: string; included: boolean | string }[];
};
const usage = {
  outlets:     { used: 3, limit: 3 },
  seats:       { used: 24, limit: 50 },
  aiRequests:  { used: 12420, limit: 50000 },
  storage:     { used: 8.4, limit: 25 }, // GB
};
const addons = [
  { id: 'priority',     price: 1499 },
  { id: 'whatsapp',     price: 999 },
  { id: 'extra-branch', price: 1999 },
];
const invoices = [...];   // INV-... with date / amount / status / period
```

Implies: a `Subscription` model on Tenant (currentPlan, billingCycle,
seatLimit, branchLimit, aiQuota, storageQuotaGB), a `Usage` rollup table,
`Invoice` model, integration with Razorpay/Stripe for recurring billing,
**enforcement** (over-quota emits a soft warning + blocks creates),
**plan migration** logic.

#### 20. Sales Report — `SalesReport.tsx`

Date-range filterable order ledger plus pivots:

- **Hourly bars** of revenue (10:00 → 23:00).
- **Payment mix** (% by method).
- **Order-type mix** (Dine-In / Takeaway / Delivery / QR).
- **KPIs**: gross sales, refunds, tips, fees, net.

Backend obligation: aggregation endpoints with proper indexes (composite
on `(tenantId, branchId, paidAt, status)`). Phase I delivers these.

#### 21. QR Codes — `QRCodes.tsx`

```ts
type QrType = "Table" | "Counter" | "Takeaway" | "Delivery" | "Marketing";
type QrStatus = "Active" | "Inactive" | "Pending";

type QrEntry = {
  id: string;
  label: string;
  type: QrType;
  branch: string;
  url: string; // public URL the QR encodes
  status: QrStatus;
  scans: number;
  ordersToday: number;
  createdAt: string;
};
```

Plus a **shop** for printed materials (tent cards, vinyl stickers, brass
stands, standees, bundles, rider QRs) — implies an e-commerce surface for
hardware purchases. Out of scope for MVP, but the **QR code mint + scan
tracking** is in scope (Phase G).

#### 22. Integrations — `Integrations.tsx`

Catalog of 24 third-party integrations across:

- **Aggregators**: Zomato, Swiggy, Uber Eats, DoorDash, Magicpin
- **Payments**: Razorpay, Stripe, PayU, PhonePe Business, Paytm Business
- **Messaging**: WhatsApp Business, MSG91, Twilio, SendGrid
- **Accounting**: Tally, Zoho Books, QuickBooks
- **Reviews**: Google Reviews, TripAdvisor
- **Marketing**: Mailchimp, Meta Ads, Google Ads
- **Hardware**: Epson Cloud, Star Micronics
- **AI**: Vuedine AI (built-in), Bring-your-own OpenAI

Each carries `fields: CredentialField[]` (key/secret-style inputs),
optional `webhookUrl` (we expose to them), `lastSync`, `docsUrl`.

Backend obligation: a generic `Integration` model with provider id,
encrypted credentials (use Phase 9 field-level encryption!), webhook
inbound handlers, outbound sync workers.

#### 23. Settings — `Settings.tsx`

15 sections:

```
Workspace:   Profile, Restaurant, Branches, Branding & QR menu, Localization
Operations:  Taxes & Bills, Payments, Hardware, Notifications
Platform:    Security, Data & privacy, Subscription, Developer, Danger zone
```

Settings span:

- Tenant profile + restaurant metadata (legal name, GSTIN, brand color,
  logo URL, banner)
- Branches CRUD (already in Tables UI somewhat)
- Branding (color, theme, fonts, header banner, custom domain)
- Localization (currency + position, timezone, languages, number format,
  weight units, week start)
- Taxes (GSTIN, mode inclusive/exclusive, multiple slabs,
  HSN codes per slab, rounding rules, invoice prefix + sequence)
- Payment methods toggles (cash/card/upi/wallet/online), gateway preference,
  service charge %, tips toggle
- Hardware (printer routing per station, cash drawer, KDS displays,
  customer display, OSS, weighing scale)
- Notifications matrix (event × channel × on/off — newOrder, lowStock,
  reservationReminder, etc.)
- Security (2FA, PIN auth for terminals, IP allowlist, session timeout)
- Data & privacy (export tenant data, data retention, GDPR delete)
- Developer (API keys — Phase 9 ✅, webhooks, sandbox mode)
- Danger zone (delete branch, transfer ownership, close tenant)

Backend obligation: a `TenantSettings` JSONB-blob is too loose. Split into
typed sub-tables: `TaxSlab`, `PaymentMethodConfig`, `BranchConfig`,
`NotificationPreference`, `BrandingConfig`. Phase F lands these.

### Customer-facing PWA

#### Guest Menu — `guest/Menu.tsx`

```ts
type GuestItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  emoji: string;
  veg: boolean;
  bestseller?: boolean;
  desc?: string;
  prepMin?: number;
  spice?: 1 | 2 | 3;
  allergens?: string[]; // 'Gluten', 'Dairy', 'Egg', 'Fish', 'Soy', 'Nuts'
  variants?: { id: string; label: string; delta: number }[];
  addons?: { id: string; label: string; price: number }[];
};
```

**Item modifiers** are a real thing the menu supports — variants change
the unit price by `delta`, addons append. Same `Item` schema in dashboard
must carry them (currently doesn't).

URL contract: `/m/:branch/:table` — branch slug + table code. `Menu` calls
`guestActions.setContext(branch, table)` on mount.

#### Guest Checkout — `guest/Checkout.tsx`

Guest enters name + phone (optional), picks tip % or custom, applies
promo, picks pay mode, places order. Cart line shape includes
`variantId`, `addonIds[]`, `notes`.

```ts
type CartLine = {
  uid: string; // unique per (item + variant + addons + notes) signature
  itemId: number;
  qty: number;
  variantId?: string;
  addonIds?: string[];
  notes?: string;
  unitPrice: number; // captured at add-time
};

const TAX_RATE = 0.05;
const SERVICE_RATE = 0.05;
```

#### Guest Order Tracking — `guest/OrderTracking.tsx`

Subscribes to a status feed (currently simulated with setInterval). Shows
the same status enum as KDS (`Pending → Accepted → Preparing → Ready →
Served`). Allows the guest to **call the waiter**, **ask for the bill**,
and **rate** their meal at the end. Implies: customer-side socket
connection (anonymous, scoped to `order:<id>`), POST endpoints for
ring-waiter / request-bill / submit-rating.

### Cross-cutting findings

Things every module touches:

1. **Branch context** — every read should filter by the active branch
   the topbar selector picks. Persist in user preferences (or a session
   cookie). `req.branchId` from a JWT claim or a header.
2. **Date range picker** — every analytical view has one. Standardize on
   `from` / `to` ISO strings, server-side timezone-aware (use the
   tenant's `timezone` field).
3. **Pagination** — `page`, `pageSize` (defaults 1, 10), with `total`,
   `totalPages` in `meta`. Already in Phase 5 — extend.
4. **Search** — case-insensitive substring; for items + customers use
   `pg_trgm` index (extension already enabled).
5. **CSV / Excel / PDF / JSON export** — ubiquitous. Build one streaming
   exporter and reuse.
6. **Optimistic UI** — many screens optimistically toggle status (KDS
   mark prepared, Live Orders accept). Endpoints must be idempotent
   (PATCH with state, not "advance state").
7. **Server-time everywhere** — timers, ETAs, age. `req.id` already includes
   request id; add `serverNow` field to every response envelope so client
   clocks can sync (single drift correction).
8. **Notification bell (topbar)** — feeds a per-user inbox endpoint.
   Phase H wires it.
9. **AI Helper FAB** — invokes a chat endpoint scoped to the tenant.
   Out-of-scope for MVP; tracked as Phase L.
10. **Demo mode banner** — implies a `DEMO_MODE` flag per tenant; data is
    auto-reset every 60 minutes via cron when flag is on.

---

## Phases at a glance

| Phase | Title                                            | Sidebar covers                                                                                   | Effort | Critical path? |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------ | -------------- |
| A     | Branches, Sections, Tables                       | Tables (3)                                                                                       | M      | ✅             |
| B     | Orders core + KDS + OSS + real-time              | POS (4), Live Orders (5), POS Orders (6), Online Orders (7), Table Orders (8), KDS (9), OSS (10) | XL     | ✅             |
| C     | Payments, Refunds, Settlements, Tips             | Transactions (18)                                                                                | L      | ✅             |
| D     | Promotions: Coupons + Offers                     | Coupons (11), Offers (12)                                                                        | M      |                |
| E     | Users admin, Roles & Permissions, Customers      | All Users (16), User Roles (17)                                                                  | M      | ✅             |
| F     | Tenant Settings — taxes, branding, hardware, ... | Settings (23)                                                                                    | M      | ✅             |
| G     | QR Codes, scan analytics, hardware print         | QR Codes (21)                                                                                    | S      | ✅             |
| H     | Communications — Push, Subscribers, Messages     | Push (13), Messages (14), Subscribers (15)                                                       | M      |                |
| I     | Reports, KPIs, Dashboard aggregates              | Dashboard (1), Sales Report (20)                                                                 | M      | ✅             |
| J     | Integrations layer + Aggregator order ingest     | Integrations (22)                                                                                | L      |                |
| K     | Subscription / SaaS billing for Vuedine          | Subscription (19)                                                                                | L      | ✅             |
| L     | AI Helper, demand forecasting, smart suggestions | AI Helper FAB                                                                                    | XL     |                |

Effort scale: **S** ≤1 week, **M** 1–2w, **L** 2–4w, **XL** 4–8w with one
engineer. Parallelizable wherever marked independent below.

Recommended order:

1. **A** (Branches/Tables) — foundation for B.
2. **B** (Orders core) — the business reason this product exists. The
   single longest phase. Everything else feeds off it.
3. **E** (Users + Roles) — needed for proper RBAC on all endpoints in B/C/D.
4. **F** (Settings) — unblocks hardcoded branch/tax/currency values across UI.
5. **C** (Payments) — order placement is incomplete without it.
6. **G** (QR codes) — mints the URLs Tables module already shows.
7. **D** (Promotions) — discount math at order time.
8. **I** (Reports) — needs B + C in place to aggregate.
9. **H** (Communications) — already partially wired (notification queue).
10. **J** (Integrations) — broadens reach.
11. **K** (SaaS billing) — keep us alive.
12. **L** (AI) — moat, post-launch.

A team of 2 backend engineers can ship A → I in roughly 12 weeks of
focused work. Add 2 more for J + K. AI is open-ended.

---

## Phase A — Branches, Sections, Tables

### 📌 Goal

Make the topbar branch selector real. Make Settings → Branches CRUD
real. Make `/dashboard/tables` driven by API state instead of mock data.
This is the foundation every later phase scopes to.

### 📐 Frontend contract

- `app/src/pages/dashboard/DashboardLayout.tsx` — `BranchSelector` is the
  source of truth: `{ name, live }` with hardcoded list of 4 branches.
- `app/src/pages/dashboard/Tables.tsx` — full mock list with shape:

```ts
type Status = "Free" | "Occupied" | "Reserved" | "Cleaning" | "Bill";
type Shape = "round" | "square" | "rect";
type DiningTable = {
  id: number;
  name: string;
  section: string;
  size: number;
  shape: Shape;
  status: Status;
  active: boolean;
  occupiedFor?: number;
  currentBill?: number;
  guestName?: string;
};
```

- `app/src/pages/dashboard/Settings.tsx` — `BranchesSection` with
  `initialBranches`.
- The frontend uses **integer ids** for tables. The backend uses
  cuid strings everywhere else. Decision: backend uses cuid; frontend
  serialises as string. UI must adapt (small change — already used
  string ids for orders, transactions).

### 🗄 Domain model

```prisma
model Branch {
  // Already exists in schema. Extend:
  isLive       Boolean   @default(true)        // existing
  openingHours Json?                            // existing
  address      String?                          // existing
  phone        String?                          // existing

  // Add:
  email          String?
  manager        String?
  timezoneCode   String?    // override tenant default per branch
  defaultPrep    Int        @default(15)        // minutes — used by ETAs
  serviceCharge  Decimal    @db.Decimal(5, 2) @default(0)
  taxInclusive   Boolean    @default(false)
  diningSections String[]   @default([])        // ['Indoor · Window', 'Terrace', ...]
  qrSlug         String     @unique             // public-facing URL component, e.g. 'bandra'

  tables       Table[]
  reservations Reservation[]   // Phase F adds this
}

model Table {
  id           String       @id @default(cuid())
  tenantId     String
  branchId     String
  name         String                                     // 'Table 7', 'Bar 1', 'Takeaway'
  section      String                                     // free-form for now
  capacity     Int          @default(4)                   // 0 = counter / takeaway
  shape        TableShape   @default(round)
  status       TableStatus  @default(FREE)
  active       Boolean      @default(true)
  qrToken      String       @unique                       // signed token used in /m/:branch/:table URL
  posLabel     String?                                    // optional short tag for POS

  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  deletedAt    DateTime?

  branch       Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)
  sessions     TableSession[]                             // Phase B adds this

  @@unique([branchId, name])
  @@index([tenantId, branchId, deletedAt])
  @@index([qrToken])
  @@map("tables")
}

enum TableShape  { round square rect }
enum TableStatus { FREE OCCUPIED RESERVED CLEANING BILL }
```

### 🔌 API surface

Branches:

- `GET    /v1/branches` — list all (tenant-scoped).
- `GET    /v1/branches/:id` — single.
- `POST   /v1/branches` — create. Owner / Admin only.
- `PATCH  /v1/branches/:id` — update.
- `DELETE /v1/branches/:id` — soft-delete. Cascades to tables + sessions.
- `POST   /v1/branches/:id/toggle-live` — flip `isLive`.

Tables:

- `GET    /v1/branches/:branchId/tables`
- `GET    /v1/tables/:id`
- `POST   /v1/branches/:branchId/tables`
- `PATCH  /v1/tables/:id`
- `DELETE /v1/tables/:id`
- `POST   /v1/tables/:id/qr/regenerate` — mints a fresh `qrToken`.
- `GET    /v1/branches/:branchId/sections` — distinct list for the
  filter dropdown.

Status transitions are driven by orders (Phase B), not directly callable.

### 📡 Real-time events

- Room: `branch:<branchId>`
- Events:
  - `table:status` `{ tableId, status, occupiedFor?, currentBill?, guestName? }`

### ⏰ Async work

None unique to this phase.

### 🗃 Cache strategy

Branch list rarely changes — cache 5 min, prefix `branches:<tenantId>`.
Table list: cache 60s, prefix `tables:<tenantId>:<branchId>`. Both invalidate
via `bumpVersion` on any mutation in this module.

### 🔒 Permissions

| Endpoint            | OWNER | ADMIN | MANAGER | CASHIER | WAITER | CHEF |
| ------------------- | ----- | ----- | ------- | ------- | ------ | ---- |
| GET branches/tables | ✅    | ✅    | ✅      | ✅      | ✅     | ✅   |
| POST/PATCH branch   | ✅    | ✅    |         |         |        |      |
| DELETE branch       | ✅    |       |         |         |        |      |
| POST/PATCH table    | ✅    | ✅    | ✅      |         |        |      |
| DELETE table        | ✅    | ✅    |         |         |        |      |
| Regenerate QR       | ✅    | ✅    | ✅      |         |        |      |

### 🧪 Tests

- Unit: zod validators (capacity ≥ 0, shape enum, name length).
- Integration: branch CRUD + tenant-scoping (T1 owner can't see T2
  branches), QR token uniqueness, soft-delete cascade behaviour.
- Smoke: section list builds correctly even when sections are empty.

### ✅ Acceptance

- BranchSelector is populated by `GET /v1/branches`; switching emits a
  client-side context change (header `X-Vuedine-Branch` or just a query
  param convention).
- Tables page (floor plan + list view) loads from API; mock data deleted
  from frontend.
- Settings → Branches creates / edits / deletes a branch end-to-end.
- QR token in `/m/:branchSlug/:tableQrToken` resolves to a (tenant, branch,
  table) triple in Phase G's resolver.
- All audit log events: `BRANCH_CREATED`, `BRANCH_UPDATED`, `BRANCH_DELETED`,
  `TABLE_CREATED`, `TABLE_UPDATED`, `TABLE_DELETED`.

### ⚠️ Pitfalls

1. **QR slug collisions.** Two branches both want `bandra`. Enforce
   `@unique` and surface a clear error.
2. **Forgetting to scope tables by branch.** Easy to write `where: {
tenantId }` and forget `branchId`. Repository layer takes both.
3. **Hard-deleting a branch with active orders.** Blocks payments
   reconciliation. Use soft-delete with a cron that only purges after
   90 days when no live orders remain.

---

## Phase B — Orders core + KDS + OSS + real-time

This is the keystone. Without it, nothing else makes sense.

### 📌 Goal

Replace the `localStorage`-backed live-order bus with persisted orders
flowing through a real socket.io stream, fed by both the dashboard POS
and the customer PWA. Same data model serves: POS Orders list, Live
Orders, Online Orders, Table Orders, KDS, OSS, and Sales Report.

### 📐 Frontend contract

Already enumerated in detail above (modules 4–10). Critical types to
mirror:

```ts
type OrderType = "Dine-In" | "Takeaway" | "Delivery" | "QR";
type OrderStatus =
  | "Pending"
  | "Accepted"
  | "Preparing"
  | "Prepared"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";
type OrderChannel = "POS" | "Waiter" | "QR" | "Online";
type Station = "Hot" | "Cold" | "Bar" | "Dessert";
type Priority = "Normal" | "Rush";
```

Plus the `LiveOrder` shape from `lib/liveOrders.ts` (kept as the
denormalized socket payload), and `Round` / `TableSession` model that
backs Table Orders' multi-round view.

### 🗄 Domain model

```prisma
model Order {
  id            String        @id @default(cuid())
  tenantId      String
  branchId      String
  serial        String        // human-friendly, branch-scoped seq, e.g. 'ORD-21052617'
  token         String        // 'TKN-1284', shown on receipts + OSS

  type          OrderType
  channel       OrderChannel
  source        String?       // 'Zomato' / 'Swiggy' / 'WhatsApp' / 'Vuedine Direct' / 'QR Pay' / 'POS'
  status        OrderStatus   @default(PENDING)
  priority      OrderPriority @default(NORMAL)

  // Customer (denormalized — customer record is optional)
  customerId    String?
  guestName     String?
  guestPhone    String?
  guestEmail    String?

  // Dine-in linkage
  tableId       String?
  sessionId    String?       // TableSession; multiple rounds within one session

  // Delivery linkage
  address       Json?         // { line1, line2, city, pin, area, lat, lng }
  driverId      String?
  driverName    String?
  driverPhone   String?
  etaMinutes    Int?
  prepMinutes   Int?
  isLate        Boolean       @default(false)

  // Money — every value is a snapshot at placement time
  subtotal      Decimal       @db.Decimal(12, 2)
  discount      Decimal       @db.Decimal(12, 2) @default(0)
  tax           Decimal       @db.Decimal(12, 2)
  service       Decimal       @db.Decimal(12, 2) @default(0)
  tip           Decimal       @db.Decimal(12, 2) @default(0)
  delivery      Decimal       @db.Decimal(12, 2) @default(0)
  total         Decimal       @db.Decimal(12, 2)
  currency      String        @default("INR")

  notes         String?
  receivedAt    DateTime      @default(now())
  acceptedAt    DateTime?
  preparedAt    DateTime?
  outAt         DateTime?
  deliveredAt   DateTime?
  cancelledAt   DateTime?
  cancelReason  String?

  // Cashier / waiter who took the order (POS / Waiter channels)
  takenById     String?

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  items         OrderItem[]
  payments      Payment[]                   // Phase C
  promotions    OrderPromotion[]            // Phase D
  events        OrderEvent[]                // append-only audit timeline

  branch        Branch        @relation(fields: [branchId], references: [id])
  table         Table?        @relation(fields: [tableId], references: [id])
  session       TableSession? @relation(fields: [sessionId], references: [id])

  @@unique([branchId, serial])
  @@index([tenantId, branchId, status, createdAt(sort: Desc)])
  @@index([tenantId, branchId, type, createdAt(sort: Desc)])
  @@index([tenantId, customerId, createdAt(sort: Desc)])
  @@index([tableId, status])
  @@index([sessionId])
  @@map("orders")
}

model OrderItem {
  id             String   @id @default(cuid())
  orderId        String
  itemId         String                                   // Item.id
  name           String                                   // snapshot
  emoji          String?
  qty            Int
  unitPrice      Decimal  @db.Decimal(12, 2)
  variantId      String?
  variantLabel   String?
  variantDelta   Decimal  @db.Decimal(12, 2) @default(0)
  addonIds       String[] @default([])
  addonLabels    String[] @default([])
  addonsTotal    Decimal  @db.Decimal(12, 2) @default(0)
  notes          String?
  station        OrderStation                              // routing target
  prepared       Boolean  @default(false)
  preparedAt     DateTime?
  preparedById   String?

  order          Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@index([itemId])
  @@map("order_items")
}

model TableSession {
  id            String   @id @default(cuid())
  tenantId      String
  branchId      String
  tableId       String
  guests        Int      @default(1)
  guestName     String?
  waiterId      String?
  channel       OrderChannel    // who started it
  tags          String[] @default([])
  startedAt     DateTime @default(now())
  closedAt      DateTime?
  paymentStatus SessionPaymentStatus @default(OPEN)

  table         Table    @relation(fields: [tableId], references: [id])
  orders        Order[]

  @@index([tableId, paymentStatus])
  @@index([tenantId, branchId, startedAt(sort: Desc)])
  @@map("table_sessions")
}

// Append-only timeline — every state change writes a row
model OrderEvent {
  id          String   @id @default(cuid())
  orderId     String
  type        OrderEventType
  fromStatus  OrderStatus?
  toStatus    OrderStatus?
  byUserId    String?
  metadata    Json?
  at          DateTime @default(now())

  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, at])
  @@map("order_events")
}

enum OrderType        { DINE_IN TAKEAWAY DELIVERY QR }
enum OrderChannel     { POS WAITER QR ONLINE }
enum OrderStatus      { PENDING ACCEPTED PREPARING PREPARED OUT_FOR_DELIVERY DELIVERED CANCELLED }
enum OrderPriority    { NORMAL RUSH }
enum OrderStation     { HOT COLD BAR DESSERT }
enum OrderEventType   { CREATED ACCEPTED ITEM_PREPARED PREPARED OUT_FOR_DELIVERY DELIVERED CANCELLED RECALLED REFUND_INITIATED }
enum SessionPaymentStatus { OPEN AWAITING_PAYMENT PAID VOIDED }
```

Indexes are dimensioned for the hot read paths:

- POS Orders list filter by `status`, `type`, `channel` → composite indexes.
- KDS feed: `(branchId, status IN [ACCEPTED, PREPARING], priority DESC, receivedAt ASC)`.
- Customer order history: `(customerId, createdAt DESC)`.
- Table running session: `(tableId, status)` partial-where-active.

Decision: serial number generation is per-branch per-day. Use a Postgres
sequence keyed by `(branchId, date)` via a stored function, OR keep it
simple with `nextval('order_serial_seq')` and prefix with date. For Phase
B-MVP go with the simple sequence; Phase I tightens.

### 🔌 API surface

Order placement (server is the source of truth for math):

- `POST /v1/orders/calculate` — request: cart lines + tableId + couponCode +
  tipAmount → response: itemized totals (subtotal, discount, tax, service,
  total). Used by both POS and the customer Checkout to render the bill.
  **No DB write.** Pure compute.
- `POST /v1/orders` — places the order. Idempotency-Key header required
  (prevents double-place from network retries). Persists to DB, opens or
  joins a `TableSession` if dine-in, emits `liveOrder:created` over
  socket.io, enqueues KDS routing job.
- `GET    /v1/orders` — paginated, filterable. The single endpoint behind
  POS Orders, Online Orders, Sales Report rows. Filters: type, status,
  channel, source, payment status, paymentMethod, branch, dateFrom/To,
  search.
- `GET    /v1/orders/:id` — full order incl. items, events, payments.
- `POST   /v1/orders/:id/accept` — Pending → Accepted.
- `POST   /v1/orders/:id/start` — Accepted → Preparing.
- `POST   /v1/orders/:id/ready` — Preparing → Prepared (KDS "all done").
- `POST   /v1/orders/:id/deliver` — Prepared → Delivered (or Out_For_Delivery).
- `POST   /v1/orders/:id/cancel` — body `{ reason }`. Allowed up to certain
  state.
- `POST   /v1/orders/:id/recall` — admin only. Re-opens a Delivered ticket
  back to KDS (mistake).
- `PATCH  /v1/orders/:id/items/:itemId/prepared` — KDS line-item toggle.
- `PATCH  /v1/orders/:id/priority` — flip Rush / Normal.
- `PATCH  /v1/orders/:id/notes` — guest notes / kitchen notes.

Live Orders feed (replaces `lib/liveOrders.ts`):

- `GET    /v1/branches/:branchId/live` — first-load snapshot (last N
  active). Subsequent updates via socket events.

Table sessions:

- `GET  /v1/table-sessions/:id` — full picture (rounds, all items, current
  bill).
- `POST /v1/tables/:id/sessions` — open a new session (guests, waiter).
- `POST /v1/table-sessions/:id/close` — mark `AWAITING_PAYMENT`. Triggers
  table.status = BILL.
- `POST /v1/table-sessions/:id/transfer` — move to a different table
  (e.g. guests asked to move).
- `POST /v1/table-sessions/:id/merge` — merge two sessions (e.g. two
  parties combining).

KDS feed:

- `GET  /v1/kds/tickets?branchId=&station=&state=` — list active tickets.
- Subscribes to socket events for live updates.

OSS:

- `GET  /v1/oss/:branchId/tokens` — public, returns `{ preparing: [...],
ready: [...] }` with token + customer first name only. No PII.

Customer-facing (PWA):

- `GET  /m/:branchSlug/:qrToken` — resolves to (branch + table + menu).
  Returns the menu blob the guest needs.
- `POST /v1/public/orders` — guest places an order. Body includes `qrToken`
  for table verification. Auth: NONE (rate-limited by IP + qrToken).
- `GET  /v1/public/orders/:id` — guest tracking page polls or subscribes
  via a one-shot socket connection (room: `order:<id>`).
- `POST /v1/public/orders/:id/ring` — call the waiter.
- `POST /v1/public/orders/:id/bill` — request the bill.
- `POST /v1/public/orders/:id/feedback` — submit star rating + comment.

### 📡 Real-time events

Rooms:

- `branch:<branchId>` — kitchen, dashboard, OSS
- `tenant:<tenantId>` — owner sees all branches
- `table:<tableId>` — table-scoped (waiter-call signals)
- `order:<orderId>` — guest-tracking page
- `kds:<branchId>:<station>` — per-station KDS displays

Events emitted from the orders module:

- `liveOrder:created` `{ ...LiveOrder }`
- `liveOrder:status` `{ orderId, status, at }`
- `liveOrder:item-prepared` `{ orderId, orderItemId, prepared, at }`
- `liveOrder:cancelled` `{ orderId, reason, at }`
- `kds:ticket:new` `{ ...Ticket }` (per-station, after routing job runs)
- `kds:ticket:done` `{ ticketId, station }`
- `oss:tokens` `{ preparing: [...], ready: [...] }`
- `table:status` (already specified in Phase A)
- `waiter:call` `{ tableId, reason }` — guest pressed ring button

### ⏰ Async work

- **`order.routing`** — splits an Order into station-scoped KDS tickets,
  fans out per-station socket events.
- **`order.eta`** — recomputes ETA whenever a kitchen ticket is marked
  prepared (or based on a moving average).
- **`order.late-check`** — periodic; flips `isLate` when `etaMinutes`
  exceeded.
- **`order.audit`** — writes audit log rows for every state change.

Add to `src/queues/index.js` a new `order` queue. The worker is in
`src/queues/workers/order.worker.js`.

### 🗃 Cache strategy

- Live orders snapshot: 10s TTL, prefix `live:<branchId>`.
- KDS ticket list: 10s TTL, prefix `kds:<branchId>:<station>`.
- Order detail: 60s TTL, prefix `order:<id>`. Invalidates on any state
  change.
- Sales aggregates (Phase I): 5 min TTL.

Real-time clients should treat the cache as warm-load; live updates
replace it.

### 🔒 Permissions

| Endpoint                   | OWNER               | ADMIN | MANAGER | CASHIER | WAITER | CHEF |
| -------------------------- | ------------------- | ----- | ------- | ------- | ------ | ---- |
| GET orders                 | ✅                  | ✅    | ✅      | ✅      | ✅     | ✅   |
| POST orders (POS create)   | ✅                  | ✅    | ✅      | ✅      | ✅     |      |
| accept/start/ready/deliver | ✅                  | ✅    | ✅      | ✅      | ✅     | ✅   |
| cancel                     | ✅                  | ✅    | ✅      |         | ✅     |      |
| recall                     | ✅                  | ✅    |         |         |        |      |
| KDS line item prepared     | ✅                  | ✅    | ✅      |         |        | ✅   |
| Public PWA endpoints       | open (rate-limited) |       |         |

Each PATCH is also gated by a state-machine check in the service layer.

### 🧪 Tests

- Unit: state-machine guard (Pending → Cancelled allowed; Delivered →
  Pending denied), tax + service + tip math, line-signature for variant
  - addons combinations.
- Integration: full POS flow (login, create, accept, start, mark item
  prepared, ready, deliver, GET final state). Full guest PWA flow (resolve
  QR, place, track via socket).
- Concurrency: two PATCH /accept on the same order (one wins). Use Prisma
  optimistic locking via `updatedAt` or a `revision` column.
- Idempotency: replaying the same `Idempotency-Key` returns the previously
  created order, not a duplicate.
- Real-time: customer places via PWA → dashboard receives socket event
  within 500ms.

### ✅ Acceptance

- POS Orders, Live Orders, Online Orders, Table Orders pages all work
  against the API. `lib/liveOrders.ts` is deleted.
- KDS shows incoming tickets in real time, station-routed.
- OSS displays tokens in real time without PII.
- Customer PWA places an order from `/m/:slug/:qrToken` end-to-end and
  the order reaches KDS.
- `Order.serial` is unique per branch and monotonically increasing.
- Cancel emits `liveOrder:cancelled` and the table returns to FREE if
  it was the only active session order.
- Audit log captures every state transition.

### ⚠️ Pitfalls

1. **Floating point money.** Use `Decimal` everywhere, never `number`.
   Already enforced by Prisma schema.
2. **Tax math drift.** Server is authoritative. The client `TAX_RATE = 0.05`
   constant is **wrong on prod** — must come from `BranchConfig` or
   tenant settings. Phase F unwinds this.
3. **Duplicate orders from network retries.** `Idempotency-Key` is
   non-negotiable on `POST /v1/orders`. Store keys in Redis with 24h TTL.
4. **Race on table session.** Two waiters claim the same FREE table
   simultaneously. Use Postgres advisory lock (`pg_try_advisory_xact_lock`)
   keyed by `tableId`.
5. **Socket events out of order.** Treat each event as a state replacement
   (idempotent), not a delta. Client always trusts the latest event for an
   `orderId`.
6. **KDS clock drift.** Server emits `at` ISO timestamp; client never
   trusts its own clock for "age". Ship `serverNow` in every connect ack.
7. **Cancellations after payment.** Only allow with admin override; route
   through Phase C refund flow.

---

## Phase C — Payments, Refunds, Settlements, Tips

### 📌 Goal

Money in, money out. Every order can be paid via Cash / Card / UPI /
Wallet / Online; refunded fully or partially; settled into the merchant's
bank when the gateway batches; tips tracked separately for staff payouts.

### 📐 Frontend contract

`Transactions.tsx` is the inventory. Settings → Payments configures
which methods are enabled and the gateway preference.

### 🗄 Domain model

```prisma
model Payment {
  id            String         @id @default(cuid())
  tenantId      String
  branchId      String
  orderId       String
  serial        String         // 'TXN-####'

  type          PaymentType    // SALE | REFUND | TIP | COMP | SETTLEMENT
  method        PaymentMethod  // CASH | CARD | UPI | WALLET | ONLINE | LOYALTY
  status        PaymentStatus  // PENDING | SUCCESS | FAILED | REFUNDED
  amount        Decimal        @db.Decimal(12, 2)        // signed: refunds + comps are negative
  fee           Decimal        @db.Decimal(12, 2) @default(0)
  currency      String         @default("INR")

  cashierId     String?
  reference     String?        // 'utr-...', 'rzp_pay_...', 'auth-...'
  gateway       String?        // 'razorpay' | 'stripe' | 'payu' | 'phonepe' | 'paytm' | null for cash
  gatewayMeta   Json?

  parentPaymentId String?      // for refund → original sale; for settlement → child sales
  parent        Payment?       @relation("ParentChild", fields: [parentPaymentId], references: [id])
  children      Payment[]      @relation("ParentChild")

  capturedAt    DateTime?
  failedReason  String?

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  order         Order   @relation(fields: [orderId], references: [id])

  @@unique([branchId, serial])
  @@index([tenantId, branchId, type, status, createdAt(sort: Desc)])
  @@index([orderId])
  @@index([reference])
  @@map("payments")
}

model Settlement {
  id              String    @id @default(cuid())
  tenantId        String
  gateway         String
  reference       String    // settlement batch id from gateway
  grossAmount     Decimal   @db.Decimal(12, 2)
  feeAmount       Decimal   @db.Decimal(12, 2)
  netAmount       Decimal   @db.Decimal(12, 2)
  paymentCount    Int
  settledAt       DateTime
  bankReference   String?

  createdAt       DateTime  @default(now())

  @@unique([gateway, reference])
  @@index([tenantId, settledAt(sort: Desc)])
  @@map("settlements")
}

enum PaymentType    { SALE REFUND TIP COMP SETTLEMENT }
enum PaymentMethod  { CASH CARD UPI WALLET ONLINE LOYALTY }
enum PaymentStatus  { PENDING SUCCESS FAILED REFUNDED }
```

### 🔌 API surface

- `POST /v1/orders/:id/payments` — request a payment intent. Body picks
  method; for online methods returns gateway-specific client secret.
- `POST /v1/orders/:id/payments/cash` — cash collection record.
- `POST /v1/orders/:id/payments/:paymentId/refund` — partial or full refund.
  Body: `{ amount, reason }`. Routes through gateway for non-cash.
- `POST /v1/orders/:id/comp` — manager-only: zero out the bill. Requires
  PIN re-auth.
- `GET  /v1/transactions` — paginated ledger; same filters as
  `Transactions.tsx`.
- `GET  /v1/transactions/:id`
- `POST /v1/payments/:id/recapture` — for stuck Pending sales (rare).
- Webhooks (inbound): `POST /v1/webhooks/razorpay`, `/stripe`, `/payu`,
  etc. Signature-verified. Update Payment.status idempotently.
- `GET  /v1/settlements` — list batches.
- `POST /v1/settlements/sync/:gateway` — manual reconcile pull.

### 📡 Real-time events

- `payment:status` `{ orderId, paymentId, status }`
- `order:paid` `{ orderId, total, method }` — useful for the receipt
  printer worker.

### ⏰ Async work

- **`payment.gateway-poll`** — fallback poll for stuck Pending payments.
- **`payment.print-receipt`** — enqueues a print job to the configured
  printer (Phase F hardware) when paid.
- **`settlement.fetch`** — daily cron per gateway; pulls settlement
  batches and reconciles them with stored Payment rows.
- **`refund.async`** — gateways often respond async; refund stays in
  Pending → callback flips it to Refunded.

### 🗃 Cache strategy

Settlements + transactions list cached 5 min; invalidates on any new
SUCCESS payment.

### 🔒 Permissions

| Endpoint          | OWNER | ADMIN | MANAGER | CASHIER             | WAITER              |
| ----------------- | ----- | ----- | ------- | ------------------- | ------------------- |
| Create payment    | ✅    | ✅    | ✅      | ✅                  | ✅                  |
| Refund            | ✅    | ✅    | ✅      |                     |                     |
| Comp              | ✅    | ✅    | ✅      |                     |                     |
| View transactions | ✅    | ✅    | ✅      | ✅ (own shift only) | ✅ (own shift only) |
| Settlements       | ✅    | ✅    |         |                     |                     |

Cashier scope is shift-scoped — Phase E adds shift entity + filter rule.

### 🧪 Tests

- Unit: refund-amount validator (cannot exceed sale - existing refunds);
  comp + tip math; gateway signature verification (test fixtures).
- Integration: full happy path Razorpay flow with the test gateway in
  sandbox mode.
- Webhook idempotency: replaying the same gateway webhook does not
  double-credit.
- Settlement reconciliation: synthetic batch matches expected payment
  set.

### ✅ Acceptance

- Transactions page, Sales Report payment-mix chart, and POS' "Place
  order" CTA all driven by the API.
- Razorpay sandbox flow complete from "Place order" → "Paid" → "Refunded".
- A failed gateway capture surfaces in the dashboard with a retry button.
- Settlement nightly cron creates a Settlement row and links underlying
  payments.
- Audit log: `PAYMENT_CAPTURED`, `PAYMENT_REFUNDED`, `PAYMENT_FAILED`.

### ⚠️ Pitfalls

1. **Webhook arrives before client confirms.** The order can flip to
   PAID before the client renders "success". Both paths must be
   idempotent.
2. **Replay attacks on webhooks.** Verify signatures + check
   `webhookEventId` against a 24-h dedupe set in Redis.
3. **Currency rounding.** Tax calc on subtotal, not on each item. Round
   only at the final total.
4. **Refund partial > sale.** Validate `sum(refunds) ≤ sale.amount`
   atomically (transaction).
5. **Cash drawer reconciliation.** End-of-day close must compare cash
   payments to physical drawer count. Phase F adds the close flow.

---

## Phase D — Promotions: Coupons + Offers

### 📌 Goal

A unified promotion engine that powers both Coupons (code-redeemed) and
Offers (auto-applied bundles / time-windowed discounts), feeding into the
order calculator from Phase B.

### 📐 Frontend contract

`Coupons.tsx` and `Offers.tsx` types (already quoted above). Promo box on
guest Checkout. Auto-applied offers should appear in the "Items" section
on POS without user action.

### 🗄 Domain model

```prisma
model Promotion {
  id            String         @id @default(cuid())
  tenantId      String
  type          PromotionType  // COUPON | OFFER
  kind          PromotionKind  // PERCENTAGE | FLAT | BOGO | FREE_ITEM | COMBO
  status        PromotionStatus

  // Common fields
  title         String
  description   String?
  emoji         String?
  hero          String?        // gradient class for offer card

  code          String?        // null for offers, required + unique for coupons
  value         Decimal        @db.Decimal(12, 2) @default(0)
  minOrder      Decimal        @db.Decimal(12, 2) @default(0)
  maxDiscount   Decimal?       @db.Decimal(12, 2)

  startsAt      DateTime
  endsAt        DateTime
  startTime     String?        // 'HH:MM' for time-of-day offers
  endTime       String?
  days          DayOfWeek[]    @default([])  // ['MON', ..., 'SUN']

  channels      String[]       @default([])  // ['POS', 'QR', 'Online', 'WhatsApp']

  usageLimit    Int            @default(0)   // 0 = unlimited
  perUserLimit  Int            @default(1)
  used          Int            @default(0)

  // Targeting
  scope         PromotionScope @default(WHOLE_ORDER)
  targetItemIds String[]       @default([])   // when scope = ITEMS
  targetCategories String[]    @default([])   // when scope = CATEGORIES

  // Auto-apply for OFFERS
  autoApply     Boolean        @default(false)
  trigger       Json?          // e.g. { event: 'birthday', within: 7 } — Phase H integrates

  redemptions   Int            @default(0)   // counter for analytics
  revenue       Decimal        @db.Decimal(14, 2) @default(0)

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  redemptionRecords PromotionRedemption[]
  orderLinks        OrderPromotion[]

  @@unique([tenantId, code])
  @@index([tenantId, type, status])
  @@index([tenantId, autoApply, status])
  @@map("promotions")
}

model PromotionRedemption {
  id            String   @id @default(cuid())
  promotionId   String
  orderId       String
  customerId    String?
  amountSaved   Decimal  @db.Decimal(12, 2)
  at            DateTime @default(now())

  promotion     Promotion @relation(fields: [promotionId], references: [id])

  @@index([promotionId, at])
  @@index([customerId, promotionId])      // per-user-limit enforcement
  @@map("promotion_redemptions")
}

model OrderPromotion {
  // Snapshot of which promotion(s) applied to an order — for audit + reporting
  id           String   @id @default(cuid())
  orderId      String
  promotionId  String
  code         String?
  amountSaved  Decimal  @db.Decimal(12, 2)

  order        Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  promotion    Promotion @relation(fields: [promotionId], references: [id])

  @@unique([orderId, promotionId])
  @@map("order_promotions")
}

enum PromotionType   { COUPON OFFER }
enum PromotionKind   { PERCENTAGE FLAT BOGO FREE_ITEM COMBO HAPPY_HOUR LOYALTY FESTIVAL }
enum PromotionStatus { ACTIVE SCHEDULED PAUSED EXPIRED ENDED }
enum PromotionScope  { WHOLE_ORDER ITEMS CATEGORIES }
enum DayOfWeek       { MON TUE WED THU FRI SAT SUN }
```

### 🔌 API surface

- `GET    /v1/promotions?type=&status=`
- `GET    /v1/promotions/:id`
- `POST   /v1/promotions` — create coupon or offer.
- `PATCH  /v1/promotions/:id`
- `DELETE /v1/promotions/:id` — soft delete; existing
  redemptions stay intact.
- `POST   /v1/promotions/:id/pause`
- `POST   /v1/promotions/:id/resume`
- `POST   /v1/cart/apply-coupon` — validate + return discount preview.
  Used by POS + guest Checkout. Body: cart lines + code.
- `GET    /v1/cart/auto-offers` — returns offers applicable now to
  this cart shape. Used to surface auto-applied offers in the UI.

### 📡 Real-time events

- `promotion:redeemed` `{ promotionId, orderId, amountSaved }` — drives
  the dashboard metric refresh.

### ⏰ Async work

- **`promotion.expire`** — every minute, flips `ACTIVE → EXPIRED` past
  `endsAt`.
- **`promotion.activate-scheduled`** — flips `SCHEDULED → ACTIVE` at
  `startsAt`.
- **`promotion.birthday-trigger`** — daily; finds customers whose birthday
  is within trigger window and emails the auto-applied code.

### 🗃 Cache strategy

Active promotions per tenant: cache 60s, prefix `promos:<tenantId>`.
Auto-offers per branch + day-of-week + time bucket: cache 5min.

### 🔒 Permissions

| Endpoint            | OWNER | ADMIN | MANAGER | CASHIER |
| ------------------- | ----- | ----- | ------- | ------- |
| GET / view          | ✅    | ✅    | ✅      | ✅      |
| Create / Edit       | ✅    | ✅    | ✅      |         |
| Pause / Resume      | ✅    | ✅    | ✅      |         |
| Delete              | ✅    | ✅    |         |         |
| Apply coupon at POS | ✅    | ✅    | ✅      | ✅      |

### 🧪 Tests

- Unit: cart calculator with each `kind` (percentage cap, flat min order,
  BOGO 1+1=1, free-item over threshold, combo bundle price, happy-hour
  time gating).
- Integration: per-user limit enforced (same customer, same code,
  second redemption = 409).
- Concurrency: two `apply-coupon` calls racing toward usageLimit=1.

### ✅ Acceptance

- Coupons + Offers pages CRUD wired.
- POS price box updates live when a code is applied.
- Birthday auto-coupon created on customer birthday.
- Audit log: `PROMOTION_CREATED`, `PROMOTION_REDEEMED`,
  `PROMOTION_PAUSED`, `PROMOTION_EXPIRED`.

### ⚠️ Pitfalls

1. **Stacking rules.** Two coupons on one order — allow or disallow?
   Decision: only one promotion per order in v1, except auto-applied
   offers can stack with one coupon. Document explicitly.
2. **Negative totals.** Promotion calc must clamp at zero, not refund
   the customer.
3. **Time zones for happy hour.** Use the branch's timezone, not UTC.
4. **Code leak.** Don't mass-publish single-use codes; each customer
   should get a unique code if usageLimit < perUserLimit × audience size.

---

## Phase E — Users admin, Roles & Permissions, Customers

### 📌 Goal

Make the User module multi-faceted: **staff** (with shifts + salary +
performance), **customers** (with LTV + tags + tier), and **roles** (with
the permission matrix from `UserRoles.tsx`).

### 📐 Frontend contract

`AllUsers.tsx`, `UserRoles.tsx`, `Subscribers.tsx` for the segment
overlap, plus the role / branchIds field on `User` already in our schema.

### 🗄 Domain model

```prisma
// Extend existing User:
model User {
  // existing fields...
  salary           Decimal?  @db.Decimal(12, 2)
  hourlyRate       Decimal?  @db.Decimal(12, 2)
  invitedAt        DateTime?
  invitedBy        String?
  inviteToken      String?   @unique
  inviteExpiresAt  DateTime?
  lastActiveAt     DateTime?
  customRoleId     String?       // optional override of enum role
  pinHash          String?       // 4-digit POS PIN for quick re-auth

  customRole       Role?     @relation(fields: [customRoleId], references: [id])
  shifts           Shift[]
  customerProfile  CustomerProfile?

  @@map("users")
}

model Role {
  id            String   @id @default(cuid())
  tenantId      String
  name          String                 // 'Branch Manager', 'Senior Waiter'
  description   String?
  systemRole    Boolean  @default(false)         // Owner, etc.
  members       Int      @default(0)             // denorm for fast UI
  permissions   String[] @default([])            // ['pos.create_order', ...]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  users         User[]

  @@unique([tenantId, name])
  @@map("roles")
}

model Shift {
  id          String     @id @default(cuid())
  tenantId    String
  branchId    String
  userId      String
  startedAt   DateTime
  endedAt     DateTime?
  cashIn      Decimal?   @db.Decimal(12, 2)
  cashOut     Decimal?   @db.Decimal(12, 2)
  variance    Decimal?   @db.Decimal(12, 2)     // cashIn - drawer count - cashSales
  note        String?

  user        User       @relation(fields: [userId], references: [id])

  @@index([userId, startedAt(sort: Desc)])
  @@index([branchId, startedAt(sort: Desc)])
  @@map("shifts")
}

model CustomerProfile {
  id            String    @id @default(cuid())
  userId        String    @unique
  tenantId      String
  tier          CustomerTier @default(BRONZE)
  totalSpend    Decimal   @db.Decimal(14, 2) @default(0)
  totalOrders   Int       @default(0)
  lastOrderAt   DateTime?
  birthday      DateTime?
  city          String?
  channels      String[]  @default([])         // 'Email', 'SMS', 'WhatsApp', 'Push'
  tags          String[]  @default([])         // 'VIP', 'Allergy', 'Catering'
  notes         String?
  loyaltyPoints Int       @default(0)
  marketingConsent Boolean @default(false)     // GDPR explicit opt-in
  unsubscribedAt DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId, tier])
  @@index([tenantId, totalSpend(sort: Desc)])
  @@index([tenantId, lastOrderAt])
  @@map("customer_profiles")
}

enum CustomerTier { BRONZE SILVER GOLD PLATINUM }
```

### 🔌 API surface

Users:

- `GET    /v1/users?group=&role=&status=&branch=` (existing endpoints
  extended to support both staff + customers)
- `POST   /v1/users/invite` `{ email, role, branchIds }` — sends invite email.
- `GET    /v1/users/invite/:token` — public; resolves to invite payload.
- `POST   /v1/users/invite/:token/accept` `{ password, name, phone }`.
- `POST   /v1/users/:id/suspend`
- `POST   /v1/users/:id/restore`
- `POST   /v1/users/:id/reset-pin`
- `GET    /v1/users/:id/activity` — audit log filtered for this user.

Roles:

- `GET    /v1/roles`
- `POST   /v1/roles`
- `PATCH  /v1/roles/:id` — except for systemRole=true
- `DELETE /v1/roles/:id`
- `POST   /v1/users/:id/role` — assign user to a role (custom or
  built-in).

Customers (specialised user view):

- `GET    /v1/customers?segment=&tier=&search=`
- `GET    /v1/customers/:id` — profile + last 20 orders + LTV.
- `PATCH  /v1/customers/:id/tags` — add/remove tags.
- `PATCH  /v1/customers/:id/preferences` — channels, marketingConsent.
- `POST   /v1/customers/:id/anonymize` — GDPR right-to-be-forgotten.

Shifts:

- `POST   /v1/shifts/start` — opens cash drawer count.
- `POST   /v1/shifts/end` — closes; computes variance.
- `GET    /v1/shifts?userId=&from=&to=`

### 📡 Real-time events

- `user:online` / `user:offline` — `lastActiveAt` updates → topbar
  presence.
- `shift:variance` — emitted when end-of-shift count differs from
  expected; drives the "Reconciliation needed" alert.

### ⏰ Async work

- **`customer.tier-recompute`** — nightly; reclassifies tiers based on
  rolling 12-month spend.
- **`customer.lapsed-tag`** — daily; auto-tags `lapsed` if `lastOrderAt`
  > 60 days.
- **`user.invite-expire`** — invalidates expired invite tokens.
- **`user.gdpr-anonymize`** — async pipeline: scrub PII, retain order
  rows with anonymized customer reference.

### 🗃 Cache strategy

Role permission set: cache 60s per role id; bumpVersion on role edit.
Customer tier denorm read: 5 min.

### 🔒 Permissions

| Endpoint           | OWNER | ADMIN | MANAGER              |
| ------------------ | ----- | ----- | -------------------- |
| Manage staff users | ✅    | ✅    | ✅ (own branch only) |
| Manage roles       | ✅    | ✅    |                      |
| View customers     | ✅    | ✅    | ✅                   |
| Tag / preferences  | ✅    | ✅    | ✅                   |
| GDPR anonymize     | ✅    |       |                      |
| Shifts             | ✅    | ✅    | ✅                   |

### 🧪 Tests

- Unit: invite-token expiry, PIN verification (bcrypt cost 4 for the
  PIN — a 4-digit space is small, mitigate by lockout).
- Integration: invite full flow, role permission edit propagates to
  next JWT issuance, customer anonymize purges PII.

### ✅ Acceptance

- All Users page lists staff + customers from API; group toggle works.
- Roles page edits permission sets; the matrix's `risk` flags drive
  highlights.
- Inviting a new staffer sends a real email and the link works.
- Customer profile shows real LTV / order count / tier.
- Audit log records invite, role assign, tag changes, anonymize.

### ⚠️ Pitfalls

1. **Permission caching.** A role edit must invalidate every JWT
   currently issued for users in that role. Use Phase 4's force-revoke
   path.
2. **PIN brute force.** 4-digit PIN is 10k space. Lock after 5 wrong PINs.
3. **GDPR is not delete.** Anonymise (zero PII fields, replace with
   tokens), keep the row for revenue continuity.
4. **Owner cannot be removed.** Enforce at DB constraint level.

---

## Phase F — Tenant settings, Taxes, Branding, Hardware

### 📌 Goal

Replace every hardcoded constant in the frontend (TAX_RATE = 0.05,
TABLES list, currency symbol, brand color) with values from a real
settings store. Also wire the Hardware section so receipts can actually
print.

### 📐 Frontend contract

`Settings.tsx` 15 sections. Settings → Restaurant carries logo, banner,
GSTIN; Settings → Branding has color + theme + custom domain;
Settings → Localization has currency + timezone + locale + week start;
Settings → Taxes has GSTIN + multi-slab + HSN; Settings → Payments
toggles methods; Settings → Hardware lists printers + KDS displays +
cash drawer + customer display.

### 🗄 Domain model

```prisma
// Tenant already exists. Extend:
model Tenant {
  // existing fields...
  legalName        String?
  gstin            String?
  pan              String?
  fssai            String?
  description      String?
  logoUrl          String?
  bannerUrl        String?
  brandColor       String   @default("#EC1B7C")
  brandTheme       String   @default("light")
  customDomain     String?  @unique
  contactEmail     String?
  contactPhone     String?
  invoicePrefix    String   @default("INV")
  invoiceSequence  Int      @default(1)
  numberLocale     String   @default("en-IN")
  weekStart        WeekStart @default(MONDAY)
  weightUnit       String   @default("g")
  demoMode         Boolean  @default(false)
}

model TaxSlab {
  id           String   @id @default(cuid())
  tenantId     String
  branchId     String?           // null = applies to all branches
  name         String            // 'GST 5%', 'GST 18% AC'
  rate         Decimal  @db.Decimal(5, 2)
  hsnCodes     String[] @default([])
  inclusive    Boolean  @default(false)
  isDefault    Boolean  @default(false)

  @@index([tenantId, branchId])
  @@map("tax_slabs")
}

model PaymentMethodConfig {
  id           String   @id @default(cuid())
  tenantId     String
  branchId     String?
  method       PaymentMethod
  enabled      Boolean  @default(true)
  preferred    Boolean  @default(false)
  serviceCharge Decimal @db.Decimal(5, 2) @default(0)
  meta         Json?

  @@unique([tenantId, branchId, method])
  @@map("payment_method_configs")
}

model HardwareDevice {
  id           String   @id @default(cuid())
  tenantId     String
  branchId     String
  type         HardwareType   // RECEIPT_PRINTER | KOT_PRINTER | KDS_DISPLAY | OSS_DISPLAY | CASH_DRAWER | CUSTOMER_DISPLAY | WEIGHING_SCALE
  label        String
  model        String?
  ip           String?
  macAddress   String?
  station      OrderStation?  // for KOT printers
  pairedAt     DateTime?
  lastSeenAt   DateTime?
  pairingToken String   @unique           // device authenticates with this
  active       Boolean  @default(true)

  @@index([tenantId, branchId, type])
  @@map("hardware_devices")
}

model NotificationPreference {
  id          String   @id @default(cuid())
  tenantId    String
  branchId    String?
  userId      String?            // null = tenant-wide default
  event       String             // 'newOrder', 'lowStock', 'reservationReminder'
  channel     String             // 'sound', 'push', 'email', 'sms'
  enabled     Boolean  @default(true)

  @@unique([tenantId, branchId, userId, event, channel])
  @@map("notification_preferences")
}

enum WeekStart    { MONDAY SUNDAY SATURDAY }
enum HardwareType { RECEIPT_PRINTER KOT_PRINTER KDS_DISPLAY OSS_DISPLAY CASH_DRAWER CUSTOMER_DISPLAY WEIGHING_SCALE }
```

### 🔌 API surface

- `GET   /v1/settings` — bundle: tenant, branding, localization,
  payment methods.
- `PATCH /v1/settings/tenant`
- `PATCH /v1/settings/branding`
- `PATCH /v1/settings/localization`
- CRUD on `/v1/tax-slabs`
- CRUD on `/v1/payment-method-configs`
- CRUD on `/v1/hardware-devices`
- `POST  /v1/hardware-devices/:id/pair` — issues + returns pairingToken
- `POST  /v1/notification-preferences/bulk` — set the matrix in one call
- `POST  /v1/settings/data/export` — ZIP of tenant's data
- `POST  /v1/settings/data/anonymize-tenant` — close-tenant flow
  (Phase K coordinates with billing).

Logo / banner upload uses the S3 path from Phase 5.

### ⏰ Async work

- **`settings.export-tenant-data`** — long-running ZIP build, posted to S3,
  emailed to owner.
- **`hardware.heartbeat-check`** — flags devices offline > 5 min.
- **`tenant.demo-reset`** — when `demoMode = true`, wipes data hourly.

### 🔒 Permissions

OWNER + ADMIN for all writes. MANAGER for branch-scoped subset.

### ✅ Acceptance

- Every hardcoded constant in the frontend (`TAX_RATE`, `TABLES`,
  brand color, currency) is sourced from API.
- A receipt prints to a paired printer when an order is paid.
- Demo banner disappears when `demoMode = false`.
- GDPR data export delivers a ZIP.

### ⚠️ Pitfalls

1. **Settings drift between branches.** Use the `branchId` override
   pattern: `null` = tenant default, branch override wins.
2. **Hardware pairing security.** Pairing tokens must rotate on PATCH;
   exposing a printer's IP in a leaked DB dump shouldn't grant
   permanent print access.
3. **Logo upload validation.** Limit to PNG/SVG/JPEG, max 2 MB,
   sanitize SVG (no embedded scripts).

---

## Phase G — QR Codes, scan analytics

### 📌 Goal

Mint, manage, and track QR codes that drive customers to the guest PWA.
Track scans + conversion to orders. Provide print-ready artwork. (The
hardware shop is out-of-scope; only QR mint + tracking is in.)

### 📐 Frontend contract

`QRCodes.tsx` types (already quoted above). The QR URL the UI shows is
`https://vuedine.app/m/{branchSlug}/{label-or-token}`.

### 🗄 Domain model

```prisma
model QrCode {
  id          String     @id @default(cuid())
  tenantId    String
  branchId    String
  type        QrType
  label       String                                // 'Table 7', 'Pickup counter', 'Delivery rider 03'
  url         String                                // public URL the QR encodes
  token       String     @unique                    // 16-char URL slug
  status      QrStatus   @default(ACTIVE)
  thumbnail   String?
  scans       Int        @default(0)                // denorm — incremented on scan
  ordersCount Int        @default(0)                // denorm — incremented on order placed via this QR

  // Linkage — tables already have qrToken; this generic store covers all the
  // non-table types (counter, takeaway, marketing).
  tableId     String?    @unique
  table       Table?     @relation(fields: [tableId], references: [id])

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  deletedAt   DateTime?

  @@index([tenantId, branchId, type])
  @@index([token])
  @@map("qr_codes")
}

model QrScan {
  id          String   @id @default(cuid())
  qrCodeId    String
  ip          String?
  userAgent   String?
  referrer    String?
  city        String?         // GeoIP enrich
  at          DateTime @default(now())

  @@index([qrCodeId, at])
  @@map("qr_scans")
}

enum QrType   { TABLE COUNTER TAKEAWAY DELIVERY MARKETING }
enum QrStatus { ACTIVE INACTIVE PENDING }
```

### 🔌 API surface

- `GET    /v1/qr-codes?branch=&type=`
- `GET    /v1/qr-codes/:id`
- `POST   /v1/qr-codes` — manual mint for non-table types.
- `PATCH  /v1/qr-codes/:id` — label, status.
- `DELETE /v1/qr-codes/:id`
- `POST   /v1/qr-codes/:id/regenerate` — new token; old token resolves to a
  "scan invalidated" page.
- `POST   /v1/qr-codes/bulk-print` — returns a multi-page PDF.
- `GET    /m/:branchSlug/:token` — public resolver. Records a scan,
  returns guest menu redirect target.
- `GET    /v1/qr-codes/:id/analytics` — daily scan + order conversion.

Tables get a QR row auto-minted on `POST /v1/branches/:id/tables` (already
spec'd in Phase A).

### 📡 Real-time events

- `qr:scan` — useful for Live Orders to indicate a new guest at table N.

### ⏰ Async work

- **`qr.geoip-enrich`** — async; fills `city` on QrScan from MaxMind /
  ipinfo.
- **`qr.daily-rollup`** — daily; rebuilds the analytics aggregates table
  for fast dashboard reads.

### ✅ Acceptance

- QR Codes page CRUD wired.
- Scan a printed QR → resolves to guest menu, scan recorded.
- Regenerating a QR invalidates the previous URL.
- Bulk print PDF downloads.

### ⚠️ Pitfalls

1. **Token guessability.** 16 chars base64url ≈ 96 bits — fine.
2. **Don't leak deleted branches.** Resolver must 404 for soft-deleted
   parents.
3. **Scan flood.** Rate-limit per IP to prevent inflated metrics.

---

## Phase H — Communications: Push, Subscribers, Messages

### 📌 Goal

Run marketing + transactional comms across email, SMS, WhatsApp, and web
push. Maintain the subscriber list with segments. Run a unified messages
inbox so support sees every conversation across channels.

### 📐 Frontend contract

`PushNotifications.tsx`, `Subscribers.tsx`, `Messages.tsx` types already
quoted. Audience evaluator rules already specified.

### 🗄 Domain model

```prisma
model NotificationCampaign {
  id            String   @id @default(cuid())
  tenantId      String
  type          CampaignType   // PUSH | EMAIL | SMS | WHATSAPP
  title         String
  body          String
  imageUrl      String?
  imageEmoji    String?
  ctaLabel      String?
  ctaUrl        String?
  audience      String          // segment id or 'custom'
  audienceQuery Json?           // for ad-hoc segments
  audienceSize  Int             @default(0)        // computed at schedule time
  status        CampaignStatus  @default(DRAFT)    // DRAFT | SCHEDULED | SENDING | SENT | FAILED | CANCELLED
  scheduledFor  DateTime?
  sentAt        DateTime?
  delivered     Int             @default(0)
  opened        Int             @default(0)
  clicked       Int             @default(0)
  failed        Int             @default(0)
  unsubscribed  Int             @default(0)

  createdById   String
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  events        CampaignEvent[]

  @@index([tenantId, status, scheduledFor])
  @@map("notification_campaigns")
}

model CampaignEvent {
  id           String   @id @default(cuid())
  campaignId   String
  customerId   String?
  type         CampaignEventType   // SENT | DELIVERED | OPENED | CLICKED | FAILED | UNSUBSCRIBED | BOUNCED
  channel      String              // 'push', 'email', 'sms', 'whatsapp'
  meta         Json?               // userAgent, error code, etc.
  at           DateTime @default(now())

  campaign     NotificationCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId, type])
  @@index([customerId, at])
  @@map("campaign_events")
}

model PushSubscription {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String
  endpoint     String   @unique
  keys         Json                 // { p256dh, auth }
  platform     String                // 'web', 'ios', 'android'
  deviceId     String?
  userAgent    String?
  createdAt    DateTime @default(now())
  lastSeenAt   DateTime @default(now())

  @@index([tenantId, userId])
  @@map("push_subscriptions")
}

// Inbox / Messages
model Conversation {
  id           String   @id @default(cuid())
  tenantId     String
  branchId     String?
  customerId   String?
  channel      ConversationChannel    // WHATSAPP | SMS | INSTAGRAM | WEBCHAT
  externalRef  String?                // provider conversation id
  status       ConversationStatus     @default(OPEN)
  unread       Int      @default(0)
  starred      Boolean  @default(false)
  tags         String[] @default([])
  agentId      String?
  lastAt       DateTime @default(now())
  lastSnippet  String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  messages     Message[]

  @@index([tenantId, status, lastAt(sort: Desc)])
  @@index([customerId, lastAt(sort: Desc)])
  @@index([externalRef])
  @@map("conversations")
}

model Message {
  id              String   @id @default(cuid())
  conversationId  String
  sender          MessageSender   // CUSTOMER | AGENT | BOT
  body            String
  attachments     Json?            // [{ url, kind }]
  read            Boolean  @default(false)
  externalRef     String?          // provider message id
  at              DateTime @default(now())

  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, at])
  @@index([externalRef])
  @@map("messages")
}

enum CampaignType        { PUSH EMAIL SMS WHATSAPP }
enum CampaignStatus      { DRAFT SCHEDULED SENDING SENT FAILED CANCELLED }
enum CampaignEventType   { SENT DELIVERED OPENED CLICKED FAILED UNSUBSCRIBED BOUNCED }
enum ConversationChannel { WHATSAPP SMS INSTAGRAM WEBCHAT }
enum ConversationStatus  { OPEN PENDING RESOLVED }
enum MessageSender       { CUSTOMER AGENT BOT }
```

### 🔌 API surface

Campaigns:

- CRUD on `/v1/campaigns`
- `POST /v1/campaigns/:id/send-now` — immediate send (puts queue job).
- `POST /v1/campaigns/:id/schedule` — body `{ at }`.
- `POST /v1/campaigns/:id/cancel`
- `GET  /v1/campaigns/:id/events?type=&page=`
- `POST /v1/campaigns/preview-audience` — returns count + sample subscribers
  for the segment query (used by the editor).

Subscribers:

- CRUD on `/v1/customers` already covers individuals (Phase E).
- `POST /v1/customers/import` — CSV with deduplication + validation.
- `POST /v1/customers/bulk` — change channels / unsubscribe in batch.
- `GET  /v1/segments` — list saved segments.
- `POST /v1/segments` — save a custom rule (named segment).

Push:

- `POST /v1/push/subscribe` — register a web push endpoint.
- `DELETE /v1/push/subscribe/:id`
- `POST /v1/push/test` — admin test push to self.

Messages:

- `GET  /v1/conversations?status=&channel=&search=`
- `GET  /v1/conversations/:id`
- `POST /v1/conversations/:id/messages` — reply.
- `POST /v1/conversations/:id/assign` — assign agent.
- `PATCH /v1/conversations/:id/status` — open / pending / resolved.
- `PATCH /v1/conversations/:id/tags`
- `PATCH /v1/conversations/:id/star`
- Webhook ingest: `POST /v1/webhooks/whatsapp`, `/sms`, `/instagram` —
  signature-verified.

### 📡 Real-time events

- `campaign:status` — when a job batch completes.
- `conversation:new` — new inbound message.
- `conversation:read` — agent marked thread as read.

### ⏰ Async work

Already in BullMQ:

- **`notification`** queue — per-recipient deliveries split into batches.
- **`email`** queue — transactional + campaign.
- New **`messaging`** queue — outbound WhatsApp / SMS / IG.
- New **`segment-eval`** queue — recompute audience size for SCHEDULED
  campaigns periodically.

### 🗃 Cache strategy

Active segments + their evaluated rules: 5 min cache.
Conversation list: 30s cache, invalidated on inbound webhook.

### 🔒 Permissions

Campaign create + send: OWNER / ADMIN / MANAGER (`crm.message`).
Subscribers view: any role with `crm.view`.
Messages reply: agents (any logged-in staff with `crm.message`).
GDPR unsubscribe link: open public endpoint.

### 🧪 Tests

- Audience evaluator returns deterministic results for fixture segments.
- Campaign send pipeline: scheduled → at time → sending → batched → sent;
  per-recipient events recorded.
- WhatsApp webhook signature verification + idempotent ingestion.

### ✅ Acceptance

- Push campaigns send to subscribed users (web push first; FCM/APNS in
  follow-up).
- Subscribers list, segments, CSV import all work.
- Messages inbox shows real WhatsApp / SMS conversations.
- Bot reply slot (Phase L can override) wired.

### ⚠️ Pitfalls

1. **WhatsApp template rules.** Outside the 24h customer-care window,
   only approved templates can send. Validate at API level before queueing.
2. **Unsubscribe everywhere.** GDPR requires single click out of every
   email. Track per-channel unsubscribes.
3. **Bounce vs failure.** Hard bounce → mark Bounced status; soft bounce
   → retry.
4. **Don't send to customers without `marketingConsent`.** Phase E adds
   this flag.

---

## Phase I — Reports, KPIs, Dashboard aggregates

### 📌 Goal

Replace every mock number on the Dashboard landing page and Sales Report
with real aggregations. Enable date-range + branch filters end-to-end.

### 📐 Frontend contract

Dashboard.tsx + SalesReport.tsx mock shapes already enumerated.

### 🗄 Domain model

Two layers:

1. **No new write models** — aggregations sit on top of existing
   `Order` / `Payment` / `OrderItem` / `Customer` rows.
2. **Materialized views** for hot reads:

```sql
CREATE MATERIALIZED VIEW mv_daily_sales AS
  SELECT
    tenant_id, branch_id,
    date_trunc('day', delivered_at AT TIME ZONE tenant_timezone) AS day,
    COUNT(*) FILTER (WHERE status = 'DELIVERED') AS orders,
    SUM(total)    FILTER (WHERE status = 'DELIVERED') AS gross,
    SUM(discount) FILTER (WHERE status = 'DELIVERED') AS discount,
    SUM(tax)      FILTER (WHERE status = 'DELIVERED') AS tax,
    SUM(tip)      FILTER (WHERE status = 'DELIVERED') AS tip,
    SUM(delivery) FILTER (WHERE status = 'DELIVERED') AS delivery
  FROM orders
  GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX ON mv_daily_sales (tenant_id, branch_id, day);
-- Refresh nightly via cron + immediately on write via triggers (carefully).
```

Plus `mv_top_customers`, `mv_item_popularity`, `mv_payment_mix_daily`.

### 🔌 API surface

- `GET /v1/reports/dashboard?from=&to=&branchId=`
  → returns the full `Dashboard.tsx` payload in one shot:
  `{ kpis, orderStatusCounts, salesSummary, ordersSummary, customerStats,
   topCustomers, featuredItems, mostPopularItems }`
- `GET /v1/reports/sales?from=&to=&branchId=&type=&payment=&status=`
  → paginated rows + KPIs + hourly bars + paymentMix + typeMix.
- `GET /v1/reports/sales/export?format=csv|excel|pdf` — streamed.
- `GET /v1/reports/items/popularity?period=&branchId=`
- `GET /v1/reports/customers/top?period=&branchId=`
- `GET /v1/reports/staff/performance?from=&to=&branchId=` (per-waiter
  orders, per-cashier sales, per-chef average prep).

### ⏰ Async work

- **`reports.refresh-mv`** — every 5 minutes for the current day's
  materialized view rows, nightly for historic.
- **`reports.export-build`** — long-running CSV/PDF builds → S3 URL +
  email.

### 🗃 Cache strategy

KPIs cached 60s with date-range + branch in the key. Invalidate on order
state change for current-day rollups.

### 🧪 Tests

Synthetic dataset of N orders → compute totals manually → endpoint must
match within currency precision.

### ✅ Acceptance

- Dashboard landing renders real numbers within 500 ms p95.
- Date range picker filters every metric accurately.
- CSV export of sales report matches the table rows shown.

### ⚠️ Pitfalls

1. **Time zone errors.** Always project `delivered_at` into the tenant's
   timezone before truncating to day. UTC math kills daily reports for
   IST/IST+ tenants.
2. **MV refresh blocking.** Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
   to avoid table locks.
3. **Stale current-day MV.** Keep current-day reads going against base
   tables OR refresh MV on a 60 sec interval for that one row.

---

## Phase J — Integrations layer

### 📌 Goal

Generic integration store + per-provider adapters for the 24 integrations
the UI lists. MVP: Razorpay (already in Phase C), Zomato + Swiggy
(aggregator order ingest), WhatsApp Business (messaging). Others stub'd as
"Available" until needed.

### 🗄 Domain model

```prisma
model Integration {
  id            String   @id @default(cuid())
  tenantId      String
  branchId      String?
  provider      String   // 'zomato', 'swiggy', 'razorpay', 'whatsapp', ...
  category      IntegrationCategory
  status        IntegrationStatus @default(AVAILABLE)
  credentials   Json     // ENCRYPTED via Phase 9 field-level (sensitive fields)
  webhookUrl    String?  // ours, for the partner to call
  webhookSecret String?  // they sign callbacks with this
  config        Json?    // non-secret toggles (auto_accept, auto_print, etc.)
  meta          Json?
  lastSyncAt    DateTime?
  lastErrorAt   DateTime?
  lastError     String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, branchId, provider])
  @@index([provider, status])
  @@map("integrations")
}

model WebhookEvent {
  id            String   @id @default(cuid())
  integrationId String?
  provider      String
  externalId    String              // for dedupe
  signature     String?
  rawPayload    Json
  receivedAt    DateTime @default(now())
  processedAt   DateTime?
  errorMessage  String?

  @@unique([provider, externalId])
  @@index([processedAt])
  @@map("webhook_events")
}

enum IntegrationCategory { AGGREGATOR PAYMENTS MESSAGING ACCOUNTING REVIEWS MARKETING HARDWARE AI }
enum IntegrationStatus   { CONNECTED AVAILABLE COMING_SOON ERROR }
```

### 🔌 API surface

- `GET    /v1/integrations`
- `GET    /v1/integrations/:provider`
- `POST   /v1/integrations/:provider/connect` — body: credentials.
- `POST   /v1/integrations/:provider/disconnect`
- `POST   /v1/integrations/:provider/test` — provider-specific ping.
- `POST   /v1/integrations/:provider/sync` — manual menu / inventory push.
- Inbound webhooks: one per provider, all signature-verified.

### ⏰ Async work

- **`webhook.process`** — generic worker; routes raw events to the right
  provider adapter (Zomato → orders module, Razorpay → payments, WhatsApp
  → conversations).
- **`integration.sync`** — provider-scoped (e.g. Zomato menu push).

### 🔒 Permissions

OWNER / ADMIN. Credentials are encrypted using Phase 9's `crypto.js`
helper before persisting.

### ✅ Acceptance

- Razorpay payments flow already works (Phase C).
- Zomato webhook lands and creates an Order with `channel=ONLINE`,
  `source='Zomato'`.
- WhatsApp Business webhook creates an inbound Message (Phase H linkage).

### ⚠️ Pitfalls

1. **Credential leaks.** Never log `credentials.*`. Phase 9 redaction
   list must include known credential field names.
2. **Idempotency.** `WebhookEvent` `(provider, externalId)` unique
   constraint is the only thing that prevents double-orders.

---

## Phase K — SaaS billing (Vuedine's own)

### 📌 Goal

Charge tenants. Enforce plan limits. Issue invoices. Handle upgrades,
downgrades, cancellations.

### 📐 Frontend contract

`Subscription.tsx` types already quoted (Plan, usage, addons, invoices).

### 🗄 Domain model

```prisma
model Plan {
  id            String   @id @default(cuid())
  slug          String   @unique         // 'starter', 'growth', 'enterprise'
  name          String
  blurb         String?
  monthly       Decimal  @db.Decimal(12, 2)
  yearly        Decimal  @db.Decimal(12, 2)         // monthly equivalent
  features      Json                                 // [{ label, included }]
  active        Boolean  @default(true)

  @@map("plans")
}

model Subscription {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  planSlug      String
  cycle         BillingCycle           // MONTHLY | YEARLY
  status        SubscriptionStatus     // TRIALING | ACTIVE | PAST_DUE | CANCELLED
  startedAt     DateTime
  renewsAt      DateTime
  cancelledAt   DateTime?
  trialEndsAt   DateTime?
  seatLimit     Int
  branchLimit   Int
  storageLimitGb Decimal  @db.Decimal(8, 2)
  aiQuota       Int
  meta          Json?

  invoices      Invoice[]
  usageRollups  UsageRollup[]

  @@map("subscriptions")
}

model Invoice {
  id              String   @id @default(cuid())
  tenantId        String
  subscriptionId  String
  number          String   @unique     // 'INV-2026-0521'
  period          String                // 'May 2026'
  amount          Decimal  @db.Decimal(12, 2)
  taxAmount       Decimal  @db.Decimal(12, 2) @default(0)
  status          InvoiceStatus
  paymentRef      String?
  pdfUrl          String?
  issuedAt        DateTime
  dueAt           DateTime
  paidAt          DateTime?

  subscription    Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([tenantId, issuedAt(sort: Desc)])
  @@map("invoices")
}

model UsageRollup {
  id              String   @id @default(cuid())
  subscriptionId  String
  metric          String                // 'outlets', 'seats', 'aiRequests', 'storageGb'
  value           Decimal  @db.Decimal(14, 4)
  capturedAt      DateTime @default(now())

  subscription    Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId, metric, capturedAt])
  @@map("usage_rollups")
}

enum BillingCycle      { MONTHLY YEARLY }
enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE CANCELLED }
enum InvoiceStatus      { DRAFT OPEN PAID FAILED VOID }
```

### 🔌 API surface

- `GET  /v1/subscription` — current plan + usage.
- `POST /v1/subscription/change-plan` — body `{ planSlug, cycle }`.
- `POST /v1/subscription/cancel`
- `POST /v1/subscription/resume`
- `POST /v1/subscription/addons/:id/toggle`
- `GET  /v1/invoices`
- `GET  /v1/invoices/:id`
- `GET  /v1/invoices/:id/download` — pdf
- Webhook: `POST /v1/webhooks/billing` — Razorpay / Stripe billing
  events.

### ⏰ Async work

- **`billing.invoice-cycle`** — daily; generates invoices on renewsAt.
- **`billing.usage-capture`** — hourly; computes usage metrics.
- **`billing.dunning`** — past-due: day 3 email, day 7 SMS, day 14
  freeze write paths.

### 🔒 Permissions

OWNER only on plan change + cancel. Anyone with `settings.billing` can
view.

### 🧪 Tests

- Mock the billing webhook payloads end-to-end.
- Quota enforcement: creating an 11th branch on a 3-branch plan must
  fail with a clear error and link to upgrade.

### ✅ Acceptance

- Subscription page shows real plan + usage.
- Plan upgrade triggers Razorpay subscription mandate.
- Failed payment locks **write** paths after grace period; reads stay
  open.

### ⚠️ Pitfalls

1. **Don't lock auth.** Past-due tenants must still be able to log in
   and pay — auth + billing routes always green.
2. **Proration on upgrade.** Start simple: charge full cycle on switch,
   credit unused cycle on next invoice.
3. **GST invoice format.** Indian compliance is strict; use a vetted
   template + invoice-number sequence.

---

## Phase L — AI Helper, demand forecasting, smart suggestions

### 📌 Goal

Out of MVP scope — placeholder so the AI Helper FAB and Vuedine AI
integration card both have a real backend later. Roughly: chat assistant
context-grounded on the tenant's data + LLM-driven suggestions for
pricing, inventory, staffing.

Will detail when prioritized post-launch. Pattern: per-tenant vector store
of menu items / customer history / sales patterns; OpenAI / open model
behind a per-tenant API key (already configurable in Integrations);
quota enforcement via Phase K.

---

## Cross-phase patterns

These rules cut across every phase — bake them in:

1. **Server is authoritative for money.** Frontend asks the server for
   totals via `/calculate`. Never trusts its own math.
2. **Idempotency-Key on every state-changing public endpoint.** Cart →
   order, payment intent, webhook ingestion. Stored in Redis 24h.
3. **Optimistic locking** via `updatedAt` on Order, Payment, TableSession.
   Conflicts return 409 with the latest server state.
4. **Audit log** on every mutation that touches money or permissions.
   Already wired via `auditService.record(...)`.
5. **Cache prefix shared between route + service** so a single
   `bumpVersion` invalidates both layers (Phase 5 pattern).
6. **All public endpoints rate-limited** by IP + by API key. Internal
   ones by user. Phase 3 already provides the limiter; new modules
   register limit configs.
7. **Tenant-scoped queries by default.** Repositories take `tenantId` as
   a constructor arg or a per-call param; forgetting it is a bug.
8. **Soft delete** with `deletedAt`. Hard delete only via the
   admin-gated GDPR pipeline.
9. **Real-time payloads are denormalized snapshots** — never include DB
   row references the client can't resolve.
10. **OpenAPI annotations** on every new route. CI doc-drift gate from
    Phase 13 enforces this.

---

## Definition of done — per phase

A phase is done when **all** of:

- [ ] Prisma migration applied + reviewed; rollback plan documented.
- [ ] All routes annotated with `@openapi` blocks; `npm run docs:generate`
      green.
- [ ] zod validators on every request body + query.
- [ ] Permission matrix asserted by integration tests (positive + negative).
- [ ] Unit + integration tests, coverage threshold respected (Phase 10
      ratchet plan).
- [ ] Cache layer wired with shared prefix.
- [ ] Audit log on every state mutation.
- [ ] Real-time events (where applicable) emitted + consumed by the
      relevant frontend module.
- [ ] Frontend module deletes its mock data and points at the API.
- [ ] Docs runbook entry under `docs/runbooks/<module>.md`.
- [ ] Smoke test added to `scripts/smoke-test.sh` if the path is
      critical.
- [ ] Lint + format clean. `npm run security:routes` passes.
- [ ] `audit-ci` clean.

---

## What launch looks like

When phases A → I are done, Vuedine has:

- Full POS workflow from menu browse to printed receipt.
- Customer PWA from QR scan to feedback.
- KDS + OSS in real time.
- Promotions auto-applied + code-redeemed.
- Sales reports the owner can defend in a board meeting.
- Staff + customers managed properly.
- Settings deep enough that the same software runs a 1-outlet bistro and
  a 4-outlet group.
- QR codes everywhere, scan analytics flowing.

Then K (billing) flips on revenue. J (integrations) widens reach. H
(communications) drives retention. L (AI) is the moat.

This is the path. Each phase here is approximately the same scale as a
single phase from `BACKEND_PHASES.md`. Estimate ≈ 14 weeks of focused work
to launch (A–I + K), with critical-path items first.
