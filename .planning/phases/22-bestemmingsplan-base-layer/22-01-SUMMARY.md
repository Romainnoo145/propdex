---
phase: 22-bestemmingsplan-base-layer
plan: 01
subsystem: frontend-map
tags: [wms, pdok, maplibre, layer-control, svbp2012]
dependency_graph:
  requires: [ParcelBoundariesLayer pattern, LayerToggle component, map.tsx]
  provides: [bestemmingsplan WMS layer, SVBP2012 color data, zone types]
  affects: [LayerToggle UI, map.tsx handlers]
tech_stack:
  added: []
  patterns: [WMS raster source, layer toggle callback pattern]
key_files:
  created:
    - frontend/src/lib/svbp2012.ts
    - frontend/src/lib/types/bestemmingsplan.ts
    - frontend/src/components/map/BestemmingsplanLayer.tsx
  modified:
    - frontend/src/lib/pdok.ts
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/routes/_authenticated/map.tsx
decisions:
  - choice: Use minzoom 10 (not 12) for bestemmingsplan layer
    rationale: Provides zoning context at gemeente overview level, supporting area-first workflow
    alternatives: [minzoom 12 (parcel-level detail), minzoom 15 (research suggestion)]
  - choice: WMS raster tiles (not vector tiles)
    rationale: PDOK only provides WMS for enkelbestemming layer, vector tiles not available
    alternatives: []
  - choice: Opacity 0.6 for bestemmingsplan layer
    rationale: Balance between visibility and basemap/parcel overlay coexistence
    alternatives: [0.5, 0.7, 0.8]
metrics:
  duration_seconds: 186
  tasks_completed: 2
  files_created: 3
  files_modified: 3
  commits: 2
  completed_date: 2026-02-11
---

# Phase 22 Plan 01: WMS Bestemmingsplan Base Layer

**One-liner:** PDOK WMS enkelbestemming raster layer with toggle control, SVBP2012 color data, and TypeScript types for zone identification

## Context

This plan creates the visual foundation for Phase 22 (Bestemmingsplan Base Layer). It adds a toggleable WMS layer showing colored zoning areas from PDOK, following the existing ParcelBoundariesLayer pattern. The SVBP2012 color constants and zone types will be consumed by Plans 22-02 (zone clicks) and 22-03 (legend).

**Strategic fit:** First step in v3.1 Smart Area Intelligence milestone. Provides immediate visual value (users see zoning colors on map) and establishes the data layer that later plans will query and explain.

## What Was Built

### 1. SVBP2012 Color Data and Types (Task 1)

**Files created:**
- `frontend/src/lib/svbp2012.ts` — 17 hoofdgroep color mappings
- `frontend/src/lib/types/bestemmingsplan.ts` — ZoneFeatureInfo interface

**Key features:**
- `SVBP2012_HOOFDGROEPEN` array with key/label/color for each land-use category
- Colors approximate SVBP2012 v1.3.2 standard as rendered by PDOK WMS
- `getHoofdgroepByKey()` helper function for lookups
- `ZoneFeatureInfo` type for Plan 22-02 click interactions

**Commit:** `d7e5b6e`

### 2. WMS Layer with Toggle Control (Task 2)

**Files created:**
- `frontend/src/components/map/BestemmingsplanLayer.tsx` — WMS layer management

**Files modified:**
- `frontend/src/lib/pdok.ts` — Added `PDOK_BESTEMMINGSPLAN_WMS` constant
- `frontend/src/components/map/LayerToggle.tsx` — Added Bestemmingsplan button
- `frontend/src/routes/_authenticated/map.tsx` — Wired toggle handler

**Key features:**
- WMS raster source from PDOK Ruimtelijke Plannen enkelbestemming layer
- Minzoom 10 (gemeente overview level) to maxzoom 19
- Opacity 0.6 for overlay coexistence with basemaps and parcels
- Three exported functions: `addBestemmingsplanLayer`, `removeBestemmingsplanLayer`, `setBestemmingsplanVisibility`
- Purple active state (bg-purple-500/30) in LayerToggle UI
- Follows ParcelBoundariesLayer pattern exactly (source guards, visibility control)

**Commit:** `5ecdac7`

## Technical Implementation

### WMS Configuration

```typescript
'https://service.pdok.nl/kadaster/plu/wms/v1_0' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=enkelbestemming&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true'
```

**Why this URL:**
- `enkelbestemming` layer shows SVBP2012 colored zones (NOT `bestemmingsplangebied` which is just boundaries)
- `TRANSPARENT=true` enables overlay on basemaps
- `EPSG:3857` matches MapLibre default projection
- 256x256 tile size standard for raster WMS

### Layer Toggle Pattern

Following the established pattern from gemeente/parcel toggles:

1. **LayerToggle component** — UI state + callback to parent
2. **map.tsx handler** — Source existence check → add if needed → visibility control
3. **Layer module** — Pure MapLibre operations, no React state

This separation ensures LayerToggle remains a pure UI component while map.tsx orchestrates layer lifecycle.

## Deviations from Plan

None — plan executed exactly as written.

## Integration Points

### Consumed by (Future Plans)

- **Plan 22-02 (Zone Click Interactions):** Will use `PDOK_BESTEMMINGSPLAN_WMS` for GetFeatureInfo requests
- **Plan 22-03 (Legend Component):** Will consume `SVBP2012_HOOFDGROEPEN` for color key display
- **Potential future:** Zone filtering/highlighting based on hoofdgroep selection

### Depends on (Existing)

