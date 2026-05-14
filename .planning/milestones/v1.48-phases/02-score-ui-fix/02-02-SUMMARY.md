---
phase: 02-score-ui-fix
plan: 02
subsystem: testing
tags: [storybook, vitest, play-functions, regression-tests, score-breakdown]

requires:
  - phase: 02-01
    provides: ScoreBreakdownModal with potentieRisicoBalance prop and percentage_of_category rendering

provides:
  - Storybook stories with play assertions for TEST-02 and TEST-03
  - Regression protection for balance prop derivation (not hardcoded)
  - Regression protection for percentage_of_category label (not ×gewicht)

affects: [02-score-ui-fix, future ScoreBreakdownModal changes]

tech-stack:
  added: []
  patterns:
    - "storybook/test (not @storybook/test) — correct import path for Storybook 10"
    - "within(document.body) for portal-rendered components — createPortal escapes canvasElement scope"

key-files:
  created:
    - frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx
  modified: []

key-decisions:
  - "Import from 'storybook/test' not '@storybook/test' — Storybook 10 changed the package path"
  - "Query via within(document.body) not within(canvasElement) — modal uses createPortal which renders outside canvasElement"

patterns-established:
  - "Portal-rendered modals: use within(document.body) in play functions"
  - "Storybook 10 test imports: storybook/test (not @storybook/test)"

requirements-completed: [TEST-02, TEST-03]

duration: 4min
completed: 2026-04-22
---

# Phase 02-score-ui-fix Plan 02: Storybook regression stories for ScoreBreakdownModal Summary

**5 Storybook stories with vitest play assertions verifying potentieRisicoBalance prop-driven balance display (TEST-02) and percentage_of_category rendering as X% not x-gewicht (TEST-03)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-22T19:14:42Z
- **Completed:** 2026-04-22T19:19:11Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments
- Created `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` with 5 stories and play assertions
- TEST-02 coverage: BalanceFromProp60_40, BalanceFromProp70_30, BalanceFromProp50_50 — each asserts different % values from prop
- TEST-03 coverage: FactorPercentageDisplay asserts '13%' visible and no '×\d+' pattern present; FactorNullPercentage asserts no weight label for pre-M047 null
- All 5 stories pass vitest browser tests (chromium)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ScoreBreakdownModal.stories.tsx with play assertions** - `00a5c3a` (test)

**Plan metadata:** see final commit below

## Files Created/Modified
- `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` - 5 stories with play assertions for TEST-02 and TEST-03

## Decisions Made
- Import from `storybook/test` (not `@storybook/test`) — Storybook 10 reorganized the package path; `@storybook/test` does not exist in this project
- Use `within(document.body)` in play functions — `ScoreBreakdownModal` renders via `createPortal` into `document.body`, making `canvasElement` queries return an empty div with nothing to assert

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong import path for storybook test utilities**
- **Found during:** Task 1 (verification run)
- **Issue:** Plan specified `from '@storybook/test'` but Storybook 10 ships this at `storybook/test` — TypeScript error TS2307 on first check
- **Fix:** Changed import to `from 'storybook/test'`
- **Files modified:** frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx
- **Verification:** `npm run check` shows no errors in the new file
- **Committed in:** 00a5c3a (part of task commit)

**2. [Rule 1 - Bug] Fixed play function canvas scope for portal-rendered modal**
- **Found during:** Task 1 (vitest run — all 4 play-assertion stories failed)
- **Issue:** Plan specified `within(canvasElement)` but `ScoreBreakdownModal` uses `createPortal(...)` which renders content outside `canvasElement`; all `getByText` calls returned empty
- **Fix:** Changed all play functions to query `within(document.body)` instead of `within(canvasElement)`. Also removed unused `{ canvasElement }` parameter from play signatures.
- **Files modified:** frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx
- **Verification:** All 5 stories pass vitest browser run
- **Committed in:** 00a5c3a (part of task commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — wrong import path, wrong query scope)
**Impact on plan:** Both fixes necessary for tests to run at all. No scope creep.

## Issues Encountered
- Pre-existing InspectorPanel.stories.tsx failures (4 tests, `useAuth must be used within AuthProvider`) — pre-existing, out of scope per deviation rules. Logged to deferred-items.

## Next Phase Readiness
- Phase 02 (score-ui-fix) complete — TEST-02 and TEST-03 verified by automated play assertions
- ScoreBreakdownModal changes from 02-01 are regression-protected
- Ready for phase 03 (Woonvisie Popup)

## Self-Check: PASSED
- FOUND: frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx
- FOUND: commit 00a5c3a
- FOUND: .planning/phases/02-score-ui-fix/02-02-SUMMARY.md

---
*Phase: 02-score-ui-fix*
*Completed: 2026-04-22*
