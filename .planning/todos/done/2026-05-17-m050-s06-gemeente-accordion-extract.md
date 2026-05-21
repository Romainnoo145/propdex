# Todo: Extract GemeenteGroupAccordion from opgeslagen.tsx

**Created:** 2026-05-17
**Deferred from:** M050/S06 Plan 03 (Task 3)

## Problem

`frontend/src/routes/_authenticated/opgeslagen.tsx` is currently 318 lines after the
M050/S06 refactor (PipelineStagePill + SavedParcelCard extracted). The project 300-line
rule requires files under 300 lines. Full compliance deferred per plan decision.

## Solution

Extract the gemeente accordion block (the `filteredGroups.map(...)` render — currently
lines ~145-230 of opgeslagen.tsx) into:

`frontend/src/components/projects/GemeenteGroupAccordion.tsx`

Props:
- `group: GemeenteGroup` (from the opgeslagen.tsx interface)
- `isExpanded: boolean`
- `onToggle: () => void`
- `onOpenMap: (parcel: FavoriteResponse) => void`
- `onPotentieClick: (parcel: FavoriteResponse) => void`
- `onRisicoClick: (parcel: FavoriteResponse) => void`

After extraction, opgeslagen.tsx should land under 250 lines.

## Effort

~30 min — mechanical extraction, no logic changes.

## Linked plan

Phase 06-opgeslagen-cockpit-lifecycle-sidebar / Plan 06-03