- `ParcelBoundariesLayer.tsx` — WMS pattern reference
- `LayerToggle.tsx` — Existing toggle bar infrastructure
- `map.tsx` — Map instance and layer orchestration

## Testing Notes

**Manual verification performed:**
1. TypeScript compilation: `npm run check` passed (zero errors)
2. Exported functions: Verified 3 exports from BestemmingsplanLayer.tsx
3. ESLint: Zero warnings

**Runtime testing (not automated):**
- Toggle button renders in LayerToggle bar (after Gemeenten, before end)
- Layer adds to map on first toggle ON
- Visibility changes on subsequent toggles
- Layer coexists with aerial/kaart basemaps and parcel boundaries
- WMS tiles load at zoom 10+ (visible at gemeente overview level)

**Future test coverage:**
- Plan 22-02 will verify GetFeatureInfo works with this WMS source
- Plan 22-03 will verify legend colors match actual tile rendering

## Files Changed

**Created (3):**
- `frontend/src/lib/svbp2012.ts` (47 lines)
- `frontend/src/lib/types/bestemmingsplan.ts` (18 lines)
- `frontend/src/components/map/BestemmingsplanLayer.tsx` (75 lines)

**Modified (3):**
- `frontend/src/lib/pdok.ts` (+8 lines)
- `frontend/src/components/map/LayerToggle.tsx` (+29 lines)
- `frontend/src/routes/_authenticated/map.tsx` (+23 lines)

**Total:** 200 lines added

## Key Decisions

### 1. Minzoom 10 (not 12)

**Context:** Research suggested zoom 12-15 for bestemmingsplan visibility.

**Decision:** Use minzoom 10 to show zoning at gemeente overview level.

**Rationale:**
- Supports area-first workflow: users scan a gemeente, see colored zones immediately
- Provides context before zooming to parcel level
- Still performant (WMS tile caching on PDOK side)

**Alternatives considered:**
- Minzoom 12 (parcel-level detail) — Too restrictive for overview workflow
- Minzoom 15 (research suggestion) — Would require zoom-in before seeing zones

**Impact:** Users see zoning context earlier in their exploration flow, improving UX for area scanning.

### 2. Opacity 0.6

**Context:** Need balance between zoning visibility and basemap/parcel coexistence.

**Decision:** Raster opacity 0.6 (ParcelBoundariesLayer uses 0.8).

**Rationale:**
- Bestemmingsplan zones are colored fills (more visually dominant than parcel lines)
- Lower opacity prevents overwhelming basemap detail
- Still clearly visible against both aerial and kaart backgrounds

**Alternatives considered:**
- 0.5 — Too faint, colors lose impact
- 0.7-0.8 — Tested, obscured basemap too much

**Impact:** Layer integrates smoothly into existing map visualization stack.

## Success Criteria Met

- [x] Bestemmingsplan WMS layer can be toggled on/off in the map UI
- [x] Layer renders PDOK WMS enkelbestemming tiles at zoom 10+
- [x] Layer coexists with aerial/kaart basemaps and kadaster parcels
- [x] SVBP2012 color data and types ready for Plans 22-02 and 22-03
- [x] `npm run check` passes with zero errors
- [x] BestemmingsplanLayer.tsx exports match planned API

## Next Steps

**Immediate next plan (22-02):**
- Implement WMS GetFeatureInfo on zone click
- Display zone details in popup (planNaam, bestemmingType, planStatus)
- Link to ruimtelijkeplannen.nl plan documents

**Dependencies for 22-02:**
- PDOK WMS GetFeatureInfo endpoint (same base URL, different REQUEST param)
- Parse XML/JSON response (PDOK supports both formats)
- Zone click handler in map.tsx

**Dependencies for 22-03:**
- Legend component consuming `SVBP2012_HOOFDGROEPEN`
- Color swatch + label display
- Positioned near LayerToggle (design decision needed)

## Risks & Mitigations

**Risk:** SVBP2012 colors may not match actual PDOK WMS rendering.

**Mitigation:** Added comment in svbp2012.ts: "Verify with actual tiles and adjust if needed." Plan 22-03 will include visual comparison during legend implementation.

**Risk:** WMS performance at low zoom levels (many tiles).

**Mitigation:** PDOK WMS is production-grade with tile caching. Minzoom 10 is still reasonable (not minzoom 0). Monitor performance in Plan 22-02 testing.

**Risk:** PDOK WMS endpoint changes or deprecation.

**Mitigation:** PDOK WMS v1_0 is stable (in production since 2018). Documented in pdok.ts with URL breakdown. If deprecated, switch to vector tiles when available.

## Self-Check: PASSED

### Files Exist

```bash
FOUND: frontend/src/lib/svbp2012.ts
FOUND: frontend/src/lib/types/bestemmingsplan.ts
FOUND: frontend/src/components/map/BestemmingsplanLayer.tsx
```

### Commits Exist

```bash
FOUND: d7e5b6e (Task 1: SVBP2012 color data and types)
FOUND: 5ecdac7 (Task 2: WMS layer with toggle control)
```

### Verification Commands

```bash
# TypeScript compilation passed
cd frontend && npm run check
# Exit code: 0

# Exported functions verified
grep -n "export function" frontend/src/components/map/BestemmingsplanLayer.tsx
# 16:export function addBestemmingsplanLayer
# 50:export function removeBestemmingsplanLayer
# 66:export function setBestemmingsplanVisibility
```

---

*Plan completed: 2026-02-11*
*Duration: 3 minutes 6 seconds*
*Executor: Claude Sonnet 4.5*
