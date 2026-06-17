import request from 'supertest';

import { prisma } from '../../src/db/prisma.js';
import { PLAN_DEFS } from '../../src/modules/billing/billing.plans.js';
import { billingService } from '../../src/modules/billing/billing.service.js';
import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

async function loginAs(app, user) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email: user.email, password: user._plain.password });
  return res.body.data.accessToken;
}

async function tenantSlug(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  return t.slug;
}

beforeEach(async () => {
  // The global afterEach resets the DB, so re-seed plans before every test.
  for (const def of PLAN_DEFS) {
    await prisma.plan.upsert({
      where: { slug: def.slug },
      update: { monthly: def.monthly, yearly: def.yearly, features: def.features, active: true },
      create: {
        slug: def.slug,
        name: def.name,
        blurb: def.blurb,
        monthly: def.monthly,
        yearly: def.yearly,
        features: def.features,
        active: true,
      },
    });
  }
});

describe('GET /v1/subscription', () => {
  test('lazily provisions a TRIALING Growth subscription with live usage', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const res = await request(app).get('/v1/subscription').set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subscription.planSlug).toBe('growth');
    expect(res.body.data.subscription.status).toBe('TRIALING');
    expect(res.body.data.usage.outlets.limit).toBe(3);
    expect(res.body.data.usage.outlets.used).toBeGreaterThanOrEqual(1);
    expect(res.body.data.plans.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.invoices).toEqual([]);
  });
});

describe('Plan changes', () => {
  test('downgrade then upgrade; upgrade returns a Razorpay mandate', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const down = await request(app)
      .post('/v1/subscription/change-plan')
      .set('Authorization', `Bearer ${tok}`)
      .send({ planSlug: 'starter', cycle: 'monthly' });
    expect(down.status).toBe(200);
    expect(down.body.data.subscription.planSlug).toBe('starter');
    expect(down.body.data.subscription.branchLimit).toBe(1);

    const up = await request(app)
      .post('/v1/subscription/change-plan')
      .set('Authorization', `Bearer ${tok}`)
      .send({ planSlug: 'growth', cycle: 'monthly' });
    expect(up.status).toBe(200);
    expect(up.body.data.mandate.provider).toBe('razorpay');
    expect(up.body.data.mandate.required).toBe(true);
  });

  test('ADMIN cannot change plan (OWNER only)', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const admin = await makeUser({ tenantId: tenant.id, role: 'ADMIN' });
    const tok = await loginAs(app, admin);
    const res = await request(app)
      .post('/v1/subscription/change-plan')
      .set('Authorization', `Bearer ${tok}`)
      .send({ planSlug: 'starter', cycle: 'monthly' });
    expect(res.status).toBe(403);
  });

  test('cancel then resume', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const cancel = await request(app).post('/v1/subscription/cancel').set('Authorization', `Bearer ${tok}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');
    expect(cancel.body.data.cancelledAt).toBeTruthy();

    const resume = await request(app).post('/v1/subscription/resume').set('Authorization', `Bearer ${tok}`);
    expect(resume.status).toBe(200);
    expect(resume.body.data.status).toBe('ACTIVE');
  });

  test('addon toggle flips state', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    const on = await request(app).post('/v1/subscription/addons/priority/toggle').set('Authorization', `Bearer ${tok}`);
    expect(on.status).toBe(200);
    expect(on.body.data.enabled).toBe(true);
    expect(on.body.data.subscription.addons).toContain('priority');

    const off = await request(app).post('/v1/subscription/addons/priority/toggle').set('Authorization', `Bearer ${tok}`);
    expect(off.body.data.enabled).toBe(false);
  });
});

describe('Quota enforcement', () => {
  test('creating a branch beyond the plan limit fails with PLAN_LIMIT_EXCEEDED', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant(); // makeTenant creates 1 branch
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);

    // Downgrade to starter (1 outlet allowed) — current 1 branch is fine.
    await request(app)
      .post('/v1/subscription/change-plan')
      .set('Authorization', `Bearer ${tok}`)
      .send({ planSlug: 'starter', cycle: 'monthly' });

    const res = await request(app)
      .post('/v1/branches')
      .set('Authorization', `Bearer ${tok}`)
      .send({ name: 'Second outlet', code: 'SEC', qrSlug: 'second-' + Date.now() });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.error.details.upgrade).toBe('/dashboard/subscription');
  });
});

describe('Invoices + billing webhook', () => {
  test('invoice cycle generates an invoice; webhook marks it paid', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const slug = await tenantSlug(tenant.id);

    // Provision + make it an ACTIVE subscription that is due to renew.
    await billingService.ensure({ tenantId: tenant.id });
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'ACTIVE', renewsAt: new Date(Date.now() - 86_400_000) },
    });
    const cycle = await billingService.runInvoiceCycle({ now: new Date() });
    expect(cycle.generated).toBeGreaterThanOrEqual(1);

    const list = await request(app).get('/v1/invoices').set('Authorization', `Bearer ${tok}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].status).toBe('OPEN');

    // Gateway confirms payment.
    const hook = await request(app)
      .post('/v1/webhooks/billing')
      .query({ tenant: slug })
      .set('Content-Type', 'application/json')
      .send({ event: 'invoice.paid', payload: { payment: { entity: { id: 'pay_test_1' } } } });
    expect(hook.status).toBe(200);
    expect(hook.body.data.status).toBe('PAID');

    const after = await request(app).get('/v1/invoices').set('Authorization', `Bearer ${tok}`);
    expect(after.body.data[0].status).toBe('PAID');
  });

  test('failed billing event flips subscription to PAST_DUE', async () => {
    const app = getTestApp();
    const { tenant } = await makeTenant();
    const owner = await makeUser({ tenantId: tenant.id, role: 'OWNER' });
    const tok = await loginAs(app, owner);
    const slug = await tenantSlug(tenant.id);

    await billingService.ensure({ tenantId: tenant.id });
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'ACTIVE', renewsAt: new Date(Date.now() - 86_400_000) },
    });
    await billingService.runInvoiceCycle({ now: new Date() });

    const hook = await request(app)
      .post('/v1/webhooks/billing')
      .query({ tenant: slug })
      .set('Content-Type', 'application/json')
      .send({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_fail_1' } } } });
    expect(hook.status).toBe(200);
    expect(hook.body.data.status).toBe('FAILED');

    const sub = await request(app).get('/v1/subscription').set('Authorization', `Bearer ${tok}`);
    expect(sub.body.data.subscription.status).toBe('PAST_DUE');
  });

  test('dunning freezes a 14-day past-due subscription', async () => {
    const { tenant } = await makeTenant();
    await billingService.ensure({ tenantId: tenant.id });
    const sub = await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { status: 'PAST_DUE' },
    });
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: sub.id,
        number: `INV-TEST-${Date.now()}`,
        period: 'Test',
        amount: 1000,
        taxAmount: 180,
        status: 'OPEN',
        issuedAt: new Date(Date.now() - 20 * 86_400_000),
        dueAt: new Date(Date.now() - 15 * 86_400_000),
      },
    });

    const summary = await billingService.runDunning({ now: new Date() });
    expect(summary.frozen).toBeGreaterThanOrEqual(1);

    const reread = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(reread.meta.frozen).toBe(true);
  });
});
