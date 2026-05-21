---
phase: 08-brk-fase-2-wire-up
plan: 04
subsystem: scoring-frontend-wireup + regression-suite
tags: [m050, brk, score-v3, factor-labels, regression-critical, drift-detection]
one_liner: "Wire 3 BRK risico factors into RisicoLayer FACTOR_LABELS + paired iron-rule regression tests (25-factor registry shape pinned on backend + frontend coverage pinned on frontend)"
dependency_graph:
  requires:
    - backend/app/services/score_v3.py FACTOR_REGISTRY (25 factors, 3 BRK shipped by 03-02)
    - backend/app/services/score_v3_factors.py (BRK factor functions shipped by 03-02)
    - frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx (FactorCard auto-renders)
  provides:
    - Frontend FACTOR_LABELS + formatFactorValue extension for 3 BRK keys (auto-render via FactorCard lookup)
    - Backend regression test pinning FACTOR_REGISTRY shape (count==25, key enumeration, BRK drift-canary, weight sum-guards)
    - Frontend regression test pinning FACTOR_LABELS coverage (12 score-card risico keys) + 4-env-path coverage + format behavior (12 tests)
    - Minimal vitest 'unit' project (node env) alongside existing Storybook project
  affects:
    - Phase-8 fase-1 RisicoLayer rendering (3 new BRK cards auto-appear after rescore)
    - Future M0xx slices: any backend factor rename now breaks backend regression test FIRST (canary)
tech_stack:
  added:
    - vitest 'unit' project (node environment, alongside existing Storybook project)
    - npm script 'vitest' (runs unit project only)
  patterns:
    - Parallel backend+frontend regression tests with hardcoded KNOWN_25_FACTOR_KEYS lists
    - Drift-detection iron-rule (per MEMORY.md feedback_iron_rule_regression_pattern)
    - Pure-logic vitest tests for non-rendering coverage; Storybook play functions for rendering tests (project convention)
key_files:
  created:
    - backend/tests/regression/test_score_v3_registry_25_factors.py
    - frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx
  modified:
    - frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx (FACTOR_LABELS + formatFactorValue extended, both exported)
    - frontend/vite.config.ts (added 'unit' vitest project)
    - frontend/package.json (added 'vitest' npm script)
decisions:
  - "FACTOR_LABELS scope honestly documented: 12 score-card risico keys (9 pre-M050 + 3 BRK). 4 env keys (natura2000, overstromingsrisico, geluid, luchtkwaliteit) intentionally render via deriveEnvCards inline strings — NOT moved to FACTOR_LABELS (out of plan scope; would touch env path)."
  - "Backend regression list = frozenset, frontend = readonly array — same 25 keys, kept in sync manually via paired source-of-truth comments in both files."
  - "BRK drift-canary test pins exact label strings (HYPOTHEEK / EIGENDOMSCOMPL. / KOOPWAARDE) — any UI-label rename also breaks CI."
  - "eigendoms_complexiteit handles both dict (n_owners) AND legacy string waarde — defensive against backend evolution; covered by 2 tests."
  - "hypotheek_risico formatter uses object-form check (n_with_hypotheek > 0) in addition to legacy bool/'Ja' string checks — defensive matching backend waarde dict shape from score_v3_factors.py:1463."
  - "koopwaarde_trend dict has koopjaar + age_jaar + koopsom — formatter reads koopjaar + koopsom, age_jaar ignored (sub-line uses currency, not age)."
  - "Vitest 'unit' project added in node env (no jsdom, no @testing-library/react). Pure-logic tests only — call formatFactorValue + FACTOR_LABELS directly. Aligns with project convention: 'Storybook = convergence smoke layer'."
metrics:
  duration: "9m"
  tasks_completed: 2
  files_changed: 5
  tests_added: 18 (6 backend pytest + 12 frontend vitest)
  completed_date: "2026-05-19"
---

# Phase 08 Plan 04: BRK Wire-Up RisicoLayer Summary

## One-liner

