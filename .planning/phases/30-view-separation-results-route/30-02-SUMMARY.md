---
phase: 30-view-separation-results-route
plan: 02
subsystem: ui
tags: [tanstack-router, react, map, resultaten, navigation, view-separation]

# Dependency graph
requires:
  - phase: 30-01
    provides: Standalone /resultaten route with scan_id search param
  - phase: 28-persistent-mapview
    provides: MapLibre instance kept alive via display:none — persists scan score layer across navigation
provides:
  - scan_id in MapSearchParams — /map accepts scan_id to restore activeScanId on return from /resultaten
  - Navigate to /resultaten?scan_id=... on scan completion (4 trigger paths)
  - urlScanId restoration effect in map.tsx
  - Toon Lijst ghost button in activeGemeente header
  - Toon Kaart button in resultaten.tsx passes scan_id back to /map
affects:
  - End user flow: scan -> /resultaten -> Toon Kaart -> /map with score layer visible

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route navigation pattern: setShowResults(true) replaced by navigate({ to: '/resultaten', search: { scan_id } }) — no overlay state"
    - "URL-driven context restoration: urlScanId effect restores activeScanId when returning to /map from /resultaten"
    - "Ghost button variant: border + text color for secondary navigation action vs solid fill for primary action"

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/routes/_authenticated/resultaten.tsx

key-decisions:
  - "Removed panel=results auto-open effect (legacy Phase 28) — no longer needed with standalone /resultaten route"
  - "removeParcelScoreLayer import removed — was only used in ResultsLayout onClose handler; score layer now persists until user explicitly cancels via activeScanId=null"
  - "Toon Lijst uses ghost button style (border + amber text) to visually differentiate from primary scan button (solid amber fill)"

patterns-established:
  - "View separation complete: /map shows scan progress, /resultaten shows results — no overlay split-panel"
  - "scan_id URL param is the bidirectional bridge between /map and /resultaten"

# Metrics
duration: ~3min
completed: 2026-02-17
---

# Phase 30 Plan 02: Map Navigation Wiring Summary

**Route navigation replacing overlay: scan completion navigates to /resultaten?scan_id=..., returning from /resultaten with ?scan_id=... restores activeScanId in map.tsx**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-17T22:17:36Z
- **Completed:** 2026-02-17T22:20:09Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Replaced all 4 `setShowResults(true)` calls with `navigate({ to: '/resultaten', search: { scan_id } })` — scan completion, wijk click, viewport scan, bestemmingsplan scan
- Added `scan_id?: string` to `MapSearchParams` interface and `validateSearch` in map.tsx
- Added `urlScanId` restoration `useEffect` — restores `activeScanId` from URL when returning from `/resultaten`, then clears URL param
- Removed `ResultsLayout` import and overlay JSX from map route — no more split-panel
- Removed `showResults` state variable entirely
- Removed `panel === 'results'` auto-open effect (legacy Phase 28 pattern)
- Removed unused `removeParcelScoreLayer` import
- Added "Toon Lijst" ghost button in activeGemeente context header (visible when `activeScanId` non-null)
- Updated `resultaten.tsx` Toon Kaart button to pass `scan_id` back to `/map`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scan_id search param to map.tsx and replace overlay with navigation** - `69ca5ac` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `frontend/src/routes/_authenticated/map.tsx` — scan_id in MapSearchParams, urlScanId restoration effect, 4x navigate to /resultaten, Toon Lijst button, ResultsLayout removed, showResults removed, panel effect removed
- `frontend/src/routes/_authenticated/resultaten.tsx` — Toon Kaart button now passes scan_id back to /map

## Decisions Made

- Removed `panel === 'results'` auto-open effect — legacy Phase 28 pattern, no longer needed since /resultaten is its own route
- `removeParcelScoreLayer` import removed because the only call site was inside the removed `ResultsLayout onClose` handler; score layer now persists for the lifetime of `activeScanId`
- Ghost button style for "Toon Lijst" (border + amber text) creates visual hierarchy against primary solid "Scan zichtbaar gebied" button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Updated Toon Kaart button to pass scan_id back**
- **Found during:** Task 1 (completing the bidirectional navigation)
- **Issue:** Plan 01 left `navigate({ to: '/map' })` without `scan_id` because MapSearchParams didn't include it yet. Now that Plan 02 adds `scan_id` to MapSearchParams, the Toon Kaart button in `resultaten.tsx` needs to pass it back for the restoration effect to work.
- **Fix:** Changed `navigate({ to: '/map' })` to `navigate({ to: '/map', search: scan_id ? { scan_id } : {} })`
- **Files modified:** `frontend/src/routes/_authenticated/resultaten.tsx`
- **Commit:** `69ca5ac`

**2. [Rule 1 - Bug] Removed unused removeParcelScoreLayer import**
- **Found during:** Task 1 (after removing ResultsLayout onClose handler)
- **Issue:** `removeParcelScoreLayer` was imported but no longer used after the onClose handler was removed
- **Fix:** Removed from import statement
- **Files modified:** `frontend/src/routes/_authenticated/map.tsx`
- **Commit:** `69ca5ac`

---

**Total deviations:** 2 auto-fixed (1 missing functionality — Toon Kaart scan_id passthrough; 1 bug — unused import)
**Impact on plan:** Both fixes were necessary to complete the bidirectional navigation correctly. The Toon Kaart fix was explicitly anticipated in the Plan 01 SUMMARY (deferred to Plan 02). The import cleanup is cosmetic correctness.

## Issues Encountered

None.

## Self-Check: PASSED

- `frontend/src/routes/_authenticated/map.tsx` — FOUND, contains `scan_id` in MapSearchParams, 0 occurrences of `showResults`, 0 occurrences of `ResultsLayout`, `Toon Lijst` button present, 5 navigate-to-resultaten calls
- `frontend/src/routes/_authenticated/resultaten.tsx` — FOUND, Toon Kaart button passes scan_id
- Commit `69ca5ac` — FOUND

## Next Phase Readiness

- View separation complete: /map shows scan initiation + score layer, /resultaten shows tabular results
- Bidirectional navigation wired with scan_id preserved in URL
- Score layer persists on /map when returning from /resultaten (MapLibre instance never unmounts)

---
*Phase: 30-view-separation-results-route*
*Completed: 2026-02-17*
