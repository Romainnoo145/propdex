---
phase: 48-parcel-matching
plan: 01
subsystem: api
tags: [pdok, geocoding, postgis, spatial, rd-new, epsg28992, tdd]

# Dependency graph
requires:
  - phase: 47-address-intelligence
    provides: extract_address_from_title() returning structured dict with street/huisnummer/postcode/city fields

provides:
  - geocode_address() on PDOKLocatieserver — forward geocodes Dutch address to EPSG:28992 (x, y) RD coordinates
  - _parse_rd_point() — parses PDOK centroide_rd WKT POINT format
  - find_parcel_at_point() in bekendmaking_matcher — spatial lookup of ParcelCache by RD point via ST_Contains

affects:
  - phase: 48-parcel-matching (plans 02, 03) — both plans call these two functions
  - phase: 49-map-flow — matched_parcel_id drives fly-to-parcel map behavior

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Graceful geocoding: geocode_address() catches all exceptions and returns None — callers never crash on PDOK unavailability"
    - "TDD RED/GREEN: wrote 12 failing tests before implementation, then implemented minimal code to pass"
    - "Municipality fallback: gemeente_naam appended to geocode query only when both postcode and city are None (pitfall #1 from research)"

key-files:
  created:
    - backend/tests/unit/test_bekendmaking_matcher.py
  modified:
    - backend/app/government_apis/pdok_locatieserver.py
    - backend/app/services/bekendmaking_matcher.py
    - backend/tests/unit/test_pdok_locatieserver.py

key-decisions:
  - "_parse_rd_point() is module-level (not method) — pure function, easier to import and test in isolation"
  - "geocode_address() appends gemeente_naam only when both postcode and city are absent — avoids over-constraining queries that already have postcode"
  - "find_parcel_at_point() uses ST_Contains (parcel contains point) not ST_Within (point within parcel) — semantically correct for polygon containment"
  - "org_id rendered as hex without dashes in compiled SQL — test assertion uses org_id.hex not str(org_id)"

patterns-established:
  - "Query structure test: compile stmt with literal_binds=True, check SQL string for spatial function names and org_id.hex"

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 48 Plan 01: Geocoding + Spatial Parcel Lookup Summary

**PDOK forward geocoding via /free endpoint returning EPSG:28992 RD coordinates, plus PostGIS ST_Contains spatial lookup of ParcelCache — the two core building blocks for bekendmaking-to-parcel matching**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T02:37:38Z
- **Completed:** 2026-02-23T02:40:45Z
- **Tasks:** 2
- **Files modified:** 4 (2 modified, 1 created, 1 extended)

## Accomplishments

- `_parse_rd_point(wkt)` correctly parses PDOK centroide_rd WKT format ("POINT(x y)") to (float, float) tuple
- `geocode_address()` on PDOKLocatieserver calls /free endpoint with fl=id,centroide_rd, handles postcode/city/gemeente_naam query augmentation, returns None on any failure
- `find_parcel_at_point()` in bekendmaking_matcher performs PostGIS ST_Contains spatial lookup with EPSG:28992 point, organization_id filter, LIMIT 1
- 12 new unit tests (9 for PDOK geocoding + 3 for spatial lookup), 19 total passing in these two files

## Task Commits

Each task was committed atomically:

1. **Task 1: geocode_address() and _parse_rd_point()** - `c7fe914` (feat)
2. **Task 2: find_parcel_at_point() spatial lookup** - `627ca78` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN)._

## Files Created/Modified

- `backend/app/government_apis/pdok_locatieserver.py` - Added `_parse_rd_point()` module-level helper and `geocode_address()` async method; added `import re`
- `backend/app/services/bekendmaking_matcher.py` - Added `find_parcel_at_point()` spatial lookup function; added `func` to sqlalchemy import
- `backend/tests/unit/test_pdok_locatieserver.py` - Extended with TestParseRdPoint (3 tests) and TestGeocodeAddress (6 tests)
- `backend/tests/unit/test_bekendmaking_matcher.py` - Created with TestFindParcelAtPoint (3 tests)

## Decisions Made

- `_parse_rd_point()` is module-level, not a method — pure function, no class dependency, easier to import and test
- `geocode_address()` appends gemeente_naam only when both postcode and city are absent — this is the pitfall from research: many streets share names across NL, gemeente_naam narrows the search without over-constraining postcode-rich queries
- Used `ST_Contains(parcel.geometry, point)` — parcel contains point, semantically correct for polygon containment (not ST_Within which would be point within parcel, same result but geometry semantics differ)
- Query structure test uses `org_id.hex` not `str(org_id)` — SQLAlchemy renders UUIDs as hex without dashes in compiled SQL

## Deviations from Plan

**1. [Rule 1 - Bug] Test assertion for org_id in compiled SQL used wrong format**
- **Found during:** Task 2 (GREEN phase — test_find_parcel_at_point_query_structure failing after implementation)
- **Issue:** Test asserted `str(org_id).upper() in sql.upper()` but SQLAlchemy renders UUIDs as hex (no dashes) — e.g., `cc5e2fa4854f42b8b8430f9f7ea3fb36` not `cc5e2fa4-854f-42b8-b843-0f9f7ea3fb36`
- **Fix:** Changed assertion to `org_id.hex in sql` — hex property gives the UUID without dashes matching the rendered format
- **Files modified:** `backend/tests/unit/test_bekendmaking_matcher.py`
- **Verification:** All 3 bekendmaking_matcher tests pass
- **Committed in:** `627ca78` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test assertion)
**Impact on plan:** Test assertion was wrong, not the implementation. Fix ensures the structural SQL check is actually verifying the correct format.

## Issues Encountered

None — implementation straightforward, only the test assertion format needed correction.

## User Setup Required

None — no external service configuration required. Uses existing PDOK client infrastructure (no API key needed).

## Next Phase Readiness

- `geocode_address()` ready to be called from Plan 02 address matching pipeline
- `find_parcel_at_point()` ready to receive RD coordinates from geocoder and return ParcelCache.id
- Both functions handle None gracefully — Plans 02/03 can call without defensive wrapping
- No blockers for Plans 02 and 03

## Self-Check: PASSED

- FOUND: backend/app/government_apis/pdok_locatieserver.py
- FOUND: backend/app/services/bekendmaking_matcher.py
- FOUND: backend/tests/unit/test_pdok_locatieserver.py
- FOUND: backend/tests/unit/test_bekendmaking_matcher.py
- FOUND commit: c7fe914
- FOUND commit: 627ca78

---
*Phase: 48-parcel-matching*
*Completed: 2026-02-23*
