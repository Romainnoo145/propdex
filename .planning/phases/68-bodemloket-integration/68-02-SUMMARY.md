---
phase: 68-bodemloket-integration
plan: "02"
subsystem: api
tags: [arcgis-rest, bodemloket, wbb, spatial-query, epsg-28992, tdd, jsonb-cache, pydantic]

requires:
  - phase: 68-bodemloket-integration
    plan: "01"
    provides: SPIKE.md with BUFFER_M=10 decision and confirmed field names

provides:
  - BodemloketClient.query_by_point() ArcGIS REST spatial query (BUFFER_M=10)
  - WBBDossierRef + BodemData Pydantic schemas (9 confirmed fields)
  - fetch_bodem_data() with 30-day JSONB cache keyed by rounded RD coordinates
  - PropertyReportResponse.bodem_data field (BodemData | None)
  - bodemloket_limiter (3 concurrent / 300/hr)
  - CACHE_TTL["bodemloket"] = 2592000 (30 days)

affects:
  - 68-03 (frontend BodemSection — uses BodemData schema)
  - property_aggregator gather index 6 (future phases adding index 7+ must offset)

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: write failing tests first, implement to pass, fix mock async issues inline"
    - "AsyncMock side_effect for coroutine: use named async def passthrough instead of lambda (lambda can't await)"
    - "30-day JSONB cache for slowly-changing govt data: CACHE_TTL + get_cached_or_fetch pattern"
    - "ArcGIS REST spatial query: envelope bbox in RD New (28992), f=geojson, outFields comma-joined"

key-files:
  created:
    - backend/app/schemas/bodem.py
    - backend/app/government_apis/bodemloket_arcgis.py
    - backend/app/services/bodem_aggregator.py
    - backend/tests/unit/test_bodemloket_client.py
    - backend/tests/unit/test_bodem_aggregator.py
  modified:
    - backend/app/government_apis/rate_limiter.py
    - backend/app/core/config.py
    - backend/app/services/property_aggregator.py
    - backend/app/schemas/property.py

key-decisions:
  - "AsyncMock patch for async retry_with_backoff: use named async def _passthrough_retry() not lambda — lambdas return coroutine objects that cannot be awaited by AsyncMock side_effect"
  - "BodemData uses model_validate(cached.data) not model_validate(cached) — get_cached_or_fetch returns CacheResult, not raw dict"
  - "fetch_bodem() closure in property_aggregator uses building.geometry coordinates (same source as monument aggregator), returns None when no coordinates available"

patterns-established:
  - "Bodemloket cache pattern: bodemloket:rd:{round(x)}:{round(y)} — rounds to meter precision for cache stability"
  - "BODEM-03 empty result pattern: BodemData(dossiers=[]) is valid output, not an error — empty list means no WBB registrations within buffer"

requirements-completed: [BODEM-01, BODEM-02, BODEM-03]

duration: 18min
completed: 2026-03-02
---

# Phase 68 Plan 02: Bodemloket Backend Integration Summary

**BodemloketClient ArcGIS REST query + WBBDossierRef schema + fetch_bodem_data() 30-day cache + PropertyReportResponse.bodem_data wired into asyncio.gather index 6 — all 11 TDD tests GREEN**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-02T08:27:21Z
- **Completed:** 2026-03-02T08:45:30Z
- **Tasks:** 2 (RED + GREEN)
- **Files created/modified:** 9

## Accomplishments

- Created `BodemloketClient.query_by_point()` using confirmed ArcGIS REST endpoint with BUFFER_M=10 (SPIKE.md decision), returning `BodemData` with mandatory BODEM-03 disclaimer
- Implemented 30-day JSONB cache via `fetch_bodem_data()` with `get_cached_or_fetch` keyed at `bodemloket:rd:{round(x)}:{round(y)}`
- Wired `fetch_bodem()` into `aggregate_property_data()` at `asyncio.gather` index 6 with full exception handling
- Added `PropertyReportResponse.bodem_data: BodemData | None` field
- All 11 TDD tests pass GREEN: 8 client tests (BODEM-01/02/03) + 3 aggregator cache tests

