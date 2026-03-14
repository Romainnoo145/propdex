---
phase: 108-score-customization
plan: 03
subsystem: frontend
tags: [scoring, score-v3, custom-weights, settings-ui, presets, react]

# Dependency graph
requires:
  - phase: 108-02
    provides: GET/PUT /api/users/org/score-weights endpoints, rescore_weights ARQ job

provides:
  - /instellingen/score route with full score customization UI
  - ScoreSection orchestrator component (preset select + balance slider + 2 factor tables + save+poll)
  - PresetCards: 4 preset selection cards (2x2 grid)
  - BalanceSlider: native range input for potentie/risico balance
  - FactorTable: reusable toggle+weight-dropdown table (8 potentie + 13 risico factors)
  - useScoreWeights.ts: extended with useSaveScoreWeights mutation + useRescoreJobStatus polling
  - scoreWeights.ts types: ScoreWeightsConfig, response/request types, POTENTIE_FACTORS, RISICO_FACTORS, DEFAULT_WEIGHTS, PRESETS
  - SettingsTabNav: pill tab nav (Account | Score profiel) on both settings pages

affects:
  - 108-04 (map parcel detail panel can read is_custom flag from useOrgScoreWeights)
  - /instellingen route (tab nav added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ScoreForm inner component pattern: parent loads data, child receives as prop and owns form state — avoids setState-in-useEffect (React Compiler compatible)"
    - "key prop reset: ScoreSection passes key={loadedData?.weights.preset} to ScoreForm, forcing remount when server data changes"
    - "useRescoreJobStatus refetchInterval: stops polling when status === complete | failed using query state data"
    - "SettingsTabNav: useMatchRoute() for active state, Link component for navigation"
    - "prettier-ignore comment on preset data array to allow compact inline format under 300-line limit"

key-files:
  created:
    - frontend/src/lib/types/scoreWeights.ts
    - frontend/src/hooks/useScoreWeights.ts (extended from stub in 108-02)
    - frontend/src/routes/_authenticated/instellingen.score.tsx
    - frontend/src/components/settings/SettingsTabNav.tsx
    - frontend/src/components/settings/ScoreSection.tsx
    - frontend/src/components/settings/PresetCards.tsx
    - frontend/src/components/settings/BalanceSlider.tsx
    - frontend/src/components/settings/FactorTable.tsx
  modified:
    - frontend/src/routes/_authenticated/instellingen.tsx

key-decisions:
  - "ScoreForm inner pattern avoids useState-in-useEffect React Compiler error: outer ScoreSection handles loading, inner ScoreForm initializes from prop"
  - "key prop remount strategy: ScoreSection wraps ScoreForm with key=loadedData?.weights.preset so fresh server data resets all form state cleanly"
  - "FactorTable toggle: unchecked sets weight to 0, checked restores from DEFAULT_WEIGHTS for that category"
  - "BalanceSlider uses native range input with inline gradient style for filled track (CSS vars not supported in range track pseudo-elements)"

requirements-completed: [SC-08, SC-09]

# Metrics
duration: 9min
completed: 2026-03-14
---

# Phase 108 Plan 03: Score Settings UI Summary

**Score customization settings page at /instellingen/score with 4 preset cards, potentie/risico balance slider, 8+13 factor toggle tables, and save+rescore polling with impact preview**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-14T05:17:01Z
- **Completed:** 2026-03-14T05:26:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created complete TypeScript type set: ScoreWeightsConfig, ScoreWeightsResponse, SaveScoreWeightsRequest, RescoreJobStatus, FactorMeta, PresetDef, plus POTENTIE_FACTORS (8 factors) and RISICO_FACTORS (13 factors) arrays with Dutch labels, DEFAULT_WEIGHTS, and 4 PRESETS
- Extended useScoreWeights.ts: added useSaveScoreWeights mutation (PUT + query invalidation) and useRescoreJobStatus polling hook (2s interval, auto-stops on complete/failed)
- Created /instellingen/score route (flat file dot notation, TanStack Router)
- Created SettingsTabNav component using useMatchRoute() for active state detection
- Added SettingsTabNav to /instellingen and /instellingen/score pages
- Created PresetCards: 2x2 grid with amber border+ring on active, clicking propagates full config to parent
- Created BalanceSlider: native range input (0-100 step 5) mapped to 0.0-1.0, inline gradient for filled track
- Created FactorTable: toggle checkbox (off=weight 0, on=default weight restored), weight 1-10 dropdown, disabled+opacity when off, min-active validation warning
- Created ScoreSection: outer loading shell + ScoreForm inner component with complete form state management, save+poll+impact preview grid

## Task Commits

1. **Task 1: Types, hooks, route scaffolding** - `5c8351e` (feat)
2. **Task 2: ScoreSection, PresetCards, BalanceSlider, FactorTable** - `0672e92` (feat)
3. **Types compaction** - `05b55dc` (refactor)

## Files Created/Modified

- `frontend/src/lib/types/scoreWeights.ts` — 244 lines, all type definitions + preset data
- `frontend/src/hooks/useScoreWeights.ts` — 100 lines, 3 hooks
- `frontend/src/routes/_authenticated/instellingen.score.tsx` — 23 lines, route component
- `frontend/src/components/settings/SettingsTabNav.tsx` — 46 lines
- `frontend/src/components/settings/ScoreSection.tsx` — 241 lines
- `frontend/src/components/settings/PresetCards.tsx` — 42 lines
- `frontend/src/components/settings/BalanceSlider.tsx` — 43 lines
- `frontend/src/components/settings/FactorTable.tsx` — 102 lines
- `frontend/src/routes/_authenticated/instellingen.tsx` — added SettingsTabNav import + render

## Decisions Made

- ScoreForm inner component pattern: outer ScoreSection handles loading state, passes loaded weights as prop to ScoreForm child — ScoreForm initializes useState from prop once. Avoids useState-in-useEffect which the React Compiler ESLint plugin flags as error.
- key prop remount: `key={loadedData?.weights.preset}` on ScoreForm forces clean remount when server data changes (e.g. after save+invalidate returns new data).
- FactorTable restore-to-default on re-enable: reads DEFAULT_WEIGHTS for the factor's category rather than storing a "previous value" — simpler and predictable.
- BalanceSlider uses inline `background` style for gradient fill because CSS pseudo-element `::webkit-slider-runnable-track` cannot be styled via Tailwind class attribute.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React Compiler error: setState in useEffect**
- **Found during:** Task 2 npm run check
- **Issue:** `ScoreSection` initialized form state via `useEffect(() => { setFormState(data); setIsDirty(false) }, [data])` — React ESLint plugin reports "Calling setState synchronously within an effect can trigger cascading renders"
- **Fix:** Refactored to ScoreForm inner component pattern — outer component handles loading gate, inner ScoreForm receives `initialConfig` as prop and uses it as `useState` initializer (runs once at mount)
- **Files modified:** `frontend/src/components/settings/ScoreSection.tsx`
- **Commit:** Included in `0672e92`

**2. [Rule 1 - Bug] React Compiler error: ref access during render**
- **Found during:** Task 2 intermediate fix attempt
- **Issue:** Tried `useRef` + `if (ref.current)` pattern as alternative — React Compiler also flags ref.current access during render
- **Fix:** Abandoned ref approach, used ScoreForm child component pattern instead (cleaner)
- **Files modified:** `frontend/src/components/settings/ScoreSection.tsx`
- **Commit:** Included in `0672e92`

**3. [Rule 1 - Bug] TypeScript strict: PRESETS[0] possibly undefined**
- **Found during:** Task 2 type check
- **Issue:** `PRESETS[0].config` flagged as possibly undefined with `noUncheckedIndexedAccess`
- **Fix:** Changed fallback to `DEFAULT_WEIGHTS` instead of `PRESETS[0].config`
- **Files modified:** `frontend/src/components/settings/ScoreSection.tsx`
- **Commit:** Included in `0672e92`

## Self-Check: PASSED

All created files confirmed on disk. All 3 commits verified in git history.

---
*Phase: 108-score-customization*
*Completed: 2026-03-14*
