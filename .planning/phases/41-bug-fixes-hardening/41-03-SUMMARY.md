---
phase: 41-bug-fixes-hardening
plan: "03"
subsystem: ui
tags: [react, tailwind, ruff, python, npm, cleanup, tech-debt]

# Dependency graph
requires: []
provides:
  - Removed react-resizable-panels from frontend bundle (unused dependency)
  - ChangeTimeline.tsx dark-themed using grey-* design system tokens
  - Clean Python imports in jwt.py, change_monitor.py, rate_limit.py
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "grey-* CSS custom properties used for dark theme UI, not standard Tailwind gray-* (light palette)"
    - "ruff --select F401 --fix for safe unused import cleanup (excludes B904 intentional security patterns)"

key-files:
  created: []
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - backend/app/auth/jwt.py
    - backend/app/jobs/change_monitor.py
    - backend/app/middleware/rate_limit.py

key-decisions:
  - "Use --select F401 only for ruff auto-fix to avoid touching intentional B904 bare-raise security patterns in auth code"
  - "ChangeTimeline uses grey-* (design system) not gray-* (Tailwind default light palette) — dark UI context requires dark tokens"
  - "ProjectEditModal.tsx and ProjectCreateModal.tsx gray-* kept intentionally — light card on dimmed backdrop is correct for modal pattern"

patterns-established:
  - "dark UI components: border-grey-800, bg-grey-900, text-grey-100, text-grey-400, hover:bg-grey-800/70"

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 41 Plan 03: Tech Debt Cleanup Summary

**Removed react-resizable-panels bundle bloat, migrated ChangeTimeline to dark grey-* design tokens, and cleaned 4 unused Python imports via ruff F401**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T02:34:50Z
- **Completed:** 2026-02-20T02:37:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Removed react-resizable-panels (^2.1.9) from package.json — zero usage confirmed in src/, pure bundle bloat
- Replaced all 10 gray-* Tailwind light-palette classes in ChangeTimeline.tsx with grey-* dark design system tokens
- Removed 4 unused Python imports across 3 files: `timezone` + `InvalidTokenError` from jwt.py, `uuid` from change_monitor.py, `settings` from rate_limit.py
- ruff F401 check now returns "All checks passed!" across entire app/ directory

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove react-resizable-panels and clean ChangeTimeline gray-* classes** - `d154502` (chore)
2. **Task 2: Remove unused Python imports via ruff** - `95520d4` (chore)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `frontend/package.json` - Removed react-resizable-panels dependency
- `frontend/package-lock.json` - Updated lockfile after uninstall
- `frontend/src/components/notifications/ChangeTimeline.tsx` - 10 gray-* classes replaced with grey-* dark tokens
- `backend/app/auth/jwt.py` - Removed unused `timezone` and `InvalidTokenError` imports
- `backend/app/jobs/change_monitor.py` - Removed unused `uuid` import
- `backend/app/middleware/rate_limit.py` - Removed unused `settings` import

## Decisions Made
- Used `ruff check --select F401 --fix` only (not bare `--fix`) to avoid touching B904 bare-raise patterns in auth code, which are intentional security design
- Did not modify ProjectEditModal.tsx, ProjectCreateModal.tsx, ProjectList.tsx, ResultsTable.tsx, or ParcelCard.tsx — their gray-* classes are intentional for light-themed card contexts
- Fixed `I001` import sorting in rate_limit.py (appeared after settings removal) — safe format-only fix consistent with ruff isort rules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 41 now has all 3 plans complete: register 500 fix (41-01), ARQ duplicate fix (41-02), tech debt cleanup (41-03)
- v5.0 Scan Intelligence milestone is complete
- No blockers for milestone close

---
*Phase: 41-bug-fixes-hardening*
*Completed: 2026-02-20*
