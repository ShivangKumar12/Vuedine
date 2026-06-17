# Vuedine — Restaurant POS System — Complete Features Checklist

> **Project:** Vuedine Restaurant POS  
> **Last Updated:** June 2026  
> **Competitor Benchmark:** Petpooja (1,00,000+ outlets)  
> **Core USP:** QR-Based Ordering (No App Download)

---

## Status Legend

- ⬜ Not Started
- 🟡 In Progress
- ✅ Completed
- ❌ Dropped / Deferred

---

## 1. 🏠 Main Dashboard (Owner Home Screen)

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 1.1 | Live sales today (₹ amount, real-time) | P1 | ⬜ |
| 1.2 | Active tables count (occupied vs total) | P1 | ⬜ |
| 1.3 | Kitchen queue status (pending orders count) | P1 | ⬜ |
| 1.4 | Top-selling item of the day | P2 | ⬜ |
| 1.5 | Low stock alerts (critical inventory warnings) | P2 | ⬜ |
| 1.6 | Pending deliveries count | P2 | ⬜ |
| 1.7 | Today's total cash collected | P1 | ⬜ |
| 1.8 | Orders by source breakdown (QR / Waiter / Zomato / Swiggy) | P2 | ⬜ |
| 1.9 | Average bill value today | P2 | ⬜ |
| 1.10 | Peak hour indicator (current rush level) | P3 | ⬜ |
| 1.11 | New customer vs returning customer split | P3 | ⬜ |
| 1.12 | Quick action buttons (New Order, Open Table, View KDS) | P1 | ⬜ |
| 1.13 | Notification center (unread alerts) | P2 | ⬜ |
| 1.14 | Revenue comparison vs yesterday/last week | P3 | ⬜ |
| 1.15 | Hourly sales mini-chart | P3 | ⬜ |

---

## 2. 📱 QR Ordering System (Customer-Facing PWA)

### 2.1 QR Code Management (Admin Side)

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 2.1.1 | Generate unique QR code per table | P1 | ⬜ |
| 2.1.2 | QR URL format: `menu.vuedine.com/r/{restaurantId}/t/{tableId}` | P1 | ⬜ |
| 2.1.3 | Regenerate QR code (invalidate old) | P1 | ⬜ |
| 2.1.4 | Bulk QR code generation (all tables) | P2 | ⬜ |
| 2.1.5 | Download QR as PNG/PDF (print-ready) | P1 | ⬜ |
| 2.1.6 | QR code on standee/tent card template | P2 | ⬜ |
| 2.1.7 | QR menu branding (restaurant logo, colors) | P2 | ⬜ |
| 2.1.8 | QR for takeaway counter (no table linked) | P2 | ⬜ |
| 2.1.9 | QR for direct online ordering (shareable link for social media) | P2 | ⬜ |

### 2.2 Customer QR Menu Experience

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 2.2.1 | Restaurant logo & branding on menu page | P1 | ⬜ |
| 2.2.2 | Food photos with descriptions | P1 | ⬜ |
| 2.2.3 | Veg 🟢 / Non-Veg 🔴 indicators | P1 | ⬜ |
| 2.2.4 | Category-wise menu browsing | P1 | ⬜ |
| 2.2.5 | Search by item name | P1 | ⬜ |
| 2.2.6 | Item availability toggle (live — greyed out if unavailable) | P1 | ⬜ |
| 2.2.7 | Portion size variants (Half/Full, S/M/L) | P1 | ⬜ |
| 2.2.8 | Add-ons & customizations (extra cheese, toppings) | P1 | ⬜ |
| 2.2.9 | Special instructions text field per item | P1 | ⬜ |
| 2.2.10 | Bestseller / Chef's Special badges | P2 | ⬜ |
| 2.2.11 | Multi-language menu support (Hindi, Tamil, Telugu, etc.) | P3 | ⬜ |
| 2.2.12 | Cart with quantity controls (+/-) | P1 | ⬜ |
| 2.2.13 | Sticky cart button with running total | P1 | ⬜ |
| 2.2.14 | Order history for current session | P2 | ⬜ |
| 2.2.15 | Estimated preparation time display | P3 | ⬜ |
| 2.2.16 | "Call Waiter" button | P2 | ⬜ |
| 2.2.17 | "Request Bill" button | P2 | ⬜ |
| 2.2.18 | Allergy info / dietary tags | P3 | ⬜ |
| 2.2.19 | Calorie info (optional per item) | P4 | ⬜ |
| 2.2.20 | Combo/set menu display | P2 | ⬜ |
| 2.2.21 | Online payment via QR menu (pay before/after) | P2 | ⬜ |
| 2.2.22 | Order confirmation animation with order number | P1 | ⬜ |
| 2.2.23 | Multiple rounds of ordering (add to running bill) | P1 | ⬜ |
| 2.2.24 | No login/signup required (anonymous session) | P1 | ⬜ |
| 2.2.25 | Works on any smartphone browser (PWA) | P1 | ⬜ |
| 2.2.26 | Spicy level indicator 🌶️ | P3 | ⬜ |
| 2.2.27 | Jain / Vegan filter | P3 | ⬜ |

