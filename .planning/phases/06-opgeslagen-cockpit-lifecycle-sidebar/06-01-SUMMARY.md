---
phase: 06-opgeslagen-cockpit-lifecycle-sidebar
plan: 01
subsystem: ui
tags: [react, framer-motion, lucide, tanstack-router, storybook, lifecycle, sidebar]

# Dependency graph
requires: []
provides:
  - "frontend/src/lib/lifecycle/phases.ts: LIFECYCLE_PHASES (6-entry array), LifecyclePhaseKey type, pipelineStageToLifecyclePhase(), getLifecyclePhase()"
  - "frontend/src/components/layout/LifecycleSideRailNav.tsx: sidebar variant for /opgeslagen context with 6 lifecycle icons"
  - "frontend/src/stories/layout/LifecycleSideRailNav.stories.tsx: 3 Storybook stories"
affects:
  - 06-02 (mounts LifecycleSideRailNav into layout — direct consumer of component)
  - 06-03 (uses pipelineStageToLifecyclePhase() from phases.ts for card active-state)
  - 06-04 (routing decisions: LifecyclePhaseKey used as URL slug)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifecycle phase registry: readonly array of LifecyclePhase objects — single source of truth for both sidebar and card active-state"
    - "Separate Framer Motion layoutId namespace: lifecycle-sidebar-active (not sidebar-active) — avoids cross-component animation interference"
    - "Enabled/disabled pattern: phase.enabled gates Link vs disabled button render; disabled phases carry aria-disabled=true"
    - "search={{ stage: undefined }} required on Link to=/opgeslagen — route has validateSearch with required stage param"

key-files:
  created:
    - frontend/src/lib/lifecycle/phases.ts
    - frontend/src/components/layout/LifecycleSideRailNav.tsx
    - frontend/src/stories/layout/LifecycleSideRailNav.stories.tsx
  modified: []

key-decisions:
  - "Unterzoek icon links to /opgeslagen (the saved-parcels list home) — doubles as home affordance within lifecycle context; Plan 04 does NOT swap this target"
  - "search={{ stage: undefined }} on /opgeslagen Link required by validateSearch in opgeslagen.tsx — auto-fixed during Task 2"
  - "Storybook mockAuthValue includes is_superuser:false — User type now requires this field (pre-existing gap in other stories)"

patterns-established:
  - "lifecycle phase mapping: pipelineStageToLifecyclePhase() as UI-only projection from backend PipelineStage — no schema change"
  - "Disabled phase buttons: <button disabled aria-disabled='true' className='cursor-not-allowed opacity-60'> — consistent pattern for future CRM phases"

requirements-completed:
  - UX-02
  - UX-04
  - UX-05

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 06 Plan 01: Lifecycle Sidebar — Data Module + Component Summary

**Typed 6-phase lifecycle registry (phases.ts) + LifecycleSideRailNav sidebar variant with Framer Motion active pill and 5 disabled placeholder phases, fully Aura-token-compliant**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-17T21:08:38Z
- **Completed:** 2026-05-17T21:12:50Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments
- Created `frontend/src/lib/lifecycle/phases.ts` exporting LIFECYCLE_PHASES (6 entries), LifecyclePhaseKey type, pipelineStageToLifecyclePhase() mapping backend stages to UI phases, getLifecyclePhase() lookup
- Created `frontend/src/components/layout/LifecycleSideRailNav.tsx` — THREE-pod layout cloned from SideRailNav, middle pod replaced with lifecycle icons, unique `lifecycle-sidebar-active` layoutId, bottom pod Uitloggen only
- Created `frontend/src/stories/layout/LifecycleSideRailNav.stories.tsx` with Default + ActiveOnderzoek + DisabledPhasesAreUnclickable stories with play functions

## Task Commits

1. **Task 1: Create lifecycle phases data module** - `1896cebf` (chore)
2. **Task 2: Build LifecycleSideRailNav component + Storybook story** - `634f3248` (feat)

## Files Created/Modified
- `frontend/src/lib/lifecycle/phases.ts` — 57-line lifecycle phase registry: LIFECYCLE_PHASES, LifecyclePhaseKey, pipelineStageToLifecyclePhase(), getLifecyclePhase()
- `frontend/src/components/layout/LifecycleSideRailNav.tsx` — 123-line sidebar component with 6 phase icons, enabled/disabled logic, Aura tokens, Framer Motion
- `frontend/src/stories/layout/LifecycleSideRailNav.stories.tsx` — 3 Storybook stories with play function assertions

## Decisions Made
- Onderzoek phase icon links to `/opgeslagen` (list view home), not a future nested route — per plan spec, Plan 04 does NOT change this
- `search={{ stage: undefined }}` required on the /opgeslagen Link — opgeslagen route has `validateSearch` with a `stage` param that TanStack Router enforces at the Link level
- Storybook mockAuthValue includes `is_superuser: false` — the User type requires this field (other existing story files have a pre-existing TS error for the missing field; our new story is clean)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added search={{ stage: undefined }} to /opgeslagen Link**
- **Found during:** Task 2 (LifecycleSideRailNav component)
- **Issue:** TanStack Router TS error: `Property 'search' is missing` — opgeslagen route has `validateSearch` requiring a `stage` param
- **Fix:** Added `search={{ stage: undefined }}` to the Link props
- **Files modified:** frontend/src/components/layout/LifecycleSideRailNav.tsx
- **Verification:** `npm run check` no errors on new file after fix
- **Committed in:** 634f3248 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking TS error)
**Impact on plan:** Required for TanStack Router type-safety. No scope creep.

## Issues Encountered
- Pre-existing 91 TS errors in the codebase (stash-verified baseline at plan start). Post-execution count is 92 (the extra error is a pre-existing one that became visible after routeTree rebuild — not introduced by new files). Zero errors on new files.

## Next Phase Readiness
- Plan 06-02 (layout mount) can now import LifecycleSideRailNav directly — public API is stable
- Plan 06-03 (full-width cards) can import pipelineStageToLifecyclePhase from phases.ts
- No blockers for wave 2 execution

---
*Phase: 06-opgeslagen-cockpit-lifecycle-sidebar*
*Completed: 2026-05-17*
