# Vuedine

Production-grade, multi-tenant **restaurant POS SaaS**. Monorepo:

| Path   | Stack                                         | Description                                  |
| ------ | --------------------------------------------- | -------------------------------------------- |
| `api/` | Node 20 · Express · Prisma · Postgres · Redis | Backend API, BullMQ workers, Socket.IO       |
| `app/` | React 18 · TypeScript · Vite · Tailwind       | Owner dashboard + customer-facing guest PWA  |

Product scope (Phases A–L): branches/tables, orders + KDS + OSS, payments,
promotions, users/roles/customers, settings, QR codes, communications,
reports, integrations (Zomato/Swiggy/Razorpay/WhatsApp), SaaS billing, and
the Vuedine AI co-pilot.

---

## Local development

```bash
# API
cd api
cp .env.example .env
docker compose up -d            # Postgres + Redis + Grafana/Prometheus
npm ci
npx prisma migrate deploy
npm run db:seed                 # demo tenant: owner@vuedine.demo / vuedine123
npm run dev                     # http://localhost:4000  (docs at /docs)
npm run start:worker            # BullMQ workers (separate process)

# Web
cd app
npm ci
npm run dev                     # http://localhost:5173
```

---

## CI/CD

All pipelines live in `.github/workflows/`.

### `ci.yml` — runs on every push + PR to `main`/`develop`

| Job         | What it gates                                                                   |
| ----------- | ------------------------------------------------------------------------------- |
| `lint`      | ESLint + Prettier, **route security audit**, **OpenAPI doc-drift** gate (api)   |
| `audit`     | `audit-ci` — fails on high+ severity npm advisories                             |
| `test`      | Jest on Node 20 **and** 22 against real Postgres + Redis, coverage → Codecov    |
| `build`     | Multi-arch API image → GHCR, with SBOM + provenance attestation (push only)     |
| `web`       | Frontend typecheck (`tsc`) + production Vite build, uploads `dist` artifact     |
| `build-web` | nginx-served SPA image → GHCR, with SBOM + provenance (push only)               |

### `codeql.yml` — SAST

CodeQL `security-and-quality` suite across `api` + `app`, on push/PR and a
weekly schedule. Alerts surface under **Security ▸ Code scanning**.

### `deploy-staging.yml` — auto-deploy on push to `develop`

Waits for the CI image, runs `prisma migrate deploy` against staging, rolls
`api` + `worker` over SSH, smoke-tests, notifies Slack.

### `deploy-production.yml` — manual, environment-protected

`workflow_dispatch` with a SHA/tag. Captures the live SHA for rollback,
migrates, rolls services, smoke-tests with retries, tags a Sentry release,
notifies Slack, and **auto-rolls-back on any failure**. Requires a protected
`production` environment with required reviewers.

### `release.yml` — tag-driven (`v*.*.*`)

Generates a categorized changelog, creates a GitHub Release, and re-tags the
GHCR image with the version.

### Dependencies — `renovate.json`

Weekly grouped minor/patch PRs, individual major PRs, security alerts
fast-tracked. Prisma + pm2 majors held for manual review.

---

## What's measured

- **Tests + coverage** — Jest, reported to Codecov per run (Node 20).
- **Security** — CodeQL SAST, `audit-ci` advisories, route-auth audit
  (`npm run security:routes`), supply-chain attestations (SBOM + provenance)
  on every published image.
- **API contract** — OpenAPI spec regenerated and diffed in CI; served at
  `/docs`. Drift fails the build.
- **Runtime** — Prometheus metrics + Grafana dashboards (`api/docker/`),
  Sentry releases tagged on each prod deploy, structured JSON logs.

---

## Required GitHub configuration

Set these before staging/prod deploys work (Settings ▸ Secrets/Variables).

**Repository secrets**

| Secret                                          | Used by              |
| ----------------------------------------------- | -------------------- |
| `CODECOV_TOKEN`                                 | `ci.yml` test job    |
| `STAGING_HOST`, `STAGING_SSH_KEY`, `STAGING_DB_URL`, `STAGING_SMOKE_PASSWORD` | staging deploy |
| `PROD_HOST`, `PROD_SSH_KEY`, `PROD_DB_URL`, `PROD_SMOKE_PASSWORD`             | production deploy |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`                          | release tagging  |
| `SLACK_WEBHOOK`                                 | deploy notifications |

**Repository variables**

| Variable      | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `WEB_API_URL` | API base URL baked into the web image (`build-web`)  |

**Environments** — create `staging` and `production`; require a reviewer +
restrict `production` to `main` and tags.

GHCR publishing uses the built-in `GITHUB_TOKEN` (no extra secret).

---

## License

UNLICENSED — © Vuedine Engineering.
