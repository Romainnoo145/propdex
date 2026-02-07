---
phase: 02-core-data-pipeline
plan: 01
subsystem: infrastructure
tags: [httpx, http2, caching, postgresql, jsonb, ttl]
requires:
  - phase: 01-foundation-authentication
    provides: FastAPI app, SQLAlchemy models, Alembic migrations, tenant isolation
provides:
  - Shared httpx AsyncClient via FastAPI lifespan
  - CachedAPIResponse model with JSONB storage and TTL metadata
  - Cache manager with get_cached_or_fetch() and invalidate_cache()
  - BAG_API_KEY configuration
  - CACHE_TTL constants (bag: 24h, kadaster: 7d, bestemmingsplan: 90d)
affects: [02-02, 02-03, 03-zoning-monument]
tech-stack:
  added: [httpx[http2]]
  patterns:
    - FastAPI lifespan for shared resource management
    - JSONB caching with TTL-based invalidation
    - Connection pooling with HTTP/2 support
    - Multi-tenant cache isolation
key-files:
  created:
    - backend/app/core/http_client.py
    - backend/app/models/cached_response.py
    - backend/app/services/__init__.py
    - backend/app/services/cache_manager.py
    - backend/alembic/versions/3bcf6784f5b4_add_cached_api_responses_table.py
  modified:
    - backend/pyproject.toml
    - backend/app/main.py
    - backend/app/core/config.py
    - backend/app/models/__init__.py
key-decisions:
  - decision: Use FastAPI lifespan instead of startup/shutdown events
    rationale: Modern FastAPI best practice; ensures proper async context management
    impact: All government API clients can share a single httpx AsyncClient instance
  - decision: Store cache in PostgreSQL JSONB instead of Redis
    rationale: Reduces infrastructure complexity for MVP; leverages existing database
    impact: Cache survives app restarts; multi-tenant isolation via RLS; no Redis dependency
  - decision: Source-specific TTL stored per cache entry
    rationale: Allows runtime TTL adjustments; supports different staleness tolerances per source
    impact: Can tune cache behavior per API without code changes
  - decision: Fix setuptools package discovery
    rationale: Multiple top-level packages (app, sql, alembic) caused build errors
    impact: Explicitly specify packages=["app"] to avoid accidental inclusion
patterns-established:
  - Shared httpx client on app.state, passed to API service classes
  - JSONB cache with composite index on (organization_id, cache_key)
  - CacheResult dataclass with cache hit metadata (age_seconds, is_cached)
  - Direct db.add()/flush()/commit() transaction pattern (no async with db.begin())
duration: 3 minutes
completed: 2026-02-07
---

# Phase 02 Plan 01: HTTP Client and Cache Infrastructure Summary

**One-liner:** Shared httpx AsyncClient with HTTP/2 connection pooling and PostgreSQL JSONB cache with source-specific TTL invalidation.

## What Was Built

Created the foundational HTTP client and caching infrastructure that all government API integrations (BAG, Kadaster, PDOK) will use in Phase 2.

### HTTP Client Infrastructure

- **Shared httpx AsyncClient** via FastAPI lifespan context manager
  - Connection pooling: 20 keepalive connections, 100 max connections
  - Timeouts: 5s connect, 10s read, 5s write, 5s pool
  - HTTP/2 enabled with automatic redirect following
  - Created on app startup, closed on shutdown
  - Stored on `app.state.http_client` for access by API clients

- **Configuration**
  - BAG_API_KEY setting for Kadaster Individuele Bevragingen API
  - CACHE_TTL constants: bag (24h), kadaster (7d), bestemmingsplan (90d)
  - Added httpx[http2]>=0.27.0 to main dependencies

### Cache Layer

- **CachedAPIResponse Model**
  - JSONB response_data column for flexible API response storage
  - TTL metadata: fetched_at timestamp, ttl_seconds for per-entry TTL
  - Multi-tenant isolation via organization_id (TenantMixin)
  - Composite index on (organization_id, cache_key) for fast lookups
  - Unique constraint supports upsert pattern in cache_manager
  - Timestamps via TimestampMixin (created_at, updated_at)

