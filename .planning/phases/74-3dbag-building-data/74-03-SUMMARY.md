---
phase: 74-3dbag-building-data
plan: "03"
subsystem: ui
tags: [typescript, react, building-metrics, 3dbag, transformatiepotentie, headroom]

# Dependency graph
requires:
  - phase: 74-3dbag-building-data
    provides: "Plan 02 backend 3D BAG enrichment storing actual_bouwhoogte + actual_bouwlagen in building_metrics JSONB"
  - phase: 73-dso-omgevingsplan-bouwregels
    provides: "Plan 02 BuildingMetrics TypeScript interface + deriveTransformatiePotentie DSO path with max_bouwhoogte/max_bouwlagen"
provides:
  - "BuildingMetrics interface extended with actual_bouwhoogte + actual_bouwlagen optional fields (Phase 74)"
  - "Three-tier deriveTransformatiePotentie: headroom (actual vs permitted) > DSO-only > heuristic"
  - "Headroom label format: '3/5 lagen · 8.5/15m · wonen ok' using middle dot separator"
affects: [ParcelDetailModal, BuildingMetrics, transformatiepotentie, headroom-scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-tier priority scoring: headroom path short-circuits before DSO path which short-circuits before heuristic"
    - "Headroom fraction = 1 - (actual / permitted), clamped to [0,1]"
    - "Math.max(hoogteHeadroom, lagenHeadroom) avoids double-counting correlated building envelope signals"

key-files:
  created: []
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/components/results/ParcelDetailModal.tsx

key-decisions:
  - "Headroom path requires BOTH 3D BAG data (has3DData) AND DSO permitted data (hasDSOData) — prevents comparing actual against nothing"
  - "Math.max headroom when both signals present — same physical envelope, avoid double-counting correlated dimensions"
  - "Label uses bouwlagen before bouwhoogte in output: '3/5 lagen · 8.5/15m' (floor count is more business-legible)"
  - "Headroom 0-10pts (fully built), 20pts (minimal headroom), 35pts (moderate), 50pts (large headroom) — top-of-scale tied to >60% unused envelope"

patterns-established:
  - "Three-tier transformatiepotentie: has3DData && hasDSOData -> headroom path; hasDSOData -> DSO path; fallback -> heuristic"
  - "actual_* prefix for 3D BAG fields, max_* prefix for PLU WMS permitted fields"

requirements-completed: [3DBAG-01]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 74 Plan 03: 3D BAG Frontend Headroom Scoring Summary

**Three-tier deriveTransformatiePotentie with headroom path: actual 3D BAG dimensions vs PLU WMS permitted envelope for data-driven transformation potential**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T11:11:00Z
- **Completed:** 2026-03-03T11:16:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Extended `BuildingMetrics` TypeScript interface with `actual_bouwhoogte` and `actual_bouwlagen` optional fields from Phase 74 3D BAG enrichment
- Added Priority 1 headroom path to `deriveTransformatiePotentie` — when both 3D BAG actual dimensions and PLU WMS permitted dimensions are available, computes unused envelope fraction (headroom = 1 - actual/permitted)
- Headroom scores: 10pts (<=20% headroom, fully built) to 50pts (>60% headroom, large potential) plus bestemming (5-20pts) plus area (3-15pts)
- Label format: "3/5 lagen · 8.5/15m · wonen ok" — business-legible floor count comparison using middle dot separator
- Existing DSO-only path (Priority 2) and heuristic fallback (Priority 3) unchanged — full backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BuildingMetrics + add headroom path to deriveTransformatiePotentie** - `5afa4b7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - Added `actual_bouwhoogte?: number | null` and `actual_bouwlagen?: number | null` to `BuildingMetrics` interface
- `frontend/src/components/results/ParcelDetailModal.tsx` - Added `has3DData` extraction and Priority 1 headroom `if (has3DData && hasDSOData)` block before existing DSO path

## Decisions Made
- Headroom requires both 3D BAG data AND DSO data — comparing actual to permitted only makes sense when both sides are available; no partial headroom scoring
- `Math.max(hoogteHeadroom, lagenHeadroom)` when both dimensions present — hoogte and bouwlagen describe the same building envelope; taking max avoids artificially inflating score via correlated signals
- Label shows bouwlagen before bouwhoogte — floor count is more business-legible for Dutch real estate context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 74 complete: all three plans shipped — backend 3D BAG client (Plan 01) + enrichment pipeline (Plan 02) + frontend headroom scoring (Plan 03)
- 3DBAG-01 requirement fulfilled: actual building height + floor count from 3D BAG used in headroom comparison with PLU WMS permitted dimensions
- v10.0 milestone: Phase 72 (Parcel Detail Redesign) + Phase 73 (DSO Bouwregels) + Phase 74 (3D BAG) all complete
- Next milestone planning needed for v10.1+

---
*Phase: 74-3dbag-building-data*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: frontend/src/lib/types/scan.ts
- FOUND: frontend/src/components/results/ParcelDetailModal.tsx
- FOUND: .planning/phases/74-3dbag-building-data/74-03-SUMMARY.md
- FOUND: commit 5afa4b7 (feat(74-03): extend BuildingMetrics + add headroom path)
