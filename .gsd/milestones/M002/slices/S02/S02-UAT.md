# S02: GemeenteContextPanel — UAT

**Milestone:** M002
**Written:** 2026-03-18

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Panel interactions require MapLibre click handlers, framer-motion animations, and mutual exclusion logic that only work in a running browser session

## Preconditions

- Backend running: `cd backend && .venv/bin/uvicorn app.main:app --port 8000 --reload`
- Frontend running: `cd frontend && npx vite --port 9300` (from worktree directory)
- Login with `demo@klarifai.nl` / `demo123`
- Navigate to the map view (Kaart)
- Zoom to a municipality with scanned wijken (e.g. Venlo)

## Smoke Test

Click a gemeente boundary on the map → a ~400px left-side panel should slide in from the left with the gemeente name, stats bar, 4 summary cards, and a wijk list.

## Test Cases

### 1. Gemeente panel opens on boundary click

1. Zoom to gemeente level (zoom ~10-12)
2. Click on a gemeente boundary polygon
3. **Expected:** Left panel slides in at ~400px width, positioned to the right of the side rail (at 112px from left edge). Panel shows:
   - Header with gemeente name and close (X) button
   - Stats bar with wijk count and scanned count badges
   - 2×2 grid of summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken)
   - Scrollable wijk list below the cards

### 2. Summary card clicks open modals

1. With gemeente panel open, click the "Demografie" summary card
2. **Expected:** DemografieModal opens as a full-page modal overlay
3. Close the modal
4. Click "Juridisch Klimaat" card
5. **Expected:** JuridischKlimaatModal opens
6. Close, then click "Meldingen" card
7. **Expected:** MeldingenModal opens
8. Close, then click "Wijken" card
9. **Expected:** Either WijkenModal opens or panel scrolls to wijk list (verify actual behavior)

### 3. Wijk selection from panel

1. With gemeente panel open, click a wijk name in the wijk list
2. **Expected:** Gemeente panel closes, WijkMapPanel opens (on the left side via LeftPanelShell), map zooms to the selected wijk with wijk boundaries highlighted

### 4. Mutual exclusion — parcel selection closes gemeente panel

1. Open the gemeente panel by clicking a gemeente boundary
2. Click on an individual parcel on the map
3. **Expected:** Gemeente panel closes, ParcelDetailPanel opens on the RIGHT side. Only one panel visible at a time.

### 5. ParcelDetailPanel works unchanged

1. Without opening gemeente panel first, click directly on a parcel
2. **Expected:** ParcelDetailPanel opens on the right side with full parcel detail (address, score, kenmerken, etc.) — identical to pre-S02 behavior
3. Close the parcel panel via X button
4. **Expected:** Panel closes cleanly, map returns to normal state

### 6. Close button and Escape key

1. Open gemeente panel by clicking a gemeente boundary
2. Click the X button in the panel header
3. **Expected:** Panel slides out, map returns to overview
4. Open gemeente panel again
5. Press Escape key
6. **Expected:** Panel closes (same as X button)

### 7. Panel back navigation (wijk → gemeente)

1. Open gemeente panel, select a wijk
2. WijkMapPanel should open with a back button
3. Click the back button
4. **Expected:** WijkMapPanel closes, GemeenteContextPanel re-opens showing the same gemeente

## Edge Cases

### Rapid panel switching

1. Click gemeente boundary → panel opens
2. Immediately click a different gemeente boundary
3. **Expected:** Panel updates to show new gemeente data (no stale content, no dual panels)

### Panel while score layer is active

1. Start or have an active scan with score layer visible
2. Click a gemeente boundary
3. **Expected:** Gemeente panel opens without affecting the score layer. Score colors remain on parcels.

### Mobile viewport (< 768px)

1. Resize browser to mobile width (< 768px)
2. Click a gemeente boundary
3. **Expected:** Panel appears as a bottom sheet (not left-side fixed panel). Close by dragging down or pressing X.

## Failure Signals

- Gemeente panel appears on the RIGHT side instead of left → LeftPanelShell positioning broken
- Both gemeente panel and parcel panel visible simultaneously → ActivePanel mutual exclusion broken
- Panel doesn't appear on gemeente click → check activePanel state in React DevTools useMapPanels hook
- Panel appears but no summary cards → GemeenteContextPanel rendering issue
- Clicking summary card does nothing → check openModal state in GemeenteContextPanel
- GemeenteMapPanel.tsx still referenced → old component not fully replaced

## Requirements Proved By This UAT

- GEM-01 — Wijk boundaries visible on map, wijk list in gemeente panel
- GEM-02 — Gemeente context accessible via left panel (not bottom sheet)

## Not Proven By This UAT

- Modal data quality — S03 is responsible for ensuring modals show real data (CBS demographics, klimaat analysis, meldingen feed, wijk summaries)
- /meldingen route deletion — deferred to S03
- Kansenkaart color modes — S04 scope
- Pipeline management — S05 scope

## Notes for Tester

- The 4 summary card modals may show placeholder or incomplete data — that's expected, S03 fills them with real content
- LeftPanelShell mobile mode is untested — flag any layout issues but they're not blockers for S02
- If panel positioning looks off, the side rail width (80px) may have changed — measure the gap
- WijkMapPanel was moved from right (MapPanelShell) to left (LeftPanelShell) in S01 — verify it shows on the left
