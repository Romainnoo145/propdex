---
phase: 75-cbs-wijkstatistieken
plan: 02
subsystem: api
tags: [cbs, odata, government-api, rate-limiter, python]

# Dependency graph
requires:
  - phase: 75-cbs-wijkstatistieken
    provides: CBS OData v4 research — correct endpoint, entity model, measure codes, wijk lookup strategy

provides:
  - CBS OData v4 client (datasets.cbs.nl/odata/v1/CBS, Observations + WijkenEnBuurtenCodes)
  - cbs_odata_limiter singleton in rate_limiter.py
  - CBS_DATASET_ID configurable via Settings (env: CBS_DATASET_ID, default 86165NED)
  - gemeente_code-scoped wijk lookup (prevents ambiguous national name matches)
  - retry_with_backoff + timeout=10.0 on all CBS HTTP calls

affects: [area_scan_job, neighborhood_metrics, cbs_client_users]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CBS v4 wijk lookup: startswith(Identifier, 'WK{gemeente_code}') scopes by municipality before name-match"
    - "CBS v4 observations: Measure+Value+ValueAttribute — only use Value when ValueAttribute is empty string"
    - "CBSODataClient reads dataset_id from settings at __init__ time for testability"

key-files:
  created:
    - backend/app/government_apis/cbs_odata.py
  modified:
    - backend/app/government_apis/rate_limiter.py
    - backend/app/core/config.py
    - backend/app/jobs/area_scan.py

key-decisions:
  - "Use startswith(Identifier, 'WK{gemeente_code}') for wijk lookup — prevents '80+ Centrum matches nationally' ambiguity"
  - "bouwjaar_distributie fields set to None in v4 — M008209/M008210 are rolling 10yr window, not pre/post-2000"
  - "CBS_DATASET_ID as Settings field (not class constant) — allows env-var override per deployment without code change"
  - "peiljaar derived from DATASET_PEILJAAR mapping — not hardcoded, automatically correct for any supported dataset ID"
  - "GovernmentAPIError raised on _fetch_observations failure — observation fetch is fatal; region lookup is non-fatal"

patterns-established:
  - "CBS OData v4: WijkenEnBuurtenCodes for region lookup, Observations for data fetch"
  - "ValueAttribute empty string == valid data; non-empty == suppressed/missing"

requirements-completed: [CBS-02, CBS-03]

# Metrics
duration: ~5min
completed: 2026-03-06
---

# Phase 75 Plan 02: CBS OData Client v4 Rewrite Summary

**CBS OData client migrated from deprecated v3 (opendata.cbs.nl + TypedDataSet + substringof) to v4 (datasets.cbs.nl + Observations + WijkenEnBuurtenCodes) with rate limiting, retries, timeouts, and gemeente_code-scoped wijk lookup**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-06T16:18:00Z
- **Completed:** 2026-03-06T16:24:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rewrote CBS OData client from deprecated v3 endpoint to v4 (datasets.cbs.nl/odata/v1/CBS) with correct Observations entity and WijkenEnBuurtenCodes region lookup
- Added `cbs_odata_limiter` singleton (max_concurrent=3, max_per_hour=500), `CBS_DATASET_ID` configurable setting, and CBS cache TTL (30 days)
- Hardened all HTTP calls with `cbs_odata_limiter` context manager, `timeout=10.0`, and `retry_with_backoff`; wired `gemeente_code` from area_scan job to prevent ambiguous national wijk lookups

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cbs_odata_limiter + CBS_DATASET_ID setting** - `92fc484` (feat)
2. **Task 2: Rewrite CBS OData client to v4 + harden + wire gemeente_code** - `10a74c3` (feat)

## Files Created/Modified

- `backend/app/government_apis/cbs_odata.py` - Full rewrite: v4 endpoint, Observations entity, WijkenEnBuurtenCodes lookup, rate limiter, retry, timeout, gemeente_code scoping
- `backend/app/government_apis/rate_limiter.py` - Added `cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)`
- `backend/app/core/config.py` - Added `cbs_dataset_id` field (default 86165NED), CBS cache TTL (30 days)
- `backend/app/jobs/area_scan.py` - Added `gemeente_code=scan.gemeente_code` to CBS client call; fixed pre-existing whitespace lint warning

## Decisions Made

- **bouwjaar_distributie set to None**: v4 measure codes M008209/M008210 represent a rolling 10-year window (not the old pre-2000/post-2000 boundary), so keeping the old field names would be misleading. Set to None until properly labelled.
- **Non-fatal region lookup, fatal observations fetch**: `_resolve_wijk_identifier` and `_resolve_gemeente_identifier` catch exceptions and return None (network issues shouldn't block the scan). `_fetch_observations` raises `GovernmentAPIError` — if we have a valid identifier but can't fetch data, that's a real error worth surfacing.
- **gemeente_code required for safe lookup**: Without gemeente_code, returning None with a warning is safer than a national name search ("Centrum" matches 80+ wijken nationally).

## Deviations from Plan

**1. [Rule 2 - Auto-fix lint] Fixed pre-existing whitespace in area_scan.py**
- **Found during:** Task 2 (ruff check after modification)
- **Issue:** Line 351 in area_scan.py had trailing whitespace (W293), causing ruff check to fail
- **Fix:** `ruff check --fix` removed the trailing whitespace
- **Files modified:** `backend/app/jobs/area_scan.py`
- **Verification:** `ruff check` passes with 0 errors after fix
- **Committed in:** `10a74c3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (pre-existing lint issue, not caused by this plan's changes)
**Impact on plan:** Trivial whitespace fix. No scope creep.

## Issues Encountered

None — plan executed cleanly. All verification checks passed on first attempt.

## User Setup Required

None - no external service configuration required. CBS OData v4 is a public endpoint requiring no API key.

## Next Phase Readiness

- CBS OData v4 client is complete and ready for Phase 75-03 (CBS frontend display)
- `neighborhood_metrics` JSONB on AreaScan already stores the CBS payload — no schema changes needed
- Dataset ID can be updated via `CBS_DATASET_ID` env var when CBS publishes 2026 dataset (expected Q2 2026)
- Concern: CBS 2025 measure codes for `86165NED` should be verified live — codes were cross-referenced against 2024 dataset in research

---
*Phase: 75-cbs-wijkstatistieken*
*Completed: 2026-03-06*
