---
id: T01
parent: S02
milestone: M002
provides:
  - useMapPanels hook with ActivePanel type and panel navigation handlers
  - Clean contract boundary for S02-T02 to build on
key_files:
  - frontend/src/hooks/useMapPanels.ts
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - Kept all parcel-opening setActivePanel calls inline in map.tsx (too many local dependencies to extract cleanly)
  - Hook accepts refs and callbacks as params rather than importing map state directly
patterns_established:
  - Panel orchestration via useMapPanels hook — all panel state and navigation handlers in one place
observability_surfaces:
  - React DevTools: useMapPanels hook state shows activePanel kind transitions
  - No runtime logging added — panel state is purely in-memory React state
duration: 45m
verification_result: passed
completed_at: 2026-03-18
blocker_discovered: false
---

# T01: Extract useMapPanels hook from map.tsx

**Extracted ActivePanel type, panel state, and 4 navigation handlers into `useMapPanels` hook; map.tsx imports and uses the hook with no behavioral changes.**

## What Happened

Created `frontend/src/hooks/useMapPanels.ts` (152 lines) containing:
- `ActivePanel` union type (gemeente | wijk | parcel)
- `activePanel` state + `setActivePanel` setter
- `inspectorParcel` derived state
- `handleGemeentePanelSelectWijk` — finds wijk feature, highlights geometry, transitions to wijk panel
- `handleWijkPanelBack` — transitions back to gemeente panel, zooms to gemeente bounds
- `handleCloseGemeentePanel` — clears gemeente selection, removes wijk layer, flies to NL overview
- `handleCloseParcelPanel` — clears panel and geometry highlight

Updated map.tsx to import `useMapPanels` and `ActivePanel` from the hook. Removed the inline state, derived value, and useCallback definitions. All ~20 `setActivePanel` calls for parcel-opening remain inline as planned (they depend on local click handler variables). map.tsx reduced by ~30 lines (less than the estimated 80-100 because the parcel-setting calls and their surrounding logic stayed inline as scoped in the plan).

## Verification

- `cd frontend && npx tsc --noEmit` — passes clean, no errors
- Slice-level checks:
  - ✅ TypeScript compiles
  - ⬜ Manual: gemeente panel (T02 — panel component not yet created)
  - ⬜ Manual: parcel panel mutual exclusion (T02)
  - ⬜ Manual: wijk selection (T02)
  - ⬜ Manual: Escape closes panel (T02)

## Diagnostics

- Inspect `activePanel` state via React DevTools on the map route — the useMapPanels hook exposes the current panel kind
- If panel transitions fail, check that the hook's dependencies (activeGemeenteRef, wijkGeojson, mapRef) are populated

## Deviations

- map.tsx reduced by ~30 lines instead of estimated 80-100. The parcel-opening setActivePanel calls stayed inline as planned, but they account for more of the total than estimated. The extraction is correct per scope.

## Known Issues

None.

## Files Created/Modified

- `frontend/src/hooks/useMapPanels.ts` — new hook with ActivePanel type, panel state, and navigation handlers
- `frontend/src/routes/_authenticated/map.tsx` — imports useMapPanels, removed inline state and handler definitions
