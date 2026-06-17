import { createApp } from '../../src/app.js';

/**
 * Lazy singleton Express app for HTTP integration tests.
 *
 *   import { getTestApp } from '../helpers/test-app.js';
 *   const res = await request(getTestApp()).post('/v1/auth/login').send(...);
 *
 * We build the app once per Jest worker. Each test starts with a clean DB +
 * Redis (handled in setup.js) — the app object itself is stateless beyond
 * those, so reuse is safe.
 */

let app = null;

export function getTestApp() {
  if (!app) app = createApp();
  return app;
}
