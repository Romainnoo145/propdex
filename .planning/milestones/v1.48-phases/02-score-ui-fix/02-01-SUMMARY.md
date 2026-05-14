---
phase: 02-score-ui-fix
plan: "01"
subsystem: ui
tags: [react, typescript, score-breakdown, framer-motion, org-weights]

# Dependency graph
requires: []
provides:
  - ScoreBreakdownModal accepts potentieRisicoBalance prop (0.0-1.0) and renders live balance percentages
  - ScoreFactor interface includes percentage_of_category for M047 scan data
  - FactorCard shows percentage_of_category label instead of raw gewicht integer
affects:
  - 02-score-ui-fix/02-02 (woonvisie popup, same modal area)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prop-driven balance display: potentieRisicoBalance passed from parent, modal never calls hooks internally"
    - "Inline style flex values for dynamic Tailwind flex splits (flex-[N] template literals don't work with dynamic values)"
    - "percentage_of_category mapped with typeof guard in parseFactors() — null for pre-M047 scans, no gewicht fallback"

key-files:
  created: []
  modified:
    - frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx
    - frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx

key-decisions:
  - "potentieRisicoBalance as required prop on ScoreBreakdownModal — modal never reads org config internally"
  - "No fallback from percentage_of_category to gewicht/100 — pre-M047 scans render no label (null silently hides)"
  - "Dynamic flex via inline style={{ flex: N }} not Tailwind flex-[N] class (runtime values not purged)"

patterns-established:
  - "Dynamic flex ratios: use style={{ flex: value }} for computed values, not Tailwind template literals"
  - "Pre-M047 compatibility: typeof guard on percentage_of_category, null = no label, no fallback"

requirements-completed:
  - SCORE-01
  - SCORE-02
  - SCORE-03

# Metrics
duration: 11min
completed: 2026-04-22
---

# Phase 02 Plan 01: Score UI Fix — Balance + Factor Percentage Summary

**ScoreBreakdownModal wired to live org balance via prop injection; factor rows now show percentage_of_category instead of raw gewicht integer**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-22T19:10:59Z
- **Completed:** 2026-04-22T19:13:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `potentieRisicoBalance: number` prop to `ScoreBreakdownModal` — balance display is now driven by the org-configured value (default 0.7 = 70%/30%), not hardcoded 60%/40%
- Added `percentage_of_category: number | null` to `ScoreFactor` interface and `parseFactors()` mapping — consumes M047 pipeline output correctly
- Replaced `×{factor.gewicht}` integer label in `FactorCard` with `{Math.round(factor.percentage_of_category * 100)}%` — null for pre-M047 scans silently hides the label

## Task Commits

Each task was committed atomically:

1. **Task 1: Add potentieRisicoBalance prop — replace hardcoded balance display** - `9cae75f` (feat)
2. **Task 2: Add percentage_of_category to ScoreFactor — replace ×gewicht label** - `ee4fb7e` (feat)

## Files Created/Modified

- `frontend/src/components/map/panels/parcel/ScoreBreakdownModal.tsx` — Added `potentieRisicoBalance` prop + derived `potentiePct`/`risicoPct`; added `percentage_of_category` to `ScoreFactor`; updated `parseFactors()`; replaced hardcoded balance blocks and `×gewicht` label
- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` — Added `potentieRisicoBalance={weightsData?.weights.potentie_risico_balance ?? 0.7}` to `<ScoreBreakdownModal>` call site

## Decisions Made

- Used `style={{ flex: potentiePct }}` instead of Tailwind `flex-[N]` template literals — dynamic values are not statically analyzable by Tailwind's JIT purging
- No fallback from `percentage_of_category` to `gewicht / 100` when null — research doc explicitly warns against this; pre-M047 scans render no label, which is correct behavior
- `potentieRisicoBalance` defaulted to `0.7` (matching `DEFAULT_WEIGHTS.potentie_risico_balance`) when `weightsData` is undefined

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (`BeleidscontextCard.tsx`, `BottomTabNav.tsx`, `WijkMapPanel.tsx`, routes) caused `npm run check` to exit non-zero. These are out of scope per deviation rule scope boundary. The two modified files have zero TypeScript errors (confirmed via `tsc -b --noEmit 2>&1 | grep ScoreBreakdownModal|ParcelBentoOverview` returning no output).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SCORE-01, SCORE-02, SCORE-03 all satisfied
- `ScoreBreakdownModal` is now a clean, prop-driven component — no internal hook calls
- Ready for Phase 02 Plan 02 (Woonvisie popup on kaart 10 click)

---
*Phase: 02-score-ui-fix*
*Completed: 2026-04-22*
