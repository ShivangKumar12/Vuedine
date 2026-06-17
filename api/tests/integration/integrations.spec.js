import request from 'supertest';

import { prisma } from '../../src/db/prisma.js';
import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

async function loginAs(app, user) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email: user.email, password: user._plain.password });
  return res.body.data.accessToken;
}

async function tenantSlug(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return t.slug;
}

describe('GET /v1/integrations', () => {
  test('returns the full catalog with fresh-tenant connection state', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app).get('/v1/integrations').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(24);

    const zomato = res.body.data.find((i) => i.provider === 'zomato');
    expect(zomato.status).toBe('AVAILABLE'); // nothing connected on a fresh tenant
    expect(zomato.fields.some((f) => f.secret)).toBe(true);

    // Vuedine AI is built-in → always connected.
    const ai = res.body.data.find((i) => i.provider === 'vuedine-ai');
    expect(ai.status).toBe('CONNECTED');
  });

  test('a WAITER cannot view integrations', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const waiter = await makeUser({ tenantId: tenant.id, role: 'WAITER' });
    const tok = await loginAs(app, waiter);
    const res = await request(app).get('/v1/integrations').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(403);
  });
});

describe('Connect / disconnect lifecycle', () => {
  test('connect encrypts credentials and flips status; secrets never returned', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const conn = await request(app)
      .post('/v1/integrations/zomato/connect')
      .set('Authorization', `Bearer ${tok}`)
      .send({ credentials: { merchant_id: 'ZOM-123', api_key: 'super-secret-key' } });
    expect(conn.status).toBe(201);
    expect(conn.body.data.status).toBe('CONNECTED');
    expect(conn.body.data.connectedFields).toEqual(expect.arrayContaining(['merchant_id', 'api_key']));
    // No secret material in the response.
    expect(JSON.stringify(conn.body.data)).not.toContain('super-secret-key');
    expect(conn.body.data.webhookUrl).toContain('/v1/webhooks/zomato');

    // Stored secret is encrypted at rest (not plaintext).
    const row = await prisma.integration.findFirst({ where: { tenantId: tenant.id, provider: 'zomato' } });
    expect(row.credentials.api_key).not.toBe('super-secret-key');
    expect(row.webhookSecret).toBeTruthy();

    const disc = await request(app)
      .post('/v1/integrations/zomato/disconnect')
      .set('Authorization', `Bearer ${tok}`);
    expect(disc.status).toBe(200);
    expect(disc.body.data.status).toBe('AVAILABLE');
    expect(disc.body.data.connectedFields).toEqual([]);
  });

  test('connect rejects missing credentials', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/integrations/zomato/connect')
      .set('Authorization', `Bearer ${tok}`)
      .send({ credentials: { merchant_id: 'ZOM-123' } }); // api_key missing
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INTEGRATION_MISSING_CREDENTIALS');
  });

  test('a MANAGER cannot connect (manage is OWNER/ADMIN only)', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const manager = await makeUser({ tenantId: tenant.id, role: 'MANAGER' });
    const tok = await loginAs(app, manager);
    const res = await request(app)
      .post('/v1/integrations/swiggy/connect')
      .set('Authorization', `Bearer ${tok}`)
      .send({ credentials: { partner_id: 'x', secret: 'y' } });
    expect(res.status).toBe(403);
  });

  test('test ping on a connected integration succeeds', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post('/v1/integrations/zomato/connect')
      .set('Authorization', `Bearer ${tok}`)
      .send({ credentials: { merchant_id: 'ZOM-1', api_key: 'k' } });

    const ping = await request(app).post('/v1/integrations/zomato/test').set('Authorization', `Bearer ${tok}`);
    expect(ping.status).toBe(200);
    expect(ping.body.data.ok).toBe(true);
  });
});

describe('Inbound aggregator webhook', () => {
  test('Zomato webhook creates an ONLINE order with source ZOMATO and dedupes', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const slug = await tenantSlug(tenant.id);

    const payload = {
      orderId: 'ZOM-555',
      branchId: branch.id,
      type: 'DELIVERY',
      customer: { name: 'Aggregator Guest', phone: '+919812345678' },
      items: [
        { name: 'Paneer Tikka', qty: 2, price: 220, category: 'Starters' },
        { name: 'Butter Naan', qty: 4, price: 45, category: 'Breads' },
      ],
    };

    const res = await request(app)
      .post('/v1/webhooks/zomato')
      .query({ tenant: slug })
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toBe(false);
    expect(res.body.data.orderId).toBeTruthy();

    // Order persisted with the right channel/source.
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.channel).toBe('ONLINE');
    expect(order.source).toBe('ZOMATO');
    expect(order.guestName).toBe('Aggregator Guest');

    // Re-delivering the same external id is idempotent (no second order).
    const dup = await request(app)
      .post('/v1/webhooks/zomato')
      .query({ tenant: slug })
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(dup.status).toBe(200);
    expect(dup.body.data.duplicate).toBe(true);

    const count = await prisma.order.count({ where: { tenantId: tenant.id, source: 'ZOMATO' } });
    expect(count).toBe(1);
  });

  test('Swiggy webhook routes to SWIGGY source', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const slug = await tenantSlug(tenant.id);

    const res = await request(app)
      .post('/v1/webhooks/swiggy')
      .query({ tenant: slug })
      .set('Content-Type', 'application/json')
      .send({
        orderId: 'SWG-777',
        branchId: branch.id,
        items: [{ name: 'Veg Biryani', qty: 1, price: 260 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toBe(false);
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.source).toBe('SWIGGY');
    expect(order.channel).toBe('ONLINE');
  });
});
