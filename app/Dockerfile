# syntax=docker/dockerfile:1.7
# ============================================================
#  Vuedine Web (React + Vite SPA) — production multi-stage build.
#
#  Stages:
#    builder  — install deps, typecheck + vite build → /app/dist
#    runtime  — nginx:alpine serving the static bundle, SPA fallback,
#               gzip, long-cache for hashed assets, no-cache for index.html
#
#  Build:
#    docker build -f Dockerfile \
#      --build-arg VITE_API_URL=https://api.vuedine.com \
#      -t vuedine-web:dev .
#
#  VITE_API_URL is baked at build time (Vite inlines import.meta.env).
#  Build one image per environment, or rebuild with the right arg.
# ============================================================

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

# ---- Stage 1: builder ----
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Public API base the SPA talks to (compiled into the bundle).
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}

# `npm run build` = tsc -b (typecheck gate) + vite build.
RUN npm run build

# ---- Stage 2: runtime ----
FROM nginx:${NGINX_VERSION} AS runtime

# Drop the default site; ship our SPA-aware config.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/vuedine-web.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine already runs worker processes as the unprivileged `nginx`
# user; the master needs root to bind :80. Curl for the healthcheck.
RUN apk add --no-cache curl

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS "http://localhost:80/healthz" >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
