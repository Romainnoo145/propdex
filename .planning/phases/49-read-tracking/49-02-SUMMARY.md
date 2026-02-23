---
phase: 49-read-tracking
plan: 02
subsystem: frontend
tags: [read-tracking, tanstack-query, optimistic-updates, mutations, meldingen, notifications]

# Dependency graph
requires:
  - phase: 49-01
    provides: read_change_ids on ChangeRecordListResponse, POST /changes/{id}/read, DELETE /changes/{id}/read, POST /changes/read-all

provides:
  - markChangeRead / markChangeUnread / markAllChangesRead API client functions in api.ts
  - MarkAllReadResponse type in monitoring.ts
  - read_change_ids on ChangeRecordListResponse type (frontend side)
  - useMarkChangeRead mutation hook with optimistic cache update + rollback
  - useMarkAllRead mutation hook with full cache invalidation
  - Server-backed read state in meldingen.tsx (localStorage removed)
  - Server-backed read state in ChangeTimeline.tsx (localStorage removed)
  - Markeer alles als gelezen button in meldingen.tsx header

affects:
  - SideRailNav bell badge (updates via unread count invalidation on markRead)
  - GemeenteCard badge (same via unread count query)
  - WijkCard badge (same via unread count query)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic TanStack Query cache update with snapshot rollback (useMarkChangeRead)
    - useMemo for Set derived from server response (prevents useCallback dep change on every render)
    - Full cache invalidation for bulk mutation (useMarkAllRead)
    - ChangesSnapshot type alias for clean queryKey/data pair in onMutate context

key-files:
  created: []
  modified:
    - frontend/src/lib/types/monitoring.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx

key-decisions:
  - "useMemo for readIds Set derivation prevents useCallback deps changing on every render"
  - "ChangesSnapshot type alias avoids complex inline tuple types in mutation context"
  - "useMarkAllRead takes no arguments at call site -- projectId is closed over from hook param (no meldingen.tsx project filter needed)"
  - "Optimistic update uses setQueryData per-cache-key loop rather than single cache -- handles both all-changes and project-changes caches simultaneously"

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 49 Plan 02: Read Tracking Frontend Summary

**Server-backed per-change read tracking replacing localStorage: useMarkChangeRead with optimistic updates, useMarkAllRead for bulk clear, and Markeer alles als gelezen button in meldingen.tsx**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T03:18:32Z
- **Completed:** 2026-02-23T03:23:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `read_change_ids?: string[]` and `MarkAllReadResponse` to monitoring types
- Added `markChangeRead`, `markChangeUnread`, `markAllChangesRead` API client functions to api.ts
- Added `useMarkChangeRead` mutation: optimistic update that adds changeId to all `['changes', *]` query caches, rolls back on error, invalidates unread counts on success
- Added `useMarkAllRead` mutation: invalidates both unread counts and all changes caches on success
- Removed all localStorage read tracking code from `meldingen.tsx` (READ_STORAGE_KEY, getReadIds, persistReadIds, setReadIds state)
- Replaced with `useMemo(() => new Set(data?.read_change_ids ?? []))` for stable readIds Set
- Added "Markeer alles als gelezen" button in meldingen.tsx header (visible when totalUnread > 0, calls markAllRead.mutate())
- Removed all localStorage read tracking code from `ChangeTimeline.tsx` — now uses `useMarkChangeRead` and `data?.read_change_ids`
- TypeScript check: 0 errors, all warnings pre-existing

## Task Commits

Each task was committed atomically:

1. **Task 1: API client + mutation hooks** - `f697d8c` (feat)
2. **Task 2: Replace localStorage with server state in meldingen.tsx and ChangeTimeline.tsx** - `beda2ac` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/lib/types/monitoring.ts` - Added `read_change_ids?: string[]` to ChangeRecordListResponse, new MarkAllReadResponse type
- `frontend/src/lib/api.ts` - markChangeRead / markChangeUnread / markAllChangesRead functions + MarkAllReadResponse import
- `frontend/src/hooks/useNotifications.ts` - useMarkChangeRead (optimistic, rollback), useMarkAllRead (bulk invalidation), ChangesSnapshot type alias
- `frontend/src/routes/_authenticated/meldingen.tsx` - localStorage removed, server-backed readIds via useMemo, Markeer alles als gelezen button
- `frontend/src/components/notifications/ChangeTimeline.tsx` - localStorage removed, server-backed readIds, useMarkChangeRead on expand

## Decisions Made

- `useMemo` for `readIds` Set derivation: prevents the Set object reference from changing on every render (which would make `useCallback` deps unstable)
- `ChangesSnapshot` type alias: `{ queryKey: readonly unknown[]; data: ... }` is cleaner than inline complex tuple types from `getQueriesData` return
- `useMarkAllRead` takes `projectId` as hook param (not mutate arg): meldingen.tsx uses no project filter, consistent API
- Optimistic update loops over all `['changes']` cache entries: correctly handles both `['changes', 'all', ...]` and `['changes', projectId, ...]` caches in one pass

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed TypeScript type predicate in optimistic update**

- **Found during:** Task 1 verification (npm run check)
- **Issue:** The `.filter((entry): entry is [unknown, ChangeRecordListResponse] => entry[1] !== undefined)` type predicate failed because `entry[0]` is `unknown`, not `readonly unknown[]` (TanStack Query requirement)
- **Fix:** Switched from tuple destructuring with filter to `ChangesSnapshot` type alias approach — snapshot all entries including undefined ones, skip undefined in the setQueryData loop
- **Files modified:** `frontend/src/hooks/useNotifications.ts`
- **Commit:** beda2ac (included in Task 2 commit along with the refactor)

**2. [Rule 2 - React] useMemo for readIds Set**

- **Found during:** Task 2 verification (npm run check eslint warning)
- **Issue:** `const readIds = new Set(...)` constructed on every render, making `useCallback` deps unstable per react-hooks/exhaustive-deps
- **Fix:** Wrapped in `useMemo(() => new Set(data?.read_change_ids ?? []), [data?.read_change_ids])`
- **Files modified:** `frontend/src/routes/_authenticated/meldingen.tsx`
- **Commit:** beda2ac

## Issues Encountered

None that required deviation Rule 4 (architectural decisions). Both issues were auto-fixed per Rules 1/2.

## User Setup Required

None — backend API endpoints were delivered by Plan 49-01. Frontend code is self-contained.

## Next Phase Readiness

Phase 49 is now COMPLETE:
- Backend: ChangeReadState table + 3 API endpoints (Plan 49-01)
- Frontend: Server-backed read tracking, optimistic updates, mark-all-read button (Plan 49-02)
- localStorage tracking is fully removed
- Badge counts (SideRailNav, GemeenteCard, WijkCard) update via unread count cache invalidation

---
*Phase: 49-read-tracking*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: frontend/src/lib/types/monitoring.ts
- FOUND: frontend/src/lib/api.ts
- FOUND: frontend/src/hooks/useNotifications.ts
- FOUND: frontend/src/routes/_authenticated/meldingen.tsx
- FOUND: frontend/src/components/notifications/ChangeTimeline.tsx
- FOUND commit f697d8c: feat(49-02): add API client and mutation hooks for per-change read tracking
- FOUND commit beda2ac: feat(49-02): replace localStorage read tracking with server-backed state
