/* eslint-disable no-console */
/**
 * Phase B smoke test — exercises POS, public PWA, KDS, OSS in one pass.
 *
 *   node scripts/smoke-phase-b.js
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
  console.log('Phase B smoke test\n');

  // 1. Login as the seeded owner
  const login = await call('POST', '/v1/auth/login', {
    email: 'owner@vuedine.demo',
    password: 'vuedine123',
  });
  const token = login.accessToken;
  console.log(`  ✓ login as ${login.user.email}`);

  // 2. List branches → pick first
  const branches = await call('GET', '/v1/branches', null, {
    Authorization: `Bearer ${token}`,
  });
  const branch = branches[0];
  console.log(`  ✓ branch: ${branch.name} (${branch.code}, slug=${branch.qrSlug})`);

  // 3. List tables for that branch → pick first
  const tables = await call(
    'GET',
    `/v1/branches/${branch.id}/tables?pageSize=10`,
    null,
    { Authorization: `Bearer ${token}` },
  );
  const table = tables[0];
  console.log(`  ✓ table: ${table.name} (qrToken=${table.qrToken.slice(0, 6)}…)`);

  // 4. Calculate totals (POS preview)
  const calc = await call(
    'POST',
    '/v1/orders/calculate',
    {
      branchId: branch.id,
      lines: [
        { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza' },
        { itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails' },
      ],
    },
    { Authorization: `Bearer ${token}` },
  );
  console.log(
    `  ✓ calc: subtotal=$${calc.subtotal} tax=$${calc.taxTotal} service=$${calc.serviceTotal} total=$${calc.grandTotal}`,
  );

  // 5. Place a POS order
  const order = await call(
    'POST',
    '/v1/orders',
    {
      branchId: branch.id,
      type: 'DINE_IN',
      channel: 'POS',
      tableId: table.id,
      tableLabel: table.name,
      paymentMode: 'CASH',
      lines: [
        { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza' },
        { itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails' },
      ],
    },
    { Authorization: `Bearer ${token}`, 'Idempotency-Key': `smoke-${Date.now()}` },
  );
  console.log(`  ✓ order: ${order.serial} ${order.token} ($${order.grandTotal})`);

  // 6. State machine
  for (const next of ['ACCEPTED', 'PREPARING']) {
    const u = await call(
      'PATCH',
      `/v1/orders/${order.id}/status`,
      { status: next },
      { Authorization: `Bearer ${token}` },
    );
    console.log(`  ✓ status → ${u.status}`);
  }

  // 7. Per-line prepared toggle (KDS)
  const lineId = order.items[0].id;
  const updatedTicket = await call(
    'PATCH',
    `/v1/orders/${order.id}/lines/${lineId}/prepared`,
    { prepared: true },
    { Authorization: `Bearer ${token}` },
  );
  console.log(`  ✓ kds line prepared: ${updatedTicket.items[0].prepared}`);

  // 8. KDS tickets list
  const tickets = await call('GET', `/v1/kds/tickets?branchId=${branch.id}`, null, {
    Authorization: `Bearer ${token}`,
  });
  console.log(`  ✓ kds tickets: ${tickets.length} active`);

  // 9. OSS public board
  const board = await fetch(`${BASE}/v1/oss/${branch.qrSlug}/tokens`).then((r) => r.json());
  console.log(
    `  ✓ oss: preparing=${board.data.preparing.length} ready=${board.data.ready.length}`,
  );

  // 10. Public QR resolve
  const resolve = await fetch(
    `${BASE}/v1/public/qr/${branch.qrSlug}/${table.qrToken}`,
  ).then((r) => r.json());
  console.log(`  ✓ public qr resolve: ${resolve.data.branch.name} / ${resolve.data.table.name}`);

  // 11. Public menu
  const menu = await fetch(`${BASE}/v1/public/menu/${branch.qrSlug}`).then((r) => r.json());
  console.log(`  ✓ public menu: ${menu.data.items.length} items`);

  // 12. Public place order
  const guestPlace = await fetch(`${BASE}/v1/public/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `pwa-${Date.now()}`,
    },
    body: JSON.stringify({
      branchSlug: branch.qrSlug,
      qrToken: table.qrToken,
      lines: [
        { itemName: 'Truffle Burger', qty: 1, unitPrice: 5.9, category: 'Burgers' },
      ],
      guestName: 'Smoke Test Guest',
      payMode: 'pay-at-counter',
    }),
  }).then((r) => r.json());
  if (!guestPlace.success) {
    throw new Error(`Public place failed: ${guestPlace.error?.message}`);
  }
  console.log(
    `  ✓ public place order: ${guestPlace.data.serial} ($${guestPlace.data.grandTotal})`,
  );

  // 13. Public track
  const track = await fetch(`${BASE}/v1/public/orders/${guestPlace.data.id}`).then((r) =>
    r.json(),
  );
  console.log(`  ✓ public track: status=${track.data.status}`);

  // 14. Public ring waiter
  const ring = await fetch(`${BASE}/v1/public/orders/${guestPlace.data.id}/signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'WAITER_RING' }),
  }).then((r) => r.json());
  console.log(`  ✓ public signal: ${ring.data.type} recorded`);

  // 15. Sessions list
  const sessions = await call('GET', `/v1/table-sessions?branchId=${branch.id}`, null, {
    Authorization: `Bearer ${token}`,
  });
  console.log(`  ✓ sessions: ${sessions.length} listed`);

  console.log('\n✅ All Phase B smoke checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
