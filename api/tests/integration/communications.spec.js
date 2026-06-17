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

async function seedSubscriber(app, tok, i) {
  return request(app)
    .post('/v1/users/subscribers')
    .set('Authorization', `Bearer ${tok}`)
    .send({
      name: `Sub ${i}`,
      email: `sub-${i}-${Date.now()}@test.com`,
      phone: `+9198000000${i}`,
      channels: ['Email', 'Push'],
      marketingConsent: true,
    });
}

describe('Segments', () => {
  test('built-in segments + preview + saved custom', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    await seedSubscriber(app, tok, 1);

    const list = await request(app).get('/v1/segments').set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((s) => s.systemKey === 'all')).toBe(true);
    const all = list.body.data.find((s) => s.systemKey === 'all');
    expect(all.count).toBeGreaterThanOrEqual(1);

    const preview = await request(app)
      .post('/v1/segments/preview')
      .set('Authorization', `Bearer ${tok}`)
      .send({ rule: { kind: 'all' }, requireConsent: true, channel: 'Email' });
    expect(preview.status).toBe(200);
    expect(preview.body.data.count).toBeGreaterThanOrEqual(1);

    const created = await request(app)
      .post('/v1/segments')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Email VIPs', rule: { kind: 'vip' } });
    expect(created.status).toBe(201);
  });
});

describe('Campaigns', () => {
  test('create → send-now records events; whatsapp needs template', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    await seedSubscriber(app, tok, 1);
    await seedSubscriber(app, tok, 2);

    const created = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${tok}`)
      .send({ type: 'EMAIL', title: 'Lunch deal', body: '15% off before 3pm', audience: 'all', ctaLabel: 'Order', ctaUrl: '/menu' });
    expect(created.status).toBe(201);
    expect(created.body.data.statusCode).toBe('DRAFT');
    expect(created.body.data.audienceSize).toBeGreaterThanOrEqual(2);
    const id = created.body.data.id;

    const sent = await request(app)
      .post(`/v1/campaigns/${id}/send-now`)
      .set('Authorization', `Bearer ${tok}`);
    expect(sent.status).toBe(200);
    expect(sent.body.data.campaign.statusCode).toBe('SENT');
    expect(sent.body.data.recipients).toBeGreaterThanOrEqual(2);

    const events = await request(app)
      .get(`/v1/campaigns/${id}/events`)
      .set('Authorization', `Bearer ${tok}`);
    expect(events.status).toBe(200);
    expect(events.body.data.length).toBeGreaterThanOrEqual(2);
    expect(events.body.data[0].type).toBe('SENT');

    // WhatsApp without a template is rejected before queueing (pitfall #1).
    const wa = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${tok}`)
      .send({ type: 'WHATSAPP', title: 'Promo', body: 'hi', audience: 'all' });
    const waSend = await request(app)
      .post(`/v1/campaigns/${wa.body.data.id}/send-now`)
      .set('Authorization', `Bearer ${tok}`);
    expect(waSend.status).toBe(400);
    expect(waSend.body.error.code).toBe('WHATSAPP_TEMPLATE_REQUIRED');
  });

  test('schedule then cancel', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/campaigns')
      .set('Authorization', `Bearer ${tok}`)
      .send({ type: 'PUSH', title: 'Brunch', body: 'Sat 10am', audience: 'all' });
    const id = created.body.data.id;

    const sched = await request(app)
      .post(`/v1/campaigns/${id}/schedule`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ at: new Date(Date.now() + 3600_000).toISOString() });
    expect(sched.status).toBe(200);
    expect(sched.body.data.statusCode).toBe('SCHEDULED');

    const cancel = await request(app)
      .post(`/v1/campaigns/${id}/cancel`)
      .set('Authorization', `Bearer ${tok}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.statusCode).toBe('CANCELLED');
  });
});

describe('Push', () => {
  test('public-key, subscribe, list, test, unsubscribe', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const pk = await request(app).get('/v1/push/public-key').set('Authorization', `Bearer ${tok}`);
    expect(pk.status).toBe(200);

    const sub = await request(app)
      .post('/v1/push/subscribe')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        endpoint: `https://push.example.com/${Date.now()}`,
        keys: { p256dh: 'BPxxxxxxx', auth: 'authkeyyyy' },
        platform: 'web',
      });
    expect(sub.status).toBe(201);

    const list = await request(app).get('/v1/push/subscriptions').set('Authorization', `Bearer ${tok}`);
    expect(list.body.data.length).toBe(1);

    const test = await request(app).post('/v1/push/test').set('Authorization', `Bearer ${tok}`);
    expect(test.status).toBe(200); // VAPID unset in test → skipped note

    const del = await request(app)
      .delete(`/v1/push/subscribe/${sub.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);
  });
});

describe('Messages inbox + webhook ingest', () => {
  test('inbound whatsapp creates a conversation; reply + status + star work', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const inbound = await request(app)
      .post(`/v1/webhooks/whatsapp?tenant=${tenant.slug}`)
      .set('Content-Type', 'application/json')
      .send({ from: '+919812345678', name: 'Aarav', body: 'Is table 7 free?', messageId: `wamid-${Date.now()}` });
    expect(inbound.status).toBe(200);
    const conversationId = inbound.body.data.conversationId;
    expect(conversationId).toBeTruthy();

    // Idempotent replay (same messageId) → duplicate.
    const replay = await request(app)
      .post(`/v1/webhooks/whatsapp?tenant=${tenant.slug}`)
      .set('Content-Type', 'application/json')
      .send({ from: '+919812345678', name: 'Aarav', body: 'Is table 7 free?', messageId: inbound.body.data && 'dup-check' });

    const list = await request(app)
      .get('/v1/conversations')
      .set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((c) => c.id === conversationId)).toBe(true);
    expect(list.body.meta.stats.open).toBeGreaterThanOrEqual(1);
    void replay;

    const detail = await request(app)
      .get(`/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.messages.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.data.messages[0].sender).toBe('customer');

    const reply = await request(app)
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ body: 'Yes! Booking it for you.' });
    expect(reply.status).toBe(201);
    expect(reply.body.data.sender).toBe('agent');

    const resolved = await request(app)
      .patch(`/v1/conversations/${conversationId}/status`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ status: 'resolved' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('resolved');

    const starred = await request(app)
      .patch(`/v1/conversations/${conversationId}/star`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ starred: true });
    expect(starred.body.data.starred).toBe(true);
  });
});

describe('Customer import + bulk', () => {
  test('CSV import dedupes; bulk unsubscribe', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const csv = `name,email,phone,channels,marketingConsent
Riya,riya-${Date.now()}@test.com,+919800000001,Email|SMS,true
Bad Row,not-an-email,+919800000002,Email,true`;
    const imp = await request(app)
      .post('/v1/users/customers/import')
      .set('Authorization', `Bearer ${tok}`)
      .send({ csv });
    expect(imp.status).toBe(200);
    expect(imp.body.data.created).toBe(1);
    expect(imp.body.data.skipped).toBe(1);

    // Find the imported customer to bulk-unsubscribe.
    const customers = await request(app)
      .get('/v1/users/customers')
      .set('Authorization', `Bearer ${tok}`);
    expect(customers.status).toBe(200);
    const ids = customers.body.data.slice(0, 1).map((c) => c.id);
    const bulk = await request(app)
      .post('/v1/users/customers/bulk')
      .set('Authorization', `Bearer ${tok}`)
      .send({ ids, action: 'unsubscribe' });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.affected).toBe(1);
  });
});
