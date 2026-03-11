---
phase: 101-score-backfill-migration
plan: 01
subsystem: backend
tags: [scoring, backfill, cli, score-v3, migration]

# Dependency graph
requires:
  - phase: 100-score-v3-0-engine
    provides: compute_score_v3 engine and FactorResult dataclass
provides:
  - CLI tool to backfill all existing scan_results with v3.0 scores
  - Cleanup of v2.1 score keys (factors, subscores) during migration
affects: [101-02, tile-proxy, api-endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyset pagination with neighborhood_metrics batch-loading"
    - "parcel_data assembly matching area_scan.py Phase 6 exactly"

key-files:
  created:
    - backend/app/tools/backfill_scan_scores_v3.py
  modified: []

key-decisions:
  - "Skip-unchanged optimization checks both score value and score_model_version"
  - "Batch-load neighborhood_metrics per batch to avoid N+1 AreaScan queries"

patterns-established:
  - "v3.0 backfill pattern: JOIN ScanResult+ParcelCache, batch-load AreaScan metrics, compute_score_v3, merge flags, commit per batch"

requirements-completed: [BF-01]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 101 Plan 01: Score v3.0 Backfill Tool Summary

**CLI backfill tool re-scores all existing parcels with v3.0 Potentie+Risico engine, removing v2.1 keys**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T09:32:30Z
- **Completed:** 2026-03-11T09:35:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Standalone CLI tool modeled on backfill_scan_scores_v2.py pattern
- Keyset pagination with configurable batch size (default 500)
- Batch-loads neighborhood_metrics from AreaScan to avoid N+1 queries
- Builds parcel_data dict matching area_scan.py Phase 6 assembly exactly (13 flag keys + 5 ParcelCache columns)
- Merges v3.0 score data (scores, score_breakdown, score_model_version, category) and removes v2.1 keys (factors, subscores)
- Dry-run mode computes scores and logs changes without writing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v3.0 backfill tool** - `8c78884` (feat)

## Files Created/Modified
- `backend/app/tools/backfill_scan_scores_v3.py` - CLI backfill tool for v3.0 score migration (247 lines)

## Decisions Made
- Skip-unchanged checks score_model_version == "score-v3.0" AND score value match (avoids rewriting already-migrated rows)
- Batch-load neighborhood_metrics from AreaScan for all unique scan_ids per batch instead of per-row queries
- Use stdlib logging instead of print() for structured output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backfill tool ready for execution against production data
- Plan 101-02 (API + tile updates) can proceed independently

---
*Phase: 101-score-backfill-migration*
*Completed: 2026-03-11*
