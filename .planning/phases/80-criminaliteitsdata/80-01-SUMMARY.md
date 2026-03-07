---
phase: 80-criminaliteitsdata
plan: 01
subsystem: api
tags: [cbs, odata-v3, crime-data, dataderden, httpx]

requires:
  - phase: 79-voorzieningen-nabijheid
    provides: "nabijheid JSONB merge pattern and CBS client architecture"
provides:
  - "CbsCrimeClient for dataderden.cbs.nl OData v3 crime data"
  - "Crime data in neighborhood_metrics['criminaliteit'] JSONB"
  - "Per-1000 inwoners rate computation"
  - "cbs_crime_limiter rate limiter singleton"
affects: [80-02-frontend-criminaliteit, 81-locatie-score]

tech-stack:
  added: []
  patterns: ["OData v3 client with space-padded keys on dataderden.cbs.nl"]

key-files:
  created:
    - backend/app/government_apis/cbs_crime.py
  modified:
    - backend/app/government_apis/rate_limiter.py
    - backend/app/jobs/area_scan.py

key-decisions:
  - "Separate CbsCrimeClient class (not extending CBSODataClient) due to OData v3 vs v4 protocol differences"
  - "Hardcoded LATEST_PERIOD=2024JJ00 (most recent Definitief full-year data)"
  - "Crime subcategories aggregated server-side into vermogensdelicten/vernieling/geweld totals"

patterns-established:
  - "OData v3 pattern: $format=json required, space-padded keys, TypedDataSet entity"
  - "dataderden.cbs.nl client pattern: separate from datasets.cbs.nl clients"

requirements-completed: [CRIME-01, CRIME-03]

duration: 3min
completed: 2026-03-07
---

# Phase 80 Plan 01: CBS Crime Data Backend Summary

**OData v3 crime client for dataderden.cbs.nl 47018NED with wijk resolution, space-padded keys, per-1000 rate computation, and scan job integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T11:34:11Z
- **Completed:** 2026-03-07T11:37:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CbsCrimeClient querying dataderden.cbs.nl OData v3 with space-padded keys for wijk resolution
- Crime data fetch for totaal + 3 category breakdowns (vermogensdelicten, vernieling, geweld)
- Per-1000 inwoners rates computed using existing Kerncijfers demografie data
- Integrated into area scan job with non-fatal error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CbsCrimeClient with OData v3 wijk resolution and crime data fetch** - `d1c641b` (feat)
2. **Task 2: Integrate crime data fetch into area scan job** - `f0b31ed` (feat)

## Files Created/Modified
- `backend/app/government_apis/cbs_crime.py` - OData v3 crime client with wijk resolution, TypedDataSet query, per-1000 computation
- `backend/app/government_apis/rate_limiter.py` - Added cbs_crime_limiter singleton
- `backend/app/jobs/area_scan.py` - Crime data fetch block after nabijheid with JSONB merge

## Decisions Made
- Separate CbsCrimeClient class (OData v3 protocol fundamentally different from v4)
- Hardcoded LATEST_PERIOD=2024JJ00 (most recent Definitief data, configurable later)
- Server-side aggregation of subcategories into 3 summary groups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Crime data stored in neighborhood_metrics["criminaliteit"] ready for frontend card (Plan 02)
- Phase 81 score engine can consume per_1000_inwoners values directly

---
*Phase: 80-criminaliteitsdata*
*Completed: 2026-03-07*
