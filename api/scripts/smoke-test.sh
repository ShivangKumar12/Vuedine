#!/usr/bin/env bash
# ============================================================
#  Post-deploy smoke test.
#
#  Checks:
#    1. /health returns 200 with status:ok
#    2. /ready returns 200 with status:ready (DB + Redis healthy)
#    3. Login as the dedicated smoke account succeeds and yields a JWT
#
#  Required env:
#    SMOKE_PASSWORD — password for the smoke@vuedine.demo account in the
#                     target environment. Provisioned manually.
#
#  Usage:
#    bash scripts/smoke-test.sh https://staging.api.vuedine.com
#    bash scripts/smoke-test.sh https://api.vuedine.com
#
#  Exit codes:
#    0  — all checks passed
#    1  — any check failed (CI fails the deploy and triggers rollback)
# ============================================================
set -euo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"

if [[ -z "${SMOKE_PASSWORD:-}" ]]; then
  echo "✗ SMOKE_PASSWORD env var not set"
  exit 1
fi

echo "→ smoke testing $BASE"

# 1. Health
HEALTH=$(curl -fsS "$BASE/health")
echo "  /health: $HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"' || { echo "✗ /health did not return status:ok"; exit 1; }

# 2. Ready (real DB + Redis check)
READY=$(curl -fsS "$BASE/ready")
echo "  /ready: $READY"
echo "$READY" | grep -q '"status":"ready"' || { echo "✗ /ready did not return status:ready"; exit 1; }

# 3. Auth login — proves crypto + DB write path + Redis (audit log) all work
LOGIN_BODY=$(printf '{"email":"smoke@vuedine.demo","password":"%s"}' "$SMOKE_PASSWORD")
LOGIN_RESP=$(curl -fsS -X POST -H 'Content-Type: application/json' -d "$LOGIN_BODY" "$BASE/v1/auth/login")
echo "  /v1/auth/login: $(echo "$LOGIN_RESP" | head -c 80)..."
echo "$LOGIN_RESP" | grep -q '"accessToken"' || { echo "✗ login did not return accessToken"; exit 1; }

echo "✓ smoke tests passed"
