---
phase: 63-venlo-data-completeness
plan: "01"
subsystem: tools
tags: [cli-tool, validation, scan-quality, parcel-addressing, bag, pdok, sqlalchemy]

# Dependency graph
requires:
  - phase: 62-scan-pipeline-reliability
    provides: coverage_ratio + address_resolution_ratio on AreaScan; completed_with_warnings status
provides:
  - validate_scan_data CLI tool with per-wijk bouwjaar/address/pand_status population rate validation
  - parcel_addressing.py service (BAG building overlap + PDOK reverse geocode helpers) committed to git
  - backfill_parcel_addresses.py tool committed to git
  - WijkValidation dataclass with rate properties and zero-division safety
  - normalize_gemeente_code helper supporting both GM-prefixed and bare codes
  - Unit tests for WijkValidation rate computation and gemeente code normalization
affects:
  - 63-02 (Venlo re-scan and validation run uses validate_scan_data CLI)
  - future scan quality monitoring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI tool pattern: argparse + asyncio.run(main()) + direct async_session_factory DB access"
    - "Conditional SQLAlchemy count: func.count(case(((condition), 1)))"
    - "Multi-format gemeente code: normalize_gemeente_code returns (with_prefix, bare) tuple"
    - "Scan quality threshold validation: separate threshold args with sensible defaults"

key-files:
  created:
    - backend/app/tools/validate_scan_data.py
    - backend/tests/unit/test_validate_scan_data.py
  modified:
    - backend/app/services/parcel_addressing.py (remove unused BaseGeometry import)
    - backend/app/tools/backfill_parcel_addresses.py (fix import sort order + remove unused httpx)

key-decisions:
  - "validate_scan_data distinguishes building-parcels from empty parcels when computing rates (denominator is parcels_with_buildings, not total_parcels)"
  - "normalize_gemeente_code returns (with_prefix, bare) tuple — caller decides which format to use after DB probe"
  - "Exit codes: 0=all pass, 1=warnings/failures, 2=no scans found — enables CI integration"
  - "Score consistency check warns if in_gebruik avg > buiten gebruik avg (scoring anomaly detection)"

patterns-established:
  - "Conditional SQLAlchemy aggregate: func.count(case(((ParcelCache.has_pand.is_(True)) & (ParcelCache.bouwjaar.is_not(None)), 1)))"
  - "Per-wijk validation query: join ScanResult->ParcelCache->AreaScan, group by wijk_naam"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 63 Plan 01: Scan Data Validation Tool Summary

**Reusable CLI validation tool for scan data quality: per-wijk bouwjaar/address/pand_status population rates with GM-prefix normalization, score consistency check, and 0/1/2 exit codes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T09:16:55Z
- **Completed:** 2026-03-01T09:19:39Z
- **Tasks:** 2
- **Files modified:** 4 files modified, 2 created

## Accomplishments

- Created `validate_scan_data.py` CLI tool with WijkValidation dataclass, per-wijk aggregation query using conditional SQLAlchemy counts, score consistency check table, and formatted summary table with OK/WARN/FAIL per wijk
- Committed `parcel_addressing.py` (BAG building overlap + PDOK reverse geocode) and `backfill_parcel_addresses.py` from unstaged state
- 9 unit tests covering all rate property computations, zero-division guards, and gemeente code normalization edge cases

## Task Commits

1. **Task 1: Formalize parcel_addressing.py and create validate_scan_data.py CLI tool** - `dd6beba` (feat)
2. **Task 2: Unit tests for validation dataclass and formatting** - `5aeb7aa` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/tools/validate_scan_data.py` - CLI tool: argparse, WijkValidation dataclass, per-wijk DB query, score consistency check, formatted table output, exit codes 0/1/2
- `backend/app/services/parcel_addressing.py` - BAG building overlap + PDOK reverse geocode helpers (formalized from unstaged)
- `backend/app/tools/backfill_parcel_addresses.py` - Address backfill tool (formalized from unstaged)
- `backend/tests/unit/test_validate_scan_data.py` - 9 unit tests for rate computation and normalization

## Decisions Made

- Rates are computed over `parcels_with_buildings` denominator only (not total_parcels) so that empty parcels don't dilute bouwjaar/address quality metrics
- `normalize_gemeente_code` probes the DB to determine which format (GM-prefixed vs bare) is stored, then uses the matching format throughout
- Exit codes follow CI convention: 0 = all pass, 1 = any warnings, 2 = no data found

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports caught by ruff**
- **Found during:** Task 1 (verifying parcel_addressing.py and backfill_parcel_addresses.py with ruff)
- **Issue:** `BaseGeometry` unused in parcel_addressing.py; `httpx` unused and import order wrong in backfill_parcel_addresses.py — both blocking ruff check
- **Fix:** Removed `BaseGeometry` import from parcel_addressing.py; removed `httpx` import and fixed import sort order in backfill_parcel_addresses.py
- **Files modified:** backend/app/services/parcel_addressing.py, backend/app/tools/backfill_parcel_addresses.py
- **Verification:** `ruff check` passes on both files
- **Committed in:** dd6beba (Task 1 commit)

**2. [Rule 1 - Bug] Fixed C408 ruff error in test helper (dict literal)**
- **Found during:** Task 2 (ruff check on test file)
- **Issue:** `dict(...)` call in `_make_validation` helper flagged as C408 — should be dict literal
- **Fix:** Rewrote helper to use `{...}` dict literal with type annotation `dict`
- **Files modified:** backend/tests/unit/test_validate_scan_data.py
- **Verification:** ruff passes, all 9 tests still pass
- **Committed in:** 5aeb7aa (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug: unused imports + lint style fix)
**Impact on plan:** Both auto-fixes required for ruff check to pass. No scope creep.

## Issues Encountered

None — existing files imported cleanly after lint fixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `validate_scan_data.py` ready to use: `python -m app.tools.validate_scan_data --gemeente-code GM0983`
- Phase 63 Plan 02 can now run Venlo scans and call this tool to verify data completeness
- All three formalized tools (`parcel_addressing`, `backfill_parcel_addresses`, `validate_scan_data`) are committed and importable

---
*Phase: 63-venlo-data-completeness*
*Completed: 2026-03-01*

## Self-Check: PASSED

- backend/app/tools/validate_scan_data.py: FOUND
- backend/app/services/parcel_addressing.py: FOUND
- backend/app/tools/backfill_parcel_addresses.py: FOUND
- backend/tests/unit/test_validate_scan_data.py: FOUND
- .planning/phases/63-venlo-data-completeness/63-01-SUMMARY.md: FOUND
- Commit dd6beba: FOUND (feat: validate_scan_data CLI + parcel_addressing)
- Commit 5aeb7aa: FOUND (test: WijkValidation unit tests)
- Commit 547f411: FOUND (docs: plan metadata)
