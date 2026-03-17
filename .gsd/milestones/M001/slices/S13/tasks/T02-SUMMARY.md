---
id: T02
parent: S13
milestone: M001
provides:
  - backfill_parcel_code.py CLI tool for PDOK OGC API batch lookup
  - parcel_code populated for 63,796 Venlo parcel_cache rows (all Kadaster 14-digit IDs)
  - parcel_favorites.parcel_cache_id FK populated for 1/1 test favorites row
  - JOIN between parcel_favorites and parcel_cache verified working
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 49min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# T02: 111.1-parcel-identity-unification 02

**# Phase 111.1 Plan 02: Parcel Code Backfill Summary**

## What Happened

# Phase 111.1 Plan 02: Parcel Code Backfill Summary

**PDOK OGC API backfill CLI populating parcel_code for 63,796 Venlo parcels and linking parcel_favorites via FK JOIN**

## Performance

- **Duration:** 49 min
- **Started:** 2026-03-16T05:27:11Z
- **Completed:** 2026-03-16T06:15:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created idempotent backfill CLI `backfill_parcel_code.py` with Phase 1 (PDOK lookup) and Phase 2 (FK join) logic
- Resolved parcel_code for 63,796 rows (99.97% of queryable 14-digit Kadaster IDs)
- Updated 1 parcel_favorites row with parcel_cache_id FK — favorites-to-cache JOIN now works
- Discovered and documented 16-digit BAG pand ID format: these 61,804 rows cannot be resolved via PDOK Kadaster OGC API

## Task Commits

1. **Task 1: Create backfill_parcel_code.py CLI tool** - `ffe3f50` (feat)
2. **Task 1 bug fixes: PDOK API endpoint and ID format** - `f532fee` (fix)

**Plan metadata:** pending final commit

## Files Created/Modified

- `backend/app/tools/backfill_parcel_code.py` — CLI tool for parcel_code backfill: Phase 1 (PDOK OGC API lookup by identificatie_lokaal_id), Phase 2 (UPDATE parcel_favorites.parcel_cache_id JOIN on parcel_code)

## Decisions Made

- Used PDOK OGC API (`api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1`) instead of WFS v5_0 (`service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0`) — the WFS CQL_FILTER silently ignores invalid identificatie values and returns unrelated parcels; OGC API supports `identificatie_lokaal_id` query param correctly
- 16-digit IDs (starting with `0983`, `0889`) are BAG pand IDs stored as fallback when Kadaster ID was unavailable at scan time — these are a different identifier system and cannot be queried via PDOK Kadaster. Documented in tool with clear skip pattern.
- Kept `asyncio.Semaphore(10)` with 0.5s batch sleep for PDOK rate-limit courtesy
- parcel_code coverage of 50.8% overall is correct and expected — the 16-digit BAG IDs will remain NULL until those parcels are re-scanned with updated area_scan.py

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong PDOK API endpoint**
- **Found during:** Task 2 (Run backfill) — dry run produced all failures
- **Issue:** Plan specified WFS v5_0 with `CQL_FILTER=identificatie='{id}'`. WFS CQL_FILTER silently returns unrelated results when filter matches nothing; returning "Teteringen A 23" for any ID
- **Fix:** Switched to PDOK OGC API with `identificatie_lokaal_id` query param (same endpoint used by area_scan.py PDOKCadastralClient)
- **Files modified:** backend/app/tools/backfill_parcel_code.py
- **Verification:** Direct API test showed correct Venlo parcel data returned
- **Committed in:** f532fee

**2. [Rule 1 - Bug] Fixed property name casing**
- **Found during:** Task 2 — PDOK WFS returns camelCase (`kadastraleGemeenteWaarde`), OGC API returns snake_case (`kadastrale_gemeente_waarde`)
- **Fix:** Updated to use `kadastrale_gemeente_waarde` (matching OGC API and existing router.py code)
- **Files modified:** backend/app/tools/backfill_parcel_code.py
- **Committed in:** f532fee

**3. [Rule 1 - Bug] Fixed gemeente_code filter normalisation**
- **Found during:** Task 2 — DB stores `GM0983` (with prefix); original code stripped prefix
- **Fix:** Updated normalisation to ADD prefix if missing (DB stores with GM prefix)
- **Files modified:** backend/app/tools/backfill_parcel_code.py
- **Committed in:** f532fee

**4. [Rule 1 - Bug] Updated ID skip pattern to 14-digit Kadaster format**
- **Found during:** Task 2 — 62k rows with 16-digit BAG pand IDs were burning API quota but returning no results
- **Fix:** Changed regex from "numeric only" to "exactly 14 digits" — skips BAG pand IDs (16-digit) which are fundamentally unresolvable via PDOK Kadaster
- **Files modified:** backend/app/tools/backfill_parcel_code.py
- **Committed in:** f532fee

---

**Total deviations:** 4 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes essential for correctness. The 16-digit BAG ID discovery is an important data quality finding.

## Issues Encountered

- PDOK WFS v5_0 CQL_FILTER silently ignores unmatched identifiers — this is a known WFS behavior where no-result filter returns the first N features. The RESEARCH.md specification was based on incorrect assumptions about WFS filter semantics. Resolved by switching to OGC API.
- Python stdout buffering with `nohup` required `-u` flag for unbuffered output
- 16-digit BAG pand IDs (50% of parcel_cache rows) are stored as `parcel_id` as a scan-time fallback when `identificatie_lokaal_id` was unavailable. These rows will need re-scanning to get proper Kadaster IDs. This is a pre-existing data quality issue.

## Coverage Summary

| Category | Count | Notes |
|----------|-------|-------|
| Total parcel_cache rows (GM0983) | 125,621 | |
| 14-digit Kadaster IDs | 63,817 | Queryable via PDOK OGC API |
| 16-digit BAG pand IDs | 61,804 | Not queryable, leave NULL |
| parcel_code resolved | 63,796 | 99.97% of queryable rows |
| parcel_code PDOK failures | 21 | Parcels no longer in Kadaster registry |
| parcel_favorites FK updated | 1 | All favorites linked (100%) |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- parcel_cache has parcel_code for all 14-digit Kadaster ID rows
- parcel_favorites.parcel_cache_id FK populated — portfolio JOIN queries work
- 16-digit BAG pand IDs (~50% of rows) still have NULL parcel_code — these will be populated as parcels are re-scanned with area_scan.py v2 (which now writes parcel_code at scan time)
- Phase 112 (Pipeline Stage Management) can proceed — parcel identity unification complete for existing favorites

---
*Phase: 111.1-parcel-identity-unification*
*Completed: 2026-03-16*
