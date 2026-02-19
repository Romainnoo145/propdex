---
phase: 38-scan-history-frontend
plan: "02"
subsystem: ui
tags: [react, tanstack-query, typescript, scan-history, projecten-view]

# Dependency graph
requires:
  - phase: 38-scan-history-frontend
    plan: "01"
    provides: useProjectScans hook with enabled guard and 5-minute stale time, ScanListItem type
affects:
  - Projecten view users now see real scan history from backend API instead of hardcoded demo data

provides:
  - WijkScanList sub-component rendering scan rows with gemeente/wijk name, date, parcel count, status badges
  - "Toon resultaten" and "Toon kaart" action buttons navigating to /resultaten?scan_id and /map?scan_id
  - Lazy loading: useProjectScans fires only when a project row is expanded (component mounts)
  - Demo mode guard: isDemo prevents API calls, shows "Geen scans beschikbaar (demo modus)"
  - Empty state: "Nog geen scans voor dit project" for projects with zero scans
  - Loading skeleton while scan data fetches

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-component pattern for lazy data fetching: WijkScanList encapsulates useProjectScans so hook fires only when rendered"
    - "isDemo guard pattern: {!isDemo && <WijkScanList />} + {isDemo && <fallback>}"
    - "navigate({ to: '/resultaten', search: { scan_id } }) for programmatic navigation with type-safe search params"

key-files:
  created: []
  modified:
    - frontend/src/components/projects/ProjectList.tsx

key-decisions:
  - "WijkScanList sub-component encapsulates useProjectScans so hook only fires when row is expanded -- not on page load"
  - "Single WijkScanList component handles both monitoring wijks and regular projects -- both have project.id"
  - "DEMO_REPORTS and DocumentIcon removed completely -- no more hardcoded report data in Projecten view"

patterns-established:
  - "Lazy hook pattern: place hook inside sub-component that mounts conditionally, not in parent render function"

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 38 Plan 02: Scan History UI Summary

**WijkScanList sub-component replaces DEMO_REPORTS in Projecten view with real scan rows from useProjectScans, showing gemeente/wijk, date, parcel count, status badge, and lazy-loaded "Toon resultaten" / "Toon kaart" navigation buttons**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T15:16:39Z
- **Completed:** 2026-02-19T15:20:39Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created `WijkScanList` sub-component that encapsulates `useProjectScans` for lazy loading (fires only when row is expanded)
- Scan rows display gemeente name (plus wijk name if present), formatted date, parcel count, and status badge for non-completed scans
- "Toon resultaten" and "Toon kaart" action buttons navigate to `/resultaten?scan_id=X` and `/map?scan_id=X`, disabled for non-completed scans
- Removed all DEMO_REPORTS hardcoded data (~25 lines), ReportListItem import, handleReportClick function, and DocumentIcon component
- Both monitoring wijk sections and regular project sections use WijkScanList with real API data
- Demo mode renders "Geen scans beschikbaar (demo modus)" without making API calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WijkScanList sub-component and replace DEMO_REPORTS in monitoring wijk section** - `8570192` (feat)
2. **Task 2: Replace DEMO_REPORTS in regular project section and remove DEMO_REPORTS constant** - `9e0ff46` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified
- `frontend/src/components/projects/ProjectList.tsx` - Added WijkScanList + ScanIcon components, removed DEMO_REPORTS constant and all related dead code, replaced report rendering with scan history in both monitoring wijk and regular project sections

## Decisions Made
- WijkScanList is a sub-component (not inline in the parent) so `useProjectScans` only fires when the row is expanded and the component mounts. This matches the plan specification and existing `useScanPolling` pattern.
- Single `WijkScanList` component serves both monitoring wijks and regular projects -- both provide a `project.id` string, so no specialization needed.
- `DocumentIcon` was removed because it was only used for report rows, which no longer exist.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 38 complete: scan history is now visible and navigable from the Projecten view
- Users can click "Toon resultaten" to go to /resultaten?scan_id=X or "Toon kaart" to go to /map?scan_id=X
- No blockers for v5.0 milestone close (Phase 41 bug fixes remaining)

## Self-Check: PASSED

- FOUND: frontend/src/components/projects/ProjectList.tsx
- FOUND commit 8570192: feat(38-02): add WijkScanList sub-component and replace demo reports in monitoring wijk section
- FOUND commit 9e0ff46: feat(38-02): replace DEMO_REPORTS in regular project section and remove demo data constants
- VERIFIED: grep for DEMO_REPORTS returns 0 matches in ProjectList.tsx
- VERIFIED: WijkScanList appears in monitoring wijk section (line 233), regular project section (line 321), and component definition (line 364)
- VERIFIED: npm run check passes with 0 errors (pre-existing warnings only, not related to this change)

---
*Phase: 38-scan-history-frontend*
*Completed: 2026-02-19*
