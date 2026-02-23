---
phase: 49-read-tracking
verified: 2026-02-23T03:28:23Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 49: Read Tracking Verification Report

**Phase Goal:** Users can mark individual changes as read or unread, and that state persists in the database — unread badges everywhere reflect actual per-change state, not a project-level last-seen timestamp
**Verified:** 2026-02-23T03:28:23Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/monitoring/changes/{id}/read marks a single change as read | VERIFIED | `mark_change_read` at line 402 in router.py; pg_insert ON CONFLICT DO NOTHING; returns `{"status": "ok"}` |
| 2 | DELETE /api/monitoring/changes/{id}/read marks a single change as unread | VERIFIED | `mark_change_unread` at line 454 in router.py; deletes ChangeReadState row for (user_id, change_id) |
| 3 | POST /api/monitoring/changes/read-all bulk-marks all changes as read | VERIFIED | `mark_all_read` at line 329 in router.py; registered BEFORE `{change_id}/read`; bulk pg_insert ON CONFLICT DO NOTHING; returns `{status, marked_count}` |
| 4 | GET /api/monitoring/unread returns counts based on ChangeReadState (not last_viewed_at) | VERIFIED | Lines 276-296 in router.py use LEFT JOIN subquery on ChangeReadState; `crs.id IS NULL` pattern; no `last_viewed_at` reference in the `/unread` handler |
| 5 | Clicking a change marks it as read on the server and immediately updates the UI | VERIFIED | `useMarkChangeRead` mutation with optimistic update in useNotifications.ts lines 132-173; `handleToggle` in meldingen.tsx lines 33-38 and ChangeTimeline.tsx lines 85-90 call `markRead.mutate(changeId)` |
| 6 | Read state persists across devices (server-backed, not localStorage) | VERIFIED | localStorage code completely absent from meldingen.tsx and ChangeTimeline.tsx; readIds derived from `data?.read_change_ids` (server response) in both files |
| 7 | Unread badge counts on SideRailNav, GemeenteCard, WijkCard reflect per-change read state | VERIFIED | All badge consumers use `useUnreadCounts()` which calls `/api/monitoring/unread` (ChangeReadState-based); `useMarkChangeRead.onSuccess` invalidates `['notifications', 'unread']` |
| 8 | "Markeer alles als gelezen" button marks all changes as read in one API call | VERIFIED | Button in meldingen.tsx lines 85-92; visible when `totalUnread > 0`; calls `markAllRead.mutate()`; `useMarkAllRead.onSuccess` invalidates both `['notifications', 'unread']` and all `['changes']` caches |
| 9 | No localStorage references to read tracking remain in codebase | VERIFIED | `grep -rn "propdex-read-changes"` returns no results; no READ_STORAGE_KEY, getReadIds, or persistReadIds in either component |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/change_read_state.py` | ChangeReadState model with user_id + change_id FK, UniqueConstraint | VERIFIED | 59 lines; class ChangeReadState; user_id FK → users.id CASCADE; change_id FK → change_records.id CASCADE; UniqueConstraint("user_id", "change_id"); read_at with CURRENT_TIMESTAMP default |
| `backend/alembic/versions/e5f6a7b8c9d0_create_change_read_states_table.py` | Alembic migration creating change_read_states table | VERIFIED | revision="e5f6a7b8c9d0"; down_revision="d4e5f6a7b8c9"; creates table with all columns + unique constraint + two indexes; downgrade removes all |
| `backend/app/monitoring/router.py` | New endpoints: mark read, mark unread, mark all read | VERIFIED | mark_change_read (POST, line 402), mark_change_unread (DELETE, line 454), mark_all_read (POST, line 329); read-all registered BEFORE {change_id}/read |
| `frontend/src/lib/api.ts` | markChangeRead, markChangeUnread, markAllChangesRead functions | VERIFIED | markChangeRead (line 911), markChangeUnread (line 929), markAllChangesRead (line 949); all use apiFetch with correct methods and MONITORING_BASE prefix |
| `frontend/src/hooks/useNotifications.ts` | useMarkChangeRead, useMarkAllRead mutations | VERIFIED | useMarkChangeRead (line 132): optimistic update, rollback on error, invalidates unread on success; useMarkAllRead (line 184): full cache invalidation; ChangesSnapshot type alias |
| `frontend/src/routes/_authenticated/meldingen.tsx` | Server-backed read state, markeer alles als gelezen button | VERIFIED | readIds from `useMemo(() => new Set(data?.read_change_ids ?? []))` (line 28); "Markeer alles als gelezen" button (line 85); no localStorage |
| `frontend/src/components/notifications/ChangeTimeline.tsx` | Server-backed read state, no localStorage | VERIFIED | readIds from `new Set(data?.read_change_ids ?? [])` (line 39); useMarkChangeRead called in handleToggle (line 88); no localStorage |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/monitoring/router.py` | `backend/app/models/change_read_state.py` | SQLAlchemy insert/delete | WIRED | pg_insert(ChangeReadState) at lines 381, 429; delete(ChangeReadState) at line 471; ChangeReadState imported at line 14 |
| `backend/app/monitoring/router.py` | `backend/app/schemas/monitoring.py` | response_model | WIRED | MarkAllReadResponse imported (line 22) and used as response_model on mark_all_read; read_change_ids returned in ChangeRecordListResponse |
| `frontend/src/hooks/useNotifications.ts` | `frontend/src/lib/api.ts` | mutation functions | WIRED | apiMarkChangeRead imported as alias (line 21); apiMarkAllChangesRead imported (line 23); called in mutationFn at lines 137, 189 |
| `frontend/src/routes/_authenticated/meldingen.tsx` | `frontend/src/hooks/useNotifications.ts` | hook import | WIRED | `useMarkChangeRead, useMarkAllRead` imported (line 6); used at lines 24-25; markRead.mutate() at line 36; markAllRead.mutate() at line 86 |
| `frontend/src/components/notifications/ChangeTimeline.tsx` | `frontend/src/hooks/useNotifications.ts` | hook import | WIRED | `useMarkChangeRead` imported (line 14); markRead = useMarkChangeRead() at line 36; markRead.mutate(changeId) at line 88 |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Toggle read/unread on click with immediate visual update | SATISFIED | Optimistic cache update in useMarkChangeRead adds changeId to read_change_ids immediately; unread dot disappears before server confirms |
| Cross-device persistence (server-backed, not localStorage) | SATISFIED | readIds derived from server response (read_change_ids); localStorage code fully removed from both components |
| Unread badges reflect per-change read state | SATISFIED | SideRailNav, GemeenteCard, WijkCard all use useUnreadCounts() → /api/monitoring/unread → ChangeReadState LEFT JOIN |
| "Markeer alles als gelezen" bulk action | SATISFIED | Button present in meldingen.tsx; calls /api/monitoring/changes/read-all; cache invalidation resets badges to zero |

