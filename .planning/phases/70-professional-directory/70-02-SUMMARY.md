---
phase: 70-professional-directory
plan: "02"
subsystem: api
tags: [fastapi, pydantic, admin-api, rate-limiting, postgresql-array]

# Dependency graph
requires:
  - phase: 70-01
    provides: Professional SQLAlchemy model + ADMIN_API_KEY config

provides:
  - GET /api/professionals with gemeente + gevolgklasse ARRAY filter (authenticated users)
  - POST /api/professionals (admin CRUD via X-Admin-Key header, returns 201)
  - PUT /api/professionals/{id} partial update (admin, X-Admin-Key)
  - DELETE /api/professionals/{id} soft-delete (admin, X-Admin-Key, returns 204)
  - ProfessionalCreate, ProfessionalUpdate, ProfessionalResponse, ProfessionalListResponse Pydantic schemas
  - 11 unit tests covering auth, filters, admin CRUD, and edge cases

affects: [70-03-frontend-directory, 71-lead-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin API key gate: require_admin_key dependency checks settings.ADMIN_API_KEY; empty string disables all admin endpoints"
    - "ARRAY filter varchar cast: gevolgklassen @> ARRAY[:gk]::varchar[] required for character varying[] columns (not ::text[])"
    - "Gemeente ANY filter: (:gemeente) = ANY(werkgebied) using bindparams for safe parameterized query"
    - "Soft delete: DELETE endpoint sets is_active=False, GET list always filters WHERE is_active = TRUE"
    - "Rate limits: 30/min on GET list, 10/min on admin endpoints (POST/PUT/DELETE)"

key-files:
  created:
    - backend/app/schemas/professional.py
    - backend/app/professionals/__init__.py
    - backend/app/professionals/router.py
    - backend/tests/unit/test_professionals_router.py
  modified:
    - backend/app/main.py

key-decisions:
  - "require_admin_key uses Header(alias='X-Admin-Key') — empty ADMIN_API_KEY disables ALL admin access (fail-secure default)"
  - "gevolgklasse filter uses ::varchar[] cast (not ::text[]) — consistent with Plan 01 cross-tenant test fix for character varying[] columns"
  - "Gemeente filter uses ANY() (not @> ARRAY) — single value lookup vs containment check for array columns"
  - "test_create_professional_requires_admin_key accepts 403 or 422 — FastAPI returns 422 for missing required header before dependency runs"

patterns-established:
  - "Admin-gated CRUD: require_admin_key FastAPI dependency for X-Admin-Key header validation"
  - "ARRAY varchar cast: ::varchar[] required in all raw SQL @> containment queries against character varying[] columns"

requirements-completed: [DIR-01, DIR-02, DIR-04]

# Metrics
duration: ~3min
completed: 2026-03-02
---

# Phase 70 Plan 02: Professional Directory API Layer Summary

**FastAPI professionals router with gemeente/gevolgklasse ARRAY filters (authenticated users) and admin CRUD gated by X-Admin-Key header — 11 unit tests GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T16:44:50Z
- **Completed:** 2026-03-02T16:48:27Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Pydantic v2 schemas: ProfessionalCreate, ProfessionalUpdate, ProfessionalResponse, ProfessionalListResponse
- GET /api/professionals: auth-gated list with gemeente (ANY filter) and gevolgklasse (ARRAY @> filter), rate limited 30/min
- POST /api/professionals: X-Admin-Key gate, returns 201, rate limited 10/min
- PUT /api/professionals/{id}: partial update via model_dump(exclude_unset=True), rate limited 10/min
- DELETE /api/professionals/{id}: soft-delete (is_active=False), returns 204, rate limited 10/min
- require_admin_key dependency: empty ADMIN_API_KEY disables all admin endpoints (fail-secure)
- Router registered in main.py
- 11 unit tests: 2 auth tests, 3 filter tests, 6 admin CRUD tests — all GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Pydantic schemas + FastAPI router with filters and admin CRUD** - `8957536` (feat)
2. **Task 2: Unit tests for professionals router + varchar cast fix** - `34701b0` (feat)

**Plan metadata:** (docs commit — see state update below)

## Files Created/Modified
- `backend/app/schemas/professional.py` - ProfessionalCreate, ProfessionalUpdate, ProfessionalResponse, ProfessionalListResponse
- `backend/app/professionals/__init__.py` - Package init
- `backend/app/professionals/router.py` - CRUD router: require_admin_key + 4 endpoints
- `backend/app/main.py` - Added professionals_router import and include_router
- `backend/tests/unit/test_professionals_router.py` - 11 unit tests

## Decisions Made
- **require_admin_key fail-secure**: `if not settings.ADMIN_API_KEY` rejects all requests when key is empty string — prevents accidental open admin in dev
- **gevolgklasse varchar cast**: `ARRAY[:gk]::varchar[]` matches `character varying[]` column type (consistent with Plan 01 cross-tenant test fix)
- **gemeente ANY filter**: Uses `(:gemeente) = ANY(werkgebied)` rather than `@>` since it's a single-value match against an array column
- **422 vs 403 for missing header**: FastAPI returns 422 (validation error) when the required Header param is absent; the test accepts both 422 and 403 as valid responses for "missing admin key" scenario

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ARRAY type mismatch in gevolgklasse filter**
- **Found during:** Task 2 (unit tests — test_list_professionals_gevolgklasse_filter)
- **Issue:** Plan spec had `gevolgklassen @> ARRAY[:gk]::text[]` but Professional.gevolgklassen is `character varying[]`, causing `operator does not exist: character varying[] @> text[]`
- **Fix:** Changed to `ARRAY[:gk]::varchar[]` — same fix pattern as Plan 01 cross-tenant tests
- **Files modified:** `backend/app/professionals/router.py`
- **Verification:** Test passed after cast was changed
- **Committed in:** `34701b0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — varchar cast in router query)
**Impact on plan:** Fix was necessary for correct filter behavior. No scope creep.

## Issues Encountered
None — all tests passed after the varchar cast fix.

## Next Phase Readiness
- /api/professionals endpoints live and tested
- Frontend (Plan 03) can consume GET /api/professionals with gemeente/gevolgklasse params
- Phase 71 lead routing can use the same filter logic for kwaliteitsborger matching
- Admin can onboard professionals via POST /api/professionals with X-Admin-Key

---
*Phase: 70-professional-directory*
*Completed: 2026-03-02*
