---
phase: 90-frontend-fysiek-risicoprofiel
plan: 02
subsystem: ui
tags: [maplibre, mvt, foundation-risk, bouwjaar, overlay]

# Dependency graph
requires:
  - phase: 88-foundation-risk-engine
    provides: foundation risk heuristic and bouwjaar data in parcel_cache
provides:
  - foundation_risk_level field in MVT tile properties
  - Funderingsrisico toggleable overlay layer on area scan map
affects: [map, tile_proxy, ParcelScoreLayer]

# Tech tracking
tech-stack:
  added: []
  patterns: [SQL CASE-derived tile property, overlay layer pattern with catalog entry]

key-files:
  created: []
  modified:
    - backend/app/services/tile_proxy.py
    - frontend/src/lib/api.ts
    - frontend/src/components/map/ParcelScoreLayer.tsx
    - frontend/src/lib/map/layers.ts
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "Bouwjaar-only proxy for tile coloring (full bouwjaar x bodemtype available per-parcel API)"
  - "Amber/slate palette consistent with indicative risk design (never red)"

patterns-established:
  - "Overlay layer addition pattern: catalog entry + fill layer + visibility function + toggle handler + interactive layers array"

requirements-completed: [FRNT-03]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 90 Plan 02: Foundation Risk Map Overlay Summary

**MVT tiles expose foundation_risk_level (bouwjaar CASE), toggleable Funderingsrisico overlay with amber/slate coloring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T18:45:52Z
- **Completed:** 2026-03-09T18:50:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MVT tiles now include foundation_risk_level (hoog/middel/laag/onbekend) derived from bouwjaar
- Funderingsrisico overlay layer available in parcel overlay menu with amber (pre-1970) and slate (post-1990) coloring
- Full hover, selection, and click interaction on foundation risk layer
- TILE_SCHEMA_VERSION bumped to 13 for browser cache refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Add foundation_risk_level to MVT tiles** - `c7bfb28` (feat)
2. **Task 2: Frontend foundation risk overlay layer and toggle** - `dc90da5` (feat)

## Files Created/Modified
- `backend/app/services/tile_proxy.py` - SQL CASE expression deriving foundation_risk_level from bouwjaar
- `frontend/src/lib/api.ts` - TILE_SCHEMA_VERSION bumped to 13
- `frontend/src/lib/map/layers.ts` - foundation_risk added to ParcelOverlayLayerId and MAP_LAYER_CATALOG
- `frontend/src/components/map/ParcelScoreLayer.tsx` - Foundation risk fill layer, visibility function, mouse handlers
- `frontend/src/components/map/LayerToggle.tsx` - Foundation risk mode and prop wiring
- `frontend/src/routes/_authenticated/map.tsx` - Handler and interactive layers array

## Decisions Made
- Used bouwjaar-only proxy for tile coloring because soil type is not stored per-parcel in scan results; full risk assessment available via per-parcel API
- Amber/slate palette (not red/green) to maintain indicative-only risk design principle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation risk overlay is fully functional and toggleable
- Per-parcel risk detail already available from phase 88 API

---
*Phase: 90-frontend-fysiek-risicoprofiel*
*Completed: 2026-03-10*
