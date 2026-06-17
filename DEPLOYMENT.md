# Vuedine — Production Deployment Guide

Go live on a single VPS (e.g. **Hostinger KVM 2** — 2 vCPU / 8 GB RAM) with
your domain **vuedine.in**, fully containerized, with **automatic HTTPS**.

When you're done:

| URL                       | Serves                                            |
| ------------------------- | ------------------------------------------------- |
| `https://vuedine.in`      | Owner dashboard + landing                         |
| `https://vuedine.in/m/…`  | Customer guest PWA (QR ordering)                  |
| `https://api.vuedine.in`  | REST API + Socket.IO (`/docs`, `/health`)         |

Everything runs through one Caddy edge container that provisions and renews
Let's Encrypt certificates automatically. Postgres and Redis stay on the
internal Docker network — never exposed to the internet.

```
Internet ──▶ Caddy (:80/:443, auto-TLS)
                 ├── vuedine.in / www  ──▶ web   (nginx SPA)
                 └── api.vuedine.in     ──▶ api   (:4000)
                                              ├── postgres (internal)
                                              ├── redis    (internal)
                                              └── worker   (BullMQ)
```

---

## 0. TL;DR (the whole thing, in order)

```bash
# On the server, as a sudo user with Docker installed:
git clone https://github.com/ShivangKumar12/Vuedine.git /opt/vuedine
cd /opt/vuedine/deploy
cp .env.example .env && nano .env          # set domain + paste generated secrets
docker compose build                        # ~3–5 min first time
docker compose --profile tools run --rm migrate              # apply migrations
docker compose --profile tools run --rm migrate node prisma/seed.js   # first run only
docker compose up -d                        # launch (Caddy gets TLS certs)
curl -fsS https://api.vuedine.in/health     # → {"status":"ok",...}
```

The sections below explain each step (DNS, server prep, secrets, backups,
updates, hardening).

---

## 1. Prerequisites

- A VPS running **Ubuntu 22.04 or 24.04** (Hostinger KVM 2 is ideal).
- Your domain **vuedine.in** with access to its DNS records.
- SSH access to the server (Hostinger gives you `root` + the public IP).
- ~15 minutes.

---

## 2. DNS — point the domain at your server

In your domain's DNS panel (Hostinger hPanel ▸ Domains ▸ DNS), create **A
records** pointing at your VPS public IP (`SERVER_IP`):

| Type | Name  | Value (points to) | TTL  |
| ---- | ----- | ----------------- | ---- |
| A    | `@`   | `SERVER_IP`       | 3600 |
| A    | `www` | `SERVER_IP`       | 3600 |
| A    | `api` | `SERVER_IP`       | 3600 |

> DNS must resolve **before** you start Caddy, or certificate issuance fails.
> Verify: `dig +short vuedine.in api.vuedine.in` returns your IP. Allow up to
> an hour for propagation (usually minutes).

---

## 3. Server preparation

SSH in and do a one-time setup.

```bash
ssh root@SERVER_IP

# 3.1 Create a non-root sudo user (don't run the app as root)
adduser deploy
usermod -aG sudo deploy

# 3.2 Update the OS
apt update && apt -y upgrade

# 3.3 Firewall — only SSH + HTTP + HTTPS
apt -y install ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3.4 (Optional but recommended) brute-force protection
apt -y install fail2ban

# 3.5 (Optional) 2 GB swap — safety margin for image builds
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Install Docker + Compose plugin, then switch to the `deploy` user:

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
# Re-login so the group applies:
su - deploy
docker version && docker compose version    # sanity check
```

---

## 4. Get the code

```bash
sudo mkdir -p /opt/vuedine && sudo chown deploy:deploy /opt/vuedine
git clone https://github.com/ShivangKumar12/Vuedine.git /opt/vuedine
cd /opt/vuedine/deploy
```

> Private repo? Either use a GitHub deploy key, or `gh auth login`, or a
> personal access token in the clone URL. Once cloned, updates are `git pull`.

---

## 5. Configure secrets

```bash
cp .env.example .env
chmod 600 .env
```

Generate four strong secrets and paste them into `.env`:

```bash
for k in POSTGRES_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET FIELD_ENCRYPTION_KEY; do
  echo "$k=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)"
done
echo "METRICS_AUTH_TOKEN=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
```

Edit `.env` and set, at minimum:

- `DOMAIN=vuedine.in`, `API_DOMAIN=api.vuedine.in`, `ACME_EMAIL=you@vuedine.in`
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `FIELD_ENCRYPTION_KEY`, `METRICS_AUTH_TOKEN` (from above)
- `CORS_ORIGINS=https://vuedine.in,https://www.vuedine.in` (must be HTTPS)
- `SMTP_*` if you want invites / password-resets / exports / billing emails

> The app **refuses to boot** if a JWT secret is < 32 chars or if any
> `CORS_ORIGINS` entry isn't `https://` in production — that's intentional.

---

## 6. Build, migrate, seed

```bash
cd /opt/vuedine/deploy

# Build the api + web images from source (first build ~3–5 min)
docker compose build

# Start the database so migrations can run
docker compose up -d postgres redis

# Apply all Prisma migrations
docker compose --profile tools run --rm migrate

# Seed plans + a first owner (FIRST DEPLOY ONLY)
docker compose --profile tools run --rm migrate node prisma/seed.js
```

