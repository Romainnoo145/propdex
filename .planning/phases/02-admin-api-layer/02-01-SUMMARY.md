---
phase: 02-admin-api-layer
plan: 01
subsystem: api
tags: [fastapi, pydantic, sqlalchemy, pytest, admin, data-sources, tdd]

# Dependency graph
requires:
  - phase: 01-datamodel-source-key-catalog
    provides: DataSourceStatus model, DataSourceStatusValue Literal, DATA_SOURCE_KEYS catalog, get_entry()

provides:
  - 15 RED integration tests for all admin data-sources endpoints (Wave-0 Nyquist signal)
  - gemeente_name_lookup shared module extracted from policy_documents/service.py
  - Pydantic v2 schemas: Action, DataSourceRow, GemeenteDataSourcesPayload, GemeenteSummary
  - GET /api/admin/data-sources/gemeenten (aggregate status counts, superuser-only)
  - GET /api/admin/data-sources/{gemeente_code} (3-section catalog payload, superuser-only)
  - POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh stub (501, Plan 02 implements)
  - Router mounted in main.py

affects:
  - 02-02-PLAN.md (Plan 02 POST refresh + probe-registry consumes this router + schemas)
  - frontend S03 (can begin integration against GET endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD Wave-0/Wave-1: 15 tests written first (RED), then implementation flips 9 to GREEN"
    - "Nyquist sampling: 15 tests cover 4 endpoints including perf, RBAC, catalog-drift"
    - "DataSourceRow synthesized from catalog when no DB row (default status=missing)"
    - "compute_actions() matrix: source_type × status → list[Action]"
    - "Shared gemeente_name_lookup: thin re-export in policy_documents/service.py keeps M045 callers unbroken"

key-files:
  created:
    - backend/app/services/gemeente_name_lookup.py
    - backend/app/admin/data_sources_schemas.py
    - backend/app/admin/data_sources_router.py
    - backend/tests/integration/test_admin_data_sources_router.py
  modified:
    - backend/app/policy_documents/service.py (thin re-export delegates to shared module)
    - backend/app/main.py (admin_data_sources_router registered)

key-decisions:
  - "AreaScan seed helper does not pass org_id — AreaScan uses Base+TimestampMixin, no TenantMixin"
  - "Module-level router import removed from test file — ImportError prevents --collect-only; tests are RED because endpoints 404 until Wave 1, not ImportError"
  - "Ruff auto-fixed in same wave: unused imports, zip(strict=False), loop variable rename"
  - "compute_actions() inline in router (not a registry) — 4 source_types × 2-3 status variants fits 30 lines"

patterns-established:
  - "GSD Wave-0/Wave-1 TDD: RED commit first (tests only), GREEN commit second (impl)"
  - "Superuser RBAC enforced via Depends(get_current_superuser) on all 3 endpoints"
  - "Path regex ^GM\\d{4}$ at Annotated[str, Path(pattern=...)] — 422 on malformed code"
  - "Orphan DB rows (source_key not in catalog) silently skipped in GET, 404 in POST"

requirements-completed: [API-01, API-02, API-05, TEST-02]

# Metrics
duration: 8min
completed: 2026-05-14
---

# Phase 02 Plan 01: Admin Data-Sources GET Endpoints Summary

**15 Nyquist integration tests (Wave-0 RED) + GET /gemeenten and GET /{gemeente_code} endpoints with catalog-merge, RBAC, and 501 POST stub wired into FastAPI app**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-14T13:03:56Z
- **Completed:** 2026-05-14T13:11:24Z
- **Tasks:** 2 (Wave-0 RED + Wave-1 GREEN)
- **Files modified:** 6

## Accomplishments
- 15 integration tests committed as Wave-0 RED (pytest collects all 15, 9 pass in Wave 1, 6 remain RED for Plan 02)
- GET /api/admin/data-sources/gemeenten returns sorted GemeenteSummary list with aggregate status_counts
- GET /api/admin/data-sources/{gemeente_code} returns 3-section payload merging DATA_SOURCE_KEYS catalog with DB rows (missing rows synthesized with status="missing")
- gemeente_name_lookup.py extracted from policy_documents/service.py:332 as shared module; service.py thin re-export keeps M045 callers unchanged
- Router registered in main.py (2 references: import + include_router)

## Task Commits

1. **Task 1 (Wave-0 RED): Tests + gemeente_name_lookup stub** - `efb61344` (test)
2. **Task 2 (Wave-1 GREEN): GET endpoints + schemas + registration** - `9a30a281` (feat)
3. **Ruff lint fix on test file** - `79429bf6` (fix)

## Files Created/Modified
- `backend/app/services/gemeente_name_lookup.py` - Shared {gemeente_code: naam} resolver from area_scans
- `backend/app/admin/data_sources_schemas.py` - Pydantic v2: Action, DataSourceRow, GemeenteDataSourcesPayload, GemeenteSummary
- `backend/app/admin/data_sources_router.py` - APIRouter prefix=/api/admin/data-sources with 2 GET + 1 POST stub
- `backend/tests/integration/test_admin_data_sources_router.py` - 15 tests (9 GREEN, 6 RED for Plan 02)
- `backend/app/policy_documents/service.py` - _gemeente_name_map delegated to shared module (thin re-export)
- `backend/app/main.py` - admin_data_sources_router import + include_router

## Decisions Made
- AreaScan seed helper omits org_id: AreaScan uses Base+TimestampMixin, no TenantMixin — no organization_id column
- Module-level router import removed from test file to allow pytest --collect-only; tests are RED because routes 404/401 until Wave 1, not ImportError
- compute_actions() inline (not a separate registry module) — matrix is small enough to keep in router

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Linting] Fixed ruff lint errors in test file**
- **Found during:** Task 2 (Wave-1 verification step)
- **Issue:** Test file had unused imports (timedelta, select, func), zip() without strict=, unused loop variable i
- **Fix:** Removed unused imports, added strict=False to zip() calls, renamed i to _i, sorted import block
- **Files modified:** backend/tests/integration/test_admin_data_sources_router.py
- **Verification:** ruff check exits 0 on all new files
- **Committed in:** 79429bf6

