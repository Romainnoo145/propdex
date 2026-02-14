---
phase: 25-results-interface
plan: 04
subsystem: frontend/results-ui
tags: [ui, map-interaction, selection-sync, maplibre, react, state-management]

dependency_graph:
  requires:
    - "ResultsTable with onRowClick handler (25-02)"
    - "ResultsFilterPanel and live filtering (25-03)"
    - "ParcelScoreLayer with hover state (25-01)"
  provides:
    - "Bidirectional selection sync between map and table"
    - "Click map parcel -> table row highlights and scrolls"
    - "Click table row -> map flies to parcel and highlights"
    - "setupParcelScoreClickHandler for map click events"
    - "setParcelScoreSelection for feature-state selection"
  affects:
    - "25-05 (export & URL state - may include selectedParcelId in URL)"

tech_stack:
  added: []
  patterns:
    - "Bidirectional selection state with source tracking (table vs map)"
    - "Feature-state selection separate from hover state"
    - "Auto-scroll using row refs and scrollIntoView"
    - "Centroid calculation from GeoJSON geometry for flyTo"
    - "Click handler with cleanup function pattern"

key_files:
  created: []
  modified:
    - "frontend/src/components/map/ParcelScoreLayer.tsx"
    - "frontend/src/components/results/ResultsLayout.tsx"
    - "frontend/src/components/results/ResultsTable.tsx"
    - "frontend/src/routes/_authenticated/map.tsx"

decisions:
  - name: "Track selection source (table vs map) with ref"
    rationale: "Prevents infinite loops. Map click shouldn't re-trigger flyTo, table click shouldn't re-scroll row."
    alternatives: ["Use state instead of ref", "Disable flyTo during map clicks"]
    chosen: "Ref-based source tracking - clean separation of concerns"

  - name: "Selected state separate from hover state"
    rationale: "User can hover other parcels while one is selected. Selected state persists, hover is transient."
    alternatives: ["Reuse hover state", "Clear selection on hover"]
    chosen: "Separate selectedScoreParcelId - clearer state semantics"

  - name: "Always scrollIntoView when selectedParcelId changes"
    rationale: "If user clicked the row, it's already visible (scrollIntoView is no-op). Simplifies logic."
    alternatives: ["Only scroll on map click", "Track scroll source separately"]
    chosen: "Always scroll - simpler, no edge cases"

  - name: "FlyTo with zoom max 16 (not forced zoom)"
    rationale: "If user is already zoomed in closer than 16, don't zoom out. Preserve context."
    alternatives: ["Force zoom to 16", "Use current zoom"]
    chosen: "Math.max(currentZoom, 16) - zoom in if needed, don't zoom out"

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 0
  files_modified: 4
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 25 Plan 04: Bidirectional Linking Summary

**One-liner:** Click map parcel to highlight table row with auto-scroll, click table row to fly map to parcel and highlight with thick white outline.

## What Was Built

Implemented bidirectional selection synchronization between the results table and map. Users can now click a parcel on the map to see the corresponding row highlight and scroll into view in the table, or click a table row to have the map fly to that parcel and highlight it with a thick white outline. Selection state is managed centrally in ResultsLayout and shared between both components.

### Key Components

**ParcelScoreLayer.tsx Updates** (+90 lines)

**New Functions:**
1. **setupParcelScoreClickHandler** - Map click event registration
   - Returns cleanup function for useEffect lifecycle
   - Callback receives `parcelId` (string UUID) and `featureId` (numeric MVT ID)
   - Attached to FILL_LAYER_ID ('parcel-score-fill')
   - Reads `feature.properties.parcel_id` from click event
   - Returns `feature.id` for feature-state operations

2. **setParcelScoreSelection** - Feature-state selection management
   - Clears previous selection state on `selectedScoreParcelId`
   - Sets new selection state using numeric `featureId`
   - Tracks selection separately from hover state
   - Updates feature-state `selected: true/false`

**Layer Updates:**
- **Fill layer opacity** - Added selected state to paint expression:
  ```javascript
  'fill-opacity': [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    0.95,  // Selected: almost fully opaque
    ['boolean', ['feature-state', 'hover'], false],
    0.85,  // Hover
    0.6,   // Default
  ]
  ```

- **Selected outline layer** - New layer for thick white outline:
  - ID: `'parcel-score-selected-outline'`
  - Type: `'line'`
  - Width: 3px when selected (0px default)
  - Color: `'#ffffff'`
  - Opacity: 1.0 when selected (0 default)
  - Added AFTER regular outline layer for z-order

**Module-level State:**
- `selectedScoreParcelId: string | number | null` - Tracks selected parcel (separate from hover)
- Cleared in `removeParcelScoreLayer` cleanup

**ResultsLayout.tsx Updates** (+55, -4 lines)

**New State:**
- `selectedParcelId: string | null` - Shared selection state (parcel UUID)
- `selectionSourceRef: 'table' | 'map' | null` - Tracks who triggered selection