Seeding creates a demo tenant you can log in with immediately:
`owner@vuedine.demo` / `vuedine123`. **Change this password right after first
login** (Settings ▸ Profile), or reset it from the server:

```bash
docker compose --profile tools run --rm migrate node scripts/reset-owner-password.js
```

---

## 7. Launch

```bash
docker compose up -d
docker compose ps        # all services healthy
```

Caddy now requests TLS certificates for `vuedine.in`, `www.vuedine.in`, and
`api.vuedine.in`. Watch it happen:

```bash
docker compose logs -f caddy     # look for "certificate obtained successfully"
```

Verify:

```bash
curl -fsS https://api.vuedine.in/health        # {"status":"ok",...}
```

Open **https://vuedine.in**, log in, and you're live. 🎉

> First TLS issuance can take 30–60s. If it fails, your DNS isn't pointing at
> the box yet (see §2) or ports 80/443 are blocked (see §3.3).

---

## 8. Day-2 operations

### Deploy an update

```bash
cd /opt/vuedine
git pull
cd deploy
docker compose build
docker compose --profile tools run --rm migrate     # apply any new migrations
docker compose up -d                                 # rolling restart
```

### Database backups (nightly, keep 14 days)

```bash
mkdir -p /opt/vuedine/backups
cat >/opt/vuedine/backup.sh <<'EOF'
#!/usr/bin/env bash
set -e
cd /opt/vuedine/deploy
TS=$(date +%F_%H%M)
docker compose exec -T postgres pg_dump -U vuedine vuedine | gzip > /opt/vuedine/backups/vuedine_$TS.sql.gz
find /opt/vuedine/backups -name '*.sql.gz' -mtime +14 -delete
EOF
chmod +x /opt/vuedine/backup.sh
( crontab -l 2>/dev/null; echo "0 2 * * * /opt/vuedine/backup.sh" ) | crontab -
```

Restore: `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U vuedine vuedine`

### Logs & status

```bash
docker compose logs -f api worker        # app logs
docker compose ps                        # health
docker stats                             # live resource use
```

### Restart / stop

```bash
docker compose restart api worker        # restart app only
docker compose down                      # stop all (data volumes persist)
docker compose down -v                   # ⚠ also deletes Postgres/Redis data
```

---

## 9. Hardening checklist

- [ ] SSH: disable root login + password auth, use keys only
      (`/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`).
- [ ] `ufw` enabled — only 22/80/443 open (Postgres/Redis are never published).
- [ ] All five secrets in `deploy/.env` are unique, random, and ≥32 chars.
- [ ] `deploy/.env` is `chmod 600` and never committed (it's gitignored).
- [ ] Demo owner password changed; create your real tenant/owner.
- [ ] Nightly DB backups scheduled and a restore tested once.
- [ ] `SMTP_*` configured so password resets + invites actually send.
- [ ] Set up uptime monitoring on `https://api.vuedine.in/health`.
- [ ] (Optional) Sentry DSN set for error tracking.

---

## 10. Optional — automated CI/CD deploys

The repo ships GitHub Actions that build images to GHCR and deploy over SSH
(`.github/workflows/deploy-staging.yml`, `deploy-production.yml`). To use them
instead of the manual `git pull` flow:

1. Add the server's SSH key + host as repo secrets (`PROD_HOST`, `PROD_SSH_KEY`,
   `PROD_DB_URL`, `PROD_SMOKE_PASSWORD`), plus `SLACK_WEBHOOK`, `SENTRY_*`.
2. Update the image namespace in `api/docker-compose.prod.yml` from
   `ghcr.io/vuedine/*` to your GHCR namespace (`ghcr.io/shivangkumar12/vuedine/*`).
3. Create protected `staging` / `production` environments in GitHub.

For a single box and a solo operator, the manual flow in §8 is perfectly
fine — adopt CI/CD deploys when you add a second environment or teammates.

---

## 11. Troubleshooting

| Symptom                                  | Cause / fix                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| Caddy can't get a certificate            | DNS not pointing at the box yet, or 80/443 blocked. Check `dig` + `ufw`.|
| `502` from `api.vuedine.in`              | API not healthy yet: `docker compose logs api`. Usually a bad `.env`.  |
| API exits on boot with env errors        | A JWT secret < 32 chars, or a non-HTTPS entry in `CORS_ORIGINS`.       |
| Login works but realtime/orders silent   | Socket.IO blocked — confirm `CORS_ORIGINS` includes `https://vuedine.in`.|
| `migrate` step fails to reach DB          | Start data first: `docker compose up -d postgres redis`, then migrate. |
| Build OOM during `vite build`            | Add swap (§3.5).                                                       |
| Need to wipe and start over              | `docker compose down -v` then repeat §6 (this deletes all data).       |

---

## Quick reference

```bash
cd /opt/vuedine/deploy

docker compose ps                                   # status
docker compose up -d                                # start
docker compose down                                 # stop (keep data)
docker compose logs -f api worker caddy             # tail logs
docker compose build && docker compose up -d        # rebuild + restart
docker compose --profile tools run --rm migrate     # run migrations
```

— © Vuedine Engineering.