- **Cache Manager Service**
  - `get_cached_or_fetch()`: TTL-based cache-or-fetch with metadata
    - Returns CacheResult with data, cached_at, age_seconds, is_cached
    - Checks cache freshness: age < ttl_seconds
    - On cache miss/stale: calls fetch_fn, upserts to cache, returns fresh data
    - Uses direct db.add()/flush()/commit() transaction pattern
  - `invalidate_cache()`: Manual cache clearing by key + org_id
  - Multi-tenant isolated: all queries filter by organization_id

### Database Migration

- Alembic migration `3bcf6784f5b4_add_cached_api_responses_table.py`
- Table: cached_api_responses with 9 columns (id, cache_key, source, response_data, fetched_at, ttl_seconds, organization_id, created_at, updated_at)
- Indexes: ix_cached_responses_org_key (composite), ix_source, ix_organization_id
- Constraint: uq_cached_responses_org_key (organization_id, cache_key)

## Task Commits

| Task | Name                                         | Commit  | Files                                                                                  |
| ---- | -------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| 1    | HTTP client infrastructure and configuration | 4f2c5c6 | pyproject.toml, main.py, config.py, http_client.py                                     |
| 2    | Cache model, migration, and cache manager    | 2208c48 | cached_response.py, models/__init__.py, cache_manager.py, services/__init__.py, migration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed setuptools package discovery error**

- **Found during:** Task 1, pip install -e .
- **Issue:** Multiple top-level packages (app, sql, alembic) caused setuptools build error
- **Fix:** Added `[tool.setuptools] packages = ["app"]` to pyproject.toml to explicitly specify package
- **Files modified:** backend/pyproject.toml
- **Commit:** 4f2c5c6 (included in Task 1 commit)

**2. [Rule 1 - Bug] Removed unused imports**

- **Found during:** Task 1, ruff check
- **Issue:** field_validator and _rate_limit_exceeded_handler were imported but unused
- **Fix:** Removed both unused imports from config.py and main.py
- **Files modified:** backend/app/core/config.py, backend/app/main.py
- **Commit:** 4f2c5c6 (included in Task 1 commit)

## Decisions Made

### 1. FastAPI Lifespan Over Startup/Shutdown Events

**Context:** FastAPI has deprecated startup/shutdown event decorators in favor of lifespan context managers.

**Decision:** Use `@asynccontextmanager` lifespan pattern for httpx client lifecycle.

**Rationale:**
- Modern FastAPI best practice (recommended in docs)
- Proper async context management guarantees cleanup on errors
- Single location for all startup/shutdown logic

**Impact:**
- httpx AsyncClient created on app startup, closed on shutdown
- Connection pool persists across requests (significant performance improvement)
- Future shared resources (Redis, background tasks) use same pattern

### 2. PostgreSQL JSONB Cache Instead of Redis

**Context:** Could use Redis for cache, but adds infrastructure dependency.

**Decision:** Store cache in PostgreSQL using JSONB columns.

**Rationale:**
- Leverages existing database (no Redis container for MVP)
- Cache survives app restarts (persistence is free)
- Multi-tenant isolation via RLS (same security model as other tables)
- JSONB queries are fast enough for cache lookups

**Trade-offs:**
- Slower than Redis (acceptable for MVP with 24h+ TTLs)
- Uses database connections (mitigated by async pooling)
- No Redis-specific features (pub/sub, atomic operations)

**Impact:**
- Simpler deployment (one fewer service to manage)
- Cache data visible in database for debugging
- Future: Can add Redis layer if performance requires it

### 3. Source-Specific TTL Stored Per Entry

**Context:** Different APIs have different data volatility (BAG changes daily, zoning plans change yearly).

**Decision:** Store ttl_seconds as column on each cache entry, lookup from CACHE_TTL dict.

**Rationale:**
- Allows runtime TTL tuning without code changes
- Can override TTL for specific entries if needed
- Supports different staleness tolerances per source

**Impact:**
- More flexible than global TTL or source-only TTL
- Can extend to per-endpoint TTL later (e.g., "bag:nummeraanduiding" vs "bag:pand")
- Cache age metadata helps debugging stale data issues

### 4. Package Discovery Fix

**Context:** setuptools auto-discovery found multiple top-level packages (app, sql, alembic) and refused to build.

**Decision:** Explicitly set `packages = ["app"]` in pyproject.toml.

**Rationale:**
- setuptools flat-layout auto-discovery is fragile
- Explicit is better than implicit (Python zen)
- Prevents accidental inclusion of test files, scripts, etc.

