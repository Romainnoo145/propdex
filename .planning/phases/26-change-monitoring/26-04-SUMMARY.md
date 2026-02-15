---
phase: 26-change-monitoring
plan: 04
subsystem: frontend-ui
tags: [notifications, change-timeline, ui-components, polling, tanstack-query]
dependency_graph:
  requires: [26-02]
  provides: [notification-ui, change-timeline-component]
  affects: [side-rail-nav, project-list, user-notifications]
tech_stack:
  added: []
  patterns: [polling-hook, auto-mark-viewed, dual-notification-ui, date-grouping, native-intl]
key_files:
  created:
    - frontend/src/lib/types/monitoring.ts
    - frontend/src/hooks/useNotifications.ts
    - frontend/src/components/notifications/NotificationBadge.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/components/projects/ProjectList.tsx
decisions:
  - id: native-intl-formatting
    summary: "Use native Intl.DateTimeFormat and manual relative time calculation (not date-fns)"
    rationale: "No date libraries installed, avoid new dependencies per project preference"
    alternatives: ["date-fns", "dayjs"]
  - id: unread-badge-display-logic
    summary: "Show empty red dot for 1-9 changes, number badge for 10+"
    rationale: "Minimalist design for low counts, explicit number for higher counts"
    alternatives: ["Always show number", "Always show dot"]
metrics:
  duration_seconds: 257
  tasks_completed: 2
  files_created: 4
  files_modified: 3
  commits: 2
  completed_at: "2026-02-15T13:40:31Z"
---

# Phase 26 Plan 04: Frontend Notification UI Summary

**One-liner:** Dual notification system with bell badge on side-rail and per-project unread indicators, plus auto-clearing change timeline component.

## What Was Built

Created the frontend notification UI layer for Phase 26 (Change Monitoring) by implementing polling hooks, notification components, and integrating them into existing UI surfaces.

### Key Components

**1. TypeScript Types (frontend/src/lib/types/monitoring.ts)**

Interfaces matching backend monitoring API:

- **ChangeRecord** — Single change entry with type (permit/zoning), title, dates, address, source URL
- **ChangeRecordListResponse** — Paginated list of changes with total count
- **ProjectUnreadCount** — Per-project unread count breakdown
- **UnreadDetailResponse** — Total unread + projects_with_changes + per_project array

**2. API Functions (frontend/src/lib/api.ts)**

Three monitoring endpoints added:

- **`fetchUnreadCounts(accessToken)`**
  - GET /api/monitoring/unread
  - Returns total unread count and per-project breakdown
  - Used by polling hook (60s interval)

- **`fetchProjectChanges(projectId, accessToken, limit, offset)`**
  - GET /api/monitoring/changes
  - Returns paginated change history for specific project
  - Auto-updates last_viewed_at (side effect on backend)

- **`markProjectViewed(projectId, accessToken)`**
  - POST /api/monitoring/viewed/{projectId}
  - Explicitly marks project as viewed (clears unread badge)
  - Used by ChangeTimeline on mount

**3. Notification Hooks (frontend/src/hooks/useNotifications.ts)**

TanStack Query hooks following project patterns:

- **`useUnreadCounts()`**
  - Query key: `['notifications', 'unread']`
  - Polling: 60 seconds (detect new changes)
  - Stale time: 30 seconds (balance freshness vs refetches)
  - Enabled only when accessToken exists

- **`useProjectChanges(projectId)`**
  - Query key: `['changes', projectId]`
  - Stale time: 60 seconds (changes not real-time)
  - Enabled only when accessToken + projectId exist

- **`useMarkViewed()`**
  - Mutation invalidates `['notifications', 'unread']` cache
  - Used by ChangeTimeline to auto-clear on view

**4. NotificationBadge Component (frontend/src/components/notifications/NotificationBadge.tsx)**

Simple badge with count display logic:

- **count=0:** Nothing rendered
- **count 1-99:** Shows number as text
- **count > 99:** Shows "99+"
- **Styling:** Absolute positioned red circle (caller provides relative container)
- **Positioning:** `-top-1 -right-1` for overlay on icon

