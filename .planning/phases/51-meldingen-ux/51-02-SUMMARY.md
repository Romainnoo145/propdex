---
phase: 51-meldingen-ux
plan: 02
subsystem: frontend/monitoring
tags: [ux, notifications, pagination, infinite-scroll, action-states]
dependency_graph:
  requires:
    - Phase 51 Plan 01: useReadTracking hook, gemeente_naam backend filter
    - Phase 49: server-backed read tracking (read_change_ids per page)
    - Phase 48: matched_parcel_id in ChangeRecord
  provides:
    - useInfiniteAllChanges hook with 25-record pages
    - has_more cursor pagination on GET /changes
    - Infinite scroll sentinel in meldingen feed
    - Action state badges per melding (matched/address-only/no-match)
  affects:
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/lib/types/monitoring.ts
    - backend/app/schemas/monitoring.py
    - backend/app/monitoring/router.py
tech_stack:
  added: []
  patterns:
    - useInfiniteQuery with initialPageParam=0 and getNextPageParam
    - IntersectionObserver with rootMargin for scroll-ahead triggering
    - pages.flatMap for merging paginated data across pages
    - Progressive gemeente name derivation from loaded pages
    - useUnreadCounts() for server-accurate unread badge (independent of pagination offset)
key_files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/lib/types/monitoring.ts
    - backend/app/schemas/monitoring.py
    - backend/app/monitoring/router.py
decisions:
  - useInfiniteAllChanges passes gemeenteNaam to server — query key changes on filter, auto-resets feed
  - totalUnread sourced from useUnreadCounts() not from paginated pages — accurate org-wide count regardless of pagination offset
  - Gemeente names derived from loaded pages (progressively) — first page covers most gemeentes, avoids extra query
  - Action state badge placed in collapsed view alongside category_label badge — minimal visual addition
  - IntersectionObserver rootMargin 200px — triggers 200px before bottom, prevents janky load
  - allReadIds merged via pages.flatMap — each page carries its own read_change_ids subset; merge ensures consistent read state
metrics:
  duration_minutes: 3
  completed_date: 2026-02-23
  tasks_completed: 2
  files_changed: 5
---

# Phase 51 Plan 02: Infinite Scroll and Action State Badges Summary

Cursor-based pagination with `useInfiniteQuery` and per-melding action state badges — meldingen feed now loads 25 records per page with auto-scroll and communicates match state at a glance in the collapsed view.

## What Was Built

**Backend `has_more` pagination flag** (`backend/app/schemas/monitoring.py`, `backend/app/monitoring/router.py`):
- Added `has_more: bool = False` field to `ChangeRecordListResponse` schema
- Backend computes `has_more = (offset + limit) < total` and includes it in every GET /changes response
- Enables clean frontend termination condition without requiring re-computation client-side

**Frontend type update** (`frontend/src/lib/types/monitoring.ts`):
- Added `has_more?: boolean` to `ChangeRecordListResponse`

**`useInfiniteAllChanges` hook** (`frontend/src/hooks/useNotifications.ts`):
- `useInfiniteQuery` with `initialPageParam: 0` and `PAGE_SIZE = 25`
- `getNextPageParam` returns `lastPageParam + PAGE_SIZE` when `has_more=true`, else `undefined`
- Query key `['changes', 'all-infinite', includeMatches, gemeenteNaam]` — gemeente filter change auto-resets feed
- `enabled: !!accessToken`, `staleTime: 60_000`
- Existing `useAllChanges` hook unchanged — `ChangeTimeline.tsx` and other consumers unaffected

**Infinite scroll meldingen feed** (`frontend/src/routes/_authenticated/meldingen.tsx`):
- Replaced `useAllChanges` with `useInfiniteAllChanges(true, selectedGemeente ?? undefined)`
- `allChanges = pages.flatMap(p => p.changes)` and `allReadIds = pages.flatMap(p => p.read_change_ids ?? [])`
- Gemeente names derived progressively from `allChanges` via `useMemo`
- `IntersectionObserver` sentinel placed after last date group with `rootMargin: '200px'`
- `totalUnread` sourced from `useUnreadCounts()` for accurate server-side count

**Action state badges in collapsed MeldingItem**:
- `matched_parcel_id` truthy: emerald badge "Perceel gekoppeld" with checkmark SVG
- Address fallback available (`postcode + extractHuisnummer`): amber badge "Alleen adres"
- No match at all: grey badge "Geen perceel gevonden"
- Badges placed in a flex row alongside the existing `category_label` badge

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All modified files confirmed on disk. Both task commits (`a8c09cd`, `44f19ff`) present in git log.
TypeScript compiles with 0 errors (`npm run check`: 0 errors, 146 pre-existing warnings).
Backend ruff check passes. `python -m py_compile` passes for both router.py and monitoring.py.
Verification greps confirmed: `useInfiniteAllChanges`, `Perceel gekoppeld`, `Geen perceel gevonden`, `IntersectionObserver` all present in meldingen.tsx.
