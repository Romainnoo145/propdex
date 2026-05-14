---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: 03
subsystem: ui
tags: [tanstack-query, typescript, fastapi, sqlalchemy, factor-registry, pagination]

# Dependency graph
requires:
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-01
    provides: Test stubs (test_factor_registry_bron_field.py) as TDD RED drivers
provides:
  - "Bron Literal type + bron field on FactorRegistryEntry (backend, metadata-only)"
  - "FACTOR_BRON mapping for all 22 registry entries + UI-derived capaciteit"
  - "frontend/src/lib/factor-groups.ts with Bron, BRON_ORDER, BRON_LABEL, FACTOR_BRON, buildPages, CARDS_PER_PAGE"
  - "frontend/src/hooks/useFactorPins.ts with optimistic TanStack Query mutations + max-6 toast guard"
affects:
  - "07-04 (PotentieLayer + RisicoLayer refactor — consumes buildPages + useFactorPins)"
  - "07-05 (Storybook stories — uses useFactorPins + buildPages via QueryClient pre-seed)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: test stub created in Wave 0 (Plan 01), implementation drives test to green in Plan 03"
    - "Bron as Literal type alias in Python (not Enum) — matches Literal pattern of existing FactorRegistryEntry.category"
    - "FACTOR_BRON Record<string, Bron> as frontend mirror of backend registry.bron — explicit sync contract"
    - "buildPages pure function — takes allCards + pins, returns BuiltPage[] with pinned synth-page first"
    - "useFactorPins optimistic mutation: onMutate snapshots cache, onError rolls back, onSettled invalidates"

key-files:
  created:
    - "frontend/src/lib/factor-groups.ts"
    - "frontend/src/hooks/useFactorPins.ts"
  modified:
    - "backend/app/services/score_v3.py"

key-decisions:
  - "criminaliteit mapped to 'markt' (not 'sociaal') — avoids expanding the 6-value Bron enum; closest fit since marketability is affected by criminaliteit"
  - "capaciteit mapped to 'fysiek' inline in FACTOR_BRON — it is UI-only (derived from building_metrics), NOT in backend FACTOR_REGISTRY; documented with comment"
  - "bron field is REQUIRED on FactorRegistryEntry (no default) — module-load assertion is the safety net; forces explicit thought when adding factors"
  - "apiFetch<void> for DELETE works correctly — api.ts returns undefined as T on 204"

patterns-established:
  - "FACTOR_BRON Record as single source of truth for frontend bron-groep assignments"
  - "buildPages() builder pattern: allCards + pins → BuiltPage[] with page 0 always pinned/top-6"
  - "useFactorPins(category) follows useScoreWeights pattern exactly (useQuery + useMutation + optimistic)"

requirements-completed: [GROUP-01, GROUP-02, UI-01, PIN-01, PIN-03]

# Metrics
duration: 22min
completed: 2026-04-26
---

# Phase 7 Plan 03: Factor Groups Foundations Summary

**Backend FactorRegistryEntry extended with required `bron` field (22 entries mapped) + frontend factor-groups module (buildPages helper, 23-key FACTOR_BRON) + useFactorPins TanStack Query hook with optimistic mutations and client-side max-6 toast guard**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-26T13:53:17Z
- **Completed:** 2026-04-26T14:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 backend + 2 frontend new)

## Accomplishments
- Extended `FactorRegistryEntry` with required `bron: Bron` field (metadata-only, no scoring impact); all 22 registry entries assigned; Plan 01 stub test fully green (3/3 tests)
- Created `frontend/src/lib/factor-groups.ts` with complete bron mapping (23 keys including UI-derived `capaciteit → fysiek`), `buildPages()` pure function implementing pinned synth-page + group pages logic, and `CARDS_PER_PAGE = 6` constant
- Created `frontend/src/hooks/useFactorPins.ts` with optimistic add/remove mutations, client-side max-6 guard firing `toast('⭐ Max 6 bereikt')` before POST, and `isPinned()` helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bron field to FactorRegistryEntry + assign to all 22 entries** - `7ec1b6ec` (feat)
2. **Task 2: Create frontend factor-groups.ts module + useFactorPins hook** - `e2851a2b` (feat)

## Files Created/Modified
- `backend/app/services/score_v3.py` - Added `Bron` Literal type alias + `bron: Bron` field on `FactorRegistryEntry`; assigned bron to all 22 FACTOR_REGISTRY entries
- `frontend/src/lib/factor-groups.ts` - NEW: Bron type, BRON_ORDER, BRON_LABEL, FACTOR_BRON (23 keys), PageCard/PinLike/BuiltPage interfaces, CARDS_PER_PAGE=6, buildPages() helper
- `frontend/src/hooks/useFactorPins.ts` - NEW: useFactorPins(category) TanStack Query hook with optimistic mutations + max-6 toast guard

## Decisions Made
- `criminaliteit` → `'markt'` (Open Question 4): avoiding expanding Bron enum to add `'sociaal'` — marketability is affected by criminaliteit, closest fit
- `capaciteit` → `'fysiek'` as UI-only special case: it is derived from `building_metrics` in PotentieLayer, NOT a backend registry factor; documented in FACTOR_BRON with comment
- `bron` chosen as field name (over `groep`/`thema`/`subcategory`) — short, NL, semantic, preferred per CONTEXT
- `apiFetch<void>` for DELETE confirmed safe — api.ts already handles 204 with `return undefined as T`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test stub file already existed from Plan 01**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Plan 03 was supposed to read `test_factor_registry_bron_field.py` as if it was a read_first reference, but Plan 01 had already created it. Test file was already in RED state.
- **Fix:** Proceeded directly to GREEN implementation using the existing stub — no new test file needed.
- **Files modified:** None (deviation was benign)
- **Verification:** Tests ran RED before implementation, GREEN after
- **Committed in:** N/A (no files changed)

---

**Total deviations:** 1 (Plan 01 already executed its Wave 0 stub creation)
**Impact on plan:** No impact — benign discovery, execution proceeded as planned.

## Issues Encountered
- Pre-existing backend test failures: `test_user_factor_pin_model.py`, `test_factor_pins_router.py`, `test_user_factor_pins_migration.py` — these are Wave 0 stubs from Plan 01 that import modules not yet created (Plan 02 target). Expected failures, excluded from regression check.
- Pre-existing frontend TypeScript errors (91 errors in unrelated files like `verkenner.tsx`, `BottomTabNav.tsx`, stories) — predated this plan, none in our new files.
- `test_chat_endpoint.py::test_chat_unsupported_intent` — pre-existing OpenRouter API credits issue, unrelated to our changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (PotentieLayer + RisicoLayer refactor) can proceed: `buildPages()` and `useFactorPins(category)` are available as imports
- Plan 05 (Storybook stories) can proceed: `useFactorPins` + `buildPages` ready for QueryClient pre-seed mock pattern
- Plan 02 (backend model + migration + router) is unblocked: the `bron` field is already on the registry, no further registry changes expected

---
*Phase: 07-factor-pinning-groep-pages-6-cards-per-page*
*Completed: 2026-04-26*