---

**Total deviations:** 1 auto-fixed (linting)
**Impact on plan:** No scope creep. Linting fixes required for ruff check gate.

## Issues Encountered
- The plan specified `from app.admin.data_sources_router import router as _data_sources_router` at module-level as "Nyquist signal". With a module-level import causing ImportError, pytest --collect-only cannot show 15 test names. Removed the module-level router import — tests are RED because routes return 404/401 until Wave 1 implementation, which is an equally valid Nyquist signal. This matches the plan's acceptance criteria of 15 collected tests.

## Open Questions for Plan 02
- AreaScan seed required `bbox_minx/miny/maxx/maxy` as NOT-NULL fields — seeded with nominal Venlo bbox values
- POST refresh stub currently returns 501 for all source_types — Plan 02 must implement probe-registry for Type-A, and the plan spec says Type-B→not_applicable, Type-C→missing with "S05" error_message
- Advisory lock (pg_advisory_xact_lock) for concurrent refresh calls is Plan 02 scope

## Next Phase Readiness
- Plan 02 (02-02-PLAN.md) can proceed: 6 remaining RED tests drive POST refresh + probe-registry + advisory lock implementation
- Frontend S03 can begin GET endpoint integration: /api/admin/data-sources/gemeenten and /api/admin/data-sources/{gemeente_code} are live

---
*Phase: 02-admin-api-layer*
*Completed: 2026-05-14*

## Self-Check: PASSED

- FOUND: backend/app/services/gemeente_name_lookup.py
- FOUND: backend/app/admin/data_sources_schemas.py
- FOUND: backend/app/admin/data_sources_router.py
- FOUND: backend/tests/integration/test_admin_data_sources_router.py
- FOUND: .planning/phases/02-admin-api-layer/02-01-SUMMARY.md
- FOUND: commit efb61344 (Wave-0 RED tests + stub)
- FOUND: commit 9a30a281 (Wave-1 GET endpoints)
- FOUND: commit 79429bf6 (ruff lint fix)
