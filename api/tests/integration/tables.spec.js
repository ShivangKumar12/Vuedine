import request from 'supertest';

import { makeTable } from '../fixtures/table.factory.js';
import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

async function loginAs(app, user) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email: user.email, password: user._plain.password });
  return res.body.data.accessToken;
}

describe('Tables CRUD under a branch', () => {
  test('list returns branch-scoped tables, tenant-isolated', async () => {
    const app = getTestApp();
    const { tenant: t1, branch: b1 } = await makeTenant();
    const { tenant: t2, branch: b2 } = await makeTenant();
    const ownerOfT1 = await makeUser({ tenantId: t1.id, role: 'OWNER' });
    void t2;

    await makeTable({ tenantId: t1.id, branchId: b1.id, name: 'T1' });
    await makeTable({ tenantId: t1.id, branchId: b1.id, name: 'T2' });
    await makeTable({ tenantId: t2.id, branchId: b2.id, name: 'X1' });

    const tok = await loginAs(app, ownerOfT1);
    const res = await request(app)
      .get(`/v1/branches/${b1.id}/tables`)
      .set('Authorization', `Bearer ${tok}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test("cannot list tables for another tenant's branch", async () => {
    const app = getTestApp();
    const { tenant: t1 } = await makeTenant();
    const { branch: b2 } = await makeTenant();
    const ownerOfT1 = await makeUser({ tenantId: t1.id, role: 'OWNER' });
    const tok = await loginAs(app, ownerOfT1);

    const res = await request(app)
      .get(`/v1/branches/${b2.id}/tables`)
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
  });

  test('OWNER creates a table; CASHIER cannot', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const ownerTok = await loginAs(app, owner);
    const cashierTok = await loginAs(app, cashier);

    const ok = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ name: 'T-1', section: 'Indoor', capacity: 4, shape: 'round' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.qrToken).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const denied = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${cashierTok}`)
      .send({ name: 'T-2', section: 'Indoor', capacity: 4, shape: 'round' });
    expect(denied.status).toBe(403);
  });

  test('rejects duplicate name within the same branch', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await makeTable({ tenantId: tenant.id, branchId: branch.id, name: 'Patio 1' });

    const dup = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Patio 1', section: 'Outdoor', capacity: 4, shape: 'round' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('TABLE_NAME_TAKEN');
  });

  test('PATCH updates and DELETE soft-removes', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await makeTable({ tenantId: tenant.id, branchId: branch.id, name: 'A' });

    const upd = await request(app)
      .patch(`/v1/tables/${created.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ capacity: 8, shape: 'rect' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.capacity).toBe(8);
    expect(upd.body.data.shape).toBe('rect');

    const del = await request(app)
      .delete(`/v1/tables/${created.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/v1/tables/${created.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(get.status).toBe(404);
  });

  test('housekeeping status only allows FREE / CLEANING', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const t = await makeTable({ tenantId: tenant.id, branchId: branch.id });

    const ok = await request(app)
      .patch(`/v1/tables/${t.id}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'CLEANING' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('CLEANING');

    const back = await request(app)
      .patch(`/v1/tables/${t.id}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'FREE' });
    expect(back.status).toBe(200);
    expect(back.body.data.status).toBe('FREE');

    // Reserved / Occupied must be rejected — owned by orders pipeline
    const bad = await request(app)
      .patch(`/v1/tables/${t.id}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'OCCUPIED' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('cannot delete a table that is OCCUPIED / BILL / RESERVED', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const t = await makeTable({ tenantId: tenant.id, branchId: branch.id, status: 'OCCUPIED' });

    const res = await request(app)
      .delete(`/v1/tables/${t.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TABLE_IN_USE');
  });

  test('regenerate QR mints a fresh token', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const t = await makeTable({ tenantId: tenant.id, branchId: branch.id });

    const before = t.qrToken;
    const res = await request(app)
      .post(`/v1/tables/${t.id}/qr/regenerate`)
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.qrToken).not.toBe(before);
  });
});
