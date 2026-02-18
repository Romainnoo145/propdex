---
phase: 32-feedback-systems
plan: 02
subsystem: ui
tags: [react, tailwind, lucide-react, design-system, feedback, skeleton, empty-state, error-state, toast, sonner]

# Dependency graph
requires:
  - phase: 32-01
    provides: Skeleton, EmptyState, ErrorState feedback primitives from @/components/feedback

provides:
  - ProjectList skeleton loading (3 skeleton cards replace plain 'Laden...' text)
  - ChangeTimeline skeleton loading, ErrorState with retry action, EmptyState with guidance
  - ResultsTable ErrorState with retry button, EmptyState with Search icon and guidance
  - resultaten.tsx EmptyState with Map icon and 'Naar kaart' CTA when no scan_id
  - ResultsFilterPanel toast.info on all Select dropdown filter changes
affects: [32-03, 32-04, 32-05, 32-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feedback consumption pattern: import Skeleton/EmptyState/ErrorState from @/components/feedback and use in early-return branches"
    - "toast.info('Filters toegepast', { duration: 2000 }) on user-initiated Select onChange — NOT on debounced area input timer"
    - "ErrorState retry pattern: destructure refetch from useQuery hook, pass as actions[].onClick"

key-files:
  created: []
  modified:
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - frontend/src/components/results/ResultsTable.tsx
    - frontend/src/routes/_authenticated/resultaten.tsx
    - frontend/src/components/results/ResultsFilterPanel.tsx

key-decisions:
  - "toast.info added to 3 Select dropdowns and handleClearFilters — NOT to debounced area input timer (too noisy, fires 500ms after every keystroke)"
  - "ChangeTimeline destructures refetch from useProjectChanges — TanStack Query useQuery always returns refetch so no hook changes needed"
  - "ResultsTable destructures refetch from useScanResults for same reason"
  - "ProjectList skeleton cards use border-grey-800 bg-grey-900 (dark Industrial Amber tokens) even though rest of ProjectList uses legacy text-gray-* tokens — only the loading branch was in scope"

patterns-established:
  - "Early-return feedback pattern: isLoading -> Skeleton | error -> ErrorState | empty -> EmptyState | data -> render"
  - "Filter toast: user-initiated Select changes fire toast.info; debounced input timers do not"

# Metrics
duration: ~3min
completed: 2026-02-18
---

# Phase 32 Plan 02: Feedback Primitives Adoption Summary

**Five components upgraded: ProjectList and ChangeTimeline get Skeleton loading, ChangeTimeline and ResultsTable get ErrorState with retry, ResultsTable and resultaten.tsx get EmptyState with icons, ResultsFilterPanel fires toast.info on filter changes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T03:27:31Z
- **Completed:** 2026-02-18T03:30:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ProjectList: `Laden...` plain text replaced with 3 skeleton cards using `Skeleton` primitive with Industrial Amber dark tokens
- ChangeTimeline: all three plain-text early returns replaced — skeleton timeline items during loading, `ErrorState` with `refetch` retry on error, `EmptyState` with guidance copy when empty
- ResultsTable: plain error div replaced with `ErrorState` + retry button calling `refetch()`; plain "Geen resultaten gevonden" replaced with `EmptyState` + Search icon + guidance
- resultaten.tsx: plain paragraph for no-scan-id state replaced with `EmptyState` + Map icon + "Naar kaart" CTA button navigating to /map
- ResultsFilterPanel: added `toast.info('Filters toegepast', { duration: 2000 })` to bestemming, status, score Select dropdowns and to handleClearFilters — debounced area input intentionally excluded

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade ProjectList and ChangeTimeline with feedback primitives** - `977c2a7` (feat)
2. **Task 2: Upgrade ResultsTable, resultaten.tsx, and ResultsFilterPanel** - `41ab832` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/components/projects/ProjectList.tsx` — Skeleton loading state (3 skeleton cards); import `{ Skeleton }` from `@/components/feedback/Skeleton`
- `frontend/src/components/notifications/ChangeTimeline.tsx` — Skeleton loading, ErrorState with retry, EmptyState with guidance; destructures `refetch` from `useProjectChanges`
- `frontend/src/components/results/ResultsTable.tsx` — ErrorState with retry button, EmptyState with Search icon; imports `{ ErrorState, EmptyState }` from `@/components/feedback`; destructures `refetch` from `useScanResults`
- `frontend/src/routes/_authenticated/resultaten.tsx` — EmptyState with Map icon and "Naar kaart" CTA; imports `{ EmptyState }` from `@/components/feedback`
- `frontend/src/components/results/ResultsFilterPanel.tsx` — toast.info on 3 Select onChange handlers and handleClearFilters; imports `{ toast }` from `sonner`

## Decisions Made
- `toast.info` added only to Select dropdowns (bestemming, status, score) and handleClearFilters — NOT to debounced area input timer. Plan specified this explicitly: debounced timer would fire 500ms after every keystroke, creating noise.
- Skeleton cards in ProjectList use `border-grey-800 bg-grey-900` (Industrial Amber dark tokens) to match the design system even though the rest of ProjectList still uses legacy `text-gray-*` tokens — only the loading branch was in scope per plan note.
- `refetch` destructured from `useProjectChanges` and `useScanResults` directly — TanStack Query's `useQuery` always returns `refetch` so no hook modifications were needed.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All FB-01/FB-02/FB-03/FB-04 gaps identified in the Phase 32 research audit are now closed
- ProjectList, ChangeTimeline, ResultsTable, resultaten.tsx, ResultsFilterPanel all use standardized feedback primitives
- Remaining plans (32-03+) built on the same feedback primitive foundation from Plan 01 (already complete)
- No blockers

---
*Phase: 32-feedback-systems*
*Completed: 2026-02-18*
