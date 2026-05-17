---
phase: 03-data-sources-ux
plan: 03
subsystem: ui
tags: [react, typescript, tanstack-query, framer-motion, aura-design-system, data-sources, admin]

# Dependency graph
requires:
  - phase: 03-data-sources-ux
    plan: 01
    provides: "TypeScript type mirror (7 types) + TanStack Query hooks (useGemeentenSummary, useGemeenteDataSources, useRefreshDataSource)"

provides:
  - "StatusPill: 4 Aura-token status variants (live/broken/missing/not_applicable) + tooltip on broken state"
  - "DataSourceRow: Pure Glass card with label/source-type badge/StatusPill/last_checked relative/action buttons"
  - "DataSourceSection: section header + count chip + empty-state inline copy"
  - "GemeentePicker: horizontal pill-tab strip with motion layoutId + status-dots per gemeente"
  - "DataSourcesEmptyState: gemeente-level empty state with MapPin icon + 2 CTAs"
  - "ui/Tooltip.tsx: reusable CSS group/group-hover tooltip wrapper (project convention)"

affects: [03-04-routes, storybook-plays]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS group/group-hover tooltip pattern: project convention over Radix/shadcn (no @/components/ui/tooltip exists)"
    - "Aura token verbatim usage: Morning Mist #F2F6F3, Vitality Green #22C55E, Warm Amber #F9A826, Obsidian #0E1111, Pure Glass bg-white/60 backdrop-blur-[24px]"
    - "motion layoutId isolation: gemeente-picker scope separate from settings-tab scope"
    - "data-* attributes on interactive elements for Storybook play query compatibility"

key-files:
  created:
    - frontend/src/components/settings/data-bronnen/StatusPill.tsx
    - frontend/src/components/settings/data-bronnen/DataSourceRow.tsx
    - frontend/src/components/settings/data-bronnen/DataSourceSection.tsx
    - frontend/src/components/settings/data-bronnen/GemeentePicker.tsx
    - frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx
    - frontend/src/components/ui/Tooltip.tsx
  modified: []

key-decisions:
  - "No @/components/ui/tooltip (Radix/shadcn) — created ui/Tooltip.tsx using project CSS group/group-hover pattern per TeamAttributionBadge.tsx convention"
  - "motion layoutId='gemeente-picker' is isolated scope from SettingsTabNav's 'settings-tab' — prevents cross-tab animation interference"
  - "Upload action renders as TanStack Link (not button) when enabled — deep-links to beleid-beheer per 03-CONTEXT §12"
  - "TS2322 route errors on /instellingen/data-bronnen/* are pre-existing (route not yet created — lands in 03-04)"

patterns-established:
  - "data-* attributes on interactive elements: data-status, data-source-key, data-source-type, data-action, data-enabled, data-active, data-gemeente-code for Storybook play query compatibility"
  - "Tooltip-on-disabled-button: CSS group/group-hover wrapping (no span[tabIndex=0] hack needed — CSS approach doesn't have pointer-events issue)"

requirements-completed: [UX-02, UX-03, UX-04, UX-06]

# Metrics
duration: 6min
completed: 2026-05-14
---

# Phase 3 Plan 03: Data Sources Component Library Summary

**5-component Aura-conform library — StatusPill/DataSourceRow/DataSourceSection/GemeentePicker/DataSourcesEmptyState — fully typed with data-* attributes for Storybook plays in 03-04**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-14T18:30:08Z
- **Completed:** 2026-05-14T18:36:23Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created 5 components under `frontend/src/components/settings/data-bronnen/` (5 files, 379 total lines, all under 300 each)
- All components use verbatim Aura tokens per 03-CONTEXT.md — no rogue Tailwind defaults
- DataSourceRow wires refresh mutation + animate-spin pending state + upload deep-link to beleid-beheer
- GemeentePicker uses isolated `layoutId="gemeente-picker"` with framer-motion Spring(380,30) — separate from SettingsTabNav scope
- DataSourcesEmptyState with MapPin(48) icon, verbatim NL copy, 2 CTAs (primary Link + secondary anchor)
- Created `ui/Tooltip.tsx` using project CSS group/group-hover convention (no Radix dependency needed)

