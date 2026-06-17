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

async function placeOrder(app, tok, branchId) {
  const res = await request(app)
    .post('/v1/orders')
    .set('Authorization', `Bearer ${tok}`)
    .send({
      branchId,
      type: 'DINE_IN',
      channel: 'POS',
      lines: [{ itemName: 'Margherita', qty: 2, unitPrice: 4.5, category: 'Pizza', emoji: '🍕' }],
    });
  return res.body.data;
}

async function serveOrder(app, tok, id) {
  for (let i = 0; i < 4; i += 1) {
    await request(app).post(`/v1/orders/${id}/advance`).set('Authorization', `Bearer ${tok}`);
  }
}

describe('POST /v1/ai/chat', () => {
  test('returns a grounded reply and consumes one AI request', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/ai/chat')
      .set('Authorization', `Bearer ${tok}`)
      .send({ message: 'How are sales this week?' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.reply).toBe('string');
    expect(res.body.data.reply.length).toBeGreaterThan(0);
    expect(res.body.data.engine).toBe('local'); // no OpenAI key configured
    expect(res.body.data.usage.used).toBe(1);
    expect(res.body.data.usage.limit).toBe(50000); // default Growth quota
  });

  test('reply is grounded in real revenue after orders', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const o1 = await placeOrder(app, tok, branch.id);
    const o2 = await placeOrder(app, tok, branch.id);
    await request(app).post(`/v1/orders/${o1.id}/payments`).set('Authorization', `Bearer ${tok}`).send({ method: 'CASH', amount: o1.grandTotal });
    await request(app).post(`/v1/orders/${o2.id}/payments`).set('Authorization', `Bearer ${tok}`).send({ method: 'CASH', amount: o2.grandTotal });
    await serveOrder(app, tok, o1.id);
    await serveOrder(app, tok, o2.id);

    const res = await request(app)
      .post('/v1/ai/chat')
      .set('Authorization', `Bearer ${tok}`)
      .send({ message: 'What is my revenue?' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toMatch(/₹\d/);
    expect(res.body.data.context).toContain('revenue');
  });

  test('a WAITER cannot use AI chat', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const waiter = await makeUser({ tenantId: tenant.id, role: 'WAITER' });
    const tok = await loginAs(app, waiter);
    const res = await request(app)
      .post('/v1/ai/chat')
      .set('Authorization', `Bearer ${tok}`)
      .send({ message: 'hi' });
    expect(res.status).toBe(403);
  });
});

describe('AI quota enforcement (Phase K)', () => {
  test('chat is blocked with 402 once the quota is exhausted', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    // Provision the subscription, then clamp the AI quota to 1.
    await request(app).get('/v1/ai/usage').set('Authorization', `Bearer ${tok}`);
    await prisma.subscription.update({ where: { tenantId: tenant.id }, data: { aiQuota: 1 } });

    const first = await request(app).post('/v1/ai/chat').set('Authorization', `Bearer ${tok}`).send({ message: 'one' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/v1/ai/chat').set('Authorization', `Bearer ${tok}`).send({ message: 'two' });
    expect(second.status).toBe(402);
    expect(second.body.error.code).toBe('AI_QUOTA_EXCEEDED');
    expect(second.body.error.details.upgrade).toBe('/dashboard/subscription');
  });
});

describe('GET /v1/ai/suggestions', () => {
  test('returns grounded suggestions + context', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app).get('/v1/ai/suggestions').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.suggestions)).toBe(true);
    expect(res.body.data.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.suggestions[0]).toHaveProperty('kind');
    expect(res.body.data.context).toHaveProperty('totalSales');
  });
});

describe('GET /v1/ai/usage', () => {
  test('reports used/limit/remaining', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app).get('/v1/ai/usage').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(50000);
    expect(res.body.data.remaining).toBe(50000);
  });
});
