# BACKEND_PHASES.md

**Vuedine — Production-Grade Backend Implementation Roadmap**

> A senior-engineer's blueprint for building a horizontally scalable Node.js backend for the Vuedine restaurant POS platform. Every phase is independently scoped so a team can divide and conquer.

**Stack at a glance**

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable until April 2026; native fetch, test runner, perf hooks |
| Framework | Express 4 | Boring, battle-tested, infinite middleware ecosystem |
| Database | PostgreSQL 16 | Strong relational guarantees + JSONB for menu metadata |
| Cache / RL | Redis 7 | Sub-ms latency, atomic ops, pub/sub for live orders |
| ORM | **Prisma 5** | Picked over Sequelize — see Phase 0 justification |
| Auth | JWT (RS256) + Refresh Token Rotation | Stateless access + revocable refresh |
| Queue | BullMQ | Redis-backed, type-safe, modern successor to Bull |
| Container | Docker + Compose | Identical dev/staging/prod runtime |
| Process | PM2 cluster | Zero-downtime reload, multi-core utilization |
| Proxy | Nginx | TLS termination, gzip, WS upgrade, static |
| Observability | Winston + Prometheus + Grafana | Structured logs + RED metrics |
| Testing | Jest + Supertest | Single test runner for unit + integration |
| Docs | OpenAPI 3.0 + Swagger UI | Auto-generated from JSDoc/zod |
| CI/CD | GitHub Actions | Native to repo, free for OSS |
| Secrets | dotenv (dev) → Vault (prod) | Layered, swap-ready |

**Conventions used in this document**

- 🔴 **PRODUCTION CRITICAL** — must be done before public traffic
- ⚡ **PERFORMANCE** — affects throughput / latency
- 🔒 **SECURITY** — affects attack surface
- 📌 Goal · 🗂 File changes · 💻 Code · ⚙️ Config · ✅ Checklist · 🔗 Dependencies · ⚠️ Pitfalls

---

## Phase 0 — Project Blueprint & Architecture Design

### 📌 Goal
Establish the architectural foundations before a single route is written. Decide the directory layout, environment tiers, the ORM choice, the scalability story, and the contract every later phase will conform to. This phase produces zero business logic; it produces the *shape* of the codebase.

### 🗂 File/Folder Changes

```
vuedine-api/
├─ src/
│  ├─ config/                     # env loading, app config singletons
│  │  ├─ env.js                   # zod-validated env parser
│  │  ├─ index.js                 # config aggregator
│  │  └─ logger.js                # winston bootstrap
│  ├─ db/
│  │  ├─ prisma.js                # PrismaClient singleton
│  │  └─ redis.js                 # ioredis singleton
│  ├─ modules/                    # feature-based, NOT layer-based
│  │  ├─ auth/
│  │  │  ├─ auth.controller.js
│  │  │  ├─ auth.service.js
│  │  │  ├─ auth.repository.js
│  │  │  ├─ auth.routes.js
│  │  │  ├─ auth.validators.js
│  │  │  └─ auth.test.js
│  │  ├─ tenants/
│  │  ├─ branches/
│  │  ├─ items/
│  │  ├─ orders/
│  │  ├─ tables/
│  │  ├─ kds/
│  │  ├─ payments/
│  │  ├─ coupons/
│  │  ├─ subscribers/
│  │  ├─ messages/
│  │  ├─ push/
│  │  ├─ users/
│  │  └─ reports/
│  ├─ middleware/
│  │  ├─ auth.middleware.js
│  │  ├─ rbac.middleware.js
│  │  ├─ requestId.middleware.js
│  │  ├─ rateLimit.middleware.js
│  │  ├─ tenant.middleware.js
│  │  ├─ error.middleware.js
│  │  └─ validate.middleware.js
│  ├─ queues/
│  │  ├─ index.js                 # queue registry
│  │  ├─ email.queue.js
│  │  ├─ notification.queue.js
│  │  └─ workers/
│  │     ├─ email.worker.js
│  │     └─ notification.worker.js
│  ├─ realtime/
│  │  ├─ socket.js                # socket.io bootstrap
│  │  └─ liveOrders.gateway.js    # replaces frontend localStorage bus
│  ├─ utils/
│  │  ├─ AppError.js
│  │  ├─ asyncHandler.js
│  │  ├─ envelope.js
│  │  ├─ pagination.js
│  │  └─ crypto.js
│  ├─ docs/
│  │  └─ openapi.js               # swagger-jsdoc config
│  ├─ app.js                      # express app construction (no listen)
│  └─ server.js                   # http listener + graceful shutdown
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.js
├─ tests/
│  ├─ integration/
│  ├─ unit/
│  ├─ fixtures/
│  └─ setup.js
├─ docker/
│  ├─ Dockerfile
│  ├─ Dockerfile.worker
│  └─ nginx/
│     └─ default.conf
├─ scripts/
│  ├─ wait-for-it.sh
│  ├─ migrate.sh
│  └─ seed-prod.sh
├─ .github/workflows/
│  ├─ ci.yml
│  ├─ deploy-staging.yml
│  └─ deploy-production.yml
├─ ecosystem.config.js            # PM2
├─ docker-compose.yml             # local dev
├─ docker-compose.prod.yml        # prod overrides
├─ .env.example
├─ .eslintrc.cjs
├─ .prettierrc
├─ jest.config.js
├─ package.json
└─ README.md
```

**Why feature-based and not layer-based:** A `users/` folder containing controller + service + repository + routes + tests beats four parallel folders (`controllers/`, `services/`, ...). When you delete a feature, you delete one folder. When you split into microservices later, you lift one folder. Layer-based dirs cause endless context-switching and make ownership unclear.

### 🧱 System Architecture

```mermaid
flowchart LR
    subgraph Client
        WEB[React Dashboard]
        PWA[Customer QR PWA]
    end

    subgraph Edge
        NGINX[Nginx<br/>TLS · Gzip · Rate Limit]
    end

    subgraph App["App Tier (PM2 cluster · Stateless)"]
        API1[Express Instance 1]
        API2[Express Instance 2]
        APIN[Express Instance N]
    end

    subgraph Workers["Worker Tier"]
        WEMAIL[Email Worker]
        WNOTIF[Notification Worker]
        WREPORT[Report Worker]
    end

    subgraph Data["Data Tier"]
        PGPRIMARY[(PostgreSQL Primary)]
        PGREPLICA[(Read Replica)]
        PGBOUNCER[PgBouncer]
        REDIS[(Redis · cache · queue · pubsub)]
        S3[(S3 · uploads)]
    end

    subgraph Observe["Observability"]
        PROM[Prometheus]
        GRAF[Grafana]
        LOGS[Log Aggregator]
    end

    WEB --> NGINX
    PWA --> NGINX
    NGINX --> API1
    NGINX --> API2
    NGINX --> APIN
    API1 --> PGBOUNCER
    API2 --> PGBOUNCER
    APIN --> PGBOUNCER
    PGBOUNCER --> PGPRIMARY
    PGBOUNCER -.read-only.-> PGREPLICA
    API1 --> REDIS
    API2 --> REDIS
    APIN --> REDIS
    REDIS --> WEMAIL
    REDIS --> WNOTIF
    REDIS --> WREPORT
    API1 -.metrics.-> PROM
    PROM --> GRAF
    API1 -.logs.-> LOGS
```

### 🛠 ORM Choice — Prisma over Sequelize (justified)

**Picked Prisma 5.** Reasoning:

| Criterion | Prisma 5 | Sequelize 6 |
|---|---|---|
| Type safety | Generated types from schema | Manual typings, often stale |
| Migration DX | `prisma migrate dev` is declarative | `umzug` boilerplate |
| Query API | Composable, predictable | Inconsistent (raw vs builder) |
| Performance ceiling | High (uses Rust query engine) | Mature but slower for batch |
| Read replicas | First-class via `@prisma/extension-read-replicas` | Manual via `replication` config |
| Multi-schema (multi-tenant) | Supported | Painful |
| Raw SQL escape hatch | `prisma.$queryRaw\`\`` typed | `sequelize.query()` |
| Community (2026) | Larger, faster moving | Maintenance mode-ish |

**The one tradeoff:** Prisma owns the migration process. If you need DBA-controlled migrations, generate raw SQL with `prisma migrate diff --script` and apply via `psql`. Documented in Phase 2.

### 📐 Scalability Strategy

1. **Stateless app tier** — no in-memory sessions, no in-memory rate limiters. Every instance is identical and disposable. Scale by adding containers behind Nginx.
2. **Connection pooling at two levels** — Prisma's pool *inside* each instance, PgBouncer *between* the app tier and Postgres. Without PgBouncer, 20 instances × 10 connections = 200 connections to Postgres, which is its hard wall around 500.
3. **Cache aggressively, invalidate explicitly** — Redis cache for menu, category, branch config (rarely changes, hot-read). Write-through invalidation on mutation.
4. **Push hot work to queues** — emails, push notifications, reports, webhook fan-out. The HTTP path stays under 200ms p99.
5. **Read replica for reports & analytics** — `/dashboard/reports/sales` queries hit the replica. Mutations and live data hit the primary.
6. **Realtime via Redis pub/sub + WebSocket** — replaces the frontend's `localStorage` order bus. Any instance can publish; all instances forward to their connected clients.

### 🌐 Environment Tiers

| Tier | Purpose | DB | Redis | Workloads |
|---|---|---|---|---|
| **development** | Local dev | Docker postgres | Docker redis | Single PM2 instance, hot reload |
| **staging** | Pre-prod mirror | Managed RDS (small) | Managed Redis (small) | Cluster of 2, mirrors prod config |
| **production** | Live tenants | Managed RDS Multi-AZ + replica | Managed Redis with persistence | PM2 cluster, autoscaling group |

### ⚙️ `.env.example`

```bash
# ============================================================
# .env.example — copy to .env and fill in
# ============================================================
NODE_ENV=development                     # development | staging | production
PORT=4000                                # HTTP listen port
APP_NAME=vuedine-api
APP_VERSION=0.1.0
LOG_LEVEL=debug                          # error | warn | info | http | debug

# ---- Database (PostgreSQL) ----
DATABASE_URL=postgresql://vuedine:vuedine_dev@localhost:5432/vuedine?schema=public&connection_limit=10&pool_timeout=20
DATABASE_REPLICA_URL=                    # optional read replica DSN, leave blank for none
DATABASE_LOG_QUERIES=false               # log every SQL query (dev only)
DATABASE_SLOW_QUERY_MS=200               # log queries slower than this

# ---- Redis ----
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_KEY_PREFIX=vuedine:

# ---- Auth ----
JWT_ACCESS_SECRET=change-me-min-32-chars-aaaaaaaaaaaaaaaaaa
JWT_REFRESH_SECRET=change-me-min-32-chars-bbbbbbbbbbbbbbbbbb
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_COST=12                           # 12 in prod, 10 in dev for speed
PASSWORD_RESET_TTL_MIN=30
EMAIL_VERIFY_TTL_HOURS=24

# ---- Rate limiting ----
RATE_LIMIT_GLOBAL_MAX=300                # req per window per IP
RATE_LIMIT_GLOBAL_WINDOW_MS=60000        # 1 minute
RATE_LIMIT_LOGIN_MAX=10                  # stricter on auth
RATE_LIMIT_LOGIN_WINDOW_MS=900000        # 15 minutes

# ---- CORS ----
CORS_ORIGINS=http://localhost:5173,https://app.vuedine.com

# ---- Email (SMTP / SES) ----
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=
SMTP_FROM="Vuedine <noreply@vuedine.com>"

# ---- Object storage (uploads) ----
S3_ENDPOINT=                             # blank = AWS default; set for MinIO/R2
S3_REGION=ap-south-1
S3_BUCKET=vuedine-uploads
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_URL=https://cdn.vuedine.com

# ---- Observability ----
PROMETHEUS_ENABLED=true
METRICS_AUTH_TOKEN=change-me             # protects /metrics
SENTRY_DSN=                              # optional, blank = disabled

# ---- Feature flags ----
FEATURE_REALTIME_ORDERS=true
FEATURE_OAUTH_GOOGLE=false
FEATURE_OAUTH_GITHUB=false

# ---- OAuth (when enabled) ----
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
OAUTH_CALLBACK_BASE=http://localhost:4000

# ---- Vault (production secret bootstrap) ----
VAULT_ADDR=
VAULT_TOKEN=
VAULT_SECRET_PATH=secret/vuedine/api
```

### 📦 `package.json` Scripts Blueprint

```json
{
  "name": "vuedine-api",
  "version": "0.1.0",
  "main": "src/server.js",
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "nodemon --watch src --watch prisma/schema.prisma src/server.js",
    "start": "node src/server.js",
    "start:cluster": "pm2-runtime ecosystem.config.js",
    "start:worker": "node src/queues/workers/index.js",
    "build": "echo 'pure JS — nothing to build'",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{js,json,md,yml}\"",
    "test": "jest --runInBand",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "db:seed": "node prisma/seed.js",
    "db:reset": "prisma migrate reset --force && node prisma/seed.js",
    "queue:board": "node scripts/bull-board.js",
    "docs:generate": "node src/docs/generate.js",
    "prepare": "husky install"
  }
}
```

### ✅ Phase Completion Checklist
- [ ] Repo initialized, folder skeleton committed
- [ ] `.env.example` committed, `.env` gitignored
- [ ] Architecture diagram in `README.md`
- [ ] ORM decision recorded in `docs/decisions/0001-orm.md`
- [ ] Branching strategy documented (`main` = prod, `develop` = staging, feature branches PR'd)
- [ ] Tier matrix posted in team wiki

### 🔗 Dependencies to Install
*Nothing yet — Phase 0 is pure planning. First install lands in Phase 1.*

### ⚠️ Common Pitfalls
1. **Layer-based folders.** They feel "clean" until the team grows past 3 engineers. Hard reorgs are painful — start feature-based.
2. **Putting `app.js` and `server.js` in one file.** You lose the ability to integration-test the app without binding a port. Always separate construction from listening.
3. **Forgetting `connection_limit` in `DATABASE_URL`.** Prisma's default of `num_cpus * 2 + 1` will exhaust Postgres at scale. Always set explicitly per environment.

---

## Phase 1 — Project Initialization & Core Setup

### 📌 Goal
Stand up a runnable, well-policed Express server with the safety nets every production app needs: validated env, security headers, CORS whitelist, request IDs, health probes, and a graceful shutdown that drains in-flight requests instead of yanking the rug. After this phase, the server starts, replies to `/health`, and refuses to start with a misconfigured `.env`.

### 🗂 File/Folder Changes

```
src/
├─ config/
│  ├─ env.js
│  ├─ index.js
│  └─ logger.js          # bootstrap-only logger; full version in Phase 7
├─ middleware/
│  └─ requestId.middleware.js
├─ utils/
│  ├─ AppError.js
│  └─ asyncHandler.js
├─ app.js
└─ server.js
.eslintrc.cjs
.prettierrc
.gitignore
.editorconfig
.husky/pre-commit
jsconfig.json            # IDE intellisense + path aliases
nodemon.json
```

### 🔗 Dependencies to Install

```bash
npm install express cors helmet compression morgan dotenv zod uuid \
  express-rate-limit ms

npm install -D nodemon eslint prettier eslint-config-prettier \
  eslint-plugin-import eslint-plugin-node eslint-plugin-security \
  husky lint-staged @types/node jsdoc
```

### ⚙️ Configuration Samples

**`.eslintrc.cjs`**

```js
module.exports = {
  env: { node: true, es2022: true, jest: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:security/recommended', 'prettier'],
  plugins: ['import', 'security'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'import/order': ['error', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc' },
    }],
    'no-process-env': 'error',                      // force going through config/env.js
    'security/detect-object-injection': 'off',      // too noisy for legitimate dynamic dispatch
  },
  overrides: [
    { files: ['src/config/env.js'], rules: { 'no-process-env': 'off' } },
  ],
};
```

> 🔒 **SECURITY** — `no-process-env` plus the override forces every env read through a single validated module. No more `process.env.JWT_SECRET || 'default'` footguns.

**`.prettierrc`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

**`.husky/pre-commit`**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

**`package.json` (lint-staged section)**

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

**`jsconfig.json`** (path aliases — works with VSCode + nodemon)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "module": "esnext",
    "target": "es2022",
    "checkJs": true,
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@modules/*": ["src/modules/*"],
      "@middleware/*": ["src/middleware/*"],
      "@utils/*": ["src/utils/*"],
      "@db/*": ["src/db/*"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

> ⚠️ Pure JS doesn't follow `paths` at runtime. Either use [`module-alias`](https://www.npmjs.com/package/module-alias) (declares aliases at startup) or stick to relative imports. **My recommendation: skip aliases for pure JS** — they cause surprise breakage in tools like Jest, ESLint resolver, and Docker. Use a flat `src/` and live with `../../`. If the team really wants aliases, switch to TypeScript.

### 💻 Code Snippets

**`src/config/env.js` — validated env loader**

```js
import 'dotenv/config';
import { z } from 'zod';

/* eslint-disable no-process-env */

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('vuedine-api'),
  APP_VERSION: z.string().default('0.0.0'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  DATABASE_URL: z.string().url(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  DATABASE_LOG_QUERIES: z.coerce.boolean().default(false),
  DATABASE_SLOW_QUERY_MS: z.coerce.number().default(200),

  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),
  REDIS_KEY_PREFIX: z.string().default('vuedine:'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥ 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥ 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().default(300),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(900_000),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  METRICS_AUTH_TOKEN: z.string().min(8).optional(),
  PROMETHEUS_ENABLED: z.coerce.boolean().default(true),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
```

> 🔴 **PRODUCTION CRITICAL** — Fail fast on bad env. A missing `JWT_ACCESS_SECRET` should crash the container, not silently default. The `process.exit(1)` makes the orchestrator's restart policy do its job.

**`src/config/index.js`**

```js
import { env } from './env.js';

export const config = Object.freeze({
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,
  logLevel: env.LOG_LEVEL,
  cors: { origins: env.CORS_ORIGINS },
});

export { env };
```

**`src/utils/AppError.js`**

```js
/**
 * Operational, expected error. Distinguished from programmer bugs by `isOperational = true`.
 * The error middleware will surface `message` and `code` to clients; programmer errors get a
 * generic 500 in production.
 */
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL', details, cause } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    if (cause) this.cause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(msg, code = 'BAD_REQUEST', details) {
    return new AppError(msg, { statusCode: 400, code, details });
  }
  static unauthorized(msg = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(msg, { statusCode: 401, code });
  }
  static forbidden(msg = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(msg, { statusCode: 403, code });
  }
  static notFound(msg = 'Not found', code = 'NOT_FOUND') {
    return new AppError(msg, { statusCode: 404, code });
  }
  static conflict(msg, code = 'CONFLICT') {
    return new AppError(msg, { statusCode: 409, code });
  }
  static tooMany(msg = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(msg, { statusCode: 429, code });
  }
}
```

**`src/utils/asyncHandler.js`**

```js
/**
 * Wrap async route handlers so thrown errors flow into Express's error pipeline
 * without try/catch boilerplate everywhere.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

**`src/middleware/requestId.middleware.js`**

```js
import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';

/**
 * Inject a UUID per request, propagate it in response headers and `req.id`.
 * Honors an inbound request id from the load balancer if present.
 */
export function requestId(req, res, next) {
  const inbound = req.get(HEADER);
  req.id = inbound && /^[\w-]{8,128}$/.test(inbound) ? inbound : randomUUID();
  res.setHeader(HEADER, req.id);
  next();
}
```

**`src/config/logger.js` — bootstrap logger** (full winston config in Phase 7)

```js
import { config } from './index.js';

const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

function log(level, msg, meta) {
  if ((levels[level] ?? 99) > (levels[config.logLevel] ?? 99)) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  http: (msg, meta) => log('http', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
```

**`src/app.js` — pure construction, no listen**

```js
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.middleware.js';
import { AppError } from './utils/AppError.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Nginx

  /* ---- Security headers ---- */
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false, // CSP defined per-deploy in Nginx in dev
      crossOriginEmbedderPolicy: false,
    }),
  );

  /* ---- CORS whitelist ---- */
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // server-to-server, curl, healthchecks
        if (config.cors.origins.includes(origin)) return cb(null, true);
        cb(AppError.forbidden(`Origin ${origin} not allowed`, 'CORS_BLOCKED'));
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  /* ---- Common middleware ---- */
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestId);

  /* ---- HTTP access log via morgan → logger ---- */
  morgan.token('id', (req) => req.id);
  app.use(
    morgan(
      ':id :remote-addr :method :url :status :res[content-length] - :response-time ms',
      { stream: { write: (m) => logger.http(m.trim()) } },
    ),
  );

  /* ---- Pre-Redis fallback rate limiter ----
   * In Phase 3 this is replaced with a Redis-backed sliding window. Keeping a tiny
   * in-memory limiter here as defense in depth even if Redis is briefly unavailable. */
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    }),
  );

  /* ---- Health probes (kept lightweight, no DB calls) ---- */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: config.appName, version: config.appVersion });
  });

  /* /ready does include downstreams once Phase 2 lands */
  app.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  /* ---- Routes mounted in later phases ---- */
  // app.use('/v1/auth',    authRouter);
  // app.use('/v1/items',   itemsRouter);
  // ...

  /* ---- 404 ---- */
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
  });

  /* ---- Final error handler ---- */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const isOp = err instanceof AppError && err.isOperational;
    const status = isOp ? err.statusCode : 500;
    const body = {
      success: false,
      data: null,
      error: {
        code: isOp ? err.code : 'INTERNAL',
        message: isOp || !config.isProd ? err.message : 'Something went wrong',
        ...(isOp && err.details ? { details: err.details } : {}),
      },
      requestId: req.id,
    };
    if (status >= 500) {
      logger.error(err.message, { stack: err.stack, requestId: req.id, path: req.path });
    } else {
      logger.warn(err.message, { code: err.code, requestId: req.id, path: req.path });
    }
    res.status(status).json(body);
  });

  return app;
}
```

**`src/server.js` — listen + graceful shutdown**

```js
import http from 'node:http';

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, () => {
  logger.info(`🚀 ${config.appName} listening`, { port: config.port, env: config.env });
});

/* ---------------- Graceful shutdown ---------------- */

const SHUTDOWN_TIMEOUT_MS = 25_000;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`🛑 Received ${signal}, draining…`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error during server.close', { err: err.message });
      process.exit(1);
    }
  });

  // Hard-deadline so a stuck connection doesn't pin us forever
  const killer = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  killer.unref();

  // Phase 2/3 will plug in:
  //   await prisma.$disconnect();
  //   await redis.quit();
  //   await Promise.all(queues.map((q) => q.close()));

  // Wait for in-flight HTTP responses to finish
  // (express keeps sockets open via keep-alive; close() resolves only after sockets drain)
  await new Promise((resolve) => server.once('close', resolve));
  logger.info('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: reason instanceof Error ? reason.stack : reason });
  // Do NOT exit on unhandled rejections — log, fix the leak. Crashing here causes flapping.
});

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { stack: err.stack });
  // Programmer bug — process is in an unknown state. Exit and let the orchestrator restart us.
  shutdown('uncaughtException').catch(() => process.exit(1));
});
```

> 🔴 **PRODUCTION CRITICAL** — `SIGTERM` is what Kubernetes / ECS / Docker send before `SIGKILL`. The 25s drain window must be **less than** the orchestrator's `terminationGracePeriodSeconds` (default 30s). If your drain is longer, you get `SIGKILL`'d mid-request.

**`nodemon.json`**

```json
{
  "watch": ["src", "prisma/schema.prisma", ".env"],
  "ext": "js,json,prisma",
  "ignore": ["src/**/*.test.js", "node_modules"],
  "delay": 200
}
```

### ✅ Phase Completion Checklist
- [ ] `npm run dev` starts the server, hot-reload works
- [ ] `curl http://localhost:4000/health` returns `{status:'ok'}`
- [ ] `curl -H "Origin: http://evil.example" http://localhost:4000/health` is rejected
- [ ] Missing `JWT_ACCESS_SECRET` in `.env` causes startup failure with a clear message
- [ ] `kill -SIGTERM <pid>` drains and exits cleanly within 25s
- [ ] `npm run lint` passes with zero warnings
- [ ] Husky pre-commit hook fires on `git commit`
- [ ] Every response carries `X-Request-Id` header
- [ ] 404 returns the standard envelope shape