Extended RisicoLayer.tsx FACTOR_LABELS + formatFactorValue to auto-render the 3 BRK risico factors that backend M050/S03 already ships, paired with iron-rule regression tests (6 backend + 12 frontend) that pin the 25-factor registry shape + FACTOR_LABELS coverage so any future rename breaks CI before frontend silently rots.

## What Was Built

### Task 1 — RisicoLayer.tsx FACTOR_LABELS + formatFactorValue extension (commit f55ff993)

**3 entries added to FACTOR_LABELS:**
- `hypotheek_risico: 'HYPOTHEEK'`
- `eigendoms_complexiteit: 'EIGENDOMSCOMPL.'`
- `koopwaarde_trend: 'KOOPWAARDE'`

**3 cases added to formatFactorValue switch:**
- `hypotheek_risico`: reads `factor.waarde.n_with_hypotheek` (backend dict shape from score_v3_factors.py:1463) plus legacy bool/'Ja' string compatibility → 'Ja' / 'Nee' value, sub describes hypotheek status.
- `eigendoms_complexiteit`: reads `factor.waarde.n_owners` (1 → 'Enkelvoudig', 2 → 'Gedeeld', ≥3 → 'Complex') with fallback to legacy capitalized string.
- `koopwaarde_trend`: reads `factor.waarde.koopjaar` + `koopsom`, renders koopjaar as value + nl-NL EUR currency-formatted koopsom as sub.

Both FACTOR_LABELS and formatFactorValue exported as named exports for test consumption.

