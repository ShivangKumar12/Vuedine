#!/usr/bin/env bash
# ============================================================
#  Vuedine — one-shot local bootstrap (macOS / Linux).
#  Run from the repo root:   bash scripts/bootstrap.sh
#  Idempotent: safe to re-run.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/api"
APP="$ROOT/app"

step() { printf '\n\033[36m=== %s ===\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$1"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

step 'Checking prerequisites'
command -v node >/dev/null || die 'Node.js 20+ is required (https://nodejs.org)'
NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20+ required (found $(node -v))"
ok "Node $(node -v)"
command -v docker >/dev/null || die 'Docker is required and must be running'
docker compose version >/dev/null 2>&1 || die 'docker compose v2 is required'
ok 'Docker present'

step 'Generating environment files'
node "$ROOT/scripts/setup-env.mjs"

step 'Starting data services (Postgres + Redis)'
cd "$API"
docker compose up -d postgres redis >/dev/null
ok 'Containers requested; waiting for Postgres to be healthy…'
READY=0
for _ in $(seq 1 40); do
  if docker exec vuedine_api_postgres pg_isready -U vuedine -d vuedine >/dev/null 2>&1; then READY=1; break; fi
  sleep 2
done
[ "$READY" = 1 ] && ok 'Postgres healthy' || warn 'Postgres not confirmed healthy — continuing'

step 'Provisioning test database (vuedine_test)'
docker exec vuedine_api_postgres psql -U vuedine -d vuedine -c "CREATE DATABASE vuedine_test" >/dev/null 2>&1 \
  && ok 'vuedine_test created' || ok 'vuedine_test already exists'
docker exec vuedine_api_postgres psql -U vuedine -d vuedine_test \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;" >/dev/null 2>&1
ok 'Extensions ensured on test DB'

step 'Installing API dependencies'
npm ci
ok 'API deps installed'

step 'Prisma: generate + migrate + seed'
unset DATABASE_URL || true
npx prisma generate >/dev/null
npx prisma migrate deploy
npm run db:seed
ok 'Dev DB migrated + seeded'

step 'Applying test migrations'
npx dotenv -e .env.test -- npx prisma migrate deploy
ok 'Test DB migrated'

step 'Installing Web dependencies'
cd "$APP"
npm ci
ok 'Web deps installed'

cat <<'EOF'

============================================================
 Vuedine is ready.
============================================================

Start the stack in three terminals:
  1) cd api && npm run dev            # API  -> http://localhost:4000  (docs: /docs)
  2) cd api && npm run start:worker   # BullMQ workers
  3) cd app && npm run dev            # Web  -> http://localhost:5173

Login: owner@vuedine.demo / vuedine123
Run tests: cd api && npm run test:integration
EOF
