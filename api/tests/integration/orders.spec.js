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

function basicLines() {
  return [
    { itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza' },
    { itemName: 'Mojito', qty: 1, unitPrice: 4.0, category: 'Cocktails' },
  ];
}

describe('POST /v1/orders/calculate', () => {
  test('returns server-authoritative totals', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/orders/calculate')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, lines: basicLines() });

    expect(res.status).toBe(200);
    expect(res.body.data.subtotal).toBe(13);
    // GST 5% default
    expect(res.body.data.taxTotal).toBeCloseTo(0.65, 2);
    expect(res.body.data.grandTotal).toBeCloseTo(13.65, 2);
  });

  test('rejects unknown branch', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const res = await request(app)
      .post('/v1/orders/calculate')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: 'cm0000000nonexistent', lines: basicLines() });
    expect(res.status).toBe(404);
  });
});

describe('POST /v1/orders', () => {
  test('OWNER creates an order', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        branchId: branch.id,
        type: 'DINE_IN',
        channel: 'POS',
        tableLabel: 'Table 1',
        lines: basicLines(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.serial).toMatch(/^[A-Z0-9]+-\d+$/);
    expect(res.body.data.token).toMatch(/^TKN-\d+$/);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.grandTotal).toBeGreaterThan(0);
  });

  test('Idempotency-Key dedupes retries', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const key = 'idempo-test-' + Date.now();
    const body = {
      branchId: branch.id,
      type: 'DINE_IN',
      channel: 'POS',
      lines: basicLines(),
    };

    const r1 = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .set('Idempotency-Key', key)
      .send(body);
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .set('Idempotency-Key', key)
      .send(body);
    // Replay returns the same id
    expect([200, 201]).toContain(r2.status);
    expect(r2.body.data.id).toBe(r1.body.data.id);
  });

  test('CASHIER can create, OWNER can advance', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });

    const cashierTok = await loginAs(app, cashier);
    const ownerTok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${cashierTok}`)
      .send({
        branchId: branch.id,
        type: 'TAKEAWAY',
        channel: 'POS',
        lines: basicLines(),
      });
    expect(created.status).toBe(201);

    const adv1 = await request(app)
      .post(`/v1/orders/${created.body.data.id}/advance`)
      .set('Authorization', `Bearer ${ownerTok}`);
    expect(adv1.status).toBe(200);
    expect(adv1.body.data.status).toBe('ACCEPTED');
  });
});

describe('Order state machine via API', () => {
  async function createOrder(app, tok, branchId, type = 'DINE_IN') {
    const res = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId, type, channel: 'POS', lines: basicLines() });
    return res.body.data;
  }

  test('happy path dine-in: PENDING → ACCEPTED → PREPARING → READY → SERVED', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await createOrder(app, tok, branch.id);

    let cur = order;
    for (const next of ['ACCEPTED', 'PREPARING', 'READY', 'SERVED']) {
      const r = await request(app)
        .patch(`/v1/orders/${cur.id}/status`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ status: next });
      expect(r.status).toBe(200);
      expect(r.body.data.status).toBe(next);
      cur = r.body.data;
    }
  });

  test('rejects invalid transition', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const order = await createOrder(app, tok, branch.id);
    const r = await request(app)
      .patch(`/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'SERVED' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('ORDER_INVALID_TRANSITION');
  });

  test('cancel + recall', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const o1 = await createOrder(app, tok, branch.id);
    const cancel = await request(app)
      .post(`/v1/orders/${o1.id}/cancel`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ reason: 'guest changed mind' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');

    const o2 = await createOrder(app, tok, branch.id);
    for (const s of ['ACCEPTED', 'PREPARING', 'READY']) {
      await request(app)
        .patch(`/v1/orders/${o2.id}/status`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ status: s });
    }
    const recall = await request(app)
      .post(`/v1/orders/${o2.id}/recall`)
      .set('Authorization', `Bearer ${tok}`);
    expect(recall.status).toBe(200);
    expect(recall.body.data.status).toBe('PREPARING');
  });
});

