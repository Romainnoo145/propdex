---
phase: 23-area-selection-tools
plan: 01
subsystem: frontend-map-drawing
tags: [terra-draw, drawing-tools, area-selection, map-interaction]
dependency_graph:
  requires: [maplibre-gl, map-view]
  provides: [drawing-tools-control, area-drawing-ui]
  affects: [scan-api-integration]
tech_stack:
  added: [terra-draw@1.24.0, terra-draw-maplibre-gl-adapter@1.3.0, @turf/bbox@7.3.4]
  patterns: [terra-draw-modes, bbox-calculation, drawing-state-management]
key_files:
  created:
    - frontend/src/components/map/DrawingToolsControl.tsx
  modified:
    - frontend/package.json
    - frontend/src/lib/types/scan.ts
decisions:
  - Terra Draw MapLibre adapter requires separate package (terra-draw-maplibre-gl-adapter)
  - FeatureId is string | number union type from terra-draw
  - Drawing completion clears shape and resets mode for clean UX
  - Bbox calculation uses @turf/bbox in EPSG:4326 (MapLibre native CRS)
metrics:
  duration_minutes: 5
  completed_date: 2026-02-11
---

# Phase 23 Plan 01: Drawing Tools Control Summary

Terra Draw integration for rectangle and polygon area selection on MapLibre map.

## One-liner

Terra Draw-based drawing tools control with rectangle/polygon modes and automatic bbox extraction using @turf/bbox.

## Overview

Implemented DrawingToolsControl component that integrates Terra Draw library with the MapLibre map, enabling users to draw custom areas (rectangles or polygons) for targeted area scanning. The component handles drawing mode management, bbox calculation, and fires callbacks with geometry data. Also updated ScanCreateRequest type to support optional bbox_wgs84 field for area-limited scans.

## Tasks Completed

### Task 1: Install drawing dependencies and create DrawingToolsControl

**Status:** ✅ Complete
**Commit:** c5e708f

Installed terra-draw (v1.24.0), terra-draw-maplibre-gl-adapter (v1.3.0), and @turf/bbox (v7.3.4). Created DrawingToolsControl component with:

- Terra Draw initialization with MapLibreGL adapter
- Rectangle and polygon drawing modes
- Drawing completion handler that calculates bbox and fires onAreaDrawn callback
- Mode switching with automatic clearing of previous drawings
- Cancel button to exit drawing mode
- Dutch labels (Rechthoek, Polygoon, Annuleren)
- Styling matching existing LayerToggle aesthetic (black/30 backdrop-blur-md)
- Amber highlight for active drawing mode
- Disabled state support

