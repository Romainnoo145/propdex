---
id: S03
parent: M002
milestone: M002
provides:
  - GemeenteModal reusable full-page modal shell (framer-motion, capture-phase Escape, portal to body)
  - DemografieModal with CBS wijk-level aggregation and empty-state fallback
  - WijkenModal with scan status cards and wijk selection
  - JuridischKlimaatModal wrapping existing JurisprudenceSection (max-w-5xl)
  - MeldingenModal with gemeente-filtered infinite scroll, read tracking, date grouping
  - /meldingen route killed (redirect stub to /map)
requires:
  - slice: S02
    provides: GemeenteContextPanel with summary cards and panelPortalRef integration
affects:
  - S04
  - S05
key_files:
  - frontend/src/components/map/panels/gemeente/GemeenteModal.tsx
  - frontend/src/components/map/panels/gemeente/DemografieModal.tsx
  - frontend/src/components/map/panels/gemeente/WijkenModal.tsx
  - frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx
  - frontend/src/components/map/panels/gemeente/MeldingenModal.tsx
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
  - frontend/src/routes/_authenticated/meldingen.tsx
key_decisions:
  - GemeenteModal uses capture-phase keydown listener to intercept Escape before LeftPanelShell closes the panel
  - WijkenModal derives scannedWijkNames from scans prop internally (no external prop needed)
  - JuridischKlimaatModal uses max-w-5xl for side-by-side feed+viewer layout
  - MeldingenModal is a simplified feed (no master-detail), click navigates to map directly
  - DemografieModal aggregates CBS data from scanned wijken (no dedicated gemeente-level endpoint)
  - /meldingen converted to redirect stub (not deleted) for safety
patterns_established:
  - Capture-phase Escape handling for nested modal-in-panel UI
  - Thin modal wrappers embedding existing self-contained section components (JurisprudenceSection)
  - Local openModal state in GemeenteContextPanel — card click → modal is self-contained
observability_surfaces:
  - openModal state on GemeenteContextPanel in React DevTools — null=no modal, category string=modal active
  - DemografieModal fallback text "Geen CBS data beschikbaar" visible when no completed scans exist
  - MeldingenModal IntersectionObserver sentinel div at bottom of feed (inspect DOM for scroll debugging)
  - GemeenteModal portal element at document.body root (z-index 60) — inspect DOM root
  - JuridischKlimaatModal: JurisprudenceSection hooks auto-fetch on mount — loading spinner visible
drill_down_paths:
  - .gsd/milestones/M002/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S03/tasks/T02-SUMMARY.md
duration: 50m
verification_result: passed
completed_at: 2026-03-17
---

# S03: Gemeente Intelligence Modals

**Four full-page modals (Demografie, Juridisch Klimaat, Meldingen, Wijken) wired to GemeenteContextPanel summary cards with real data. /meldingen standalone route killed.**

## What Happened

Most modal components were already implemented during S02 work that ran ahead of plan. T01 fixed TypeScript errors (WijkenModal scannedWijkNames prop, peiljaar type mismatch) and solved an Escape key conflict where pressing Escape closed both the modal AND the parent LeftPanelShell. Fix: GemeenteModal registers a capture-phase keydown listener with `stopImmediatePropagation()`, and LeftPanelShell checks `e.defaultPrevented`.

T02 verified the JuridischKlimaatModal (thin wrapper around JurisprudenceSection) and MeldingenModal (infinite scroll with read tracking and date grouping) were already working. Added `maxWidth="max-w-5xl"` to JuridischKlimaatModal for the side-by-side feed+viewer layout. Confirmed /meldingen route was already a redirect stub to /map.

Net code change: -891 lines (307 added, 1198 removed) — the old meldingen.tsx was 1,195 lines.

## Verification

- `cd frontend && npx tsc --noEmit` — zero errors
- Browser: click gemeente → panel → click each of 4 summary cards → correct modal opens
- Browser: Escape closes modal only (panel stays open)
- Browser: /meldingen → redirects to /map
- Browser: ParcelDetailPanel works unchanged

## Requirements Advanced

- MELD-01 — Meldingen feed now embedded in gemeente modal with bento-style card rendering
- MELD-02 — Gemeente filter preserved (modal receives gemeenteNaam), infinite scroll via IntersectionObserver

## Requirements Validated

- none (MELD-01/MELD-02 need UAT with real meldingen data to fully validate)

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- Components were pre-built during S02 execution. T01 and T02 focused on fixes and verification rather than creation from scratch.
- LeftPanelShell.tsx modified (not in original plan) for Escape key isolation.

## Known Limitations

- DemografieModal aggregates from scanned wijken only. Gemeente with no scanned wijken shows empty state. A dedicated gemeente-level CBS endpoint would be more complete.
- MeldingenModal is a simplified feed — no master-detail layout like the old standalone page. Click navigates to map directly.
- `rapport.$id.tsx` still has `from: 'meldingen'` navigation path that hits the redirect stub. Dead code path but harmless.

## Follow-ups

- none

## Files Created/Modified

- `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx` — reusable modal shell with capture-phase Escape
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — CBS data aggregation, peiljaar type fix
- `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` — derived scannedWijkNames, scan status cards
- `frontend/src/components/map/panels/gemeente/JuridischKlimaatModal.tsx` — max-w-5xl for side-by-side layout
- `frontend/src/components/map/panels/gemeente/MeldingenModal.tsx` — infinite scroll feed with read tracking
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — local openModal state wiring all 4 modals
- `frontend/src/components/map/panels/LeftPanelShell.tsx` — defaultPrevented check for Escape
- `frontend/src/routes/_authenticated/meldingen.tsx` — redirect stub to /map

## Forward Intelligence

### What the next slice should know
- All 4 gemeente modals are live and self-contained within GemeenteContextPanel. Adding new modals follows the same pattern: create a `*Modal.tsx` in the gemeente/ directory, add a case to `openModal` state.
- DemografieModal data comes from scanned wijken' neighborhood_metrics — no data without scans.
- JuridischKlimaatModal embeds JurisprudenceSection which does its own data fetching — no additional wiring needed.

### What's fragile
- Escape key isolation depends on capture-phase ordering between GemeenteModal and LeftPanelShell — if another component adds a capture-phase Escape handler, the priority chain breaks.
- MeldingenModal IntersectionObserver sentinel must remain the last child in the scroll container for infinite scroll to work.

### Authoritative diagnostics
- `openModal` state in React DevTools on GemeenteContextPanel — null means no modal, string means modal category is active. This is the single source of truth for modal state.
- DemografieModal empty state ("Geen CBS data beschikbaar") confirms whether CBS data exists for the selected gemeente's wijken.
- Network tab: JurisprudenceSection fires its own API calls on mount — check for 401s if data doesn't load (likely stale auth token).

### What assumptions changed
- Assumed modals would be built from scratch in S03 — they were pre-built during S02 execution. S03 became a fix-and-verify slice.