### ⚠️ Common Pitfalls
1. **Trusting all proxies.** `app.set('trust proxy', true)` lets clients spoof their IP via `X-Forwarded-For`, defeating rate limiting. Set it to `1` (the number of upstream proxies) or to a CIDR whitelist.
2. **`process.exit(0)` on `unhandledRejection`.** Causes restart loops on benign errors (e.g., a stale promise rejecting after a request returned). Log it, fix the leak. Only `uncaughtException` warrants exit.
3. **Body parser without limits.** `express.json()` defaults to 100kb but accepts any JSON. Set `limit: '1mb'` and a stricter cap (e.g., 10kb) on auth routes specifically.

---

## Phase 2 — PostgreSQL Database Design & Setup

### 📌 Goal
Define the canonical data model — multi-tenant from day one — wire Prisma with sane pool sizing, set up migrations, seed scripts, slow-query logging, and a `/ready` probe that includes a real DB ping. The schema landed in this phase becomes the contract every later module depends on.

### 🔗 Dependencies to Install

```bash
npm install @prisma/client pg
npm install -D prisma
```

### ⚙️ Configuration Samples

**`docker-compose.yml`** (Postgres service excerpt — full file in Phase 11)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: vuedine_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: vuedine
      POSTGRES_PASSWORD: vuedine_dev
      POSTGRES_DB: vuedine
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "log_min_duration_statement=200"   # log queries > 200ms
      - "-c"
      - "log_connections=off"
      - "-c"
      - "log_disconnections=off"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vuedine -d vuedine"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres_data:
```

**`docker/postgres/init.sql`** — extensions every tenant will need

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram search on item names
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- composite indexes on jsonb
```

### 🧱 Schema Design Principles

| Principle | How we apply it |
|---|---|
| **UUID PKs** | `cuid()` from Prisma — sortable, URL-safe, smaller than UUIDv4. Avoids hot-spotting on insert. |
| **`createdAt` / `updatedAt` / `deletedAt`** | Soft delete via `deletedAt`. Default global filter excludes soft-deleted rows. |
| **Multi-tenancy** | Every business table carries `tenantId` (top-level org) and most carry `branchId` (outlet). Composite indexes always lead with `tenantId`. |
| **Indexing** | B-tree for equality + range; GIN/`pg_trgm` for fuzzy item search; partial indexes on common `WHERE deletedAt IS NULL` queries. |
| **FKs + cascade** | `ON DELETE RESTRICT` for parent rows that own data; `CASCADE` only for owned child rows (e.g., `OrderItem` cascades from `Order`). |
| **Money** | `Decimal(12,2)` — never `float`. |
| **Timestamps** | `timestamptz` — always store UTC, render in user's TZ. |
| **Enums** | Prisma enums for closed sets (status, role, channel). Strings for open sets (tags). |

### 💻 Prisma Schema — `prisma/schema.prisma`

> This is the *seed* schema covering the auth/audit tables required by Phase 4 and the multi-tenant backbone. Each feature module adds its own tables in subsequent migrations.

```prisma
// ============================================================
//  Vuedine — base schema (Phase 2)
// ============================================================

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ----- Enums -----

enum UserRole {
  SUPER_ADMIN     // Vuedine platform staff
  OWNER           // tenant owner
  ADMIN           // tenant admin
  MANAGER
  CASHIER
  WAITER
  CHEF
  CUSTOMER
}

enum UserStatus {
  ACTIVE
  INVITED
  SUSPENDED
  DELETED
}

enum SessionStatus {
  ACTIVE
  REVOKED
  EXPIRED
}

enum AuditAction {
  AUTH_LOGIN
  AUTH_LOGOUT
  AUTH_LOGIN_FAILED
  AUTH_REFRESH
  AUTH_PASSWORD_RESET
  AUTH_TOKEN_REUSE_DETECTED
  USER_CREATED
  USER_UPDATED
  USER_DELETED
  TENANT_CREATED
  BRANCH_CREATED
  ITEM_CREATED
  ITEM_UPDATED
  ITEM_DELETED
  ORDER_CREATED
  ORDER_STATUS_CHANGED
  PAYMENT_CAPTURED
  PAYMENT_REFUNDED
  SETTINGS_CHANGED
  PERMISSION_CHANGED
}

// ----- Tenant (the restaurant company) -----

model Tenant {
  id              String     @id @default(cuid())
  name            String
  legalName       String?
  slug            String     @unique
  type            String     @default("restaurant") // restaurant | cafe | qsr | hotel | cloud
  currency        String     @default("INR")
  timezone        String     @default("Asia/Kolkata")
  locale          String     @default("en-IN")
  taxConfig       Json?      // { gstNumber, slabs: [...], inclusive: bool }
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  branches        Branch[]
  users           User[]
  sessions        Session[]
  auditLogs       AuditLog[]

  @@index([deletedAt])
  @@map("tenants")
}

// ----- Branch (an outlet of a tenant) -----

model Branch {
  id              String     @id @default(cuid())
  tenantId        String
  name            String
  code            String     // e.g. "BAN" for Bandra
  address         String?
  phone           String?
  isLive          Boolean    @default(true)
  openingHours    Json?      // { mon: ['09:00','23:00'], ... }
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  tenant          Tenant     @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@unique([tenantId, code])
  @@index([tenantId, deletedAt])
  @@map("branches")
}

// ----- User -----

model User {
  id              String     @id @default(cuid())
  tenantId        String?    // null for SUPER_ADMIN platform staff
  email           String     @db.Citext
  emailVerifiedAt DateTime?
  passwordHash    String
  name            String
  phone           String?
  avatarUrl       String?
  role            UserRole   @default(CUSTOMER)
  status          UserStatus @default(ACTIVE)
  branchIds       String[]   @default([])  // which branches this user can access
  lastLoginAt     DateTime?
  failedLoginCount Int       @default(0)
  lockedUntil     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  tenant          Tenant?    @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  sessions        Session[]
  auditLogs       AuditLog[]

  @@unique([tenantId, email])
  @@index([email])
  @@index([tenantId, role, deletedAt])
  @@map("users")
}

// ----- Session (refresh token rotation) -----

model Session {
  id              String        @id @default(cuid())
  userId          String
  tenantId        String?
  // The refresh token is stored as SHA-256 hash so a DB leak doesn't yield valid tokens.
  refreshTokenHash String       @unique
  // For rotation: when this token is exchanged, we record the new session id here.
  // If a request comes in with a token whose session has rotatedToId, we treat it as reuse → revoke entire family.
  rotatedToId     String?       @unique
  family          String        // shared id across the rotation chain (one per login)
  ip              String?
  userAgent       String?
  status          SessionStatus @default(ACTIVE)
  expiresAt       DateTime
  createdAt       DateTime      @default(now())
  revokedAt       DateTime?

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant          Tenant?       @relation(fields: [tenantId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([family])
  @@index([expiresAt])
  @@map("sessions")
}

// ----- Audit log -----

model AuditLog {
  id          String      @id @default(cuid())
  tenantId    String?
  userId      String?
  action      AuditAction
  entityType  String?     // e.g. "Item", "Order"
  entityId    String?
  ip          String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime    @default(now())

  tenant      Tenant?     @relation(fields: [tenantId], references: [id], onDelete: SetNull)
  user        User?       @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

> ⚡ **PERFORMANCE** — Note `@db.Citext` on `email` (case-insensitive comparison without `LOWER()` everywhere) and the partial-style composite indexes leading with `tenantId`. Every tenant-scoped query gets an index hit.

### 💻 Prisma Client Singleton — `src/db/prisma.js`

```js
import { PrismaClient } from '@prisma/client';

import { config, env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Prisma client singleton. Important details:
 *  - log levels mapped to winston
 *  - slow query warning threshold from env
 *  - soft-delete global middleware (excluding deletedAt rows from selects)
 *  - connection pool sizing controlled via `?connection_limit=` in DATABASE_URL
 */

function buildClient() {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
    datasources: { db: { url: env.DATABASE_URL } },
  });

  if (env.DATABASE_LOG_QUERIES) {
    client.$on('query', (e) => {
      logger.debug('prisma.query', { query: e.query, params: e.params, durationMs: e.duration });
    });
  }

  client.$on('query', (e) => {
    if (e.duration >= env.DATABASE_SLOW_QUERY_MS) {
      logger.warn('prisma.slow_query', {
        query: e.query,
        params: e.params,
        durationMs: e.duration,
      });
    }
  });

  client.$on('warn', (e) => logger.warn('prisma.warn', { message: e.message }));
  client.$on('error', (e) => logger.error('prisma.error', { message: e.message }));

  /* -------- Soft-delete middleware --------
   * Every read query auto-filters out rows with deletedAt != null unless
   * the caller explicitly passes `withDeleted: true` via `$extends`.
   * Every delete becomes an update setting deletedAt. */
  client.$use(async (params, next) => {
    const SOFT_DELETE_MODELS = new Set(['Tenant', 'Branch', 'User']);
    if (!SOFT_DELETE_MODELS.has(params.model)) return next(params);

    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst';
      params.args.where = { ...(params.args.where ?? {}), deletedAt: null };
    }
    if (params.action === 'findMany') {
      params.args = params.args ?? {};
      params.args.where = { deletedAt: null, ...(params.args.where ?? {}) };
    }
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      params.args.data = { ...(params.args.data ?? {}), deletedAt: new Date() };
    }
    return next(params);
  });

  return client;
}

// In dev, hot-reload would otherwise spawn a new client every save → connection storm.
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma ?? buildClient();
if (!config.isProd) globalForPrisma.__prisma = prisma;

/** Health probe — fast, no real query */
export async function pingDb() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
```

> ⚡ **PERFORMANCE** — Connection pool sizing: per-instance `connection_limit` × number of instances must stay below Postgres `max_connections - reserved`. With 200 max_connections, 20 instances, you can afford `connection_limit=8` per instance plus headroom for migrations/maintenance. Use PgBouncer (Phase 8) when the pod count exceeds 10.

### 💻 Read Replica Stub — `src/db/prismaReplica.js`

```js
import { PrismaClient } from '@prisma/client';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';
import { prisma } from './prisma.js';

let replica = null;

/**
 * Returns a read-only Prisma client targeting the replica when configured,
 * else falls back to the primary. Use for analytics / report queries.
 */
export function getReadClient() {
  if (!env.DATABASE_REPLICA_URL) return prisma;
  if (replica) return replica;
  replica = new PrismaClient({
    datasources: { db: { url: env.DATABASE_REPLICA_URL } },
  });
  logger.info('Read replica client initialized');
  return replica;
}
```

### 💻 Migrations & Seed

**`prisma/seed.js`**

```js
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vuedine-demo' },
    update: {},
    create: {
      slug: 'vuedine-demo',
      name: 'Vuedine Demo',
      legalName: 'Vuedine Demo Pvt. Ltd.',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      taxConfig: { gstNumber: '27AAACV0001Z1Z5', inclusive: false, slabs: [{ name: 'GST 5%', rate: 0.05 }] },
    },
  });

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BAN' } },
    update: {},
    create: { tenantId: tenant.id, code: 'BAN', name: 'Mumbai · Bandra (Main)', isLive: true },
  });

  const passwordHash = await bcrypt.hash('vuedine123', 10);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@vuedine.demo' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@vuedine.demo',
      passwordHash,
      name: 'Demo Owner',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      branchIds: [branch.id],
      emailVerifiedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seeded tenant=%s branch=%s', tenant.slug, branch.code);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Add to `package.json`:**

```json
{
  "prisma": { "seed": "node prisma/seed.js" }
}
```

### 🔄 Migration Workflow

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate a migration locally
npx prisma migrate dev --name add_orders_table

# 3. Review the SQL Prisma generated under prisma/migrations/<ts>_add_orders_table/migration.sql
# 4. Commit BOTH the schema and the migration
# 5. CI applies on staging/prod via:
npx prisma migrate deploy
```

> 🔴 **PRODUCTION CRITICAL** — Never run `migrate dev` against staging or prod. It can drop and recreate. The deploy command (`migrate deploy`) only applies pending migrations. Wire it into your deploy pipeline, not your shell.

### 💻 Update `/ready` to include DB

```js
// in src/app.js, replace the stub /ready handler with:
import { pingDb } from './db/prisma.js';

app.get('/ready', async (_req, res) => {
  try {
    await pingDb();
    res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', message: err.message });
  }
});
```

### ✅ Phase Completion Checklist
- [ ] `docker compose up postgres` brings up Postgres healthy
- [ ] `npx prisma migrate dev --name init` generates and applies the initial migration
- [ ] `npm run db:seed` creates the demo tenant + owner user
- [ ] `npx prisma studio` opens, shows all tables
- [ ] Soft delete: `prisma.user.delete(...)` sets `deletedAt`; subsequent `findMany` excludes the row
- [ ] Slow query log fires when running an artificially slow query
- [ ] `/ready` returns 503 when Postgres is stopped
- [ ] All FKs verified with `\d table_name` in psql
- [ ] Connection pool sizing documented for each tier in `README.md`

### ⚠️ Common Pitfalls
1. **Forgetting `tenantId` on a query.** Without composite indexes leading with `tenantId`, every query becomes a sequential scan once tenants grow. Codify it with a `withTenantScope(tenantId)` helper in Phase 5.
2. **Storing money as `float`.** `0.1 + 0.2 !== 0.3`. Always `Decimal`. Always.
3. **Letting Prisma manage every migration.** When you need a non-trivial backfill (e.g., recomputing column from existing data), generate the SQL with `prisma migrate diff --script`, edit it, and apply via `migrate deploy`. Don't fight the tool — collaborate.
4. **Cascading deletes on `Tenant`.** Sounds tidy until a misclick wipes out a customer's entire dataset. Use `Restrict` on the parent and a deliberate "delete tenant" job that orphans then cleans up.

---

## Phase 3 — Redis Setup & Rate Limiting Architecture

### 📌 Goal
Bring up Redis, wire a resilient client with retry, and build the three rate-limiting layers (global, per-route, per-user) on a sliding-window algorithm. Land the cache-aside helper, an IP allow/deny mechanism, and the pub/sub primitives that Phase 6 (queues) and Phase 8 (realtime) will build on.

### 🔗 Dependencies to Install

```bash
npm install ioredis rate-limiter-flexible
```

### ⚙️ Configuration Samples

**`docker-compose.yml`** (Redis service)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: vuedine_redis
    restart: unless-stopped
    command:
      - "redis-server"
      - "--appendonly"
      - "yes"
      - "--maxmemory"
      - "512mb"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--save"
      - "60 1000"
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  redis_data:
```

> ⚡ **PERFORMANCE** — `allkeys-lru` is right for a mixed cache + RL workload: when memory fills, oldest unused keys evict. If you also use Redis as a queue store (Phase 6), pin queue keys with TTL=`-1` and they'll be exempt from LRU since BullMQ's keys aren't pure cache.

### 💻 Redis Client — `src/db/redis.js`

```js
import IORedis from 'ioredis';

import { config, env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Single Redis client used for cache + rate limiting.
 * BullMQ requires its own client (different config), see Phase 6.
 */

function buildRedis() {
  const r = new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    keyPrefix: env.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      // Exponential backoff capped at 5s. Returns null to stop retrying.
      const delay = Math.min(times * 200, 5_000);
      logger.warn('redis.retry', { attempt: times, delayMs: delay });
      return delay;
    },
    reconnectOnError: (err) => {
      const msg = err.message;
      if (msg.includes('READONLY')) return true; // failover scenario
      return false;
    },
  });

  r.on('connect', () => logger.info('redis.connected'));
  r.on('ready', () => logger.info('redis.ready'));
  r.on('error', (err) => logger.error('redis.error', { message: err.message }));
  r.on('end', () => logger.warn('redis.end'));
  r.on('reconnecting', (delayMs) => logger.warn('redis.reconnecting', { delayMs }));

  return r;
}

const globalForRedis = globalThis;
export const redis = globalForRedis.__redis ?? buildRedis();
if (!config.isProd) globalForRedis.__redis = redis;

/** Health probe */
export async function pingRedis() {
  const pong = await redis.ping();
  return pong === 'PONG';
}
```

### 💻 Rate Limiting — sliding window via `rate-limiter-flexible`

**Why sliding window over fixed window:** Fixed windows let an attacker burst at the boundary — e.g., 60 requests in the last second of one window plus 60 in the first second of the next = 120 in 2 seconds against a "60/minute" limit. Sliding window keeps a rolling count over the configured period and is what major CDNs use. `rate-limiter-flexible` implements it efficiently with Redis using a Lua script (atomic, single round-trip).

**`src/middleware/rateLimit.middleware.js`**

```js
import { RateLimiterRedis } from 'rate-limiter-flexible';

import { env } from '../config/index.js';
import { redis } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';

/* ---------- Whitelist / blacklist ---------- */

const WHITELIST_KEY = 'rl:whitelist';
const BLACKLIST_KEY = 'rl:blacklist';

export const ipAccess = {
  async allow(ip) { await redis.sadd(WHITELIST_KEY, ip); },
  async block(ip) { await redis.sadd(BLACKLIST_KEY, ip); },
  async unblock(ip) { await redis.srem(BLACKLIST_KEY, ip); },
  async unallow(ip) { await redis.srem(WHITELIST_KEY, ip); },
  async isAllowed(ip) { return (await redis.sismember(WHITELIST_KEY, ip)) === 1; },
  async isBlocked(ip) { return (await redis.sismember(BLACKLIST_KEY, ip)) === 1; },
};

/* ---------- Limiter factory ---------- */

function makeLimiter({ keyPrefix, points, durationSec, blockDurationSec = 0 }) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,            // number of allowed events
    duration: durationSec,
    blockDuration: blockDurationSec,
    execEvenly: false,
    inMemoryBlockOnConsumed: points + 1,    // protect Redis from hot-keys
    inMemoryBlockDuration: durationSec,
  });
}

/* ---------- Three pre-baked limiters ---------- */

const globalLimiter = makeLimiter({
  keyPrefix: 'rl:global',
  points: env.RATE_LIMIT_GLOBAL_MAX,
  durationSec: Math.ceil(env.RATE_LIMIT_GLOBAL_WINDOW_MS / 1000),
});

const loginLimiter = makeLimiter({
  keyPrefix: 'rl:login',
  points: env.RATE_LIMIT_LOGIN_MAX,
  durationSec: Math.ceil(env.RATE_LIMIT_LOGIN_WINDOW_MS / 1000),
  blockDurationSec: 900,        // lock the offender out for 15 min after exhaustion
});

const userLimiter = makeLimiter({
  keyPrefix: 'rl:user',
  points: 600,
  durationSec: 60,
});

/* ---------- Middleware factory ---------- */

function attachHeaders(res, rlRes, limit) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rlRes.remainingPoints)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000 + rlRes.msBeforeNext / 1000)));
}

function build(limiter, keyFn, limit) {
  return async function rateLimitMiddleware(req, res, next) {
    try {
      const ip = req.ip;
      if (await ipAccess.isBlocked(ip)) {
        throw AppError.forbidden('IP blocked', 'IP_BLOCKED');
      }
      if (await ipAccess.isAllowed(ip)) return next();

      const key = keyFn(req);
      if (!key) return next();

      const rlRes = await limiter.consume(key);
      attachHeaders(res, rlRes, limit);
      next();
    } catch (err) {
      if (err instanceof AppError) return next(err);
      // Library rejects with the result object on rate-limit
      if (err.msBeforeNext !== undefined) {
        attachHeaders(res, err, limit);
        res.setHeader('Retry-After', String(Math.ceil(err.msBeforeNext / 1000)));
        return next(AppError.tooMany('Too many requests, please slow down', 'RATE_LIMITED'));
      }
      // Redis unreachable etc. — fail open with a warning rather than break the API
      next();
    }
  };
}

export const globalRateLimit = build(
  globalLimiter,
  (req) => req.ip,
  env.RATE_LIMIT_GLOBAL_MAX,
);

export const loginRateLimit = build(
  loginLimiter,
  (req) => `${req.ip}:${(req.body?.email ?? '').toString().toLowerCase().slice(0, 100)}`,
  env.RATE_LIMIT_LOGIN_MAX,
);

export const userRateLimit = build(
  userLimiter,
  (req) => (req.user ? `u:${req.user.id}` : null),
  600,
);
```

> 🔒 **SECURITY** — The login limiter keys on **IP+email**, not just IP. A shared NAT (office building, mobile carrier) shouldn't lock out everyone because one user typo'd their password. Conversely, an attacker rotating IPs against one email still gets caught.

> ⚡ **PERFORMANCE** — `inMemoryBlockOnConsumed` is the unsung hero. Once an IP is over its limit, the limiter remembers in-process and stops calling Redis. Saves 1 RTT per blocked request — meaningful under DoS.

**Mount in `src/app.js`** (replace the dev fallback rate-limiter from Phase 1):

```js
import { globalRateLimit } from './middleware/rateLimit.middleware.js';
// ...
app.use(globalRateLimit);
// route-specific:
// app.post('/v1/auth/login', loginRateLimit, ...)
// app.use('/v1', authMiddleware, userRateLimit, ...)
```

### 💻 Cache-Aside Helper — `src/utils/cache.js`

```js
import { redis } from '../db/redis.js';
import { logger } from '../config/logger.js';

/**
 * Cache-aside (lazy-loading) pattern:
 *   1. try cache
 *   2. on miss, call loader, write result, return
 *   3. on cache error, fall through to loader (never break the app for cache)
 *
 * `version` is a per-key invalidation cursor — bump it (e.g., on bulk update)
 * to invalidate everything sharing the same prefix without SCAN.
 */
export function cached({ key, ttlSec = 60, version = 1 }) {
  const fullKey = `cache:v${version}:${key}`;
  return {
    async get() {
      try {
        const raw = await redis.get(fullKey);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        logger.warn('cache.get_failed', { key: fullKey, err: err.message });
        return null;
      }
    },
    async set(value) {
      try { await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSec); }
      catch (err) { logger.warn('cache.set_failed', { key: fullKey, err: err.message }); }
    },
    async del() {
      try { await redis.del(fullKey); }
      catch (err) { logger.warn('cache.del_failed', { key: fullKey, err: err.message }); }
    },
  };
}

/**
 * Wrap an async loader with cache-aside.
 *   const items = await withCache({ key: `items:${tenantId}`, ttlSec: 300 }, () => repo.list(tenantId));
 */
export async function withCache(opts, loader) {
  const c = cached(opts);
  const hit = await c.get();
  if (hit !== null) return hit;
  const fresh = await loader();
  if (fresh !== undefined && fresh !== null) await c.set(fresh);
  return fresh;
}

/**
 * Invalidate all keys for a given prefix by bumping the version pointer.
 * Stored under cache:meta:<prefix> = current version.
 */
export async function bumpVersion(prefix) {
  return redis.incr(`cache:meta:${prefix}`);
}

export async function getVersion(prefix) {
  const v = await redis.get(`cache:meta:${prefix}`);
  return v ? parseInt(v, 10) : 1;
}
```

> ⚡ **PERFORMANCE** — Version-pointer invalidation beats `SCAN` + `DEL` for "wipe all menu items for tenant X." `SCAN` over a million keys is O(N); incrementing a single counter is O(1). The price is one extra GET to look up the version, but that's a sub-ms hit.

### 💻 Cache Middleware Factory — `src/middleware/cache.middleware.js`

```js
import { cached } from '../utils/cache.js';

/**
 * Cache GET responses by URL + tenant. Skips on auth-mutating verbs and on no-cache headers.
 *
 *   router.get('/items', cacheRoute({ ttlSec: 60 }), itemsController.list);
 */
export function cacheRoute({ ttlSec = 60, keyFn } = {}) {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.get('Cache-Control') === 'no-cache') return next();

    const key = keyFn
      ? keyFn(req)
      : `route:${req.tenantId ?? 'public'}:${req.originalUrl}`;
    const c = cached({ key, ttlSec });

    const hit = await c.get();
    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(hit);
    }

    res.setHeader('X-Cache', 'MISS');
    const origJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        c.set(body).catch(() => {}); // fire-and-forget
      }
      return origJson(body);
    };
    next();
  };
}
```

