/**
 * Per-test-suite lifecycle.
 *
 * Every Jest test file inherits these hooks from setupFilesAfterEnv.
 * Order matters:
 *   1. beforeAll → connect DB + Redis
 *   2. afterEach → reset both (each test starts clean)
 *   3. afterAll  → disconnect cleanly so Jest can exit
 */

import { setupTestDb, resetTestDb, teardownTestDb } from './helpers/test-db.js';
import { resetTestRedis, teardownTestRedis } from './helpers/test-redis.js';

beforeAll(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await resetTestDb();
  await resetTestRedis();
});

afterAll(async () => {
  await teardownTestDb();
  await teardownTestRedis();
});
