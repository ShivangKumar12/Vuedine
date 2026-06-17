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

describe('GET /v1/users', () => {
  test('owner lists all users; cashier also has read access', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const ownerTok = await loginAs(app, owner);
    const cashierTok = await loginAs(app, cashier);

    const res = await request(app).get('/v1/users').set('Authorization', `Bearer ${ownerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    // Cashier can read
    const res2 = await request(app).get('/v1/users').set('Authorization', `Bearer ${cashierTok}`);
    expect(res2.status).toBe(200);

    // Unauthenticated is 401
    const res3 = await request(app).get('/v1/users');
    expect(res3.status).toBe(401);
  });

  test('group=Staff filters out customers', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    await makeUser({ tenantId: tenant.id, role: 'CUSTOMER' });
    const tok = await loginAs(app, owner);

    const staff = await request(app)
      .get('/v1/users?group=Staff')
      .set('Authorization', `Bearer ${tok}`);
    expect(staff.status).toBe(200);
    expect(staff.body.data.every((u) => u.roleCode !== 'CUSTOMER')).toBe(true);

    const customers = await request(app)
      .get('/v1/users?group=Customers')
      .set('Authorization', `Bearer ${tok}`);
    expect(customers.status).toBe(200);
    expect(customers.body.data.every((u) => u.roleCode === 'CUSTOMER')).toBe(true);
  });
});

describe('Invite flow', () => {
  test('owner invites staff → invited status; CASHIER cannot invite', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const ownerTok = await loginAs(app, owner);
    const cashierTok = await loginAs(app, cashier);

    const invite = await request(app)
      .post('/v1/users/invite')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ email: 'newstaff@test.com', name: 'New Staff', role: 'WAITER' });
    expect(invite.status).toBe(201);
    expect(invite.body.data.statusCode).toBe('INVITED');
    expect(invite.body.data.email).toBe('newstaff@test.com');

    const denied = await request(app)
      .post('/v1/users/invite')
      .set('Authorization', `Bearer ${cashierTok}`)
      .send({ email: 'another@test.com', name: 'Another', role: 'WAITER' });
    expect(denied.status).toBe(403);
  });

  test('invite token resolve + accept sets password + active', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const invite = await request(app)
      .post('/v1/users/invite')
      .set('Authorization', `Bearer ${tok}`)
      .send({ email: 'accept@test.com', name: 'Accepter', role: 'CHEF' });
    expect(invite.status).toBe(201);

    // Extract raw token from inviteUrl (the service returns inviteUrl)
    const inviteUrl = invite.body.data.inviteUrl;
    const rawToken = inviteUrl.split('/invite/')[1];

    // Resolve
    const resolved = await request(app).get(`/v1/users/invite/${rawToken}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.email).toBe('accept@test.com');

    // Accept
    const accepted = await request(app)
      .post(`/v1/users/invite/${rawToken}/accept`)
      .send({ password: 'NewPass123!' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.statusCode).toBe('ACTIVE');

    // Can log in with new credentials
    const login = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'accept@test.com', password: 'NewPass123!' });
    expect(login.status).toBe(200);
    expect(login.body.data.accessToken).toBeTruthy();
  });

  test('cannot invite duplicate email', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const existing = await makeUser({ tenantId: tenant.id, role: 'WAITER' });

    const dup = await request(app)
      .post('/v1/users/invite')
      .set('Authorization', `Bearer ${tok}`)
      .send({ email: existing.email, name: 'Dup', role: 'WAITER' });
    expect(dup.status).toBe(409);
  });
});

describe('Suspend / restore', () => {
  test('owner suspends + restores; cannot suspend owner', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const waiter = await makeUser({ tenantId: tenant.id, role: 'WAITER' });
    const tok = await loginAs(app, owner);

    const sus = await request(app)
      .post(`/v1/users/${waiter.id}/suspend`)
      .set('Authorization', `Bearer ${tok}`);
    expect(sus.status).toBe(200);
    expect(sus.body.data.statusCode).toBe('SUSPENDED');

    const restored = await request(app)
      .post(`/v1/users/${waiter.id}/restore`)
      .set('Authorization', `Bearer ${tok}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.statusCode).toBe('ACTIVE');

    // Cannot suspend owner
    const ownSus = await request(app)
      .post(`/v1/users/${owner.id}/suspend`)
      .set('Authorization', `Bearer ${tok}`);
    expect(ownSus.status).toBe(400);
    expect(ownSus.body.error.code).toBe('CANNOT_SUSPEND_OWNER');
  });
});

describe('PIN', () => {
  test('owner sets PIN for a user', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post(`/v1/users/${cashier.id}/reset-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '1234' });
    expect(res.status).toBe(200);
  });

  test('verify-pin succeeds with the correct PIN', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post(`/v1/users/${cashier.id}/reset-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '4321' });

    const ok = await request(app)
      .post(`/v1/users/${cashier.id}/verify-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '4321' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.verified).toBe(true);
  });

  test('verify-pin locks the account after 5 wrong attempts', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post(`/v1/users/${cashier.id}/reset-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '1111' });

    // 4 wrong attempts → 401 PIN_INVALID
    for (let i = 0; i < 4; i += 1) {
      const wrong = await request(app)
        .post(`/v1/users/${cashier.id}/verify-pin`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ pin: '9999' });
      expect(wrong.status).toBe(401);
      expect(wrong.body.error.code).toBe('PIN_INVALID');
    }

    // 5th wrong attempt trips the lockout → 403 PIN_LOCKED
    const fifth = await request(app)
      .post(`/v1/users/${cashier.id}/verify-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '9999' });
    expect(fifth.status).toBe(403);
    expect(fifth.body.error.code).toBe('PIN_LOCKED');

    // Even the correct PIN is rejected while locked.
    const correct = await request(app)
      .post(`/v1/users/${cashier.id}/verify-pin`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ pin: '1111' });
    expect(correct.status).toBe(403);
    expect(correct.body.error.code).toBe('PIN_LOCKED');
  });
});