### 2.3 QR Order Admin Controls

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 2.3.1 | View live QR orders in real-time | P1 | ⬜ |
| 2.3.2 | Accept / reject QR orders manually | P1 | ⬜ |
| 2.3.3 | Auto-accept orders toggle | P1 | ⬜ |
| 2.3.4 | Notification sound on new QR order | P1 | ⬜ |
| 2.3.5 | Customer call-waiter requests view | P2 | ⬜ |
| 2.3.6 | Customer bill-request notifications | P2 | ⬜ |
| 2.3.7 | QR ordering ON/OFF toggle (per table or global) | P1 | ⬜ |
| 2.3.8 | Online payment via QR ON/OFF toggle | P2 | ⬜ |

---

## 3. 🧾 Billing & Invoicing

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 3.1 | Create new bill (manual counter order) | P1 | ⬜ |
| 3.2 | View all active/running orders | P1 | ⬜ |
| 3.3 | Order type filter (Dine-in / Delivery / Takeaway) | P1 | ⬜ |
| 3.4 | Order source filter (QR / Waiter / Zomato / Swiggy) | P2 | ⬜ |
| 3.5 | Auto CGST (2.5%) + SGST (2.5%) = 5% GST | P1 | ⬜ |
| 3.6 | IGST for inter-state (12%/18%) | P2 | ⬜ |
| 3.7 | Service charge toggle (configurable %) | P1 | ⬜ |
| 3.8 | Discount on item level (flat ₹ or %) | P1 | ⬜ |
| 3.9 | Discount on bill level (flat ₹ or %) | P1 | ⬜ |
| 3.10 | Coupon / promo code apply | P2 | ⬜ |
| 3.11 | Loyalty points redemption on bill | P2 | ⬜ |
| 3.12 | Split bill — by item | P1 | ⬜ |
| 3.13 | Split bill — equal split among X people | P1 | ⬜ |
| 3.14 | Merge bills from multiple tables | P2 | ⬜ |
| 3.15 | Transfer order to another table | P1 | ⬜ |
| 3.16 | Complimentary items (with manager authorization) | P2 | ⬜ |
| 3.17 | Round-off adjustments (₹0.50 rounding) | P2 | ⬜ |
| 3.18 | Bill edit after creation (requires authorization) | P2 | ⬜ |
| 3.19 | Cancel bill with mandatory reason logging | P1 | ⬜ |
| 3.20 | Bill reprint (any past bill) | P1 | ⬜ |
| 3.21 | Digital bill via WhatsApp | P2 | ⬜ |
| 3.22 | Digital bill via SMS | P3 | ⬜ |
| 3.23 | Day-end cash register close/report | P1 | ⬜ |
| 3.24 | Settle with multiple payment modes (part cash + part UPI) | P1 | ⬜ |
| 3.25 | KOT-to-Bill linking (view all KOTs in a bill) | P1 | ⬜ |
| 3.26 | Void/cancelled bills log (audit trail) | P1 | ⬜ |
| 3.27 | GST invoice generation (compliant format) | P1 | ⬜ |
| 3.28 | B2B invoice with buyer GSTIN | P3 | ⬜ |
| 3.29 | Advance payment / token collection | P3 | ⬜ |
| 3.30 | Refund processing with reason | P2 | ⬜ |

---

## 4. 🎫 KOT (Kitchen Order Tickets)

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 4.1 | Auto-generate KOT on order placement | P1 | ⬜ |
| 4.2 | Print KOT to kitchen thermal printer | P1 | ⬜ |
| 4.3 | Display KOT on KDS screen | P1 | ⬜ |
| 4.4 | Category-wise KOT routing (hot kitchen / cold / bar) | P1 | ⬜ |
| 4.5 | Add items to existing running KOT | P1 | ⬜ |
| 4.6 | Cancel items from KOT with reason | P1 | ⬜ |
| 4.7 | KOT re-print (paper jam recovery) | P2 | ⬜ |
| 4.8 | Time-stamp on every KOT | P1 | ⬜ |
| 4.9 | Table number displayed on KOT | P1 | ⬜ |
| 4.10 | Waiter/captain name on KOT | P2 | ⬜ |
| 4.11 | Special instructions highlighted (bold/red) | P1 | ⬜ |
| 4.12 | KOT number (sequential per day) | P1 | ⬜ |
| 4.13 | View all pending KOTs | P1 | ⬜ |
| 4.14 | KOT history log (searchable) | P2 | ⬜ |
| 4.15 | Modified KOT indicator (items added/removed) | P2 | ⬜ |

---

## 5. 📺 Kitchen Display System (KDS)

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 5.1 | Orders displayed with table number & order time | P1 | ⬜ |
| 5.2 | Color-coding: New (green) → Preparing (yellow) → Done (grey) | P1 | ⬜ |
| 5.3 | Sound alert for new orders | P1 | ⬜ |
| 5.4 | Tap/click to mark item as "preparing" | P1 | ⬜ |
| 5.5 | Tap/click to mark item as "done/ready" | P1 | ⬜ |
| 5.6 | Timer per order (how long waiting) | P1 | ⬜ |
| 5.7 | Priority/rush order flags | P2 | ⬜ |
| 5.8 | Station-wise view (hot kitchen, cold kitchen, bar, dessert) | P2 | ⬜ |
| 5.9 | Multiple KDS screens support | P2 | ⬜ |
| 5.10 | Works on any Android tablet/TV (browser-based) | P1 | ⬜ |
| 5.11 | Bump bar support (physical button for chefs) | P3 | ⬜ |
| 5.12 | Kitchen performance reports (avg prep time) | P2 | ⬜ |
| 5.13 | Offline mode (works without internet) | P1 | ⬜ |
| 5.14 | Order recall (bring back completed order) | P3 | ⬜ |
| 5.15 | All-day summary view (total items prepared) | P3 | ⬜ |
| 5.16 | Real-time sync via WebSocket | P1 | ⬜ |

