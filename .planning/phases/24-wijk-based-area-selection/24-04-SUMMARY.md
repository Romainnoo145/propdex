---
phase: 24-wijk-based-area-selection
plan: 04
subsystem: frontend-map-interaction
tags: [wijk-scan, viewport-scan, scan-trigger, area-selection]
dependency_graph:
  requires:
    - "24-03: gemeente context state and wijk loading flow"
    - "24-02: WijkBoundariesLayer with onClick callback"
    - "23-02: backend bbox scan support"
  provides:
    - "wijk click -> scan trigger flow"
    - "viewport-based scan button"
    - "50k parcel limit for larger area scans"
  affects:
    - "frontend/src/routes/_authenticated/map.tsx: wijk click handler"
    - "backend/app/government_apis/bag_wfs.py: MAX_FEATURES cap"
tech_stack:
  added: []
  patterns:
    - "useRef for fresh state access in event handlers (avoid stale closure)"
    - "Stable wrapper function for ref-based callback delegation"
    - "Guard pattern for preventing concurrent scans"
key_files:
  created: []
  modified:
    - "frontend/src/routes/_authenticated/map.tsx"
    - "backend/app/government_apis/bag_wfs.py"
decisions:
  - "Wijk click triggers scan directly (no confirmation dialog) - deliberate user action"
  - "Viewport scan button in gemeente context header for edge cases (partial views, straddling boundaries)"
  - "Both scan methods use same triggerScan mutation with progress overlay pattern"
  - "MAX_FEATURES raised to 50k for wijk-sized areas (typical wijk: 200-2000 parcels)"
  - "Scan highlight removed when scan starts (progress overlay takes visual precedence)"
metrics:
  duration_seconds: 96
  tasks_completed: 2
  files_modified: 2
  commits: 2
  lines_added: 128
  lines_removed: 4
completed: 2026-02-15T06:45:00Z
---

# Phase 24 Plan 04: Wijk Click to Scan Trigger Summary

Wire wijk click and viewport scan button to trigger area scans, completing the wijk-based scan flow. Also raise MAX_FEATURES cap for larger area support.

## Tasks Completed

### Task 1: Wire wijk click to scan trigger with highlight and progress

**Wijk Click Handler** (`frontend/src/routes/_authenticated/map.tsx`):
- Created `handleWijkClick` callback accepting wijk statcode, statnaam, bbox, and geometry
- Guards against clicking during active scan (via `activeScanIdRef.current`)
- Highlights selected wijk with `addScanAreaHighlight(geometry)` before triggering scan
- Triggers `triggerScan.mutate` with gemeente context and wijk bbox
- Removes highlight on scan success (progress overlay takes over)
- Shows toast notifications: "Scan gestart voor {wijkNaam}" or "Bestaande scan van {date} gevonden"
- Clears highlight and selectedArea on error

**Stable Callback Pattern**:
- Created `handleWijkClickRef` ref to avoid stale closure
- Updated `addWijkBoundariesLayer` call in gemeente click handler with stable wrapper:
  ```typescript
  addWijkBoundariesLayer(mapRef.current, geojson, (code, naam, bbox, geometry) => {
    handleWijkClickRef.current(code, naam, bbox, geometry)
  })
  ```
- This ensures wijk layer's onClick handler always calls the current version of handleWijkClick

**Viewport Scan Handler**:
- Created `handleScanViewport` callback for "Scan zichtbaar gebied" button
- Gets map bounds via `mapRef.current.getBounds()`
- Constructs bbox polygon for highlight visualization
- Triggers scan with viewport bbox and active gemeente context
- Guards against missing gemeente or active scan (same pattern as wijk click)

**UI Changes**:
- Added "Scan zichtbaar gebied" button to gemeente context header (between spinner and close button)
- Button disabled when `activeScanId` exists or `triggerScan.isPending`
- Shows "Scannen..." text while pending
- Emerald-600 background (consistent with wijk layer color scheme)

**Integration Flow**:
1. User clicks gemeente -> wijken load (from 24-03)
2. User clicks wijk polygon -> highlight wijk -> trigger scan with wijk bbox
3. OR user pans/zooms -> clicks "Scan zichtbaar gebied" -> highlight viewport -> trigger scan with viewport bbox
4. Scan starts -> highlight removed -> progress overlay appears (existing from 23-03)
5. Scan completes -> score layer appears (existing from 23-03)

### Task 2: Raise MAX_FEATURES cap from 10k to 50k

**Backend Change** (`backend/app/government_apis/bag_wfs.py`):
- Changed `MAX_FEATURES` constant from 10000 to 50000
- Updated comment: "Cap raised for wijk-based scans (wijken typically 200-2000 parcels)"