**Impact:**
- pip install -e . now works reliably
- Clear ownership: only `app/` is the package
- Future: Consider src-layout if package structure grows

## Next Phase Readiness

### Ready For

- **02-02 BAG API Client:** httpx client ready, cache infrastructure ready
- **02-03 Kadaster API Client:** Same infrastructure, different TTL (7d)
- **03-zoning-monument:** Bestemmingsplan cache with 90d TTL

### Blockers

None.

### Concerns

1. **JSONB cache performance:** Not tested under load. May need Redis if cache queries become bottleneck.
   - Mitigation: Composite index on (organization_id, cache_key) should be fast
   - Monitoring: Add query timing metrics in future phase

2. **Cache eviction strategy:** No LRU or size limits. Old cache entries accumulate indefinitely.
   - Impact: Low for MVP (few orgs, bounded API calls)
   - Future: Add periodic cleanup job or cache size monitoring

3. **HTTP/2 compatibility:** Some government APIs may not support HTTP/2.
   - Mitigation: httpx gracefully falls back to HTTP/1.1
   - Testing: Verify with actual PDOK/BAG API calls in next plan

## Testing Notes

### Verified

- httpx client factory creates AsyncClient with correct config
- FastAPI app loads without errors (lifespan works)
- BAG_API_KEY loadable from settings (empty string in dev)
- CACHE_TTL dict has correct values
- CachedAPIResponse table exists with all 9 columns
- Cache manager functions importable with correct signatures
- All code passes ruff check

### Not Tested

- Actual cache hit/miss behavior (requires database queries in tests)
- HTTP/2 negotiation with real government APIs
- Cache invalidation across multiple tenants
- Connection pool behavior under concurrent requests

**Test plan for 02-02:**
- Mock BAG API calls to test cache_manager get_cached_or_fetch()
- Verify TTL-based expiration works correctly
- Test multi-tenant cache isolation

## File Inventory

### Created Files (5)

1. **backend/app/core/http_client.py** (30 lines)
   - Factory function for shared httpx AsyncClient
   - Connection pooling, timeouts, HTTP/2 config

2. **backend/app/models/cached_response.py** (56 lines)
   - CachedAPIResponse SQLAlchemy model
   - JSONB response_data, TTL metadata, multi-tenant isolation

3. **backend/app/services/__init__.py** (1 line)
   - Empty package file for services module

4. **backend/app/services/cache_manager.py** (143 lines)
   - get_cached_or_fetch() with TTL-based invalidation
   - invalidate_cache() for manual clearing
   - CacheResult dataclass for cache metadata

5. **backend/alembic/versions/3bcf6784f5b4_add_cached_api_responses_table.py** (auto-generated)
   - Migration for cached_api_responses table

### Modified Files (4)

1. **backend/pyproject.toml**
   - Added httpx[http2]>=0.27.0 to dependencies
   - Added [tool.setuptools] packages = ["app"]

2. **backend/app/main.py**
   - Added lifespan context manager for httpx client
   - Removed unused import (_rate_limit_exceeded_handler)

3. **backend/app/core/config.py**
   - Added BAG_API_KEY setting
   - Added CACHE_TTL constants
   - Removed unused import (field_validator)

4. **backend/app/models/__init__.py**
   - Imported and exported CachedAPIResponse

## Lessons Learned

1. **setuptools package discovery is fragile:** Flat-layout auto-discovery breaks with scripts/migration folders. Explicit `packages=` configuration prevents build errors.

2. **FastAPI lifespan is the modern pattern:** Replaces startup/shutdown events. Cleaner async context management, better error handling.

3. **JSONB is viable for cache:** PostgreSQL JSONB + composite indexes provide acceptable cache performance for MVP without Redis complexity.

4. **TTL metadata in cache entries is flexible:** Storing ttl_seconds per entry (not just globally) allows runtime tuning and per-source configuration.

## Self-Check: PASSED

All created files exist:
- backend/app/core/http_client.py ✓
- backend/app/models/cached_response.py ✓
- backend/app/services/__init__.py ✓
- backend/app/services/cache_manager.py ✓
- backend/alembic/versions/3bcf6784f5b4_add_cached_api_responses_table.py ✓

All commits exist:
- 4f2c5c6 ✓
- 2208c48 ✓
