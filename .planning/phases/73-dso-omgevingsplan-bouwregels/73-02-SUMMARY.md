---
phase: 73-dso-omgevingsplan-bouwregels
plan: "02"
subsystem: ui
tags: [typescript, react, transformatiepotentie, dso, plu-wms, building-metrics, scan]

# Dependency graph
requires:
  - phase: 73-01
    provides: max_bouwhoogte + max_bouwlagen populated in ScanResult.flags["building_metrics"] via PLU WMS extraction
  - phase: 72-02
    provides: ParcelDetailModal pillar bar structure (Vrije ruimte, Beschikbaarheid, Transformatiepotentie)
provides:
  - BuildingMetrics TypeScript interface with 5 typed fields (pand_oppervlakte_m2, max_bebouwingspercentage, max_floor_area_ratio, max_bouwhoogte, max_bouwlagen)
  - ScanResultItem.building_metrics typed as BuildingMetrics | null (not generic Record)
  - deriveTransformatiePotentie() with DSO data-driven path (max_bouwhoogte/max_bouwlagen) + heuristic fallback
affects: [parcel-detail-modal, transformatiepotentie-pillar, scan-types]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasDSOData pattern: check bouwhoogte != null || bouwlagen != null to route DSO vs heuristic path"
    - "DSO label format: 'X lagen · Ym · wonen ok' (using U+00B7 middle dot separator)"
    - "Math.max(hoogtePts, lagenPts) when both signals present — avoid double-counting correlated data"

key-files:
  created: []
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/components/results/ParcelDetailModal.tsx

key-decisions:
  - "Use Math.max(hoogtePts, lagenPts) when both bouwhoogte and bouwlagen are present — they measure the same envelope dimension so summing would double-count"
  - "DSO path scores: hoogtePts (5-35pts) + lagenPts (0-30pts) + bestemmingPts (5-20pt) + areaScore (3-15pts) = max 70pts but capped at 100"
  - "Heuristic fallback unchanged from Phase 72 logic: bouwjaar + bestemming + area bands"
  - "pandOppervlaktM2 extraction simplified from cast to direct typed access after BuildingMetrics types ScanResultItem.building_metrics"

patterns-established:
  - "BuildingMetrics interface: export from scan.ts, import in consumers — single source of truth for building_metrics shape"
  - "DSO/heuristic label branching: hasDSOData flag controls both score formula and label construction"

requirements-completed:
  - DSO-03

# Metrics
duration: ~5min (including human-verify checkpoint)
completed: 2026-03-03
---

# Phase 73 Plan 02: DSO Bouwregels Frontend Summary

**BuildingMetrics TypeScript interface + data-driven Transformatiepotentie formula using PLU WMS max_bouwhoogte/max_bouwlagen with heuristic fallback when no DSO data**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T09:30:00Z
- **Completed:** 2026-03-03T09:46:52Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments
- Added `BuildingMetrics` interface to `scan.ts` with 5 typed fields covering PLU WMS maatvoering dimensions
- Typed `ScanResultItem.building_metrics` as `BuildingMetrics | null` replacing the generic `Record<string, unknown> | null`
- Rewrote `deriveTransformatiePotentie()` to detect DSO data via `hasDSOData` flag and use real bouwregel values for score/label
- DSO path label shows "X lagen · Ym · wonen ok" format using actual dimension data
- Heuristic fallback path unchanged from Phase 72 (bouwjaar + bestemming + area bands)
- Simplified `pandOppervlaktM2` extraction from cast to direct typed access
- Human-verified: Transformatiepotentie pillar renders correctly, no console errors, Phase 72 pillars unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BuildingMetrics interface to scan.ts + rewrite deriveTransformatiePotentie** - `1ac8536` (feat)
2. **Task 2: Human verify Transformatiepotentie pillar renders correctly** - approved (no code commit)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - Added BuildingMetrics interface (5 fields); changed ScanResultItem.building_metrics from Record to BuildingMetrics | null
- `frontend/src/components/results/ParcelDetailModal.tsx` - Rewrote deriveTransformatiePotentie with DSO + heuristic paths; simplified pandOppervlaktM2 extraction; added BuildingMetrics import

## Decisions Made
- Used `Math.max(hoogtePts, lagenPts)` when both bouwhoogte and bouwlagen are present — they measure the same building envelope so summing would artificially inflate the score
- DSO path label format uses U+00B7 middle dot separator: "X lagen · Ym · wonen ok"
- Heuristic path label format unchanged: "Bouwjaar YYYY · wonen ok"
- `pandOppervlaktM2` simplified to `parcel.building_metrics?.pand_oppervlakte_m2 ?? null` after proper typing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 73 complete: full DSO bouwregels pipeline (backend extraction + frontend data-driven formula)
- Parcels with PLU WMS maatvoering data now show DSO-sourced Transformatiepotentie scores
- Parcels without PLU WMS data continue to use the Phase 72 heuristic (no regression)
- Phase 73 is the final planned phase — platform ready for v10.0 milestone review

---
*Phase: 73-dso-omgevingsplan-bouwregels*
*Completed: 2026-03-03*
