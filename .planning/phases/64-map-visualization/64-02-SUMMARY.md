---
phase: 64-map-visualization
plan: 02
subsystem: ui
tags: [maplibre, mapbox-gl, typescript, react, canvas, vector-tiles]

# Dependency graph
requires:
  - phase: 64-01
    provides: BAGPandLayer.tsx with addBAGPandLayer/removeBAGPandLayer/setBAGPandVisibility
  - phase: 64-01
    provides: showBAGPanden in PersistedMapLayerState + LayerToggle BAGPanden props
provides:
  - Grey-to-green score gradient aligned to opportunity semantics (grey=occupied, green=vacant)
  - Diagonal hatch pattern overlay on empty parcels (has_pand=false) via canvas ImageData
  - parcel-score-label symbol layer with progressive disclosure at zoom 15.5-17
  - parcel-address-label symbol layer showing address+score at zoom 17+
  - Dashed wijk boundary line (line-dasharray [4,3]) instead of solid
  - fitBounds maxZoom guards (gemeente: 15, wijk: 17) preventing excessive zoom
  - handleBAGPandenToggle callback wired to LayerToggle in map.tsx
affects:
  - map visualization
  - demo readiness

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas ImageData hatch pattern: createHatchPattern() -> getImageData() -> map.addImage({width, height, data: Uint8Array})"
    - "Progressive label disclosure: minzoom/maxzoom on symbol layers instead of JS zoom listeners"
    - "Separate fill layer for fill-pattern overlay (pattern replaces fill-color in MapLibre, hence separate layer)"
    - "fitBounds maxZoom guard pattern to prevent over-zoom on small area boundaries"

key-files:
  created: []
  modified:
    - frontend/src/components/map/ParcelScoreLayer.tsx
    - frontend/src/components/map/WijkBoundariesLayer.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "Grey-to-green gradient: 0=#64748b (slate grey), 25=#94a3b8 (light grey), 45=#eab308 (amber), 65=#84cc16 (lime), 80=#22c55e (green), 100=#16a34a (dark green)"
  - "Hatch pattern uses canvas ImageData (not HTMLCanvasElement directly) — MapLibre addImage() doesn't accept HTMLCanvasElement"
  - "Two separate label layers (score-only at 15.5-17, address+score at 17+) using minzoom/maxzoom"
  - "Dashed wijk line: line-dasharray [4,3], width 1.5, opacity 0.6 — subordinate to parcel data"
  - "maxZoom: 15 for gemeente fitBounds, maxZoom: 17 for wijk fitBounds"
  - "showBAGPandenToggle=true always shown (not gated on activeGemeente)"

patterns-established:
  - "Canvas hatch pattern: draw on canvas -> getImageData -> addImage({width, height, data: Uint8Array})"
  - "Progressive label disclosure: use minzoom/maxzoom on symbol layers, not JS zoom event listeners"
  - "Separate overlay layers for fill-pattern (cannot combine fill-color + fill-pattern on same layer in MapLibre)"

requirements-completed:
  - MAP-02
  - MAP-03

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 64 Plan 02: Map Visualization Enhancements Summary

**Grey-to-green score gradient, diagonal hatch for empty parcels, progressive zoom-level labels, dashed wijk boundaries, fitBounds maxZoom guards, and BAGPanden toggle wiring**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-02T07:45:29Z
- **Completed:** 2026-03-02T07:50:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced misleading red-to-green gradient with semantically correct grey (#64748b) to green (#16a34a) — in_gebruik parcels now appear neutral grey, leeg_perceel parcels appear bright green
- Added diagonal hatch pattern overlay for empty land parcels (has_pand=false) using canvas ImageData registered via map.addImage()
- Added two progressive symbol layers: score number at zoom 15.5-17, address+score at zoom 17+
- Switched wijk boundary from solid line (width 2, opacity 0.8) to dashed (dasharray [4,3], width 1.5, opacity 0.6) so it doesn't compete with parcel colors
- Added maxZoom guards (15 for gemeente, 17 for wijk) to fitBounds calls preventing over-zoom
- Wired BAGPanden toggle from LayerToggle to map.tsx via handleBAGPandenToggle callback

## Task Commits

Each task was committed atomically:

1. **Task 1: Score gradient + hatch pattern** - `af7937f` (feat)
2. **Task 2: Progressive labels, dashed wijk, fitBounds, BAGPanden wiring** - `963c838` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `frontend/src/components/map/ParcelScoreLayer.tsx` - Grey-to-green gradient, hatch pattern image + layer, two progressive label layers, cleanup/visibility updates
- `frontend/src/components/map/WijkBoundariesLayer.tsx` - Dashed wijk boundary line
- `frontend/src/routes/_authenticated/map.tsx` - BAGPandLayer import, handleBAGPandenToggle callback, LayerToggle wiring, fitBounds maxZoom guards

## Decisions Made

- Canvas hatch pattern must use `getImageData()` + `{width, height, data: Uint8Array}` — MapLibre `addImage()` does NOT accept `HTMLCanvasElement` directly (TypeScript error confirmed this)
- Two separate symbol layers for labels (not one layer with zoom-based text-field expression) because minzoom/maxzoom provides cleaner control
- `showBAGPandenToggle={true}` always shown globally (not gated on `activeGemeente`) because BAG panden are useful at any zoom/context
- Hatch layer added as separate fill layer on top of score fill layer — `fill-pattern` replaces `fill-color` in MapLibre so they cannot coexist in one layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed HTMLCanvasElement incompatibility with map.addImage()**
- **Found during:** Task 1 (Score gradient + hatch pattern)
- **Issue:** Plan specified `map.addImage('parcel-hatch', hatchCanvas)` where hatchCanvas is `HTMLCanvasElement`. TypeScript compiler rejected this — `addImage()` doesn't accept `HTMLCanvasElement` in MapLibre's type definitions
- **Fix:** Extract `ImageData` from canvas via `ctx.getImageData()` and pass `{width, height, data: Uint8Array}` object instead
- **Files modified:** frontend/src/components/map/ParcelScoreLayer.tsx
- **Verification:** `npm run check` zero errors after fix
- **Committed in:** af7937f (Task 1 commit, revised before staging)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Auto-fix required for TypeScript compilation. No scope change.

## Issues Encountered

None beyond the HTMLCanvasElement type fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Map visualization layer enhancements complete (Phase 64)
- Grey-to-green semantics aligned with opportunity model (leeg_perceel=dark green, in_gebruik=grey)
- BAGPanden toggle fully wired — users can toggle building footprints from LayerToggle
- Progressive labels ready for demo: score numbers appear naturally as user zooms in
- Dashed wijk boundaries provide spatial context without competing with parcel colors
- v8.0 demo readiness: map layers complete, ready for final phase integration testing

---
*Phase: 64-map-visualization*
*Completed: 2026-03-02*
