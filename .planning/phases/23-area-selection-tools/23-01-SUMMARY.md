---
phase: 23-area-selection-tools
plan: 01
subsystem: frontend-map-utilities
tags: [geo-utils, bbox, map-layer, gemeente, area-selection]
dependency_graph:
  requires: [gemeente-boundaries-layer, maplibre-gl]
  provides: [calculateBboxFromGeometry, scan-area-highlight-layer]
  affects: [23-03-map-wiring]
tech_stack:
  added: []
  patterns: [imperative-layer-management, geojson-utilities]
key_files:
  created:
    - frontend/src/lib/geo-utils.ts
    - frontend/src/components/map/ScanAreaHighlightLayer.tsx
  modified:
    - frontend/src/components/map/GemeenteBoundariesLayer.tsx
decisions:
  - summary: "Use imperative layer management pattern for ScanAreaHighlightLayer"
    rationale: "Consistent with existing PropertyGeometryLayer and GemeenteBoundariesLayer patterns"
    alternatives_considered: ["React component with useEffect"]
    impact: "Low - follows established codebase patterns"
  - summary: "Calculate bbox from GeoJSON geometry client-side"
    rationale: "Required for click-based area selection flow, bbox not available in CBS WFS feature properties"
    alternatives_considered: ["Backend pre-calculation during gemeente data fetch"]
    impact: "Low - simple coordinate min/max calculation"
metrics:
  duration_seconds: 130
  tasks_completed: 2
  files_modified: 3
  commits: 2
  completed_date: 2026-02-13
---

# Phase 23 Plan 01: Bbox Extraction and Visual Highlight Layer

**One-liner:** GeoJSON bbox calculation utility and purple dashed outline layer for click-based area selection

---

## What Was Built

Created the foundational utilities for click-based area selection:

1. **geo-utils.ts** - Bbox calculation from GeoJSON geometries
   - `calculateBboxFromGeometry` handles both Polygon and MultiPolygon types
   - Iterates exterior rings only (interior rings are holes, irrelevant for bbox)
   - Returns `[minLon, minLat, maxLon, maxLat]` matching backend `bbox_wgs84` format

2. **ScanAreaHighlightLayer.tsx** - Map visualization for selected areas
   - `addScanAreaHighlight` - Purple dashed outline with semi-transparent fill
   - `updateScanAreaHighlight` - Update existing highlight bbox
   - `removeScanAreaHighlight` - Clean up layers and source
   - Follows imperative pattern from PropertyGeometryLayer (not React components)

3. **GemeenteBoundariesLayer.tsx** - Enhanced click callback
   - Updated `onGemeenteClick` signature to include bbox parameter
   - Extracts bbox from clicked feature geometry using calculateBboxFromGeometry
   - Guards against non-Polygon/MultiPolygon geometries

---

## Technical Implementation

### Bbox Calculation Algorithm

```typescript
// Handles both Polygon and MultiPolygon (e.g., island gemeentes like Texel)
const polygons = geometry.type === 'Polygon'
  ? [geometry.coordinates]
  : geometry.coordinates;

// Iterate exterior rings only (polygon[0])
for (const polygon of polygons) {
  const exteriorRing = polygon[0];
  for (const coord of exteriorRing) {
    // Track min/max lon/lat
  }
}
```

### Visual Highlight Styling

- Fill: `#8b5cf6` (purple) with 0.15 opacity
- Line: `#8b5cf6` with width 3, dasharray `[2, 2]`
- Source ID: `scan-area-highlight`
- Layer IDs: `scan-area-fill`, `scan-area-outline`

### Type Safety

- Proper GeoJSON type narrowing for geometry check
- GeoJSONSource cast for setData access in updateScanAreaHighlight
- Coordinate undefined guards for TypeScript strict mode

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Integration Points

**Provides for Plan 23-03:**
- `calculateBboxFromGeometry` - Used by GemeenteBoundariesLayer click handler
- `addScanAreaHighlight`, `updateScanAreaHighlight`, `removeScanAreaHighlight` - Map visualization controls
- Updated GemeenteBoundariesLayer callback with bbox parameter

**Ready for:**
- Map.tsx wiring (Plan 23-03) to trigger scan with selected area
- Bestemmingsplan zone click handlers (future enhancement)

---

## Verification Results

**Type Check:** ✅ Passed
```bash
tsc -b --noEmit && eslint .
```

**Export Verification:**
- ✅ `geo-utils.ts` exports `calculateBboxFromGeometry`
- ✅ `ScanAreaHighlightLayer.tsx` exports all three functions
- ✅ `GemeenteBoundariesLayer.tsx` imports from `@/lib/geo-utils`

**Callback Signature:**
- ✅ `onGemeenteClick(gemeenteCode, gemeenteNaam, bbox)` with bbox as fourth parameter

---

## File Structure

```
frontend/src/
├── lib/
│   └── geo-utils.ts                 (NEW - 40 lines)
└── components/map/
    ├── GemeenteBoundariesLayer.tsx  (MODIFIED - added bbox extraction)
    └── ScanAreaHighlightLayer.tsx   (NEW - 133 lines)
```

---

## Commits

| Hash    | Type | Description                                    |
| ------- | ---- | ---------------------------------------------- |
| b7d2417 | feat | Add bbox calculation and update callback       |
| 74c49ef | feat | Create ScanAreaHighlightLayer for visualization |

---

## Next Steps

**Plan 23-03** will wire these utilities into Map.tsx:
1. Use updated GemeenteBoundariesLayer callback to receive bbox
2. Call addScanAreaHighlight when gemeente clicked
3. Show confirmation UI with selected area name
4. Trigger scan with bbox on confirmation
5. Remove highlight when scan starts or user cancels

---

## Self-Check: PASSED

**Created files exist:**
- ✅ FOUND: frontend/src/lib/geo-utils.ts
- ✅ FOUND: frontend/src/components/map/ScanAreaHighlightLayer.tsx

**Modified files exist:**
- ✅ FOUND: frontend/src/components/map/GemeenteBoundariesLayer.tsx

**Commits exist:**
- ✅ FOUND: b7d2417
- ✅ FOUND: 74c49ef

**All verifications passed.**