### 💻 Pub/Sub Primitives — `src/realtime/pubsub.js`

```js
import IORedis from 'ioredis';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Pub/sub uses *separate* connections from the cache/RL client because
 * a connection in subscribe mode can only run subscribe/unsubscribe commands.
 */
const publisher = new IORedis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD || undefined,
  keyPrefix: env.REDIS_KEY_PREFIX,
});
const subscriber = new IORedis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD || undefined,
  keyPrefix: env.REDIS_KEY_PREFIX,
});

publisher.on('error', (e) => logger.error('redis.pub.error', { err: e.message }));
subscriber.on('error', (e) => logger.error('redis.sub.error', { err: e.message }));

const handlers = new Map(); // channel -> Set<fn>

subscriber.on('message', (channel, message) => {
  const set = handlers.get(channel);
  if (!set) return;
  let payload;
  try { payload = JSON.parse(message); } catch { payload = message; }
  for (const fn of set) {
    Promise.resolve(fn(payload)).catch((e) =>
      logger.error('pubsub.handler_error', { channel, err: e.message }),
    );
  }
});

export const pubsub = {
  async publish(channel, payload) {
    return publisher.publish(channel, JSON.stringify(payload));
  },
  async subscribe(channel, handler) {
    if (!handlers.has(channel)) {
      handlers.set(channel, new Set());
      await subscriber.subscribe(channel);
    }
    handlers.get(channel).add(handler);
  },
  async unsubscribe(channel, handler) {
    const set = handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(channel);
      await subscriber.unsubscribe(channel);
    }
  },
};
```

This is the backbone for replacing the frontend's `localStorage` `liveOrders` bus — see Phase 8 for the WebSocket gateway that bridges it.

### ✅ Phase Completion Checklist
- [ ] `docker compose up redis` brings Redis up healthy
- [ ] `redis-cli ping` returns `PONG`
- [ ] Hammering `/health` 400 times in a minute returns `429` with `Retry-After`
- [ ] `X-RateLimit-*` headers present on every response
- [ ] Login limiter triggers after N failed attempts and stays blocked for `blockDuration`
- [ ] Stopping Redis does **not** crash the API (limiters fail open with a warning log)
- [ ] Whitelist add/remove via admin endpoint works
- [ ] `withCache` returns cached value on second call
- [ ] `bumpVersion('items')` invalidates all items caches without `SCAN`
- [ ] Pub/sub round-trip across two app instances works in dev

### ⚠️ Common Pitfalls
1. **Sharing one Redis connection across cache, RL, queue, AND pubsub.** A subscriber-mode connection can only `subscribe/unsubscribe`. Use separate clients (BullMQ also wants its own; Phase 6).
2. **Rate-limiting on `req.connection.remoteAddress` instead of `req.ip`.** Without `trust proxy` set correctly, every request appears to come from the load balancer. Phase 1 sets this — verify it.
3. **Caching authenticated responses globally.** A `cacheRoute` keyed only on URL leaks user A's data to user B. Always include tenant + user in the key for non-public routes.
4. **`DEL`-then-write race condition.** Cache invalidation pattern: write DB → `DEL` cache. If two writers race, you can resurrect stale data. Use the version-pointer pattern above for high-contention keys.

---

## Phase 4 — Authentication & Authorization System

### 📌 Goal
Build a production-grade auth subsystem: short-lived JWT access tokens, long-lived refresh tokens with rotation + reuse detection, RBAC, OAuth-ready provider hooks, brute-force lockout, email verification and password reset flows. Every auth event is audit-logged.

### 🔗 Dependencies to Install

```bash
npm install jsonwebtoken bcrypt cookie-parser ms
npm install -D @types/jsonwebtoken
```

### 🧠 Token Design

- **Access token** — JWT, signed HS256 with `JWT_ACCESS_SECRET`, **15 min** TTL. Carries `sub` (userId), `tid` (tenantId), `role`, `branchIds`. Sent as `Authorization: Bearer <jwt>`.
- **Refresh token** — opaque random 256-bit token. Stored as **SHA-256 hash** in `Session.refreshTokenHash`. TTL **7 days**. Delivered as a `httpOnly; Secure; SameSite=Lax` cookie at `/v1/auth`.
- **Family** — every refresh token belongs to a "family" (one shared id per login session). When a token is rotated, the old session row records `rotatedToId`. If a request arrives with a token whose row has `rotatedToId` set, it's a replay → revoke the entire family and force re-login. This is the OWASP-recommended refresh token rotation pattern.

```mermaid
sequenceDiagram
    Client->>API: POST /auth/login (email, password)
    API->>DB: bcrypt.compare, create Session(family=A, refreshHash=H1)
    API-->>Client: 200 {access, set-cookie refresh=R1}
    Note over Client: 14 min later
    Client->>API: POST /auth/refresh (cookie R1)
    API->>DB: find by hash(R1), check family A active
    API->>DB: rotate: mark old.rotatedToId=newSessionId, create Session(family=A, refreshHash=H2)
    API-->>Client: 200 {access, set-cookie refresh=R2}
    Note over Client: Attacker steals R1 from disk
    Attacker->>API: POST /auth/refresh (R1)
    API->>DB: find by hash(R1), see rotatedToId is set → REUSE!
    API->>DB: revoke entire family A
    API-->>Attacker: 401, audit AUTH_TOKEN_REUSE_DETECTED
```

### 🗂 File/Folder Changes

```
src/modules/auth/
├─ auth.controller.js
├─ auth.service.js
├─ auth.repository.js
├─ auth.routes.js
├─ auth.validators.js
└─ tokens.js              # JWT signing + refresh token utilities
src/middleware/
├─ auth.middleware.js
└─ rbac.middleware.js
src/modules/audit/
├─ audit.service.js
└─ audit.repository.js
```

### 💻 Token Utilities — `src/modules/auth/tokens.js`

```js
import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';
import ms from 'ms';

import { env } from '../../config/index.js';

const ACCESS_TTL_MS = ms(env.JWT_ACCESS_TTL);
const REFRESH_TTL_MS = ms(env.JWT_REFRESH_TTL);

export const tokens = {
  accessTtlMs: ACCESS_TTL_MS,
  refreshTtlMs: REFRESH_TTL_MS,

  signAccess(user) {
    return jwt.sign(
      {
        sub: user.id,
        tid: user.tenantId ?? null,
        role: user.role,
        branchIds: user.branchIds ?? [],
      },
      env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL, issuer: 'vuedine', audience: 'vuedine-api' },
    );
  },

  verifyAccess(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'vuedine',
      audience: 'vuedine-api',
    });
  },

  /** Opaque refresh token: 32 random bytes → base64url. */
  newRefreshToken() {
    const raw = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  },

  hashRefresh(raw) {
    return createHash('sha256').update(raw).digest('hex');
  },

  refreshCookieOptions(isProd) {
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: REFRESH_TTL_MS,
    };
  },
};
```

### 💻 Auth Repository — `src/modules/auth/auth.repository.js`

```js
import { randomUUID } from 'node:crypto';

import { SessionStatus } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export const authRepo = {
  findUserByEmail(tenantSlug, email) {
    return prisma.user.findFirst({
      where: { email, tenant: tenantSlug ? { slug: tenantSlug } : undefined },
      include: { tenant: true },
    });
  },

  findUserById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  createSession({ userId, tenantId, refreshHash, expiresAt, ip, userAgent, family }) {
    return prisma.session.create({
      data: {
        userId,
        tenantId,
        refreshTokenHash: refreshHash,
        family: family ?? randomUUID(),
        expiresAt,
        ip,
        userAgent,
      },
    });
  },

  findSessionByHash(refreshHash) {
    return prisma.session.findUnique({
      where: { refreshTokenHash: refreshHash },
      include: { user: true },
    });
  },

  rotateSession({ oldId, newSessionData }) {
    return prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({ data: newSessionData });
      await tx.session.update({
        where: { id: oldId },
        data: { rotatedToId: newSession.id, status: SessionStatus.REVOKED, revokedAt: new Date() },
      });
      return newSession;
    });
  },

  revokeFamily(family) {
    return prisma.session.updateMany({
      where: { family, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  },

  revokeSession(id) {
    return prisma.session.update({
      where: { id },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });
  },

  bumpFailedLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
  },

  lockUser(userId, until) {
    return prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: until, failedLoginCount: 0 },
    });
  },

  resetFailedLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  },
};
```

### 💻 Auth Service — `src/modules/auth/auth.service.js`

```js
import bcrypt from 'bcrypt';

import { env } from '../../config/index.js';
import { redis } from '../../db/redis.js';
import { auditService } from '../audit/audit.service.js';
import { AppError } from '../../utils/AppError.js';
import { tokens } from './tokens.js';
import { authRepo } from './auth.repository.js';

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;

export const authService = {
  async register({ email, password, name, tenantSlug }) {
    // Tenant context: a self-serve register creates the tenant; an invite flow attaches.
    // For brevity, only the invite-attach path is shown here.
    throw AppError.badRequest('Public registration disabled — use an invite link', 'REGISTRATION_DISABLED');
  },

  async login({ email, password, tenantSlug, ip, userAgent }) {
    const user = await authRepo.findUserByEmail(tenantSlug, email);

    // Constant-time-ish behavior: always run bcrypt even if user not found.
    const dummyHash = '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0';
    const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

    if (!user || !ok) {
      if (user) {
        const updated = await authRepo.bumpFailedLogin(user.id);
        if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
          await authRepo.lockUser(user.id, new Date(Date.now() + LOCKOUT_MINUTES * 60_000));
          await auditService.record({
            tenantId: user.tenantId, userId: user.id, ip, userAgent,
            action: 'AUTH_LOGIN_FAILED', metadata: { locked: true },
          });
        } else {
          await auditService.record({
            tenantId: user.tenantId, userId: user.id, ip, userAgent,
            action: 'AUTH_LOGIN_FAILED', metadata: { count: updated.failedLoginCount },
          });
        }
      }
      throw AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw AppError.unauthorized('Account temporarily locked', 'ACCOUNT_LOCKED');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.unauthorized(`Account is ${user.status.toLowerCase()}`, 'ACCOUNT_NOT_ACTIVE');
    }

    await authRepo.resetFailedLogin(user.id);

    const { raw, hash } = tokens.newRefreshToken();
    const session = await authRepo.createSession({
      userId: user.id,
      tenantId: user.tenantId,
      refreshHash: hash,
      expiresAt: new Date(Date.now() + tokens.refreshTtlMs),
      ip,
      userAgent,
    });

    await auditService.record({
      tenantId: user.tenantId, userId: user.id, ip, userAgent,
      action: 'AUTH_LOGIN', metadata: { sessionId: session.id },
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, branchIds: user.branchIds },
      accessToken: tokens.signAccess(user),
      refreshToken: raw,
    };
  },

  async refresh({ refreshToken, ip, userAgent }) {
    if (!refreshToken) throw AppError.unauthorized('No refresh token', 'NO_REFRESH_TOKEN');
    const hash = tokens.hashRefresh(refreshToken);
    const session = await authRepo.findSessionByHash(hash);
    if (!session) throw AppError.unauthorized('Invalid refresh token', 'BAD_REFRESH_TOKEN');

    // Reuse detection
    if (session.rotatedToId || session.status !== 'ACTIVE') {
      await authRepo.revokeFamily(session.family);
      await auditService.record({
        tenantId: session.tenantId, userId: session.userId, ip, userAgent,
        action: 'AUTH_TOKEN_REUSE_DETECTED', metadata: { family: session.family },
      });
      throw AppError.unauthorized('Refresh token reuse detected', 'TOKEN_REUSE');
    }
    if (session.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
    }

    const { raw, hash: newHash } = tokens.newRefreshToken();
    const newSession = await authRepo.rotateSession({
      oldId: session.id,
      newSessionData: {
        userId: session.userId,
        tenantId: session.tenantId,
        refreshTokenHash: newHash,
        family: session.family,
        expiresAt: new Date(Date.now() + tokens.refreshTtlMs),
        ip,
        userAgent,
      },
    });

    await auditService.record({
      tenantId: session.tenantId, userId: session.userId, ip, userAgent,
      action: 'AUTH_REFRESH', metadata: { newSessionId: newSession.id },
    });

    const user = session.user;
    return {
      accessToken: tokens.signAccess(user),
      refreshToken: raw,
    };
  },

  async logout({ refreshToken, ip, userAgent }) {
    if (!refreshToken) return;
    const hash = tokens.hashRefresh(refreshToken);
    const session = await authRepo.findSessionByHash(hash);
    if (!session) return;
    await authRepo.revokeSession(session.id);
    await auditService.record({
      tenantId: session.tenantId, userId: session.userId, ip, userAgent,
      action: 'AUTH_LOGOUT', metadata: { sessionId: session.id },
    });
  },

  async startPasswordReset(email) {
    // We always respond 200 to avoid leaking whether email exists.
    const user = await authRepo.findUserByEmail(null, email);
    if (!user) return;
    const token = tokens.newRefreshToken().raw;
    const key = `pwreset:${tokens.hashRefresh(token)}`;
    await redis.set(key, user.id, 'EX', env.PASSWORD_RESET_TTL_MIN * 60);
    // Phase 6 enqueues the email
    return { token, userId: user.id };
  },

  async completePasswordReset({ token, newPassword }) {
    const key = `pwreset:${tokens.hashRefresh(token)}`;
    const userId = await redis.get(key);
    if (!userId) throw AppError.badRequest('Reset link expired or invalid', 'BAD_RESET_TOKEN');
    await redis.del(key);
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_COST);
    await authRepo.revokeFamily(userId); // sign out everywhere
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },
};

import { prisma } from '../../db/prisma.js';
```

> 🔒 **SECURITY** — Constant-time login: always run `bcrypt.compare`, even when the user is missing. Skipping it leaks user existence via timing. The dummy hash above is a real bcrypt output of length 60 — bcrypt's compare runs the full work factor regardless.

### 💻 Auth Middleware — `src/middleware/auth.middleware.js`

```js
import { tokens } from '../modules/auth/tokens.js';
import { authRepo } from '../modules/auth/auth.repository.js';
import { redis } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';

const REVOKED_PREFIX = 'auth:revoked:';

export async function authMiddleware(req, _res, next) {
  try {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('Missing bearer token', 'NO_TOKEN');
    }

    let payload;
    try {
      payload = tokens.verifyAccess(token);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
      throw AppError.unauthorized(err.message, code);
    }

    // Fast revocation check (Redis) — set when admin force-revokes a user
    if (await redis.exists(`${REVOKED_PREFIX}${payload.sub}`)) {
      throw AppError.unauthorized('Session revoked', 'SESSION_REVOKED');
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tid,
      role: payload.role,
      branchIds: payload.branchIds ?? [],
    };
    req.tenantId = payload.tid;
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — populate req.user if a valid token is present, do not 401 if missing. */
export async function optionalAuth(req, _res, next) {
  const header = req.get('Authorization');
  if (!header) return next();
  return authMiddleware(req, _res, next);
}
```

### 💻 RBAC — `src/middleware/rbac.middleware.js`

```js
import { AppError } from '../utils/AppError.js';

/**
 * Coarse role check. For finer-grained permissions, layer a permission registry
 * on top (the frontend already enumerates them in pages/dashboard/UserRoles.tsx).
 */
export function requireRole(...allowed) {
  const set = new Set(allowed);
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('Auth required', 'NO_AUTH'));
    if (!set.has(req.user.role)) {
      return next(AppError.forbidden(
        `Requires role in [${[...set].join(', ')}]`,
        'INSUFFICIENT_ROLE',
      ));
    }
    next();
  };
}

/** Branch scope check: user must include the requested branch in their accessible list. */
export function requireBranchAccess(branchIdParam = 'branchId') {
  return (req, _res, next) => {
    const branchId = req.params[branchIdParam] ?? req.body?.branchId ?? req.query?.branchId;
    if (!branchId) return next(AppError.badRequest('branchId required', 'BRANCH_REQUIRED'));
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'OWNER') return next();
    if (!req.user.branchIds.includes(branchId)) {
      return next(AppError.forbidden('No access to this branch', 'BRANCH_FORBIDDEN'));
    }
    next();
  };
}
```

### 💻 Routes & Controller — `src/modules/auth/auth.routes.js`

```js
import { Router } from 'express';
import cookieParser from 'cookie-parser';

import { config } from '../../config/index.js';
import { loginRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { tokens } from './tokens.js';
import { authService } from './auth.service.js';
import { loginSchema, refreshSchema, resetStartSchema, resetCompleteSchema } from './auth.validators.js';

export const authRouter = Router();
authRouter.use(cookieParser());

authRouter.post(
  '/login',
  loginRateLimit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      tenantSlug: req.body.tenantSlug,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.cookie('refresh', result.refreshToken, tokens.refreshCookieOptions(config.isProd));
    res.json({ success: true, data: { user: result.user, accessToken: result.accessToken }, requestId: req.id });
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refresh ?? req.body?.refreshToken;
    const result = await authService.refresh({
      refreshToken,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.cookie('refresh', result.refreshToken, tokens.refreshCookieOptions(config.isProd));
    res.json({ success: true, data: { accessToken: result.accessToken }, requestId: req.id });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refresh;
    await authService.logout({ refreshToken, ip: req.ip, userAgent: req.get('User-Agent') });
    res.clearCookie('refresh', { path: '/v1/auth' });
    res.json({ success: true, data: null, requestId: req.id });
  }),
);

authRouter.post(
  '/password/reset/start',
  validate(resetStartSchema),
  asyncHandler(async (req, res) => {
    await authService.startPasswordReset(req.body.email);
    res.json({ success: true, data: null, requestId: req.id });
  }),
);

authRouter.post(
  '/password/reset/complete',
  validate(resetCompleteSchema),
  asyncHandler(async (req, res) => {
    await authService.completePasswordReset({
      token: req.body.token,
      newPassword: req.body.newPassword,
    });
    res.json({ success: true, data: null, requestId: req.id });
  }),
);
```

### 💻 Validators — `src/modules/auth/auth.validators.js`

```js
import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(200),
    tenantSlug: z.string().min(2).max(64).optional(),
  }),
});

export const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().optional() }).optional(),
});

export const resetStartSchema = z.object({
  body: z.object({ email: z.string().email().max(254) }),
});

export const resetCompleteSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8).max(200),
  }),
});
```

### 💻 OAuth Provider Stub — `src/modules/auth/oauth.providers.js`

```js
/**
 * Placeholder structure for Google / GitHub OAuth. Wire actual flows when the
 * FEATURE_OAUTH_GOOGLE / FEATURE_OAUTH_GITHUB env flags are flipped on.
 *
 * Suggested flow:
 *   GET /v1/auth/oauth/:provider           → redirect to provider
 *   GET /v1/auth/oauth/:provider/callback  → exchange code, find/create user, issue tokens
 *
 * Recommend using `openid-client` (PKCE-by-default) over hand-rolled axios.
 */
export const oauthProviders = {
  google: {
    enabled: false,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    enabled: false,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
};
```

### 💻 Audit Service — `src/modules/audit/audit.service.js`

```js
import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';

export const auditService = {
  async record({ tenantId, userId, action, entityType, entityId, ip, userAgent, metadata }) {
    try {
      await prisma.auditLog.create({
        data: { tenantId, userId, action, entityType, entityId, ip, userAgent, metadata },
      });
    } catch (err) {
      // Audit must never break the request path
      logger.error('audit.write_failed', { err: err.message, action });
    }
  },
};
```

> 🔒 **SECURITY** — Audit writes are best-effort but **never** in the request hot path's critical chain. If audit DB is down, log it and let the request succeed; you'll catch the gap via the audit-failure metric.

### ✅ Phase Completion Checklist
- [ ] `POST /v1/auth/login` returns access token + sets `refresh` cookie
- [ ] `POST /v1/auth/refresh` rotates: old session is `REVOKED` with `rotatedToId` set
- [ ] Re-using an old refresh token revokes the entire family (test in integration)
- [ ] 8 wrong passwords lock the account for 15 min
- [ ] `bcrypt.compare` runs even when user doesn't exist (timing-safe)
- [ ] `requireRole('OWNER', 'ADMIN')` rejects a CASHIER with 403 + `INSUFFICIENT_ROLE`
- [ ] Force-revoking a user via `redis.set('auth:revoked:<id>', '1', 'EX', 900)` makes their access token 401
- [ ] Audit log row written for every login/logout/refresh/reuse event
- [ ] Password reset token expires after `PASSWORD_RESET_TTL_MIN`

### ⚠️ Common Pitfalls
1. **Storing refresh tokens raw in DB.** A read-only DB leak yields valid tokens. Hash with SHA-256 before storage. Compare by hashing the inbound token.
2. **Long access tokens (24h+).** They can't be revoked without a Redis denylist round-trip on every request. Keep access ≤ 15 min and rely on refresh rotation for the long tail.
3. **`Set-Cookie SameSite=None` without `Secure`.** Browsers reject it silently. Use `Lax` for same-site flows; only switch to `None; Secure` when the API and frontend are on different parent domains.
4. **No "logout everywhere."** When a user resets password or rotates a stolen device, you must `revokeFamily(userId)` for *all* sessions, not just the current one. The repo helper above does this.

---

## Phase 5 — API Layer & Routing Architecture

### 📌 Goal
Codify how every feature module is built: versioned routing, the controller → service → repository pattern, schema-first validation with zod, a single response envelope, a global error handler that distinguishes operational from programmer errors, file uploads with an S3-ready adapter, and pagination utilities for both cursor and offset styles.

### 🗂 File/Folder Changes

```
src/
├─ middleware/
│  └─ validate.middleware.js
├─ utils/
│  ├─ envelope.js
│  ├─ pagination.js
│  ├─ errorCodes.js
│  └─ uploader.js
├─ modules/
│  └─ items/                     # exemplar feature module
│     ├─ items.controller.js
│     ├─ items.service.js
│     ├─ items.repository.js
│     ├─ items.routes.js
│     └─ items.validators.js
└─ routes.v1.js                  # router aggregator for /v1
```

### 🔗 Dependencies to Install

```bash
npm install zod multer @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 🧠 The Pattern (strict separation)

```
┌─ controller ────────────────┐    parses req, calls service, shapes response
│                             │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│  service                    │    business rules, orchestration, transactions
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│  repository                 │    Prisma queries only — no business logic
└─────────────────────────────┘
```

**Hard rules:**
- Controllers **never** call Prisma directly.
- Services **never** read `req` or write `res`.
- Repositories **never** know about HTTP, auth, or validation.
- A new validator **always** lands beside its routes file.

### 💻 Response Envelope — `src/utils/envelope.js`

```js
/**
 * Every successful response from /v1 conforms to this shape:
 *
 *   { success: true, data: T, meta?: M, error: null, requestId: string }
 *
 * Error responses (handled in app.js) flip success=false, data=null, populate error.
 */
export function ok(req, data, meta) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    error: null,
    requestId: req.id,
  };
}
```

### 💻 Error Code Registry — `src/utils/errorCodes.js`

```js
/**
 * One source of truth for error codes. The frontend keys off `code`, never `message`.
 * New codes are added here, not invented per-controller.
 */
export const ErrorCodes = Object.freeze({
  // 4xx
  BAD_REQUEST: { status: 400, code: 'BAD_REQUEST', message: 'Bad request' },
  VALIDATION_FAILED: { status: 400, code: 'VALIDATION_FAILED', message: 'Validation failed' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Forbidden' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  CONFLICT: { status: 409, code: 'CONFLICT', message: 'Conflict' },
  PAYLOAD_TOO_LARGE: { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
  UNSUPPORTED_MEDIA: { status: 415, code: 'UNSUPPORTED_MEDIA', message: 'Unsupported media' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
  // 5xx
  INTERNAL: { status: 500, code: 'INTERNAL', message: 'Internal server error' },
  DEPENDENCY_DOWN: { status: 503, code: 'DEPENDENCY_DOWN', message: 'Upstream dependency unavailable' },
});
```

### 💻 Validation Middleware — `src/middleware/validate.middleware.js`

```js
import { ZodError } from 'zod';

import { AppError } from '../utils/AppError.js';

/**
 * zod schema covers any of body/query/params. Mutates `req` to the parsed (typed)
 * values so downstream code uses the cleaned input, not the raw one.
 *
 *   const schema = z.object({
 *     body: z.object({ name: z.string().min(1) }),
 *     query: z.object({ page: z.coerce.number().min(1).default(1) }),
 *   });
 *   router.post('/items', validate(schema), controller.create);
 */
export function validate(schema) {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(AppError.badRequest('Validation failed', 'VALIDATION_FAILED', err.flatten()));
      }
      next(err);
    }
  };
}
```

### 💻 Pagination — `src/utils/pagination.js`

```js
import { z } from 'zod';

