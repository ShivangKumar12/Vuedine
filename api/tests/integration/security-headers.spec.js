import request from 'supertest';

import { getTestApp } from '../helpers/test-app.js';

/**
 * The security headers we set unconditionally (helmet defaults + our explicit
 * referrer-policy). HSTS and CSP are prod-only and not asserted here.
 */
describe('security headers', () => {
  test('GET /health returns the expected baseline headers', async () => {
    const res = await request(getTestApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('every request gets a request id', async () => {
    const res = await request(getTestApp()).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('CORS', () => {
  test('disallowed origin gets a 403', async () => {
    const res = await request(getTestApp()).get('/health').set('Origin', 'https://evil.example');
    // CORS handler short-circuits with our forbidden envelope.
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_BLOCKED');
  });

  test('allowlisted origin passes through', async () => {
    const res = await request(getTestApp()).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
  });
});