---

## 6. 🪑 Table Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 6.1 | Visual floor plan (bird's-eye view) | P1 | ⬜ |
| 6.2 | Table status: 🟢 Free | P1 | ⬜ |
| 6.3 | Table status: 🔴 Occupied (order running) | P1 | ⬜ |
| 6.4 | Table status: 🟡 Bill generated, awaiting payment | P1 | ⬜ |
| 6.5 | Table status: 🔵 Reserved / Pre-booked | P2 | ⬜ |
| 6.6 | Table status: 🟠 Cleaning in progress | P3 | ⬜ |
| 6.7 | Create sections (Indoor, Outdoor, Terrace, AC, Non-AC) | P1 | ⬜ |
| 6.8 | Add new tables | P1 | ⬜ |
| 6.9 | Edit table (number, section, capacity) | P1 | ⬜ |
| 6.10 | Remove/deactivate tables | P1 | ⬜ |
| 6.11 | Table shape display (round, square, rectangle) | P3 | ⬜ |
| 6.12 | Table capacity (2/4/6/8/10 seater) | P1 | ⬜ |
| 6.13 | Merge adjacent tables (for large parties) | P2 | ⬜ |
| 6.14 | Transfer order to another table | P1 | ⬜ |
| 6.15 | Table reservation creation | P2 | ⬜ |
| 6.16 | Reservation time slot management | P2 | ⬜ |
| 6.17 | Waitlist management | P3 | ⬜ |
| 6.18 | Table time tracking (occupied duration) | P2 | ⬜ |
| 6.19 | Generate/regenerate QR per table | P1 | ⬜ |
| 6.20 | Print QR code for table | P1 | ⬜ |
| 6.21 | Table running order amount display | P2 | ⬜ |
| 6.22 | Drag & drop table arrangement on floor plan | P3 | ⬜ |

---

## 7. 🍽️ Menu Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 7.1 | Create/edit/delete categories | P1 | ⬜ |
| 7.2 | Create/edit/delete sub-categories | P1 | ⬜ |
| 7.3 | Category reorder (drag & drop) | P2 | ⬜ |
| 7.4 | Add new menu item | P1 | ⬜ |
| 7.5 | Edit menu item (name, description, price) | P1 | ⬜ |
| 7.6 | Delete/archive menu item | P1 | ⬜ |
| 7.7 | Food photo upload per item | P1 | ⬜ |
| 7.8 | Veg / Non-Veg / Egg tag per item | P1 | ⬜ |
| 7.9 | Jain / Vegan tag per item | P2 | ⬜ |
| 7.10 | Spicy level indicator (1-3 🌶️) | P3 | ⬜ |
| 7.11 | Allergen information per item | P3 | ⬜ |
| 7.12 | Calorie count per item | P4 | ⬜ |
| 7.13 | Bestseller badge toggle | P2 | ⬜ |
| 7.14 | New item badge toggle | P2 | ⬜ |
| 7.15 | Chef's Special badge toggle | P2 | ⬜ |
| 7.16 | Toggle item availability ON/OFF (instant sold-out) | P1 | ⬜ |
| 7.17 | Bulk import menu via Excel/CSV | P2 | ⬜ |
| 7.18 | Bulk export menu to Excel/CSV | P3 | ⬜ |
| 7.19 | Variants management (Half/Full, S/M/L, etc.) | P1 | ⬜ |
| 7.20 | Add-ons & extras per item (extra cheese, extra gravy) | P1 | ⬜ |
| 7.21 | Combo / Set meal creation | P2 | ⬜ |
| 7.22 | Time-based menu scheduling (Breakfast / Lunch / Dinner) | P3 | ⬜ |
| 7.23 | Separate Dine-in vs Delivery menu | P2 | ⬜ |
| 7.24 | Price override per order type (dine-in vs delivery) | P3 | ⬜ |
| 7.25 | Item-level GST slab configuration (5%/12%/18%) | P1 | ⬜ |
| 7.26 | HSN/SAC code per item | P2 | ⬜ |
| 7.27 | Multi-language item names | P3 | ⬜ |
| 7.28 | QR menu auto-sync on any menu change | P1 | ⬜ |
| 7.29 | Multi-outlet menu push/sync | P3 | ⬜ |
| 7.30 | Menu item reorder within category (drag & drop) | P2 | ⬜ |
| 7.31 | Item short code for quick billing | P2 | ⬜ |

---

## 8. 📦 Inventory & Stock Management

### 8.1 Raw Material Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 8.1.1 | Add raw materials (chicken, oil, rice, spices, etc.) | P2 | ⬜ |
| 8.1.2 | Edit raw material details | P2 | ⬜ |
| 8.1.3 | Delete/archive raw materials | P2 | ⬜ |
| 8.1.4 | Define unit of measurement (kg, litre, piece, ml, gm) | P2 | ⬜ |
| 8.1.5 | Current stock level per item | P2 | ⬜ |
| 8.1.6 | Set minimum stock alert threshold | P2 | ⬜ |
| 8.1.7 | Auto-deduct stock when dish is ordered (recipe-based) | P2 | ⬜ |
| 8.1.8 | Manual stock adjustment (with reason) | P2 | ⬜ |
| 8.1.9 | Cost per unit tracking | P2 | ⬜ |
| 8.1.10 | Stock-in entries from purchases | P2 | ⬜ |