**Rationale**:
- Phase 24 introduces wijk-based navigation which naturally creates right-sized selections
- Old 10k cap was a safety net for full gemeente scans (some gemeenten have 100k+ parcels)
- With wijk-level UI, users make more targeted selections (typical wijk: 200-2000 parcels)
- 50k cap still prevents accidental province-scale scans while allowing larger gemeente scans if needed

**Impact**:
- Allows scanning larger wijken in densely populated areas (Amsterdam, Rotterdam centers)
- Allows viewport scans that span multiple wijken
- Still protects against extreme cases (full province = 500k+ parcels)

## Navigation Flow

**Complete wijk-based scan flow (Plans 24-01 through 24-04):**

1. **Initialization** (Plan 24-01): Backend wijk WFS endpoint ready
2. **Layer setup** (Plan 24-02): WijkBoundariesLayer component with onClick callback
3. **Gemeente context** (Plan 24-03): Click gemeente -> zoom + load wijken + context header
4. **Scan trigger** (Plan 24-04 - THIS PLAN):
   - Click wijk polygon -> highlight + scan with wijk bbox
   - OR click "Scan zichtbaar gebied" -> highlight viewport + scan with viewport bbox
   - Progress overlay shows scan progress
   - Score layer appears on completion

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All success criteria met:
- [x] Clicking a wijk triggers scan using the wijk's bounding box
- [x] "Scan zichtbaar gebied" button works when gemeente is active
- [x] Viewport scan uses current map bounds as bbox
- [x] Both scan methods show progress overlay (existing effect)
- [x] Score layer appears on scan completion (existing effect)
- [x] MAX_FEATURES cap raised to 50000
- [x] Scan buttons disabled during active scans (guard logic works)
- [x] `cd frontend && npm run check` passes (type-check + lint)
- [x] `ruff check backend/app/government_apis/bag_wfs.py` passes

## Key Files

**Modified:**
- `frontend/src/routes/_authenticated/map.tsx`: handleWijkClick, handleScanViewport, viewport scan button in context header
- `backend/app/government_apis/bag_wfs.py`: MAX_FEATURES raised to 50000

**Dependencies:**
- Frontend: `useTriggerScan` hook from `@/hooks/useScans.ts`
- Frontend: `addScanAreaHighlight` from `@/components/map/ScanAreaHighlightLayer.tsx`
- Backend: bbox scan support from Phase 23-02

## Technical Notes

**Stale Closure Avoidance**:
The wijk click handler is captured at layer creation time (inside `addWijkBoundariesLayer`). To ensure it always has access to fresh state, we use the ref pattern:
```typescript
const handleWijkClickRef = useRef(handleWijkClick)
handleWijkClickRef.current = handleWijkClick

// In gemeente click handler:
addWijkBoundariesLayer(map, geojson, (code, naam, bbox, geometry) => {
  handleWijkClickRef.current(code, naam, bbox, geometry)
})
```

**Guard Pattern**:
Both scan triggers guard against concurrent scans:
```typescript
if (activeScanIdRef.current) {
  toast.info('Scan al bezig, wacht even...')
  return
}
```

**Highlight Lifecycle**:
1. Wijk/viewport clicked -> `addScanAreaHighlight(geometry)` shows purple dashed outline
2. Scan triggered -> mutation onSuccess -> `removeScanAreaHighlight()` clears highlight
3. Progress overlay appears (handled by existing ScanProgressOverlay component)
4. Scan completes -> score layer appears (handled by existing useEffect in map.tsx)

**MAX_FEATURES Impact on Pagination**:
The BAG WFS client auto-paginates in 1000-feature chunks. With 50k cap:
- Small wijk (500 parcels): 1 page fetch
- Medium wijk (2000 parcels): 2 page fetches
- Large wijk (8000 parcels): 8 page fetches
- Maximum allowed (50k parcels): 50 page fetches (still prevents unbounded queries)

## Self-Check: PASSED

**Created files exist:** N/A (no files created)

**Modified files exist:**
```
FOUND: frontend/src/routes/_authenticated/map.tsx
FOUND: backend/app/government_apis/bag_wfs.py
```

**Commits exist:**
```
FOUND: 3cfad18
FOUND: 0ff34d8
```

**Commit details:**
- 3cfad18: feat(24-04): wire wijk click and viewport scan triggers (127 additions, 3 deletions)
- 0ff34d8: feat(24-04): raise MAX_FEATURES cap from 10k to 50k (1 addition, 1 deletion)

All files modified, all commits present. Self-check passed.
