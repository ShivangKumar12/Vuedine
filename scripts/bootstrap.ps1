# ============================================================
#  Vuedine — one-shot local bootstrap (Windows / PowerShell).
#  Run from the repo root:   powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1
#  Idempotent: safe to re-run.
# ============================================================
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/.."
$api = Join-Path $root 'api'
$app = Join-Path $root 'app'

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  ✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }

Step 'Checking prerequisites'
$node = (node -v) 2>$null
if (-not $node) { Write-Error 'Node.js 20+ is required. Install from https://nodejs.org'; exit 1 }
$major = [int]($node.TrimStart('v').Split('.')[0])
if ($major -lt 20) { Write-Error "Node 20+ required (found $node)"; exit 1 }
Ok "Node $node"
try { docker --version | Out-Null; Ok 'Docker present' } catch { Write-Error 'Docker Desktop is required and must be running.'; exit 1 }
try { docker compose version | Out-Null } catch { Write-Error 'docker compose v2 is required.'; exit 1 }

Step 'Generating environment files'
node "$PSScriptRoot/setup-env.mjs"

Step 'Starting data services (Postgres + Redis)'
Push-Location $api
docker compose up -d postgres redis | Out-Null
Ok 'Containers requested; waiting for Postgres to be healthy…'
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    docker exec vuedine_api_postgres pg_isready -U vuedine -d vuedine 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if ($ready) { Ok 'Postgres healthy' } else { Warn 'Postgres not confirmed healthy — continuing, migrations may retry' }

Step 'Provisioning test database (vuedine_test)'
try {
  docker exec vuedine_api_postgres psql -U vuedine -d vuedine -c "CREATE DATABASE vuedine_test" 2>$null | Out-Null
  Ok 'vuedine_test created'
} catch { Ok 'vuedine_test already exists' }
docker exec vuedine_api_postgres psql -U vuedine -d vuedine_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gin;" 2>$null | Out-Null
Ok 'Extensions ensured on test DB'
Pop-Location

Step 'Installing API dependencies'
Push-Location $api
npm ci
Ok 'API deps installed'

Step 'Prisma: generate + migrate + seed'
$env:DATABASE_URL = $null
npx prisma generate | Out-Null
npx prisma migrate deploy
npm run db:seed
Ok 'Dev DB migrated + seeded'

Step 'Applying test migrations'
npx dotenv -e .env.test -- npx prisma migrate deploy
Ok 'Test DB migrated'
Pop-Location

Step 'Installing Web dependencies'
Push-Location $app
npm ci
Ok 'Web deps installed'
Pop-Location

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " Vuedine is ready." -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
Write-Host "Start the stack in three terminals:" -ForegroundColor White
Write-Host "  1) cd api && npm run dev            # API  -> http://localhost:4000  (docs: /docs)"
Write-Host "  2) cd api && npm run start:worker   # BullMQ workers"
Write-Host "  3) cd app && npm run dev            # Web  -> http://localhost:5173"
Write-Host "`nLogin: owner@vuedine.demo / vuedine123"
Write-Host "Run tests: cd api && npm run test:integration`n"