### 8.2 Recipe Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 8.2.1 | Define recipe per menu item (list of raw materials + qty) | P2 | ⬜ |
| 8.2.2 | Multi-stage recipes (base sauce → final dish) | P3 | ⬜ |
| 8.2.3 | Recipe cost calculation (auto from raw material costs) | P2 | ⬜ |
| 8.2.4 | Food cost % per dish | P2 | ⬜ |
| 8.2.5 | Gross margin per dish | P2 | ⬜ |
| 8.2.6 | Recipe version history | P4 | ⬜ |

### 8.3 Supplier Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 8.3.1 | Add/edit/delete suppliers | P2 | ⬜ |
| 8.3.2 | Supplier contact details | P2 | ⬜ |
| 8.3.3 | Assign suppliers to raw materials | P2 | ⬜ |
| 8.3.4 | Purchase order generation | P3 | ⬜ |
| 8.3.5 | Purchase order approval workflow | P3 | ⬜ |
| 8.3.6 | Supplier-wise purchase history | P3 | ⬜ |
| 8.3.7 | Supplier payment tracking | P3 | ⬜ |

### 8.4 Wastage & Alerts

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 8.4.1 | Food wastage entry with reason | P2 | ⬜ |
| 8.4.2 | Wastage report by period | P2 | ⬜ |
| 8.4.3 | Low stock push notifications | P2 | ⬜ |
| 8.4.4 | Out-of-stock auto-disable menu item | P3 | ⬜ |
| 8.4.5 | Reorder suggestions (smart) | P3 | ⬜ |
| 8.4.6 | Theoretical vs actual consumption gap (pilferage detection) | P3 | ⬜ |

---

## 9. 👥 CRM & Customer Management

### 9.1 Customer Database

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 9.1.1 | Customer list with search/filter | P2 | ⬜ |
| 9.1.2 | Customer profile (name, phone, email) | P2 | ⬜ |
| 9.1.3 | Auto-capture customer from bill (phone number) | P2 | ⬜ |
| 9.1.4 | Complete order history per customer | P2 | ⬜ |
| 9.1.5 | Favorite items tracking | P3 | ⬜ |
| 9.1.6 | Average spend per visit | P2 | ⬜ |
| 9.1.7 | Visit frequency tracking | P2 | ⬜ |
| 9.1.8 | Birthday & anniversary capture | P2 | ⬜ |
| 9.1.9 | Customer segmentation (VIP / Regular / New / Inactive) | P3 | ⬜ |
| 9.1.10 | Feedback history per customer | P3 | ⬜ |
| 9.1.11 | Blacklist/block customer | P3 | ⬜ |
| 9.1.12 | Customer notes (free-text) | P3 | ⬜ |
| 9.1.13 | Customer import from Excel/CSV | P3 | ⬜ |

### 9.2 Loyalty & Rewards Program

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 9.2.1 | Configure points earning rate (X pts per ₹100 spent) | P2 | ⬜ |
| 9.2.2 | Points redemption rules (Y pts = ₹Z discount) | P2 | ⬜ |
| 9.2.3 | Loyalty tiers (Silver / Gold / Platinum) | P3 | ⬜ |
| 9.2.4 | Tier-based benefits configuration | P3 | ⬜ |
| 9.2.5 | Birthday/anniversary bonus points (auto) | P3 | ⬜ |
| 9.2.6 | Referral rewards program | P3 | ⬜ |
| 9.2.7 | Points expiry settings (e.g., 6 months) | P3 | ⬜ |
| 9.2.8 | Loyalty wallet balance display on bill | P2 | ⬜ |
| 9.2.9 | SMS/WhatsApp loyalty point updates | P3 | ⬜ |
| 9.2.10 | Loyalty card / membership number | P3 | ⬜ |

### 9.3 Marketing & Campaigns

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 9.3.1 | Bulk SMS campaigns | P3 | ⬜ |
| 9.3.2 | WhatsApp broadcast messages | P3 | ⬜ |
| 9.3.3 | Birthday greetings automation | P3 | ⬜ |
| 9.3.4 | Festival/holiday offers auto-send | P3 | ⬜ |
| 9.3.5 | Coupon code generation (single-use / multi-use) | P2 | ⬜ |
| 9.3.6 | Happy hour discount scheduling | P3 | ⬜ |
| 9.3.7 | BOGO (Buy 1 Get 1) offer creation | P3 | ⬜ |
| 9.3.8 | Minimum order discount rules | P3 | ⬜ |
| 9.3.9 | Post-meal feedback request (auto trigger) | P3 | ⬜ |
| 9.3.10 | Google Review redirect link | P3 | ⬜ |
| 9.3.11 | Star rating collection (in-app) | P3 | ⬜ |
| 9.3.12 | Customer re-engagement campaigns (dormant users) | P4 | ⬜ |
| 9.3.13 | Campaign analytics (sent, opened, redeemed) | P3 | ⬜ |

---

## 10. 💳 Payments