**Net effect:** 9 → 12 FACTOR_LABELS entries on risico surface. The 3 BRK factors auto-render via the existing FactorCard component — no FactorCard modification needed (per plan's auto-render assumption, verified by reading FactorCard.tsx + RisicoLayer.tsx scoreCards build path lines 320-360).

### Task 2 — Paired iron-rule regression tests (commit 34f9b54a)

**Backend** (`backend/tests/regression/test_score_v3_registry_25_factors.py`, 6 tests):
- `test_registry_count_is_25`
- `test_registry_keys_match_known_set` — exact set equality
- `test_all_factors_have_valid_category`
- `test_brk_factors_present` — drift canary
- `test_potentie_weights_sum_100` — registry invariant
- `test_risico_weights_sum_100` — registry invariant (M050/S03 D2)

**Frontend** (`frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx`, 12 tests):
- `known factor count is 25`
- `FACTOR_LABELS covers 12 score-card risico keys`
- `FACTOR_LABELS + env path together cover all 16 risico keys`
- `M050/S03 BRK keys are in FACTOR_LABELS (drift canary)` — pins exact label strings
- 5x formatFactorValue rendering tests (hypotheek Ja/Nee, eigendoms 1/3-owners, legacy-string, koopwaarde dict + null)
- 1x eigendoms legacy-string fallback
- 1x unknown factor key default fallback (no crash)

**Drift-detection mechanism:** Both files hardcode the same 25-key list (frontend as readonly array, backend as frozenset). A future rename of e.g. `hypotheek_risico` → `eigendom_hypotheek`:
1. Backend test `test_registry_keys_match_known_set` fails IMMEDIATELY (red CI).
2. Forces developer to update both KNOWN lists + FACTOR_LABELS in lockstep before merge.

Without the backend canary, the frontend list could silently rot (key removed from backend, frontend list stale, FactorCard would render uppercased fallback 'EIGENDOM_HYPOTHEEK' with no test failure).

### Vitest infrastructure (added in Task 2)

The project had no standalone vitest setup — only `@storybook/addon-vitest` for Storybook play functions in browser mode. The plan's path (`__tests__/RisicoLayer.factor-coverage.test.tsx`) and `npm run vitest -- ...` command implicitly assumed a standard vitest project existed. **Rule 3 (blocking) auto-fix:**
- Added a second vitest project named `unit` (node env) in `frontend/vite.config.ts`, alongside the existing `storybook` project.
- Added `npm run vitest` script that runs only the `unit` project.
- Globs only `src/**/__tests__/**/*.test.ts(x)` so it doesn't pick up `.stories.tsx` files.

This keeps the project's convention intact ("Storybook = convergence smoke layer per MEMORY.md") — Storybook stays the React-rendering test surface; the new `unit` project only handles pure-logic regression tests like this 25-factor pin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest had no standalone unit-test project**

- **Found during:** Task 2 setup
- **Issue:** Plan acceptance criteria specified `cd frontend && npm run vitest -- ...` but no `vitest` npm script existed and the only vitest project was `@storybook/addon-vitest` (browser mode for Storybook stories). The path `__tests__/RisicoLayer.factor-coverage.test.tsx` would not be picked up by anything.
- **Fix:** Added a minimal `unit` project to vite.config.ts (node environment) globbing `src/**/__tests__/**/*.test.ts(x)`, plus a `vitest` npm script (`vitest --project unit`).
- **Files modified:** `frontend/vite.config.ts`, `frontend/package.json`
- **Commit:** 34f9b54a
- **Why not Rule 4 (architectural):** This is a tooling enable — does not change application architecture, dependencies, or test conventions. The new project sits side-by-side with the existing Storybook project; project's "Storybook = convergence smoke layer" convention is preserved (Storybook still owns React rendering tests; vitest unit project only does pure-logic tests).

**2. [Rule 1 — Bug in plan-spec assumption] FACTOR_LABELS does not cover env keys**

- **Found during:** Task 2 first test run (test `all 16 risico factor keys have a FACTOR_LABELS entry` failed with `FACTOR_LABELS missing entry for risico key 'natura2000'`).
- **Issue:** Plan assumed FACTOR_LABELS is THE single lookup for all risico factor labels. Reality: RisicoLayer.tsx has TWO rendering paths — `RISICO_KEYS` score-card path uses FACTOR_LABELS (9 pre-M050 + 3 BRK = 12 keys), and `deriveEnvCards()` uses inline label strings for 4 env keys (natura2000, overstromingsrisico, geluid, luchtkwaliteit). FACTOR_LABELS was never meant to cover all 16 risico factors.
- **Fix:** Made the frontend regression test honest about both paths. Added 2 separate lists in the test (`FACTOR_LABELS_RISICO_KEYS` = 12, `ENV_PATH_RISICO_KEYS` = 4) and asserted that their union covers all 16 ALL_RISICO_KEYS. Drift contract is now accurate to actual code structure.
- **Files modified:** `frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx`
- **Commit:** 34f9b54a
- **Decision recorded:** Moving env keys into FACTOR_LABELS + refactoring deriveEnvCards to use the lookup is out of scope (would touch env rendering path). Deferred — would be tidy-up for a future plan.

**3. [Rule 1 — Bug in plan-spec mock] Hypotheek_risico backend waarde shape mismatch**

- **Found during:** Reading score_v3_factors.py to validate test mocks.
- **Issue:** Plan-spec assumed `waarde: boolean` but backend (score_v3_factors.py:1463) returns `waarde: {n_with_hypotheek, n_total}` dict. Plan's formatFactorValue case spec checked `factor.waarde === true` which would never match real backend output.
- **Fix:** Extended formatFactorValue case to detect either legacy boolean/string OR the dict form via `n_with_hypotheek > 0`. Both paths verified by tests.
- **Files modified:** `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx`
- **Commit:** f55ff993
- **Defensive:** kept the legacy `=== true | 'ja' | 'Ja'` checks alongside dict check — non-breaking if future backend changes to bool form.

**4. [Rule 1 — Bug in plan-spec mock] Eigendoms_complexiteit waarde shape mismatch**

- **Found during:** Same as #3 — reading backend.
- **Issue:** Plan-spec assumed `waarde: string ('enkelvoudig' | 'gedeeld' | ...)` but backend returns `waarde: {n_owners}` dict (score_v3_factors.py:1508). Plan's formatFactorValue case used `v.charAt(0).toUpperCase()` on the string — would output 'undefined' or '[object Object]' from real backend.
- **Fix:** Extended formatFactorValue case to detect dict form with n_owners FIRST (deriving Enkelvoudig/Gedeeld/Complex from count), falling back to legacy string capitalization. Both paths covered by tests.
- **Files modified:** Same as #3.
- **Commit:** f55ff993

### Acceptance criterion soft-failure

- `cd frontend && npm run check` exits non-zero due to **pre-existing** TS errors (rapporten.tsx, resultaten.tsx, verkenner.tsx, ReportSidebar.stories.tsx, SideRailNav.stories.tsx). Baseline-verified pre/post change identical via `git stash` toggle — **my edits introduce ZERO new TS errors**. Per MEMORY.md decision "Pre-existing 91 TS errors baseline ... deferred to dedicated TS-strict-cleanup phase per scope-boundary policy", out of scope.

## Verification

| Check | Result |
|-------|--------|
| 25 factor labels backend (9 potentie + 13 risico-pre-M050 + 3 BRK = 25) | ✅ Backend test count==25 green |
| 3 BRK entries in FACTOR_LABELS with exact strings | ✅ Frontend drift-canary test green |
| 6 new formatFactorValue rendering cases (3 BRK × 2 paths each) | ✅ 5 rendering tests green |
| FACTOR_LABELS exported | ✅ Imported by test file successfully |
| formatFactorValue exported | ✅ Imported by test file successfully |
| Backend pytest 6/6 green | ✅ `pytest tests/regression/test_score_v3_registry_25_factors.py` exit 0 |
| Frontend vitest 12/12 green | ✅ `npm run vitest -- ... --run` exit 0 |
| Frontend test file <150 LOC | ✅ 108 LOC |
| RisicoLayer.tsx zero new TS/ESLint errors | ✅ Pre/post baseline identical |

## Decisions Made

1. **FACTOR_LABELS is the score-card path only.** Did NOT migrate env keys into FACTOR_LABELS — out of scope. Documented contract in regression test (2 paths: score-card + env).
2. **Backend test is the canary.** Backend frozenset KNOWN_25_FACTOR_KEYS exact-equality (`==`) assertion ensures a rename breaks backend FIRST. Frontend list is a separate hardcoded array kept in sync manually via paired comments referencing each other.
3. **Defensive formatters.** All 3 BRK cases handle both the actual backend dict shape (verified via score_v3_factors.py source-read) AND the legacy primitive shape from the plan-spec. Future backend evolution between dict and primitive is non-breaking.
4. **Vitest 'unit' project, not jsdom-based.** Pure-logic tests only. React rendering tests stay in Storybook (project convention). No new dependencies, no @testing-library/react install.
5. **eigendoms_complexiteit n_owners=2 → 'Gedeeld' label**. Project's frontend distinguishes 2-owner from 3+-owner cases (2 = 'Gedeeld', ≥3 = 'Complex'). Backend score also has 3 buckets (0.0/0.5/1.0) at n=1/2/≥3 boundary.

## Self-Check: PASSED

**Files exist:**
- ✅ `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` (modified)
- ✅ `frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx` (created)
- ✅ `backend/tests/regression/test_score_v3_registry_25_factors.py` (created)
- ✅ `frontend/vite.config.ts` (modified)
- ✅ `frontend/package.json` (modified)

**Commits exist:**
- ✅ f55ff993 (Task 1: RisicoLayer extension)
- ✅ 34f9b54a (Task 2: paired regression tests + vitest infra)

**Tests pass:**
- ✅ Backend 6/6 (`pytest tests/regression/test_score_v3_registry_25_factors.py`)
- ✅ Frontend 12/12 (`npm run vitest -- ... --run`)

## Follow-ups

- **Backlog (out of scope):** Consider folding env keys into FACTOR_LABELS + refactoring deriveEnvCards to use lookup. Today the env labels live inline; tomorrow's tidy-up could unify them with the score-card path.
- **Backlog (out of scope):** TS-strict-cleanup phase for the 91 pre-existing TS errors (rapporten/resultaten/verkenner/stories). Tracked in M049/S07 plan decisions — already a known dedicated phase target.
- **Pre-existing eslint warnings on RisicoLayer.tsx** (5 problems on lines 432-438) are pre-existing, untouched, out of scope.
