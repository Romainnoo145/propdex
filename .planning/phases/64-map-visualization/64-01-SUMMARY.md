---
phase: 64-map-visualization
plan: 01
subsystem: ui
tags: [maplibre, pdok, wms, bag, layer-toggle, react]

# Dependency graph
requires:
  - phase: 63-venlo-data-completeness
    provides: Parcels with full BAG data (bouwjaar, pand_status) for building context
provides:
  - BAGPandLayer.tsx with add/remove/setVisibility triad for PDOK BAG WMS raster
  - PDOK_BAG_PAND_WMS constant in pdok.ts
  - showBAGPanden in PersistedMapLayerState + DEFAULT_MAP_LAYER_STATE + readPersistedMapLayerState
  - LayerToggle with BAG Panden button, gradient legend bar, and grouped section layout
affects: [64-02-map-visualization, map.tsx BAGPanden wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BAG WMS raster via PDOK service.pdok.nl/lv/bag/wms/v2_0 (free, no API key)
    - add/remove/setVisibility triad for MapLibre raster layers (matches BestemmingsplanLayer pattern)
    - localStorage key bump (v2->v3) to force fresh read when new fields added to persisted state
    - Gradient legend bar as sibling div above layer toggle bar (not inside pill container)
    - Three-group LayerToggle: Kaart / Data / Overlays with border-l-2 thick dividers between groups

key-files:
  created:
    - frontend/src/components/map/BAGPandLayer.tsx
  modified:
    - frontend/src/lib/pdok.ts
    - frontend/src/lib/map/layers.ts
    - frontend/src/components/map/LayerToggle.tsx

key-decisions:
  - "BAG buildings OFF by default, parcels + scores ON by default (showParcels: true default)"
  - "raster-opacity 0.35 for BAG WMS — keeps parcel score colors visible, building borders discernible"
  - "minzoom 14 for BAG layer — only show at parcel scale to avoid visual noise"
  - "Gradient legend: Laag → [grey-to-green] → Hoog, shown only when score overlay + parcels are active"
  - "Three grouped sections: Kaart, Data, Overlays with compact uppercase section labels inline"
  - "showBAGPandenToggle prop gates BAG Panden button rendering (consistent with showWijkenToggle pattern)"
  - "Raster WMS click-through: no click handler needed, clicks pass through to parcel fill layer"
  - "localStorage key bumped v2->v3 to prevent stale undefined values for existing users"

patterns-established:
  - "PDOK WMS raster layers: source minzoom 10, layer minzoom higher (14 for building detail)"
  - "Layer visibility uses layout.visibility (not opacity 0) to prevent tile loading when off"
  - "LayerToggle groups: border-l-2 between groups, border-l within groups, span labels"

requirements-completed:
  - MAP-01

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 64 Plan 01: BAG Panden Layer and LayerToggle Groups Summary

**Toggleable BAG building footprints WMS layer with grouped LayerToggle UI, gradient legend bar, and parcels-on-by-default state**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T07:44:29Z
- **Completed:** 2026-03-02T07:51:29Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `BAGPandLayer.tsx` with `addBAGPandLayer` / `removeBAGPandLayer` / `setBAGPandVisibility` triad, mirroring `BestemmingsplanLayer.tsx` pattern
- Added `PDOK_BAG_PAND_WMS` constant to `pdok.ts` pointing to PDOK BAG WMS v2.0 pand layer
- Extended `PersistedMapLayerState` with `showBAGPanden`, changed `showParcels` default to `true`, bumped localStorage key to `v3`
- Updated `LayerToggle.tsx` with BAG Panden toggle button, gradient legend bar (Laag/Hoog), and three-section grouped layout (Kaart / Data / Overlays)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BAGPandLayer.tsx and add WMS URL constant** - `26bda38` (feat)
2. **Task 2: Extend layer state, add BAG toggle and gradient legend to LayerToggle** - `a60947d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/components/map/BAGPandLayer.tsx` - New file: BAG WMS raster layer add/remove/visibility functions
- `frontend/src/lib/pdok.ts` - Added `PDOK_BAG_PAND_WMS` constant (BAG WMS v2.0, pand layer)
- `frontend/src/lib/map/layers.ts` - Added `showBAGPanden` field, default `showParcels: true`, localStorage key v3, restored showParcels from persisted state
- `frontend/src/components/map/LayerToggle.tsx` - BAG Panden toggle, gradient legend bar, three-section grouped layout

## Decisions Made
- `showParcels` now defaults to `true` (parcels + scores ON immediately on first load) per locked plan decision
- `showBAGPanden` defaults to `false` (building footprints are supplemental context, not primary view)
- `raster-opacity: 0.35` chosen for BAG WMS — WMS renders filled polygons, not outline-only; 0.35 keeps dark building borders visible while fill stays nearly transparent so parcel score colors remain clearly readable
- Gradient legend bar positioned as a separate sibling element (`<>` fragment) above the layer toggle pill, using `absolute bottom-16` to anchor just above the toggle bar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BAGPandLayer.tsx and all supporting state are ready for Plan 64-02 wiring into `map.tsx`
- `onBAGPandenToggle` prop added to `LayerToggle` interface — Plan 64-02 provides the callback
- No blockers

---
*Phase: 64-map-visualization*
*Completed: 2026-03-02*
