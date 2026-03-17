---
id: T01
parent: S02
milestone: M002
provides:
  - useMapPanels hook with ActivePanel type, panel state, and navigation handlers
  - Clean contract boundary for panel orchestration consumed by map.tsx
key_files:
  - frontend/src/hooks/useMapPanels.ts
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - Hook was already extracted in prior work (S01 or earlier); T01 validated completeness rather than re-implementing
patterns_established:
  - Panel orchestration hooks accept refs and callbacks as params, return state + handlers
  - Parcel-opening setActivePanel calls stay inline in map.tsx (too many local dependencies to extract)
observability_surfaces:
  - React DevTools — useMapPanels hook state shows activePanel with kind discriminator
duration: 5m
verification_result: passed
completed_at: 2026-03-17
blocker_discovered: false
---

# T01: Extract useMapPanels hook from map.tsx

**useMapPanels hook already extracted and integrated — validated completeness, no code changes needed.**

## What Happened

The `useMapPanels` hook at `frontend/src/hooks/useMapPanels.ts` (138 lines) was already fully implemented from prior slice work. It exports:
- `ActivePanel` union type (gemeente | wijk | parcel)
- `activePanel` state + `setActivePanel` setter
- `inspectorParcel` derived state
- `handleGemeentePanelSelectWijk`, `handleWijkPanelBack`, `handleCloseGemeentePanel`, `handleCloseParcelPanel`

map.tsx (2,323 lines) already imports and uses the hook at line 100 and destructures all returns at lines 350-358. No duplicate ActivePanel type or useState remains in map.tsx. Parcel-opening `setActivePanel` calls remain inline as planned.

## Verification

- `cd frontend && npx tsc --noEmit` — passes with zero errors
- Confirmed no duplicate `useState<ActivePanel>` in map.tsx (grep returns empty)
- Hook exports match plan: ActivePanel type + 7 return values
- Hook line count: 138 (within plan's 120-150 estimate)

### Slice-level verification (partial, T01 is intermediate):
- ✅ `cd frontend && npx tsc --noEmit` — no TypeScript errors
- ⏳ Manual: click gemeente → left panel appears with summary cards (T02 work)
- ⏳ Manual: click parcel → left panel closes, ParcelDetailPanel opens right (T02 work)
- ⏳ Manual: click X on gemeente panel → panel closes (T02 work)
- ⏳ Manual: select wijk from panel → WijkMapPanel opens (T02 work)
- ⏳ Manual: Escape key closes active panel (T02 work)
- ✅ Verify: ParcelDetailPanel not modified (confirmed no changes)

## Diagnostics

- Inspect `activePanel` in React DevTools under the useMapPanels hook
- If panel transitions fail, verify hook dependencies are populated (activeGemeenteRef, wijkGeojson, mapRef)

## Deviations

The hook was already implemented from prior work — no extraction needed. T01 became a validation task rather than an implementation task. This is expected since S01 may have delivered this as part of its scope.

## Known Issues

None.

## Files Created/Modified

- `.gsd/milestones/M002/slices/S02/tasks/T01-PLAN.md` — added Observability Impact section
- `.gsd/milestones/M002/slices/S02/S02-PLAN.md` — marked T01 as done