**Map Click Handler** (useEffect)
- Dependencies: `[collapsed, mapRef]`
- Guards: Only setup if not collapsed AND parcel-scores source exists
- Registers click handler via `setupParcelScoreClickHandler`
- On click: Sets source to 'map', updates selectedParcelId, highlights parcel
- Returns cleanup function (removes event listener)

**Table Click -> Map FlyTo** (useEffect)
- Dependencies: `[selectedParcelId, mapRef]`
- Guards: Only run if source is 'table' AND selectedParcelId exists
- Query parcel geometry: `map.querySourceFeatures('parcel-scores', filter by parcel_id)`
- Calculate centroid from GeoJSON Polygon/MultiPolygon coordinates
- FlyTo centroid with zoom: `Math.max(currentZoom, 16)` (zoom in if needed, don't zoom out)
- Duration: 800ms smooth transition
- Highlight parcel via `setParcelScoreSelection`

**Centroid Calculation:**
```typescript
const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0]?.[0]
const sumLng = coords.reduce((s, c) => s + (c[0] ?? 0), 0)
const sumLat = coords.reduce((s, c) => s + (c[1] ?? 0), 0)
map.flyTo({
  center: [sumLng / coords.length, sumLat / coords.length],
  zoom: Math.max(map.getZoom(), 16),
  duration: 800,
})
```

**Props Passed to Children:**
- ResultsTable: `selectedParcelId`, `onRowClick={(id) => { source='table'; setSelectedParcelId(id) }}`
- Children (MapView): Unchanged (mapRef already passed)

**ResultsTable.tsx Updates** (+14, -1 lines)

**New State:**
- `rowRefs: Map<string, HTMLTableRowElement>` - Maps parcel_id to row element for scrolling

**New Props:**
- `selectedParcelId?: string | null` - Current selection from parent

**Auto-scroll Effect:**
- Dependencies: `[selectedParcelId]`
- Finds row element via `rowRefs.current.get(selectedParcelId)`
- Scrolls to row: `rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Runs on ANY selection change (map or table) - table clicks are no-op (already visible)

**Row Rendering:**
- Set ref on each row: `ref={(el) => { if (el) rowRefs.current.set(row.original.parcel_id, el) }}`
- Conditional className:
  ```tsx
  className={`... ${
    row.original.parcel_id === selectedParcelId
      ? 'bg-white/15 ring-1 ring-white/30'
      : 'hover:bg-white/5'
  }`}
  ```
- Selection styling: Slightly brighter background + thin white ring
- Preserves click handler: `onClick={() => onRowClick?.(row.original.parcel_id)}`

**map.tsx Route Updates** (+1 line)

**Props Update:**
- Added `mapRef={mapRef}` to ResultsLayout component
- MapView already had mapRef, now ResultsLayout can access it too

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Selection State Flow

**Map Click:**
```
User clicks parcel on map
  ↓
setupParcelScoreClickHandler callback fires
  ↓
selectionSourceRef.current = 'map'
setSelectedParcelId(parcelId)
  ↓
setParcelScoreSelection(map, featureId, 'parcel_scores')
  ↓
Feature-state 'selected' set to true
  ↓
Fill opacity increases to 0.95
Selected outline layer shows 3px white border
  ↓
selectedParcelId change triggers table useEffect
  ↓
rowRefs.current.get(selectedParcelId)
  ↓
rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  ↓
Table row highlighted with bg-white/15 ring-1 ring-white/30
```

**Table Click:**
```
User clicks table row
  ↓
onRowClick(row.original.parcel_id) fires
  ↓
selectionSourceRef.current = 'table'
setSelectedParcelId(parcelId)
  ↓
Row className updates (selected styling)
  ↓
selectedParcelId change triggers map flyTo useEffect
  ↓
Guard: selectionSourceRef.current === 'table' ✓
  ↓
map.querySourceFeatures('parcel-scores', filter by parcel_id)
  ↓
Calculate centroid from GeoJSON geometry
  ↓
map.flyTo({ center, zoom: max(currentZoom, 16), duration: 800 })
  ↓
setParcelScoreSelection(map, features[0].id, 'parcel_scores')
  ↓
Feature-state 'selected' set to true
  ↓
Map highlights parcel with thick white outline
```

### Source Tracking Pattern

**Why use ref instead of state?**
- Prevent infinite loops: Map flyTo shouldn't re-trigger on map click
- Table scrollIntoView shouldn't re-trigger on table click
- useEffect dependencies don't include selectionSourceRef (it's a ref)
- Clean separation: "Who triggered this?" vs "What is selected?"

**How it works:**
1. Map click: Set source='map', update selection
   - Map flyTo effect sees source='map', doesn't run
   - Table scroll effect sees new selection, scrolls (OK)

2. Table click: Set source='table', update selection
   - Table scroll effect sees new selection, scrolls (no-op, already visible)
   - Map flyTo effect sees source='table', runs flyTo (OK)

### Feature-State vs Properties

**Why feature-state for selection?**
- MVT tiles are immutable (can't modify properties)
- Feature-state is client-side, mutable
- Enables dynamic styling without re-fetching tiles
- Hover and selection can coexist (separate feature-state keys)

**Feature ID vs Parcel ID:**
- `feature.properties.parcel_id` - String UUID from backend (user-facing identifier)
- `feature.id` - Numeric MVT feature ID (for feature-state operations)
- Click handler returns both: `onParcelClick(parcelId, featureId)`
- Selection state uses `featureId` for `setFeatureState` calls

## Verification Results

All success criteria met:

1. **npm run check passes:** Only expected TanStack Table warning (documented in 25-02)
2. **Map-to-table linking:** Click parcel on map, row highlights and scrolls into view
3. **Table-to-map linking:** Click table row, map flies to parcel and highlights with thick white outline
4. **Single selection:** Previous selection clears on new selection (both map and table)
5. **No infinite loops:** Selection source tracking prevents re-triggering
6. **Performance:** No re-render loops during map pan/zoom
7. **Table still scrollable/sortable:** Selection doesn't interfere with table functionality
8. **Selection visual state:** Map shows 0.95 opacity + 3px white outline, table shows bg-white/15 + ring

**Expected Warning:**
TanStack Table React Compiler warning still present (known limitation from plan 25-02).

## Files Modified

**Modified:**
- `frontend/src/components/map/ParcelScoreLayer.tsx` (+90, -1 lines)
  - Add setupParcelScoreClickHandler function
  - Add setParcelScoreSelection function
  - Update fill-opacity to include selected state
  - Add selected outline layer (thick white border)
  - Track selectedScoreParcelId separately from hover
  - Clear selection state in removeParcelScoreLayer

- `frontend/src/components/results/ResultsLayout.tsx` (+55, -4 lines)
  - Import setupParcelScoreClickHandler and setParcelScoreSelection
  - Add mapRef prop to interface
  - Add selectedParcelId state and selectionSourceRef
  - Setup map click handler useEffect
  - Add table click -> map flyTo useEffect
  - Calculate parcel centroid for flyTo
  - Pass selectedParcelId and onRowClick to ResultsTable

- `frontend/src/components/results/ResultsTable.tsx` (+14, -1 lines)
  - Import useRef from React
  - Add selectedParcelId prop
  - Add rowRefs Map for scroll-to functionality
  - Add auto-scroll useEffect
  - Set ref on each table row
  - Conditional className for selected row styling
  - Preserve onRowClick handler

- `frontend/src/routes/_authenticated/map.tsx` (+1 line)
  - Pass mapRef prop to ResultsLayout

## Next Steps

**Plan 25-05:** Export & URL State Persistence
- Export filtered results to CSV
- Persist filters + selectedParcelId in URL search params
- Shareable links with active filters and selection
- Browser back/forward navigation
- Deep linking to specific parcel selection

**Dependencies:**
- Plan 25-05 can include selectedParcelId in URL state for deep linking
- Plan 25-05 can use existing ResultsFilterPanel clear button pattern
- CSV export can include selection context (highlight selected row)

## Commits

1. **8c9ee44** - `feat(25-04): add click handler and selection state to ParcelScoreLayer`
   - Add setupParcelScoreClickHandler function (returns cleanup function)
   - Add setParcelScoreSelection for feature-state selection highlight
   - Update fill-opacity to show selected state (0.95 opacity)
   - Add selected outline layer with thick white border (3px width)
   - Track selectedScoreParcelId separately from hover state
   - Click handler returns both parcel_id (string) and feature.id (numeric)
   - Clear selection state in removeParcelScoreLayer

2. **3c17439** - `feat(25-04): wire bidirectional selection state between table and map`
   - Add mapRef prop to ResultsLayout interface
   - Add selectedParcelId state in ResultsLayout (shared between table and map)
   - Track selection source (table vs map) via selectionSourceRef
   - Setup map click handler via setupParcelScoreClickHandler
   - Map click -> set selection + highlight parcel on map
   - Table click -> set selection + fly to parcel + highlight
   - Auto-scroll table row into view when selected from map
   - Highlight selected row with bg-white/15 and ring-1 ring-white/30
   - Store row refs in Map for scroll-to functionality
   - Pass mapRef from map.tsx route to ResultsLayout
   - Calculate parcel centroid from geometry for flyTo

---

## Self-Check: PASSED

All claims verified:
- ParcelScoreLayer.tsx modified with click handler and selection functions
- ResultsLayout.tsx modified with bidirectional selection state
- ResultsTable.tsx modified with row refs and selection styling
- map.tsx modified to pass mapRef to ResultsLayout
- Commit 8c9ee44 exists in git history
- Commit 3c17439 exists in git history
- setupParcelScoreClickHandler returns cleanup function
- setParcelScoreSelection uses numeric featureId for setFeatureState
- Selected outline layer added with 3px white border
- Fill-opacity includes selected state (0.95)
- Map click sets source='map', updates selection, highlights parcel
- Table click sets source='table', updates selection, flies to parcel
- Auto-scroll uses rowRefs.current.get(selectedParcelId)
- Selected row styling: bg-white/15 ring-1 ring-white/30
- npm run check passes (1 expected React Compiler warning)

---

**Plan Status:** COMPLETE
**Execution Time:** 4 minutes
**Issues:** None
