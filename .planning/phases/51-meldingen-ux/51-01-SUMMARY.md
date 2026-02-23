---
phase: 51-meldingen-ux
plan: 01
subsystem: frontend/monitoring
tags: [ux, notifications, refactor, hooks, filtering]
dependency_graph:
  requires:
    - Phase 49: server-backed read tracking (useMarkChangeRead, read_change_ids)
    - Phase 50: matched_parcel_id in ChangeRecord
  provides:
    - useReadTracking hook (shared read/unread + report generation)
    - gemeente_naam filter on GET /changes
    - gemeente filter dropdown in meldingen feed
  affects:
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - backend/app/monitoring/router.py
tech_stack:
  added: []
  patterns:
    - useMemo-for-Set from server data (prevents stale closure deps)
    - shared hook encapsulating cross-cutting read tracking concern
    - client-side filtering with useMemo (selectedGemeente state)
key_files:
  created:
    - frontend/src/hooks/useReadTracking.ts
    - frontend/src/lib/utils/address.ts
    - frontend/src/lib/utils/date.ts
  modified:
    - backend/app/monitoring/router.py
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
decisions:
  - useReadTracking accepts readChangeIds only (not accessToken) — hook calls useAuth() internally, consistent with other hooks
  - handleToggle signature includes expandedId + setExpandedId params — callers own expand state, hook does not
  - Client-side filtering for gemeente (not server-side) — full dataset fetched once, filtered via useMemo; server-side only needed when pagination added
  - changes wrapped in useMemo (not just ?? []) — prevents eslint react-hooks/exhaustive-deps warning about logical expression deps
  - date + address utils in lib/utils/ subdirectory (not added to lib/utils.ts) — separation of domain concerns
metrics:
  duration_minutes: 4
  completed_date: 2026-02-23
  tasks_completed: 2
  files_changed: 8
---

# Phase 51 Plan 01: Gemeente Filter and useReadTracking Hook Summary

Client-side gemeente filter dropdown + useReadTracking shared hook extracted from meldingen.tsx and ChangeTimeline.tsx, eliminating duplicated read state logic across both consumers.

## What Was Built

**useReadTracking hook** (`frontend/src/hooks/useReadTracking.ts`):
- Exports `readIds` (useMemo Set), `handleToggle` (expand + mark-read), `handleGenerateReport` (API call + navigate + toast), `generatingId` (loading state)
- Calls `useMarkChangeRead()`, `useNavigate()`, and `useAuth()` internally — callers don't need to import these separately
- Single source of truth for read/unread state management across the meldingen feed

**Backend gemeente_naam filter** (`backend/app/monitoring/router.py`):
- Added `gemeente_naam: str | None = Query(None)` to `get_changes`
- Filters both `changes_query` and `count_query` when provided
- `fetchAllChanges` in `api.ts` and `useAllChanges` in `useNotifications.ts` updated with `gemeenteNaam?` param and updated query key `['changes', 'all', includeMatches, gemeenteNaam]`

**Gemeente filter dropdown** (`frontend/src/routes/_authenticated/meldingen.tsx`):
- `selectedGemeente` state drives client-side `filteredChanges` via useMemo
- Dropdown renders only when `gemeenteNames.length > 1`
- Default option: "Alle gemeentes"
- `totalUnread` badge reflects filtered view

**Shared utils** (`frontend/src/lib/utils/address.ts`, `date.ts`):
- `extractHuisnummer`, `formatPostcode` extracted from both files
- `formatDate`, `formatRelativeTime` extracted from both files
- Both consumers now import from shared location

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing validation] Wrap `changes` in useMemo**
- **Found during:** Task 2 — eslint react-hooks/exhaustive-deps warning
- **Issue:** `const changes = data?.changes ?? []` as logical expression caused "changes could make useMemo deps change on every render"
- **Fix:** Wrapped in `useMemo(() => data?.changes ?? [], [data?.changes])`
- **Files modified:** `frontend/src/routes/_authenticated/meldingen.tsx`

## Self-Check: PASSED

All created files exist on disk. Both task commits (3c57aec, 6593d3f) present in git log.
TypeScript compiles with 0 errors. Backend router passes ruff check and py_compile.
useReadTracking imported in both meldingen.tsx and ChangeTimeline.tsx.
No duplicate `new Set(data?.read_change_ids` found in consumer files.