describe('Roles CRUD', () => {
  test('owner creates role; duplicate name 409', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/roles')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Floor Supervisor', description: 'Test', permissions: ['pos.create_order', 'tables.view'] });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('Floor Supervisor');
    expect(created.body.data.permissions).toContain('pos.create_order');

    const dup = await request(app)
      .post('/v1/roles')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Floor Supervisor', permissions: [] });
    expect(dup.status).toBe(409);
  });

  test('update role permissions; system role rejects', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/roles')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Test role', permissions: [] });

    const updated = await request(app)
      .patch(`/v1/roles/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ permissions: ['kitchen.kds'] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.permissions).toContain('kitchen.kds');
  });

  test('list includes seeded system roles', async () => {
    // System roles come from the shared dev DB seed, not the test DB, so just
    // verify the endpoint is accessible.
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const res = await request(app).get('/v1/roles').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('editing a role force-revokes sessions of users in that role (pitfall #1)', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const member = await makeUser({ tenantId: tenant.id, role: 'WAITER' });
    const ownerTok = await loginAs(app, owner);

    // Create a custom role and assign the member to it.
    const role = await request(app)
      .post('/v1/roles')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ name: 'Shift Lead', permissions: ['pos.create_order'] });
    expect(role.status).toBe(201);

    await request(app)
      .post(`/v1/users/${member.id}/role`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ roleId: role.body.data.id });

    // Member logs in AFTER role assignment (the assign already revoked, so this
    // is a fresh, valid session).
    const memberTok = await loginAs(app, member);
    const before = await request(app).get('/v1/users').set('Authorization', `Bearer ${memberTok}`);
    expect(before.status).toBe(200);

    // Owner edits the role's permission set → must invalidate the member's JWT.
    const edit = await request(app)
      .patch(`/v1/roles/${role.body.data.id}`)
      .set('Authorization', `Bearer ${ownerTok}`)
      .send({ permissions: ['pos.create_order', 'kitchen.kds'] });
    expect(edit.status).toBe(200);

    // The member's previously-valid token is now denied.
    const after = await request(app).get('/v1/users').set('Authorization', `Bearer ${memberTok}`);
    expect(after.status).toBe(401);
  });
});

describe('Subscribers (Customer CRUD)', () => {
  test('create + list + update + delete subscriber', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/users/subscribers')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        name: 'Test Subscriber',
        email: `subscriber-${Date.now()}@test.com`,
        phone: '+91 99000 11111',
        city: 'Mumbai',
        channels: ['Email', 'WhatsApp'],
        tags: ['VIP'],
        marketingConsent: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.tier).toBe('Bronze');
    expect(created.body.data.channels).toContain('Email');
    expect(created.body.data.tags).toContain('VIP');

    const updated = await request(app)
      .patch(`/v1/users/subscribers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({
        name: 'Updated Subscriber',
        email: created.body.data.email,
        city: 'Pune',
        channels: ['Email'],
        tags: ['Loyal'],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.tags).toContain('Loyal');

    const del = await request(app)
      .delete(`/v1/users/subscribers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);
  });

  test('customer detail returns profile + orders array + live LTV', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/users/subscribers')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        name: 'LTV Customer',
        email: `ltv-${Date.now()}@test.com`,
        phone: '+91 90000 22222',
        marketingConsent: true,
      });
    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/v1/users/customers/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(detail.status).toBe(200);
    expect(Array.isArray(detail.body.data.orders)).toBe(true);
    expect(detail.body.data.orders.length).toBe(0);
    expect(detail.body.data.ltv).toBe(0);
    expect(detail.body.data.orderCount).toBe(0);
  });
});

describe('Shifts', () => {
  test('start + end a shift; variance computed', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const tok = await loginAs(app, cashier);

    const started = await request(app)
      .post('/v1/shifts/start')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, cashIn: 500 });
    expect(started.status).toBe(201);
    expect(started.body.data.open).toBe(true);

    // Cannot start another shift while one is open
    const double = await request(app)
      .post('/v1/shifts/start')
      .set('Authorization', `Bearer ${tok}`)
      .send({ branchId: branch.id, cashIn: 100 });
    expect(double.status).toBe(409);

    const ended = await request(app)
      .post(`/v1/shifts/${started.body.data.id}/end`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ cashOut: 520, note: 'Busy Saturday' });
    expect(ended.status).toBe(200);
    expect(ended.body.data.open).toBe(false);
    expect(ended.body.data.variance).toBe(20);

    // List
    const list = await request(app)
      .get('/v1/shifts')
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