**Implementation notes:**
- Used `useRef` for TerraDraw instance to avoid re-renders
- FeatureId type is `string | number` union from terra-draw
- Bbox calculation happens in EPSG:4326 (MapLibre's native CRS)
- Drawing completion automatically clears shape and resets mode

**Files:**
- frontend/package.json (dependencies added)
- frontend/package-lock.json (created)
- frontend/src/components/map/DrawingToolsControl.tsx (created, 158 lines)

### Task 2: Update ScanCreateRequest type with optional bbox field

**Status:** ✅ Complete
**Commit:** 406c395

Added optional `bbox_wgs84` field to ScanCreateRequest interface:
- Field type: `[number, number, number, number]` (minLon, minLat, maxLon, maxLat)
- Coordinate system: EPSG:4326 (WGS84)
- Purpose: Limit scans to custom drawn areas instead of entire gemeente
- Backend responsibility: Convert to EPSG:28992 for BAG WFS queries

**Files:**
- frontend/src/lib/types/scan.ts (modified)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm dependency resolution error during installation**
- **Found during:** Task 1 initial npm install
- **Issue:** npm arborist threw "Cannot read properties of null (reading 'matches')" error with misleading auth token message
- **Root cause:** Corrupted node_modules or package-lock state
- **Fix:** Removed node_modules and package-lock.json, performed clean reinstall
- **Files affected:** frontend/node_modules, frontend/package-lock.json
- **Commit:** Included in c5e708f

**2. [Rule 3 - Blocking] Missing terra-draw-maplibre-gl-adapter package**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Plan stated to use TerraDrawMapLibreGLAdapter from terra-draw package, but it's not exported
- **Root cause:** MapLibre adapter is distributed as separate package (terra-draw-maplibre-gl-adapter)
- **Fix:** Installed terra-draw-maplibre-gl-adapter@^1.3.0 and imported adapter from correct package
- **Files affected:** frontend/package.json
- **Commit:** Included in c5e708f

**3. [Rule 1 - Bug] Incorrect FeatureId type in finish event handler**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Typed finish event handler parameter as `string`, but FeatureId is `string | number` union
- **Root cause:** Initial implementation assumed string-only IDs
- **Fix:** Updated handler parameter type to `string | number`
- **Files affected:** frontend/src/components/map/DrawingToolsControl.tsx
- **Commit:** Included in c5e708f

## Verification Results

✅ All verification checks passed:

1. `npm run check` - TypeScript compilation and ESLint pass with zero errors
2. terra-draw and terra-draw-maplibre-gl-adapter present in package.json dependencies
3. @turf/bbox present in package.json dependencies
4. DrawingToolsControl.tsx exists and exports component
5. ScanCreateRequest includes bbox_wgs84 field
6. DrawingToolsControl component has 158 lines (exceeds 80-line minimum)
7. Component imports TerraDraw and MapLibre adapter
8. Component uses bbox() from @turf/bbox

## Success Criteria Met

✅ DrawingToolsControl component renders rectangle and polygon buttons
✅ Terra Draw initializes with MapLibre adapter
✅ Drawing completion calculates bbox via @turf/bbox
✅ Mode switching clears previous drawings
✅ ScanCreateRequest type includes optional bbox_wgs84 field
✅ `npm run check` passes with zero errors

## Technical Notes

**Terra Draw Integration:**
- Terra Draw v1.24.0 provides drawing modes (rectangle, polygon, circle, etc.)
- MapLibre adapter is separate package (terra-draw-maplibre-gl-adapter)
- Finish event provides FeatureId (string | number) and OnFinishContext
- getSnapshot() returns array of GeoJSON features
- clear() removes all drawn features
- setMode() switches between drawing modes

**Bbox Calculation:**
- @turf/bbox calculates [minLon, minLat, maxLon, maxLat] from GeoJSON geometry
- MapLibre uses EPSG:4326 natively, so no CRS conversion needed on frontend
- Backend responsible for converting to EPSG:28992 for BAG WFS queries

**Component Patterns:**
- useRef for TerraDraw instance (avoids re-renders on internal state changes)
- useState for activeMode tracking (controls button highlights and cancel visibility)
- useEffect cleanup calls draw.stop() to remove event listeners
- Styling matches LayerToggle: bg-black/30 backdrop-blur-md rounded-lg

## Next Steps

**Plan 23-02:** Wire DrawingToolsControl to MapView and connect to scan API (not yet created)

**Integration requirements:**
- Add DrawingToolsControl to MapView component
- Pass map reference from MapView to DrawingToolsControl
- Implement onAreaDrawn handler to capture bbox and geometry
- Store drawn bbox in scan trigger state
- Pass bbox_wgs84 to backend in ScanCreateRequest when present

## Self-Check

**Created files exist:**
```
✅ FOUND: frontend/src/components/map/DrawingToolsControl.tsx
✅ FOUND: frontend/package-lock.json
```

**Modified files updated:**
```
✅ FOUND: bbox_wgs84 in frontend/src/lib/types/scan.ts
✅ FOUND: terra-draw in frontend/package.json
✅ FOUND: @turf/bbox in frontend/package.json
```

**Commits exist:**
```
✅ FOUND: c5e708f (feat(23-01): add drawing tools control with Terra Draw)
✅ FOUND: 406c395 (feat(23-01): add bbox_wgs84 field to ScanCreateRequest)
```

**Verification commands passed:**
```
✅ npm run check (TypeScript + ESLint) - 0 errors
```

## Self-Check: PASSED
