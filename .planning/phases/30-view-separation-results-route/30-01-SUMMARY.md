---
phase: 30-view-separation-results-route
plan: 01
subsystem: ui
tags: [tanstack-router, react, resultaten, sidenav, route]

# Dependency graph
requires:
  - phase: 29-route-shell-migration
    provides: ResultsShell layout component used as page wrapper
  - phase: 28-persistent-mapview
    provides: SideRailNav nav component updated in this plan
provides:
  - Standalone /resultaten route with scan_id search param
  - ResultsShell fullWidth prop for bypassing max-w-5xl container
  - SideRailNav Resultaten item points to /resultaten (not /map)
affects:
  - 30-02 (will add scan_id passthrough from map to /resultaten)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fullWidth prop pattern: ResultsShell accepts fullWidth boolean to bypass inner container"
    - "Route file-based routing: TanStack Router routeTree.gen.ts manually updated when tsr generate unavailable"

key-files:
  created:
    - frontend/src/routes/_authenticated/resultaten.tsx
  modified:
    - frontend/src/components/layout/ResultsShell.tsx
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/routeTree.gen.ts

key-decisions:
  - "Navigate to /map without scan_id for Task 1 Toon Kaart button — Plan 02 will wire scan_id passthrough"
  - "routeTree.gen.ts updated manually (tsr generate requires a config file that isn't present)"

patterns-established:
  - "Resultaten route: /resultaten?scan_id=xxx for shareable scan-result URLs"
  - "Empty state pattern: route shows graceful message when required search param absent"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 30 Plan 01: View Separation Results Route Summary

**Standalone /resultaten route with scan_id search param, full-width ResultsTable layout, and SideRailNav pointing to /resultaten instead of /map**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T07:52:22Z
- **Completed:** 2026-02-18T07:55:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created standalone `/resultaten` route reusing ResultsTable, ResultsFilterPanel, and ParcelDetailModal
- Added `fullWidth` prop to ResultsShell that bypasses `max-w-5xl` container — backward compatible
- Updated SideRailNav Resultaten nav item to point to `/resultaten` (was `/map?panel=results`)
- Fixed isActive highlight bug: Kaart highlights on `/map`, Resultaten highlights on `/resultaten`
- Empty state message shown when `scan_id` absent; full results layout shown when present

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fullWidth prop to ResultsShell and create /resultaten route** - `acc8b23` (feat)
2. **Task 2: Update SideRailNav Resultaten item to point to /resultaten** - `e4528f8` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `frontend/src/routes/_authenticated/resultaten.tsx` - New standalone results page with scan_id param, filter panel, table, modal, Toon Kaart button
- `frontend/src/components/layout/ResultsShell.tsx` - Added `fullWidth?: boolean` prop to bypass inner container
- `frontend/src/components/layout/SideRailNav.tsx` - Changed Resultaten `to: '/resultaten'`, removed `search: { panel: 'results' }`
- `frontend/src/routeTree.gen.ts` - Registered `/_authenticated/resultaten` route in all type maps and route children

## Decisions Made

- Navigate to `/map` without `scan_id` for the Toon Kaart button — Plan 02 will add `scan_id` to MapSearchParams and wire the passthrough
- Manually updated `routeTree.gen.ts` because `npx tsr generate` requires a config file not present in this project

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in Toon Kaart navigate call**
- **Found during:** Task 1 (resultaten.tsx creation)
- **Issue:** `navigate({ to: '/map', search: { scan_id } })` failed type-check because `/map`'s MapSearchParams doesn't include `scan_id` — that's Plan 02's job
- **Fix:** Changed to `navigate({ to: '/map' })` — Plan 02 will add `scan_id` to MapSearchParams and update the call
- **Files modified:** `frontend/src/routes/_authenticated/resultaten.tsx`
- **Verification:** `npm run check` passes with 0 errors
- **Committed in:** `acc8b23` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type error on future search param)
**Impact on plan:** Minimal — Toon Kaart button navigates to /map without scan_id for now; Plan 02 wires the scan_id passthrough as planned.

## Issues Encountered

- `npx tsr generate` failed (no config file found) — manually updated `routeTree.gen.ts` following the existing pattern for all route registrations

## Self-Check: PASSED

- `frontend/src/routes/_authenticated/resultaten.tsx` — FOUND
- `frontend/src/components/layout/ResultsShell.tsx` — FOUND (contains `fullWidth`)
- `frontend/src/components/layout/SideRailNav.tsx` — FOUND (contains `to: '/resultaten'`)
- `frontend/src/routeTree.gen.ts` — FOUND (contains `/resultaten` route entries)
- Commit `acc8b23` — FOUND
- Commit `e4528f8` — FOUND

## Next Phase Readiness

- `/resultaten` route accessible via sidebar, renders empty state or full results based on scan_id
- Plan 02 can now add `scan_id` to MapSearchParams and wire Toon Lijst/Toon Kaart navigation

---
*Phase: 30-view-separation-results-route*
*Completed: 2026-02-18*