### 10.1 Payment Modes

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 10.1.1 | Cash payment (with change calculation) | P1 | ⬜ |
| 10.1.2 | Credit/Debit card (record payment) | P1 | ⬜ |
| 10.1.3 | UPI — GPay, PhonePe, Paytm, BHIM | P1 | ⬜ |
| 10.1.4 | QR-based UPI on printed bill (scan to pay) | P1 | ⬜ |
| 10.1.5 | Razorpay payment link generation | P2 | ⬜ |
| 10.1.6 | Wallet payments (Paytm wallet, etc.) | P3 | ⬜ |
| 10.1.7 | Loyalty points as payment | P2 | ⬜ |
| 10.1.8 | Complimentary / management comp | P2 | ⬜ |
| 10.1.9 | Split payment (multiple modes on one bill) | P1 | ⬜ |
| 10.1.10 | Online prepayment via QR menu | P2 | ⬜ |
| 10.1.11 | Advance payment / token for reservations | P3 | ⬜ |
| 10.1.12 | Refund processing | P2 | ⬜ |

### 10.2 Payment Gateway Integration

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 10.2.1 | Razorpay integration (primary) | P1 | ⬜ |
| 10.2.2 | PayU integration (fallback) | P3 | ⬜ |
| 10.2.3 | UPI intent flow (open GPay/PhonePe directly) | P2 | ⬜ |
| 10.2.4 | Payment confirmation webhook handling | P1 | ⬜ |
| 10.2.5 | Auto-reconciliation of online payments | P2 | ⬜ |

---

## 11. 📋 GST Compliance

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 11.1 | Restaurant GSTIN entry & display on bill | P1 | ⬜ |
| 11.2 | Item-wise GST slab (5% / 12% / 18%) | P1 | ⬜ |
| 11.3 | Auto CGST + SGST split on bill | P1 | ⬜ |
| 11.4 | IGST for inter-state orders | P2 | ⬜ |
| 11.5 | Service charge (non-GST, configurable ON/OFF + %) | P1 | ⬜ |
| 11.6 | GST-compliant invoice format | P1 | ⬜ |
| 11.7 | GST summary report (monthly) | P1 | ⬜ |
| 11.8 | GSTR-1 compatible data export | P2 | ⬜ |
| 11.9 | HSN/SAC code on bill items | P2 | ⬜ |
| 11.10 | B2B invoice with buyer GSTIN | P3 | ⬜ |

---

## 12. 🤵 Captain / Waiter App

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 12.1 | Full menu access on mobile (Android) | P2 | ⬜ |
| 12.2 | Table selection from visual floor map | P2 | ⬜ |
| 12.3 | Take order for specific table | P2 | ⬜ |
| 12.4 | Add items to running order | P2 | ⬜ |
| 12.5 | Send order to kitchen (KOT) instantly | P2 | ⬜ |
| 12.6 | Mark food as delivered to table | P2 | ⬜ |
| 12.7 | Request bill generation with one tap | P2 | ⬜ |
| 12.8 | See all active tables & their status | P2 | ⬜ |
| 12.9 | Receive kitchen "ready" notifications | P2 | ⬜ |
| 12.10 | Offline mode (syncs when online) | P2 | ⬜ |
| 12.11 | Login with waiter credentials (PIN/password) | P2 | ⬜ |
| 12.12 | Waiter-wise order tracking (for performance/tips) | P2 | ⬜ |
| 12.13 | Item search within menu | P2 | ⬜ |
| 12.14 | Special instructions entry | P2 | ⬜ |
| 12.15 | View order history for current table | P3 | ⬜ |
| 12.16 | Cross-platform (React Native — Android + iOS) | P2 | ⬜ |

---

## 13. 🛵 Online Aggregator Integration

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 13.1 | Zomato API integration | P3 | ⬜ |
| 13.2 | Swiggy API integration | P3 | ⬜ |
| 13.3 | Single dashboard for all order sources | P3 | ⬜ |
| 13.4 | Auto-accept delivery orders toggle | P3 | ⬜ |
| 13.5 | Menu sync across all platforms | P3 | ⬜ |
| 13.6 | Mark items as unavailable (syncs to aggregator) | P3 | ⬜ |
| 13.7 | Reject orders with reason | P3 | ⬜ |
| 13.8 | Estimated delivery time management | P3 | ⬜ |
| 13.9 | Delivery order KOT routing (separate from dine-in) | P3 | ⬜ |
| 13.10 | Commission tracking per platform | P3 | ⬜ |
| 13.11 | Aggregator-wise sales report | P3 | ⬜ |
| 13.12 | Own delivery management module | P3 | ⬜ |
| 13.13 | Delivery agent assignment | P4 | ⬜ |
| 13.14 | Direct online ordering link (0% commission alternative) | P2 | ⬜ |

---

## 14. 📈 Reports & Analytics

### 14.1 Sales Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.1.1 | Daily sales report | P1 | ⬜ |
| 14.1.2 | Weekly sales report | P1 | ⬜ |
| 14.1.3 | Monthly sales report | P1 | ⬜ |
| 14.1.4 | Custom date range sales | P1 | ⬜ |
| 14.1.5 | Hourly sales heatmap | P2 | ⬜ |
| 14.1.6 | Sales by order type (dine-in / delivery / takeaway) | P1 | ⬜ |
| 14.1.7 | Top-selling items ranking | P1 | ⬜ |
| 14.1.8 | Least-selling items | P2 | ⬜ |
| 14.1.9 | Category-wise revenue breakdown | P2 | ⬜ |
| 14.1.10 | Average bill value trend | P2 | ⬜ |
| 14.1.11 | Peak hour analysis | P2 | ⬜ |
| 14.1.12 | Sales comparison (week over week) | P2 | ⬜ |
| 14.1.13 | Sales comparison (month over month) | P2 | ⬜ |
| 14.1.14 | Revenue by order source (QR / Waiter / Aggregator) | P2 | ⬜ |