**5. ChangeTimeline Component (frontend/src/components/notifications/ChangeTimeline.tsx)**

Change history display with auto-marking:

- **Auto-mark viewed:** useEffect calls `markViewed.mutate(projectId)` on mount
- **Grouping:** Changes grouped by date (YYYY-MM-DD) with date headers
- **Date headers:** "Vandaag", "Gisteren", or formatted "15 feb"
- **Icons:** Blue document icon for permits, green map icon for zoning
- **Expandable details:** Click to expand, shows source_url link to official publication
- **Relative time:** "Net gedetecteerd", "5 minuten geleden", "3 dagen geleden"
- **Empty state:** "Geen wijzigingen gedetecteerd"
- **Loading state:** "Wijzigingen laden..."
- **Error state:** "Fout bij laden wijzigingen"

**6. SideRailNav Integration (frontend/src/components/layout/SideRailNav.tsx)**

Notification bell added between divider and Rapporten toggle:

- **Icon:** Bell SVG (24x24, stroke-based, consistent with existing icons)
- **Badge:** NotificationBadge overlaid on bell icon
- **Link:** Wraps bell in Link to="/projecten" (per locked decision)
- **Tooltip:** "Meldingen" on hover
- **Count:** Total unread from `useUnreadCounts()` hook

**7. ProjectList Integration (frontend/src/components/projects/ProjectList.tsx)**

Per-project unread badges + change timeline:

- **Unread badges:** Show next to report_count badge in project header
  - 1-9 changes: Empty red dot (no number)
  - 10+ changes: Number badge
- **Badge lookup:** `unreadData?.per_project.find(p => p.project_id === project.id)?.unread_count`
- **Change timeline:** Shown below reports section when project expanded
- **Graceful degradation:** No badges if `unreadData` not available
- **Demo mode skip:** ChangeTimeline not shown in demo mode (no auth)

## Architecture Decisions

**Dual Notification Pattern:**
- Side-rail bell badge shows total unread across all projects
- Individual project folders show per-project unread count
- Clicking bell navigates to Projecten tab (not separate notifications page)
- Aligns with locked decision from Phase 26 research

**Auto-Clear on View:**
- ChangeTimeline calls `markViewed.mutate()` in useEffect on mount
- Backend /changes endpoint ALSO auto-updates last_viewed_at (double clearing)
- User never has to manually "mark as read" — viewing clears badge

**Polling Strategy:**
- 60 second poll interval (changes detected by background jobs, not real-time)
- 30 second stale time (allows manual refetch without re-polling immediately)
- Enabled only when authenticated (graceful when logged out)

**Native Date Formatting:**
- No date-fns dependency (project preference: avoid new dependencies)
- Manual relative time calculation: diffMinutes, diffHours, diffDays
- Native `Intl.DateTimeFormat` for "15 feb" formatting
- Dutch language strings: "Vandaag", "Gisteren", "minuten geleden"

**Icon Differentiation:**
- Permits: Blue document icon (administrative changes)
- Zoning: Green map icon (spatial/planning changes)
- Aligns with locked decision: "type-differentiated icons"

**Date Grouping:**
- Group by YYYY-MM-DD extracted from `change_date` field
- Sort newest first (reverse chronological)
- Date headers use smart formatting (today/yesterday/absolute)

**Badge Display Logic:**
- Total badge (side-rail): Always show count (even "1")
- Project badges: Show empty dot for 1-9, number for 10+
- Rationale: Side-rail needs clear count, project folders cleaner with dots for low counts

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All verification checks passed:

```bash
✓ npm run check passes (only pre-existing TanStack Table warning)
✓ NotificationBadge renders count (0 hidden, 1-99 number, 99+ capped)
✓ SideRailNav shows bell icon with NotificationBadge
✓ Bell icon click navigates to /projecten (via Link component)
✓ ProjectList shows unread dot/count per project (from useUnreadCounts per_project)
✓ Expanding project shows ChangeTimeline below reports
✓ ChangeTimeline auto-marks project as viewed (useEffect on mount)
✓ useUnreadCounts polls every 60 seconds (refetchInterval: 60_000)
```