## Task Commits

1. **Task 1: RED — Write failing tests** - `851fbc3` (test)
2. **Task 2: GREEN — Implement backend modules** - `63376c1` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/schemas/bodem.py` — WBBDossierRef (9 fields) + BodemData Pydantic models
- `backend/app/government_apis/bodemloket_arcgis.py` — BodemloketClient.query_by_point(), BUFFER_M=10, DISCLAIMER constant, bodemloket_client singleton
- `backend/app/services/bodem_aggregator.py` — fetch_bodem_data() with 30-day cache, rounded RD cache key
- `backend/tests/unit/test_bodemloket_client.py` — 8 unit tests (BODEM-01/02/03 coverage)
- `backend/tests/unit/test_bodem_aggregator.py` — 3 unit tests (cache key rounding, returns BodemData, cache hit no HTTP)
- `backend/app/government_apis/rate_limiter.py` — Added bodemloket_limiter (3 concurrent, 300/hr)
- `backend/app/core/config.py` — Added CACHE_TTL["bodemloket"] = 2592000 (30 days)
- `backend/app/services/property_aggregator.py` — fetch_bodem() closure, gather index 6, bodem_data result processing, bodem_data= in PropertyReportResponse constructor
- `backend/app/schemas/property.py` — PropertyReportResponse.bodem_data: BodemData | None field

## Decisions Made

- **AsyncMock passthrough pattern:** The plan suggested `side_effect=lambda fn, **kwargs: fn()` for patching `retry_with_backoff`. This doesn't work because the lambda returns a coroutine object without awaiting it. Fixed with a named `async def _passthrough_retry(fn, **kwargs)` that properly awaits `fn()`. Tracked as [Rule 1 - Bug] auto-fix.
- **CacheResult unwrapping:** `get_cached_or_fetch` returns a `CacheResult` dataclass. The bodem_aggregator must access `cached.data` (the dict field), not use the CacheResult directly as a dict for `model_validate`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async mock passthrough for retry_with_backoff**
- **Found during:** Task 1/2 (RED → GREEN debugging)
- **Issue:** Plan specified `side_effect=lambda fn, **kwargs: fn()` to mock `retry_with_backoff`. This fails because `fn()` is a coroutine but the lambda doesn't await it, so AsyncMock returns the coroutine object, not the resolved httpx.Response. `AttributeError: 'coroutine' object has no attribute 'status_code'` at line 105.
- **Fix:** Replaced lambda with `async def _passthrough_retry(fn, **kwargs): return await fn()` and used `new=_passthrough_retry` in the patch context. No changes to production code.
- **Files modified:** `backend/tests/unit/test_bodemloket_client.py`
- **Committed in:** `63376c1` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test mock pattern from plan)
**Impact on plan:** Test-only fix. Production code unchanged. All 11 tests pass GREEN.

## Issues Encountered

- Pre-existing test failures in `test_auth_errors.py::test_refresh_token_reuse_detection`, `test_bag_wfs.py`, `test_dso_client.py`, `test_rce_client.py`, `test_sru_bekendmakingen.py`, `test_freshness.py` — all confirmed pre-existing (fail with our changes stashed). Out of scope per deviation rules.

## User Setup Required

None — no external service configuration required. Bodemloket is a public ArcGIS REST endpoint, no API key needed.

## Next Phase Readiness

- Backend pipeline complete: address → RD coordinates → ArcGIS REST → BodemData → PropertyReportResponse.bodem_data
- Ready for Phase 68 Plan 03: Frontend BodemSection component
- DISCLAIMER text available from `SPIKE.md` and `bodemloket_arcgis.DISCLAIMER` constant
- Empty dossiers handled correctly (BODEM-03): BodemData(dossiers=[]) displayed with disclaimer, not suppressed

---
*Phase: 68-bodemloket-integration*
*Completed: 2026-03-02*
