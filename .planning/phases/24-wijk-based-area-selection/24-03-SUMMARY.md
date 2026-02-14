---
phase: 24-wijk-based-area-selection
plan: 03
subsystem: frontend-map-interaction
tags: [wijk-selection, map-ui, layer-control, state-management]
dependency_graph:
  requires:
    - "24-01: backend wijk WFS endpoint"
    - "24-02: WijkBoundariesLayer component"
  provides:
    - "gemeente click -> wijk loading flow"
    - "active gemeente context state"
    - "wijken layer toggle control"
  affects:
    - "frontend/src/routes/_authenticated/map.tsx: gemeente click handler"
    - "frontend/src/components/map/LayerToggle.tsx: conditional wijken button"
tech_stack:
  added: []
  patterns:
    - "useRef for stale closure avoidance in event handlers"
    - "Conditional layer toggle rendering based on parent state"
    - "useEffect with eslint-disable for state reset on prop change"
key_files:
  created: []
  modified:
    - "frontend/src/lib/api.ts"
    - "frontend/src/routes/_authenticated/map.tsx"
    - "frontend/src/components/map/LayerToggle.tsx"
decisions:
  - "Gemeente click no longer triggers scan directly — now loads wijken for user selection"
  - "Wijken toggle defaults to visible when gemeente becomes active"
  - "Use refs for activeScanId, activeGemeente, wijkGeojson in click handler to avoid stale closure"
  - "Gemeente context header shows at top-center with close button"
  - "Toggling gemeenten off also clears active gemeente context and removes wijk layer"
metrics:
  duration_seconds: 305
  tasks_completed: 2
  files_modified: 3
  commits: 1
  lines_added: 183
  lines_removed: 54
completed: 2026-02-15T05:45:40Z
---

# Phase 24 Plan 03: Gemeente Click to Wijk Loading Summary

Wire gemeente click to load wijk boundaries and establish gemeente context state management with layer toggle control.

## Tasks Completed

### Task 1: Add fetchWijken API function and gemeente context state

**API Layer** (`frontend/src/lib/api.ts`):
- Added `fetchWijken()` function calling `GET /api/scans/wijken?gemeente_code={code}`
- Returns GeoJSON FeatureCollection with wijk polygons from CBS WFS via backend

**State Management** (`frontend/src/routes/_authenticated/map.tsx`):
- Added `activeGemeente` state with code, naam, bbox
- Added `wijkGeojson` and `wijkLoading` state for wijk data
- Added refs (`activeGemeenteRef`, `activeScanIdRef`, `wijkGeojsonRef`) to avoid stale closure in gemeente click handler

**Gemeente Click Handler** (rewritten):
- **OLD behavior**: gemeente click -> highlight -> toast with "Scan starten" button -> scan trigger
- **NEW behavior**: gemeente click -> zoom into gemeente -> fetch wijken from backend -> render wijk layer with `addWijkBoundariesLayer()` -> set active gemeente context
- Guard against clicking during active scan
- Guard against clicking same gemeente twice
- Clear previous wijk layer when switching gemeente
- No-op wijk click handler (wired in plan 24-04)

**UI Components**:
- Added gemeente context header (top-center) showing:
  - Active gemeente name
  - Loading spinner during wijk fetch
  - Close button (clears context, removes wijk layer, flies to NL overview)
- Imported `NL_CENTER` and `NL_ZOOM` from `@/lib/pdok` for close action

**Cleanup Logic**:
- Toggling gemeenten OFF now also clears `activeGemeente` state and removes wijk layer
- Updated `handleGemeentenToggle` dependency array to include `accessToken` (needed for fetchWijken)

### Task 2: Add Wijken toggle to LayerToggle and pass wijk visibility callback

**LayerToggle Component** (`frontend/src/components/map/LayerToggle.tsx`):
- Added `onWijkenToggle` and `showWijkenToggle` props to interface
- Added `showWijken` state (defaults to `true`)
- Added `handleWijkenToggle` callback calling parent's `onWijkenToggle`
- Added `useEffect` to reset `showWijken` to `true` when `showWijkenToggle` transitions from false -> true (gemeente becomes active)
  - Uses `prevShowWijkenToggleRef` to track previous value
  - Includes `eslint-disable react-hooks/set-state-in-effect` for intentional state reset pattern
