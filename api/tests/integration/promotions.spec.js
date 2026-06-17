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

function couponBody(overrides = {}) {
  return {
    type: 'COUPON',
    kind: 'PERCENTAGE',
    title: 'Test 20% off',
    code: 'TEST20',
    value: 20,
    minOrder: 0,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    channels: ['POS', 'QR', 'Online'],
    usageLimit: 0,
    perUserLimit: 1,
    ...overrides,
  };
}

describe('Promotions CRUD', () => {
  test('OWNER creates a coupon; CASHIER cannot create', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const cashier = await makeUser({ tenantId: tenant.id, role: 'CASHIER' });
    const ownerTok = await loginAs(app, owner);
    const cashTok = await loginAs(app, cashier);

    const ok = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${ownerTok}`)
      .send(couponBody());
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe('TEST20');
    expect(ok.body.data.kind).toBe('Percentage'); // serialized for Coupons.tsx

    const denied = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${cashTok}`)
      .send(couponBody({ code: 'NOPE10' }));
    expect(denied.status).toBe(403);
  });

  test('coupon requires a code', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody({ code: undefined }));
    expect(res.status).toBe(400);
  });

  test('duplicate code rejected', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app).post('/v1/promotions').set('Authorization', `Bearer ${tok}`).send(couponBody());
    const dup = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody({ title: 'Another' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PROMOTION_CODE_TAKEN');
  });

  test('pause / resume / delete lifecycle', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const created = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody());
    const id = created.body.data.id;

    const paused = await request(app)
      .post(`/v1/promotions/${id}/pause`)
      .set('Authorization', `Bearer ${tok}`);
    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('Paused');

    const resumed = await request(app)
      .post(`/v1/promotions/${id}/resume`)
      .set('Authorization', `Bearer ${tok}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.status).toBe('Active');

    const del = await request(app)
      .delete(`/v1/promotions/${id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/v1/promotions/${id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(get.status).toBe(404);
  });

  test('offer create returns Offer shape', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        type: 'OFFER',
        kind: 'HAPPY_HOUR',
        title: 'Happy Hour',
        emoji: '🍻',
        summary: 'Flat 30% off drinks',
        value: 30,
        startsAt: new Date(Date.now() - 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        startTime: '17:00',
        endTime: '19:00',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        channels: ['POS', 'QR'],
        autoApply: true,
        scope: 'WHOLE_ORDER',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe('Happy Hour');
    expect(res.body.data.discount).toBe('Flat 30% off drinks');
    expect(res.body.data.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });
});

describe('apply-coupon', () => {
  async function makeCoupon(app, tok, overrides) {
    const res = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody(overrides));
    return res.body.data;
  }

  const lines = [
    { itemId: 'i1', itemName: 'Pizza', category: 'Pizza', qty: 2, unitPrice: 10 },
    { itemId: 'i2', itemName: 'Mojito', category: 'Cocktails', qty: 1, unitPrice: 5 },
  ];

  test('valid coupon returns discount preview', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    await makeCoupon(app, tok);

    const res = await request(app)
      .post('/v1/cart/apply-coupon')
      .set('Authorization', `Bearer ${tok}`)
      .send({ code: 'TEST20', channel: 'POS', lines });
    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(5); // 20% of 25
    expect(res.body.data.code).toBe('TEST20');
  });

  test('unknown code 404', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const res = await request(app)
      .post('/v1/cart/apply-coupon')
      .set('Authorization', `Bearer ${tok}`)
      .send({ code: 'GHOST', lines });
    expect(res.status).toBe(404);
  });

  test('min order not met 400', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    await makeCoupon(app, tok, { code: 'BIG100', minOrder: 100 });
    const res = await request(app)
      .post('/v1/cart/apply-coupon')
      .set('Authorization', `Bearer ${tok}`)
      .send({ code: 'BIG100', lines });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROMO_MIN_ORDER_NOT_MET');
  });
});

describe('Order integration + redemption', () => {
  test('placing an order with a coupon applies discount + records redemption', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody({ code: 'SAVE20', value: 20 }));

    const order = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        branchId: branch.id,
        type: 'DINE_IN',
        channel: 'POS',
        promoCode: 'SAVE20',
        lines: [
          { itemName: 'Pizza', qty: 2, unitPrice: 10, category: 'Pizza' },
        ],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.discountTotal).toBe(4); // 20% of 20

    // promotion.used incremented
    const list = await request(app)
      .get('/v1/promotions')
      .query({ type: 'COUPON' })
      .set('Authorization', `Bearer ${tok}`);
    const promo = list.body.data.find((p) => p.code === 'SAVE20');
    expect(promo.used).toBe(1);
  });

  test('per-user limit enforced on apply-coupon preview', async () => {
    const app = getTestApp();
    const { tenant, branch } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody({ code: 'ONCE', perUserLimit: 1 }));

    // First redemption via order
    const o1 = await request(app)
      .post('/v1/orders')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        branchId: branch.id,
        type: 'TAKEAWAY',
        channel: 'POS',
        promoCode: 'ONCE',
        guestPhone: '+19998887777',
        lines: [{ itemName: 'Pizza', qty: 1, unitPrice: 10, category: 'Pizza' }],
      });
    expect(o1.status).toBe(201);

    // Second apply by same customer → 409
    const preview = await request(app)
      .post('/v1/cart/apply-coupon')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        code: 'ONCE',
        customerId: '+19998887777',
        lines: [{ itemId: 'i1', itemName: 'Pizza', category: 'Pizza', qty: 1, unitPrice: 10 }],
      });
    expect(preview.status).toBe(409);
    expect(preview.body.error.code).toBe('PROMOTION_PER_USER_LIMIT');
  });
});

describe('auto-offers', () => {
  test('returns applicable auto-apply offers with computed discount', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        type: 'OFFER',
        kind: 'PERCENTAGE',
        title: 'Auto 10%',
        value: 10,
        startsAt: new Date(Date.now() - 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        channels: ['POS'],
        autoApply: true,
        scope: 'WHOLE_ORDER',
      });

    const res = await request(app)
      .post('/v1/cart/auto-offers')
      .set('Authorization', `Bearer ${tok}`)
      .send({
        channel: 'POS',
        lines: [{ itemId: 'i1', itemName: 'Pizza', category: 'Pizza', qty: 2, unitPrice: 10 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.offers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.offers[0].discount).toBe(2); // 10% of 20
  });
});

describe('worker reconciliation', () => {
  test('expirePast flips ACTIVE → EXPIRED past endsAt', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    // Create active coupon then move its endsAt into the past via update.
    const created = await request(app)
      .post('/v1/promotions')
      .set('Authorization', `Bearer ${tok}`)
      .send(couponBody({ code: 'EXPIRESOON' }));
    await request(app)
      .patch(`/v1/promotions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`)
      .send({ endsAt: new Date(Date.now() - 1000).toISOString() });

    const { promotionsService } = await import('../../src/modules/promotions/promotions.service.js');
    const count = await promotionsService.expirePast({ now: new Date() });
    expect(count).toBeGreaterThanOrEqual(1);

    const reread = await request(app)
      .get(`/v1/promotions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tok}`);
    expect(reread.body.data.status).toBe('Expired');
  });
});
