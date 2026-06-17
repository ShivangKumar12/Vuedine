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

describe('POST /v1/api-keys', () => {
  test('OWNER issues a key; raw value returned once; list omits hash', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const token = await loginAs(app, owner);

    const issued = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Smoke Key', scopes: ['orders:read', 'items:read'] });

    expect(issued.status).toBe(201);
    expect(issued.body.data.key).toMatch(/^sk_live_/);
    expect(issued.body.data.prefix).toMatch(/^sk_live_/);

    const listed = await request(app).get('/v1/api-keys').set('Authorization', `Bearer ${token}`);

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    const row = listed.body.data[0];
    expect(row.name).toBe('Smoke Key');
    expect(row).not.toHaveProperty('hash'); // hash never leaked over the wire
    expect(row.revokedAt).toBeNull();
  });

  test('CASHIER cannot issue keys', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const token = await loginAs(app, cashier);

    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', scopes: ['orders:read'] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  test('DELETE revokes; subsequent verify returns 404 for revoke retry', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const token = await loginAs(app, owner);

    const issued = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To-Revoke', scopes: ['items:read'] });
    const id = issued.body.data.id;

    const del = await request(app)
      .delete(`/v1/api-keys/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const del2 = await request(app)
      .delete(`/v1/api-keys/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del2.status).toBe(404);
    expect(del2.body.error.code).toBe('API_KEY_NOT_FOUND');
  });

  test('invalid scope rejected by zod', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const token = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', scopes: ['admin:godmode'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
