# Railway Infrastructure Notes — propdex-staging

> Project ID: `697203e0-b4ea-4b8b-946e-6c817a542d39`
> Environment: `production`

## PostGIS Database

| Property | Value |
|---|---|
| Service name | `PostGIS` |
| Service ID | `4895b44e-bf43-4dff-9e7c-9ef6d110c601` |
| Image | `postgis/postgis` |
| PostGIS version | 3.7 (GEOS, PROJ, STATS enabled) |
| Internal host | `postgis.railway.internal:5432` |
| Internal URL | `postgres://postgres:<pass>@postgis.railway.internal:5432/railway` |
| Public proxy | `gondola.proxy.rlwy.net:39031` |
| Public URL | `postgres://postgres:<pass>@gondola.proxy.rlwy.net:39031/railway` |
| Database name | `railway` |
| User | `postgres` |
| Volume | `postgis-volume` mounted at `/var/lib/postgresql/data` |

### Connection URLs for app services

- **DATABASE_URL** (asyncpg, for app runtime): `postgresql+asyncpg://postgres:<pass>@postgis.railway.internal:5432/railway`
- **MIGRATION_DATABASE_URL** (sync, for Alembic): `postgresql://postgres:<pass>@postgis.railway.internal:5432/railway`
- **Public URL** (for pg_dump/pg_restore from local): `postgresql://postgres:<pass>@gondola.proxy.rlwy.net:39031/railway`

## Redis

| Property | Value |
|---|---|
| Service name | `Redis` |
| Service ID | `3465efc0-dd59-4c49-a33a-e7241d93b4e4` |
| Redis version | 8.2.1 |
| Internal host | `redis.railway.internal:6379` |
| Internal URL | `redis://default:<pass>@redis.railway.internal:6379` |
| Public proxy | `centerbeam.proxy.rlwy.net:40374` |
| Public URL | `redis://default:<pass>@centerbeam.proxy.rlwy.net:40374` |

### Connection URL for app services

- **REDIS_URL**: `redis://default:<pass>@redis.railway.internal:6379/0`

## App Services (pre-created, no deployments yet)

| Service | ID | Purpose | Start command |
|---|---|---|---|
| `api` | `d39a03e1-c62e-4bd2-b4a2-229d95e18f70` | FastAPI web server | `bash scripts/start_web.sh` |
| `worker` | `3b7eccaf-151e-4b07-a1a9-cddae390b84d` | ARQ background worker | `bash scripts/start_worker.sh` |

## Services to delete (via Railway dashboard)

These are old/duplicate services with 0 tables, no PostGIS:

- `Postgres` (ID: `2fc1b7bb-8be0-4198-bfc9-12a31ce40099`) — empty standard Postgres, no PostGIS
- `Postgres-H0JH` (ID: `fb118313-fee7-487b-ac26-43dbc4e718e5`) — empty standard Postgres, no PostGIS
- `Redis-ZDgG` (ID: `41b1add7-f46a-4af9-964c-4fe620d9abe4`) — duplicate Redis

Railway CLI does not support deleting individual services; use the dashboard at https://railway.com/project/697203e0-b4ea-4b8b-946e-6c817a542d39.

## Verification (2026-04-03)

- ✅ `SELECT PostGIS_Version()` → `3.7 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`
- ✅ Redis PING → `True` (v8.2.1)
- ✅ PostGIS extension created and operational
