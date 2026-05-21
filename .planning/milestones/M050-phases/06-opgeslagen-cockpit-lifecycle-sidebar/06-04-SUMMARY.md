---
phase: 06-opgeslagen-cockpit-lifecycle-sidebar
plan: 04
subsystem: ui
tags: [react, tanstack-router, framer-motion, tailwind, lifecycle]

# Dependency graph
requires:
  - phase: 06-opgeslagen-cockpit-lifecycle-sidebar
    plan: 01
    provides: LIFECYCLE_PHASES registry + LifecyclePhaseKey type + getLifecyclePhase()
  - phase: 06-opgeslagen-cockpit-lifecycle-sidebar
    plan: 02
    provides: LifecycleSideRailNav mounted in _authenticated.tsx with isOpgeslagenRoute guard
  - phase: 06-opgeslagen-cockpit-lifecycle-sidebar
    plan: 03
    provides: SavedParcelCard navigates to /opgeslagen/perceel/$parcelId (as never cast)
provides:
  - "opgeslagen.perceel.$parcelId.tsx: Onderzoek phase route rendering FavoriteParcelWorkspaceView + M050 slot placeholders"
  - "opgeslagen.perceel.$parcelId.$phase.tsx: phases 2-6 empty-state placeholders; beforeLoad redirect for 1-onderzoek slug"
  - "_authenticated.tsx: activeLifecyclePhase derived from URL params (matchRoute), replacing hardcoded '1-onderzoek'"
  - "routeTree.gen.ts: both new routes registered with correct parent-child hierarchy"
affects:
  - S04 (brief-feature slot is visible placeholder in Onderzoek view)
  - S01-S02 (BRK Eigendom persistent slot is visible placeholder in Onderzoek view)
  - 06-05 (Plan 05 audit gate verifies these routes are reachable and sidebar active-state is correct)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "beforeLoad + throw redirect() for canonical redirect: moves redirect out of component body (no StrictMode warnings)"
    - "routeTree.gen.ts manual update: import → update() → _addFileChildren() → interface augmentation for new routes before vite dev server runs"
    - "matchRoute with cast to { phase?: string } | false: extracts dynamic param from current URL without full useMatch hook"

key-files:
  created:
    - frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.tsx
    - frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx
  modified:
    - frontend/src/routes/_authenticated.tsx
    - frontend/src/routeTree.gen.ts

key-decisions:
  - "FavoriteParcelWorkspaceView actual props are { favorite, onBack, onOpenMap } not { parcel, onClose } as plan spec stated — adapted call site without touching the component"
  - "routeTree.gen.ts updated manually (pattern from 06-03 STATE.md precedent) since vite codegen only runs during dev/build; both new routes registered with correct hierarchy"
  - "handleOpenMap() navigates to /map — provides sensible implementation for onOpenMap prop without modifying FavoriteParcelWorkspaceView"
  - "ResultsShell fullWidth prop used on Onderzoek page so FavoriteParcelWorkspaceView occupies the full card width (matches its internal layout assumptions)"

patterns-established:
  - "Slot placeholder pattern: static Pure Glass div with 'Komt later (M050/Sxx)' label — communicates scope boundary in UI without functional implementation"
  - "Phase route leaf: createFileRoute with beforeLoad redirect for the 1-onderzoek case + unknown-phase render fallback"

requirements-completed:
  - UX-03
  - UX-04

# Metrics
duration: 7min
completed: 2026-05-17
---

# Phase 06 Plan 04: Nested Perceel Route + Phase Sidebar Wiring Summary

**Two TanStack Router nested routes mount FavoriteParcelWorkspaceView as '1. Onderzoek' phase and render empty-state placeholders for phases 2-6, with LifecycleSideRailNav active pill now derived from URL params instead of hardcoded**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-17T21:20:37Z
- **Completed:** 2026-05-17T21:27:00Z
- **Tasks:** 3 tasks
- **Files modified:** 4 files (2 created, 2 modified)

## Accomplishments

- Created `/opgeslagen/perceel/$parcelId` route rendering existing `FavoriteParcelWorkspaceView` verbatim (no modifications to the 1922-line component), plus two M050 slot placeholder cards (Brief/BRK Eigendom) with Pure Glass styling
- Created `/opgeslagen/perceel/$parcelId/$phase` route with `beforeLoad` redirect for `1-onderzoek` slug → canonical `$parcelId` route; phases 2-6 show empty-state with phase icon + "Komt later M053+" copy; unknown phase slug renders fallback message
- Updated `_authenticated.tsx` to derive `activeLifecyclePhase` from URL via `matchRoute` — sidebar active pill now reflects actual URL state (defaulting to `1-onderzoek` on list view or parcelId-only route)
- Manually updated `routeTree.gen.ts` to register both routes with correct parent-child hierarchy before vite dev server could run codegen