/**
 * Two pagination modes:
 *  - offset:  ?page=1&pageSize=20   → simple, breaks on inserts mid-scroll, fine for admin lists
 *  - cursor:  ?cursor=<opaque>      → stable, recommended for high-velocity feeds (orders, messages)
 *
 * Both produce a `meta` block matching the envelope shape:
 *   meta: { page, pageSize, total }                 // offset
 *   meta: { nextCursor, prevCursor, hasMore }       // cursor
 */

export const offsetSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function offsetMeta({ page, pageSize, total }) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { return null; }
}
```

### 💻 File Upload Adapter — `src/utils/uploader.js`

```js
import { Readable } from 'node:stream';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';

import { env } from '../config/index.js';
import { AppError } from './AppError.js';

const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: !!env.S3_ENDPOINT, // for MinIO / R2
  credentials: env.S3_ACCESS_KEY_ID ? {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  } : undefined,
});

/* ---- multer: memory storage, 10 MB cap, image only by default ---- */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.mimetype)) {
      return cb(AppError.badRequest(`Unsupported file type ${file.mimetype}`, 'UNSUPPORTED_MEDIA'));
    }
    cb(null, true);
  },
});

/** Direct put (small files). For >10MB use getPresignedPutUrl below. */
export async function putObject({ key, body, contentType, cacheControl = 'public, max-age=31536000' }) {
  await s3.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body instanceof Readable ? body : body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
  return env.S3_PUBLIC_URL ? `${env.S3_PUBLIC_URL}/${key}` : `s3://${env.S3_BUCKET}/${key}`;
}

/** Browser-direct upload via presigned URL — keeps large files off the API tier. */
export async function getPresignedPutUrl({ key, contentType, expiresInSec = 600 }) {
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}
```

> ⚡ **PERFORMANCE** — For files larger than ~5MB, prefer presigned PUT URLs. Streaming a 50MB image through your API tier blocks an event-loop turn and consumes RAM equal to file size × concurrent uploads. Direct-to-S3 keeps your boxes lean.

### 💻 Exemplar Feature Module — Items

**`src/modules/items/items.repository.js`**

```js
import { prisma } from '../../db/prisma.js';

export const itemsRepo = {
  list({ tenantId, where = {}, take = 20, skip = 0, orderBy = { createdAt: 'desc' } }) {
    return prisma.$transaction([
      prisma.item.findMany({ where: { tenantId, ...where }, take, skip, orderBy }),
      prisma.item.count({ where: { tenantId, ...where } }),
    ]);
  },
  findById(tenantId, id) {
    return prisma.item.findFirst({ where: { id, tenantId } });
  },
  create(data) {
    return prisma.item.create({ data });
  },
  update(tenantId, id, data) {
    return prisma.item.updateMany({ where: { id, tenantId }, data })
      .then(({ count }) => (count === 0 ? null : prisma.item.findUnique({ where: { id } })));
  },
  delete(tenantId, id) {
    return prisma.item.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
  },
};
```

**`src/modules/items/items.service.js`**

```js
import { withCache, bumpVersion } from '../../utils/cache.js';
import { AppError } from '../../utils/AppError.js';
import { itemsRepo } from './items.repository.js';

const CACHE_NS = 'items';

export const itemsService = {
  async list({ tenantId, page, pageSize, search, category, status }) {
    const skip = (page - 1) * pageSize;
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    };
    const cacheKey = `${CACHE_NS}:${tenantId}:${page}:${pageSize}:${search ?? ''}:${category ?? ''}:${status ?? ''}`;

    return withCache({ key: cacheKey, ttlSec: 60 }, async () => {
      const [rows, total] = await itemsRepo.list({ tenantId, where, take: pageSize, skip });
      return { rows, total };
    });
  },

  async create(tenantId, data) {
    const item = await itemsRepo.create({ ...data, tenantId });
    await bumpVersion(`${CACHE_NS}:${tenantId}`);
    return item;
  },

  async update(tenantId, id, data) {
    const updated = await itemsRepo.update(tenantId, id, data);
    if (!updated) throw AppError.notFound('Item not found', 'ITEM_NOT_FOUND');
    await bumpVersion(`${CACHE_NS}:${tenantId}`);
    return updated;
  },

  async delete(tenantId, id) {
    const { count } = await itemsRepo.delete(tenantId, id);
    if (count === 0) throw AppError.notFound('Item not found', 'ITEM_NOT_FOUND');
    await bumpVersion(`${CACHE_NS}:${tenantId}`);
  },
};
```

**`src/modules/items/items.validators.js`**

```js
import { z } from 'zod';

import { offsetSchema } from '../../utils/pagination.js';

export const listSchema = z.object({
  query: offsetSchema.extend({
    search: z.string().max(100).optional(),
    category: z.string().max(50).optional(),
    status: z.enum(['Active', 'Sold out', 'Draft']).optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    category: z.string().min(1).max(50),
    price: z.number().nonnegative().multipleOf(0.01),
    status: z.enum(['Active', 'Sold out', 'Draft']).default('Active'),
    emoji: z.string().max(4).optional(),
    veg: z.boolean().default(true),
    bestseller: z.boolean().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: z.string().min(8) }),
  body: createSchema.shape.body.partial(),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(8) }),
});
```

**`src/modules/items/items.controller.js`**

```js
import { offsetMeta } from '../../utils/pagination.js';
import { ok } from '../../utils/envelope.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { itemsService } from './items.service.js';

export const itemsController = {
  list: asyncHandler(async (req, res) => {
    const { page, pageSize, search, category, status } = req.query;
    const { rows, total } = await itemsService.list({
      tenantId: req.tenantId,
      page, pageSize, search, category, status,
    });
    res.json(ok(req, rows, offsetMeta({ page, pageSize, total })));
  }),

  create: asyncHandler(async (req, res) => {
    const item = await itemsService.create(req.tenantId, req.body);
    res.status(201).json(ok(req, item));
  }),

  update: asyncHandler(async (req, res) => {
    const item = await itemsService.update(req.tenantId, req.params.id, req.body);
    res.json(ok(req, item));
  }),

  remove: asyncHandler(async (req, res) => {
    await itemsService.delete(req.tenantId, req.params.id);
    res.status(204).end();
  }),
};
```

**`src/modules/items/items.routes.js`**

```js
import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { itemsController } from './items.controller.js';
import { listSchema, createSchema, updateSchema, idParamSchema } from './items.validators.js';

export const itemsRouter = Router();

itemsRouter.use(authMiddleware);

itemsRouter.get(  '/',     validate(listSchema),    itemsController.list);
itemsRouter.post( '/',     requireRole('OWNER', 'ADMIN', 'MANAGER'), validate(createSchema), itemsController.create);
itemsRouter.patch('/:id',  requireRole('OWNER', 'ADMIN', 'MANAGER'), validate(updateSchema), itemsController.update);
itemsRouter.delete('/:id', requireRole('OWNER', 'ADMIN'),            validate(idParamSchema), itemsController.remove);
```

### 💻 Router Aggregator — `src/routes.v1.js`

```js
import { Router } from 'express';

import { authRouter } from './modules/auth/auth.routes.js';
import { itemsRouter } from './modules/items/items.routes.js';
// ...as more modules land:
// import { ordersRouter } from './modules/orders/orders.routes.js';
// import { tablesRouter } from './modules/tables/tables.routes.js';

export const v1Router = Router();

v1Router.use('/auth',   authRouter);
v1Router.use('/items',  itemsRouter);
// v1Router.use('/orders', ordersRouter);
// v1Router.use('/tables', tablesRouter);
```

**Mount in `src/app.js`:**

```js
import { v1Router } from './routes.v1.js';
// ...
app.use('/v1', v1Router);
```

### 🗂 API Versioning Strategy

- **URL prefix** — `/v1`, `/v2`. Zero ambiguity, zero header parsing, plays well with CDN caches.
- **Breaking changes** = new version. Non-breaking additions stay in current version.
- **Sunset policy** — old version kept live for ≥ 6 months, with `Sunset` header announcing the deprecation date 90 days out.
- **One router file per version** — `routes.v1.js`, `routes.v2.js`. Modules can be shared between versions; only the routing changes.

### ✅ Phase Completion Checklist
- [ ] zod schema rejects bad payloads with a structured `details` object the frontend can show field-by-field
- [ ] All controllers use `asyncHandler` (no naked async)
- [ ] No controller imports Prisma directly
- [ ] No service touches `req`/`res`
- [ ] Every successful response matches the envelope `{success, data, error:null, requestId}`
- [ ] 404 on a missing item returns the standard error envelope with `code: ITEM_NOT_FOUND`
- [ ] Listing items hits cache on the second call (`X-Cache: HIT`)
- [ ] Updating an item invalidates the cache (`bumpVersion`)
- [ ] Multer rejects a 12 MB upload with 413 + `PAYLOAD_TOO_LARGE`
- [ ] Presigned PUT URL works against MinIO locally

### ⚠️ Common Pitfalls
1. **Returning Prisma rows with `passwordHash` or other secrets.** Always shape the response in the controller (or service); never spread a raw Prisma row.
2. **`z.number()` for prices.** Floats again. Use `z.number().multipleOf(0.01)` *and* store as Decimal — or accept strings and validate with a regex `^-?\d+(\.\d{1,2})?$`.
3. **Mixing pagination styles in one endpoint.** Pick offset OR cursor per route and stick to it. Frontends can't paginate two ways.
4. **No `transaction` for multi-write services.** A `create order + decrement stock` that's two separate awaits leaves your DB inconsistent on partial failure. Always wrap in `prisma.$transaction(async (tx) => {...})`.

---

## Phase 6 — Background Jobs & Queue System

### 📌 Goal
Push every workload that doesn't need to block an HTTP response into a queue: transactional emails, push notifications, scheduled reports, webhook fan-out to Zomato/Swiggy, daily aggregations. Jobs retry with exponential backoff, failures land in a DLQ, progress is observable, and workers run in their own processes so a heavy report can't OOM the API tier.

### 🔗 Dependencies to Install

```bash
npm install bullmq nodemailer
npm install @bull-board/express @bull-board/api
npm install -D @types/nodemailer
```

> **Why BullMQ over Bull v3:** BullMQ is the active fork by the same author. It has cleaner separation between `Queue`, `Worker`, and `QueueScheduler`, native flow support (parent → child jobs), and better TypeScript story. Bull v3 is in maintenance mode.

### ⚙️ Configuration Samples

**Queue topology**

| Queue | Purpose | Concurrency | Retry | Backoff |
|---|---|---|---|---|
| `email` | Transactional + bulk email | 10 | 5 | exponential, base 30s |
| `notification` | Push, SMS, WhatsApp fan-out | 20 | 4 | exponential, base 10s |
| `report` | Sales/CSV exports, monthly aggregates | 2 | 2 | exponential, base 60s |
| `webhook` | Outbound webhooks to integrations | 30 | 6 | exponential, base 5s |
| `dlq` | Dead letter — failed jobs land here for inspection | 1 | 0 | n/a |

### 🗂 File/Folder Changes

```
src/
├─ queues/
│  ├─ index.js                 # registry: getQueue('email')
│  ├─ connection.js            # dedicated ioredis instance for Bull
│  ├─ types.js                 # JSDoc types for job payloads
│  ├─ email.queue.js
│  ├─ notification.queue.js
│  ├─ report.queue.js
│  ├─ webhook.queue.js
│  └─ workers/
│     ├─ index.js              # worker process entry point
│     ├─ email.worker.js
│     ├─ notification.worker.js
│     ├─ report.worker.js
│     └─ webhook.worker.js
├─ modules/
│  └─ email/
│     ├─ email.service.js
│     └─ templates/
│        ├─ welcome.html
│        ├─ password-reset.html
│        └─ order-receipt.html
scripts/
└─ bull-board.js               # admin UI mount
```

### 💻 Bull Connection — `src/queues/connection.js`

```js
import IORedis from 'ioredis';

import { env } from '../config/index.js';

/**
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
 * on its connection — these settings prevent it from going into `wait` mode
 * during a brief network blip. Use a *dedicated* connection, NOT the cache one.
 */
export function buildBullConnection() {
  return new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    keyPrefix: env.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
```

### 💻 Queue Registry — `src/queues/index.js`

```js
import { Queue, QueueEvents } from 'bullmq';

import { logger } from '../config/logger.js';
import { buildBullConnection } from './connection.js';

const queues = new Map();
const eventListeners = new Map();

const QUEUE_DEFINITIONS = {
  email: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 7 * 86_400 },          // keep 7d for inspection
    },
  },
  notification: {
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  report: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 30 * 86_400 },     // reports kept 30d
      removeOnFail: { age: 30 * 86_400 },
    },
  },
  webhook: {
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 14 * 86_400 },
    },
  },
};

export function getQueue(name) {
  if (queues.has(name)) return queues.get(name);
  const def = QUEUE_DEFINITIONS[name];
  if (!def) throw new Error(`Unknown queue: ${name}`);
  const q = new Queue(name, {
    connection: buildBullConnection(),
    defaultJobOptions: def.defaultJobOptions,
  });

  // Observability: subscribe to lifecycle events for metrics + logs
  const events = new QueueEvents(name, { connection: buildBullConnection() });
  events.on('failed', ({ jobId, failedReason }) => {
    logger.error(`queue.${name}.failed`, { jobId, failedReason });
  });
  events.on('stalled', ({ jobId }) => {
    logger.warn(`queue.${name}.stalled`, { jobId });
  });
  eventListeners.set(name, events);

  queues.set(name, q);
  return q;
}

export function listQueueNames() {
  return Object.keys(QUEUE_DEFINITIONS);
}

/** Graceful shutdown — drain in-flight jobs, close connections. */
export async function closeQueues() {
  for (const q of queues.values()) await q.close();
  for (const e of eventListeners.values()) await e.close();
  queues.clear();
  eventListeners.clear();
}
```

### 💻 Job Payload Types — `src/queues/types.js`

```js
/**
 * Canonical job payloads. JSDoc lets the IDE help; for stricter typing, switch
 * to TypeScript or use zod schemas at the queue boundary.
 *
 * @typedef {object} EmailJob
 * @property {string} to
 * @property {string} subject
 * @property {string} template      'welcome' | 'password-reset' | 'order-receipt'
 * @property {object} data           template variables
 * @property {string} [requestId]
 *
 * @typedef {object} NotificationJob
 * @property {'push'|'sms'|'whatsapp'} channel
 * @property {string} userId
 * @property {string} title
 * @property {string} body
 * @property {object} [data]
 *
 * @typedef {object} ReportJob
 * @property {string} tenantId
 * @property {string} branchId
 * @property {string} type           'sales-csv' | 'monthly-pnl' | ...
 * @property {{ from: string, to: string }} range
 * @property {string} requestedBy
 *
 * @typedef {object} WebhookJob
 * @property {string} integrationId
 * @property {string} eventType
 * @property {object} payload
 * @property {string} [signature]
 */
export {};
```

### 💻 Producer Helpers — `src/queues/email.queue.js`

```js
import { getQueue } from './index.js';

/** @param {import('./types.js').EmailJob} job */
export function enqueueEmail(job) {
  return getQueue('email').add('send', job, { jobId: `email:${job.to}:${Date.now()}` });
}

/** Schedule for later. `runAt` is a Date. */
export function scheduleEmail(job, runAt) {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  return getQueue('email').add('send', job, { delay });
}

/** Cron-style recurring (e.g. weekly digest). Pattern is standard cron. */
export function recurringEmail(name, job, cron) {
  return getQueue('email').add('send', job, {
    repeat: { pattern: cron, tz: 'UTC' },
    jobId: `recurring:email:${name}`,
  });
}
```

The other producers (`notification.queue.js`, `report.queue.js`, `webhook.queue.js`) follow the same shape — one `enqueueXxx` helper per queue.

### 💻 Worker Process Entry — `src/queues/workers/index.js`

```js
import 'dotenv/config';

import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { closeQueues } from '../index.js';
import { startEmailWorker } from './email.worker.js';
import { startNotificationWorker } from './notification.worker.js';
import { startReportWorker } from './report.worker.js';
import { startWebhookWorker } from './webhook.worker.js';

logger.info('🚜 Worker process starting', { env: config.env });

const workers = [
  startEmailWorker(),
  startNotificationWorker(),
  startReportWorker(),
  startWebhookWorker(),
];

async function shutdown(signal) {
  logger.info(`Worker received ${signal}, draining…`);
  await Promise.all(workers.map((w) => w.close()));
  await closeQueues();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('worker.unhandledRejection', { reason: reason instanceof Error ? reason.stack : reason });
});
```

### 💻 Worker Implementation — `src/queues/workers/email.worker.js`

```js
import { Worker } from 'bullmq';

import { logger } from '../../config/logger.js';
import { emailService } from '../../modules/email/email.service.js';
import { buildBullConnection } from '../connection.js';

export function startEmailWorker() {
  const w = new Worker(
    'email',
    async (job) => {
      logger.info('email.send.start', { jobId: job.id, to: job.data.to });
      await job.updateProgress(10);

      const result = await emailService.send({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template,
        data: job.data.data,
      });

      await job.updateProgress(100);
      logger.info('email.send.ok', { jobId: job.id, messageId: result.messageId });
      return { messageId: result.messageId };
    },
    {
      connection: buildBullConnection(),
      concurrency: 10,
      limiter: { max: 100, duration: 1000 }, // 100 sends/sec to avoid SMTP throttle
    },
  );

  w.on('failed', (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('email.send.failed', {
      jobId: job.id, err: err.message, attempt: job.attemptsMade, final: finalAttempt,
    });
    if (finalAttempt) {
      // Final failure: surface to DLQ for human inspection
      // (jobs naturally land in the failed queue; the DLQ pattern is just a separate inspection queue)
    }
  });

  w.on('error', (err) => logger.error('email.worker.error', { err: err.message }));
  return w;
}
```

The other workers follow the same shape — one `start<Name>Worker` per queue.

### 💻 Email Service — `src/modules/email/email.service.js`

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nodemailer from 'nodemailer';

import { env } from '../../config/index.js';
import { logger } from '../../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

const templateCache = new Map();

async function renderTemplate(name, data) {
  if (!templateCache.has(name)) {
    const file = path.join(__dirname, 'templates', `${name}.html`);
    templateCache.set(name, await readFile(file, 'utf8'));
  }
  let html = templateCache.get(name);
  // dead-simple {{var}} interpolation. Swap to handlebars/ejs if you need conditionals.
  for (const [k, v] of Object.entries(data ?? {})) {
    html = html.replaceAll(`{{${k}}}`, String(v ?? ''));
  }
  return html;
}

export const emailService = {
  async send({ to, subject, template, data }) {
    if (!env.SMTP_HOST) {
      logger.warn('email.skipped', { reason: 'SMTP not configured', to, subject });
      return { messageId: 'noop' };
    }
    const html = await renderTemplate(template, data);
    const result = await transporter.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { messageId: result.messageId };
  },

  async verifyConnection() {
    if (!env.SMTP_HOST) return false;
    return transporter.verify();
  },
};
```

### 💻 Bull Board (queue admin UI) — `scripts/bull-board.js`

```js
import 'dotenv/config';

import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

import { authMiddleware } from '../src/middleware/auth.middleware.js';
import { requireRole } from '../src/middleware/rbac.middleware.js';
import { getQueue, listQueueNames } from '../src/queues/index.js';

const app = express();
const adapter = new ExpressAdapter();
adapter.setBasePath('/admin/queues');

createBullBoard({
  queues: listQueueNames().map((name) => new BullMQAdapter(getQueue(name))),
  serverAdapter: adapter,
});

// 🔒 SECURITY — never expose without auth.
app.use('/admin/queues', authMiddleware, requireRole('SUPER_ADMIN', 'OWNER'), adapter.getRouter());

app.listen(4001, () => {
  // eslint-disable-next-line no-console
  console.log('Bull Board: http://localhost:4001/admin/queues');
});
```

> 🔒 **SECURITY** — Bull Board exposes job payloads. Never mount it under your public API and never without the role gate. In prod, run it on its own port behind VPN or restrict via Nginx `allow`/`deny`.

### 🧠 Dead Letter Queue Pattern

BullMQ already keeps failed jobs in a `failed` set per queue. The "DLQ" pattern adds a *separate* queue for jobs that exhausted all retries, with a worker that just logs+alerts:

```js
// In each worker's `failed` handler:
w.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await getQueue('dlq').add('failed', {
      originalQueue: job.queueName,
      jobName: job.name,
      data: job.data,
      reason: err.message,
      stack: err.stack,
      finalAttempt: job.attemptsMade,
      timestamp: new Date().toISOString(),
    }, { attempts: 1 });
  }
});
```

A DLQ worker can fan out to PagerDuty / Slack / a manual review UI.

### 🕐 Scheduled Jobs

```js
// Daily 3am UTC: aggregate yesterday's sales per branch
recurringEmail('daily-sales-digest',
  { to: 'noc@vuedine.com', subject: 'Daily Sales Digest', template: 'daily-digest', data: {} },
  '0 3 * * *',
);
```

> ⚠️ **Recurring jobs are global, not per-instance.** BullMQ deduplicates them by `jobId`. But if multiple processes call `add` with `repeat`, only one schedule survives. Run scheduling once on app boot, gate with a flag like `if (process.env.WORKER_PRIMARY === 'true')` to be explicit.

### ✅ Phase Completion Checklist
- [ ] `npm run start:worker` boots an independent worker process
- [ ] `enqueueEmail({...})` pushes a job; worker picks it up and sends via SMTP (or logs noop if SMTP unset)
- [ ] Killing a worker mid-job recovers: BullMQ re-runs the job (idempotency in services is mandatory)
- [ ] Failed job retries with exponential backoff visible in Bull Board
- [ ] Final-attempt failure lands in `dlq` queue with full context
- [ ] Bull Board accessible on port 4001, requires `OWNER`/`SUPER_ADMIN` token
- [ ] Recurring job (cron `0 3 * * *`) shows once in the `repeatable` jobs list
- [ ] `closeQueues()` runs in graceful shutdown — no orphan connections
- [ ] Worker uses **separate** Redis connection from cache/RL clients

### ⚠️ Common Pitfalls
1. **Sharing the cache Redis client with BullMQ.** BullMQ requires `maxRetriesPerRequest: null` to behave correctly under load; the cache client should not. They must be separate clients.
2. **Non-idempotent jobs.** A job can run twice (worker crash before ack). Every job handler must tolerate replay — e.g., dedupe by `email_message_id`, use upserts not inserts, check "already processed" markers.
3. **Long-running jobs without `updateProgress`.** Stalled detection kicks in after 30s of silence; without progress updates, BullMQ retries the job — even though it's still running. Either call `job.updateProgress` regularly or extend `lockDuration`.
4. **Mixing app + worker in one process.** Fine in dev; in prod, deploy them as separate replicas. A 500MB CSV export shouldn't take down your auth API. PM2 ecosystem in Phase 8 splits them.

---

## Phase 7 — Logging, Monitoring & Observability

### 📌 Goal
Replace the bootstrap logger from Phase 1 with production-grade structured logging, wire Prometheus metrics for the RED method (Rate · Errors · Duration), set up daily log rotation, expose a secured `/metrics` endpoint, and stub Sentry + OpenTelemetry so the team can plug them in without rewrites.

**The RED method** is the right starting point for HTTP services:
- **R**ate — requests per second
- **E**rrors — % of requests failing
- **D**uration — request latency distribution (p50, p95, p99)