## Task Commits

1. **Task 1: StatusPill component** - `8a5643d1` (feat)
2. **Task 2: DataSourceRow + DataSourceSection** - `b365a639` (feat)
3. **Task 3: GemeentePicker + DataSourcesEmptyState** - `daeb6654` (feat)

## Files Created/Modified
- `frontend/src/components/settings/data-bronnen/StatusPill.tsx` (56 lines) — 4-variant status pill with broken-state tooltip
- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` (169 lines) — Pure Glass card row with refresh mutation wiring
- `frontend/src/components/settings/data-bronnen/DataSourceSection.tsx` (37 lines) — section header + count chip
- `frontend/src/components/settings/data-bronnen/GemeentePicker.tsx` (65 lines) — horizontal pill-tab strip with status-dots
- `frontend/src/components/settings/data-bronnen/DataSourcesEmptyState.tsx` (52 lines) — gemeente-level empty state
- `frontend/src/components/ui/Tooltip.tsx` (42 lines) — reusable tooltip wrapper (project convention)

## Decisions Made
- **No Radix Tooltip**: `@/components/ui/tooltip` does not exist in this project (confirmed via grep + TeamAttributionBadge comment). Created `ui/Tooltip.tsx` using project's established CSS `group/group-hover` pattern instead. Tooltip works with disabled buttons because CSS hover doesn't have pointer-events blocking issues (no `<span tabIndex={0}>` hack needed).
- **motion layoutId isolation**: `layoutId="gemeente-picker"` is explicitly separate from `"settings-tab"` used in SettingsTabNav, preventing cross-component animation interference.
- **Upload as Link not button**: When action is `upload` and enabled, render as TanStack Router Link to `/instellingen/beleid-beheer` (interim deep-link per 03-CONTEXT.md §12 until S04 adds modal in-place).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created ui/Tooltip.tsx before StatusPill/DataSourceRow**
- **Found during:** Task 1 (StatusPill creation)
- **Issue:** Plan referenced `@/components/ui/tooltip` with Radix/shadcn exports (TooltipProvider, Tooltip, TooltipContent, TooltipTrigger) but this file does not exist in the project. The project uses CSS group/group-hover tooltips per TeamAttributionBadge.tsx comment: "NOT shadcn — @/components/ui/tooltip does not exist in this project."
- **Fix:** Created `frontend/src/components/ui/Tooltip.tsx` using the project's existing tooltip pattern (CSS group + group-hover + portal). All tooltip usage in StatusPill and DataSourceRow updated to use this wrapper.
- **Files modified:** `frontend/src/components/ui/Tooltip.tsx` (new), `frontend/src/components/settings/data-bronnen/StatusPill.tsx`, `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx`
- **Verification:** `npm run check` passes, no new TypeScript errors
- **Committed in:** `8a5643d1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical dependency)
**Impact on plan:** Tooltip functionality fully preserved. CSS approach avoids Radix dependency and is consistent with project convention. No scope creep.

## Issues Encountered
- TS2322 errors for `/instellingen/data-bronnen` and `/instellingen/data-bronnen/$gemeenteCode` routes are pre-existing (SettingsTabNav from 03-02, GemeentePicker here) — routes land in 03-04. Explicitly noted as acceptable in plan spec.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 03-04 (routes + Storybook plays) imports all 5 components from `@/components/settings/data-bronnen/`
- Route `instellingen.data-bronnen.$gemeenteCode.tsx` resolves the TS2322 errors currently on GemeentePicker
- All `data-*` attributes exposed: Storybook plays can query `data-status`, `data-action`, `data-enabled`, `data-active`, `data-gemeente-code`
- Refresh mutation test: `data-action="refresh"` + `data-enabled="true"` selector identifies the refresh button

---
*Phase: 03-data-sources-ux*
*Completed: 2026-05-14*
