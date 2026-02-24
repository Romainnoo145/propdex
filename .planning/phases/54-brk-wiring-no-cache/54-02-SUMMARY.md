---
phase: 54-brk-wiring-no-cache
plan: 02
subsystem: api
tags: [brk, kadaster, never-cache, reports-service, reports-router, integration-tests, tier3]

# Dependency graph
requires:
  - phase: 54-brk-wiring-no-cache
    provides: "Plan 01: BRKOwnership three-state schema with never_cache marker; fetch_brk_ownership() Step 2b; CadastralParcel.identificatie"
provides:
  - BRK strip-before-save in save_report() — brk_ownership popped from model_dump before JSONB persist
  - BRK strip-before-save in update_report_data() — brk_ownership popped before report.report_data assignment
  - BRK re-fetch-on-view in GET /{report_id} — fetch_brk_ownership() called live when stored brk_ownership is None
  - 6 integration tests proving strip-before-save and fetch_brk_ownership degradation scenarios
affects: [55-aggregator-enrichment, 56-property-report-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strip-before-assign pattern: model_dump -> pop -> assign (not: assign -> pop)"
    - "Enriched copy pattern: dict(report.report_data) copy enriched before response, stored JSONB untouched"
    - "Re-fetch-on-view: check brk_ownership is None in stored data, fetch live, inject into response dict"
    - "Graceful BRK re-fetch: exception caught with logger.warning, leaves brk_ownership as None for frontend"

key-files:
  created:
    - backend/tests/integration/test_brk_wiring.py
  modified:
    - backend/app/reports/service.py
    - backend/app/reports/router.py

key-decisions:
  - "Strip-before-assign (not assign-then-pop): the pop must happen before assigning to report.report_data to avoid JSONB mutation issues"
  - "dict(report.report_data) shallow copy for re-fetch enrichment — stored JSONB not mutated by re-fetch"
  - "GET /{report_id} re-fetch uses stored cadastral_parcels, not a fresh PDOK lookup — fast re-fetch without full aggregation"
  - "GovernmentAPIError(source, message, status_code) signature — source is first positional arg"

patterns-established:
  - "BRK strip pattern: validated_report.model_dump(mode='json') -> .pop('brk_ownership', None) -> assign"
  - "BRK re-fetch check: if report_data.get('brk_ownership') is None — covers both absent key and null value"

requirements-completed: [BRK-04]

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 54 Plan 02: BRK No-Cache Enforcement Summary

**BRK eigendomsdata stripped from JSONB before DB persist in both save and update paths; GET /{report_id} re-fetches BRK live from stored perceel identificatie; 6 integration tests prove enforcement**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T06:06:24Z
- **Completed:** 2026-02-24T06:11:25Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Added `brk_ownership` strip in `save_report()` — `model_dump().pop('brk_ownership', None)` before JSONB persist
- Added `brk_ownership` strip in `update_report_data()` — `model_dump().pop().assign` pattern prevents JSONB mutation
- Wired BRK re-fetch in `GET /{report_id}` — creates `dict()` copy of stored JSONB, calls `fetch_brk_ownership()` with stored `CadastralParcel` list, injects result before response
- Added `CadastralParcel` and `fetch_brk_ownership` imports to `router.py`
- Created 6 integration tests covering all BRK-04 enforcement scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip BRK before save and re-fetch on GET** - `d5c8f1f` (feat)
2. **Task 2: BRK wiring integration tests** - `5b1eeff` (test)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified
- `backend/app/reports/service.py` - BRK strip in save_report() and update_report_data() before JSONB persist
- `backend/app/reports/router.py` - BRK re-fetch in GET /{report_id}; CadastralParcel + fetch_brk_ownership imports
- `backend/tests/integration/test_brk_wiring.py` - 6 integration tests for BRK-04 enforcement

## Decisions Made
- Used `dict(report.report_data)` shallow copy for re-fetch enrichment — stored JSONB not mutated, enriched dict sent to frontend
- Strip-before-assign pattern (not assign-then-pop): validated_report.model_dump() -> pop() -> assign to avoid SQLAlchemy JSONB tracking issues
- GET re-fetch uses stored `cadastral_parcels` from saved JSONB, not a fresh PDOK API call — avoids full re-aggregation, leverages already-stored perceel identificatie
- `GovernmentAPIError(source, message, status_code)` — source is first positional arg (discovered during test authoring, auto-fixed per Rule 1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GovernmentAPIError constructor signature corrected in tests**
- **Found during:** Task 2 (integration test authoring)
- **Issue:** Test used `GovernmentAPIError("BRK API timeout", status_code=503)` — but signature is `(source, message, status_code)`, first arg is source not message
- **Fix:** Changed to `GovernmentAPIError("brk", "BRK API timeout", status_code=503)`
- **Files modified:** backend/tests/integration/test_brk_wiring.py
- **Verification:** `test_brk_error_on_api_failure` passes
- **Committed in:** 5b1eeff (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Necessary fix for test correctness. No scope creep.

## Issues Encountered
- ruff import ordering: initial placement of `from app.schemas.property import CadastralParcel` was out of alphabetical order — auto-fixed with `ruff --fix`

## User Setup Required
None — no external service configuration required. BRK re-fetch on GET will return `status="unavailable"` with admin_hint until PKIOverheid certificates are configured, which is correct behavior.

## Next Phase Readiness
- BRK-04 fully enforced: eigendomsdata never persisted in JSONB
- GET /{report_id} returns live BRK data on every view ("actueel opgevraagd")
- All 6 integration tests pass, proving enforcement in both save paths and all three fetch_brk_ownership degradation scenarios
- Ready for Phase 55 (aggregator enrichment) — BRK wiring complete end-to-end

---
*Phase: 54-brk-wiring-no-cache*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: backend/app/reports/service.py
- FOUND: backend/app/reports/router.py
- FOUND: backend/tests/integration/test_brk_wiring.py
- FOUND: .planning/phases/54-brk-wiring-no-cache/54-02-SUMMARY.md
- FOUND commit: d5c8f1f (feat: strip BRK before JSONB save and re-fetch on GET)
- FOUND commit: 5b1eeff (test: add 6 BRK wiring integration tests)
