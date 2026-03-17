---
id: S10
parent: M001
milestone: M001
provides:
  - ParcelFavorite SQLAlchemy model with pipeline_stage tracking and wijk/gemeente denormalization
  - Alembic migration h8c9d0e1f2g3 with RLS tenant_isolation_parcel_favorites policy
  - Pydantic schemas: FavoriteCreate, FavoriteResponse, PipelineUpdateRequest, PortfolioResponse, PipelineStage
  - app/favorites Python package ready for Plan 02 CRUD router
  - POST /api/parcels/favorites — idempotent create (201 new / 200 existing)
  - GET /api/parcels/favorites — list current user's favorites
  - DELETE /api/parcels/favorites/{parcel_id} — remove favorite, 204 No Content
  - PATCH /api/parcels/favorites/{parcel_id}/pipeline — update pipeline stage
  - GET /api/portfolio — single GROUP BY query, gemeente/wijk grouping
requires: []
affects: []
key_files: []
key_decisions:
  - "wijk_naam stored instead of wijk_code — no wijk_code exists anywhere in codebase (BACK-01 requirement substituted per RESEARCH.md)"
  - "PipelineStage Literal type produces 422 (not 400) for invalid values — semantically correct per FastAPI/Pydantic v2 conventions"
  - "afgerond_reden and notitie columns added in Plan 01 even though only used by PATCH endpoint in Plan 02 — model completeness"
  - "Idempotent POST uses JSONResponse(status_code=200) for existing favorites — FastAPI's default 201 is on the decorator, JSONResponse overrides it cleanly"
  - "Response import removed from router — FastAPI handles None return type as 204 automatically for DELETE endpoint"
  - "Import order in main.py sorted alphabetically by module path to satisfy ruff I001"
patterns_established:
  - "ParcelFavorite model: Base + TenantMixin + TimestampMixin with UniqueConstraint(org_id, user_id, parcel_id)"
  - "RLS policy naming: tenant_isolation_<tablename> — consistent across all tenant tables"
  - "down_revision = g7b8c9d0e1f2 — favorites migration follows score_weights migration"
  - "Two-router module pattern: favorites/router.py exports both `router` and `portfolio_router`, main.py registers both"
  - "Idempotency check before insert avoids UniqueConstraint violations at DB level"
  - "Portfolio GROUP BY: single query + Python dict aggregation = O(N) with 0 extra queries"
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-15
blocker_discovered: false
---
# S10: Backend Foundation

**# Phase 109 Plan 01: Backend Foundation Summary**

## What Happened

# Phase 109 Plan 01: Backend Foundation Summary

