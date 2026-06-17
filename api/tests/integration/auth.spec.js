import request from 'supertest';

import { makeTenant } from '../fixtures/tenant.factory.js';
import { makeUser } from '../fixtures/user.factory.js';
import { getTestApp } from '../helpers/test-app.js';

/**
 * Integration tests against a real Express app + Postgres + Redis.
 * Each test starts with a clean DB / Redis (afterEach in tests/setup.js).
 */
describe('POST /v1/auth/login', () => {
  test('happy path: returns access token + sets refresh cookie', async () => {
    const { tenant } = await makeTenant();
    const user = await makeUser({
      email: 'alice@test.com',
      tenantId: tenant.id,
      role: 'OWNER',
    });

    const res = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: user.email, password: user._plain.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        user: { email: user.email, role: 'OWNER' },
        accessToken: expect.any(String),
      },
      error: null,
      requestId: expect.any(String),
    });

    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/refresh=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Path=\/v1\/auth/);
  });

  test('wrong password: 401 INVALID_CREDENTIALS', async () => {
    const { tenant } = await makeTenant();
    const user = await makeUser({ email: 'bob@test.com', tenantId: tenant.id });

    const res = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'wrong-password-1234' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('unknown email: 401 INVALID_CREDENTIALS (no enumeration leak)', async () => {
    const res = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: 'ghost@nowhere.com', password: 'whatever-long-enough' });

    expect(res.status).toBe(401);
    // Same code as wrong-password — by design.
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('refresh token rotation + reuse detection', () => {
  test('rotates refresh on /refresh and detects replay of old token', async () => {
    const { tenant } = await makeTenant();
    const user = await makeUser({
      email: 'carol@test.com',
      tenantId: tenant.id,
      role: 'OWNER',
    });

    const app = getTestApp();
    const agent = request.agent(app);

    // 1. Login → R1 cookie
    const login = await agent
      .post('/v1/auth/login')
      .send({ email: user.email, password: user._plain.password });
    expect(login.status).toBe(200);
    const cookieR1 = login.headers['set-cookie'][0];
    expect(cookieR1).toMatch(/refresh=/);

    // 2. agent has R1 — refresh, which rotates to R2.
    const refresh1 = await agent.post('/v1/auth/refresh');
    expect(refresh1.status).toBe(200);
    expect(refresh1.body.data.accessToken).toEqual(expect.any(String));

    // 3. Replay R1 (a fresh client posing as the attacker).
    const replay = await request(app).post('/v1/auth/refresh').set('Cookie', cookieR1);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSE');

    // 4. After replay detection, the entire family is dead — even R2 fails.
    const dead = await agent.post('/v1/auth/refresh');
    expect(dead.status).toBe(401);
  });
});

describe('GET /v1/auth/me', () => {
  test('returns the authenticated user', async () => {
    const { tenant } = await makeTenant();
    const user = await makeUser({
      email: 'dave@test.com',
      tenantId: tenant.id,
      role: 'MANAGER',
    });

    const login = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: user.email, password: user._plain.password });
    const accessToken = login.body.data.accessToken;

    const me = await request(getTestApp())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user).toMatchObject({ role: 'MANAGER' });
    expect(me.body.data.user.id).toBe(user.id);
  });

  test('rejects without a token', async () => {
    const me = await request(getTestApp()).get('/v1/auth/me');
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('NO_TOKEN');
  });
});
