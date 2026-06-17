import request from 'supertest';

import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

async function loginAs(app, user) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email: user.email, password: user._plain.password });
  return res.body.data.accessToken;
}

async function placeOrder(app, tok, branchId, lines) {
  const res = await request(app)
    .post('/v1/orders')
    .set('Authorization', `Bearer ${tok}`)
    .send({
      branchId,
      type: 'DINE_IN',
      channel: 'POS',
      lines: lines ?? [
        { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza', emoji: '🍕' },
        { itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails', emoji: '🍹' },
      ],
    });
  return res.body.data;
}

async function payCash(app, tok, orderId, amount) {
  return request(app)
    .post(`/v1/orders/${orderId}/payments`)
    .set('Authorization', `Bearer ${tok}`)
    .send({ method: 'CASH', amount });
}

/** Advance a DINE_IN order PENDING → ACCEPTED → PREPARING → READY → SERVED. */
async function serveOrder(app, tok, orderId) {
  for (let i = 0; i < 4; i += 1) {
    await request(app).post(`/v1/orders/${orderId}/advance`).set('Authorization', `Bearer ${tok}`);
  }
}

describe('GET /v1/reports/dashboard', () => {
  test('aggregates orders/sales/status from base tables', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const o1 = await placeOrder(app, tok, branch.id);
    const o2 = await placeOrder(app, tok, branch.id);
    const o3 = await placeOrder(app, tok, branch.id);

    // Pay all three, serve only the first two.
    await payCash(app, tok, o1.id, o1.grandTotal);
    await payCash(app, tok, o2.id, o2.grandTotal);
    await payCash(app, tok, o3.id, o3.grandTotal);
    await serveOrder(app, tok, o1.id);
    await serveOrder(app, tok, o2.id);

    const res = await request(app)
      .get('/v1/reports/dashboard')
      .query({ branchId: branch.id })
      .set('Authorization', `Bearer ${tok}`);

    expect(res.status).toBe(200);
    const d = res.body.data;

    // 3 non-cancelled orders.
    expect(d.kpis.totalOrders.value).toBe(3);
    expect(d.orderStatusCounts.total).toBe(3);
    // Two served (= "prepared"/served terminal), one still pending.
    expect(d.orderStatusCounts.pending).toBe(1);

    // Completed sales = the two served orders' grand totals (rounded).
    const expectedSales = Math.round(o1.grandTotal + o2.grandTotal);
    expect(d.kpis.totalSales.value).toBe(expectedSales);
    expect(d.salesSummary.totalSales).toBe(expectedSales);

    // Most-popular items should surface the seeded order lines.
    expect(Array.isArray(d.mostPopularItems)).toBe(true);
    const names = d.mostPopularItems.map((i) => i.name);
    expect(names).toContain('Margherita');
  });

  test('a WAITER cannot view the dashboard', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const waiter = await makeUser({ tenantId: tenant.id, role: 'WAITER' });
    const tok = await loginAs(app, waiter);
    const res = await request(app).get('/v1/reports/dashboard').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /v1/reports/sales', () => {
  test('KPIs, mix and paginated rows match the placed orders', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const orders = [];
    for (let i = 0; i < 3; i += 1) {
      const o = await placeOrder(app, tok, branch.id);
      await payCash(app, tok, o.id, o.grandTotal);
      orders.push(o);
    }
    const expectedEarnings = orders.reduce((s, o) => s + o.grandTotal, 0);

    const res = await request(app)
      .get('/v1/reports/sales')
      .query({ branchId: branch.id, page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${tok}`);

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.kpis.orders).toBe(3);
    expect(d.kpis.earnings).toBeCloseTo(expectedEarnings, 2);
    expect(res.body.meta.total).toBe(3);
    expect(d.rows.length).toBe(3);

    // All paid via cash → cash share is 100%.
    const cash = d.paymentMix.find((m) => m.m === 'Cash');
    expect(cash.share).toBeCloseTo(1, 5);
    // Every row is a paid dine-in.
    expect(d.rows.every((r) => r.status === 'Paid')).toBe(true);
    expect(d.rows.every((r) => r.type === 'Dine-In')).toBe(true);
  });

  test('status filter narrows the result set', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const paid = await placeOrder(app, tok, branch.id);
    await payCash(app, tok, paid.id, paid.grandTotal);
    await placeOrder(app, tok, branch.id); // left unpaid → Pending

    const res = await request(app)
      .get('/v1/reports/sales')
      .query({ branchId: branch.id, status: 'Paid' })
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.orders).toBe(1);
    expect(res.body.data.rows[0].status).toBe('Paid');
  });
});

describe('GET /v1/reports/sales/export', () => {
  test('inline CSV streams one data row per order', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const o1 = await placeOrder(app, tok, branch.id);
    const o2 = await placeOrder(app, tok, branch.id);
    await payCash(app, tok, o1.id, o1.grandTotal);
    await payCash(app, tok, o2.id, o2.grandTotal);

    const res = await request(app)
      .get('/v1/reports/sales/export')
      .query({ branchId: branch.id, format: 'csv' })
      .set('Authorization', `Bearer ${tok}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    // header + 2 rows
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/Order ID,Date,Total/);
    expect(res.text).toContain(o1.serial);
    expect(res.text).toContain(o2.serial);
  });
});

describe('GET /v1/reports/staff/performance', () => {
  test('credits the cashier who recorded the sale', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const o = await placeOrder(app, tok, branch.id);
    await payCash(app, tok, o.id, o.grandTotal);

    const res = await request(app)
      .get('/v1/reports/staff/performance')
      .query({ branchId: branch.id })
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.cashiers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.cashiers[0].transactions).toBeGreaterThanOrEqual(1);
    expect(res.body.data.cashiers[0].sales).toBeGreaterThan(0);
  });
});
