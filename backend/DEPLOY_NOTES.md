# Railway Deploy Notes — propdex-staging

> Last deployed: 2026-06-02 (api + worker both on latest code; DB at head 7873f3326d92)

## Demo relaunch (kostenreductie) — worker uit, scrapling weg, jurisprudentie gecureerd

Goedkope investor-demo bovenop de bestaande productie-data (percelen, scores,
opgeslagen tabs, Hauzer-favorites blijven staan). Doel: interne kostenmakers
eruit, jurisprudentie-tab op accurate data.

**Wat is veranderd in de code:**

1. **Worker-service UIT.** Deploy/run alleen `api` + Postgres (+ Redis). De
   worker draaide 24/7 voor 3 nachtelijke crons (change-monitor, auto-ingest,
   BRK-cleanup) — overbodig voor een statische demo. Stop of pauzeer de
   `worker`-service in Railway. Geen serverless cron. Met de worker uit draaien
   alle dure Claude-jobs (document-samenvatting, jurisprudence-analyse,
   cascade-rescore) niet → €0. Verkenner-chat (Gemini, web-service) blijft werken.
2. **`scrapling` verwijderd** uit `pyproject.toml` + `uv.lock`; de
   `funda_listing_ingestion.fetch_html` gebruikt nu uitsluitend de httpx-fetch.
   Kleiner image → goedkopere RAM-tier. **Let op:** `uv.lock` is mee-geüpdatet;
   de Docker-build `uv sync --frozen` faalt bij lockfile-mismatch.
3. **Jurisprudentie auto-enqueue UIT** in
   `app/api/endpoints/jurisprudence.py`: `get_gemeente_rulings` en
   `trigger_ruling_analysis` queue'en geen `ruling_ingestion_job` /
   `ruling_analysis_job` meer. De web-service duwt niets meer naar de (dode)
   queue. De lees-tab `GET /api/jurisprudence/explorer` (pure DB-read uit
   `RulingCache`) blijft volledig werken.
4. **Gecureerde jurisprudentie-seed.** De oude AI-rijen in `RulingCache` voor
   Venlo waren onbetrouwbaar. Vervang ze door een geverifieerde set echte
   uitspraken (Rechtbank Limburg, gemeente Venlo als verweerder), met per zaak
   handmatig geverifieerde uitkomst/doorlooptijd/rechtsgronden/tegenstanders.

   ```bash
   # Idempotent; weigert te draaien zonder expliciete bevestiging.
   railway ssh -s api "PYTHONPATH=. python -m app.tools.seed_jurisprudence_demo --confirm"
   # lokaal: SEED_CONFIRM=1 PYTHONPATH=. python -m app.tools.seed_jurisprudence_demo
   ```
   De seed DELETE't eerst de bestaande Venlo-rijen (scoped op
   gemeente_query/extracted_gemeente == "Venlo") en upsert de gecureerde set.
5. **Migratie `zc_tegenstanders`** (idempotent, `ADD COLUMN IF NOT EXISTS`)
   backfilt de ontbrekende `ruling_cache.tegenstanders`-kolom. Veilig op prod
   (no-op als de kolom al bestaat) en nodig voor verse DB's. Draai
   `alembic upgrade head` vóór de seed.

**Smoke na deploy:** `/api/health` → 200, login werkt, percelen + opgeslagen
tabs zichtbaar, jurisprudentie-tab toont de accurate set (juiste
uitkomst/doorlooptijd), Verkenner-chat werkt, en de `worker`-service staat uit.

## Services

| Service | URL | Start Command | Status |
|---|---|---|---|
| api | `api-production-7f87.up.railway.app` | `bash scripts/start_web.sh` (via APP_MODE=web) | ✅ SUCCESS (M047→M052 code, 2026-06-02) |
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

✅ **Resolved 2026-06-02:** `api` redeployed onto M047→M052 code. Sequence used
(migrate-first, since all 11 gap migrations are additive → schema-ahead-of-code
is backward compatible):
1. `railway ssh -s worker "python -m alembic upgrade head"` — applied
   `bbdb5c6ff811` → `7873f3326d92` (M047→M052). Run from the **worker** container
   because the stale api image lacked the new migration files. The worker's
   `DATABASE_URL` connects as `postgres` (superuser), so DDL succeeds; env.py
   runs migrations async, so the asyncpg URL is fine.
2. `railway variables --set "INTEGRATION_CREDENTIAL_KEY=<fernet>" -s api` (same
   value as worker).
3. `railway up . --path-as-root -s api`.
Verified: `/api/health` → 200, `Application startup complete`, no missing-table
errors. **Both api and worker must always carry the SAME
`INTEGRATION_CREDENTIAL_KEY`.**

The daily cron (`hour=3` UTC) self-heals the data gap on its next run: the
cursor is `MAX(ChangeRecord.detected_at)`, so it fetches everything published
since the last detection in one paginated pass.

## Gotchas

1. **`railway up` uses git index** — untracked files are NOT uploaded. Always `git add` + `git commit` before deploying.
2. **`railway.json` is required** for Dockerfile builds — without it, Railway falls back to Railpack/Nixpacks autodetection.
3. **`.dockerignore` must NOT exclude `Dockerfile`** — Railway applies .dockerignore during Docker build phase.
4. **PostGIS hostname** is `postgis.railway.internal`, NOT `postgres.railway.internal`.
5. **`uv.lock` must be in sync** with `pyproject.toml` — the Dockerfile uses `uv sync --frozen` which fails on lockfile mismatch.