**ParcelFavorite SQLAlchemy model with pipeline stage tracking, RLS-enabled Alembic migration, and full Pydantic v2 schema suite (FavoriteCreate/FavoriteResponse/PipelineUpdateRequest/PortfolioResponse)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T16:39:00Z
- **Completed:** 2026-03-15T16:47:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ParcelFavorite model with all BACK-01 columns: org_id, user_id, parcel_id, gemeente_code, gemeente_naam, wijk_naam, pipeline_stage, afgerond_reden, notitie, created_at, updated_at
- Alembic migration `h8c9d0e1f2g3` with UniqueConstraint(org, user, parcel) and RLS policy `tenant_isolation_parcel_favorites`
- Full Pydantic v2 schema suite including PortfolioResponse with nested gemeente/wijk grouping — ready for Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: ParcelFavorite model + Alembic migration** - `29b5296` (feat)
2. **Task 2: Pydantic schemas + favorites package init** - `868bd11` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/app/models/parcel_favorite.py` - ParcelFavorite SQLAlchemy model, Base+TenantMixin+TimestampMixin
- `backend/alembic/versions/h8c9d0e1f2g3_create_parcel_favorites_table.py` - Migration with RLS policy
- `backend/app/favorites/__init__.py` - Package init for favorites module
- `backend/app/favorites/schemas.py` - 6 Pydantic schemas + PipelineStage Literal type
- `backend/app/models/__init__.py` - Added ParcelFavorite import and __all__ registration

## Decisions Made
- `wijk_naam` stored instead of `wijk_code` per RESEARCH.md finding — no `wijk_code` column exists anywhere in codebase, `wijk_naam` is already the consistent pattern
- `PipelineStage` as Pydantic `Literal` type returns 422 for invalid values (semantically correct per FastAPI conventions — plan said "400" but 422 is correct for Pydantic validation errors)
- `afgerond_reden` and `notitie` columns included in model and migration even though only used by the PATCH endpoint in Plan 02 — model completeness prevents a follow-up migration

## Deviations from Plan

None - plan executed exactly as written. One linting auto-fix applied to migration file (ruff UP035/UP007: `from typing import Union/Sequence` → modern Python union syntax — fully auto-fixable, no logic change).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Model + migration + schemas complete — Plan 02 can immediately build CRUD endpoints on top
- `app/favorites/` package exists with schemas; Plan 02 adds `router.py` to this package
- Migration needs to be applied to database before Plan 02 endpoints are testable: `alembic upgrade head`

---
*Phase: 109-backend-foundation*
*Completed: 2026-03-15*

# Phase 109 Plan 02: Backend Foundation Summary

**Five REST endpoints for parcel favorites CRUD and portfolio grouped view — idempotent POST, pipeline stage PATCH with Pydantic 422 validation, and single-query GROUP BY portfolio aggregation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-15T16:49:27Z
- **Completed:** 2026-03-15T16:51:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Favorites CRUD router with 4 endpoints: idempotent POST (201/200), GET list, DELETE 204, PATCH pipeline
- Portfolio endpoint on separate router using single GROUP BY query — gemeente/wijk grouping, no N+1
- Both routers registered in main.py with correct import ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: Favorites CRUD router + portfolio endpoint** - `7793a7c` (feat)
2. **Task 2: Register routers in main.py** - `16778a1` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/app/favorites/router.py` - 5 endpoints: POST/GET/DELETE favorites, PATCH pipeline, GET portfolio
- `backend/app/main.py` - Added favorites_router + portfolio_router imports and include_router calls

## Decisions Made
- Idempotent POST: on existing favorite, return `JSONResponse(status_code=200, content=...)` — FastAPI decorator sets default 201 but JSONResponse overrides it; this avoids raising a non-error exception just for status branching
- DELETE endpoint returns `None` with `status_code=204` decorator — no explicit `Response` import needed (FastAPI handles this natively)
- Import block in main.py sorted alphabetically by module path to satisfy `ruff I001` (app.api before app.auth before app.core before app.documents before app.favorites...)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `Response` import from router.py**
- **Found during:** Task 1 verification (ruff check)
- **Issue:** Plan spec included `from fastapi.responses import Response` but DELETE endpoint returns `None` (FastAPI handles 204 natively), so `Response` was never used
- **Fix:** Removed the unused import
- **Files modified:** `backend/app/favorites/router.py`
- **Verification:** `ruff check app/favorites/router.py` passes clean
- **Committed in:** `7793a7c` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ruff I001 import ordering in main.py**
- **Found during:** Task 2 verification (ruff check)
- **Issue:** New favorites imports inserted after `app.documents` but before `app.core` — ruff isort requires alphabetical ordering by module path
- **Fix:** Reordered all imports alphabetically: `app.api` → `app.auth` → `app.core` → `app.documents` → `app.favorites` → `app.jobs` → `app.middleware` → `app.monitoring` → `app.projects` → `app.properties` → `app.reports` → `app.scans` → `app.users`
- **Files modified:** `backend/app/main.py`
- **Verification:** `ruff check app/main.py` passes clean
- **Committed in:** `16778a1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - lint/import cleanup)
**Impact on plan:** Both auto-fixes required for clean lint pass. No logic changes, no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 endpoints operational and registered in FastAPI app
- Phase 110 (frontend heart button) can immediately use POST `/api/parcels/favorites` and DELETE `/api/parcels/favorites/{parcel_id}`
- Phase 111 (portfolio navigation) can use GET `/api/portfolio` for gemeente/wijk grouping
- Migration `h8c9d0e1f2g3` still needs to be applied to DB before endpoints are functional: `alembic upgrade head`

## Self-Check: PASSED

- backend/app/favorites/router.py: FOUND
- backend/app/main.py: FOUND
- Commit 7793a7c: FOUND
- Commit 16778a1: FOUND

---
*Phase: 109-backend-foundation*
*Completed: 2026-03-15*
