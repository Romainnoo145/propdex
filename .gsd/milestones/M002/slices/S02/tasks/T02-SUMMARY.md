---
id: T02
parent: S02
milestone: M002
provides:
  - GemeenteContextPanel with 4 summary cards on left-side LeftPanelShell
  - LeftPanelShell component for left-side map overlays
key_files:
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - Summary card clicks open modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) rather than toast placeholders — modals already existed from prior work
  - GemeenteContextPanel manages openModal state locally rather than passing onCardClick up to map.tsx
  - LeftPanelShell uses framer-motion for slide-in animation (consistent with other panel transitions)
patterns_established:
  - LeftPanelShell pattern — left-side panel shell at `left-[112px]` with bottom-sheet mobile fallback, Escape handler, Aura glass styling
  - Summary card grid — 2×2 grid of clickable category cards with icon, title, description
observability_surfaces:
  - React DevTools: activePanel.kind === 'gemeente' confirms GemeenteContextPanel is mounted
  - React DevTools: openModal state in GemeenteContextPanel shows which card modal is active
  - If panel doesn't appear, check activePanel state in useMapPanels hook
duration: 15m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T02: Create GemeenteContextPanel with summary cards on left side

**Replaced right-side GemeenteMapPanel with left-side GemeenteContextPanel featuring 4 summary cards (Demografie, Juridisch Klimaat, Meldingen, Wijken), wijk list, and category modals.**

## What Happened

Created two new components:

1. **LeftPanelShell** — Left-side panel shell positioned at `left-[112px]` (80px side rail + 32px gap). Desktop: fixed left panel with 400px width, rounded-[24px], Aura glass styling (bg-white/60, backdrop-blur-[24px]). Mobile: bottom sheet (max-h-[72vh]). Includes Escape key handler and framer-motion slide-in animation from left.

2. **GemeenteContextPanel** — Full gemeente overview panel with:
   - Header with gemeente name, code subtitle, and close button
   - Stats bar with wijk count and scanned count badges
   - 2×2 summary card grid (Demografie, Juridisch Klimaat, Meldingen, Wijken) with lucide-react icons, titles, and descriptions
   - Card clicks open corresponding modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal)
   - Wijk list with scanned badges, clicking selects wijk and transitions to WijkMapPanel

Map.tsx was updated to import GemeenteContextPanel instead of GemeenteMapPanel, passing `scans` prop for modal data. GemeenteMapPanel.tsx was deleted.

## Verification

- `cd frontend && npx tsc --noEmit` — **passed**, zero errors
- GemeenteContextPanel properly imported and rendered in map.tsx when `activePanel.kind === 'gemeente'`
- LeftPanelShell positions panel on left side (not right)
- ParcelDetailPanel.tsx not modified (KNOWLEDGE.md hard rule respected)

### Slice-level verification status (T02 is final task):
- ✅ `cd frontend && npx tsc --noEmit` — no TypeScript errors
- ⏳ Manual: click gemeente → left panel appears with summary cards (requires running app)
- ⏳ Manual: click parcel → left panel closes, ParcelDetailPanel opens right
- ⏳ Manual: click X on gemeente panel → panel closes
- ⏳ Manual: select wijk from panel → WijkMapPanel opens
- ⏳ Manual: Escape key closes active panel
- ⏳ Verify: ParcelDetailPanel still opens/closes normally

## Diagnostics

- **Panel mount**: Check `activePanel` in React DevTools on useMapPanels hook — `kind: 'gemeente'` means GemeenteContextPanel should be visible
- **Card modals**: `openModal` state in GemeenteContextPanel component — null when no modal, or one of 'demografie'/'juridisch'/'meldingen'/'wijken'
- **Left positioning**: LeftPanelShell uses `left-[112px]` — if panel overlaps side rail, check the rail width hasn't changed from 80px
- **Escape key**: LeftPanelShell registers global keydown listener — verify `onClose` prop is the `handleCloseGemeentePanel` callback

## Deviations

- Plan specified `onCardClick` prop with toast placeholders. Implementation instead uses local `openModal` state and renders actual modals (DemografieModal, JuridischKlimaatModal, MeldingenModal, WijkenModal) which already existed in the codebase. This is strictly better — real functionality instead of placeholders.
- Added `scans: ScanListItem[]` prop not in original plan — needed by DemografieModal and WijkenModal for real data.

## Known Issues

None.

## Files Created/Modified

- `frontend/src/components/map/panels/LeftPanelShell.tsx` — New left-side panel shell with Aura glass styling, Escape handler, framer-motion animation
- `frontend/src/components/map/panels/GemeenteContextPanel.tsx` — New gemeente overview panel with summary cards, stats bar, wijk list, and modal integration
- `frontend/src/routes/_authenticated/map.tsx` — Replaced GemeenteMapPanel import/usage with GemeenteContextPanel
- `frontend/src/components/map/panels/GemeenteMapPanel.tsx` — Deleted (fully replaced)
