---
id: T01
parent: S03
milestone: M002
provides:
  - GemeenteModal reusable shell component
  - DemografieModal with CBS data aggregation and fallback
  - WijkenModal with scan status and wijk selection
  - Escape key isolation (modal closes without closing panel)
key_files:
  - frontend/src/components/map/panels/gemeente/GemeenteModal.tsx
  - frontend/src/components/map/panels/gemeente/DemografieModal.tsx
  - frontend/src/components/map/panels/gemeente/WijkenModal.tsx
  - frontend/src/components/map/panels/GemeenteContextPanel.tsx
  - frontend/src/components/map/panels/LeftPanelShell.tsx
key_decisions:
  - GemeenteModal uses capture-phase keydown listener to intercept Escape before LeftPanelShell
  - WijkenModal derives scannedWijkNames from scans prop instead of requiring separate prop
  - peiljaar typed as number|null to match CbsNeighborhoodMetrics type
patterns_established:
  - Capture-phase Escape handling for nested modal-in-panel pattern
observability_surfaces:
  - openModal state on GemeenteContextPanel (React DevTools)
  - DemografieModal fallback message visible when no CBS data
duration: 30m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T01: Create modal shell and Demografie + Wijken modals

**Fixed TS errors, Escape key isolation, and verified all three modal components in browser**

## What Happened

The modal components (GemeenteModal, DemografieModal, WijkenModal) and the panel integration were already implemented from S02 work that ran ahead of plan. This task fixed two issues:

1. **TypeScript errors**: WijkenModal declared `scannedWijkNames` as a required prop but GemeenteContextPanel didn't pass it. Fixed by deriving scannedWijkNames from the `scans` array inside WijkenModal via `useMemo`. Also fixed `peiljaar` type mismatch (was `string | null`, CBS type is `number`).

2. **Escape key conflict**: Both GemeenteModal and LeftPanelShell registered `document.addEventListener('keydown')` for Escape. Since LeftPanelShell registered first, pressing Escape closed both the modal AND the panel. Fixed by having GemeenteModal register on the **capture phase** (`addEventListener('keydown', handler, true)`) with `stopImmediatePropagation()`, and having LeftPanelShell check `e.defaultPrevented`. Now Escape closes only the modal.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors in gemeente-related files (40 pre-existing errors in unrelated projects/ files)
- Browser: Click gemeente → panel opens → click INWONERS card → DemografieModal opens with fallback text → Escape → modal closes, panel stays → click WIJKEN card → WijkenModal shows 8 wijken in grid → click "Beemster" → modal closes, wijk selected on map
- All must-haves verified passing

## Diagnostics

- `openModal` state on GemeenteContextPanel in React DevTools — null when no modal, category string when open
- DemografieModal shows "Geen CBS data beschikbaar" fallback when no completed scans exist
- GemeenteModal uses `createPortal(document.body)` — inspect DOM root for portal elements

## Deviations

- Components were already implemented from S02. This task focused on fixing TS errors and the Escape key isolation bug rather than creating files from scratch.
- LeftPanelShell was modified (not in original plan) to check `e.defaultPrevented` for correct Escape key handling.

## Known Issues

- None

## Files Created/Modified

- `frontend/src/components/map/panels/gemeente/GemeenteModal.tsx` — capture-phase Escape handler with stopImmediatePropagation
- `frontend/src/components/map/panels/gemeente/DemografieModal.tsx` — fixed peiljaar type (string→number)
- `frontend/src/components/map/panels/gemeente/WijkenModal.tsx` — removed scannedWijkNames prop, derives from scans
- `frontend/src/components/map/panels/LeftPanelShell.tsx` — added defaultPrevented check for Escape
