#!/usr/bin/env bash
# ============================================================
#  Production migration runner.
#
#  Used as the migration step in CI deploy workflows AND as a manual escape
#  hatch on the prod host. The CI step uses `prisma migrate deploy` directly
#  for tighter logs; this wrapper exists so a human can run the same step
#  with the right env in an emergency.
#
#  Usage on host:
#    DATABASE_URL=postgresql://... bash /opt/vuedine/scripts/migrate.sh
#
#  Migration philosophy:
#    - Forward-only. Don't ever run `prisma migrate reset` against prod.
#    - Decouple schema-breaking changes from code releases:
#        Step 1: deploy code that doesn't read the column
#        Step 2: wait for old replicas to drain
#        Step 3: this script — migration drops the column
# ============================================================
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "✗ DATABASE_URL is required"
  exit 1
fi

# Mask the URL in logs — never print credentials.
SAFE_URL=$(echo "$DATABASE_URL" | sed -E 's#://[^@]+@#://***:***@#')
echo "→ applying migrations against $SAFE_URL"

cd "$(dirname "$0")/.."

npx --yes prisma migrate deploy

# Optional: print pending migration count for the operator (zero after deploy).
PENDING=$(npx --yes prisma migrate status --schema prisma/schema.prisma 2>/dev/null \
  | grep -c "have not yet been applied" || true)

if [[ "$PENDING" -ne 0 ]]; then
  echo "⚠️  $PENDING migrations still pending — check connection string and retry"
  exit 1
fi

echo "✓ migrations applied"
