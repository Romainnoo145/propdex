---
phase: 33-data-table-polish
plan: 02
subsystem: ui
tags: [react, tanstack-router, scan-flow, useCallback, useRef]

# Dependency graph
requires:
  - phase: 32-03
    provides: ScanProgressOverlay three-step stepper with Industrial Amber tokens

provides:
  - ScanProgressOverlay CTA button on completed state (SCAN-01)
  - Step-specific phase label prominently shown during running state (SCAN-02)
  - Sluiten dismiss link for failed scan state
  - navigatedRef guard preventing double-navigation race condition
  - handleViewResults shared handler used by both CTA and useEffect

affects: [map.tsx scan flow, resultaten navigation, scan completion UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - navigatedRef guard pattern for preventing double-navigation from concurrent triggers
    - Shared callback pattern: CTA button and useEffect both call handleViewResults with ref guard

key-files:
  created: []
  modified:
    - frontend/src/components/map/ScanProgressOverlay.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "navigatedRef.current = false reset in useEffect when activeScanId changes ensures fresh guard per scan"
  - "Overlay condition changed from status !== 'completed' to status !== 'cancelled' — shows CTA while user decides"
  - "Scan completion useEffect deps simplified to [scanStatus.data?.status] — prevents stale closure without rerunning on every render"
  - "Pre-existing TS2532 fixed: SCAN_STEPS[index - 1] possibly undefined via safe prevStep variable"

patterns-established:
  - "navigatedRef guard: use useRef(false) + reset on ID change to prevent duplicate async navigation"
  - "Shared handler pattern: extract navigate call to useCallback, pass to both JSX handler and useEffect"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 33 Plan 02: CTA Button + Scan State Labels Summary

**ScanProgressOverlay gains "Bekijk resultaten" CTA button on completion with navigatedRef double-navigation guard and step-specific running state labels**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-18T04:03:10Z
- **Completed:** 2026-02-18T04:06:06Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `onViewResults` optional prop to `ScanProgressOverlay` — CTA button renders in completed state (SCAN-01)
- Refactored running state phase label to show step-specific text from SCAN_STEPS array instead of generic "Verwerken..." (SCAN-02)
- Added "Sluiten" dismiss link for failed scan state
- Introduced `navigatedRef` in `map.tsx` to prevent double-navigation when both CTA button and `useEffect` could fire
- Extracted `handleViewResults` as shared `useCallback` used by both the overlay CTA and the completion `useEffect`
- Updated overlay render condition to show for `status !== 'cancelled'` (including completed state) so user sees CTA before auto-nav fires

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CTA button and refine scan state labels** - `bfcef17` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/map/ScanProgressOverlay.tsx` - Added `onViewResults` prop, CTA button in completed state, step-specific phase label, Sluiten dismiss link; fixed pre-existing TS2532
- `frontend/src/routes/_authenticated/map.tsx` - Added `navigatedRef`, `handleViewResults` callback, reset effect, updated completion useEffect, updated overlay render condition and `onViewResults` prop

## Decisions Made

- `navigatedRef.current = false` reset is tied to `[activeScanId]` dependency — when a new scan starts the guard resets, allowing navigation on completion
- Overlay condition changed from `status !== 'completed'` to `status !== 'cancelled'` so the overlay remains visible on completion, giving the user a moment to click the CTA before auto-nav fires
- Scan completion `useEffect` deps simplified to `[scanStatus.data?.status]` — prevents stale closures on status transitions without unnecessary re-runs
- Pre-existing TS2532 (`SCAN_STEPS[index - 1]` possibly undefined) auto-fixed alongside the task changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS2532: SCAN_STEPS[index - 1] possibly undefined**
- **Found during:** Task 1 (Add CTA button and refine scan state labels)
- **Issue:** `SCAN_STEPS[index - 1]` accessed without undefined check, causing TypeScript TS2532 error that was present before this plan
- **Fix:** Extracted to `const prevStep = index > 0 ? SCAN_STEPS[index - 1] : undefined` with conditional `getStepState` call
- **Files modified:** `frontend/src/components/map/ScanProgressOverlay.tsx`
- **Verification:** `npm run check` passes with 0 errors
- **Committed in:** `bfcef17` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug fix)
**Impact on plan:** Fix was necessary to achieve clean `npm run check`. No scope creep.

## Issues Encountered

- git stash pop conflict on `tsconfig.app.tsbuildinfo` when checking pre-existing errors — resolved by discarding the build artifact before restoring stash

## Next Phase Readiness

- SCAN-01 (minimal-click scan-to-results) and SCAN-02 (clear scan state indication) both complete
- ScanProgressOverlay is now fully polished for the data-table-polish phase
- Phase 33-03 can build on the completed overlay without further changes needed

## Self-Check: PASSED

- FOUND: `frontend/src/components/map/ScanProgressOverlay.tsx`
- FOUND: `frontend/src/routes/_authenticated/map.tsx`
- FOUND: `.planning/phases/33-data-table-polish/33-02-SUMMARY.md`
- FOUND: commit `bfcef17`

---
*Phase: 33-data-table-polish*
*Completed: 2026-02-18*
