---
phase: 06-opgeslagen-cockpit-lifecycle-sidebar
plan: 03
subsystem: ui
tags: [react, tanstack-router, framer-motion, storybook, tailwind]

# Dependency graph
requires:
  - phase: 06-opgeslagen-cockpit-lifecycle-sidebar
    provides: Phase context and STAGES/PipelineStagePill design decisions
provides:
  - SavedParcelCard component: full-width Pure Glass card with BAG aerial thumbnail
  - PipelineStagePill updated: discriminated-union API (display + dropdown modes)
  - STAGES constant exported from PipelineStagePill.tsx (canonical PipelineStage array)
  - opgeslagen.tsx refactored: single-column layout, under 350 lines
  - Storybook stories: Loaded/Loading/NoThumbnail for SavedParcelCard
affects:
  - 06-04 (Plan 04 mounts /opgeslagen/perceel/$parcelId — SavedParcelCard navigates there)
  - 06-01 (parallel — LifecycleSideRailNav; unaffected by this plan)
  - Any future plans touching opgeslagen.tsx or SavedParcelCard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Discriminated-union props on PipelineStagePill (display vs dropdown mode) for backward compat
    - Score modals lifted to page level (single portal render vs per-card)
    - useAerialCrop for BAG aerial thumbnail with skeleton fallback
    - TanStack Router navigate with `as never` for unregistered route (Plan 04 dependency)

key-files:
  created:
    - frontend/src/components/projects/SavedParcelCard.tsx
    - frontend/src/stories/projects/SavedParcelCard.stories.tsx
    - .planning/todos/pending/2026-05-17-m050-s06-gemeente-accordion-extract.md
  modified:
    - frontend/src/components/projects/PipelineStagePill.tsx
    - frontend/src/routes/_authenticated/opgeslagen.tsx

key-decisions:
  - "PipelineStagePill extended with discriminated-union API (parcelId+currentStage = dropdown; stage+onClick = display) to preserve backward compat with FavoritedParcelCard + PipelineStageFilter callers"
  - "STAGES constant exported from PipelineStagePill.tsx (canonical location); opgeslagen.tsx imports it for validateSearch"
  - "Score modals lifted to OpgeslagenPage level — single PotentieModal + RisicoModal instance, not per-card — avoids creating N portal elements"
  - "GemeenteGroupAccordion extraction deferred — opgeslagen.tsx lands at 318 lines (<350 plan limit); full sub-300 compliance is a follow-up todo"
  - "SavedParcelCard uses `to: '/opgeslagen/perceel/$parcelId' as never` — route not yet registered (Plan 04), TypeScript satisfied via cast, build does not fail"

patterns-established:
  - "Dropdown pill pattern: portal-rendered menu with fixed positioning, click-outside via mousedown listener, resize+scroll position update"
  - "Storybook story with QueryClientProvider.setQueryData pre-seed for hook cache state control (aerial-crop key pattern)"

requirements-completed:
  - UX-01
  - UX-04
  - UX-05

# Metrics
duration: 35min
completed: 2026-05-17
---

# Phase 06 Plan 03: Opgeslagen Layout Refactor Summary

**Full-width SavedParcelCard with BAG thumbnail extracted from 610-line opgeslagen.tsx, PipelineStagePill updated with backward-compatible dropdown mode, three Storybook stories with play assertions**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-17T~14:00Z
- **Completed:** 2026-05-17T~14:35Z
- **Tasks:** 3 tasks (Task 1 + Task 2 + Task 3 executed as integrated refactor)
- **Files modified:** 5 files (2 new components + 1 story + 1 updated + 1 route refactored)

## Accomplishments

- Refactored opgeslagen.tsx from 610 lines to 318 lines by extracting components and removing workspace-mode inline render
- Created `SavedParcelCard` with Pure Glass styling, BAG aerial thumbnail via `useAerialCrop`, and navigation to Plan-04 nested route
- Updated `PipelineStagePill` with discriminated-union props: existing callers keep `stage`+`onClick` API; new `SavedParcelCard` uses `parcelId`+`currentStage` for self-contained dropdown with `useUpdatePipelineStage`
- Exported `STAGES` constant from PipelineStagePill.tsx (single source of truth for PipelineStage enum)
- Created Storybook stories (Loaded/Loading/NoThumbnail) with `QueryClientProvider.setQueryData` cache pre-seeding and `play` assertions

