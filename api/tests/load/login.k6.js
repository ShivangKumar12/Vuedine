/* global __ENV, console */
import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Login load profile — the single hottest write in the whole API
 * (every dashboard / shift / mobile session starts here).
 *
 *   k6 run tests/load/login.k6.js -e BASE_URL=http://localhost:4000
 *   k6 run tests/load/login.k6.js -e BASE_URL=https://staging.vuedine.com
 *
 * Defaults to localhost:4000 — sane for a smoke run before deploys.
 *
 * Targets:
 *   - p95 < 300ms, p99 < 800ms across the steady-state hold.
 *   - <1% failure rate.
 *
 * Adjust VUs by EXEC_VUS env var when running on bigger hardware.
 */

export const options = {
  stages: [
    { duration: '20s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL ?? 'http://localhost:4000';
const EMAIL = __ENV.LOAD_EMAIL ?? 'owner@vuedine.demo';
const PASSWORD = __ENV.LOAD_PASSWORD ?? 'vuedine123';

export default function loginScenario() {
  const res = http.post(
    `${BASE}/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, {
    'status is 200': (r) => r.status === 200,
    'envelope ok': (r) => r.json('success') === true,
  });
  sleep(1);
}