describe('GET /v1/orders + list filters', () => {
  test('lists with status + channel filters', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    // Create two orders, advance one to PREPARING
    const o1 = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'DINE_IN', channel: 'POS', lines: basicLines() });
    const o2 = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'DELIVERY', channel: 'ONLINE', source: 'ZOMATO', lines: basicLines() });
    expect(o1.status).toBe(201);
    expect(o2.status).toBe(201);

    const list = await request(app)
      .get('/v1/orders')
      .query({ branchId: branch.id, channel: 'ONLINE' })
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].channel).toBe('ONLINE');
  });
});

describe('GET /v1/oss/:branchSlug/tokens (public)', () => {
  test('public board returns Preparing/Ready tokens', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'DINE_IN', channel: 'POS', lines: basicLines() });
    expect(created.status).toBe(201);
    for (const s of ['ACCEPTED', 'PREPARING']) {
      await request(app)
        .patch(`/v1/orders/${created.body.data.id}/status`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ status: s });
    }

    const board = await request(app).get(`/v1/oss/${branch.qrSlug}/tokens`);
    expect(board.status).toBe(200);
    expect(Array.isArray(board.body.data.preparing)).toBe(true);
    expect(board.body.data.preparing.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Public PWA flow', () => {
  test('place order via /v1/public/orders', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    void tenant;
    // Need a table on this branch for QR resolve.
    const ownerSeeded = await makeUser({ tenantId: branch.tenantId, role: 'OWNER' });
    const tok = await loginAs(app, ownerSeeded);
    const tableRes = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Table 1', section: 'Indoor', capacity: 4, shape: 'round' });
    expect(tableRes.status).toBe(201);
    const table = tableRes.body.data;

    const place = await request(app)
      .post('/v1/public/orders')
      .send({
        branchSlug: branch.qrSlug,
        qrToken: table.qrToken,
        lines: basicLines(),
        guestName: 'Alex',
        payMode: 'pay-at-counter',
      });
    expect(place.status).toBe(201);
    expect(place.body.data.channel).toBe('QR');
    expect(place.body.data.tableLabel).toBe('Table 1');

    const track = await request(app).get(`/v1/public/orders/${place.body.data.id}`);
    expect(track.status).toBe(200);
    expect(track.body.data.id).toBe(place.body.data.id);

    const ring = await request(app)
      .post(`/v1/public/orders/${place.body.data.id}/signal`)
      .send({ type: 'WAITER_RING' });
    expect(ring.status).toBe(201);
  });
});

describe('Table sessions', () => {
  test('open + close cycles table status', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const tableRes = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Table A', section: 'Indoor', capacity: 4, shape: 'round' });
    expect(tableRes.status).toBe(201);
    const table = tableRes.body.data;

    const open = await request(app)
      .post('/v1/table-sessions')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, tableId: table.id, partySize: 3 });
    expect(open.status).toBe(201);

    // Re-open is idempotent.
    const open2 = await request(app)
      .post('/v1/table-sessions')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, tableId: table.id, partySize: 3 });
    expect(open2.status).toBe(201);
    expect(open2.body.data.id).toBe(open.body.data.id);

    const close = await request(app)
      .post(`/v1/table-sessions/${open.body.data.id}/close`)
      .set('Authorization', `Bearer ${tok}`);
    expect(close.status).toBe(200);
    expect(close.body.data.status).toBe('CLOSED');
  });
});

describe('KDS', () => {
  test('lists active tickets only', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    // Create + accept one
    const created = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'DINE_IN', channel: 'POS', lines: basicLines() });
    await request(app)
      .patch(`/v1/orders/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'ACCEPTED' });

    // Create + cancel another
    const cancelled = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'DINE_IN', channel: 'POS', lines: basicLines() });
    await request(app)
      .post(`/v1/orders/${cancelled.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${tok}`)
      .send({});

    const tickets = await request(app)
      .get('/v1/kds/tickets')
      .query({ branchId: branch.id })
      .set('Authorization', `Bearer ${tok}`);
    expect(tickets.status).toBe(200);
    const ids = tickets.body.data.map((t) => t.id);
    expect(ids).toContain(created.body.data.id);
    expect(ids).not.toContain(cancelled.body.data.id);
  });
});
