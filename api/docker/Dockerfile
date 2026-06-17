# syntax=docker/dockerfile:1.7
# ============================================================
#  Vuedine API — production-grade multi-stage Dockerfile.
#
#  Stages:
#    deps        — install ONLY runtime deps (no dev), generate Prisma client
#    builder     — install full deps, run lint as a build-time gate (used by CI)
#    production  — minimal runtime: alpine + node + tini + the minimum we ship
#
#  Build:
#    docker build -f docker/Dockerfile -t vuedine-api:dev .
#
#  Notes:
#    - Always run as non-root in production. A container compromise without
#      root means an attacker has to chain a kernel exploit to escape.
#    - tini is PID 1 so SIGTERM reaches Node — graceful shutdown depends on it.
#    - openssl is required by Prisma's query engine on alpine.
# ============================================================

ARG NODE_VERSION=20-alpine

# ============================================================
# Stage 1 — deps: production-only install + prisma generate.
# Keeping this stage thin minimises the final image: we only copy
# node_modules + the generated prisma client into `production`.
# ============================================================
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# OpenSSL is needed by Prisma's query engine binary on alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npm ci` is reproducible (ignores any lockfile drift).
# `--omit=dev` skips devDependencies (jest, eslint, prettier, prisma cli).
# We override the `prepare` lifecycle to a no-op so husky setup (which
# requires .git + scripts/) doesn't try to run; everything else (including
# Prisma's post-install) runs normally so transitives are pruned correctly.
# `--no-audit --no-fund` cuts ~20% off install time.
ENV npm_config_prepare=""
RUN npm pkg set scripts.prepare="echo 'skipped in build'" \
 && npm ci --omit=dev --no-audit --no-fund \
 && npx prisma generate \
 # Slim node_modules:
 # 1. Prisma CLI (`prisma`, `typescript`, `@types`) — only needed for migrate
 #    deploy which runs as an init container, not at runtime.
 # 2. Strip Prisma engine binaries / wasm for databases & platforms we never
 #    use (we use Postgres on Linux; sqlite/mysql/cockroach/sqlserver wasm
 #    bundles + react-native/edge variants ship by default).
 # 3. Drop README / CHANGELOG / test directories from every dep — pure noise.
 && rm -rf \
      node_modules/prisma \
      node_modules/typescript \
      node_modules/@types \
      node_modules/.bin/prisma \
      node_modules/.bin/tsc \
      node_modules/.bin/tsserver \
 && rm -f node_modules/@prisma/engines/schema-engine-* \
 && rm -f node_modules/@prisma/client/runtime/query_compiler_bg.cockroachdb.* \
 && rm -f node_modules/@prisma/client/runtime/query_compiler_bg.mysql.* \
 && rm -f node_modules/@prisma/client/runtime/query_compiler_bg.sqlite.* \
 && rm -f node_modules/@prisma/client/runtime/query_compiler_bg.sqlserver.* \
 && rm -f node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.* \
 && rm -f node_modules/@prisma/client/runtime/query_engine_bg.mysql.* \
 && rm -f node_modules/@prisma/client/runtime/query_engine_bg.sqlite.* \
 && rm -f node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.* \
 && rm -f node_modules/@prisma/client/runtime/react-native.* \
 && rm -f node_modules/@prisma/client/runtime/edge*.js \
 && rm -f node_modules/@prisma/client/runtime/binary.* \
 && rm -f node_modules/@prisma/client/runtime/index-browser.* \
 && rm -f node_modules/@prisma/client/runtime/wasm-*.* \
 && find node_modules -type f \( \
      -name '*.md' -o -name '*.markdown' -o \
      -name 'CHANGELOG*' -o -name 'CHANGES*' -o \
      -name 'HISTORY*' -o -name 'AUTHORS*' -o \
      -name '.eslintrc*' -o -name '.prettierrc*' -o \
      -name 'tsconfig*.json' -o -name '*.test.js' -o \
      -name '*.spec.js' -o -name '*.map' \
    \) -delete 2>/dev/null || true \
 && find node_modules -type d \( -name 'test' -o -name 'tests' -o -name '__tests__' -o -name 'docs' -o -name 'examples' \) -prune -exec rm -rf {} + 2>/dev/null || true

# ============================================================
# Stage 2 — builder: full install + lint gate.
# Not strictly required to produce the production image, but used in CI:
#   docker build --target builder ...   → fails if lint fails
# ============================================================
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && npx prisma generate
COPY . .
RUN npm run lint --silent

# ============================================================
# Stage 3 — production: lean runtime image.
# Image size target: < 250 MB. Alpine + node + node_modules is ~180 MB.
# ============================================================
FROM node:${NODE_VERSION} AS production
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    PORT=4000

# Runtime extras:
#   - openssl     — Prisma engine
#   - tini        — PID 1, propagates SIGTERM
#   - curl        — healthcheck without spawning node
#   - ca-certificates — outbound HTTPS (Sentry, Vault, S3, SMTP-on-TLS)
RUN apk add --no-cache openssl tini ca-certificates curl \
 && addgroup -S vuedine -g 1001 \
 && adduser -S vuedine -u 1001 -G vuedine

# Layer the smallest things first (rarely changing) so the layer cache
# survives most code edits.
COPY --chown=vuedine:vuedine --from=deps /app/node_modules ./node_modules
COPY --chown=vuedine:vuedine --from=deps /app/prisma       ./prisma
COPY --chown=vuedine:vuedine package.json package-lock.json ./
COPY --chown=vuedine:vuedine ecosystem.config.cjs ./
COPY --chown=vuedine:vuedine src                 ./src
COPY --chown=vuedine:vuedine scripts/bull-board.js ./scripts/bull-board.js

USER vuedine
EXPOSE 4000

# tini reaps zombies and forwards signals. Without it Node-as-PID-1 ignores
# the default SIGTERM handler — graceful shutdown never starts and the
# orchestrator escalates to SIGKILL after the grace period.
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "src/server.js"]

# Healthcheck used by docker compose / orchestrators. Uses curl (already
# installed) to keep the probe lightweight — spinning up node-for-fetch on
# every interval costs ~50ms each.
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/health" >/dev/null || exit 1