### 14.2 Inventory Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.2.1 | Current stock position | P2 | ⬜ |
| 14.2.2 | Daily consumption report | P2 | ⬜ |
| 14.2.3 | Wastage & loss report | P2 | ⬜ |
| 14.2.4 | Purchase history | P2 | ⬜ |
| 14.2.5 | Food cost analysis per dish | P2 | ⬜ |
| 14.2.6 | Gross margin per dish | P2 | ⬜ |
| 14.2.7 | Slow-moving items report | P3 | ⬜ |
| 14.2.8 | Reorder suggestion report | P3 | ⬜ |
| 14.2.9 | Stock valuation report | P3 | ⬜ |
| 14.2.10 | Purchase vs consumption analysis | P3 | ⬜ |

### 14.3 Staff Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.3.1 | Waiter-wise sales report | P2 | ⬜ |
| 14.3.2 | Cancelled orders by staff | P2 | ⬜ |
| 14.3.3 | Discounts given by staff | P2 | ⬜ |
| 14.3.4 | Shift-wise performance | P2 | ⬜ |
| 14.3.5 | Attendance report | P2 | ⬜ |
| 14.3.6 | Tip collection per waiter | P3 | ⬜ |
| 14.3.7 | Staff login/logout times | P2 | ⬜ |
| 14.3.8 | Exception reports (voided bills, unauthorized discounts) | P2 | ⬜ |

### 14.4 Payment Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.4.1 | Payment mode summary (cash vs card vs UPI) | P1 | ⬜ |
| 14.4.2 | Cash vs digital split | P1 | ⬜ |
| 14.4.3 | UPI collection report | P2 | ⬜ |
| 14.4.4 | Day-end cash register report | P1 | ⬜ |
| 14.4.5 | Advance payment tracking | P3 | ⬜ |
| 14.4.6 | Refund reports | P2 | ⬜ |
| 14.4.7 | Aggregator payout tracking | P3 | ⬜ |
| 14.4.8 | GST collected summary | P1 | ⬜ |

### 14.5 CRM Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.5.1 | New vs returning customers | P2 | ⬜ |
| 14.5.2 | Customer lifetime value | P3 | ⬜ |
| 14.5.3 | Loyalty points issued/redeemed report | P3 | ⬜ |
| 14.5.4 | Top 10 customers by spend | P2 | ⬜ |
| 14.5.5 | Customer visit frequency | P3 | ⬜ |
| 14.5.6 | Feedback score trend | P3 | ⬜ |
| 14.5.7 | Campaign response rates | P3 | ⬜ |
| 14.5.8 | Churn risk customers | P4 | ⬜ |

### 14.6 Operations Reports

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.6.1 | Table turnover rate | P2 | ⬜ |
| 14.6.2 | Average dine time per table | P2 | ⬜ |
| 14.6.3 | Kitchen preparation time (avg per item/order) | P2 | ⬜ |
| 14.6.4 | Order accuracy rate | P3 | ⬜ |
| 14.6.5 | Cancelled orders analysis (reasons, frequency) | P2 | ⬜ |
| 14.6.6 | Reservation utilization rate | P3 | ⬜ |
| 14.6.7 | Peak vs off-peak load comparison | P3 | ⬜ |
| 14.6.8 | QR vs waiter order split | P2 | ⬜ |

### 14.7 Report Export & Access

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 14.7.1 | Export all reports to Excel/CSV | P1 | ⬜ |
| 14.7.2 | Export to PDF | P2 | ⬜ |
| 14.7.3 | Email scheduled reports (daily/weekly) | P3 | ⬜ |
| 14.7.4 | Report access by role (restrict sensitive data) | P2 | ⬜ |

---

## 15. 👷 Staff Management

### 15.1 Staff Accounts & Roles

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 15.1.1 | Add new staff member | P1 | ⬜ |
| 15.1.2 | Edit staff details | P1 | ⬜ |
| 15.1.3 | Deactivate/delete staff | P1 | ⬜ |
| 15.1.4 | Role: Owner/Admin — full access | P1 | ⬜ |
| 15.1.5 | Role: Manager — billing, reports, moderate discounts | P1 | ⬜ |
| 15.1.6 | Role: Cashier — billing & payment only | P1 | ⬜ |
| 15.1.7 | Role: Captain/Waiter — order taking only | P1 | ⬜ |
| 15.1.8 | Role: Kitchen Staff — KDS view only | P1 | ⬜ |
| 15.1.9 | Custom role creation | P2 | ⬜ |
| 15.1.10 | Granular permission controls per role | P2 | ⬜ |
| 15.1.11 | Permission-level discounting (max % per role) | P2 | ⬜ |
| 15.1.12 | Authorization requirement for voids/cancels | P1 | ⬜ |
| 15.1.13 | Manager PIN for override actions | P2 | ⬜ |
| 15.1.14 | Staff login (username + password/PIN) | P1 | ⬜ |

