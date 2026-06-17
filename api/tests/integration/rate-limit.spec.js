import request from 'supertest';

import { getTestApp } from '../helpers/test-app.js';

/**
 * Rate-limit smoke test.
 *
 * `.env.test` sets `RATE_LIMIT_LOGIN_MAX=5` so we trip 429 quickly without
 * blowing the suite runtime.
 *
 * Each call uses a fresh body (no real user); the limiter triggers on
 * IP+route regardless of payload validity.
 */
describe('rate limiting', () => {
  test('login route returns 429 once the per-window cap is exceeded', async () => {
    const app = getTestApp();
    const limit = Number(process.env.RATE_LIMIT_LOGIN_MAX);
    expect(limit).toBeGreaterThan(0);

    let last = null;
    // Drive past the limit. Using +3 so we both hit 429 AND verify it stays
    // 429 on subsequent calls (no flapping).
    for (let i = 0; i < limit + 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      last = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'rl@test.com', password: 'wrong-password-1234' });
    }

    expect(last.status).toBe(429);
    expect(last.body.error.code).toMatch(/RATE_LIMITED|TOO_MANY/i);
  });
});
