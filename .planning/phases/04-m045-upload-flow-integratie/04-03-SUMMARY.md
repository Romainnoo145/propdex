---
phase: 04-m045-upload-flow-integratie
plan: 03
subsystem: ui
tags: [tanstack-router, settings, beleid-beheer, data-bronnen, banner]

# Dependency graph
requires:
  - phase: 04-m045-upload-flow-integratie/04-02
    provides: Data-bronnen route exists as deeplink target
provides:
  - Amber redirect banner on /instellingen/beleid-beheer pointing to /instellingen/data-bronnen
  - BeleidBeheerWithBanner wrapper component keeping superuser gate intact
affects:
  - 04-04-PLAN.md (upload flow integratie)
  - admins navigating legacy beleid-beheer route

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wrapper component pattern: route component becomes wrapper that adds context banner above existing page"
    - "TanStack Link for internal navigation in route files (not just components)"

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx

key-decisions:
  - "INT-03 banner: wrapper component (BeleidBeheerWithBanner) wraps InstellingenBeleidPage rather than modifying InstellingenBeleidPage itself — route file owns the cross-cutting migration notice"
  - "No route redirect — banner is informational only; Landelijk/Provincie content remains at beleid-beheer until M050"

patterns-established:
  - "Route-level migration banner: wrap existing page component in new function component that prepends banner markup"

requirements-completed: [INT-03]

# Metrics
duration: 1min
completed: 2026-05-15
---

# Phase 04 Plan 03: Beleid-beheer Redirect Banner Summary

**Amber info-banner added to /instellingen/beleid-beheer informing admins gemeente-level documents have moved to Data-bronnen, with a deeplink to /instellingen/data-bronnen via TanStack Link**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-15T07:58:00Z
- **Completed:** 2026-05-15T07:59:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added Aura-styled amber banner (bg-[#F9A826]/15) to beleid-beheer route above existing page content
- Preserved superuser gate (beforeLoad is_superuser check) unchanged
- Preserved full InstellingenBeleidPage render below banner unchanged
- No route redirect — route remains fully functional for Landelijk/Provincie levels

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redirect banner to beleid-beheer route** - `681785cd` (feat)

## Files Created/Modified
- `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` - Added BeleidBeheerWithBanner wrapper component with amber info-banner + TanStack Link to /instellingen/data-bronnen

## Decisions Made
- INT-03 banner pattern: wrapper component approach (BeleidBeheerWithBanner) rather than modifying InstellingenBeleidPage — keeps the migration notice at the route level, not in the page component
- No redirect logic added — informational banner only; legacy route stays live for Landelijk/Provincie content until M050

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (`verkenner.tsx` Framer Motion variants, `ReportSidebar.stories.tsx` + `SideRailNav.stories.tsx` User mock missing `is_superuser`) were present before this task. No errors in modified file. Out-of-scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Banner is live on /instellingen/beleid-beheer route
- /instellingen/data-bronnen deeplink target is confirmed present (from 04-02)
- Ready for 04-04 (upload modal in-place integration)

---
*Phase: 04-m045-upload-flow-integratie*
*Completed: 2026-05-15*
