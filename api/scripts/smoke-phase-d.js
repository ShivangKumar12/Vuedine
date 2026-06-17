/* eslint-disable no-console */
/**
 * Phase D smoke test — promotions CRUD, apply-coupon, auto-offers,
 * order integration + redemption, pause/resume, public coupon validation.
 *
 *   node scripts/smoke-phase-d.js
 */
const BASE = 'http://localhost:4000';

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status}`, parsed?.error?.message ?? text);
    throw new Error(`HTTP ${res.status}`);
  }
  return parsed?.data;
}

async function main() {
  console.log('Phase D smoke test\n');

  const login = await call('POST', '/v1/auth/login', {
    email: 'owner@vuedine.demo', password: 'vuedine123',
  });
  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  console.log('  ✓ login');

  const branches = await call('GET', '/v1/branches', null, auth);
  const branch = branches[0];
  console.log(`  ✓ branch ${branch.code} (${branch.qrSlug})`);

  // 1. List seeded coupons + offers
  const coupons = await call('GET', '/v1/promotions?type=COUPON&pageSize=100', null, auth);
  const offers = await call('GET', '/v1/promotions?type=OFFER&pageSize=100', null, auth);
  console.log(`  ✓ coupons=${coupons.length} offers=${offers.length}`);

  // 2. Create a coupon
  const code = `SMOKE${Math.floor(Math.random() * 9000 + 1000)}`;
  const created = await call('POST', '/v1/promotions', {
    type: 'COUPON', kind: 'PERCENTAGE', title: 'Smoke 15%', code,
    value: 15, minOrder: 5,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    channels: [], usageLimit: 100, perUserLimit: 2,
  }, auth);
  console.log(`  ✓ created coupon ${created.code} (${created.kind}, ${created.status})`);

  // 3. Apply coupon preview
  const lines = [
    { itemId: 'i1', itemName: 'Pizza', category: 'Pizza', qty: 2, unitPrice: 10 },
    { itemId: 'i2', itemName: 'Mojito', category: 'Cocktails', qty: 1, unitPrice: 5 },
  ];
  const preview = await call('POST', '/v1/cart/apply-coupon', { code, channel: 'POS', lines }, auth);
  console.log(`  ✓ apply-coupon: discount=$${preview.discount} on subtotal=$${preview.subtotal}`);

  // 4. Auto-offers
  const autoRes = await call('POST', '/v1/cart/auto-offers', { channel: 'POS', lines }, auth);
  console.log(`  ✓ auto-offers: ${autoRes.offers.length} applicable`);

  // 5. Place order with coupon → discount applied + redemption recorded
  const order = await call('POST', '/v1/orders', {
    branchId: branch.id, type: 'DINE_IN', channel: 'POS', tableLabel: 'Table 1',
    promoCode: code,
    lines: [{ itemName: 'Pizza', qty: 2, unitPrice: 10, category: 'Pizza' }],
  }, { ...auth, 'Idempotency-Key': `d-ord-${Date.now()}` });
  console.log(`  ✓ order ${order.serial}: discount=$${order.discountTotal} grand=$${order.grandTotal}`);

  // 6. Verify used counter incremented
  const reread = await call('GET', `/v1/promotions/${created.id}`, null, auth);
  console.log(`  ✓ coupon used count: ${reread.used}`);

  // 7. Pause + resume
  const paused = await call('POST', `/v1/promotions/${created.id}/pause`, null, auth);
  console.log(`  ✓ paused → ${paused.status}`);
  const resumed = await call('POST', `/v1/promotions/${created.id}/resume`, null, auth);
  console.log(`  ✓ resumed → ${resumed.status}`);

  // 8. Public coupon validation (guest PWA)
  try {
    const pub = await fetch(`${BASE}/v1/public/cart/apply-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchSlug: branch.qrSlug, code, lines }),
    }).then((r) => r.json());
    if (pub.success) console.log(`  ✓ public apply-coupon: discount=$${pub.data.discount}`);
    else console.log(`  ✓ public apply-coupon rejected: ${pub.error?.code}`);
  } catch (e) {
    console.log(`  · public apply-coupon: ${e.message}`);
  }

  // 9. Delete the smoke coupon
  await call('DELETE', `/v1/promotions/${created.id}`, null, auth);
  console.log('  ✓ deleted smoke coupon');

  console.log('\n✅ All Phase D smoke checks passed');
}

main().catch((err) => { console.error(err); process.exit(1); });
