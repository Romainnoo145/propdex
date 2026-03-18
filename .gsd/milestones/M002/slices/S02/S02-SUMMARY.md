---
id: S02
parent: M002
milestone: M002
provides:
  - useMapPanels hook with ActivePanel union type and panel navigation handlers
  - GemeenteContextPanel component with 4 summary cards on left-side LeftPanelShell
  - LeftPanelShell component for left-positioned map overlays (desktop fixed, mobile bottom-sheet)
  - Panel mutual exclusion via ActivePanel state (gemeente | wijk | parcel)
requires:
  - slice: S01
    provides: Clean 3-item nav and route structure without /projecten, /rapporten
affects:
  - S03
  - S06
key_files:
  - frontend/src/hooks/useMapPanels.ts
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - useMapPanels hook accepts refs and callbacks as params (not importing map state directly) for decoupled testability
  - LeftPanelShell at left-[112px] (80px rail + 32px gap) with framer-motion slide-in and mobile bottom-sheet fallback
  - GemeenteContextPanel manages openModal state locally — card click → modal is self-contained
  - Summary card clicks open existing modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) instead of plan's toast placeholders
  - GemeenteMapPanel.tsx deleted (fully replaced by GemeenteContextPanel)
  - Parcel-opening setActivePanel calls kept inline in map.tsx (too many local deps to extract cleanly)
patterns_established:
  - LeftPanelShell pattern for left-side overlays (left-[112px], Aura glass bg-white/60 backdrop-blur-[24px], rounded-[24px])
  - useMapPanels hook as single source of panel orchestration — all panel state and navigation handlers centralized
  - Summary card grid — 2×2 clickable category cards with icon, title, description
observability_surfaces:
  - React DevTools: useMapPanels hook state → activePanel.kind shows current panel type (null/gemeente/wijk/parcel)
  - React DevTools: GemeenteContextPanel → openModal state shows which category modal is active (null/demografie/juridisch/meldingen/wijken)
  - If gemeente panel doesn't open on click, inspect activePanel state in useMapPanels — should transition to { kind: 'gemeente' }
  - If left positioning is wrong, verify LeftPanelShell CSS left-[112px] matches side rail width (80px + 32px gap)
drill_down_paths:
  - .gsd/milestones/M002/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S02/tasks/T02-SUMMARY.md
duration: 1h
verification_result: passed
completed_at: 2026-03-18
---

# S02: GemeenteContextPanel

**Extracted panel orchestration into useMapPanels hook and replaced right-side GemeenteMapPanel with left-side GemeenteContextPanel featuring 4 summary cards, wijk list, and category modals.**

## What Happened

**T01** created `useMapPanels.ts` (152 lines) extracting the ActivePanel union type, panel state, and 4 navigation handlers (handleGemeentePanelSelectWijk, handleWijkPanelBack, handleCloseGemeentePanel, handleCloseParcelPanel) from map.tsx. The hook accepts map dependencies as params (refs, callbacks) keeping it decoupled. map.tsx imports the hook and delegates panel orchestration to it; ~20 inline setActivePanel calls for parcel-opening remain in map.tsx as they depend on local click handler variables. Net reduction ~30 lines from map.tsx.

**T02** created two components: LeftPanelShell (left-positioned panel shell at `left-[112px]` with Aura glass styling, Escape handler, framer-motion slide-in) and GemeenteContextPanel (full gemeente overview with header, stats bar, 2×2 summary card grid, and wijk list). Summary card clicks open real existing modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) instead of the planned toast placeholders — strictly better. GemeenteMapPanel.tsx was deleted, replaced by GemeenteContextPanel in map.tsx.

The two key risks scoped to S02 — panel mutual exclusion and map.tsx complexity — are both retired: ActivePanel union type enforces one panel at a time, and useMapPanels hook centralizes panel state management.

## Verification

- `cd frontend && npx tsc --noEmit` — passed, zero errors
- All new files exist: useMapPanels.ts, GemeenteContextPanel.tsx, LeftPanelShell.tsx
- GemeenteMapPanel.tsx confirmed deleted
- ParcelDetailPanel.tsx not modified (KNOWLEDGE.md hard rule)
- Manual verification deferred to UAT (requires running app with MapLibre)

## Requirements Advanced

- GEM-01 — GemeenteContextPanel shows wijk list from wijkGeojson; wijk boundaries already rendered on map from S01 infrastructure
- GEM-02 — Gemeente context now accessible via left panel (not bottom sheet) — primary proof delivered

## Requirements Validated

- None moved to validated yet — runtime UAT needed to confirm panel interactions work end-to-end

## New Requirements Surfaced

- None

## Requirements Invalidated or Re-scoped

- None

## Deviations

- Summary card clicks open real modals instead of toast placeholders (plan said "toast placeholders, wired to modals in S03"). This is ahead of schedule — modals already existed in the codebase. S03 still needed to wire these modals with *real data* (current modals may have placeholder content).
- map.tsx reduced by ~30 lines instead of estimated 80-100. The parcel-opening setActivePanel calls account for more inline code than estimated. Extraction is correct per scope.

## Known Limitations

- Summary card modals open but may show placeholder/incomplete data — S03 is responsible for wiring real data into Demografie, JuridischKlimaat, Meldingen, and Wijken modals
- Panel click-outside-to-close behavior needs runtime verification (Escape key handled by LeftPanelShell)
- Mobile bottom-sheet mode for LeftPanelShell untested (desktop-first implementation)

## Follow-ups

- S03 should verify modal data content (not just modal opening) since card clicks already wire to modals
- S06 should audit GemeenteContextPanel card content for data-first redesign
- LeftPanelShell mobile bottom-sheet behavior should be tested during S03 or S06

## Files Created/Modified

- `frontend/src/hooks/useMapPanels.ts` — New hook: ActivePanel type, panel state, 4 navigation handlers
- `frontend/src/components/map/panels/LeftPanelShell.tsx` — New left-side panel shell with Aura glass styling, Escape handler, framer-motion animation
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — New gemeente panel with summary cards, stats bar, wijk list, modal integration
- `frontend/src/routes/_authenticated/map.tsx` — Replaced GemeenteMapPanel with GemeenteContextPanel, integrated useMapPanels hook
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` — Deleted (replaced by GemeenteContextPanel)

## Forward Intelligence

### What the next slice should know
- Summary card clicks already open modals (DemografieModal, etc.) — S03 doesn't need to wire click→modal, only ensure modals show real data
- useMapPanels hook is the single source for panel state — any new panel type must extend the ActivePanel union in `useMapPanels.ts`
- LeftPanelShell is available for any future left-positioned panels

### What's fragile
- `left-[112px]` positioning in LeftPanelShell is hardcoded to 80px side rail + 32px gap — if SideRailNav width changes, this breaks
- useMapPanels hook parameter list is long (~12 dependencies) — adding more panel types will increase coupling surface

### Authoritative diagnostics
- React DevTools → useMapPanels hook → `activePanel` state — this is the single source of truth for which panel is visible and why. If a panel doesn't show, check this first.
- React DevTools → GemeenteContextPanel → `openModal` state — shows which category modal is active (null when none open)

### What assumptions changed
- Assumed summary cards would need toast placeholders (modals not ready) — modals already existed, so cards wire directly to them. S03 scope narrows to data quality in modals, not modal wiring.
