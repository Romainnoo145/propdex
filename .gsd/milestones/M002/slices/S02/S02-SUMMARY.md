---
id: S02
parent: M002
milestone: M002
provides:
  - GemeenteContextPanel with 4 summary cards on left-side LeftPanelShell
  - useMapPanels hook managing ActivePanel state and panel navigation handlers
  - LeftPanelShell component for left-side map overlays
  - Mutual exclusion between gemeente, wijk, and parcel panels
requires:
  - slice: S01
    provides: Clean 3-item nav and route structure
affects:
  - S03
key_files:
  - frontend/src/hooks/useMapPanels.ts
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - Kept parcel-opening setActivePanel calls inline in map.tsx (too many local click-handler dependencies to extract cleanly)
  - useMapPanels hook accepts refs and callbacks as params rather than importing map state directly
  - Summary card clicks open real modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) instead of toast placeholders — modals existed from prior work
  - GemeenteContextPanel manages openModal state locally rather than passing onCardClick up to map.tsx
  - LeftPanelShell uses framer-motion for slide-in animation from left, consistent with other panel transitions
patterns_established:
  - LeftPanelShell pattern — left-side panel shell at left-[112px] with bottom-sheet mobile fallback, Escape handler, Aura glass styling
  - Summary card grid — 2×2 grid of clickable category cards with icon, title, description
  - useMapPanels hook — centralized panel orchestration with ActivePanel union type
observability_surfaces:
  - React DevTools: useMapPanels hook state shows activePanel.kind transitions (gemeente | wijk | parcel)
  - React DevTools: openModal state in GemeenteContextPanel shows which category modal is active (null | demografie | juridisch | meldingen | wijken)
  - If panel doesn't appear on gemeente click, check activePanel state in useMapPanels hook via React DevTools
drill_down_paths:
  - .gsd/milestones/M002/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S02/tasks/T02-SUMMARY.md
duration: 1h
verification_result: passed
completed_at: 2026-03-18
---

# S02: GemeenteContextPanel

**Extracted panel orchestration into useMapPanels hook and replaced right-side GemeenteMapPanel with left-side GemeenteContextPanel featuring 4 intelligence summary cards, wijk list, and category modals.**

## What Happened

**T01** extracted ActivePanel union type, panel state, and 4 navigation handlers (gemeente↔wijk transitions, close handlers) from map.tsx into a dedicated `useMapPanels` hook (152 lines). The hook accepts map dependencies as params and returns `{ activePanel, setActivePanel, inspectorParcel, handleGemeentePanelSelectWijk, handleWijkPanelBack, handleCloseGemeentePanel, handleCloseParcelPanel }`. Parcel-opening setActivePanel calls stayed inline in map.tsx — they depend on too many local click-handler variables to extract cleanly. map.tsx reduced by ~30 lines.

**T02** created `LeftPanelShell` (left-side panel shell at `left-[112px]`, 400px wide, Aura glass styling, framer-motion slide-in, Escape handler, mobile bottom-sheet fallback) and `GemeenteContextPanel` (header with gemeente name, stats bar with wijk/scanned counts, 2×2 summary card grid for Demografie/Juridisch Klimaat/Meldingen/Wijken, scrollable wijk list). Card clicks open real modals that already existed in the codebase — strictly better than the planned toast placeholders. GemeenteMapPanel.tsx was deleted entirely, replaced by GemeenteContextPanel in map.tsx.

## Verification

- `cd frontend && npx tsc --noEmit` — passes clean, zero errors
- All key files exist: useMapPanels.ts, GemeenteContextPanel.tsx, LeftPanelShell.tsx
- GemeenteMapPanel.tsx confirmed deleted
- ParcelDetailPanel.tsx not modified (KNOWLEDGE.md hard rule respected)
- Manual verification deferred to UAT (requires running app with MapLibre)

## Requirements Advanced

- GEM-01 — Gemeente panel now shows wijk list with boundaries context; full boundary visualization was pre-existing
- GEM-02 — Gemeente context accessible via left-side panel instead of bottom sheet; panel provides summary cards for 4 intelligence categories

## Requirements Validated

- none (runtime verification needed to fully validate GEM-01/GEM-02)

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- Summary card clicks open real modals instead of toast placeholders (existing modals reused — strictly better than plan)
- map.tsx reduced by ~30 lines instead of estimated 80-100 (parcel-opening calls account for more inline code than estimated; extraction scope was correct per plan)
- Added `scans: ScanListItem[]` prop to GemeenteContextPanel (not in plan, needed by DemografieModal and WijkenModal for real data)

## Known Limitations

- Manual UAT not yet performed (requires running app with backend + frontend on live map)
- Category modals render existing data but S03 will wire them to full-page modals with real detailed intelligence data
- LeftPanelShell mobile bottom-sheet behavior not tested on actual mobile viewport

## Follow-ups

- S03 wires summary card clicks to full-page modals with real detailed data (replacing the simpler modals currently rendered)
- LeftPanelShell mobile behavior should be verified during S03 or later mobile testing

## Files Created/Modified

- `frontend/src/hooks/useMapPanels.ts` — New hook with ActivePanel type, panel state, and 4 navigation handlers
- `frontend/src/components/map/panels/LeftPanelShell.tsx` — New left-side panel shell with Aura glass styling, Escape handler, framer-motion animation
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — New gemeente overview panel with summary cards, stats bar, wijk list, and modal integration
- `frontend/src/routes/_authenticated/map.tsx` — Imports useMapPanels hook, replaced GemeenteMapPanel with GemeenteContextPanel
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` — Deleted (fully replaced by GemeenteContextPanel)

## Forward Intelligence

### What the next slice should know
- GemeenteContextPanel already renders category modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) via local openModal state. S03 needs to either replace these with full-page modals or enhance the existing ones with detailed data views.
- useMapPanels hook is the single source of truth for panel state. Any new panel interactions should go through this hook.
- LeftPanelShell is reusable for any future left-side map overlay panels.

### What's fragile
- useMapPanels hook takes many dependencies as params (activeGemeenteRef, wijkGeojson, scanHistory, mapRef, etc.) — adding new panel types requires extending the param list, which could get unwieldy.
- The ~20 inline setActivePanel calls in map.tsx for parcel-opening are still tightly coupled to local click handler variables. If map.tsx grows further, these should eventually be extracted.

### Authoritative diagnostics
- React DevTools → useMapPanels hook state → activePanel.kind shows current panel ('gemeente' | 'wijk' | 'parcel' | null) — this is the single source of truth for which panel is visible
- React DevTools → GemeenteContextPanel → openModal state shows which category modal is active — null means no modal, string value names the active modal
- If GemeenteContextPanel doesn't appear after clicking a gemeente, check activePanel in useMapPanels first — if it's not 'gemeente', the click handler in map.tsx isn't setting it correctly

### What assumptions changed
- Plan assumed modals didn't exist yet (toast placeholders needed) — modals already existed from prior work, so real functionality shipped instead of placeholders
