---
phase: 38-scan-history-frontend
plan: "01"
subsystem: ui
tags: [react, tanstack-query, typescript, scan-history]

# Dependency graph
requires:
  - phase: 37-scan-history-backend
    provides: GET /api/scans and GET /api/projects/{id}/scans endpoints with ScanListItem/ScanListResponse schemas
provides:
  - ScanListItem and ScanListResponse TypeScript interfaces in frontend/src/lib/types/scan.ts
  - fetchScanHistory (GET /api/scans) and fetchProjectScans (GET /api/projects/{id}/scans) API functions
  - useScanHistory and useProjectScans TanStack Query hooks with enabled guards and 5-minute stale time
  - useTriggerScan cache invalidation for scan-history and project-scans on success
affects:
  - 38-02 (uses useScanHistory and useProjectScans to replace demo data in Projecten view)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query hook with enabled guard: enabled: !!accessToken && !!optionalParam"
    - "Query key arrays: ['scan-history', params] and ['project-scans', projectId, params]"
    - "Cache invalidation on mutation success via queryClient.invalidateQueries"

key-files:
  created: []
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useScans.ts

key-decisions:
  - "5-minute staleTime for scan history hooks -- scans don't change frequently, balances freshness vs requests"
  - "useProjectScans disabled when projectId is null -- only fetches when a wijk row is actually expanded"
  - "useTriggerScan invalidates both scan-history and project-scans -- new scan appears immediately everywhere"

patterns-established:
  - "Scan history query keys use params object as second element for automatic cache busting on pagination"

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 38 Plan 01: Scan History Data Layer Summary

**TanStack Query data layer for scan history: ScanListItem/ScanListResponse types, fetchScanHistory/fetchProjectScans API functions, and useScanHistory/useProjectScans hooks with cache invalidation wired into useTriggerScan**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T15:10:45Z
- **Completed:** 2026-02-19T15:12:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added ScanListItem (8 fields) and ScanListResponse (4 fields) TypeScript interfaces matching backend schemas exactly
- Added fetchScanHistory and fetchProjectScans API functions using existing apiFetch/SCANS_BASE/PROJECTS_BASE constants
- Added useScanHistory and useProjectScans hooks with proper enabled guards and 5-minute stale time
- Wired useTriggerScan onSuccess to invalidate scan-history and project-scans caches so new scans appear immediately

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ScanListItem/ScanListResponse types and API functions** - `d869670` (feat)
2. **Task 2: Add useScanHistory/useProjectScans hooks and wire cache invalidation** - `48f9bff` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - Added ScanListItem and ScanListResponse interfaces at end of file
- `frontend/src/lib/api.ts` - Added ScanListResponse import, fetchScanHistory and fetchProjectScans functions before monitoring section
- `frontend/src/hooks/useScans.ts` - Added imports, modified useTriggerScan with cache invalidation, added useScanHistory and useProjectScans hooks

## Decisions Made
- 5-minute staleTime for scan history hooks -- scans don't change frequently, balances freshness vs network requests
- useProjectScans disabled when projectId is null -- consistent with existing useScanPolling/useScanResults pattern
- useTriggerScan invalidates both scan-history and project-scans -- new scan should appear in all views immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer complete; Plan 38-02 can consume useScanHistory and useProjectScans to replace demo data in Projecten view
- No blockers or concerns

---
*Phase: 38-scan-history-frontend*
*Completed: 2026-02-19*
