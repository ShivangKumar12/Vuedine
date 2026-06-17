# Vuedine

> Production-grade, multi-tenant **restaurant POS SaaS**. Owner dashboard +
> customer-facing guest PWA, real-time kitchen/order screens, payments,
> promotions, communications, reporting, third-party integrations, self-serve
> billing, and an AI co-pilot.

| Path   | Stack                                                | Description                                  |
| ------ | ---------------------------------------------------- | -------------------------------------------- |
| `api/` | Node 20 · Express · Prisma · PostgreSQL · Redis · BullMQ · Socket.IO | Backend API + background workers |
| `app/` | React 18 · TypeScript · Vite · Tailwind              | Owner dashboard + guest ordering PWA         |

---

## 🤖 Clone → paste one prompt → done

Clone the repo, open it in an AI coding agent (Kiro / Cursor / Claude Code /
etc.), and paste the prompt below. It bootstraps everything and brings the
full stack up automatically.

> **PASTE THIS PROMPT:**
>
> ```
> Set up and run the Vuedine monorepo locally, end to end, autonomously.
> Verify each step before moving on and fix any failure you hit:
>
> 1. Confirm Docker Desktop is running and Node.js 20+ is installed.
> 2. From the repo root, run the bootstrap script:
>    - Windows:  powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
>    - macOS/Linux:  bash scripts/bootstrap.sh
>    This creates api/.env + api/.env.test with fresh secrets, starts Postgres
>    + Redis in Docker, installs deps, runs Prisma migrate + seed, and provisions
>    the test database.
> 3. Start three long-running background processes (do not block on them):
>    - cd api && npm run dev            (API on http://localhost:4000)
>    - cd api && npm run start:worker   (BullMQ workers)
>    - cd app && npm run dev            (Web on http://localhost:5173)
> 4. Verify the API is healthy: GET http://localhost:4000/health returns 200.
> 5. Verify the web app loads at http://localhost:5173 and that you can log in
>    with  owner@vuedine.demo  /  vuedine123.
> 6. Run the backend integration tests:  cd api && npm run test:integration
>    (run suites individually if the full run contends on the shared test DB).
> 7. Report the final status: API health, web URL, login, and test results.
> ```

That's it. Everything below is reference detail and the manual path.

---

## ⚡ One-command quickstart (no agent)

**Prerequisites:** [Node.js 20+](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running), Git.

```bash
git clone https://github.com/ShivangKumar12/Vuedine.git
cd Vuedine

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

# macOS / Linux
bash scripts/bootstrap.sh
```

The bootstrap is **idempotent** (safe to re-run) and does all of this:

1. Verifies Node 20+ and Docker.
2. Generates `api/.env` and `api/.env.test` with fresh cryptographic secrets.
3. Starts Postgres (`:5434`) + Redis (`:6381`) via Docker.
4. Provisions the `vuedine_test` database with required extensions.
5. `npm ci` for `api` and `app`.
6. `prisma generate` → `migrate deploy` → `db:seed` (dev + test DBs).

Then start the stack (three terminals):

```bash
cd api && npm run dev            # API  → http://localhost:4000  (Swagger UI at /docs)
cd api && npm run start:worker   # BullMQ workers (separate process)
cd app && npm run dev            # Web  → http://localhost:5173
```

**Demo login:** `owner@vuedine.demo` / `vuedine123`

---

## 🚀 Going live (production)

To deploy to a real server (e.g. a Hostinger **KVM 2** VPS) on your own
domain with automatic HTTPS, follow **[DEPLOYMENT.md](./DEPLOYMENT.md)** — a
complete step-by-step runbook (DNS → server prep → secrets → build → launch →
backups → updates → hardening). The self-contained production stack lives in
[`deploy/`](./deploy) (Postgres + Redis + API + worker + web + Caddy edge).

---

## 🧱 Architecture & ports

