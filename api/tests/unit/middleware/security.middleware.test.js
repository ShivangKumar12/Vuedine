import { sanitizeKeys } from '../../../src/middleware/security.middleware.js';

/**
 * Sanitizer is a pure middleware over req.body / req.query.
 * No DB, no Redis, no app needed — fastest test you can write.
 */
function makeReq(overrides = {}) {
  return {
    id: 'rid',
    path: '/x',
    method: 'POST',
    body: undefined,
    query: undefined,
    ...overrides,
  };
}

function callSanitize(req) {
  return new Promise((resolve, reject) => {
    sanitizeKeys(req, {}, (err) => (err ? reject(err) : resolve()));
  });
}

describe('sanitizeKeys', () => {
  test('strips $-prefixed keys (NoSQL operator vectors)', async () => {
    const req = makeReq({ body: { name: 'ok', $where: '1==1', tags: ['$gt', 'safe'] } });
    await callSanitize(req);
    expect(req.body).toEqual({ name: 'ok', tags: ['$gt', 'safe'] });
  });

  test('strips __proto__ / prototype / constructor keys', async () => {
    const evil = JSON.parse('{"name":"ok","__proto__":{"polluted":true}}');
    const req = makeReq({ body: evil });
    await callSanitize(req);
    expect(req.body).toEqual({ name: 'ok' });
    expect({}.polluted).toBeUndefined();
  });

  test('walks nested objects and arrays', async () => {
    const req = makeReq({
      body: {
        outer: { inner: { $bad: 1, ok: 2 } },
        list: [{ $bad: 1, ok: 2 }, { ok: 3 }],
      },
    });
    await callSanitize(req);
    expect(req.body.outer.inner).toEqual({ ok: 2 });
    expect(req.body.list[0]).toEqual({ ok: 2 });
    expect(req.body.list[1]).toEqual({ ok: 3 });
  });

  test('no-op on null / undefined / scalar bodies', async () => {
    for (const body of [null, undefined, 'string', 42, true]) {
      const req = makeReq({ body });
      await callSanitize(req);
      expect(req.body).toBe(body);
    }
  });

  test('handles a sealed query object (Express 5 behaviour) without crashing', async () => {
    const query = Object.seal({ q: 'safe', $bad: 'will-throw-on-delete' });
    const req = makeReq({ query });
    // Must not throw; sealed objects can't have keys deleted, sanitize swallows.
    await callSanitize(req);
    expect(req.query.q).toBe('safe');
  });
});