### 15.2 Attendance & Shifts

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 15.2.1 | Staff clock-in / clock-out | P2 | ⬜ |
| 15.2.2 | Shift management (morning / evening / night) | P2 | ⬜ |
| 15.2.3 | Shift assignment to staff | P2 | ⬜ |
| 15.2.4 | Attendance report (monthly) | P2 | ⬜ |
| 15.2.5 | Overtime calculation | P3 | ⬜ |
| 15.2.6 | Shift-wise sales tracking | P2 | ⬜ |
| 15.2.7 | Staff performance scoring | P3 | ⬜ |
| 15.2.8 | Salary advance tracking | P3 | ⬜ |
| 15.2.9 | Holiday & leave management | P3 | ⬜ |

---

## 16. 🏬 Multi-Outlet Management

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 16.1 | Central dashboard (all outlets overview) | P3 | ⬜ |
| 16.2 | Add/manage multiple outlets | P3 | ⬜ |
| 16.3 | Outlet-wise sales comparison | P3 | ⬜ |
| 16.4 | Central menu management (push to all outlets) | P3 | ⬜ |
| 16.5 | Outlet-specific price overrides | P3 | ⬜ |
| 16.6 | Central inventory with outlet transfers | P3 | ⬜ |
| 16.7 | Central kitchen module | P4 | ⬜ |
| 16.8 | Consolidated reports across all outlets | P3 | ⬜ |
| 16.9 | Franchise management module | P4 | ⬜ |
| 16.10 | Royalty fee calculation per outlet | P4 | ⬜ |
| 16.11 | Central customer database (shared CRM) | P3 | ⬜ |
| 16.12 | Universal loyalty card across outlets | P3 | ⬜ |
| 16.13 | Staff transfer between outlets | P4 | ⬜ |
| 16.14 | Outlet-wise role & permission management | P3 | ⬜ |

---

## 17. ⚙️ Settings & Configuration

### 17.1 Restaurant Setup

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 17.1.1 | Restaurant name & address | P1 | ⬜ |
| 17.1.2 | Restaurant phone & email | P1 | ⬜ |
| 17.1.3 | Restaurant logo upload | P1 | ⬜ |
| 17.1.4 | GSTIN entry | P1 | ⬜ |
| 17.1.5 | FSSAI license number | P2 | ⬜ |
| 17.1.6 | Business hours configuration | P2 | ⬜ |
| 17.1.7 | Currency & locale settings | P2 | ⬜ |
| 17.1.8 | Tax configuration (GST slabs) | P1 | ⬜ |
| 17.1.9 | Service charge ON/OFF & percentage | P1 | ⬜ |

### 17.2 Hardware & Integrations

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 17.2.1 | Printer setup (thermal/dot matrix) | P1 | ⬜ |
| 17.2.2 | ESC/POS protocol support | P1 | ⬜ |
| 17.2.3 | Multiple printer support (bill printer + kitchen printer) | P1 | ⬜ |
| 17.2.4 | KDS screen configuration | P2 | ⬜ |
| 17.2.5 | Barcode scanner support | P3 | ⬜ |
| 17.2.6 | Weighing scale integration | P4 | ⬜ |
| 17.2.7 | Cash drawer trigger on bill print | P3 | ⬜ |

### 17.3 Communication & Notifications

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 17.3.1 | Notification sound ON/OFF | P1 | ⬜ |
| 17.3.2 | Push notification preferences | P2 | ⬜ |
| 17.3.3 | WhatsApp Business API setup | P2 | ⬜ |
| 17.3.4 | SMS provider setup (MSG91/Textlocal) | P3 | ⬜ |
| 17.3.5 | Email configuration | P3 | ⬜ |

### 17.4 Payment & Billing Config

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 17.4.1 | Payment gateway keys (Razorpay/PayU) | P1 | ⬜ |
| 17.4.2 | UPI merchant ID configuration | P1 | ⬜ |
| 17.4.3 | Bill number format (prefix, sequence) | P2 | ⬜ |
| 17.4.4 | Bill footer text customization | P2 | ⬜ |
| 17.4.5 | Auto-print bill ON/OFF | P2 | ⬜ |
| 17.4.6 | Round-off settings | P2 | ⬜ |

### 17.5 System Settings

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 17.5.1 | Offline mode settings | P1 | ⬜ |
| 17.5.2 | Data backup configuration | P2 | ⬜ |
| 17.5.3 | Auto-logout timer | P2 | ⬜ |
| 17.5.4 | Device management (registered devices) | P2 | ⬜ |
| 17.5.5 | Subscription/plan details & billing | P2 | ⬜ |
| 17.5.6 | Multi-language settings (admin interface) | P3 | ⬜ |
| 17.5.7 | Data export (full restaurant data) | P3 | ⬜ |
| 17.5.8 | Account deletion / data wipe | P3 | ⬜ |

---

## 18. 🔔 Notifications Center

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 18.1 | New order alert (sound + visual badge) | P1 | ⬜ |
| 18.2 | Low stock alert | P2 | ⬜ |
| 18.3 | Kitchen "ready" notification (food ready for pickup) | P1 | ⬜ |
| 18.4 | Customer "call waiter" request | P2 | ⬜ |
| 18.5 | Customer "request bill" notification | P2 | ⬜ |
| 18.6 | Aggregator new order alert | P3 | ⬜ |
| 18.7 | Payment confirmation alert | P2 | ⬜ |
| 18.8 | Staff login/logout alert | P3 | ⬜ |
| 18.9 | Reservation reminder (upcoming) | P3 | ⬜ |
| 18.10 | System alerts (printer offline, sync error) | P2 | ⬜ |
| 18.11 | Notification history (bell icon with list) | P2 | ⬜ |
| 18.12 | Mark as read / clear all | P2 | ⬜ |