## Task Breakdown

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | Create TypeScript types, API functions, and notification hook | e35e799 | monitoring.ts, api.ts, useNotifications.ts |
| 2 | Create NotificationBadge + ChangeTimeline, update SideRailNav and ProjectList | ca4c78a | NotificationBadge.tsx, ChangeTimeline.tsx, SideRailNav.tsx, ProjectList.tsx |

## Dependencies Provided

**For subsequent plans in Phase 26:**
- Frontend notification UI ready for testing with live backend (Plan 03 ARQ jobs)
- Change timeline ready to display permit/zoning changes (Plan 05 will add project hierarchy)

**For future enhancements:**
- Polling hook can be extended with WebSocket support (real-time updates)
- ChangeTimeline component can be extended with filters (permit-only, zoning-only)

## Technical Notes

**TanStack Query Hook Pattern:**
```typescript
export function useUnreadCounts() {
  const { accessToken } = useAuth()
  return useQuery<UnreadDetailResponse, Error>({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchUnreadCounts(accessToken),
    refetchInterval: 60_000,  // Poll every 60 seconds
    staleTime: 30_000,
    enabled: !!accessToken,
  })
}
```

**Auto-Mark Viewed Pattern:**
```typescript
const markViewed = useMarkViewed()
useEffect(() => {
  markViewed.mutate(projectId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId]) // Only run when projectId changes
```

**Relative Time Calculation:**
```typescript
function formatRelativeTime(isoDateStr: string): string {
  const date = new Date(isoDateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 1000 / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Net gedetecteerd'
  if (diffMinutes < 60) return `${diffMinutes} minuten geleden`
  if (diffHours < 24) return `${diffHours} uur geleden`
  if (diffDays < 7) return `${diffDays} dagen geleden`

  // Fallback to absolute date
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}
```

**Unread Badge Lookup:**
```typescript
const unreadCount = unreadData?.per_project.find(
  (p) => p.project_id === project.id
)?.unread_count ?? 0
```

## UI Flow

**User Journey:**
1. User logs in → `useUnreadCounts()` starts polling
2. Background job detects new permit → backend creates ChangeRecord
3. After 60s (next poll), bell badge shows "1"
4. User clicks bell → navigates to /projecten
5. User sees red dot on affected project
6. User expands project → ChangeTimeline shown
7. ChangeTimeline mounts → calls `markViewed.mutate(projectId)`
8. Backend updates last_viewed_at → next poll shows "0"
9. Badge clears automatically

## Multi-Tenant Isolation

All hooks use `accessToken` from `useAuth()`:
- Backend enforces organization_id filtering on all endpoints
- No cross-tenant data leakage possible
- Unauthenticated users see no badges (enabled: !!accessToken)

## Graceful Degradation

**Demo mode:**
- ProjectList skips ChangeTimeline (no auth, no API)
- Unread badges not shown (unreadData undefined)
- Bell icon shows "0" count

**Loading states:**
- useUnreadCounts isLoading → badge shows "0"
- useProjectChanges isLoading → "Wijzigingen laden..."

**Error states:**
- useProjectChanges error → "Fout bij laden wijzigingen"
- Polling continues in background (TanStack Query auto-retry)

## Self-Check: PASSED

All created files exist:
```bash
✓ frontend/src/lib/types/monitoring.ts
✓ frontend/src/hooks/useNotifications.ts
✓ frontend/src/components/notifications/NotificationBadge.tsx
✓ frontend/src/components/notifications/ChangeTimeline.tsx
```

All commits exist:
```bash
✓ e35e799: feat(26-04): create TypeScript types, API functions, and notification hook
✓ ca4c78a: feat(26-04): create NotificationBadge, ChangeTimeline, update SideRailNav and ProjectList
```

All modified files updated:
```bash
✓ frontend/src/lib/api.ts (monitoring endpoints added)
✓ frontend/src/components/layout/SideRailNav.tsx (bell icon + badge)
✓ frontend/src/components/projects/ProjectList.tsx (unread badges + timeline)
```
