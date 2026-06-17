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

describe('Settings bundle + tenant patches', () => {
  test('GET /v1/settings returns tenant + taxSlabs + paymentMethods', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app).get('/v1/settings').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tenant).toBeTruthy();
    expect(Array.isArray(res.body.data.taxSlabs)).toBe(true);
    expect(Array.isArray(res.body.data.paymentMethods)).toBe(true);
  });

  test('PATCH tenant / branding / localization persists', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const t = await request(app)
      .patch('/v1/settings/tenant')
      .set('Authorization', `Bearer ${tok}`)
      .send({ gstin: '27AAAAA0000A1Z5', serviceChargeEnabled: true, serviceChargePct: 7, invoicePrefix: 'TST' });
    expect(t.status).toBe(200);
    expect(t.body.data.gstin).toBe('27AAAAA0000A1Z5');
    expect(t.body.data.serviceChargePct).toBe(7);
    expect(t.body.data.invoicePrefix).toBe('TST');

    const b = await request(app)
      .patch('/v1/settings/branding')
      .set('Authorization', `Bearer ${tok}`)
      .send({ brandColor: '#123456', brandTheme: 'dark' });
    expect(b.status).toBe(200);
    expect(b.body.data.brandColor).toBe('#123456');
    expect(b.body.data.brandTheme).toBe('dark');

    const l = await request(app)
      .patch('/v1/settings/localization')
      .set('Authorization', `Bearer ${tok}`)
      .send({ currency: 'USD', weekStart: 'SUNDAY' });
    expect(l.status).toBe(200);
    expect(l.body.data.currency).toBe('USD');
    expect(l.body.data.weekStart).toBe('SUNDAY');
  });

  test('MANAGER cannot patch tenant settings', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const manager = await makeUser({ tenantId: tenant.id, role: 'MANAGER' });
    const tok = await loginAs(app, manager);
    const res = await request(app)
      .patch('/v1/settings/tenant')
      .set('Authorization', `Bearer ${tok}`)
      .send({ gstin: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('Tax slabs CRUD', () => {
  test('create → list → set default → delete', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/tax-slabs')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'GST 18%', rate: 18, isDefault: true });
    expect(created.status).toBe(201);
    expect(created.body.data.rate).toBe(18);
    expect(created.body.data.isDefault).toBe(true);

    const list = await request(app).get('/v1/tax-slabs').set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((s) => s.id === created.body.data.id)).toBe(true);

    const del = await request(app)
      .delete(`/v1/tax-slabs/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);
  });
});

describe('Payment-method configs', () => {
  test('upsert is idempotent on (tenant, branch, method)', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const a = await request(app)
      .post('/v1/payment-method-configs')
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CARD', enabled: true, serviceCharge: 2 });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post('/v1/payment-method-configs')
      .set('Authorization', `Bearer ${tok}`)
      .send({ method: 'CARD', enabled: false, serviceCharge: 3 });
    expect(b.status).toBe(201);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(b.body.data.enabled).toBe(false);
    expect(b.body.data.serviceCharge).toBe(3);
  });
});

describe('Hardware devices', () => {
  test('create → pair (token once) → heartbeat → delete; token hidden on list', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/hardware-devices')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, type: 'RECEIPT_PRINTER', label: 'Counter printer', ip: '192.168.1.50' });
    expect(created.status).toBe(201);
    expect(created.body.data.pairingToken).toBeUndefined();

    const id = created.body.data.id;

    const paired = await request(app)
      .post(`/v1/hardware-devices/${id}/pair`)
      .set('Authorization', `Bearer ${tok}`);
    expect(paired.status).toBe(200);
    expect(typeof paired.body.data.pairingToken).toBe('string');
    expect(paired.body.data.pairingToken.length).toBeGreaterThan(10);

    const list = await request(app).get('/v1/hardware-devices').set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    const row = list.body.data.find((d) => d.id === id);
    expect(row.pairingToken).toBeUndefined();

    // Changing the IP rotates the token (pitfall #2) and unpairs.
    const updated = await request(app)
      .patch(`/v1/hardware-devices/${id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ ip: '192.168.1.99' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.paired).toBe(false);

    const hb = await request(app)
      .post(`/v1/hardware-devices/${id}/heartbeat`)
      .set('Authorization', `Bearer ${tok}`);
    expect(hb.status).toBe(200);
    expect(hb.body.data.online).toBe(true);

    const del = await request(app)
      .delete(`/v1/hardware-devices/${id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);
  });
});

describe('Notification preferences', () => {
  test('bulk set then read back', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const bulk = await request(app)
      .post('/v1/notification-preferences/bulk')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        prefs: [
          { event: 'newOrder', channel: 'push', enabled: true },
          { event: 'newOrder', channel: 'email', enabled: false },
          { event: 'lowStock', channel: 'sms', enabled: true },
        ],
      });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.length).toBe(3);

    // Idempotent re-set flips a value.
    const again = await request(app)
      .post('/v1/notification-preferences/bulk')
      .set('Authorization', `Bearer ${tok}`)
      .send({ prefs: [{ event: 'newOrder', channel: 'email', enabled: true }] });
    expect(again.status).toBe(200);

    const list = await request(app)
      .get('/v1/notification-preferences')
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    const emailPref = list.body.data.find((p) => p.event === 'newOrder' && p.channel === 'email');
    expect(emailPref.enabled).toBe(true);
  });
});
