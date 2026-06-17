/* global __ENV, console */
import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Items list — the busiest READ in the API.
 *
 * Logs in once per VU during init (`setup`), then hammers GET /v1/items.
 * The route-level cache should keep median latency well under 50ms.
 *
 *   k6 run tests/load/items-list.k6.js -e BASE_URL=http://localhost:4000
 */

export const options = {
  stages: [
    { duration: '15s', target: 30 },
    { duration: '1m', target: 100 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL ?? 'http://localhost:4000';

export function setup() {
  const res = http.post(
    `${BASE}/v1/auth/login`,
    JSON.stringify({
      email: __ENV.LOAD_EMAIL ?? 'owner@vuedine.demo',
      password: __ENV.LOAD_PASSWORD ?? 'vuedine123',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    throw new Error(`setup login failed: ${res.status} ${res.body}`);
  }
  return { token: res.json('data.accessToken') };
}

export default function itemsListScenario(data) {
  const res = http.get(`${BASE}/v1/items`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data array': (r) => Array.isArray(r.json('data')),
  });
  sleep(0.5);
}