```
                 ┌─────────────┐        ┌──────────────┐
 Browser ───────▶│  app (Vite) │        │  Guest PWA   │ /m/:branch/:table
 (dashboard)     │  :5173      │        │  (same app)  │
                 └──────┬──────┘        └──────┬───────┘
                        │  REST + Socket.IO    │
                        ▼                       ▼
                 ┌───────────────────────────────────┐
                 │           api (Express)  :4000      │  /docs  /health  /metrics
                 │  REST · Socket.IO · Prisma · zod    │
                 └───────┬───────────────┬─────────────┘
                         │               │
                  ┌──────▼─────┐   ┌──────▼──────┐    ┌──────────────┐
                  │ PostgreSQL │   │   Redis     │◀───│ worker        │ BullMQ
                  │  :5434     │   │   :6381     │    │ (no HTTP)     │ email/report/
                  └────────────┘   └─────────────┘    └──────────────┘ billing/ai/…
```

| Service         | Host port | What it is                                   |
| --------------- | --------- | -------------------------------------------- |
| API             | `4000`    | Express REST + Socket.IO (`/docs`, `/health`)|
| Web (dev)       | `5173`    | Vite dev server                              |
| Postgres        | `5434`    | Primary DB (`5432` inside container)         |
| Redis           | `6381`    | Cache · rate-limit · queues · pub/sub        |
| Bull Board      | `4001`    | Queue dashboard (`admin:admin`)              |
| nginx (compose) | `8080`/`8443` | Edge proxy / TLS (prod-style)            |
| Prometheus      | `9090`    | Metrics scrape                               |
| Grafana         | `3001`    | Dashboards (`admin` / `GRAFANA_ADMIN_PASSWORD`) |

> Unusual host ports (5434/6381/3001/…) are intentional so this stack
> coexists with other local Postgres/Redis installs.

---

## 📁 Project structure

```
Vuedine/
├─ .github/workflows/      CI, CodeQL, deploy-staging, deploy-production, release
├─ api/                    Backend
│  ├─ src/
│  │  ├─ modules/          Feature modules (repo + service + controller + routes + validators)
│  │  ├─ queues/           BullMQ queues + workers
│  │  ├─ realtime/         Socket.IO fan-out
│  │  ├─ middleware/  config/  db/  observability/  utils/
│  │  └─ docs/             OpenAPI generation
│  ├─ prisma/              schema.prisma · migrations · seed.js
│  ├─ docker/              Dockerfile(s) · nginx · postgres · prometheus · grafana
│  ├─ tests/               unit + integration (Jest + supertest)
│  └─ scripts/             audit-routes · smoke-test · bull-board · …
├─ app/                    Frontend (React + Vite)
│  ├─ src/pages/dashboard/ Owner dashboard pages
│  ├─ src/pages/guest/     Customer PWA
│  ├─ src/services/        Typed API clients
│  ├─ src/components/  lib/  stores/
│  └─ Dockerfile           nginx-served production image
└─ scripts/                bootstrap.ps1 · bootstrap.sh · setup-env.mjs
```

---

## 🔐 Environment variables

`scripts/setup-env.mjs` (run by the bootstrap) creates `api/.env` from
`api/.env.example` and fills the secret placeholders automatically. Key vars:

| Variable                  | Default (dev)                              | Notes                                       |
| ------------------------- | ------------------------------------------ | ------------------------------------------- |
| `DATABASE_URL`            | `…@localhost:5434/vuedine`                 | Matches the Docker Postgres                 |
| `REDIS_URL`               | `redis://localhost:6381`                   | Matches the Docker Redis                    |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | auto-generated               | ≥32 chars; rotate per environment           |
| `FIELD_ENCRYPTION_KEY`    | auto-generated                             | AES-256 at-rest PII encryption              |
| `CORS_ORIGINS`            | `http://localhost:5173,…`                  | Comma-separated allowlist                   |
| `BCRYPT_COST`             | `12` (dev), `4` (test)                     | Cost factor                                 |
| `SMTP_*`, `S3_*`, `SENTRY_DSN` | blank                                 | Optional; features degrade gracefully       |

The web app reads `VITE_API_URL` (defaults to `http://localhost:4000`); set it
only when the API isn't on localhost.

---

## 📜 npm scripts

