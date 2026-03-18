# S02: GemeenteContextPanel

**Goal:** Clicking a gemeente boundary opens a ~400px left-side panel with summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken). Panel closes when clicking elsewhere or selecting a parcel. ParcelDetailPanel works unchanged. Panel orchestration extracted from map.tsx into useMapPanels hook.

**Demo:** Click gemeente boundary → left panel slides in with gemeente name, summary cards for 4 categories, and wijk list. Click a parcel → left panel closes, ParcelDetailPanel opens on the right. Click X on gemeente panel → panel closes, map returns to overview. Select wijk from panel → WijkMapPanel opens with scan/CBS data.

## Must-Haves

- GemeenteContextPanel renders on the LEFT side (~400px) as a map overlay
- Panel shows summary cards: Demografie, Juridisch Klimaat, Meldingen, Wijken
- Summary cards have onClick handlers (wired to modals in S03 — for now just toast placeholders)
- ParcelDetailPanel continues to work unchanged on the RIGHT (portal-based)
- Mutual exclusion: only one panel visible at a time (gemeente OR wijk OR parcel)
- useMapPanels hook extracted from map.tsx managing ActivePanel state and panel transition handlers
- Clicking outside panel or pressing Escape closes it
- WijkMapPanel continues to work (opened from gemeente panel's wijk list)
- ParcelDetailPanel.tsx and ParcelDetailModal are NOT modified (KNOWLEDGE.md hard rule)

## Proof Level

- This slice proves: integration (panel orchestration on live map)
- Real runtime required: yes (MapLibre click handlers, panel transitions)
- Human/UAT required: yes (panel layout, transitions, mutual exclusion)

## Verification

- `cd frontend && npx tsc --noEmit` — no TypeScript errors
- Manual: click gemeente → left panel appears with summary cards
- Manual: click parcel → left panel closes, ParcelDetailPanel opens right
- Manual: click X on gemeente panel → panel closes
- Manual: select wijk from panel → WijkMapPanel opens
- Manual: Escape key closes active panel
- Verify: ParcelDetailPanel still opens/closes normally (unchanged)

## Observability / Diagnostics

- Runtime signals: activePanel state transitions logged in useMapPanels (kind changes)
- Inspection surfaces: React DevTools — useMapPanels hook state
- Failure visibility: Panel doesn't open → check activePanel state in devtools
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: map.tsx gemeente click handler, ActivePanel union type, MapPanelShell, ParcelDetailPanel (read-only)
- New wiring introduced: useMapPanels hook replaces direct setActivePanel calls in map.tsx, GemeenteContextPanel replaces GemeenteMapPanel, LeftPanelShell for left-side positioning
- What remains: S03 wires summary card clicks to full-page modals with real data

## Tasks

- [x] **T01: Extract useMapPanels hook from map.tsx** `est:1h`
  - Why: map.tsx is 2,373 lines with ~20 setActivePanel calls scattered throughout. Extracting panel orchestration reduces complexity and makes the ActivePanel type a clean contract boundary. This must land first because T02 builds on the hook.
  - Files: `frontend/src/hooks/useMapPanels.ts`, `frontend/src/routes/_authenticated/map.tsx`
  - Do:
    1. Create `frontend/src/hooks/useMapPanels.ts` with the ActivePanel union type, activePanel state, and all panel transition handlers:
       - `activePanel` state and `setActivePanel`
       - `handleGemeentePanelSelectWijk` — transitions from gemeente to wijk panel
       - `handleWijkPanelBack` — transitions from wijk back to gemeente panel
       - `handleCloseGemeentePanel` — closes gemeente panel, clears activeGemeente, resets map view
       - `handleCloseParcelPanel` — closes parcel panel, clears geometry highlight
       - `inspectorParcel` derived from activePanel
    2. Hook accepts dependencies as params: `activeGemeenteRef`, `wijkGeojson`, `scanHistory`, `mapRef`, `removeWijkBoundariesLayer`, `setWijkGeojson`, `setActiveGemeente`, `removeScanAreaHighlight`, `addScanAreaHighlight`, `calculateBboxFromGeometry`, `setParcelGeometryHighlight`
    3. The hook returns `{ activePanel, setActivePanel, inspectorParcel, handleGemeentePanelSelectWijk, handleWijkPanelBack, handleCloseGemeentePanel, handleCloseParcelPanel }`
    4. In map.tsx: import and call useMapPanels, replace direct state and handlers with hook returns. Remove the extracted code (ActivePanel type, useState, useCallbacks for panel transitions).
    5. Keep all parcel-opening setActivePanel calls inline in map.tsx for now (they depend on many local variables from click handlers). Only extract the panel *navigation* handlers (gemeente↔wijk, close).
  - Verify: `cd frontend && npx tsc --noEmit` passes. App loads, all existing panel interactions work identically.
  - Done when: map.tsx is shorter by ~80-100 lines, useMapPanels hook manages ActivePanel state, all panel transitions work.

- [ ] **T02: Create GemeenteContextPanel with summary cards on left side** `est:1h`
  - Why: The current GemeenteMapPanel is a right-side overlay with a simple wijk list. S02 requires a left-side panel (~400px) with summary cards for 4 intelligence categories. This replaces GemeenteMapPanel.
  - Files: `frontend/src/components/map/panels/GemeenteContextPanel.tsx`, `frontend/src/components/map/panels/LeftPanelShell.tsx`, `frontend/src/routes/_authenticated/map.tsx`
  - Do:
    1. Create `LeftPanelShell.tsx` — a panel shell positioned on the LEFT side of the map. Desktop: `fixed left-[112px] top-4 bottom-4 w-[400px]` (112px = 80px side rail + 32px gap). Mobile: bottom sheet (same as MapPanelShell mobile). Includes Escape handler, rounded corners, backdrop blur matching design system.
    2. Create `GemeenteContextPanel.tsx` using LeftPanelShell:
       - Header: gemeente name + close button
       - Stats bar: wijk count + scanned count badges
       - Summary cards section with 4 clickable cards:
         - **Demografie** — icon + label, onClick triggers toast placeholder "Komt in S03"
         - **Juridisch Klimaat** — icon + label, same placeholder
         - **Meldingen** — icon + label, same placeholder
         - **Wijken** — shows wijk count, clicking scrolls to wijk list below
       - Wijk list section (same as current GemeenteMapPanel but styled as cards)
       - Each summary card: rounded-lg border, icon, title, brief description, hover effect
    3. Props: `naam`, `code`, `wijkGeojson`, `scannedWijkNames`, `onClose`, `onSelectWijk`, `onCardClick: (category: string) => void`
    4. In map.tsx: replace `<GemeenteMapPanel>` with `<GemeenteContextPanel>`. Pass `onCardClick` that shows toast for now. Update import.
    5. Delete or deprecate GemeenteMapPanel.tsx (replaced by GemeenteContextPanel).
  - Verify: `cd frontend && npx tsc --noEmit` passes. Click gemeente → left panel with summary cards appears. Select wijk → WijkMapPanel works. ParcelDetailPanel still works on right.
  - Done when: GemeenteContextPanel renders on the left with 4 summary cards, wijk list, and proper styling. Mutual exclusion with parcel panel works.

## Files Likely Touched

- `frontend/src/hooks/useMapPanels.ts` (new)
- `frontend/src/routes/_authenticated/map.tsx`
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` (new)
- `frontend/src/components/map/panels/LeftPanelShell.tsx` (new)
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` (deprecated/deleted)
- `frontend/src/components/map/panels/MapPanelShell.tsx` (reference only)
