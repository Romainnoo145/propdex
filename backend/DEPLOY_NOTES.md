# Railway Deploy Notes — propdex-staging

> Last deployed: 2026-04-03 (api) · 2026-06-02 (worker — crash-loop fixed)

## Services

| Service | URL | Start Command | Status |
|---|---|---|---|
| api | `api-production-7f87.up.railway.app` | `bash scripts/start_web.sh` (via APP_MODE=web) | ✅ SUCCESS (⚠️ stale pre-M050 image — see Worker crash-loop note) |
| worker | `worker-production-3a858.up.railway.app` | `bash scripts/start_worker.sh` (via APP_MODE=worker) | ✅ SUCCESS (fixed 2026-06-02) |
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

## Worker crash-loop (fixed 2026-06-02)

The `worker` service crash-looped from the 2026-04-03 deploy until 2026-06-02,
silently freezing the daily `change_monitor` cron — prod gemeentesignalen were
stale from early April to June. Two compounding causes:

1. **Redis private-network boot race.** arq's `create_pool()` pings
   `redis.railway.internal` immediately at boot, but Railway's IPv6 private
   network needs a few seconds to resolve. arq's default retry window
   (`conn_retries=5 × conn_retry_delay=1` ≈ 5s) lost the race every boot.
   **Fix:** bumped to `conn_retries=20 × conn_retry_delay=2` (~40s) in
   `get_redis_settings()` (`app/jobs/worker.py`). Regression test:
   `tests/unit/test_worker_redis_settings.py`.

2. **Missing `INTEGRATION_CREDENTIAL_KEY`.** After the Redis fix the worker
   crashed earlier, at `Settings()` validation: the M050 BRK integration added
   a *required* Fernet key that was never set on the worker. Set it via
   `railway variables --set "INTEGRATION_CREDENTIAL_KEY=<fernet>" -s worker`.
   Prod had no encrypted `integration_credentials` rows (feature postdates the
   2026-04-03 data migration), so any valid Fernet key boots safely.

⚠️ **The `api` service is still on a stale pre-M050 image** — it stays up only
because that image predates `INTEGRATION_CREDENTIAL_KEY`. **Before redeploying
`api`, set the SAME `INTEGRATION_CREDENTIAL_KEY` on it** (must match the worker /
whatever encrypted any `integration_credentials`), or it will crash on boot.

The daily cron (`hour=3` UTC) self-heals the data gap on its next run: the
cursor is `MAX(ChangeRecord.detected_at)`, so it fetches everything published
since the last detection in one paginated pass.

## Gotchas

1. **`railway up` uses git index** — untracked files are NOT uploaded. Always `git add` + `git commit` before deploying.
2. **`railway.json` is required** for Dockerfile builds — without it, Railway falls back to Railpack/Nixpacks autodetection.
3. **`.dockerignore` must NOT exclude `Dockerfile`** — Railway applies .dockerignore during Docker build phase.
4. **PostGIS hostname** is `postgis.railway.internal`, NOT `postgres.railway.internal`.
5. **`uv.lock` must be in sync** with `pyproject.toml` — the Dockerfile uses `uv sync --frozen` which fails on lockfile mismatch.
