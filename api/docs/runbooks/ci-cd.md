# CI/CD runbook

Last reviewed: 2026-06-09

## Pipeline at a glance

```
              push to PR / develop / main
                       │
                       ▼
              ┌─────────────────────┐
              │  ci.yml             │
              │   ├─ lint           │
              │   ├─ audit          │
              │   ├─ test (20+22)   │
              │   └─ build (push)   │
              └─────────────────────┘
                       │
              ┌────────┴────────────┐
              ▼                     ▼
       push to develop       push to main / tag
              │                     │
              ▼                     ▼
   deploy-staging.yml      manual workflow_dispatch
       (auto)             ┌──────────────────────┐
                          │ deploy-production    │
                          │  (env: production)   │
                          │   ├─ approval gate   │
                          │   ├─ migrate         │
                          │   ├─ roll services   │
                          │   ├─ smoke (5x)      │
                          │   ├─ sentry release  │
                          │   └─ rollback?       │
                          └──────────────────────┘

   tag push
       │
       ▼
   release.yml — generate changelog + GitHub release
```

## Required GitHub secrets

Set these at the repo **and** environment level (not as repo-only — environment
secrets are masked in `production` runs even from `staging` workflows).

| Secret                   | Workflow          | Notes                                          |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `CODECOV_TOKEN`          | ci                | optional; CI tolerates a 4xx from Codecov      |
| `STAGING_HOST`           | deploy-staging    | DNS or IP of staging host (SSH target)         |
| `STAGING_SSH_KEY`        | deploy-staging    | private key for `deploy@$STAGING_HOST`         |
| `STAGING_DB_URL`         | deploy-staging    | for prisma migrate                             |
| `STAGING_SMOKE_PASSWORD` | deploy-staging    | password for smoke@vuedine.demo on staging     |
| `PROD_HOST`              | deploy-production | DNS or IP of prod host                         |
| `PROD_SSH_KEY`           | deploy-production | private key for `deploy@$PROD_HOST`            |
| `PROD_DB_URL`            | deploy-production | for prisma migrate                             |
| `PROD_SMOKE_PASSWORD`    | deploy-production | password for smoke@vuedine.demo on prod        |
| `SENTRY_AUTH_TOKEN`      | deploy-production | tag a release + upload commits                 |
| `SENTRY_ORG`             | deploy-production | sentry org slug                                |
| `SENTRY_PROJECT`         | deploy-production | sentry project slug                            |
| `SLACK_WEBHOOK`          | deploys + release | post-deploy / failure / rollback notifications |

## Environment protection rules (REQUIRED before first prod deploy)

In GitHub → Settings → Environments → `production`:

1. **Required reviewers**: at least one human from the `@vuedine/admins` team.
   The deployer cannot self-approve.
2. **Wait timer**: 5 minutes (lets a panicked operator cancel without
   pulling secrets).
3. **Deployment branches**: `main` and tag patterns `v*.*.*` only — never
   `develop` or feature branches.

For `staging` use:

- **Required reviewers**: none (auto-deploy)
- **Deployment branches**: `develop` only

## SSH user setup on hosts

On each environment host, the workflows expect a `deploy` user with:

- Membership in the `docker` group (no sudo for `docker compose`)
- `~deploy/.ssh/authorized_keys` containing the matching public key
- A working directory at `/opt/vuedine` containing `docker-compose.yml`
  and `docker-compose.prod.yml` (or symlinks to repo checkouts)

## How to deploy production

```bash
# Find the SHA you want to ship (must be in GHCR — i.e. came through ci.yml)
git log --oneline -10

# Trigger the workflow
gh workflow run deploy-production.yml -f sha=abc1234

# Watch it
gh run watch
```

GitHub will pause for the manual approval; the requested reviewer gets a
notification. After approval, the rest of the pipeline runs unattended.

## How to roll back

Three escape hatches, in order of preference:

1. **Auto-rollback (free).** A failed `smoke-test` or any other failed
   step in `deploy-production.yml` triggers the `rollback` job
   automatically. `previous_sha` is captured at the start of the deploy
   from `/opt/vuedine/.deployed-sha` on the host.

2. **Re-deploy a previous SHA.** `gh workflow run deploy-production.yml -f sha=<previous>`
   — same approval gate applies; same migration step runs (Prisma
   migrate-deploy is idempotent). Recommended when you need to roll back
   AND the rollback target lives on a different schema (the migrate step
   will be a no-op if no new migrations exist).

3. **Manual host rollback.** SSH into the host and run:
   ```bash
   sudo -u deploy bash /opt/vuedine/scripts/rollback.sh [target_sha]
   ```
   This skips the GitHub workflow entirely. **Risky** — no migration
   coordination, no Slack notification, no Sentry release update. Use
   only when GitHub is degraded.

## Migration coordination

Prisma migrations are forward-only. To revert a column drop in production:
write a _new_ migration adding the column back. Never use
`prisma migrate reset` on prod.

For schema changes that break old code:

1. **Day 1**: deploy code that no longer reads/writes the to-be-dropped
   column (column still exists; new code tolerates its absence).
2. **Day 2**: wait for the deploy to fully roll out — every replica must be
   on the new code.
3. **Day 3**: deploy the migration that drops the column.

Three deploys, three days. Boring. The boring path is the safe path.

## Common failure modes

### "wait-on-check-action" times out

The CI build job hasn't pushed yet. Check `gh run list` for the relevant
SHA — if CI is still running, the deploy waits up to 60 minutes by default.
If CI failed, fix the underlying issue and push again.

### Migrations fail with "P3009"

Prisma tracks failed migrations in `_prisma_migrations`. If a previous
attempt left a row marked failed, `prisma migrate deploy` refuses to
proceed. Resolution:

```bash
DATABASE_URL=$PROD_DB_URL npx prisma migrate resolve --rolled-back <migration-name>
```

Then re-run the deploy.

### Smoke test passes but the app starts erroring after 5 minutes

Likely a Redis or DB connection pool exhaustion. Check:

- `/metrics` for `http_request_duration_seconds` p99
- Container logs: `docker compose logs --tail=200 api`
- Worker logs: `docker compose logs --tail=200 worker`

If it's a regression in the new SHA, run the manual rollback script.

## See also

- `.github/workflows/ci.yml` — lint + test + build
- `.github/workflows/deploy-staging.yml` — auto-deploy
- `.github/workflows/deploy-production.yml` — gated deploy + auto-rollback
- `.github/workflows/release.yml` — tag-driven changelog + image re-tag
- `scripts/smoke-test.sh` — used by both deploy workflows
- `scripts/rollback.sh` — manual host-side escape hatch
- `scripts/migrate.sh` — manual migration runner
- `audit-ci.json` — supply chain gate