## Task Commits

1. **Task 1: Extract PipelineStagePill** - `895bb808` (refactor)
2. **Task 2: Create SavedParcelCard + Storybook** - `7f404462` (feat)
3. **Task 3: Refactor OpgeslagenPage** - `f2eb067e` (refactor)

## Files Created/Modified

- `frontend/src/components/projects/SavedParcelCard.tsx` (new, 120 lines) — Full-width Pure Glass card with BAG thumbnail, ScoreBadge, PipelineStagePill dropdown, TanStack Router navigation
- `frontend/src/stories/projects/SavedParcelCard.stories.tsx` (new, 165 lines) — Three stories: Loaded/Loading/NoThumbnail with play functions
- `frontend/src/components/projects/PipelineStagePill.tsx` (updated, 179 lines) — Discriminated-union API: display pill + dropdown switcher; added STAGES export
- `frontend/src/routes/_authenticated/opgeslagen.tsx` (refactored, 318 lines) — Single-column SavedParcelCard list, workspace-mode removed, pipeline filter bar removed
- `.planning/todos/pending/2026-05-17-m050-s06-gemeente-accordion-extract.md` (new) — Deferred GemeenteGroupAccordion extraction follow-up

## Decisions Made

- Discriminated-union props on `PipelineStagePill` rather than creating a separate `DropdownPipelineStagePill` component — keeps import surface clean, backward compat preserved
- Score modals lifted to page level (`ScoreModalState = { parcelCacheId, type } | null`) so only one `PotentieModal`/`RisicoModal` is portal-rendered at any time
- `GemeenteGroupAccordion` extraction deferred — 318 lines is within the plan's <350 acceptance window; deferred as todo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PipelineStagePill file pre-existed with incompatible API**
- **Found during:** Task 1 (extracting PipelineStagePill)
- **Issue:** `frontend/src/components/projects/PipelineStagePill.tsx` already existed as a display-only pill (`stage`+`onClick` props). Plan assumed file was absent and specified creating it fresh. Direct replacement would break `FavoritedParcelCard`, `PipelineStageFilter`, `PipelineStageSelector` callers.
- **Fix:** Extended existing file with discriminated-union props — `stage`+`onClick` path = display mode (unchanged), `parcelId`+`currentStage` path = new dropdown mode. Both exports present: `PipelineStagePill` + `STAGES`.
- **Files modified:** `frontend/src/components/projects/PipelineStagePill.tsx`
- **Verification:** `grep "function PipelineStagePill" .../opgeslagen.tsx` = 0; `npm run check` zero new errors
- **Committed in:** `895bb808` (Task 1 commit)

**2. [Rule 2 - Missing] Score modals required lifting to page level**
- **Found during:** Task 2/3 (creating SavedParcelCard)
- **Issue:** Original ParcelCard had PotentieModal/RisicoModal inline per card. Moving them per-card into SavedParcelCard would create N portal elements simultaneously. Better: lift to page level with single modal state.
- **Fix:** Added `ScoreModalState` type at page level; `PotentieModal`/`RisicoModal` rendered once in `OpgeslagenPage`; `onPotentieClick`/`onRisicoClick` callbacks set page-level state.
- **Files modified:** `frontend/src/routes/_authenticated/opgeslagen.tsx`
- **Verification:** Score modal import retained in opgeslagen.tsx; `npm run check` clean
- **Committed in:** `7f404462` + `f2eb067e`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical pattern)
**Impact on plan:** Both fixes required for correctness; no scope creep. Plan intent fully satisfied.

## Issues Encountered

- Storybook story needed `is_superuser: false` on mock user (User type was updated after the ReportSidebar.stories.tsx pattern was written) — fixed before commit, zero net errors introduced

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SavedParcelCard` ready for consumption by Plan 04 (`/opgeslagen/perceel/$parcelId` route)
- Card navigation wired with `as never` cast — Plan 04 registration will resolve TypeScript cleanly
- `STAGES` exported from `PipelineStagePill` for any other consumers
- Follow-up todo for `GemeenteGroupAccordion` extraction when < 300 line compliance is required

---
*Phase: 06-opgeslagen-cockpit-lifecycle-sidebar*
*Completed: 2026-05-17*
