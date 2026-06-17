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

describe('GET /v1/branches', () => {
  test('returns the seeded branch + tenant scoping', async () => {
    const app = getTestApp();
    const { tenant: t1, branch: b1 } = await makeTenant();
    const { tenant: t2 } = await makeTenant();
    const ownerOfT1 = await makeUser({ tenantId: t1.id, role: 'OWNER' });

    // Branch under t2 must not appear in t1's list
    const { branch: _b2 } = await makeTenant({ slug: 'should-not-list' });
    void _b2;
    void t2;

    const tok = await loginAs(app, ownerOfT1);
    const res = await request(app).get('/v1/branches').set('Authorization', `Bearer ${tok}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(b1.id);
    expect(res.body.data[0]._count.tables).toBe(0);
  });

  test('401 without token', async () => {
    const res = await request(getTestApp()).get('/v1/branches');
    expect(res.status).toBe(401);
  });
});

describe('POST /v1/branches', () => {
  test('OWNER creates a branch; CASHIER cannot', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });

    const ownerTok = await loginAs(app, owner);
    const cashierTok = await loginAs(app, cashier);

    const payload = {
      name: 'Test Branch',
      code: 'TST',
      qrSlug: 'test-' + Date.now(),
      address: '1 Test Lane',
      diningSections: ['Indoor', 'Outdoor'],
    };

    const ok = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send(payload);
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe('TST');
    expect(ok.body.data.qrSlug).toBe(payload.qrSlug);

    const denied = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${cashierTok}`)
      .send({ ...payload, code: 'CSH', qrSlug: 'cashier-' + Date.now() });
    expect(denied.status).toBe(403);
  });

  test('rejects duplicate code in same tenant', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const first = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'A', code: 'AAA', qrSlug: 'aaa-' + Date.now() });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'B', code: 'AAA', qrSlug: 'unique-' + Date.now() });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('BRANCH_CODE_TAKEN');
  });

  test('rejects duplicate qrSlug globally', async () => {
    const app = getTestApp();
    const { tenant: t1 } = await makeTenant();
    const { tenant: t2 } = await makeTenant();
    const u1 = await makeUser({ tenantId: t1.id, role: 'OWNER' });
    const u2 = await makeUser({ tenantId: t2.id, role: 'OWNER' });

    const slug = 'shared-slug-' + Date.now();

    const ok = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${await loginAs(app, u1)}`)
      .send({ name: 'A', code: 'AAA', qrSlug: slug });
    expect(ok.status).toBe(201);

    const dup = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${await loginAs(app, u2)}`)
      .send({ name: 'B', code: 'BBB', qrSlug: slug });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('BRANCH_SLUG_TAKEN');
  });
});

describe('PATCH /v1/branches/:id + toggle-live + DELETE', () => {
  test('owner updates branch fields', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .patch(`/v1/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ phone: '+91 99999 11111', diningSections: ['Bar', 'Lounge'] });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+91 99999 11111');
    expect(res.body.data.diningSections).toEqual(['Bar', 'Lounge']);
  });

  test('toggle-live flips isLive', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const before = branch.isLive;
    const r1 = await request(app)
      .post(`/v1/branches/${branch.id}/toggle-live`)
      .set('Authorization', `Bearer ${tok}`)
      .send({});
    expect(r1.status).toBe(200);
    expect(r1.body.data.isLive).toBe(!before);
  });

  test('owner deletes; subsequent GET returns 404', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const del = await request(app)
      .delete(`/v1/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/v1/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(get.status).toBe(404);
  });
});

describe('GET /v1/branches/:id/sections', () => {
  test('returns the diningSections list', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const sections = ['Indoor', 'Patio', 'Counter'];
    await request(app)
      .patch(`/v1/branches/${branch.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ diningSections: sections });

    const res = await request(app)
      .get(`/v1/branches/${branch.id}/sections`)
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(sections);
  });
});