### 🔗 Dependencies to Install

```bash
npm install winston winston-daily-rotate-file prom-client
npm install @sentry/node @sentry/profiling-node
# OpenTelemetry stub:
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http
```

### 🗂 File/Folder Changes

```
src/
├─ config/
│  └─ logger.js                # full winston version (replaces bootstrap)
├─ observability/
│  ├─ metrics.js               # prom-client registry + custom metrics
│  ├─ tracing.js               # OpenTelemetry stub
│  └─ sentry.js
├─ middleware/
│  ├─ metrics.middleware.js
│  └─ logger.middleware.js
docker/
├─ prometheus/
│  ├─ prometheus.yml
│  └─ alerts.yml
└─ grafana/
   ├─ provisioning/
   │  ├─ datasources/datasource.yml
   │  └─ dashboards/dashboard.yml
   └─ dashboards/
      └─ vuedine-overview.json
```

### 💻 Production Logger — `src/config/logger.js`

```js
import path from 'node:path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { env } from './env.js';

const isProd = env.NODE_ENV === 'production';

/* ---- formatters ---- */

const baseFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.splat(),
);

const jsonFormat = winston.format.combine(
  baseFormat,
  winston.format((info) => ({
    ...info,
    service: env.APP_NAME,
    version: env.APP_VERSION,
    env: env.NODE_ENV,
  }))(),
  winston.format.json(),
);

const prettyFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, ...rest } = info;
    const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    const id = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    return `${timestamp} ${level}${id} ${message}${meta}`;
  }),
);

/* ---- transports ---- */

const transports = [
  new winston.transports.Console({
    format: isProd ? jsonFormat : prettyFormat,
    handleExceptions: true,
    handleRejections: false,
  }),
];

if (isProd) {
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat,
    }),
  );
}

/* ---- logger instance ---- */

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  defaultMeta: { service: env.APP_NAME },
  transports,
  exitOnError: false,
});

/** Child logger with bound request context — used in middleware. */
export function withContext(meta) {
  return logger.child(meta);
}
```

### 💻 Logger Middleware — `src/middleware/logger.middleware.js`

```js
import { logger } from '../config/logger.js';

/**
 * Attach a request-scoped logger to `req.log` so every line within the request
 * carries the same correlation id.
 *
 *   req.log.info('order.created', { orderId });
 */
export function attachLogger(req, _res, next) {
  req.log = logger.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    ...(req.user ? { userId: req.user.id, tenantId: req.user.tenantId } : {}),
  });
  next();
}
```

Mount in `app.js` after `requestId` middleware:

```js
import { attachLogger } from './middleware/logger.middleware.js';
// ...
app.use(requestId);
app.use(attachLogger);
```

### 💻 Metrics — `src/observability/metrics.js`

```js
import * as client from 'prom-client';

import { env } from '../config/index.js';

export const registry = new client.Registry();
registry.setDefaultLabels({ service: env.APP_NAME, env: env.NODE_ENV });

// Default Node.js process metrics (event loop lag, GC, heap, etc.)
client.collectDefaultMetrics({ register: registry, prefix: 'node_' });

/* ---------- Custom metrics ---------- */

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Prisma query duration in seconds',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Cache hits',
  labelNames: ['namespace'],
  registers: [registry],
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Cache misses',
  labelNames: ['namespace'],
  registers: [registry],
});

export const queueDepth = new client.Gauge({
  name: 'queue_depth',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueJobsTotal = new client.Counter({
  name: 'queue_jobs_total',
  help: 'Queue job outcomes',
  labelNames: ['queue', 'status'],   // status: completed | failed | stalled
  registers: [registry],
});

export const authEventsTotal = new client.Counter({
  name: 'auth_events_total',
  help: 'Auth events',
  labelNames: ['action', 'outcome'], // login | refresh | reuse_detected ...
  registers: [registry],
});

/* Helper to update queue depth periodically — called from a 5s interval in app boot */
import { getQueue, listQueueNames } from '../queues/index.js';
export async function refreshQueueDepth() {
  for (const name of listQueueNames()) {
    const counts = await getQueue(name).getJobCounts('waiting', 'active', 'delayed');
    queueDepth.labels(name).set(counts.waiting + counts.active + counts.delayed);
  }
}
```

### 💻 Metrics Middleware — `src/middleware/metrics.middleware.js`

```js
import { httpRequestsTotal, httpRequestDuration } from '../observability/metrics.js';

/**
 * Records request count + duration. Uses `route.path` (the matched route pattern)
 * not `req.path` — `/items/:id` instead of `/items/abc123` — so metrics don't
 * have a label per id (cardinality explosion).
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path ?? req.baseUrl + (req.route?.path ?? '') ?? 'unknown';
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, seconds);
  });
  next();
}
```

### 💻 Metrics Endpoint — secured

In `src/app.js`:

```js
import { registry, refreshQueueDepth } from './observability/metrics.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { env } from './config/index.js';

app.use(metricsMiddleware);

if (env.PROMETHEUS_ENABLED) {
  app.get('/metrics', async (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (env.METRICS_AUTH_TOKEN && token !== env.METRICS_AUTH_TOKEN) {
      return next(AppError.unauthorized('Bad metrics token', 'BAD_METRICS_TOKEN'));
    }
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  setInterval(() => { refreshQueueDepth().catch(() => {}); }, 5_000).unref();
}
```

> 🔒 **SECURITY** — Always gate `/metrics`. Public exposure leaks request paths, error rates, and queue contents — perfect intel for an attacker. Either Bearer token (above), source IP allowlist in Nginx, or both.

### ⚙️ Prometheus Config — `docker/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: vuedine
    env: production

rule_files:
  - /etc/prometheus/alerts.yml

