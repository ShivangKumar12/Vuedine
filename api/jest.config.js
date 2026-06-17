/**
 * Jest config — ESM project.
 *
 * The project sets `"type": "module"` in package.json. Jest still doesn't
 * have first-class ESM (as of v30), so we run via:
 *
 *   node --experimental-vm-modules node_modules/jest/bin/jest.js
 *
 * Wired into the npm scripts (`test`, `test:unit`, `test:integration`).
 * Don't `npm test` raw — call the script.
 *
 * `transform: {}` disables Babel/SWC; we run JS through Node's native ESM
 * loader. No transpile, no source maps to chase, identical runtime to prod.
 */

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  rootDir: '.',
  transform: {},

  // setupFiles run BEFORE the test framework is in scope — used to prime
  // process.env from .env.test so that env.js validation passes when src
  // modules import.
  setupFiles: ['<rootDir>/tests/env.js'],

  // setupFilesAfterEnv run AFTER jest globals (describe/beforeAll/...) are
  // available. We use this slot for jest-extended matchers + per-suite
  // lifecycle (DB connect / disconnect, truncate-between).
  setupFilesAfterEnv: ['jest-extended/all', '<rootDir>/tests/setup.js'],

  testMatch: ['**/tests/**/*.{spec,test}.js'],

  // Some Phase-1 era ad-hoc test scripts still live in scripts/. Skip.
  // Skip the k6 load tests too — they import the `k6/http` runtime which
  // doesn't exist in Node and isn't meant to be run by Jest.
  testPathIgnorePatterns: ['/node_modules/', '/scripts/', '/tests/load/'],

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/docs/**',
    '!src/queues/workers/**', // long-running daemons; covered by integration smoke
    '!src/realtime/socket.js', // exercised by socket.io tests when added
  ],
  /**
   * Coverage thresholds — set just below current actuals so CI catches
   * regressions, not aspirations. Ratchet up as more tests land:
   *   Phase 10 (today)     : 50% lines  ← floor we have
   *   Phase 12 (CI green)  : 65% lines
   *   Phase 14 (launch)    : 80% lines
   *
   * Don't lower these — only raise.
   */
  coverageThreshold: {
    global: {
      statements: 50,
      lines: 50,
      branches: 35,
      functions: 45,
    },
  },
  coverageReporters: ['text-summary', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  testTimeout: 20_000,
  clearMocks: true,
  restoreMocks: true,

  // Force-exit after the suite completes — the app pulls in long-lived
  // singletons (Prisma pool, ioredis, BullMQ queues, the metrics interval)
  // that don't all expose a clean disconnect path. Without this, Jest hangs
  // for ~30s waiting for them to settle. Tests pass either way; force-exit
  // just keeps CI fast.
  forceExit: true,

  // Integration tests hit a single test DB. Parallel workers race on truncate.
  // Keep workers at 1 — unit tests are fast enough not to need parallelism.
  maxWorkers: 1,

  verbose: process.env.CI === 'true',

  // Don't reset module registry between tests — the prisma singleton must
  // persist across the whole run (we connect once, truncate between).
  resetModules: false,
};

export default config;
