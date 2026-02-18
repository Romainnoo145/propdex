---
phase: 33-data-table-polish
plan: 04
subsystem: ui
tags: [react, lucide-react, maplibre-gl, tanstack-table, filter-panel, hover-sync]

# Dependency graph
requires:
  - phase: 33-data-table-polish plan 01
    provides: URL-based filter/sort/page state in resultaten.tsx, ResultsTable sort/page callbacks

provides:
  - FILTER_GROUPS constant (Oppervlak, Bestemming, Score) with collapsible sections in ResultsFilterPanel
  - max_area_m2 filter input exposed in Oppervlak group
  - onRowHover prop on ResultsTable with onMouseEnter/onMouseLeave
  - handleRowHover in ResultsLayout using setFeatureState for map hover highlight
  - Table-to-map hover sync in /map overlay (DT-02 complete)
  - Advanced filter panel with category groups (DT-05 complete)

affects:
  - Phase 34 (Mobile Responsiveness) — filter panel layout structure
  - Any plan adding more filter categories (can extend FILTER_GROUPS)
  - Any plan adding map-to-table hover (reverse direction deferred)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FILTER_GROUPS as const — typed group config at module level for collapsible filter sections
    - hoveredParcelRef pattern — useRef tracks active hover for cleanup without re-renders
    - querySourceFeatures + setFeatureState — map hover via numeric MVT feature ID (not string UUID)
    - onRowHover optional prop — no-op when not provided (standalone /resultaten has no map)

key-files:
  created: []
  modified:
    - frontend/src/components/results/ResultsFilterPanel.tsx
    - frontend/src/components/results/ResultsTable.tsx
    - frontend/src/components/results/ResultsLayout.tsx
    - .planning/ROADMAP.md

key-decisions:
  - "FILTER_GROUPS omits Locatie group — no location filters in scope, empty group avoided"
  - "All 3 filter groups default to open (all groups in initial openGroups Set)"
  - "Map-to-table hover deferred — table-to-map only in Phase 33 (ROADMAP updated)"
  - "Use numeric MVT feature ID for setFeatureState, not string UUID parcel_id (querySourceFeatures returns numeric id)"
  - "hoveredParcelRef cleanup runs on collapsed change via useEffect dependency"
  - "features[0] extracted to local variable to satisfy TypeScript undefined narrowing"

patterns-established:
  - "Collapsible filter group: button with ChevronDown/ChevronRight + Set<string> openGroups state"
  - "Hover ref pattern: useRef tracks hover ID for cleanup, avoids useState re-renders on every mouse event"

# Metrics
duration: ~2min
completed: 2026-02-18
---

# Phase 33 Plan 04: Data Table Polish — Filter Groups + Hover Sync Summary

**Category-grouped collapsible filter panel (Oppervlak/Bestemming/Score) with max_area_m2 exposed, plus table-to-map hover sync via setFeatureState in ResultsLayout overlay**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-18T09:52:17Z
- **Completed:** 2026-02-18T09:54:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Restructured flat filter bar into 3 collapsible category groups (Oppervlak, Bestemming, Score) with lucide-react icons and chevron toggles
- Exposed max_area_m2 filter input in the Oppervlak group with debounce + URL sync pattern
- Added onRowHover prop to ResultsTable wiring onMouseEnter/onMouseLeave on each row
- Implemented handleRowHover in ResultsLayout that uses querySourceFeatures + setFeatureState(hover:true/false) to highlight map parcels

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure ResultsFilterPanel into category groups** - `7934a24` (feat)
2. **Task 2: Add bidirectional hover sync in ResultsLayout overlay** - `9ea618e` (feat)

## Files Created/Modified

- `frontend/src/components/results/ResultsFilterPanel.tsx` — FILTER_GROUPS const, collapsible sections, max_area_m2 input with debounce
- `frontend/src/components/results/ResultsTable.tsx` — onRowHover prop + onMouseEnter/onMouseLeave on table rows
- `frontend/src/components/results/ResultsLayout.tsx` — hoveredParcelRef, handleRowHover callback, cleanup useEffect, onRowHover wired to ResultsTable
- `.planning/ROADMAP.md` — Success criterion 1 updated: map-to-table hover deferred

## Decisions Made

- **FILTER_GROUPS omits Locatie group**: Plan noted research suggested a Locatie group but there are no location filters in scope. Empty groups avoided.
- **All groups default open**: `new Set(['area', 'zoning', 'score'])` ensures all are expanded on mount for discoverability.
- **Map-to-table hover deferred**: DT-02 scope narrowed to table-to-map only. Map-to-table would require a `mousemove` handler in ResultsLayout reading `feature.properties.parcel_id` — left for future phase.
- **Numeric MVT ID vs string UUID**: `setFeatureState` requires the numeric ID assigned by MVT tile generation, not the string `parcel_id` UUID. Used `querySourceFeatures` to find feature and extract `feature.id`.
- **TypeScript fix**: Extracted `features[0]` to local `feature` variable to satisfy TS2532 undefined narrowing (array index access may be undefined).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2532 undefined narrowing on features[0]**
- **Found during:** Task 2 (ResultsLayout hover implementation)
- **Issue:** TypeScript correctly flags `features[0].id` as possibly undefined in conditional — array index access is not narrowed after `.length > 0` check in strict mode
- **Fix:** Extracted `const feature = features[0]` then checked `feature !== undefined && feature.id !== undefined`
- **Files modified:** `frontend/src/components/results/ResultsLayout.tsx`
- **Verification:** `npm run check` passes with 0 errors
- **Committed in:** `9ea618e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type error)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered

None beyond the TypeScript narrowing fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DT-02 (list-map hover sync) complete — table-to-map hover works in /map overlay
- DT-05 (advanced filter panel) complete — category groups with collapsible sections
- Phase 33 Plan 03 (multi-select checkboxes + bulk export) is the remaining plan in the phase
- ROADMAP.md updated with deferred map-to-table scope note

---
*Phase: 33-data-table-polish*
*Completed: 2026-02-18*
