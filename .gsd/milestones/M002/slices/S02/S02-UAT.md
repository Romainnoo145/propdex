# S02: GemeenteContextPanel — UAT

**Milestone:** M002
**Written:** 2026-03-18

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Panel orchestration, map click handlers, mutual exclusion, and framer-motion animations require a running app with MapLibre to verify. Artifact-only verification cannot confirm panel transitions or visual positioning.

## Preconditions

- Backend running on port 8000: `cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`
- Frontend dev server running: `cd frontend && npx vite --port 9300`
- Login as `demo@klarifai.nl` / `demo123`
- Navigate to the map route (`/map`)
- Map must show gemeente boundaries (zoom out enough to see CBS boundaries)

## Smoke Test

Click any gemeente boundary on the map. A ~400px panel should slide in from the left showing the gemeente name and 4 summary cards. If no panel appears, check React DevTools → useMapPanels → activePanel.kind.

## Test Cases

### 1. Gemeente panel opens on boundary click

1. Zoom the map to see gemeente boundaries (roughly zoom level 8-10)
2. Click on a gemeente boundary polygon
3. **Expected:** A left-side panel (~400px wide) slides in from the left with:
   - Header showing gemeente name and code
   - Stats bar with wijk count and scanned wijk count
   - 4 summary cards: Demografie, Juridisch Klimaat, Meldingen, Wijken
   - Scrollable wijk list below the cards

### 2. Panel positioned correctly on left side

1. With gemeente panel open (from test 1)
2. Observe panel position
3. **Expected:** Panel is anchored to the left side of the map, starting at ~112px from the left edge (80px side rail + 32px gap). It should NOT overlap the side rail navigation.

### 3. Summary card click opens modal

1. With gemeente panel open
2. Click the "Demografie" summary card
3. **Expected:** A modal opens showing demographic data for the gemeente
4. Close the modal
5. Click "Juridisch Klimaat" card
6. **Expected:** A different modal opens showing juridisch klimaat data
7. Repeat for "Meldingen" and "Wijken" cards
8. **Expected:** Each card opens its respective modal

### 4. Close panel via X button

1. With gemeente panel open
2. Click the X/close button in the panel header
3. **Expected:** Panel slides out and disappears. Map returns to overview state.

### 5. Close panel via Escape key

1. Click a gemeente to open the panel
2. Press the Escape key
3. **Expected:** Panel closes, same as clicking X

### 6. Wijk selection from panel

1. Open gemeente panel by clicking a gemeente
2. In the wijk list section, click on a wijk name
3. **Expected:** GemeenteContextPanel closes and WijkMapPanel opens showing the selected wijk's details (scan history, CBS data)

### 7. Mutual exclusion — parcel closes gemeente panel

1. Open gemeente panel by clicking a gemeente
2. Click on an individual parcel on the map (may need to zoom in)
3. **Expected:** Gemeente panel closes. ParcelDetailPanel opens on the RIGHT side of the map showing parcel details.

### 8. ParcelDetailPanel still works normally

1. Without any gemeente panel open, click on a parcel
2. **Expected:** ParcelDetailPanel opens on the right side as before (no regressions)
3. Close the parcel panel
4. **Expected:** Panel closes cleanly

### 9. Panel back-navigation (wijk → gemeente)

1. Open gemeente panel → click a wijk → WijkMapPanel opens
2. Click the back button in WijkMapPanel
3. **Expected:** Returns to GemeenteContextPanel for the same gemeente

## Edge Cases

### Click different gemeente while panel open

1. Open gemeente panel for gemeente A
2. Click on a different gemeente B on the map
3. **Expected:** Panel updates to show gemeente B's name, stats, and wijk list (not stale data from A)

### Rapid panel toggling

1. Click gemeente → click parcel → click gemeente → click parcel quickly
2. **Expected:** No visual glitches, no stale panels, each transition is clean

### Panel on narrow viewport

1. Resize browser to ~800px width
2. Click a gemeente
3. **Expected:** Panel renders as a bottom sheet (mobile fallback) rather than left-side overlay

## Failure Signals

- Panel doesn't appear after clicking gemeente → check activePanel.kind in React DevTools (should be 'gemeente')
- Panel appears on the right instead of left → check LeftPanelShell positioning (should use `left-[112px]`)
- Panel overlaps side rail → check that side rail width is still 80px
- ParcelDetailPanel broken → CRITICAL regression — compare against ParcelDetailPanel.tsx (should be unmodified)
- Summary card click does nothing → check openModal state in GemeenteContextPanel
- Escape key doesn't close → check LeftPanelShell keydown listener is registered

## Requirements Proved By This UAT

- GEM-01 — Gemeente panel shows wijk list derived from boundaries data
- GEM-02 — Gemeente context accessible via left-side panel (not bottom sheet)

## Not Proven By This UAT

- Category modals showing *detailed* intelligence data (S03 scope — current modals show basic data)
- Mobile bottom-sheet behavior on actual mobile device (tested only via viewport resize)
- Meldingen feed integration in gemeente modal (S03 scope)

## Notes for Tester

- The 4 summary card modals render existing modal components (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal). S03 will enhance these with full-page modal experiences and detailed data. For now, verify they open and show some content.
- The wijk list in the panel only shows wijken that have GeoJSON data loaded for the selected gemeente. If no wijken appear, the gemeente may not have wijk boundary data.
- Scanned badge on wijken only appears for wijken that have been previously scanned.
