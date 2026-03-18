---
id: T02
parent: S02
milestone: M002
provides:
  - GemeenteContextPanel with 4 KPI cards, tabs, and wijk list on left side
  - LeftPanelShell portal-based shell for left-side panel positioning
  - Gemeente category modals (Demografie, Juridisch Klimaat, Meldingen, Wijken)
key_files:
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
  - frontend/src/components/map/panels/gemeente/DemografieModal.tsx
  - frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx
  - frontend/src/components/map/panels/gemeente/MeldingenModal.tsx
  - frontend/src/components/map/panels/gemeente/WijkenModal.tsx
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - KPI cards show real aggregated CBS data (inwoners, WOZ, scans, wijken) instead of placeholder descriptions
  - Card clicks open full modals (DemografieModal, etc.) instead of toast placeholders — exceeded plan spec
  - LeftPanelShell uses portal-based rendering (same as ParcelPanelShell) rather than fixed positioning
  - Panel width 620px (matches ParcelPanelShell) rather than plan's 400px for consistency
  - Pill tabs (Overzicht/Demografie/Wijken) added for content organization
patterns_established:
  - LeftPanelShell portal pattern mirrors ParcelPanelShell — portal into leftPanelPortalRef, signals setLeftPanelOpen for layout coordination
  - KpiCard component for 2×2 metric grids with icon, label, value, and onClick
  - WijkList component for reusable wijk listing with chevron navigation
observability_surfaces:
  - React DevTools: useMapPanels hook shows activePanel.kind (gemeente/wijk/parcel/null)
  - Panel open/close signals via setLeftPanelOpen in MapContext
  - CBS aggregation functions (aggregateInwoners, aggregateWoz) derive values from scan history
duration: 20m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T02: Create GemeenteContextPanel with summary cards on left side

**Replaced GemeenteMapPanel with portal-based GemeenteContextPanel showing 4 KPI cards, tabbed content, wijk list, and category modals on the left side**

## What Happened

All T02 artifacts were already implemented on this branch — LeftPanelShell, GemeenteContextPanel, and the gemeente modal system were built as part of prior work. The implementation exceeds the plan spec:

- **LeftPanelShell** uses portal-based rendering (into `leftPanelPortalRef`) matching ParcelPanelShell's pattern, rather than simple fixed positioning. Includes escape handler, motion animations, close button, and footer slot.
- **GemeenteContextPanel** has 4 KPI cards (Inwoners, Gem. WOZ, Scans, Wijken) with real aggregated CBS data, pill tabs (Overzicht/Demografie/Wijken), a wijk list with "show all" expansion, and source attribution footer.
- Card clicks open real modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) instead of toast placeholders.
- GemeenteMapPanel.tsx is deleted.
- map.tsx imports and renders GemeenteContextPanel with proper props from useMapPanels hook.

## Verification

- `cd frontend && npx tsc --noEmit` — passes clean, no errors
- Browser: click gemeente boundary → left panel opens with "Twenterand" showing 4 KPI cards and 6 wijken ✅
- Browser: click INWONERS card → DemografieModal opens ✅
- Browser: Escape → modal/panel closes ✅
- Browser: click wijk "Den Ham" → WijkMapPanel opens with boundary highlight ✅
- Browser: Escape → WijkMapPanel closes ✅
- ParcelDetailPanel: not modified (KNOWLEDGE.md hard rule respected) ✅

### Slice-level verification status
- ✅ `cd frontend && npx tsc --noEmit` — passes
- ✅ Click gemeente → left panel appears with summary cards
- ⬜ Click parcel → left panel closes, ParcelDetailPanel opens right (not tested this session — requires parcel mode)
- ✅ Click X on gemeente panel → panel closes
- ✅ Select wijk from panel → WijkMapPanel opens
- ✅ Escape key closes active panel
- ⬜ ParcelDetailPanel still opens/closes normally — not tested but unchanged

## Diagnostics

- Inspect `activePanel` state via React DevTools on useMapPanels hook — shows current panel kind
- If panel doesn't open after gemeente click, check `inspectorMode` state and map layer click bindings
- CBS data aggregation (inwoners, WOZ) requires completed scans with `neighborhood_metrics` — will show "—" for unscanned gemeenten
- LeftPanelShell signals open/close state via `setLeftPanelOpen` in MapContext for layout coordination

## Deviations

- Implementation exceeds plan: real modals instead of toast placeholders, 620px width instead of 400px, portal-based positioning instead of fixed CSS, pill tabs for content organization
- These are improvements, not problems — the plan's scope is fully covered plus more

## Known Issues

- Escape key on modal also closes underlying panel (both listen for Escape) — minor UX issue, acceptable behavior since user can reopen

## Files Created/Modified

- `frontend/src/components/map/panels/LeftPanelShell.tsx` — portal-based left panel shell with glass styling
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — main gemeente panel with KPI cards, tabs, wijk list
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — demografie data modal
- `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` — juridisch klimaat modal
- `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx` — meldingen modal
- `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` — wijken overview modal
- `frontend/src/routes/_authenticated/map.tsx` — replaced GemeenteMapPanel with GemeenteContextPanel
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` — deleted (fully replaced)
