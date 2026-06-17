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
        { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza' },
        { itemName: 'Mojito', qty: 1, unitPrice: 4, category: 'Cocktails' },
      ],
    });
  return res.body.data;
}

describe('POST /v1/orders/:id/payments', () => {
  test('cash payment marks order PAID and emits transaction', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CASH', amount: order.grandTotal });

    expect(pay.status).toBe(201);
    expect(pay.body.data.statusCode).toBe('SUCCESS');
    expect(pay.body.data.method).toBe('Cash');

    const reread = await request(app)
      .get(`/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(reread.body.data.paymentStatus).toBe('PAID');
  });

  test('UPI payment defaults to PENDING (gateway capture comes later)', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'UPI', amount: order.grandTotal });
    expect(pay.status).toBe(201);
    expect(pay.body.data.statusCode).toBe('PENDING');
  });

  test('card with capture=true marks SUCCESS', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({
        method: 'CARD',
        amount: order.grandTotal,
        capture: true,
        reference: 'auth-12345',
      });
    expect(pay.status).toBe(201);
    expect(pay.body.data.statusCode).toBe('SUCCESS');
    expect(pay.body.data.reference).toBe('auth-12345');
  });

  test('CASHIER can record payment but not refund', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const cashTok = await loginAs(app, cashier);
    const ownerTok = await loginAs(app, owner);

    const order = await placeOrder(app, ownerTok, branch.id);
    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${cashTok}`)
      .send({ method: 'CASH', amount: order.grandTotal });
    expect(pay.status).toBe(201);

    const denied = await request(app)
      .post(`/v1/orders/${order.id}/payments/${pay.body.data.serverId}/refund`)
      .set('Authorization', `Bearer ${cashTok}`)
      .send({ amount: 1, reason: 'test' });
    expect(denied.status).toBe(403);
  });
});

describe('Refunds', () => {
  test('full refund flips order to REFUNDED', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CASH', amount: order.grandTotal });

    const refund = await request(app)
      .post(`/v1/orders/${order.id}/payments/${pay.body.data.serverId}/refund`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ amount: order.grandTotal, reason: 'guest unhappy' });
    expect(refund.status).toBe(201);
    expect(refund.body.data.typeCode).toBe('REFUND');
    expect(refund.body.data.amount).toBe(-order.grandTotal);

    const reread = await request(app)
      .get(`/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(reread.body.data.paymentStatus).toBe('REFUNDED');
  });

  test('partial refund keeps remaining unrefunded', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const pay = await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CASH', amount: order.grandTotal });

    const half = +(order.grandTotal / 2).toFixed(2);
    const refund1 = await request(app)
      .post(`/v1/orders/${order.id}/payments/${pay.body.data.serverId}/refund`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ amount: half });
    expect(refund1.status).toBe(201);

    // Second refund cannot exceed remaining
    const tooBig = await request(app)
      .post(`/v1/orders/${order.id}/payments/${pay.body.data.serverId}/refund`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ amount: order.grandTotal });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error.code).toBe('REFUND_EXCEEDS_REMAINING');
  });
});

describe('Comp', () => {
  test('manager comps an order', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    const comp = await request(app)
      .post(`/v1/orders/${order.id}/comp`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ amount: order.grandTotal, reason: 'kitchen mistake' });
    expect(comp.status).toBe(201);
    expect(comp.body.data.typeCode).toBe('COMP');
    expect(comp.body.data.amount).toBeLessThan(0);
  });
});

describe('GET /v1/transactions', () => {
  test('list filters by method and status', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CASH', amount: order.grandTotal });

    const list = await request(app)
      .get('/v1/transactions')
      .query({ branchId: branch.id, method: 'CASH', status: 'SUCCESS' })
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data[0].method).toBe('Cash');

    const stats = await request(app)
      .get('/v1/transactions/stats')
      .query({ branchId: branch.id })
      .set('Authorization', `Bearer ${tok}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data.grossSales).toBeGreaterThanOrEqual(order.grandTotal - 0.01);
    expect(stats.body.data.methodMix).toBeInstanceOf(Array);
  });
});

describe('Settlements', () => {
  test('manual sync creates a settlement row from gateway-routed sales', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await placeOrder(app, tok, branch.id);

    await request(app)
      .post(`/v1/orders/${order.id}/payments`)
      .set('Authorization', `Bearer ${tok}`)
      .send({
        method: 'CARD',
        amount: order.grandTotal,
        gateway: 'razorpay',
        reference: 'rzp_pay_test_1',
        capture: true,
        fee: 0.5,
      });

    const sync = await request(app)
      .post('/v1/settlements/sync/razorpay')
      .set('Authorization', `Bearer ${tok}`);
    expect(sync.status).toBe(200);
    expect(sync.body.data.gateway).toBe('razorpay');
    expect(sync.body.data.paymentCount).toBe(1);
    expect(sync.body.data.netAmount).toBeCloseTo(order.grandTotal - 0.5, 2);

    const list = await request(app)
      .get('/v1/settlements')
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET / PATCH /v1/settings/payments', () => {
  test('get returns defaults; patch updates and masks secret on read', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const get = await request(app)
      .get('/v1/settings/payments')
      .set('Authorization', `Bearer ${tok}`);
    expect(get.status).toBe(200);
    expect(get.body.data.cashEnabled).toBe(true);
    expect(get.body.data.gateway).toBe('razorpay');

    const patch = await request(app)
      .patch('/v1/settings/payments')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        cashEnabled: false,
        razorpayKeyId: 'rzp_test_KKKK',
        razorpayKeySecret: 'secret-raw-value',
        autoCapture: false,
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.cashEnabled).toBe(false);
    expect(patch.body.data.autoCapture).toBe(false);
    expect(patch.body.data.razorpayKeyId).toBe('rzp_test_KKKK');
    // Secret should be masked
    expect(patch.body.data.razorpayKeySecret).toMatch(/\*+/);
  });
});
