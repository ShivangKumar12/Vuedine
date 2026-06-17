import request from 'supertest';

import { makeItem } from '../fixtures/item.factory.js';
import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

/**
 * Items module — exercises the full middleware stack (auth → rate limit →
 * validation → controller → service → repository → cache).
 */

async function loginAs(app, user) {
  const login = await request(app)
    .post('/v1/auth/login')
    .send({ email: user.email, password: user._plain.password });
  return login.body.data.accessToken;
}

describe('GET /v1/items', () => {
  test('returns tenant-scoped items', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    await makeItem({ tenantId: tenant.id, name: 'Pizza' });
    await makeItem({ tenantId: tenant.id, name: 'Burger' });

    const token = await loginAs(app, owner);
    const res = await request(app).get('/v1/items').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const names = res.body.data.map((i) => i.name).sort();
    expect(names).toEqual(['Burger', 'Pizza']);
  });

  test('does not leak items from another tenant', async () => {
    const app = getTestApp();
    const { tenant: t1 } = await makeTenant();
    const { tenant: t2 } = await makeTenant();
    const ownerOfT1 = await makeUser({ tenantId: t1.id, role: 'OWNER' });
    await makeItem({ tenantId: t1.id, name: 'T1 only' });
    await makeItem({ tenantId: t2.id, name: 'T2 only' });

    const token = await loginAs(app, ownerOfT1);
    const res = await request(app).get('/v1/items').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('T1 only');
  });

  test('401 without token', async () => {
    const res = await request(getTestApp()).get('/v1/items');
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/items', () => {
  test('OWNER can create; CASHIER cannot', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });

    const ownerTok = await loginAs(app, owner);
    const cashierTok = await loginAs(app, cashier);

    const payload = {
      name: 'Test Pizza',
      category: 'Mains',
      price: 299,
      veg: true,
    };

    const ok = await request(app)
      .post('/v1/items')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send(payload);
    expect(ok.status).toBe(201);
    expect(ok.body.data.name).toBe('Test Pizza');

    const denied = await request(app)
      .post('/v1/items')
      .set('Authorization', `Bearer ${cashierTok}`)
      .send({ ...payload, name: 'Cashier Pizza' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  test('rejects invalid payload (zod validation)', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/items')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'x' }); // missing category, price

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
