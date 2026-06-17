# Tests

Jest test suite for the Vuedine API.

## Layout

```
tests/
  env.js                # process.env primer (loads .env.test)
  setup.js              # per-suite lifecycle (DB connect, truncate, disconnect)
  helpers/
    test-app.js         # lazy singleton Express app
    test-db.js          # Prisma client + truncate-between
    test-redis.js       # ioredis pointed at DB 15
  fixtures/             # @faker-js factories — every test should use these
    tenant.factory.js
    user.factory.js
    item.factory.js
  unit/                 # pure-function tests, no DB
    modules/auth/
    middleware/
    utils/
  integration/          # full HTTP layer through supertest
    auth.spec.js
    items.spec.js
    api-keys.spec.js
    rate-limit.spec.js
    security-headers.spec.js
  load/                 # k6 scripts (run separately, not via Jest)
    login.k6.js
    items-list.k6.js
```

## Running

```bash
# Unit tests only (fast, no DB calls but still hits beforeAll DB connect)
npm run test:unit

# Integration tests only
npm run test:integration

# Everything
npm test

# Coverage report (also enforces thresholds in jest.config.js)
npm run test:coverage
```

## Prerequisites

The dev `docker-compose.yml` provides Postgres on port 5434 and Redis on 6381.
First-time setup:

```bash
# Create the test database + extensions
docker exec vuedine_api_postgres psql -U vuedine -d postgres -c "CREATE DATABASE vuedine_test;"
docker exec vuedine_api_postgres psql -U vuedine -d vuedine_test \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; \
      CREATE EXTENSION IF NOT EXISTS citext; \
      CREATE EXTENSION IF NOT EXISTS pg_trgm; \
      CREATE EXTENSION IF NOT EXISTS btree_gin;"

# Apply migrations to it
npm run test:db:setup
```

After that, `npm test` is enough — the suite truncates between tests and
flushes Redis DB 15 between suites.

## ESM caveat

The project is `"type": "module"` and Jest doesn't yet have first-class ESM,
so the npm scripts wrap Jest in `node --experimental-vm-modules`. **Don't**
run `npx jest` directly — it'll silently fail on import statements.

## Coverage thresholds

Set in `jest.config.js`. Floor today is 50% lines / 35% branches — that
matches what we cover (auth, crypto, sanitizer, items, api-keys, security
headers, rate limiting). The roadmap target is 80% by launch; ratchet up
as more modules ship tests.

## Load tests

k6 is a separate binary — install via `brew install k6` / `apt install k6`.
Then:

```bash
k6 run tests/load/login.k6.js -e BASE_URL=http://localhost:4000
k6 run tests/load/items-list.k6.js -e BASE_URL=http://localhost:4000
```

Runs against any environment by overriding `BASE_URL`.

## Why force-exit

The app pulls in long-lived singletons (Prisma pool, ioredis, BullMQ queues,
metrics interval) that don't all expose a clean teardown path. Without
`forceExit: true` in jest.config.js, Jest hangs ~30s after the suite finishes
waiting for them to settle. We exit cleanly when assertions are done.

## Adding tests

- New module? Mirror the source path: `src/modules/orders/` → `tests/unit/modules/orders/`.
- Pure logic? **Unit test** with no DB (factory imports still trigger the
  setup hooks but are cheap).
- HTTP / RBAC / cache / auth? **Integration test** through supertest.
- Don't write `prisma.user.create` inline — use `makeUser`/`makeTenant`/`makeItem`
  factories. They keep tests readable and protect against schema drift.