## Task Commits

1. **Task 1+2: Create route files + routeTree** - `cbdde3d0` (feat)
2. **Task 3: Derive activePhaseKey from URL** - `b741dee2` (feat)

## Files Created/Modified

- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.tsx` (new, 75 lines) — Onderzoek phase route: favorites lookup, loading/not-found states, FavoriteParcelWorkspaceView mount, M050 slot placeholders
- `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` (new, 86 lines) — Phase 2-6 empty-state route: beforeLoad redirect for 1-onderzoek, unknown-phase fallback, phase icon + label + Komt-later card
- `frontend/src/routes/_authenticated.tsx` (updated, 170 lines) — Added LIFECYCLE_PHASES import, matchRoute phase detection, dynamic activeLifecyclePhase prop
- `frontend/src/routeTree.gen.ts` (updated) — Both new routes registered with correct parent-child hierarchy and all interface augmentations

## Decisions Made

- `FavoriteParcelWorkspaceView` props are `{ favorite, onBack, onOpenMap }` not `{ parcel, onClose }` as the plan spec indicated — adapted call site without touching the component (Rule 1 auto-fix)
- Added `handleOpenMap` navigating to `/map` as the `onOpenMap` implementation — sensible default without modifying FavoriteParcelWorkspaceView
- Used `fullWidth` prop on `ResultsShell` in the Onderzoek route so FavoriteParcelWorkspaceView occupies full card width matching its internal layout assumptions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FavoriteParcelWorkspaceView has different prop signature than plan spec**
- **Found during:** Task 1 (creating opgeslagen.perceel.$parcelId.tsx)
- **Issue:** Plan spec said `{ parcel: FavoriteResponse; onClose?: () => void }` but the actual component exports `{ favorite: FavoriteResponse; onBack: () => void; onOpenMap: () => void }`. Using plan spec props caused TS2322 errors.
- **Fix:** Updated call site to use actual props: `favorite={parcel} onBack={handleClose} onOpenMap={handleOpenMap}`. Added `handleOpenMap` navigating to `/map`.
- **Files modified:** `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.tsx`
- **Verification:** `npm run check` — zero errors on new file after fix
- **Committed in:** `cbdde3d0` (Task 1+2 commit)

**2. [Rule 3 - Blocking] routeTree.gen.ts not automatically updated**
- **Found during:** Task 1 (after creating route file)
- **Issue:** The vite TanStack Router plugin regenerates `routeTree.gen.ts` only during dev server / build. Running the generator CLI standalone produced a different output path. Without registration, `createFileRoute('/_authenticated/opgeslagen/perceel/$parcelId')` caused TS2345 errors (route not in `FileRoutesByPath`).
- **Fix:** Manually updated `routeTree.gen.ts` with imports, `update()` declarations, children hierarchy, and all four interface augmentations (`FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`, `FileRoutesByPath` module augmentation, union type strings).
- **Files modified:** `frontend/src/routeTree.gen.ts`
- **Verification:** `npm run check` — error count dropped from 94 to 91 (back to pre-existing baseline) after routeTree registration
- **Committed in:** `cbdde3d0` (Task 1+2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 prop mismatch, 1 Rule 3 blocking TS errors)
**Impact on plan:** Both fixes required for compilation and correctness. No scope creep. Plan intent fully satisfied.

## Issues Encountered

- Pre-existing 91 TS errors in the codebase (unchanged baseline from 06-01 through 06-03). Neither new route file introduced any new errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/opgeslagen/perceel/$parcelId` route registered and functional — `SavedParcelCard`'s `as never` cast in Plan 03 resolves cleanly now that the route is registered
- LifecycleSideRailNav active pill reflects URL state — Plan 05 audit gate can now verify sidebar active-state correctness across all routes
- M050 slot placeholders visible in Onderzoek view — S04 (brief) and S01-S02 (BRK persistent) have clear landing zones

---
*Phase: 06-opgeslagen-cockpit-lifecycle-sidebar*
*Completed: 2026-05-17*