### Anti-Patterns Found

None. No TODOs, placeholders, empty implementations, or stub handlers found in any of the phase-modified files.

### Notable Observation: /projects Endpoint Still Uses last_viewed_at

The `GET /api/monitoring/projects` endpoint (line 548 in router.py) still calculates `unread_count` per project using the old `UserNotificationState.last_viewed_at` timestamp approach. This is intentional — the SUMMARY documents it as "deprecated, removable in future cleanup." The badge components that matter for the phase goal (SideRailNav, GemeenteCard, WijkCard via WijkCardGrid, ProjectList) all consume `useUnreadCounts()` which calls the updated `/unread` endpoint. The `/projects` endpoint's unread_count field is not used by any badge component for display.

### Human Verification Required

The following behaviors require human testing to fully confirm:

#### 1. Visual unread dot disappears immediately on click

**Test:** Open meldingen feed with at least one unread change (amber dot visible). Click the change to expand it.
**Expected:** The amber dot on that specific change disappears immediately, before the network call completes. The change title renders at normal weight (not bold treatment), confirming read state.
**Why human:** Optimistic update timing and visual treatment require browser rendering to verify.

#### 2. Badge counts decrement in real time after marking read

**Test:** Note unread count on SideRailNav bell icon, GemeenteCard badge, and WijkCard badge. Open meldingen and click an unread change.
**Expected:** After the network call completes (within ~1 second), the badge counts on all three locations decrement by 1.
**Why human:** Requires verifying TanStack Query cache invalidation propagates to all three badge locations visually.

#### 3. Cross-device state persistence

**Test:** Mark a change as read in Chrome. Open the app in Firefox (different session, same credentials).
**Expected:** The same change appears as read (no amber dot) in Firefox.
**Why human:** Requires two browser sessions with actual authentication.

#### 4. "Markeer alles als gelezen" resets all badges to zero

**Test:** Open meldingen with multiple unread changes visible. Click "Markeer alles als gelezen" button.
**Expected:** All amber dots disappear, the "X nieuw" badge disappears, SideRailNav bell badge resets to 0, GemeenteCard and WijkCard badges reset to 0.
**Why human:** Requires verifying full-page badge propagation after bulk cache invalidation.

### Gaps Summary

No gaps. All 9 must-have truths are verified, all artifacts are substantive and wired, no anti-patterns detected, and no localStorage remnants remain. The phase goal is achieved.

---

_Verified: 2026-02-23T03:28:23Z_
_Verifier: Claude (gsd-verifier)_