- Added wijken button in JSX (conditionally rendered when `showWijkenToggle === true`)
  - Emerald green styling (consistent with wijk layer colors)
  - Divider before button
  - Active/inactive styling states

**Map Component** (`frontend/src/routes/_authenticated/map.tsx`):
- Added `handleWijkenToggle` callback calling `setWijkBoundariesVisibility()`
- Updated `<LayerToggle>` JSX to pass:
  - `onWijkenToggle={handleWijkenToggle}`
  - `showWijkenToggle={!!activeGemeente}` (show button only when gemeente is active)

## Navigation Flow

**Before (Plan 24-02):**
1. Click "Gemeenten" toggle -> gemeenten layer loads
2. Click gemeente polygon -> highlight + toast with "Scan starten" button
3. Click "Scan starten" -> trigger scan

**After (Plan 24-03):**
1. Click "Gemeenten" toggle -> gemeenten layer loads
2. Click gemeente polygon -> zoom in + fetch wijken + render wijk layer + show context header
3. "Wijken" toggle appears in LayerToggle (defaults to ON)
4. Active gemeente header shows at top with close button
5. Switching gemeente: clears old wijken, loads new wijken
6. Closing context or toggling gemeenten off: removes wijk layer, returns to NL overview

**Next (Plan 24-04):**
- Wire wijk click handler to trigger scan (wijk bbox replaces gemeente bbox)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All success criteria met:
- [x] Clicking gemeente zooms in, fetches wijken from backend, renders wijk polygons
- [x] Active gemeente header shows with spinner during loading and close button
- [x] Switching gemeente clears previous wijken before loading new ones
- [x] Toggling gemeenten off clears context and removes wijk layer
- [x] LayerToggle conditionally shows "Wijken" toggle when gemeente is active
- [x] `cd frontend && npm run check` passes (type-check + lint)

## Key Files

**Modified:**
- `frontend/src/lib/api.ts`: Added `fetchWijken()` API function
- `frontend/src/routes/_authenticated/map.tsx`: Gemeente click handler rewrite, context state, header UI
- `frontend/src/components/map/LayerToggle.tsx`: Conditional wijken toggle with auto-enable pattern

**Dependencies:**
- Backend: `GET /api/scans/wijken` (from plan 24-01)
- Layer: `WijkBoundariesLayer.tsx` functions (from plan 24-02)

## Technical Notes

**Stale Closure Pattern:**
The gemeente click handler is created once when the layer is first added (inside `handleGemeentenToggle`). To access fresh state values inside the handler, refs are used:
```typescript
const activeGemeenteRef = useRef(activeGemeente)
activeGemeenteRef.current = activeGemeente
// ... use activeGemeenteRef.current in click handler
```

**State Reset Pattern:**
LayerToggle uses `useEffect` to reset `showWijken` to `true` when gemeente becomes active. This pattern required `eslint-disable react-hooks/set-state-in-effect` because we're intentionally synchronizing UI state with parent state change.

**Layer Lifecycle:**
- Wijken layer is added with `visibility: 'visible'` by default
- Toggle button state (`showWijken`) defaults to `true` to match layer state
- When gemeente is cleared, layer is removed via `removeWijkBoundariesLayer()`
- When new gemeente is selected, new layer is added and toggle resets to `true`

## Self-Check: PASSED

**Created files exist:** N/A (no files created)

**Modified files exist:**
```
FOUND: frontend/src/lib/api.ts
FOUND: frontend/src/routes/_authenticated/map.tsx
FOUND: frontend/src/components/map/LayerToggle.tsx
```

**Commits exist:**
```
FOUND: a2fb7fe
```

**Commit details:**
- a2fb7fe: feat(24-03): wire gemeente click to wijk loading and layer toggle (183 additions, 54 deletions)

All files modified, all commits present. Self-check passed.
