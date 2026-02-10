---
phase: 21-map-visualization
plan: 02
subsystem: api
tags: [typescript, tanstack-query, react, scan-api]

# Dependency graph
requires:
  - phase: 20-area-scanner-api
    provides: Backend scan REST API endpoints and schemas
provides:
  - TypeScript types matching backend scan API schemas
  - TanStack Query hooks for scan operations (trigger, poll, cancel, results)
  - Smart polling hook that stops automatically on terminal states
affects: [21-03-gemeente-scan-trigger, 21-05-scan-progress-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TanStack Query refetchInterval function form for conditional polling
    - Snake_case types matching backend JSON exactly (no camelCase conversion)

key-files:
  created:
    - frontend/src/lib/types/scan.ts
    - frontend/src/hooks/useScans.ts
  modified:
    - frontend/src/lib/api.ts

key-decisions:
  - "Types use snake_case to match backend JSON serialization (no camelCase conversion layer)"
  - "useScanPolling uses function-form refetchInterval that receives query object (TanStack Query v5 signature)"
  - "Polling stops automatically on completed/failed/cancelled status (no manual cleanup needed)"

patterns-established:
  - "Scan API client functions in lib/api.ts follow existing apiFetch pattern"
  - "Scan hooks follow existing TanStack Query patterns from useReports and usePropertyLookup"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 21 Plan 02: Scan API Types and Hooks Summary

**Type-safe scan hooks with smart auto-polling using TanStack Query function-form refetchInterval**

## Performance

- **Duration:** 5 minutes
- **Started:** 2026-02-10T15:43:42Z
- **Completed:** 2026-02-10T15:48:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- TypeScript types matching backend scan schemas exactly (ScanCreateRequest, ScanResponse, ScanStatusResponse, ScanResultItem, ScanResultsResponse, ScanResultsFilters)
- Four scan API functions: triggerScan, fetchScanStatus, cancelScan, fetchScanResults
- Four TanStack Query hooks: useTriggerScan, useScanPolling, useCancelScan, useScanResults
- Smart polling that stops automatically when scan reaches terminal state (completed/failed/cancelled)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scan TypeScript types and API functions** - `1d6d6a4` (feat)
2. **Task 2: Create TanStack Query hooks for scan operations** - `0c8a84b` (feat)

## Files Created/Modified

- `frontend/src/lib/types/scan.ts` - TypeScript types matching backend/app/scans/schemas.py
- `frontend/src/lib/api.ts` - Added triggerScan, fetchScanStatus, cancelScan, fetchScanResults functions
- `frontend/src/hooks/useScans.ts` - TanStack Query hooks for scan operations
- `frontend/src/components/projects/ProjectEditModal.tsx` - Fixed ESLint error (deviation)
- `frontend/src/components/projects/ProjectList.tsx` - Added key prop for modal reset (deviation)

## Decisions Made

1. **Snake_case types:** Match backend JSON exactly without camelCase conversion layer. Simpler, no transformation bugs, clear 1:1 mapping.
2. **Function-form refetchInterval:** Used TanStack Query v5 signature `(query) => number | false` instead of deprecated `(data, query)` signature.
3. **30-second staleTime for results:** Scan results don't change after completion, so cache them to reduce server load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ProjectEditModal ESLint error**
- **Found during:** Task 1 verification (npm run check)
- **Issue:** ProjectEditModal called setState in useEffect, triggering react-hooks/set-state-in-effect error that blocked TypeScript compilation
- **Fix:** Added key={selectedProject?.id} prop to ProjectEditModal in ProjectList.tsx, allowing component remount on project change instead of setState in effect
- **Files modified:** frontend/src/components/projects/ProjectEditModal.tsx, frontend/src/components/projects/ProjectList.tsx
- **Verification:** npm run check passes
- **Committed in:** 1d6d6a4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking issue)
**Impact on plan:** Fix was necessary to unblock TypeScript compilation. Pre-existing code from Phase 13, not related to scan functionality.

## Issues Encountered

None - plan executed smoothly after fixing pre-existing ESLint error.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Scan types and hooks ready for consumption in gemeente click handler (21-03) and progress UI (21-05)
- useTriggerScan returns scan_id for polling
- useScanPolling handles automatic stop on completion
- useCancelScan invalidates cache to trigger status re-fetch
- useScanResults supports filters and pagination for result display

## Self-Check: PASSED

**Files created:**
- ✓ frontend/src/lib/types/scan.ts
- ✓ frontend/src/hooks/useScans.ts

**Commits exist:**
- ✓ 1d6d6a4 (Task 1)
- ✓ 0c8a84b (Task 2)

---
*Phase: 21-map-visualization*
*Completed: 2026-02-10*
