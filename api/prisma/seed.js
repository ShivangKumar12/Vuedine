// ============================================================
//  Vuedine — local seed
//  ----
//  Creates a demo tenant + 2 branches + a demo owner + a default set of
//  16 dining tables for the main branch (matches the frontend mock).
//  Idempotent: safe to run multiple times.
//
//  npm run db:seed      # seed
//  npm run db:reset     # wipe + migrate + seed
// ============================================================

import { randomBytes } from 'node:crypto';

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

import { PLAN_DEFS, PLAN_LIMITS } from '../src/modules/billing/billing.plans.js';

const prisma = new PrismaClient();

const DEMO_TENANT_SLUG = 'vuedine-demo';
const DEMO_OWNER_EMAIL = 'owner@vuedine.demo';
const DEMO_OWNER_PASSWORD = 'vuedine123';

function mintQrToken() {
  return randomBytes(12).toString('base64url');
}

const SEED_TABLES = [
  { name: 'Table 1', section: 'Indoor · Window', capacity: 4, shape: 'round' },
  { name: 'Table 2', section: 'Indoor · Window', capacity: 8, shape: 'rect' },
  { name: 'Table 3', section: 'Indoor · Center', capacity: 4, shape: 'round' },
  { name: 'Table 4', section: 'Indoor · Center', capacity: 6, shape: 'rect' },
  { name: 'Table 5', section: 'Indoor · Bar', capacity: 2, shape: 'square' },
  { name: 'Table 6', section: 'Indoor · Bar', capacity: 2, shape: 'square' },
  { name: 'Table 7', section: 'Outdoor · Patio', capacity: 4, shape: 'round' },
  { name: 'Table 8', section: 'Outdoor · Patio', capacity: 4, shape: 'round' },
  { name: 'Table 9', section: 'Outdoor · Patio', capacity: 6, shape: 'rect' },
  { name: 'Table 10', section: 'Terrace', capacity: 4, shape: 'round' },
  { name: 'Table 11', section: 'Terrace', capacity: 8, shape: 'rect' },
  { name: 'Table 12', section: 'Terrace', capacity: 4, shape: 'round' },
  { name: 'Table 13', section: 'Indoor · Center', capacity: 2, shape: 'square' },
  { name: 'Bar 1', section: 'Indoor · Bar', capacity: 1, shape: 'square' },
  { name: 'Bar 2', section: 'Indoor · Bar', capacity: 1, shape: 'square' },
  { name: 'Takeaway', section: 'Counter', capacity: 0, shape: 'square' },
];

const SECTIONS = [
  'Indoor · Window',
  'Indoor · Center',
  'Indoor · Bar',
  'Outdoor · Patio',
  'Terrace',
  'Counter',
];

