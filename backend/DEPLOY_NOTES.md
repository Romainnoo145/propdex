# Railway Deploy Notes — propdex-staging

> Last deployed: 2026-04-03

## Services

| Service | URL | Start Command | Status |
|---|---|---|---|
| api | `api-production-7f87.up.railway.app` | `bash scripts/start_web.sh` (via APP_MODE=web) | ✅ SUCCESS |
| worker | `worker-production-3a858.up.railway.app` | `bash scripts/start_worker.sh` (via APP_MODE=worker) | ⚠️ CRASH |
| PostGIS | `postgis.railway.internal:5432` | — | ✅ SUCCESS |
| Redis | `redis.railway.internal:6379` | — | ✅ SUCCESS |

## Custom Domain

- **Domain**: `api.propdex.nl`
- **CNAME target**: `dejaqra8.up.railway.app`
- **DNS provider**: Siteground (propdex.nl zone)
- **Status**: Awaiting DNS CNAME record configuration in Siteground

## Deployment Method

Both `api` and `worker` deploy via `railway up backend/ --path-as-root -s <service>`.
This uploads only the `backend/` directory as the build root.

**Important:** Files must be git-tracked to be included in the upload. `railway up` uses git's index.

### Config-as-Code

`backend/railway.json` tells Railway to use the Dockerfile builder:
```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "./Dockerfile" }
}
```

### APP_MODE Dispatch

The Dockerfile CMD uses `APP_MODE` env var to select the start script:
- `APP_MODE=web` (default) → `scripts/start_web.sh` (Uvicorn)
- `APP_MODE=worker` → `scripts/start_worker.sh` (ARQ)

Set `APP_MODE=worker` on the worker service via Railway env vars.

## Environment Variables

### Shared (both api and worker)

- `DATABASE_URL` — `postgresql+asyncpg://...@postgis.railway.internal:5432/railway`
- `REDIS_URL` — `redis://default:...@redis.railway.internal:6379/0`
- `ENVIRONMENT=production`
- `SECRET_KEY` — generated via `openssl rand -hex 32`
- `FRONTEND_URL=https://propdex.nl`
- `CORS_ORIGINS=https://propdex.nl`
- `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN=.propdex.nl`
- `AUTH_COOKIE_PATH=/api/auth`
- API keys: BAG_API_KEY, DSO_API_KEY, EP_ONLINE_API_KEY, RUIMTELIJKE_PLANNEN_API_KEY, GOOGLE_AI_API_KEY

### api only

- `MIGRATION_DATABASE_URL` — `postgresql://...@postgis.railway.internal:5432/railway` (sync driver for Alembic)

### Not yet configured (empty locally)

- ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAIL_USERNAME, MAIL_PASSWORD

## Data Migration

Local dev data restored via:
```bash
docker exec propdex-db bash -c 'pg_dump -Fc -U postgres propdex --data-only ... -f /tmp/propdex_data.dump && PGPASSWORD=<pw> pg_restore ... -h gondola.proxy.rlwy.net -p 39031 -U postgres -d railway /tmp/propdex_data.dump'
```

Results: 28 tables, 137K parcels, 64K scan results, 16 reports, 1 user.
6 non-critical restore errors (schema mismatches for dev-only columns/tables).

## Gotchas

1. **`railway up` uses git index** — untracked files are NOT uploaded. Always `git add` + `git commit` before deploying.
2. **`railway.json` is required** for Dockerfile builds — without it, Railway falls back to Railpack/Nixpacks autodetection.
3. **`.dockerignore` must NOT exclude `Dockerfile`** — Railway applies .dockerignore during Docker build phase.
4. **PostGIS hostname** is `postgis.railway.internal`, NOT `postgres.railway.internal`.
5. **`uv.lock` must be in sync** with `pyproject.toml` — the Dockerfile uses `uv sync --frozen` which fails on lockfile mismatch.