scrape_configs:
  - job_name: vuedine-api
    metrics_path: /metrics
    bearer_token: "${METRICS_AUTH_TOKEN}"
    static_configs:
      - targets: ["api:4000"]
        labels: { component: api }
  - job_name: vuedine-worker
    metrics_path: /metrics
    bearer_token: "${METRICS_AUTH_TOKEN}"
    static_configs:
      - targets: ["worker:4000"]
        labels: { component: worker }

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
```

### ⚙️ Alert Rules — `docker/prometheus/alerts.yml`

```yaml
groups:
  - name: vuedine-api
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          (sum(rate(http_requests_total{status_code=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))) > 0.02
        for: 5m
        labels: { severity: critical }
        annotations:
          summary: "API error rate above 2%"
          description: "{{ $value | humanizePercentage }} of requests are 5xx for the past 5 minutes."

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 1
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "p99 latency > 1s on {{ $labels.route }}"

      - alert: QueueBacklog
        expr: queue_depth > 1000
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Queue {{ $labels.queue }} backlog: {{ $value }} jobs"

      - alert: EventLoopLag
        expr: nodejs_eventloop_lag_seconds{quantile="0.99"} > 0.1
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Node event loop lag > 100ms p99"
```

### ⚙️ Grafana Datasource — `docker/grafana/provisioning/datasources/datasource.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### 📊 Grafana Dashboard Setup Guide

1. Bring up the stack with `docker compose up prometheus grafana`.
2. Open `http://localhost:3000` (default admin / admin).
3. Datasource is auto-provisioned; verify under **Connections → Prometheus**.
4. Import the starter dashboard `docker/grafana/dashboards/vuedine-overview.json` (provided in repo) or build from these queries:

   | Panel | PromQL |
   |---|---|
   | Requests / sec | `sum(rate(http_requests_total[1m])) by (route)` |
   | Error rate | `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
   | p50 / p95 / p99 latency | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` |
   | Queue depth | `queue_depth` |
   | Cache hit ratio | `sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))` |
   | Event loop lag | `nodejs_eventloop_lag_seconds{quantile="0.99"}` |

### 💻 Sentry Stub — `src/observability/sentry.js`

```js
import * as Sentry from '@sentry/node';

import { env } from '../config/index.js';

export function initSentry() {
  if (!env.SENTRY_DSN) return null;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: `${env.APP_NAME}@${env.APP_VERSION}`,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  });
  return Sentry;
}

export { Sentry };
```

In `app.js` after error middleware (must come *before* `app.use(errorMw)`):

```js
import { initSentry, Sentry } from './observability/sentry.js';
const sentry = initSentry();
if (sentry) sentry.setupExpressErrorHandler(app);
```

### 💻 OpenTelemetry Stub — `src/observability/tracing.js`

```js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

import { env } from '../config/index.js';

/**
 * Distributed tracing — disabled by default. Enable by setting OTEL_EXPORTER_OTLP_ENDPOINT.
 * Must be initialized BEFORE any other module imports (so call this from server.js first line).
 */
export function initTracing() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return null;
  const sdk = new NodeSDK({
    serviceName: env.APP_NAME,
    traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // noisy
    })],
  });
  sdk.start();
  return sdk;
}
```

### ✅ Phase Completion Checklist
- [ ] `logger.info('hello', { foo: 1 })` outputs JSON in prod, pretty colors in dev
- [ ] Every log line in a request includes the same `requestId`
- [ ] `logs/app-YYYY-MM-DD.log` rotates daily, gzipped after rollover
- [ ] `curl -H "Authorization: Bearer $METRICS_AUTH_TOKEN" /metrics` returns Prometheus exposition
- [ ] `/metrics` rejects requests without the token
- [ ] `node_eventloop_lag_seconds`, `http_requests_total`, `http_request_duration_seconds_bucket` visible
- [ ] Grafana dashboard renders RED metrics
- [ ] Triggering a 5xx error increments `http_requests_total{status_code="500"}`
- [ ] `queue_depth` updates every 5s
- [ ] Alert `HighErrorRate` fires when error rate > 2% for 5 min (test in staging)
- [ ] Sentry receives unhandled errors when `SENTRY_DSN` is set

### ⚠️ Common Pitfalls
1. **High-cardinality labels.** Putting `userId`, `orderId`, or full URL paths into Prometheus labels explodes memory. Always use the *route pattern* (`/items/:id`), not the URL. Aim for < 1000 unique label combinations per metric.
2. **Logging credentials by accident.** A `req.body` dump on bad-request includes passwords. Always **denylist** sensitive fields before logging — pass `{...req.body, password: '[REDACTED]'}` or use a custom winston format that scrubs known keys.
3. **Forgetting to `unref()` the metrics interval.** Otherwise it keeps the event loop alive and prevents graceful shutdown.
4. **Sentry initialized after Express imports.** Some integrations need to monkey-patch modules — Sentry must be initialized first thing in `server.js`.

---

## Phase 8 — Scalability & Performance Hardening

### 📌 Goal
Take the single-process app and make it horizontally scalable: PM2 cluster mode, Nginx reverse proxy with rate limiting + SSL termination + WebSocket support, PgBouncer for connection pooling at scale, a stateless-server checklist, and a documented caching matrix. After this phase, scaling to 100k req/min is a knob, not a rewrite.

### 🔗 Dependencies to Install

```bash
npm install -D pm2
npm install socket.io @socket.io/redis-adapter
```

### 🧠 Stateless Server Checklist

A server is "stateless" when killing any single instance and replacing it with a fresh one is a no-op for the user. Verify each item:

- [ ] No in-memory user sessions — refresh tokens live in Postgres, access in JWT
- [ ] No in-memory rate limiters — sliding window in Redis (Phase 3)
- [ ] No local file uploads — direct-to-S3 via presigned URLs (Phase 5)
- [ ] No `setInterval` doing work that should be a queue — all moved to BullMQ (Phase 6)
- [ ] No in-process caches that affect correctness — only opportunistic per-instance caches are fine (memoization)
- [ ] No "primary instance" assumptions — every instance is identical, scheduled jobs gated by a leader-election lock or a dedicated worker pod
- [ ] WebSockets pubsub-bridged via Redis (below) — no sticky sessions required

### 💻 PM2 Ecosystem — `ecosystem.config.js`

```js
/**
 * PM2 ecosystem.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 reload api    # zero-downtime
 *   pm2 monit         # live dashboard
 *
 * In production we use `pm2-runtime` inside the container so PM2 is PID 1
 * and forwards signals correctly.
 */
export default {
  apps: [
    {
      name: 'api',
      script: 'src/server.js',
      exec_mode: 'cluster',
      instances: process.env.PM2_INSTANCES || 'max', // -1 leaves 1 core for system; 'max' uses all
      max_memory_restart: '512M',
      kill_timeout: 26_000,                          // > server.js SHUTDOWN_TIMEOUT_MS
      wait_ready: true,                              // wait for process.send('ready')
      listen_timeout: 10_000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4_000,
      env_production: { NODE_ENV: 'production' },
      env_staging: { NODE_ENV: 'staging' },
      // Each app instance writes to PM2's combined log; container stdout is what matters.
      out_file: '/dev/null',
      error_file: '/dev/null',
      merge_logs: true,
    },
    {
      name: 'worker',
      script: 'src/queues/workers/index.js',
      exec_mode: 'fork',                             // workers are typically fork mode (no port binding)
      instances: process.env.PM2_WORKER_INSTANCES || 2,
      max_memory_restart: '768M',
      kill_timeout: 30_000,
      autorestart: true,
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
```

In `src/server.js`, signal PM2 once HTTP is bound so `wait_ready` works:

```js
server.listen(config.port, () => {
  logger.info(`🚀 listening`, { port: config.port });
  if (process.send) process.send('ready');
});
```

> ⚡ **PERFORMANCE** — `cluster` mode uses Node's built-in cluster module; PM2 round-robins across workers. With 4 cores, you get ~4× throughput on CPU-bound work. For I/O-bound (most of our routes), gains are smaller but still 1.5–2×.

### ⚙️ Nginx Configuration — `docker/nginx/default.conf`

```nginx
# ------------- Upstream -------------
upstream vuedine_api {
    least_conn;                          # send to least-loaded backend
    server api:4000 max_fails=3 fail_timeout=10s;
    keepalive 32;                        # reuse upstream connections
}

# ------------- Rate limiting at edge -------------
# Two zones: gentle for general traffic, harsh for auth.
limit_req_zone $binary_remote_addr zone=general:10m rate=300r/m;
limit_req_zone $binary_remote_addr zone=auth:10m    rate=10r/m;

# ------------- HTTP -> HTTPS redirect -------------
server {
    listen 80;
    server_name api.vuedine.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }   # certbot
    location / { return 301 https://$host$request_uri; }
}

# ------------- HTTPS server -------------
server {
    listen 443 ssl http2;
    server_name api.vuedine.com;

    # ----- SSL -----
    ssl_certificate     /etc/letsencrypt/live/api.vuedine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vuedine.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # ----- Security headers (helmet covers more, this is defense-in-depth) -----
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ----- Body size limit (multer enforces a finer one upstream) -----
    client_max_body_size 12m;
    client_body_timeout 30s;
    keepalive_timeout 65;

    # ----- Compression -----
    gzip on;
    gzip_vary on;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript application/xml+rss text/xml application/octet-stream;

    # ----- Block /metrics from the public internet -----
    location /metrics {
        deny all;
        return 403;
    }

    # ----- Auth routes: harsher rate limit -----
    location ~ ^/v1/auth/(login|password) {
        limit_req zone=auth burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://vuedine_api;
        include /etc/nginx/proxy_params.conf;
    }

    # ----- WebSocket route -----
    location /ws/ {
        proxy_pass http://vuedine_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # ----- General API -----
    location / {
        limit_req zone=general burst=50 nodelay;
        limit_req_status 429;
        proxy_pass http://vuedine_api;
        include /etc/nginx/proxy_params.conf;
    }
}
```

**`docker/nginx/proxy_params.conf`** (shared)

```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-Id $request_id;
proxy_read_timeout 60s;
proxy_send_timeout 60s;
proxy_connect_timeout 5s;
```

### 💻 WebSocket Gateway — `src/realtime/socket.js`

This replaces the frontend's `liveOrders` localStorage bus with proper realtime.

```js
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';
import { tokens } from '../modules/auth/tokens.js';

/**
 * Socket.io with Redis adapter so any pod can publish to any client.
 * Authentication via JWT on the connection handshake.
 */
export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    path: '/ws',
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    transports: ['websocket'],   // no long-poll fallback in prod
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // ----- Redis pub/sub adapter -----
  const pubClient = new IORedis(env.REDIS_URL, { password: env.REDIS_PASSWORD || undefined });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // ----- Auth middleware -----
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        ?? socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('No token'));
      const payload = tokens.verifyAccess(token);
      socket.data.user = {
        id: payload.sub,
        tenantId: payload.tid,
        role: payload.role,
        branchIds: payload.branchIds ?? [],
      };
      next();
    } catch {
      next(new Error('Bad token'));
    }
  });

  // ----- Connection handling -----
  io.on('connection', (socket) => {
    const { tenantId, branchIds, id: userId } = socket.data.user;
    logger.info('ws.connect', { userId, tenantId });

    // Auto-join tenant-scoped + branch-scoped rooms
    if (tenantId) socket.join(`tenant:${tenantId}`);
    for (const branchId of branchIds) socket.join(`branch:${branchId}`);

    socket.on('disconnect', (reason) => {
      logger.info('ws.disconnect', { userId, reason });
    });
  });

  return io;
}

/**
 * Emit a live order event to all dashboards watching this branch.
 * Called from the orders service when a QR order is placed.
 */
let _io = null;
export function setIo(io) { _io = io; }
export function emitLiveOrder(branchId, event, payload) {
  if (!_io) return;
  _io.to(`branch:${branchId}`).emit(`liveOrder:${event}`, payload);
}
```

In `src/server.js`, attach socket.io to the same HTTP server:

```js
import { attachSocket, setIo } from './realtime/socket.js';
const io = attachSocket(server);
setIo(io);
```

### 🐘 PgBouncer Setup

Once you're running > 10 app instances, direct connections from each pod overwhelm Postgres. PgBouncer multiplexes thousands of client connections onto a small pool of real Postgres connections.

**`docker-compose.prod.yml` snippet:**

```yaml
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: vuedine
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: vuedine
      POOL_MODE: transaction               # safe for Prisma; avoid `session` for prepared statements
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 25
      RESERVE_POOL_SIZE: 5
      SERVER_RESET_QUERY: DISCARD ALL
      SERVER_IDLE_TIMEOUT: 600
    ports:
      - "6432:5432"
    depends_on:
      postgres: { condition: service_healthy }
```

**App connection string change:**

```bash
DATABASE_URL=postgresql://vuedine:***@pgbouncer:5432/vuedine?pgbouncer=true&connection_limit=10
```

The `pgbouncer=true` flag tells Prisma to disable prepared statements (incompatible with transaction-mode pooling).

> ⚡ **PERFORMANCE** — Sizing rule of thumb:
> - **DEFAULT_POOL_SIZE** ≈ `(num_cpu_cores * 2) + effective_spindle_count` per Postgres instance. Most cloud Postgres = 25–50.
> - **MAX_CLIENT_CONN** = however many app connections you want to absorb. 1000 is a sane ceiling.
> - Apps point `connection_limit` at PgBouncer's pool size, not at Postgres directly.

### 📋 Caching Strategy Matrix

| Data | TTL | Invalidation | Rationale |
|---|---|---|---|
| Menu items list (per tenant) | 5 min | Bump on create/update/delete | Hot read, low write — front-end hits this every navigation |
| Tenant config (taxes, currency) | 1 hour | Explicit on settings save | Read on every order; almost never changes |
| Branch metadata | 1 hour | Explicit on update | Same |
| User permissions / role | 5 min | Bump on role change | Acceptable lag for permission revocation; force-revoke via Redis denylist for instant kicks |
| Live order list | **don't cache** | n/a | Realtime; uses pub/sub instead |
| Sales reports (last 30d) | 10 min | Bump on day rollover | Slow to compute, worth caching |
| Subscription plans | 1 day | Manual | Marketing-tier data, rarely changes |
| Search results | 60s | Implicit (TTL) | Fuzzy search is expensive; small staleness OK |
| Receipts / order details | **don't cache** | n/a | Per-order, single read, no benefit |

> 🔒 **SECURITY** — Cache key MUST include `tenantId` (and `userId` for personalized data). The single biggest cache bug class is leaking tenant A's data to tenant B.

### 🩺 Database Indexing Audit Checklist

Run this monthly in staging against a prod-mirrored dataset:

- [ ] `EXPLAIN ANALYZE` every endpoint serving > 1k req/day on representative payloads
- [ ] No `Seq Scan` on tables with > 10k rows
- [ ] Composite indexes ordered most-selective-first (`tenantId, status, createdAt`)
- [ ] Partial indexes for `WHERE deletedAt IS NULL` patterns
- [ ] Reports queries run against the **read replica**, not primary
- [ ] Slow query log (`log_min_duration_statement=200`) reviewed weekly
- [ ] `pg_stat_statements` extension enabled, top 20 queries by `mean_exec_time` reviewed
- [ ] Indexes that haven't been hit in 30 days (`pg_stat_user_indexes` with `idx_scan = 0`) are dropped — they cost write performance
- [ ] BRIN indexes considered for time-series tables (`audit_logs`, `transactions`)

### 🧠 EXPLAIN ANALYZE Workflow

```sql
-- 1. Capture the query Prisma generated (slow query log or pg_stat_statements)
-- 2. Run with timing + buffers
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM items
WHERE tenant_id = $1 AND status = 'Active'
ORDER BY created_at DESC LIMIT 20;

-- 3. Look for:
--    - "Seq Scan" on big tables   → add index
--    - "Sort"  with "Memory: ..." → add ORDER BY-friendly index
--    - "Rows Removed by Filter"   → index doesn't cover predicate
-- 4. Add index in a migration:
CREATE INDEX CONCURRENTLY idx_items_tenant_status_created
  ON items (tenant_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- 5. Re-run EXPLAIN ANALYZE and compare cost
```

> 🔴 **PRODUCTION CRITICAL** — Always use `CREATE INDEX CONCURRENTLY` on prod. Plain `CREATE INDEX` takes an `ACCESS EXCLUSIVE` lock, blocking all reads + writes on the table.

### 🌍 Read Replica Strategy

```js
// src/modules/reports/reports.repository.js
import { getReadClient } from '../../db/prismaReplica.js';

export const reportsRepo = {
  async dailySales(tenantId, branchId, from, to) {
    const replica = getReadClient();
    return replica.$queryRaw`
      SELECT date_trunc('day', created_at) AS day,
             SUM(total) AS revenue,
             COUNT(*)   AS orders
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND branch_id = ${branchId}
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1`;
  },
};
```

Reads from replica are eventually consistent (typical lag: < 100ms). Reports tolerate this; live operational pages should not use the replica.

### ✅ Phase Completion Checklist
- [ ] `pm2 start ecosystem.config.js` brings up `instances=max` of api + 2 workers
- [ ] `pm2 reload api` does zero-downtime restart (verify with continuous `curl` loop)
- [ ] Nginx serves the API on port 443 with valid Let's Encrypt cert
- [ ] WebSocket connection upgrades through Nginx without `502`
- [ ] Auth zone rate-limits at 10 req/min per IP at the edge
- [ ] PgBouncer container healthy, app connects via `pgbouncer:5432`
- [ ] `prisma.$queryRaw\`SELECT 1\`` works through PgBouncer
- [ ] Read replica returns data when `DATABASE_REPLICA_URL` is set
- [ ] Caching matrix documented in repo `README.md`
- [ ] EXPLAIN ANALYZE workflow run on top 5 endpoints, indexes added as needed

### ⚠️ Common Pitfalls
1. **PM2 cluster + in-memory Socket.io.** Without the Redis adapter, a client connected to instance A doesn't see events emitted on instance B. Always use `@socket.io/redis-adapter`.
2. **PgBouncer in `session` mode with Prisma.** Breaks subtly: prepared statements work some of the time. Use `transaction` mode and pass `?pgbouncer=true` to Prisma.
3. **Cluster mode with `node-cron`/in-process schedulers.** Each worker fires the cron — your "daily 3am report" runs N times. Move scheduling to BullMQ repeatable jobs (Phase 6) or designate one leader instance.
4. **Trusting `X-Forwarded-For` blindly.** With Nginx in front, `app.set('trust proxy', 1)` is correct. With *two* layers (CDN → Nginx → API), it's `2`. Setting `true` accepts spoofed IPs from any client.
5. **Over-indexing.** Every index slows down writes. Audit unused indexes monthly via `pg_stat_user_indexes`.

---

## Phase 9 — Security Hardening

### 📌 Goal
Walk the OWASP Top 10 with a concrete control for each item, lock down dependency supply chain, encrypt sensitive fields at rest, manage API keys properly, and verify every public endpoint is rate-limited. Security is a phase but also a forever-job — this is the floor, not the ceiling.

### 🔗 Dependencies to Install

```bash
npm install xss-clean express-mongo-sanitize hpp express-validator
npm install -D snyk audit-ci
```

### 🛡 OWASP Top 10 (2021) — Mitigation Map

| # | Risk | Where it's mitigated | Status |
|---|---|---|---|
| A01 | Broken Access Control | `requireRole`, `requireBranchAccess`, tenant-scoped queries (Phase 4-5) | ✅ |
| A02 | Cryptographic Failures | bcrypt cost 12, SHA-256 hashed refresh tokens, TLS 1.2+ at Nginx, encrypted-at-rest fields below | ✅ |
| A03 | Injection (SQL/NoSQL/LDAP) | Prisma parameterized queries, zod validation, `express-mongo-sanitize` | ✅ |
| A04 | Insecure Design | Threat modeling per feature, defense in depth (helmet + CSP + Nginx) | 🔄 ongoing |
| A05 | Security Misconfiguration | helmet, CORS whitelist, hidden `x-powered-by`, secured `/metrics` & `/queues`, audit-ci in CI | ✅ |
| A06 | Vulnerable Components | `npm audit` + Snyk gate in CI (`audit-ci`), Renovate bot for auto-PRs | ✅ |
| A07 | Identification & Auth Failures | Rotation, reuse detection, lockout, password reset TTL, force-revoke (Phase 4) | ✅ |
| A08 | Software & Data Integrity | Signed Docker images, locked `package-lock.json`, integrity checks in CI | ✅ |
| A09 | Logging & Monitoring Failures | winston structured logs, audit log table, Prometheus alerts (Phase 7) | ✅ |
| A10 | SSRF | Outbound URL allowlist on integration webhooks, no user-supplied URL fetches without DNS rebinding protection | ⚠️ requires care per integration |

### 💻 Hardening Middleware Bundle — `src/middleware/security.middleware.js`

```js
import hpp from 'hpp';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

/**
 * Bundle of cheap-but-effective hardening middleware. Mount AFTER body parsers
 * but BEFORE route handlers in app.js.
 */
export function applySecurityHardening(app) {
  // Strip $-prefixed keys (NoSQL injection vectors leaking through JSON) — safe for our SQL stack too.
  app.use(mongoSanitize({ replaceWith: '_' }));

  // Naive XSS filter on req.body. NOT a substitute for output encoding;
  // it's defense in depth. Real XSS prevention happens in CSP + JSON-only responses.
  app.use(xss());

  // Block HTTP Parameter Pollution (?role=admin&role=user)
  app.use(hpp({ whitelist: ['tag', 'ids'] }));   // allow array params we genuinely accept
}
```

### 🔒 SQL Injection — confirmed prevented

Every database call goes through Prisma. Prisma uses parameterized queries internally — there's no concatenation. The two escape hatches are:

```js
// ❌ NEVER — string interpolation in $queryRawUnsafe
prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ ALWAYS — tagged template parameterization
prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
```

ESLint rule to enforce:

```js
// .eslintrc.cjs
rules: {
  'no-restricted-properties': ['error', {
    object: 'prisma',
    property: '$queryRawUnsafe',
    message: 'Use $queryRaw with template literals — $queryRawUnsafe risks SQL injection.',
  }],
}
```

### 🔒 XSS Prevention

API is JSON-only. The frontend handles output encoding in React (which auto-escapes by default). Belt-and-braces:

1. **CSP via helmet** in production — set in `app.js`:

```js
app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://cdn.vuedine.com'],
    connectSrc: ["'self'", 'https://api.vuedine.com'],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));
```

2. **`Content-Type: application/json`** enforced — never serve HTML from the API.
3. **`X-Content-Type-Options: nosniff`** (helmet does this) — browser won't sniff a JSON response as HTML.

### 🔒 CSRF Protection

JWT in `Authorization` header is **not** vulnerable to CSRF (browsers don't auto-attach Authorization headers on cross-site requests). The vulnerability surface is the **refresh token cookie**.

Mitigations applied:
1. `SameSite=Lax` (Phase 4) blocks cross-site form-post CSRF attempts
2. Refresh cookie scoped to `/v1/auth` path — never sent to other routes
3. Origin check on `/v1/auth/refresh`:

```js
// Add to refresh route
authRouter.use('/refresh', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    return next(AppError.forbidden('Bad origin', 'CSRF_BAD_ORIGIN'));
  }
  next();
});
```

If you ever introduce form-based flows or cookie-auth API endpoints, add `csurf` (or its successor — `csurf` itself is deprecated; consider rolling double-submit cookies manually).

### 🔒 Dependency Supply Chain

**`audit-ci.json`**

```json
{
  "moderate": true,
  "report-type": "important",
  "skip-dev": false,
  "allowlist": []
}
```

CI step (Phase 12 wires this in):

```yaml
- name: Audit dependencies
  run: npx audit-ci --config audit-ci.json
```

`package-lock.json` MUST be committed. CI uses `npm ci` (not `npm install`) to install from the lockfile exactly.

### 🔒 Secrets — Vault-Ready Bootstrap

```js
// src/config/secrets.js
import { logger } from './logger.js';

/**
 * Production secrets are pulled from HashiCorp Vault (or AWS Secrets Manager).
 * In dev, fall back to .env. The contract is the same: a function that returns
 * the secret value given a key.
 *
 * Wire this in `env.js` like:
 *   const dbPassword = await secrets.get('DB_PASSWORD');
 */
class DotEnvSource {
  // eslint-disable-next-line no-process-env
  async get(key) { return process.env[key] ?? null; }
}

class VaultSource {
  constructor({ addr, token, path }) {
    this.addr = addr; this.token = token; this.path = path;
    this.cache = new Map();
  }
  async get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const res = await fetch(`${this.addr}/v1/${this.path}`, {
      headers: { 'X-Vault-Token': this.token },
    });
    if (!res.ok) {
      logger.error('vault.fetch_failed', { status: res.status });
      return null;
    }
    const json = await res.json();
    const value = json.data?.data?.[key] ?? null;
    if (value) this.cache.set(key, value);
    return value;
  }
}

export function buildSecretsSource(env) {
  if (env.VAULT_ADDR && env.VAULT_TOKEN) {
    return new VaultSource({ addr: env.VAULT_ADDR, token: env.VAULT_TOKEN, path: env.VAULT_SECRET_PATH });
  }
  return new DotEnvSource();
}
```

> 🔒 **SECURITY** — Never log secret values. Never include `process.env` in error reports. Sentry has scrubbing built-in but verify it's on for your DSN.

### 🔒 API Key Management

For tenant-issued API keys (e.g., webhook receivers from POS hardware):

```sql
-- Migration
CREATE TABLE api_keys (
  id              TEXT PRIMARY KEY,                  -- prefix shown in UI: 'sk_live_xxxx...'
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  prefix          TEXT NOT NULL,                     -- first 8 chars, displayed
  hash            TEXT NOT NULL UNIQUE,              -- argon2id hash of full key
  scopes          TEXT[] NOT NULL DEFAULT '{}',      -- ['orders:read','orders:write']
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash ON api_keys(hash);
```

**Key issuance** (one-time display, never recoverable):

```js
import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';

export async function issueApiKey({ tenantId, name, scopes, createdBy }) {
  const raw = `sk_live_${randomBytes(32).toString('base64url')}`;
  const prefix = raw.slice(0, 12);
  const hash = await argon2.hash(raw, { type: argon2.argon2id });
  const id = await prisma.apiKey.create({
    data: { tenantId, name, prefix, hash, scopes, createdBy },
  });
  return { id: id.id, key: raw, prefix }; // raw shown to user ONCE
}

export async function verifyApiKey(raw) {
  // Lookup is O(N) — for high-traffic, store SHA-256 alongside argon2 and lookup by SHA.
  const candidates = await prisma.apiKey.findMany({
    where: { revokedAt: null, prefix: raw.slice(0, 12) },
  });
  for (const c of candidates) {
    if (await argon2.verify(c.hash, raw)) return c;
  }
  return null;
}
```

### 🔒 Encrypted-at-Rest Fields

For PII you absolutely must store but rarely query (e.g., government IDs, full bank details):

```js
// src/utils/crypto.js
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALG = 'aes-256-gcm';

function key() {
  const k = process.env.FIELD_ENCRYPTION_KEY;
  if (!k) throw new Error('FIELD_ENCRYPTION_KEY not set');
  return createHash('sha256').update(k).digest();   // derive 32-byte key from any-length input
}

export function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(b64) {
  if (b64 == null) return null;
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALG, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```

Use a Prisma extension to encrypt/decrypt transparently:

```js
import { Prisma } from '@prisma/client';
import { encrypt, decrypt } from '../utils/crypto.js';

export const encryptedFieldsExtension = Prisma.defineExtension({
  query: {
    user: {
      async create({ args, query }) {
        if (args.data.govId) args.data.govId = encrypt(args.data.govId);
        const result = await query(args);
        if (result.govId) result.govId = decrypt(result.govId);
        return result;
      },
      // mirror for update/findUnique/findMany...
    },
  },
});
```

> 🔒 **SECURITY** — Encryption keys live in Vault, never in source. Rotate annually. Plan for key rotation by storing a `keyVersion` byte alongside ciphertext so old data can be decrypted with the previous key during transition.

### 🔒 CORS — Strict Whitelist

Already wired in Phase 1. Verify the production env doesn't include `'*'` and that the dev env doesn't bleed into prod:

```js
// in env.js validation
CORS_ORIGINS: z
  .string()
  .default('')
  .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
  .refine((arr) => arr.every((o) => /^https:\/\//.test(o) || o === 'http://localhost:5173'),
    { message: 'CORS origins must be HTTPS in production (localhost:5173 allowed for dev)' }),
```

### 🛂 HTTP Security Headers — Audit

| Header | Set by | Value |
|---|---|---|
| `Strict-Transport-Security` | Nginx | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | helmet + Nginx | `nosniff` |
| `X-Frame-Options` | helmet + Nginx | `DENY` |
| `Referrer-Policy` | helmet + Nginx | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | helmet (prod) | restrictive — see Phase 9 above |
| `Permissions-Policy` | helmet | locked down (`geolocation=(), camera=()` etc.) |
| `X-Powered-By` | removed | `app.disable('x-powered-by')` |

Verify with:
```bash
curl -sI https://api.vuedine.com/health | grep -E '^(strict|x-|content-security|referrer)'
```

### 🚦 Rate Limiting on Every Public Endpoint

The architecture from Phase 3 enforces this by default — global rate limit applies before any route. Audit by:

```js
// audit script: list every route, confirm each has rate-limit middleware in chain
import { v1Router } from './src/routes.v1.js';
v1Router.stack.forEach((layer) => {
  if (layer.route) console.log(layer.route.path, layer.route.methods);
});
```

### ✅ Phase Completion Checklist
- [ ] OWASP Top 10 mitigation table reviewed and signed off
- [ ] No `$queryRawUnsafe` usages anywhere (ESLint rule passes)
- [ ] CSP header present in prod responses
- [ ] `npm audit --audit-level=high` returns zero issues
- [ ] `audit-ci` runs in CI and blocks PRs with new high+ vulns
- [ ] `package-lock.json` committed; CI uses `npm ci`
- [ ] CSRF origin check on `/v1/auth/refresh`
- [ ] API keys hashed with argon2id; raw key shown only once
- [ ] Encrypted-at-rest fields documented in `docs/security/encryption.md`
- [ ] Vault path documented for prod; `.env.production` checked into a private encrypted store, **not** the repo
- [ ] CORS origins HTTPS-only in prod (env validation enforces)
- [ ] curl audit confirms all security headers present
- [ ] Penetration test scheduled within 90 days of launch

### ⚠️ Common Pitfalls
1. **Logging request bodies on error.** Passwords, tokens, payment fields all leak. Always denylist sensitive keys before logging.
2. **`SameSite=None` without `Secure`.** Cookie won't be set in modern browsers; auth silently breaks. If you genuinely need cross-site cookies (e.g., embedded widgets), enforce `Secure` and use `Partitioned` (CHIPS).
3. **Hashing API keys with bcrypt instead of argon2id.** Bcrypt has a 72-byte input limit. argon2id is the modern recommendation; PHC string format makes upgrade paths easy.
4. **Forgetting to revoke API keys on tenant deletion.** Cascade `ON DELETE CASCADE` from `tenants` to `api_keys` ensures it's automatic.
5. **Dependency audit gate set to `low`.** False-positive flood. Set to `moderate` (or `high` and review weekly) — `low` makes the team blind to real issues.

---

## Phase 10 — Testing Strategy

### 📌 Goal
A fast, deterministic test suite that catches regressions without becoming a maintenance burden. Three layers: unit tests for pure logic, integration tests against a real Postgres + Redis, contract tests stubbed for future microservice extraction. Coverage thresholds enforced in CI; load tests scripted for the top 5 endpoints.

### 🔗 Dependencies to Install

```bash
npm install -D jest supertest @faker-js/faker ioredis-mock \
  jest-extended dotenv-cli pact-foundation/pact k6
# k6 is a binary, install via brew/apt; the npm pkg is helpers only.
```

### 🧪 Test Pyramid Targets

```
        ┌─────────────────┐
        │   Load (k6)     │   ← few, manual / nightly
        ├─────────────────┤
        │  Integration    │   ← ~30% of total tests, full HTTP layer
        ├─────────────────┤
        │     Unit        │   ← ~70% of total tests, pure functions
        └─────────────────┘
```

**Coverage thresholds enforced in CI:** 80% lines, 75% branches.

### 🗂 File/Folder Changes

```
tests/
├─ unit/
│  ├─ utils/
│  │  ├─ pagination.test.js
│  │  └─ crypto.test.js
│  └─ modules/
│     └─ auth/
│        ├─ tokens.test.js
│        └─ auth.service.test.js
├─ integration/
│  ├─ auth.spec.js
│  ├─ items.spec.js
│  └─ rate-limit.spec.js
├─ fixtures/
│  ├─ tenant.factory.js
│  ├─ user.factory.js
│  └─ item.factory.js
├─ helpers/
│  ├─ test-app.js          # Express app + fresh test DB per run
│  ├─ test-db.js
│  └─ test-redis.js
└─ setup.js
.env.test
jest.config.js
```

### ⚙️ `jest.config.js`

```js
export default {
  testEnvironment: 'node',
  setupFilesAfterEach: ['<rootDir>/tests/setup.js'],
  setupFiles: ['dotenv/config'],
  testMatch: ['**/tests/**/*.{spec,test}.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',                 // entry point, hard to unit test
    '!src/**/index.js',
    '!src/**/types.js',
    '!src/docs/**',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text-summary', 'lcov'],
  testTimeout: 15_000,
  clearMocks: true,
  restoreMocks: true,
  // Heavyweight integration tests run serially — DB resets need it.
  maxWorkers: process.env.CI ? 2 : '50%',
  // Use jest-extended matchers (toHaveBeenCalledOnceWith etc.)
  setupFilesAfterEach: ['jest-extended/all'],
};
```

### ⚙️ `.env.test`

```bash
NODE_ENV=test
PORT=4444
LOG_LEVEL=error                                    # silence test logs
DATABASE_URL=postgresql://vuedine:vuedine_test@localhost:5432/vuedine_test?schema=public&connection_limit=5
REDIS_URL=redis://localhost:6379/15                 # use DB 15 for test isolation
JWT_ACCESS_SECRET=test-access-secret-min-32-chars-aaaaaaaaaaaa
JWT_REFRESH_SECRET=test-refresh-secret-min-32-chars-bbbbbbbbbb
BCRYPT_COST=4                                       # speed up tests
RATE_LIMIT_GLOBAL_MAX=100000                        # don't trip during tests
CORS_ORIGINS=http://localhost
```

> ⚡ **PERFORMANCE** — `BCRYPT_COST=4` cuts test time by ~80% versus the prod cost of 12. The `redis://localhost:6379/15` puts test data in DB 15 — `FLUSHDB` between tests doesn't touch dev DB 0.

### 💻 Test DB Bootstrap — `tests/helpers/test-db.js`

```js
import { execSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

let prisma;

export async function setupTestDb() {
  // Apply migrations (or `db push` for speed in tests)
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
  prisma = new PrismaClient();
  return prisma;
}

export async function resetTestDb() {
  // Truncate everything except prisma's migration table. Faster than reset.
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables
               WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function teardownTestDb() {
  if (prisma) await prisma.$disconnect();
}

export function getPrisma() {
  return prisma;
}
```

### 💻 Redis Mock for Unit Tests — `tests/helpers/test-redis.js`

```js
import RedisMock from 'ioredis-mock';

export function buildRedisMock() {
  return new RedisMock();
}

// Jest module mock — drop in unit tests:
//   jest.mock('../../src/db/redis.js', () => ({ redis: buildRedisMock() }));
```

For integration tests, use a *real* Redis pointed at DB 15.

### 💻 Test App — `tests/helpers/test-app.js`

```js
import { createApp } from '../../src/app.js';

let app;

export function getTestApp() {
  if (!app) app = createApp();
  return app;
}
```

### 💻 Factories — `tests/fixtures/user.factory.js`

```js
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

import { getPrisma } from '../helpers/test-db.js';

export async function makeUser(overrides = {}) {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(overrides.password ?? 'pass1234', 4);
  return prisma.user.create({
    data: {
      email: overrides.email ?? faker.internet.email().toLowerCase(),
      name: overrides.name ?? faker.person.fullName(),
      passwordHash,
      role: overrides.role ?? 'CASHIER',
      status: 'ACTIVE',
      tenantId: overrides.tenantId ?? null,
      branchIds: overrides.branchIds ?? [],
      ...overrides,
    },
  });
}
```

### 💻 Setup Hooks — `tests/setup.js`

```js
import { setupTestDb, resetTestDb, teardownTestDb } from './helpers/test-db.js';

beforeAll(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});
```

### 💻 Unit Test Example — `tests/unit/modules/auth/tokens.test.js`

```js
import { tokens } from '../../../../src/modules/auth/tokens.js';

describe('tokens', () => {
  test('newRefreshToken returns 32-byte raw + sha256 hash', () => {
    const { raw, hash } = tokens.newRefreshToken();
    expect(raw.length).toBeGreaterThanOrEqual(43);   // base64url of 32 bytes
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokens.hashRefresh(raw)).toBe(hash);
  });

  test('signAccess + verifyAccess round-trip', () => {
    const user = { id: 'u1', tenantId: 't1', role: 'OWNER', branchIds: ['b1'] };
    const token = tokens.signAccess(user);
    const payload = tokens.verifyAccess(token);
    expect(payload).toMatchObject({ sub: 'u1', tid: 't1', role: 'OWNER', branchIds: ['b1'] });
  });

  test('verifyAccess rejects tampered token', () => {
    const token = tokens.signAccess({ id: 'u1', tenantId: null, role: 'CASHIER', branchIds: [] });
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(() => tokens.verifyAccess(tampered)).toThrow();
  });
});
```

### 💻 Integration Test — `tests/integration/auth.spec.js`

```js
import request from 'supertest';

import { getTestApp } from '../helpers/test-app.js';
import { makeUser } from '../fixtures/user.factory.js';

describe('POST /v1/auth/login', () => {
  test('happy path: returns access token + sets refresh cookie', async () => {
    await makeUser({ email: 'alice@test.com', password: 'pass1234' });

    const res = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { user: { email: 'alice@test.com' }, accessToken: expect.any(String) },
      error: null,
      requestId: expect.any(String),
    });
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/refresh=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
  });

  test('wrong password: 401 + invalid_credentials code', async () => {
    await makeUser({ email: 'alice@test.com', password: 'pass1234' });
    const res = await request(getTestApp())
      .post('/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'WRONG' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('refresh token reuse: revokes family + 401', async () => {
    await makeUser({ email: 'bob@test.com', password: 'pass1234' });
    const agent = request.agent(getTestApp());

    // 1. login → sets refresh cookie R1
    const login = await agent.post('/v1/auth/login').send({ email: 'bob@test.com', password: 'pass1234' });
    expect(login.status).toBe(200);
    const cookie1 = login.headers['set-cookie'][0];

    // 2. refresh → rotates to R2
    const refresh1 = await agent.post('/v1/auth/refresh');
    expect(refresh1.status).toBe(200);

    // 3. attacker tries to use R1 again
    const replay = await request(getTestApp())
      .post('/v1/auth/refresh')
      .set('Cookie', cookie1);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSE');

    // 4. now even R2 is dead (family revoked)
    const dead = await agent.post('/v1/auth/refresh');
    expect(dead.status).toBe(401);
  });
});
```

### 💻 Rate Limit Integration Test

```js
// tests/integration/rate-limit.spec.js
import request from 'supertest';

import { getTestApp } from '../helpers/test-app.js';

describe('rate limiting', () => {
  test('login rate limit triggers after threshold', async () => {
    const app = getTestApp();
    const limit = Number(process.env.RATE_LIMIT_LOGIN_MAX);
    let lastStatus;
    for (let i = 0; i < limit + 2; i++) {
      const res = await request(app).post('/v1/auth/login').send({ email: 'x@y.z', password: 'WRONG' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
```

> ⚠️ Run rate-limit tests with `RATE_LIMIT_LOGIN_MAX=5` in `.env.test`. Otherwise hammering 100s of times slows the suite.

### 📊 Contract Testing Stub (Pact)

When the API and frontend are split across teams, contract tests prevent surprise breakages:

```js
// tests/contracts/items.contract.test.js (stub)
import { Pact } from '@pact-foundation/pact';

const provider = new Pact({
  consumer: 'vuedine-web',
  provider: 'vuedine-api',
  port: 4445,
  log: 'pact/logs',
  dir: 'pact/contracts',
  logLevel: 'warn',
});

describe('items contract', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());
  afterEach(() => provider.verify());

  test('GET /v1/items returns list envelope', async () => {
    await provider.addInteraction({
      state: 'one item exists',
      uponReceiving: 'a request for items',
      withRequest: { method: 'GET', path: '/v1/items', headers: { Authorization: /^Bearer / } },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, data: [{ id: '...', name: '...' }], error: null },
      },
    });
    // Frontend would call here; we just verify the recording.
  });
});
```

The recorded `pact/contracts/*.json` is published to a Pact Broker, and the API runs `provider-verify` in CI to ensure conformance.

### 🚛 Load Testing — `tests/load/login.k6.js`

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp-up to 50 VUs
    { duration: '2m',  target: 50 },   // hold
    { duration: '30s', target: 0  },   // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed:   ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL ?? 'http://localhost:4000';

export default function () {
  const res = http.post(
    `${BASE}/v1/auth/login`,
    JSON.stringify({ email: 'load@vuedine.demo', password: 'pass1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { '200': (r) => r.status === 200 });
  sleep(1);
}
```

Run with:
```bash
k6 run tests/load/login.k6.js -e BASE_URL=https://staging.vuedine.com
```

Build a k6 script for: login, list items, place order, list live orders. These are the four hot paths.

### 🧮 CI Test Matrix

```yaml
# .github/workflows/ci.yml (excerpt)
jobs:
  test:
    strategy:
      matrix:
        node: ['20.x', '22.x']
        os: [ubuntu-latest]
    runs-on: ${{ matrix.os }}
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: vuedine, POSTGRES_PASSWORD: vuedine_test, POSTGRES_DB: vuedine_test }
        ports: ['5432:5432']
        options: --health-cmd "pg_isready" --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: postgresql://vuedine:vuedine_test@localhost:5432/vuedine_test }
      - run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://vuedine:vuedine_test@localhost:5432/vuedine_test
          REDIS_URL: redis://localhost:6379/15
          NODE_ENV: test
      - uses: codecov/codecov-action@v4
        with: { files: ./coverage/lcov.info }
```

### ✅ Phase Completion Checklist
- [ ] `npm test` runs green locally without external services beyond Docker
- [ ] `npm run test:coverage` enforces 80% threshold
- [ ] Test DB resets between tests (`TRUNCATE ... CASCADE`) — no test pollution
- [ ] BCRYPT_COST=4 in `.env.test`; tests run < 60s on dev laptop
- [ ] Token reuse detection covered by integration test
- [ ] Rate limit test passes with reduced limits in `.env.test`
- [ ] Factory pattern in use; no inline `prisma.user.create` in tests
- [ ] k6 scripts for login + list items + place order committed
- [ ] CI runs Node 20 + 22, posts coverage to Codecov
- [ ] Pact stub directory exists; contracts can be added per consumer

### ⚠️ Common Pitfalls
1. **Tests sharing global state.** A `beforeAll` insert that two tests both depend on; one test mutates and breaks the other. Use `afterEach(reset)` plus per-test factories.
2. **Mocking Prisma everywhere.** Tempting for speed, but tests then verify the mocks not the queries. Use real DB in integration tests; reserve mocks for genuine isolation needs (external HTTP, time, randomness).
3. **`maxWorkers` too high.** Parallel workers race on the test DB. Either give each worker its own schema (`?schema=test_${pid}`), or set `maxWorkers: 1` for integration. Keep unit tests parallel.
4. **Coverage chasing.** Hitting 95% on getter/setter boilerplate while missing the auth flow's reuse detection. Coverage is a smoke alarm, not a quality metric — review what's covered, not just the number.

---

## Phase 11 — Docker & Containerization

### 📌 Goal
A reproducible, single-command local stack and a production-grade image. The dev stack (`docker compose up`) brings up the API, worker, Postgres, Redis, Nginx, Prometheus, Grafana, and the Bull Board UI in under 60 seconds. The production image is multi-stage, runs as a non-root user, and includes only what's needed at runtime.

### 🗂 File/Folder Changes

```
docker/
├─ Dockerfile                      # multi-stage builder + production
├─ Dockerfile.worker               # worker variant
├─ nginx/
│  ├─ default.conf                 # (Phase 8)
│  └─ proxy_params.conf
├─ postgres/
│  └─ init.sql
├─ prometheus/
│  ├─ prometheus.yml
│  └─ alerts.yml
└─ grafana/
   └─ provisioning/...
.dockerignore
docker-compose.yml
docker-compose.prod.yml
docker-compose.override.yml        # local-only tweaks (volumes, ports)
```

### 💻 `Dockerfile` — multi-stage

```dockerfile
# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1 — deps: install production deps using lockfile
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN apk add --no-cache openssl \
 && npm ci --omit=dev --no-audit --no-fund \
 && npx prisma generate

# ============================================================
# Stage 2 — builder: full deps + lint/test (used in CI)
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN apk add --no-cache openssl \
 && npm ci --no-audit --no-fund \
 && npx prisma generate
COPY . .
RUN npm run lint

# ============================================================
# Stage 3 — production: minimal runtime
# ============================================================
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    PORT=4000

# OpenSSL for Prisma engine, dumb-init for clean signal handling, tini alternative.
RUN apk add --no-cache openssl tini ca-certificates \
 && addgroup -S vuedine -g 1001 \
 && adduser -S vuedine -u 1001 -G vuedine

COPY --chown=vuedine:vuedine --from=deps    /app/node_modules ./node_modules
COPY --chown=vuedine:vuedine --from=deps    /app/prisma       ./prisma
COPY --chown=vuedine:vuedine package.json ecosystem.config.js ./
COPY --chown=vuedine:vuedine src             ./src

USER vuedine
EXPOSE 4000

# tini = PID 1, forwards SIGTERM to node so graceful shutdown works.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

# Healthcheck used by docker compose / orchestrators.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"
```

> 🔴 **PRODUCTION CRITICAL** — Always run as non-root. A container compromise becomes a kernel-exploit chain instead of instant root.

> ⚡ **PERFORMANCE** — `tini` (or `dumb-init`) as PID 1 ensures `SIGTERM` reaches Node. Without it, Docker has to wait for `terminationGracePeriodSeconds` then `SIGKILL`. Ungraceful shutdowns leak DB connections and abandon in-flight requests.

### 💻 `Dockerfile.worker`

```dockerfile
# Worker shares 95% with API; only entrypoint differs.
# Reuse the same base image; the deploy pipeline tags it twice.
FROM vuedine-api:latest
CMD ["node", "src/queues/workers/index.js"]
```

In practice we don't build a separate image — we run the same image with a different command. Keep this Dockerfile as documentation; the actual override lives in compose / k8s.

### 💻 `.dockerignore`

```
.git
.github
.husky
.vscode
.idea
node_modules
npm-debug.log
coverage
logs
tests
docs
*.md
!README.md
.env
.env.*
!.env.example
docker-compose*.yml
.nyc_output
.eslintcache
*.tsbuildinfo
```

### 💻 `docker-compose.yml` — full local dev stack

```yaml
name: vuedine

x-app-base: &app-base
  image: vuedine-api:dev
  build:
    context: .
    dockerfile: docker/Dockerfile
    target: production
  env_file: .env
  depends_on:
    postgres: { condition: service_healthy }
    redis:    { condition: service_healthy }
  restart: unless-stopped

services:
  api:
    <<: *app-base
    container_name: vuedine_api
    command: ["node", "src/server.js"]
    ports:
      - "4000:4000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 20s

  worker:
    <<: *app-base
    container_name: vuedine_worker
    command: ["node", "src/queues/workers/index.js"]
    deploy:
      replicas: 2

  postgres:
    image: postgres:16-alpine
    container_name: vuedine_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: vuedine
      POSTGRES_PASSWORD: vuedine_dev
      POSTGRES_DB: vuedine
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "log_min_duration_statement=200"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vuedine -d vuedine"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: vuedine_redis
    restart: unless-stopped
    command:
      - "redis-server"
      - "--appendonly"
      - "yes"
      - "--maxmemory"
      - "512mb"
      - "--maxmemory-policy"
      - "allkeys-lru"
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  nginx:
    image: nginx:1.27-alpine
    container_name: vuedine_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/nginx/proxy_params.conf:/etc/nginx/proxy_params.conf:ro
      # In dev, mount a self-signed cert. In prod, certbot writes here.
      - certbot_certs:/etc/letsencrypt:ro
      - certbot_webroot:/var/www/certbot:ro
    depends_on:
      api: { condition: service_healthy }

  bull-board:
    <<: *app-base
    container_name: vuedine_bullboard
    command: ["node", "scripts/bull-board.js"]
    ports:
      - "4001:4001"

  prometheus:
    image: prom/prometheus:v2.55.1
    container_name: vuedine_prometheus
    restart: unless-stopped
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./docker/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.retention.time=15d"
      - "--web.enable-lifecycle"
    ports:
      - "9090:9090"
    env_file: .env

  grafana:
    image: grafana/grafana:11.3.0
    container_name: vuedine_grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./docker/grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "3000:3000"
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  certbot_certs:
  certbot_webroot:
```

### 💻 `docker-compose.override.yml` — dev-only

```yaml
# Auto-merged by `docker compose` in dev. Mounts source for hot reload.
services:
  api:
    command: ["node", "--watch", "src/server.js"]
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma
    environment:
      LOG_LEVEL: debug

  worker:
    command: ["node", "--watch", "src/queues/workers/index.js"]
    volumes:
      - ./src:/app/src
```

### 💻 `docker-compose.prod.yml` — production overrides

```yaml
# docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
services:
  api:
    image: ghcr.io/vuedine/api:${IMAGE_TAG}
    command: ["pm2-runtime", "ecosystem.config.js", "--only", "api"]
    deploy:
      replicas: 4
      resources:
        limits: { cpus: "2", memory: "1G" }
        reservations: { cpus: "0.5", memory: "256M" }
      restart_policy:
        condition: on-failure
        max_attempts: 5
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }

  worker:
    image: ghcr.io/vuedine/api:${IMAGE_TAG}
    command: ["pm2-runtime", "ecosystem.config.js", "--only", "worker"]
    deploy:
      replicas: 2
      resources:
        limits: { cpus: "1", memory: "1G" }

  postgres:
    # In prod, use managed Postgres (RDS/Aurora). This block kept only for self-hosted variants.
    deploy:
      placement: { constraints: ["node.role==manager"] }
      resources:
        limits: { memory: "4G" }

  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DB_HOST: ${DB_HOST}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 25
    ports: ["6432:5432"]

  certbot:
    image: certbot/certbot:latest
    volumes:
      - certbot_certs:/etc/letsencrypt
      - certbot_webroot:/var/www/certbot
    entrypoint: >
      sh -c "trap exit TERM;
        while :; do
          certbot renew --webroot -w /var/www/certbot --quiet;
          sleep 12h & wait $${!};
        done"
```

### 🌐 Environment Variable Injection

| Approach | When |
|---|---|
| `.env` file via `env_file:` | Dev only |
| Docker secrets (Swarm/Kubernetes) | Production for sensitive values |
| Vault sidecar | Production for org-wide rotation |
| Compose `environment:` block | Public-ish, non-secret config (LOG_LEVEL, FEATURE_*) |

> 🔴 **PRODUCTION CRITICAL** — Never bake secrets into Docker images. They live in image layers forever, even after `RUN unset SECRET`. Use build-time `--secret` mounts (BuildKit) for build-time-only secrets, runtime injection for everything else.

### 🩺 Healthchecks for Every Service

Already included in the compose file above. Quick reference:

| Service | Probe | Interval |
|---|---|---|
| api / worker | HTTP `GET /health` | 10s |
| postgres | `pg_isready` | 5s |
| redis | `redis-cli ping` | 5s |
| nginx | `nginx -t` (via probe) or HTTPS cert check | 30s |

### ✅ Phase Completion Checklist
- [ ] `docker compose up -d` brings up the full stack in < 60s
- [ ] All services report `healthy` within `start_period`
- [ ] `docker compose logs -f api` streams pretty logs in dev, JSON in prod
- [ ] Image size under 200 MB (verified with `docker images vuedine-api:dev`)
- [ ] Container runs as non-root (`docker exec ... whoami` → `vuedine`)
- [ ] `docker stop --time=30 vuedine_api` triggers graceful shutdown
- [ ] Source mounted in dev triggers `--watch` reload on edit
- [ ] Bull Board reachable at http://localhost:4001 and gated by auth
- [ ] Grafana auto-provisions Prometheus datasource
- [ ] Prod compose works against managed RDS / Redis when self-hosted services removed

### ⚠️ Common Pitfalls
1. **Copying everything before `npm ci`.** Cache invalidates on every code change. Always copy `package*.json` first, run install, then copy source.
2. **`COPY . .` without `.dockerignore`.** `node_modules` (host's, possibly Linux-incompatible) and `.git` end up in your image. Always have a tight `.dockerignore`.
3. **`alpine` for native modules without build tooling.** Some packages (sharp, canvas) need glibc or build-essential. Either switch to `node:20-slim` or accept the alpine `apk add --no-cache python3 make g++` overhead.
4. **No `tini` / `dumb-init` as PID 1.** Node-as-PID-1 doesn't reap zombies and ignores SIGTERM by default. Always use an init.
5. **Putting Prometheus retention at default 15d on a 100GB disk.** It eats it. Set `--storage.tsdb.retention.size=80GB` or shorten time.

---

## Phase 12 — CI/CD Pipeline

### 📌 Goal
Every commit goes through lint → test → build → push. `develop` auto-deploys to staging; `main` deploys to production behind a manual approval gate. Migrations run as part of the pipeline. Rollbacks are one-click.

### 🗂 File/Folder Changes

```
.github/
└─ workflows/
   ├─ ci.yml
   ├─ deploy-staging.yml
   ├─ deploy-production.yml
   └─ release.yml
scripts/
├─ migrate.sh
├─ smoke-test.sh
└─ rollback.sh
```

### ⚙️ Required GitHub Secrets

| Secret | Where used |
|---|---|
| `GHCR_PAT` | Push images to GitHub Container Registry |
| `STAGING_SSH_KEY` | Deploy to staging host |
| `PROD_SSH_KEY` | Deploy to production host |
| `STAGING_HOST`, `PROD_HOST` | DNS / IP for SSH targets |
| `STAGING_DB_URL`, `PROD_DB_URL` | For migration step |
| `SLACK_WEBHOOK` | Deploy notifications |
| `SENTRY_AUTH_TOKEN` | Source map upload |
| `CODECOV_TOKEN` | Coverage upload |

> 🔒 **SECURITY** — Use Environment Protection Rules in GitHub: `production` environment requires manual approval + a reviewer outside the deploying user.

### 💻 `ci.yml` — runs on every PR + push to main/develop

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check .

  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20.x', cache: npm }
      - run: npm ci
      - run: npx audit-ci --config audit-ci.json

  test:
    runs-on: ubuntu-latest
    needs: [lint]
    strategy:
      matrix:
        node: ['20.x', '22.x']
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: vuedine
          POSTGRES_PASSWORD: vuedine_test
          POSTGRES_DB: vuedine_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U vuedine"
          --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s --health-retries 10
    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://vuedine:vuedine_test@localhost:5432/vuedine_test?schema=public
      REDIS_URL: redis://localhost:6379/15
      JWT_ACCESS_SECRET: test-access-secret-min-32-chars-aaaaaaaaaaaa
      JWT_REFRESH_SECRET: test-refresh-secret-min-32-chars-bbbbbbbbbb
      BCRYPT_COST: '4'
      RATE_LIMIT_GLOBAL_MAX: '100000'
      RATE_LIMIT_LOGIN_MAX: '5'
      CORS_ORIGINS: http://localhost
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        if: matrix.node == '20.x'
        with:
          files: ./coverage/lcov.info
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    runs-on: ubuntu-latest
    needs: [test, audit]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.tags }}
      digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/api
          tags: |
            type=ref,event=branch
            type=sha,prefix=,suffix=,format=short
            type=raw,value=latest,enable={{is_default_branch}}
      - id: push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true
```

> ⚡ **PERFORMANCE** — `cache-from: type=gha, cache-to: type=gha` uses GitHub's BuildKit cache. First build cold ≈ 4 min, subsequent builds ≈ 60s.

### 💻 `deploy-staging.yml` — auto on push to develop

```yaml
name: Deploy Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

concurrency:
  group: deploy-staging
  cancel-in-progress: false   # never cancel a deploy mid-flight

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.api.vuedine.com
    steps:
      - uses: actions/checkout@v4

      - name: Wait for CI to pass
        uses: lewagon/wait-on-check-action@v1.3.4
        with:
          ref: ${{ github.sha }}
          check-name: 'build'
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          wait-interval: 15

      - name: Run migrations against staging
        env:
          DATABASE_URL: ${{ secrets.STAGING_DB_URL }}
        run: |
          npx prisma migrate deploy

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: deploy
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/vuedine
            export IMAGE_TAG=${{ github.sha }}
            docker compose pull api worker
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --remove-orphans api worker
            sleep 10
            curl -sf https://staging.api.vuedine.com/health || exit 1

      - name: Smoke test
        run: bash scripts/smoke-test.sh https://staging.api.vuedine.com

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          fields: repo,commit,author,workflow
        env: { SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }} }
```

### 💻 `deploy-production.yml` — manual approval gate

```yaml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      sha:
        description: 'Git SHA or tag to deploy'
        required: true
        type: string

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      previous_sha: ${{ steps.previous.outputs.sha }}
    steps:
      - uses: actions/checkout@v4
      - id: previous
        env:
          PROD_HOST: ${{ secrets.PROD_HOST }}
          PROD_SSH_KEY: ${{ secrets.PROD_SSH_KEY }}
        run: |
          # Capture currently-running tag for instant rollback later
          mkdir -p ~/.ssh && echo "$PROD_SSH_KEY" > ~/.ssh/id && chmod 600 ~/.ssh/id
          PREV=$(ssh -o StrictHostKeyChecking=no -i ~/.ssh/id deploy@$PROD_HOST 'cat /opt/vuedine/.deployed-sha' || echo none)
          echo "sha=$PREV" >> $GITHUB_OUTPUT

  deploy:
    needs: [prepare]
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.vuedine.com
    steps:
      - uses: actions/checkout@v4
        with: { ref: ${{ inputs.sha }} }

      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.PROD_DB_URL }}
        run: npx prisma migrate deploy

      - name: Blue-green swap
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/vuedine
            export IMAGE_TAG=${{ inputs.sha }}
            # Pull new image
            docker compose pull api worker
            # Roll one replica at a time (compose --scale alternative for full-swarm setups)
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --remove-orphans api worker
            # Save SHA for rollback
            echo "${{ inputs.sha }}" > /opt/vuedine/.deployed-sha

      - name: Smoke test (5x retry)
        run: |
          for i in 1 2 3 4 5; do
            if bash scripts/smoke-test.sh https://api.vuedine.com; then
              exit 0
            fi
            sleep 10
          done
          exit 1

      - name: Upload Sentry release
        env: { SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }} }
        run: |
          npx @sentry/cli releases new "vuedine-api@${{ inputs.sha }}"
          npx @sentry/cli releases set-commits "vuedine-api@${{ inputs.sha }}" --auto
          npx @sentry/cli releases finalize  "vuedine-api@${{ inputs.sha }}"

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with: { status: ${{ job.status }}, fields: repo,commit,author,workflow,took }
        env: { SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }} }

  rollback-on-failure:
    needs: [prepare, deploy]
    if: failure() && needs.prepare.outputs.previous_sha != 'none'
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/vuedine
            export IMAGE_TAG=${{ needs.prepare.outputs.previous_sha }}
            docker compose pull api worker
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api worker
            echo "${{ needs.prepare.outputs.previous_sha }}" > /opt/vuedine/.deployed-sha
```

### 💻 `scripts/smoke-test.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${1:?usage: smoke-test.sh <base-url>}"
echo "Smoke testing $BASE"
# Health
curl -fsS "$BASE/health"   | grep -q '"status":"ok"'
# Ready (DB + Redis)
curl -fsS "$BASE/ready"    | grep -q '"status":"ready"'
# Auth login (using dedicated smoke account that should exist in target env)
RESP=$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"smoke@vuedine.demo\",\"password\":\"$SMOKE_PASSWORD\"}" \
  "$BASE/v1/auth/login")
echo "$RESP" | grep -q '"accessToken"'
echo "✅ Smoke tests passed"
```

### 🔄 Rollback Strategy

Three escape hatches, ordered by speed:

1. **Image rollback (auto)** — failed deploys auto-roll on smoke-test failure (the `rollback-on-failure` job above). ~30 seconds.
2. **Manual image rollback** — `gh workflow run deploy-production.yml -f sha=<previous>` triggers a deploy of the previous SHA.
3. **Migration rollback** — Prisma migrations are forward-only by design. To "rollback" a schema change in prod, write a *new* migration that reverses it. Never use `prisma migrate reset` against prod.

> 🔴 **PRODUCTION CRITICAL** — Migrations and code deployments must be **decoupled**. Schema changes that break old code (e.g., dropping a column) require:
> 1. Deploy code that no longer reads the column.
> 2. Wait for old replicas to drain.
> 3. Deploy migration that drops the column.

### 🟦🟩 Blue-Green Deployment (concept)

For lower-risk deploys, run two environments (`api-blue`, `api-green`) behind Nginx. Deploy to the inactive color, smoke-test, then flip Nginx upstream.

```nginx
upstream vuedine_api {
    least_conn;
    # current
    server api-blue:4000  max_fails=3 fail_timeout=10s;
    # standby (commented out, swap on cutover)
    # server api-green:4000 max_fails=3 fail_timeout=10s;
}
```

Or use a flag file the upstream config reads at reload:
```bash
echo "active=green" > /etc/nginx/active.env
nginx -s reload
```

### ✅ Phase Completion Checklist
- [ ] CI runs on every PR; lint + test + audit must all pass to merge
- [ ] Push to `develop` builds image, runs migrations, deploys to staging
- [ ] Push to `main` builds + tags but does NOT deploy without `workflow_dispatch`
- [ ] Production environment has manual approval rule + at least one required reviewer
- [ ] Smoke test runs after every deploy and fails the job on a 4xx/5xx
- [ ] Failed prod deploy auto-rolls back to previous SHA
- [ ] Sentry release tagged on every prod deploy with source maps
- [ ] Slack notification on success and failure
- [ ] `package-lock.json` always committed (CI uses `npm ci`)
- [ ] Coverage uploaded to Codecov; PR comments summarize the diff

### ⚠️ Common Pitfalls
1. **Cancelling deploys mid-flight.** `cancel-in-progress: true` on the deploy concurrency group leaves migrations half-applied. Set to `false` for deploy workflows.
2. **`npm install` instead of `npm ci`.** `install` regenerates `package-lock.json` based on whatever's available now; `ci` errors if the lock would change. Always `ci`.
3. **Migration step running with the worker still on the old code.** A column drop deploys before workers update → instant `column does not exist` errors. Use the three-step decoupled migration above.
4. **Storing the previous SHA in the workflow itself instead of on the host.** The workflow run is ephemeral; the host's `.deployed-sha` survives any GitHub Actions outage.
5. **`workflow_dispatch` without restricting who can run it.** Anyone with `Contributor` access can ship to prod. Use environment protection rules with required reviewers.

---

## Phase 13 — API Documentation

### 📌 Goal
Auto-generated OpenAPI 3.0 spec served as Swagger UI, with authentication built in so developers can test endpoints from the docs page. Annotations live next to the routes (single source of truth — the route IS the doc). A Postman collection is generated from the same spec.

### 🔗 Dependencies to Install

```bash
npm install swagger-jsdoc swagger-ui-express
npm install -D @apidevtools/swagger-cli openapi-to-postmanv2
```

### 🗂 File/Folder Changes

```
src/docs/
├─ openapi.js                # swagger-jsdoc config
├─ schemas/                  # reusable component schemas
│  ├─ envelope.js
│  ├─ error.js
│  ├─ user.js
│  ├─ item.js
│  ├─ order.js
│  └─ pagination.js
└─ generate.js               # CLI: writes openapi.json + postman.json
docs/
└─ openapi.json              # generated, committed for visibility
CHANGELOG.md
```

### 💻 OpenAPI Bootstrap — `src/docs/openapi.js`

```js
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from '../config/index.js';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Vuedine API',
    version: config.appVersion,
    description: `
**Vuedine restaurant POS REST API.**

All non-public endpoints require a Bearer JWT obtained from \`POST /v1/auth/login\`.
Refresh tokens are delivered as \`httpOnly\` cookies scoped to \`/v1/auth\`.

### Response envelope

\`\`\`json
{ "success": true, "data": {...}, "meta": {...}, "error": null, "requestId": "uuid" }
\`\`\`

Errors flip \`success: false\`, \`data: null\`, populate \`error\`.
    `.trim(),
    contact: { name: 'Vuedine Engineering', email: 'eng@vuedine.com' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: 'https://api.vuedine.com',         description: 'Production' },
    { url: 'https://staging.api.vuedine.com', description: 'Staging' },
    { url: 'http://localhost:4000',           description: 'Local' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
    schemas: {
      Envelope: {
        type: 'object',
        required: ['success', 'data', 'error', 'requestId'],
        properties: {
          success: { type: 'boolean' },
          data: { description: 'Endpoint-specific payload', oneOf: [{ type: 'object' }, { type: 'array' }, { type: 'null' }] },
          meta: { type: 'object', additionalProperties: true },
          error: {
            nullable: true,
            type: 'object',
            properties: {
              code: { type: 'string', example: 'ITEM_NOT_FOUND' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: true },
            },
          },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
      ErrorEnvelope: {
        allOf: [
          { $ref: '#/components/schemas/Envelope' },
          { type: 'object', properties: { success: { example: false }, data: { example: null } } },
        ],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 142 },
          totalPages: { type: 'integer', example: 8 },
        },
      },
      Item: {
        type: 'object',
        required: ['id', 'name', 'category', 'price', 'status'],
        properties: {
          id: { type: 'string', example: 'ckxyz123' },
          name: { type: 'string', example: 'Margherita Pizza' },
          category: { type: 'string', example: 'Pizza' },
          price: { type: 'number', format: 'float', example: 4.5 },
          status: { type: 'string', enum: ['Active', 'Sold out', 'Draft'] },
          emoji: { type: 'string', example: '🍕' },
          veg: { type: 'boolean' },
          bestseller: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'owner@vuedine.demo' },
          password: { type: 'string', format: 'password', example: 'pass1234' },
          tenantSlug: { type: 'string', example: 'vuedine-demo' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          user: { type: 'object' },
          accessToken: { type: 'string', example: 'eyJhbGciOi...' },
        },
      },
    },
    parameters: {
      Page: { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      PageSize: { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      Search: { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
      Forbidden: {
        description: 'Insufficient role / scope',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
      ValidationError: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
      RateLimited: {
        description: 'Too many requests',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        headers: {
          'X-RateLimit-Limit':     { schema: { type: 'integer' } },
          'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          'X-RateLimit-Reset':     { schema: { type: 'integer' } },
          'Retry-After':           { schema: { type: 'integer' } },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth' }, { name: 'Items' }, { name: 'Tables' }, { name: 'Orders' },
    { name: 'KDS' }, { name: 'Payments' }, { name: 'Reports' },
  ],
};

export const openapiSpec = swaggerJsdoc({
  definition,
  apis: ['src/modules/**/*.routes.js', 'src/modules/**/*.controller.js'],
});
```

### 💻 Mount Swagger UI — in `src/app.js`

```js
import swaggerUi from 'swagger-ui-express';

import { openapiSpec } from './docs/openapi.js';
import { config } from './config/index.js';

if (!config.isProd) {
  // Dev/staging: docs are public.
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'Vuedine API',
    customCss: '.swagger-ui .topbar { background: #EC1B7C; }',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  }));
  app.get('/docs.json', (_req, res) => res.json(openapiSpec));
} else {
  // Prod: gate behind auth + role
  app.use('/docs',
    authMiddleware,
    requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { swaggerOptions: { persistAuthorization: true } }),
  );
}
```

> 🔒 **SECURITY** — In production, gate `/docs`. Public docs for an internal SaaS dashboard are reconnaissance assistance. Public docs for a *public API* product are fine — that's a business decision per route group.

### 💻 Annotation Standard — Example on Items Route

**`src/modules/items/items.routes.js`** (add JSDoc above each route):

```js
/**
 * @openapi
 * /v1/items:
 *   get:
 *     tags: [Items]
 *     summary: List items
 *     description: |
 *       Returns a paginated list of menu items for the authenticated tenant.
 *       Cached for 60s; updates invalidate via version-pointer (Phase 3).
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - $ref: '#/components/parameters/Search'
 *       - name: category
 *         in: query
 *         schema: { type: string, maxLength: 50 }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [Active, 'Sold out', Draft] }
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { $ref: '#/components/schemas/Item' } }
 *                     meta: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 *   post:
 *     tags: [Items]
 *     summary: Create item
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price]
 *             properties:
 *               name:     { type: string, maxLength: 120 }
 *               category: { type: string, maxLength: 50 }
 *               price:    { type: number, minimum: 0 }
 *               status:   { type: string, enum: [Active, 'Sold out', Draft], default: Active }
 *               emoji:    { type: string, maxLength: 4 }
 *               veg:      { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties: { data: { $ref: '#/components/schemas/Item' } }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
itemsRouter.get('/',  validate(listSchema), itemsController.list);
itemsRouter.post('/', requireRole('OWNER','ADMIN','MANAGER'), validate(createSchema), itemsController.create);
```

**Convention:** every route file carries one block per route. Schemas live in `components/schemas`, never inline. New tag = new section in `tags`.

### 💻 Spec Generation + Postman — `src/docs/generate.js`

```js
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

import { openapiSpec } from './openapi.js';

const json = JSON.stringify(openapiSpec, null, 2);
writeFileSync('docs/openapi.json', json);
// eslint-disable-next-line no-console
console.log('✅ Wrote docs/openapi.json');

// Validate
execSync('npx swagger-cli validate docs/openapi.json', { stdio: 'inherit' });

// Postman collection
execSync('npx openapi2postmanv2 -s docs/openapi.json -o docs/postman.json -p', { stdio: 'inherit' });
// eslint-disable-next-line no-console
console.log('✅ Wrote docs/postman.json');
```

CI step (extend Phase 12's `ci.yml`):

```yaml
- name: Validate OpenAPI spec
  run: |
    npm run docs:generate
    git diff --exit-code docs/openapi.json || (echo "Spec changed but not committed" && exit 1)
```

### 📜 Versioning & Changelog

**`CHANGELOG.md`** (Keep a Changelog format + SemVer):

```md
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-06-15
### Added
- POST /v1/orders accepts QR-channel orders.
- Refresh token rotation with reuse detection (`AUTH_TOKEN_REUSE_DETECTED` audit event).

### Changed
- Items list cache TTL reduced from 5m to 60s.

### Deprecated
- (none)

### Removed
- Bulk endpoint /v1/items:bulk replaced by /v1/items:batch (sunset 2026-09-01).

### Fixed
- Slow query on /v1/orders when filtering by status without branchId.

### Security
- Bumped argon2 to 0.40.x for CVE-2025-XXXX.

## [0.1.0] — 2026-06-01
- Initial public release.
```

**Versioning rules (SemVer applied to a REST API):**

| Change | Bump |
|---|---|
| Add a new endpoint or new optional field | MINOR |
| Add a required field, remove a field, change response shape, change error code | MAJOR (and live under `/v2`) |
| Bug fix that doesn't change the schema | PATCH |

A breaking change always lands as a new URL prefix (`/v2/...`). The old version stays alive under `/v1/...` for at least 6 months with a `Sunset: <date>` header.

### ✅ Phase Completion Checklist
- [ ] `/docs` serves Swagger UI (gated in prod, public in staging/dev)
- [ ] "Authorize" button accepts a JWT and persists across page reloads
- [ ] Every route in `src/modules/**/*.routes.js` has a JSDoc `@openapi` block
- [ ] `npm run docs:generate` outputs valid `docs/openapi.json` + `docs/postman.json`
- [ ] CI fails when a route is added without docs (`git diff` check)
- [ ] `swagger-cli validate` passes
- [ ] Postman collection imports cleanly into Postman desktop
- [ ] `CHANGELOG.md` updated with every PR (Conventional Commits + Release Drafter helps)
- [ ] SemVer policy documented in `README.md`
- [ ] Sunset header policy documented for v1→v2 deprecation

### ⚠️ Common Pitfalls
1. **Schemas defined inline per route.** They drift; you have three subtly different `User` shapes after six months. Always reference `#/components/schemas/User`.
2. **Documenting auth incorrectly.** Forgetting `security: [{ bearerAuth: [] }]` makes "Try it out" fail with 401 even after authorizing.
3. **Hand-maintained `openapi.json`.** Falls out of date in 2 weeks. Generate it from JSDoc; commit it for visibility but treat the route file as the source.
4. **Ignoring the response envelope in schema.** Every endpoint returns the same wrapper but docs show the inner type — readers think the response is `{ id, name, ... }` when actually it's `{ success, data: { id, name, ... }, ... }`. Use `allOf` to compose.

---

## Phase 14 — Production Launch Checklist

### 📌 Goal
The runway between "feature complete" and "open to traffic." This phase is a series of go/no-go gates: security audit, performance baseline, backups, persistence, certificates, DNS, alerts, runbooks. None of it is glamorous; all of it is what separates a launch from an outage.

### 🛂 Pre-Launch Security Audit

**Internal review** — engineering walks the OWASP map (Phase 9) with an outside reviewer. Sign-off in `docs/security/audit-YYYY-MM-DD.md`. Specific gates:

- [ ] Penetration test booked with an external firm — minimum 2-week engagement
- [ ] Findings triaged: **Critical/High** must be resolved before launch; **Medium/Low** in the first 90 days
- [ ] All `package-lock.json` deps audited (`npm audit`, Snyk, GitHub Dependabot all green)
- [ ] No `console.log(secret)` patterns in source — verified by grep + ESLint
- [ ] Vault tokens issued with minimal scopes (read-only on the API path)
- [ ] AWS / cloud IAM policies follow least-privilege (no `*:*` anywhere)
- [ ] S3 buckets: block public access enabled by default; presigned URLs only
- [ ] Secrets rotated: every credential generated during dev replaced with prod-fresh values
- [ ] DB user the app connects with has `SELECT, INSERT, UPDATE, DELETE` on app tables — **not** `SUPERUSER`. Migrations use a separate higher-privilege user.

### 📈 Performance Baseline Benchmarks

Run these in staging against a prod-mirrored dataset. Capture the numbers in `docs/perf/baseline-YYYY-MM-DD.md`. Compare quarterly.

```bash
# Login throughput
k6 run tests/load/login.k6.js -e BASE_URL=https://staging.api.vuedine.com

# List items (cold cache)
k6 run tests/load/items-list.k6.js -e BASE_URL=...

# Place QR order (writes + WS broadcast)
k6 run tests/load/place-order.k6.js -e BASE_URL=...

# Live orders feed (read-heavy)
k6 run tests/load/live-orders.k6.js -e BASE_URL=...
```

**Target SLOs at launch (per single instance, 4 vCPU / 8 GB):**

| Endpoint | p50 | p95 | p99 | Throughput |
|---|---|---|---|---|
| `POST /v1/auth/login` | < 80 ms | < 250 ms | < 500 ms | 200 rps |
| `GET /v1/items` (warm cache) | < 15 ms | < 60 ms | < 150 ms | 2,000 rps |
| `POST /v1/orders` | < 60 ms | < 200 ms | < 450 ms | 500 rps |
| `GET /v1/live-orders` | < 30 ms | < 100 ms | < 250 ms | 1,000 rps |
| `GET /health` | < 5 ms | < 15 ms | < 30 ms | 5,000 rps |

If any p99 exceeds the budget, profile with `clinic.js doctor` / `clinic.js flame` before launch.

### 💾 Database Backup Strategy 🔴 PRODUCTION CRITICAL

**Three-tier backup plan:**

| Tier | Frequency | Retention | RTO | RPO |
|---|---|---|---|---|
| Continuous WAL streaming | Real-time | 30 days | 5 min | < 1 min |
| `pg_dump` logical | Daily 02:00 UTC | 30 daily / 12 monthly | 30 min | 24 h |
| Cross-region snapshot | Daily | 90 days | 60 min | 24 h |

**Managed Postgres (RDS / Cloud SQL):** turn on automated backups with PITR, set retention to 30 days, snapshot retention 90 days. Test restore quarterly.

**Self-hosted variant — `scripts/backup.sh`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

DATE=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=/var/backups/vuedine
S3_BUCKET=s3://vuedine-backups
mkdir -p "$BACKUP_DIR"

# 1. Logical dump (resumable, easy to inspect)
pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  -h "$DB_HOST" -U "$DB_USER" -d vuedine \
  -f "$BACKUP_DIR/vuedine-$DATE.dump"

# 2. Encrypt at rest (so a leaked backup isn't a leaked DB)
openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in  "$BACKUP_DIR/vuedine-$DATE.dump" \
  -out "$BACKUP_DIR/vuedine-$DATE.dump.enc"
rm "$BACKUP_DIR/vuedine-$DATE.dump"

# 3. Upload + lifecycle handles retention
aws s3 cp "$BACKUP_DIR/vuedine-$DATE.dump.enc" "$S3_BUCKET/$DATE/" \
  --storage-class STANDARD_IA

# 4. Sanity check size — alert if backup is < 10 MB (something went wrong)
SIZE=$(stat -c%s "$BACKUP_DIR/vuedine-$DATE.dump.enc")
if [ "$SIZE" -lt 10000000 ]; then
  curl -X POST "$SLACK_WEBHOOK" \
    -d "{\"text\":\"⚠️ Vuedine backup suspiciously small: $SIZE bytes\"}"
  exit 1
fi

# 5. Local cleanup — keep last 3 only
ls -1t "$BACKUP_DIR"/*.dump.enc | tail -n +4 | xargs -r rm
```

Cron: `0 2 * * * /opt/vuedine/scripts/backup.sh`

**Quarterly restore drill** — *unrestored backups don't exist.* Pick a backup at random, restore into a sandbox, verify row counts and a few canary records.

```bash
# Restore
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in vuedine-DATE.dump.enc -out restore.dump
pg_restore -h sandbox-db -U vuedine -d vuedine_restore --clean --if-exists restore.dump
```

### 💾 Redis Persistence Config

For BullMQ queues + rate limit state, you want both AOF (durability) and RDB (fast restore). For pure cache, RDB alone is fine.

| Mode | Use case | Config |
|---|---|---|
| **AOF only** | Strict durability — accept ≤ 1s of data loss | `appendonly yes` + `appendfsync everysec` |
| **RDB only** | Cache (data is recomputable) | `save 900 1 / 300 10 / 60 10000` |
| **Both (recommended for prod)** | Queue + cache mixed workload | All of the above |

**`docker/redis/redis.conf`** (production):

```ini
# AOF
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# RDB
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# Memory
maxmemory 4gb
maxmemory-policy allkeys-lru

# Persistence directory (mount as volume)
dir /data

# Security
requirepass change-me-in-prod
rename-command FLUSHALL ""        # disable destructive commands
rename-command FLUSHDB ""
rename-command CONFIG ""

# TLS (managed Redis usually handles this; for self-hosted)
# tls-port 6380
# port 0
# tls-cert-file /etc/redis/tls/redis.crt
# tls-key-file  /etc/redis/tls/redis.key
# tls-ca-cert-file /etc/redis/tls/ca.crt
```

> 🔴 **PRODUCTION CRITICAL** — On managed Redis (ElastiCache, Memorystore, Upstash), enable Multi-AZ replication. A single-AZ Redis is a single point of failure for queues + sessions.

### 🔐 SSL Certificate Setup

**Option A — Let's Encrypt via certbot (in compose, auto-renew):**

```bash
# First-time issuance:
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d api.vuedine.com -d staging.api.vuedine.com \
  --email ops@vuedine.com --agree-tos --no-eff-email --rsa-key-size 4096

# Renewal cron lives in compose (Phase 11) — runs every 12h, only acts if < 30d to expiry
```

**Option B — Cloud-managed (ACM behind ALB / Cloudflare):** simplest. Cert lives at the LB; Nginx talks plain HTTP to upstream. Less infrastructure to maintain.

**Verification:**
```bash
# Confirm chain
echo | openssl s_client -servername api.vuedine.com -connect api.vuedine.com:443 \
  -showcerts 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# Confirm modern protocols only
nmap --script ssl-enum-ciphers -p 443 api.vuedine.com | grep -E '(TLSv1\.[0-3]|grade)'
```

Target grade: **A or A+** on [SSL Labs](https://www.ssllabs.com/ssltest/). Anything below A means a misconfiguration.

### 🌐 DNS Configuration

| Record | Type | Value | TTL |
|---|---|---|---|
| `api.vuedine.com` | A / ALIAS | LB public IP | 60 |
| `staging.api.vuedine.com` | A / ALIAS | Staging LB IP | 60 |
| `_dmarc.vuedine.com` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@vuedine.com` | 3600 |
| `vuedine.com` | TXT (SPF) | `v=spf1 include:_spf.sendgrid.net -all` | 3600 |
| `s1._domainkey.vuedine.com` | CNAME | (DKIM from email provider) | 3600 |
| `vuedine.com` | CAA | `0 issue "letsencrypt.org"` | 3600 |

> 🔒 **SECURITY** — CAA records prevent any CA *other* than the listed one from issuing certs for your domain. Without it, a misconfigured CA could issue a cert for `api.vuedine.com` to anyone.

**Pre-cutover checks:**
- [ ] TTL lowered to 60s the day before launch (lets you roll back DNS fast)
- [ ] `dig api.vuedine.com` from multiple geographies returns the new IP
- [ ] Email deliverability tested with [mail-tester.com](https://www.mail-tester.com) — score ≥ 9/10

### 🚨 Monitoring Alert Wiring

**Alertmanager routes** (`docker/prometheus/alertmanager.yml`):

```yaml
route:
  receiver: slack-default
  group_by: [alertname, severity]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match: { severity: critical }
      receiver: pagerduty
      continue: true
    - match: { severity: critical }
      receiver: slack-incidents

receivers:
  - name: slack-default
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_DEFAULT}
        channel: '#alerts'
        title: '{{ .CommonAnnotations.summary }}'
        text:  '{{ .CommonAnnotations.description }}'
  - name: slack-incidents
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_INCIDENTS}
        channel: '#incidents'
  - name: pagerduty
    pagerduty_configs:
      - service_key: ${PAGERDUTY_SERVICE_KEY}

inhibit_rules:
  - source_match: { severity: critical }
    target_match: { severity: warning }
    equal: [alertname, route]
```

**Verify each alert path** before launch — fire a synthetic alert, confirm it lands in:
- [ ] `#alerts` Slack
- [ ] `#incidents` Slack (critical only)
- [ ] PagerDuty → on-call phone (critical only)
- [ ] Status page auto-updates (if using Statuspage / Cachet)

### 📓 On-Call Runbook Template

**`docs/runbooks/<incident>.md`** — one per known failure mode. Skeleton:

```md
# Runbook: <Incident Name>

## Symptom
<What pages? What fires?>

## Severity
P1 / P2 / P3

## First 5 minutes
1. Acknowledge the alert in PagerDuty.
2. Open Grafana → "Vuedine Overview" dashboard.
3. Check the affected service's recent deploys: `gh run list --workflow deploy-production.yml --limit 5`
4. If a deploy in the last hour: rollback first, investigate after.

## Diagnostic queries
\`\`\`promql
# Error rate by route
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (route) /
sum(rate(http_requests_total[5m])) by (route)
\`\`\`

\`\`\`bash
# Slow queries
ssh prod "docker exec vuedine_postgres psql -U vuedine -c \"SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10\""
\`\`\`

## Mitigations
1. <Specific action>
2. <Escalation path>

## Resolution criteria
- Error rate < 0.5% for 10 minutes
- p99 latency back below SLO

## Post-mortem
- File template: docs/post-mortems/YYYY-MM-DD-<incident>.md
- Due within 5 business days
- Required sections: Timeline, Root cause, What went well, What didn't, Action items with owners + dates
```

**Runbooks to write before launch:**
- [ ] API 5xx spike
- [ ] Database connection pool exhaustion
- [ ] Redis unavailable
- [ ] Queue backlog (jobs piling up)
- [ ] Disk full (Postgres, logs)
- [ ] Certificate expiry
- [ ] DDoS / anomalous traffic
- [ ] Data corruption (e.g., wrong tenant id leakage detected)

### 🚒 Incident Response Plan (stub)

```mermaid
flowchart TD
    A[Alert fires] --> B{Severity?}
    B -->|P1| C[Page on-call]
    B -->|P2| D[Slack #incidents]
    B -->|P3| E[Slack #alerts]
    C --> F[Ack within 5 min]
    F --> G[Triage on Grafana]
    G --> H{Recent deploy?}
    H -->|Yes| I[Rollback]
    H -->|No| J[Apply runbook mitigation]
    I --> K[Confirm metrics recover]
    J --> K
    K --> L[Update statuspage]
    L --> M[Schedule post-mortem]
```

**Roles during a P1:**
- **Incident Commander** — coordinates, communicates, makes the rollback call
- **Operations Lead** — hands on the keyboard, runs diagnostics, applies mitigations
- **Communications Lead** — updates status page, posts to #incidents, notifies affected tenants

For a 4-engineer team, one person fills multiple roles, but they're called out so handoffs are explicit.

### ✅ `.env.production` Final Checklist

Run through every variable; tick when verified:

- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` (not debug — leaks PII and kills perf)
- [ ] `DATABASE_URL` points at PgBouncer, includes `?pgbouncer=true&connection_limit=10`
- [ ] `DATABASE_REPLICA_URL` set if using a replica for reports
- [ ] `REDIS_URL` includes TLS (`rediss://`) for managed Redis
- [ ] `REDIS_PASSWORD` set; not the default
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are unique, ≥ 64 chars, generated with `openssl rand -base64 64`, **different from staging**
- [ ] `BCRYPT_COST=12`
- [ ] `CORS_ORIGINS` lists only HTTPS production domains (no `localhost`, no `*`)
- [ ] `METRICS_AUTH_TOKEN` set; not blank
- [ ] `SMTP_*` set with verified sending domain
- [ ] `S3_*` set with bucket-scoped IAM credentials (not root keys)
- [ ] `SENTRY_DSN` populated, project linked to Sentry org
- [ ] `FEATURE_*` flags set to intended launch state
- [ ] No `*_TEST_*` or `DEMO_*` values bleeding through
- [ ] `.env.production` itself stored in Vault / 1Password / sealed-secrets, **not in the repo**

### 🎬 Final Launch Gate Checklist

Master list, all must be ticked:

#### Code & Tests
- [ ] All Phases 1–13 checklists complete
- [ ] CI green on the launch SHA
- [ ] No outstanding `Critical` or `High` security findings
- [ ] Code coverage ≥ 80%
- [ ] Postman collection works against staging end-to-end

#### Infrastructure
- [ ] Production environment provisioned (compute, DB, Redis, LB, DNS)
- [ ] Backups taken and restore tested
- [ ] PgBouncer in place if > 10 instances expected
- [ ] Read replica if reports endpoint is in scope
- [ ] Auto-scaling configured (min/max replicas)
- [ ] Container resource limits set; no unbounded processes
- [ ] Secrets in Vault / managed secret store
- [ ] TLS certs valid, A+ on SSL Labs
- [ ] DNS propagated, TTL = 60s for first week

#### Observability
- [ ] Prometheus scraping all instances
- [ ] Grafana dashboards: API overview, Queue, DB, Redis, Realtime
- [ ] Alerts firing in test → reach Slack + PagerDuty
- [ ] Logs aggregated (ELK / Loki / CloudWatch)
- [ ] Sentry receiving events, source maps uploaded
- [ ] Status page wired

#### Operations
- [ ] On-call rotation defined for first 4 weeks (heavier than steady state)
- [ ] Runbooks written for top 8 incident classes
- [ ] Post-mortem template in repo
- [ ] Incident response plan distributed
- [ ] Rollback procedure rehearsed in staging
- [ ] Database migration playbook documented (decoupled, three-step)

#### Compliance & Legal
- [ ] Privacy policy live; data retention documented
- [ ] DPA / data processing agreements with subprocessors (Sentry, SendGrid, etc.) signed
- [ ] Cookie banner / consent flow verified for EU traffic
- [ ] PCI scope minimized (no card numbers stored — tokenized via Stripe / Razorpay)
- [ ] GDPR data export + delete endpoints in place

#### Communications
- [ ] Launch announcement drafted
- [ ] Status page message ready ("Vuedine API is live")
- [ ] First-tenant onboarding doc finalized
- [ ] Support inbox monitored

---

## 🏁 Closing Notes

This document is a **roadmap, not scripture.** Every team adapts. Specific recommendations to revisit after launch:

- **Microservices:** Don't extract until you feel the pain. The feature-based monolith from Phase 0 splits cleanly when the time comes — `auth/`, `orders/`, `payments/` each become services with the same internal structure.
- **GraphQL:** Add it as a layer over the REST modules if frontends start over-fetching. The current envelope + cursor pagination map well to Relay.
- **Event sourcing for orders:** Restaurant orders fit the event-source model (pending → accepted → preparing → ready → served). When you need precise audit trails or replay, this is where to start.
- **Multi-region:** Postgres logical replication across regions, Redis active-active (Redis Enterprise / Cloudflare Hyperdrive), edge caching via Cloudflare. Plan it, don't build it until traffic warrants.
- **Schema-as-code for messaging:** When integrations multiply (Zomato, Swiggy, DoorDash), introduce Avro / Protobuf for queue payloads to make breaking changes detectable.

**The one principle to never compromise:** keep the request path stateless. Everything in this document — Redis sessions, BullMQ workers, S3 uploads, PgBouncer — exists to keep that promise. When you can `kill -9` any pod and traffic doesn't notice, you've earned the right to call it production.

— Built with care, ready to scale.
