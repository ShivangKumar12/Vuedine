#!/usr/bin/env bash
# ============================================================
#  Manual rollback helper — operator escape hatch.
#
#  Three rollback modes, in order of preference:
#    1. Auto-rollback (built into deploy-production.yml) — happens on smoke
#       failure without operator action.
#    2. This script — invoke manually when prod is unhappy AFTER a deploy
#       that passed smoke tests but degraded later.
#    3. `gh workflow run deploy-production.yml -f sha=<previous>` — triggers
#       the full deploy pipeline against a previous SHA (preferred for
#       changes that span code + migrations).
#
#  Run on the prod host:
#    sudo -u deploy bash /opt/vuedine/scripts/rollback.sh [target_sha]
#
#  If no target_sha is given, reads /opt/vuedine/.deployed-sha.bak (the
#  N-1 SHA written before the latest deploy started).
# ============================================================
set -euo pipefail

cd /opt/vuedine

CURRENT="$(cat /opt/vuedine/.deployed-sha 2>/dev/null || echo unknown)"
TARGET="${1:-$(cat /opt/vuedine/.deployed-sha.bak 2>/dev/null || echo)}"

if [[ -z "$TARGET" ]]; then
  echo "✗ no rollback target (pass SHA as arg, or write one to /opt/vuedine/.deployed-sha.bak)"
  exit 1
fi

if [[ "$TARGET" == "$CURRENT" ]]; then
  echo "→ already on $TARGET — nothing to do"
  exit 0
fi

echo "→ rolling: $CURRENT → $TARGET"

export IMAGE_TAG="$TARGET"

docker compose pull api worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --no-deps api worker

# Save what we just rolled to as the "current". The previous current
# becomes the .bak so a second rollback returns to the original.
echo "$CURRENT" > /opt/vuedine/.deployed-sha.bak
echo "$TARGET"  > /opt/vuedine/.deployed-sha

# Brief health probe so the operator gets immediate feedback.
sleep 8
if curl -fsS http://localhost:4000/health > /dev/null; then
  echo "✓ rolled back to $TARGET"
else
  echo "⚠️  /health not yet OK — investigate logs: docker compose logs -f --tail=50 api"
  exit 2
fi