**api/**

| Script                      | Purpose                                            |
| --------------------------- | -------------------------------------------------- |
| `npm run dev`               | API with hot reload (nodemon)                      |
| `npm run start:worker`      | BullMQ worker process                              |
| `npm run lint` / `lint:fix` | ESLint (`--max-warnings 0`)                        |
| `npm run test`              | Jest (all)                                         |
| `npm run test:integration`  | Integration suite (`--runInBand`)                  |
| `npm run test:coverage`     | Jest with coverage (lcov → Codecov in CI)          |
| `npm run db:seed`           | Seed demo tenant/branches/users/plans              |
| `npm run db:reset`          | Reset + reseed dev DB                              |
| `npm run prisma:migrate:deploy` | Apply migrations                               |
| `npm run docs:generate`     | Regenerate OpenAPI + Postman collection            |
| `npm run security:routes`   | Assert every v1 route is authed/allowlisted        |
| `npm run audit`             | `audit-ci` advisory gate                           |

**app/**

| Script            | Purpose                            |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Vite dev server (`:5173`)          |
| `npm run lint`    | Typecheck (`tsc --noEmit`)         |
| `npm run build`   | `tsc -b` + `vite build` → `dist/`  |
| `npm run preview` | Serve the production build locally |

---

## 🧪 Testing

```bash
cd api
npm run test:integration          # all integration suites
# A single suite (recommended when iterating):
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/integration/orders.spec.js
```

> The integration suites share one test database and reset between tests, so
> run them **individually** (or `--runInBand`) — running many parallel suites
> in one process can deadlock on the truncation step. CI runs them on real
> Postgres + Redis on Node 20 and 22.

---

## 🚀 CI/CD

Workflows live in `.github/workflows/`.

| Workflow                 | Trigger                       | Does                                                                 |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `ci.yml`                 | push/PR to `main`,`develop`   | lint · route-audit · OpenAPI doc-drift · `audit-ci` · Jest (Node 20+22) + coverage · build API image (GHCR + SBOM/provenance) · web typecheck+build · build web image |
| `codeql.yml`             | push/PR + weekly              | CodeQL SAST across `api` + `app`                                     |
| `deploy-staging.yml`     | push to `develop`             | migrate → roll `api`+`worker`+`web` over SSH → smoke test → Slack    |
| `deploy-production.yml`  | manual (`workflow_dispatch`)  | capture-for-rollback → migrate → roll → smoke (retry) → Sentry release → Slack → **auto-rollback on failure** |
| `release.yml`            | tag `v*.*.*`                  | changelog → GitHub Release → version-tag GHCR images                 |
| `renovate.json`          | schedule                      | grouped dependency PRs, security alerts fast-tracked                 |

### Required GitHub configuration (for deploys)

**Secrets** — `CODECOV_TOKEN`; `STAGING_HOST`/`STAGING_SSH_KEY`/`STAGING_DB_URL`/`STAGING_SMOKE_PASSWORD`;
`PROD_HOST`/`PROD_SSH_KEY`/`PROD_DB_URL`/`PROD_SMOKE_PASSWORD`; `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`; `SLACK_WEBHOOK`.

**Variables** — `WEB_API_URL` (API base baked into the web image).

**Environments** — create `staging` and `production`; require a reviewer and
restrict `production` to `main` + tags.

> GHCR publishing uses the built-in `GITHUB_TOKEN`. The `docker-compose.prod.yml`
> image refs use the `ghcr.io/vuedine/*` namespace — update them to your GHCR
> namespace (e.g. `ghcr.io/shivangkumar12/vuedine/*`) before the first deploy.

---

## 📈 What's measured

- **Tests + coverage** → Codecov (Node 20 run).
- **Security** → CodeQL SAST, `audit-ci` advisories, route-auth audit, image
  SBOM + provenance attestations.
- **API contract** → OpenAPI regenerated + diffed in CI; live at `/docs`.
- **Runtime** → Prometheus metrics (`/metrics`), Grafana dashboards, Sentry
  releases per prod deploy, structured JSON logs.

---

## 🛠 Troubleshooting

| Symptom                                   | Fix                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `P1001 can't reach database`              | `docker compose up -d postgres redis` (in `api/`); wait ~10s        |
| Prisma `EPERM` on `generate` (Windows)    | Stop running node processes, then `npx prisma generate`             |
| Test suite times out / deadlocks          | Run suites individually with `--runInBand`                          |
| Port already in use                       | Another stack is using 4000/5173/5434/6381 — stop it or remap       |
| Migrations out of sync after pulling      | `cd api && npx prisma migrate deploy`                               |
| Re-bootstrap from scratch                 | `cd api && docker compose down -v` then re-run the bootstrap        |

---

## License

UNLICENSED — © Vuedine Engineering.