---

## 19. 📱 Owner Mobile App

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 19.1 | Live sales today (real-time) | P3 | ⬜ |
| 19.2 | Active tables count | P3 | ⬜ |
| 19.3 | Kitchen queue status | P3 | ⬜ |
| 19.4 | Top-selling item of the day | P3 | ⬜ |
| 19.5 | Low stock alerts | P3 | ⬜ |
| 19.6 | Pending deliveries | P3 | ⬜ |
| 19.7 | Today's cash collected | P3 | ⬜ |
| 19.8 | Push notifications for critical events | P3 | ⬜ |
| 19.9 | Quick reports (daily summary) | P3 | ⬜ |
| 19.10 | Staff attendance view | P3 | ⬜ |
| 19.11 | Menu item toggle (mark sold-out remotely) | P3 | ⬜ |
| 19.12 | Multi-outlet switching | P3 | ⬜ |

---

## 20. 🔒 Security & Data

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 20.1 | End-to-end encrypted data transmission (HTTPS) | P1 | ⬜ |
| 20.2 | Password hashing (bcrypt) | P1 | ⬜ |
| 20.3 | JWT token-based authentication | P1 | ⬜ |
| 20.4 | Refresh token rotation | P1 | ⬜ |
| 20.5 | Role-based access control enforcement | P1 | ⬜ |
| 20.6 | Session timeout / auto-logout | P2 | ⬜ |
| 20.7 | Activity audit log (who did what, when) | P2 | ⬜ |
| 20.8 | IP whitelisting for admin access | P3 | ⬜ |
| 20.9 | Daily automated backups | P1 | ⬜ |
| 20.10 | Point-in-time recovery | P2 | ⬜ |
| 20.11 | PCI compliance for payment data | P1 | ⬜ |
| 20.12 | Data encryption at rest | P2 | ⬜ |
| 20.13 | GDPR-lite data deletion capability | P3 | ⬜ |

---

## 21. ⚡ Performance & Offline

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 21.1 | Offline billing (works without internet) | P1 | ⬜ |
| 21.2 | Offline KOT generation | P1 | ⬜ |
| 21.3 | Auto-sync when internet returns | P1 | ⬜ |
| 21.4 | Local data cache (IndexedDB / SQLite) | P1 | ⬜ |
| 21.5 | Sub-second response time on order placement | P1 | ⬜ |
| 21.6 | Handle 100+ orders/hour during peak | P1 | ⬜ |
| 21.7 | WebSocket real-time sync (KDS, admin panel) | P1 | ⬜ |
| 21.8 | CDN for static assets (food photos, menu) | P2 | ⬜ |
| 21.9 | Database query optimization | P1 | ⬜ |
| 21.10 | Background job queue (print, SMS, reports) | P2 | ⬜ |

---

## 22. 🚀 AI & Future Features (Phase 4)

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 22.1 | AI demand forecasting (predict busy hours) | P4 | ⬜ |
| 22.2 | Smart reorder suggestions (inventory) | P4 | ⬜ |
| 22.3 | Customer churn prediction | P4 | ⬜ |
| 22.4 | Menu item recommendation engine | P4 | ⬜ |
| 22.5 | Dynamic pricing suggestions (happy hour auto) | P4 | ⬜ |
| 22.6 | Predictive kitchen prep (pre-prepare popular items) | P4 | ⬜ |
| 22.7 | Voice ordering integration | P4 | ⬜ |
| 22.8 | Chatbot for customer queries | P4 | ⬜ |
| 22.9 | API marketplace for third-party integrations | P4 | ⬜ |
| 22.10 | White-label option (resell POS under partner brand) | P4 | ⬜ |

---

## Summary

| Section | Feature Count |
|---------|:---:|
| 1. Main Dashboard | 15 |
| 2. QR Ordering System | 36 |
| 3. Billing & Invoicing | 30 |
| 4. KOT System | 15 |
| 5. Kitchen Display (KDS) | 16 |
| 6. Table Management | 22 |
| 7. Menu Management | 31 |
| 8. Inventory & Stock | 28 |
| 9. CRM & Loyalty | 36 |
| 10. Payments | 17 |
| 11. GST Compliance | 10 |
| 12. Captain/Waiter App | 16 |
| 13. Aggregator Integration | 14 |
| 14. Reports & Analytics | 60 |
| 15. Staff Management | 23 |
| 16. Multi-Outlet | 14 |
| 17. Settings & Configuration | 30 |
| 18. Notifications Center | 12 |
| 19. Owner Mobile App | 12 |
| 20. Security & Data | 13 |
| 21. Performance & Offline | 10 |
| 22. AI & Future | 10 |
| **TOTAL** | **~440** |

---

## Priority Legend

| Priority | Meaning | Phase |
|----------|---------|-------|
| **P1** | Must-have for MVP launch | Phase 1 (3–4 months) |
| **P2** | Required for full product | Phase 2 (2–3 months) |
| **P3** | Important for scale & competitive edge | Phase 3 (2–3 months) |
| **P4** | Future/AI/Growth features | Phase 4 (ongoing) |

---

> **Usage:** Update the Status column as you build each feature.  
> Use this document as your single source of truth for feature tracking.
