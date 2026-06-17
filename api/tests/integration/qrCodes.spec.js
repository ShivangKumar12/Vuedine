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

describe('QR codes CRUD', () => {
  test('create → list (+stats) → get → update → regenerate → delete', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/qr-codes')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'COUNTER', label: 'Pickup counter' });
    expect(created.status).toBe(201);
    expect(created.body.data.type).toBe('Counter');
    expect(created.body.data.token).toBeTruthy();
    expect(created.body.data.url).toContain(`/m/${branch.qrSlug}/`);
    const id = created.body.data.id;
    const firstToken = created.body.data.token;

    const list = await request(app).get('/v1/qr-codes').set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((q) => q.id === id)).toBe(true);
    expect(list.body.meta.stats.total).toBeGreaterThanOrEqual(1);

    const got = await request(app).get(`/v1/qr-codes/${id}`).set('Authorization', `Bearer ${tok}`);
    expect(got.status).toBe(200);

    const upd = await request(app)
      .patch(`/v1/qr-codes/${id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ label: 'Front counter', status: 'INACTIVE' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.label).toBe('Front counter');
    expect(upd.body.data.statusCode).toBe('INACTIVE');

    const regen = await request(app)
      .post(`/v1/qr-codes/${id}/regenerate`)
      .set('Authorization', `Bearer ${tok}`);
    expect(regen.status).toBe(200);
    expect(regen.body.data.token).not.toBe(firstToken);
    expect(regen.body.data.statusCode).toBe('ACTIVE');

    const del = await request(app).delete(`/v1/qr-codes/${id}`).set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);
  });

  test('analytics endpoint returns a 30-day series', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/qr-codes')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'MARKETING', label: 'Poster' });

    const res = await request(app)
      .get(`/v1/qr-codes/${created.body.data.id}/analytics`)
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.series)).toBe(true);
    expect(res.body.data.series.length).toBe(30);
  });

  test('bulk-print returns a PDF', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post('/v1/qr-codes')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'TAKEAWAY', label: 'Takeaway' });

    const res = await request(app)
      .post('/v1/qr-codes/bulk-print')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id })
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('Table QR auto-mint + scan resolver', () => {
  test('creating a table auto-mints a TABLE QR; scanning records + redirects', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const table = await request(app)
      .post(`/v1/branches/${branch.id}/tables`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Table 99', section: 'Indoor', capacity: 4, shape: 'round' });
    expect(table.status).toBe(201);

    // The auto-minted QR should appear in the list as a TABLE type.
    const list = await request(app)
      .get('/v1/qr-codes')
      .query({ type: 'TABLE' })
      .set('Authorization', `Bearer ${tok}`);
    const tableQr = list.body.data.find((q) => q.tableId === table.body.data.id);
    expect(tableQr).toBeTruthy();
    expect(tableQr.typeCode).toBe('TABLE');

    const token = tableQr.token;

    // Scan resolver redirects (302) and records a scan.
    const scan = await request(app).get(`/m/${branch.qrSlug}/${token}`);
    expect(scan.status).toBe(302);
    expect(scan.headers.location).toContain(`/m/${branch.qrSlug}/${token}`);

    // Scan count incremented.
    const after = await request(app).get(`/v1/qr-codes/${tableQr.id}`).set('Authorization', `Bearer ${tok}`);
    expect(after.body.data.scans).toBeGreaterThanOrEqual(1);
  });

  test('deactivated QR → 410; unknown token → 404', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/qr-codes')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'COUNTER', label: 'Counter' });
    const token = created.body.data.token;

    await request(app)
      .patch(`/v1/qr-codes/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'INACTIVE' });

    const gone = await request(app).get(`/m/${branch.qrSlug}/${token}`);
    expect(gone.status).toBe(410);

    const missing = await request(app).get(`/m/${branch.qrSlug}/doesnotexisttoken`);
    expect(missing.status).toBe(404);
  });
});