async function main() {
  /* eslint-disable no-console */

  console.log('🌱 seeding…');

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: {},
    create: {
      slug: DEMO_TENANT_SLUG,
      name: 'Vuedine Demo',
      legalName: 'Vuedine Demo Pvt. Ltd.',
      type: 'restaurant',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      gstin: '27AAACV0001Z1Z5',
      contactEmail: 'hello@vuedine.demo',
      contactPhone: '+91 22 6700 0000',
      description: 'Modern multi-cuisine restaurant — demo workspace.',
      brandColor: '#EC1B7C',
      brandTheme: 'light',
      invoicePrefix: 'VUE',
      invoiceSequence: 1001,
      numberLocale: 'en-IN',
      weekStart: 'MONDAY',
      taxConfig: {
        gstNumber: '27AAACV0001Z1Z5',
        inclusive: false,
        receiptFooter: 'Thank you · come back soon!',
        roundOff: true,
        logoOnReceipt: true,
        serviceChargeEnabled: true,
        serviceChargePct: 5,
        slabs: [
          { name: 'GST 5%', rate: 0.05 },
          { name: 'GST 18%', rate: 0.18 },
        ],
      },
    },
  });
  console.log(`  tenant   ${tenant.slug} (${tenant.id})`);

  const branchBandra = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BAN' } },
    update: {
      qrSlug: 'bandra',
      diningSections: SECTIONS,
    },
    create: {
      tenantId: tenant.id,
      code: 'BAN',
      qrSlug: 'bandra',
      name: 'Mumbai · Bandra (Main)',
      address: 'Linking Rd, Bandra West, Mumbai 400050',
      phone: '+91 22 6700 0001',
      email: 'bandra@vuedine.demo',
      manager: 'Aman Kapoor',
      isLive: true,
      defaultPrep: 18,
      serviceCharge: 5,
      taxInclusive: false,
      diningSections: SECTIONS,
      openingHours: {
        mon: ['09:00', '23:00'],
        tue: ['09:00', '23:00'],
        wed: ['09:00', '23:00'],
        thu: ['09:00', '23:00'],
        fri: ['09:00', '23:30'],
        sat: ['10:00', '23:30'],
        sun: ['10:00', '23:00'],
      },
    },
  });
  console.log(`  branch   ${branchBandra.code} (${branchBandra.id})`);

  const branchBKC = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BKC' } },
    update: {
      qrSlug: 'bkc',
      diningSections: ['Indoor · Atrium', 'Outdoor · Deck', 'Counter'],
    },
    create: {
      tenantId: tenant.id,
      code: 'BKC',
      qrSlug: 'bkc',
      name: 'Mumbai · BKC',
      address: 'G Block, Bandra Kurla Complex, Mumbai 400051',
      phone: '+91 22 6700 0002',
      email: 'bkc@vuedine.demo',
      isLive: true,
      defaultPrep: 15,
      serviceCharge: 5,
      taxInclusive: false,
      diningSections: ['Indoor · Atrium', 'Outdoor · Deck', 'Counter'],
    },
  });
  console.log(`  branch   ${branchBKC.code} (${branchBKC.id})`);

  // Seed tables for the main branch — idempotent via name uniqueness within branch.
  const existingTables = await prisma.table.findMany({
    where: { branchId: branchBandra.id },
    select: { name: true },
  });
  const existingTableNames = new Set(existingTables.map((t) => t.name));

  for (const tdef of SEED_TABLES) {
    if (existingTableNames.has(tdef.name)) continue;
    await prisma.table.create({
      data: {
        ...tdef,
        tenantId: tenant.id,
        branchId: branchBandra.id,
        qrToken: mintQrToken(),
      },
    });
  }
  const tableCount = await prisma.table.count({
    where: { branchId: branchBandra.id, deletedAt: null },
  });
  console.log(`  tables   ${tableCount} for branch ${branchBandra.code}`);

  // Phase G — backfill a TABLE-type QrCode per table (shares the table token),
  // plus a couple of non-table QR codes. Idempotent via token uniqueness.
  // eslint-disable-next-line no-process-env -- dev seed script, base URL is informational
  const PUBLIC_QR_BASE = process.env.PUBLIC_QR_BASE ?? 'http://localhost:4000';
  const allTables = await prisma.table.findMany({
    where: { branchId: branchBandra.id, deletedAt: null },
    select: { id: true, name: true, qrToken: true, branchId: true },
  });
  for (const tb of allTables) {
    const existingQr = await prisma.qrCode.findFirst({ where: { tableId: tb.id, deletedAt: null } });
    if (existingQr) continue;
    await prisma.qrCode.create({
      data: {
        tenantId: tenant.id,
        branchId: tb.branchId,
        type: 'TABLE',
        label: tb.name,
        token: tb.qrToken,
        url: `${PUBLIC_QR_BASE}/m/${branchBandra.qrSlug}/${tb.qrToken}`,
        status: 'ACTIVE',
        tableId: tb.id,
      },
    });
  }
  const SEED_NON_TABLE_QR = [
    { type: 'COUNTER', label: 'Pickup counter' },
    { type: 'TAKEAWAY', label: 'Takeaway desk' },
    { type: 'MARKETING', label: 'Window poster' },
  ];
  for (const def of SEED_NON_TABLE_QR) {
    const exists = await prisma.qrCode.findFirst({
      where: { branchId: branchBandra.id, type: def.type, label: def.label, deletedAt: null },
    });
    if (exists) continue;
    const token = mintQrToken();
    await prisma.qrCode.create({
      data: {
        tenantId: tenant.id,
        branchId: branchBandra.id,
        type: def.type,
        label: def.label,
        token,
        url: `${PUBLIC_QR_BASE}/m/${branchBandra.qrSlug}/${token}`,
        status: 'ACTIVE',
      },
    });
  }
  const qrCount = await prisma.qrCode.count({ where: { tenantId: tenant.id, deletedAt: null } });
  console.log(`  qrCodes  ${qrCount} seeded`);

  const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 10);

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: DEMO_OWNER_EMAIL } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: DEMO_OWNER_EMAIL,
      passwordHash,
      name: 'Demo Owner',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      branchIds: [branchBandra.id, branchBKC.id],
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  user     ${owner.email} (role=${owner.role})`);

  /* ============================================================
   *  Phase K — billing plans + a Growth subscription for the demo
   * ============================================================ */
  for (const def of PLAN_DEFS) {
    await prisma.plan.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        blurb: def.blurb,
        monthly: def.monthly,
        yearly: def.yearly,
        features: def.features,
        active: def.active,
      },
      create: {
        slug: def.slug,
        name: def.name,
        blurb: def.blurb,
        monthly: def.monthly,
        yearly: def.yearly,
        features: def.features,
        active: def.active,
      },
    });
  }
  const growthLimits = PLAN_LIMITS.growth;
  const subNow = new Date();
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planSlug: 'growth',
      cycle: 'YEARLY',
      status: 'ACTIVE',
      startedAt: subNow,
      renewsAt: new Date(subNow.getTime() + 30 * 86400000),
      seatLimit: growthLimits.seatLimit,
      branchLimit: growthLimits.branchLimit,
      storageLimitGb: growthLimits.storageLimitGb,
      aiQuota: growthLimits.aiQuota,
      meta: { addons: [] },
    },
  });
  console.log(`  billing  ${PLAN_DEFS.length} plans + Growth subscription`);

  /* ============================================================
   *  Phase B — sample items + sample orders for dashboard preview
   * ============================================================ */

  const SEED_ITEMS = [
    { name: 'Margherita',         category: 'Pizza',       price: 4.5, emoji: '🍕', veg: true,  bestseller: true,  description: 'Tomato, mozzarella, basil' },
    { name: 'Pepperoni',          category: 'Pizza',       price: 5.0, emoji: '🍕', veg: false, description: 'Spicy pepperoni · mozzarella' },
    { name: 'Truffle Burger',     category: 'Burgers',     price: 5.9, emoji: '🍔', veg: false, bestseller: true,  description: 'Beef · truffle aioli · brioche' },
    { name: 'Veggie Burger',      category: 'Burgers',     price: 3.8, emoji: '🍔', veg: true,  description: 'House patty · avocado · slaw' },
    { name: 'Caesar Salad',       category: 'Salads',      price: 3.3, emoji: '🥗', veg: true,  description: 'Romaine · parmesan · croutons' },
    { name: 'Burrata',            category: 'Salads',      price: 4.5, emoji: '🧀', veg: true,  description: 'Tomato · basil · olive oil' },
    { name: 'Carbonara',          category: 'Pasta',       price: 4.2, emoji: '🍝', veg: false },
    { name: 'Lasagna',            category: 'Pasta',       price: 4.6, emoji: '🍝', veg: false, description: 'Slow-cooked beef ragù' },
    { name: 'Sushi Set',          category: 'Sushi',       price: 7.5, emoji: '🍣', veg: false, bestseller: true,  description: '12-piece chef selection' },
    { name: 'Tiramisu',           category: 'Desserts',    price: 2.5, emoji: '🍰', veg: true },
    { name: 'Cheesecake',         category: 'Desserts',    price: 2.8, emoji: '🍰', veg: true },
    { name: 'Mojito',             category: 'Cocktails',   price: 4.0, emoji: '🍹', veg: true,  bestseller: true },
    { name: 'Negroni',            category: 'Cocktails',   price: 5.0, emoji: '🍸', veg: true },
    { name: 'Cappuccino',         category: 'Beverages',   price: 1.5, emoji: '☕', veg: true,  bestseller: true },
    { name: 'Mango Lassi',        category: 'Beverages',   price: 1.5, emoji: '🥭', veg: true },
    { name: 'Masala Chai',        category: 'Beverages',   price: 0.8, emoji: '🍵', veg: true },
    { name: 'Butter Chicken',     category: 'Indian',      price: 5.0, emoji: '🍛', veg: false, bestseller: true,  description: 'House-special · creamy' },
    { name: 'Paneer Tikka',       category: 'Indian',      price: 4.0, emoji: '🧀', veg: true },
    { name: 'Garlic Naan',        category: 'Indian',      price: 1.2, emoji: '🫓', veg: true },
    { name: 'Pad Thai',           category: 'Asian',       price: 4.0, emoji: '🍜', veg: false },
    { name: 'Ramen',              category: 'Asian',       price: 4.5, emoji: '🍜', veg: false },
    { name: 'Spring Rolls',       category: 'Appetizers',  price: 2.0, emoji: '🥟', veg: true },
    { name: 'Buffalo Wings',      category: 'Appetizers',  price: 3.5, emoji: '🍗', veg: false },
    { name: 'Steak Frites',       category: 'Mains',       price: 8.5, emoji: '🥩', veg: false, bestseller: true },
    { name: 'Mushroom Risotto',   category: 'Mains',       price: 4.8, emoji: '🍚', veg: true },
    { name: 'Grilled Salmon',     category: 'Mains',       price: 7.0, emoji: '🐟', veg: false },
  ];

  const itemCount = await prisma.item.count({ where: { tenantId: tenant.id } });
  if (itemCount < SEED_ITEMS.length) {
    for (const def of SEED_ITEMS) {
      const existing = await prisma.item.findFirst({
        where: { tenantId: tenant.id, name: def.name, deletedAt: null },
      });
      if (existing) continue;
      await prisma.item.create({ data: { ...def, tenantId: tenant.id, status: 'ACTIVE' } });
    }
  }
  console.log(`  items    ${SEED_ITEMS.length} seeded`);

  /* ============================================================
   *  Phase D — sample promotions (coupons + offers)
   * ============================================================ */
  const now = new Date();
  const daysFromNow = (n) => new Date(now.getTime() + n * 86400000);
  const SEED_PROMOS = [
    {
      type: 'COUPON', kind: 'PERCENTAGE', status: 'ACTIVE',
      title: 'New customer 20% off', code: 'WELCOME20',
      value: 20, minOrder: 2.99, maxDiscount: 1,
      startsAt: daysFromNow(-30), endsAt: daysFromNow(180),
      channels: ['All'], usageLimit: 5000, perUserLimit: 1,
      description: 'First-time discount on any order above the minimum.',
    },
    {
      type: 'COUPON', kind: 'FLAT', status: 'ACTIVE',
      title: 'Weekend flat off', code: 'WEEKEND50',
      value: 0.5, minOrder: 4.99,
      startsAt: daysFromNow(-10), endsAt: daysFromNow(90),
      channels: ['Online'], usageLimit: 2000, perUserLimit: 2,
    },
    {
      type: 'COUPON', kind: 'BOGO', status: 'ACTIVE',
      title: 'Buy 1 Get 1 — Pizza', code: 'BOGOPIZZA',
      value: 100, minOrder: 0, scope: 'CATEGORIES', targetCategories: ['Pizza'],
      startsAt: daysFromNow(-5), endsAt: daysFromNow(30),
      channels: ['QR'], usageLimit: 1000, perUserLimit: 1,
      description: 'Lowest priced pizza is free.',
    },
    {
      type: 'OFFER', kind: 'HAPPY_HOUR', status: 'ACTIVE', autoApply: true,
      title: 'Happy Hour — 5 to 7 PM', emoji: '🍻',
      hero: 'from-amber-500 via-orange-500 to-rose-500',
      summary: 'Flat 30% off drinks', value: 30,
      scope: 'CATEGORIES', targetCategories: ['Cocktails', 'Wines', 'Beverages'],
      startsAt: daysFromNow(-30), endsAt: daysFromNow(180),
      startTime: '17:00', endTime: '19:00',
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], channels: ['POS', 'QR'],
      description: 'Auto-discounts every drink between 5–7 PM on weekdays.',
    },
    {
      type: 'OFFER', kind: 'COMBO', status: 'ACTIVE', autoApply: false,
      title: 'Family combo — Pizza + Sides', emoji: '🍕',
      hero: 'from-rose-500 via-brand-500 to-amber-500',
      summary: 'Bundle deal (save big)', value: 9.99,
      scope: 'WHOLE_ORDER',
      startsAt: daysFromNow(-10), endsAt: daysFromNow(200),
      startTime: '00:00', endTime: '23:59',
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      channels: ['QR', 'Online', 'POS'],
      description: 'Two large pizzas + garlic bread + drink at fixed bundle price.',
    },
  ];

  const promoCount = await prisma.promotion.count({ where: { tenantId: tenant.id } });
  if (promoCount < SEED_PROMOS.length) {
    for (const def of SEED_PROMOS) {
      const existing = def.code
        ? await prisma.promotion.findFirst({
            where: { tenantId: tenant.id, code: def.code, deletedAt: null },
          })
        : await prisma.promotion.findFirst({
            where: { tenantId: tenant.id, title: def.title, deletedAt: null },
          });
      if (existing) continue;
      await prisma.promotion.create({ data: { ...def, tenantId: tenant.id } });
    }
  }
  console.log(`  promos   ${SEED_PROMOS.length} seeded`);

  /* ============================================================
   *  Phase E — default custom roles
   * ============================================================ */
  const SEED_ROLES = [
    {
      name: 'Branch Manager',
      description: 'Run a single outlet end-to-end',
      color: 'from-violet-500 to-indigo-500',
      systemRole: false,
      permissions: [
        'pos.create_order', 'pos.discount', 'pos.void_bill', 'pos.refund',
        'kitchen.kds', 'kitchen.recall', 'menu.view', 'menu.edit', 'menu.toggle_availability',
        'tables.view', 'tables.assign', 'reports.view_sales', 'reports.view_staff',
        'reports.export', 'cash.day_close', 'cash.cash_drawer', 'inventory.view',
        'inventory.adjust', 'crm.view', 'crm.message', 'delivery.assign',
      ],
    },
    {
      name: 'Cashier',
      description: 'Bills, payments, day-end close',
      color: 'from-blue-500 to-cool-500',
      systemRole: false,
      permissions: ['pos.create_order', 'pos.discount', 'tables.view', 'cash.cash_drawer', 'crm.view'],
    },
    {
      name: 'Waiter / Captain',
      description: 'Take orders, manage tables',
      color: 'from-warm-500 to-amber-500',
      systemRole: false,
      permissions: ['pos.create_order', 'tables.view', 'tables.assign', 'menu.view', 'menu.toggle_availability'],
    },
    {
      name: 'Chef',
      description: 'Run the KDS & menu availability',
      color: 'from-rose-500 to-brand-500',
      systemRole: false,
      permissions: ['kitchen.kds', 'kitchen.recall', 'menu.view', 'menu.toggle_availability', 'inventory.view'],
    },
    {
      name: 'Kitchen Staff',
      description: 'KDS view only',
      color: 'from-rose-400 to-rose-500',
      systemRole: false,
      permissions: ['kitchen.kds', 'menu.view'],
    },
    {
      name: 'Delivery',
      description: 'Driver app + assignment',
      color: 'from-cool-500 to-emerald-500',
      systemRole: false,
      permissions: ['delivery.driver_app'],
    },
  ];

  for (const def of SEED_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: def.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.role.create({ data: { ...def, tenantId: tenant.id } });
    }
  }
  console.log(`  roles    ${SEED_ROLES.length} seeded`);

  /* ---- Phase F — default tax slabs, payment-method configs, hardware ---- */
  const SEED_TAX_SLABS = [
    { name: 'GST 5%', rate: 5, isDefault: true, hsnCodes: ['996331'] },
    { name: 'GST 12%', rate: 12, isDefault: false, hsnCodes: [] },
    { name: 'GST 18% (AC)', rate: 18, isDefault: false, hsnCodes: ['996332'] },
  ];
  for (const slab of SEED_TAX_SLABS) {
    const existing = await prisma.taxSlab.findFirst({
      where: { tenantId: tenant.id, branchId: null, name: slab.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.taxSlab.create({ data: { ...slab, tenantId: tenant.id, branchId: null } });
    }
  }
  console.log(`  taxSlabs ${SEED_TAX_SLABS.length} seeded`);

  const SEED_PMC = [
    { method: 'CASH', enabled: true, preferred: true, serviceCharge: 0 },
    { method: 'CARD', enabled: true, preferred: false, serviceCharge: 0 },
    { method: 'UPI', enabled: true, preferred: false, serviceCharge: 0 },
    { method: 'WALLET', enabled: true, preferred: false, serviceCharge: 0 },
    { method: 'ONLINE', enabled: true, preferred: false, serviceCharge: 0 },
    { method: 'LOYALTY', enabled: false, preferred: false, serviceCharge: 0 },
  ];
  for (const pmc of SEED_PMC) {
    const existingPmc = await prisma.paymentMethodConfig.findFirst({
      where: { tenantId: tenant.id, branchId: null, method: pmc.method },
    });
    if (!existingPmc) {
      await prisma.paymentMethodConfig.create({ data: { ...pmc, tenantId: tenant.id, branchId: null } });
    }
  }
  console.log(`  payMethods ${SEED_PMC.length} seeded`);

  const SEED_HARDWARE = [
    { type: 'RECEIPT_PRINTER', label: 'Counter · Bill printer', model: 'Epson TM-T82', ip: '192.168.1.41' },
    { type: 'KOT_PRINTER', label: 'Hot Kitchen', model: 'Epson TM-T20III', ip: '192.168.1.42', station: 'HOT' },
    { type: 'KOT_PRINTER', label: 'Bar', model: 'Citizen CT-S310II', ip: '192.168.1.43', station: 'BAR' },
    { type: 'CASH_DRAWER', label: 'Counter drawer' },
    { type: 'CUSTOMER_DISPLAY', label: 'Counter customer display' },
  ];
  for (const dev of SEED_HARDWARE) {
    const existing = await prisma.hardwareDevice.findFirst({
      where: { tenantId: tenant.id, branchId: branchBandra.id, label: dev.label, deletedAt: null },
    });
    if (!existing) {
      await prisma.hardwareDevice.create({
        data: {
          tenantId: tenant.id,
          branchId: branchBandra.id,
          type: dev.type,
          label: dev.label,
          model: dev.model ?? null,
          ip: dev.ip ?? null,
          station: dev.station ?? null,
          pairingToken: randomBytes(24).toString('base64url'),
          lastSeenAt: new Date(),
          active: true,
        },
      });
    }
  }
  console.log(`  hardware ${SEED_HARDWARE.length} seeded`);

  console.log('✅ seed complete\n');
  console.log('   Login with:');
  console.log(`     email:    ${DEMO_OWNER_EMAIL}`);
  console.log(`     password: ${DEMO_OWNER_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error('❌ seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
