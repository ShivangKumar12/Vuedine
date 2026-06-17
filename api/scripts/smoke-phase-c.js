/* eslint-disable no-console */
/**
 * Phase C smoke test — payments, refunds, comps, recapture, settlements,
 * payment settings, transactions ledger.
 *
 *   node scripts/smoke-phase-c.js
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
  try {
    parsed = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status}`, parsed?.error?.message ?? text);
    throw new Error(`HTTP ${res.status}`);
  }
  return parsed?.data;
}

async function main() {
  console.log('Phase C smoke test\n');

  const login = await call('POST', '/v1/auth/login', {
    email: 'owner@vuedine.demo',
    password: 'vuedine123',
  });
  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  console.log(`  ✓ login`);

  const branches = await call('GET', '/v1/branches', null, auth);
  const branch = branches[0];
  console.log(`  ✓ branch ${branch.code}`);

  // 1. Payment settings get + patch
  const settings = await call('GET', '/v1/settings/payments', null, auth);
  console.log(`  ✓ payment settings: gateway=${settings.gateway} cash=${settings.cashEnabled}`);
  const patched = await call('PATCH', '/v1/settings/payments', { autoCapture: false }, auth);
  console.log(`  ✓ settings patched: autoCapture=${patched.autoCapture}`);

  // 2. Place an order
  const order = await call('POST', '/v1/orders', {
    branchId: branch.id,
    type: 'DINE_IN',
    channel: 'POS',
    tableLabel: 'Table 1',
    lines: [
      { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza' },
      { itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails' },
    ],
  }, { ...auth, 'Idempotency-Key': `c-ord-${Date.now()}` });
  console.log(`  ✓ order ${order.serial} ($${order.grandTotal})`);

  // 3. Cash payment → SUCCESS, order PAID
  const cash = await call('POST', `/v1/orders/${order.id}/payments`, {
    method: 'CASH',
    amount: order.grandTotal,
  }, { ...auth, 'Idempotency-Key': `c-pay-${Date.now()}` });
  console.log(`  ✓ cash payment ${cash.id} → ${cash.status}`);

  const reread = await call('GET', `/v1/orders/${order.id}`, null, auth);
  console.log(`  ✓ order paymentStatus=${reread.paymentStatus}`);

  // 4. Partial refund
  const half = +(order.grandTotal / 2).toFixed(2);
  const refund = await call(
    'POST',
    `/v1/orders/${order.id}/payments/${cash.serverId}/refund`,
    { amount: half, reason: 'smoke partial' },
    { ...auth, 'Idempotency-Key': `c-ref-${Date.now()}` },
  );
  console.log(`  ✓ refund ${refund.id} → ${refund.amount}`);

  // 5. Card payment with gateway (for settlement) on a 2nd order
  const order2 = await call('POST', '/v1/orders', {
    branchId: branch.id,
    type: 'TAKEAWAY',
    channel: 'POS',
    lines: [{ itemName: 'Truffle Burger', qty: 1, unitPrice: 5.9, category: 'Burgers' }],
  }, { ...auth, 'Idempotency-Key': `c-ord2-${Date.now()}` });
  const card = await call('POST', `/v1/orders/${order2.id}/payments`, {
    method: 'CARD',
    amount: order2.grandTotal,
    gateway: 'razorpay',
    reference: `rzp_smoke_${Date.now()}`,
    capture: true,
    fee: 0.4,
  }, { ...auth, 'Idempotency-Key': `c-card-${Date.now()}` });
  console.log(`  ✓ card payment ${card.id} → ${card.status} (gateway=${card.gateway})`);

  // 6. UPI payment → PENDING, then recapture
  const order3 = await call('POST', '/v1/orders', {
    branchId: branch.id,
    type: 'TAKEAWAY',
    channel: 'POS',
    lines: [{ itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails' }],
  }, { ...auth, 'Idempotency-Key': `c-ord3-${Date.now()}` });
  const upi = await call('POST', `/v1/orders/${order3.id}/payments`, {
    method: 'UPI',
    amount: order3.grandTotal,
  }, { ...auth, 'Idempotency-Key': `c-upi-${Date.now()}` });
  console.log(`  ✓ upi payment ${upi.id} → ${upi.status}`);
  const recaptured = await call('POST', `/v1/payments/${upi.serverId}/recapture`, null, auth);
  console.log(`  ✓ recaptured → ${recaptured.status}`);

  // 7. Comp on a 4th order
  const order4 = await call('POST', '/v1/orders', {
    branchId: branch.id,
    type: 'DINE_IN',
    channel: 'POS',
    tableLabel: 'Table 2',
    lines: [{ itemName: 'Sushi Set', qty: 1, unitPrice: 7.5, category: 'Sushi' }],
  }, { ...auth, 'Idempotency-Key': `c-ord4-${Date.now()}` });
  const comp = await call('POST', `/v1/orders/${order4.id}/comp`, {
    amount: order4.grandTotal,
    reason: 'kitchen mistake',
  }, { ...auth, 'Idempotency-Key': `c-comp-${Date.now()}` });
  console.log(`  ✓ comp ${comp.id} → ${comp.amount}`);

  // 8. Transactions ledger + stats
  const ledger = await call('GET', `/v1/transactions?branchId=${branch.id}&pageSize=100`, null, auth);
  console.log(`  ✓ transactions ledger: ${ledger.length} rows`);
  const stats = await call('GET', `/v1/transactions/stats?branchId=${branch.id}`, null, auth);
  console.log(
    `  ✓ stats: gross=$${stats.grossSales.toFixed(2)} refunds=$${stats.refunds.toFixed(2)} net=$${stats.net.toFixed(2)} mix=${stats.methodMix.length}`,
  );

  // 9. Settlement sync + list
  const settlement = await call('POST', '/v1/settlements/sync/razorpay', null, auth);
  console.log(`  ✓ settlement: ${settlement.paymentCount} payments, net=$${settlement.netAmount.toFixed(2)}`);
  const settlements = await call('GET', '/v1/settlements', null, auth);
  console.log(`  ✓ settlements list: ${settlements.length}`);

  console.log('\n✅ All Phase C smoke checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
