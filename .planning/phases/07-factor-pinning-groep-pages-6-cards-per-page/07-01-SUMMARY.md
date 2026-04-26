---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: "01"
subsystem: test-infrastructure
tags: [wave-0, nyquist, tdd, factor-pinning, storybook, pytest]
dependency_graph:
  requires: []
  provides: [test-stubs-backend, test-stubs-frontend, wave-0-nyquist-anchors]
  affects: [07-02, 07-03, 07-04, 07-05]
tech_stack:
  added: []
  patterns: [pytest-importerror-nyquist, storybook-inline-cache-preseed, tanstack-query-setquerydata]
key_files:
  created:
    - backend/tests/unit/test_factor_registry_bron_field.py
    - backend/tests/unit/test_user_factor_pin_model.py
    - backend/tests/integration/test_factor_pins_router.py
    - backend/tests/integration/test_user_factor_pins_migration.py
    - frontend/src/test-utils/factorPinsMock.ts
    - frontend/src/stories/parcel/RisicoLayer.stories.tsx
  modified:
    - frontend/src/stories/parcel/PotentieLayer.stories.tsx
    - .planning/phases/07-factor-pinning-groep-pages-6-cards-per-page/07-VALIDATION.md
decisions:
  - "Wave 0 Nyquist pattern: ImportError on app.models.user_factor_pin is the explicit signal driving Plan 02 implementation"
  - "pinDecorator typed as () => any to avoid JSX namespace issue in react-jsx mode (no React import needed)"
  - "factorPinsMock uses inline cache pre-seed (queryClient.setQueryData) not MSW — matching Phase 3 precedent"
  - "Story decorator includes explicit <Toaster /> for Max6Guard stories per RESEARCH pitfall #8"
  - "All Storybook imports use storybook/test (no @) per Storybook 10 path convention"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-26"
  tasks_completed: 3
  files_created: 7
  files_modified: 2
---

# Phase 07 Plan 01: Wave 0 Nyquist Test Stubs Summary

**One-liner:** Seeded 4 pytest stubs (ImportError-failing on UserFactorPin) + 11 Storybook stories + factorPinsMock TanStack Query helper as Wave 0 Nyquist anchors for Phase 7 factor-pinning implementation.

## What Was Built

Wave 0 anchors Phase 7 test infrastructure before any implementation exists. Every subsequent plan (02-05) references these files in its `<verify><automated>` block.

### Task 1: 4 Backend pytest stub files

- **`test_factor_registry_bron_field.py`** — SC#1: asserts every `FACTOR_REGISTRY` entry has a `bron` field with a valid `VALID_BRON_VALUES` value; maps 9 potentie factors to expected bron groups. Fails until Plan 03 adds `bron` field to `FactorRegistryEntry`.
- **`test_user_factor_pin_model.py`** — PIN-02: raises `ModuleNotFoundError` on import (`app.models.user_factor_pin`) until Plan 02 creates the model; then tests construction + `UniqueConstraint` enforcement.
- **`test_factor_pins_router.py`** — PIN-03 + SC#3 + SC#9 + SC#10: 8 integration tests covering auth-required (401), empty list, POST creates with position=0, 409 on duplicate, 400+MAX_PINS_REACHED on 7th pin, 204 DELETE, round-trip persistence, multi-tenant isolation.
- **`test_user_factor_pins_migration.py`** — SC#2: Alembic migration smoke — table existence, required columns, `uq_user_factor_pins_user_cat_key` constraint.

All 4 files confirmed to collect with 14 tests + 1 expected `ModuleNotFoundError` (Nyquist signal). Zero `pytest.skip`, `pytest.xfail`, or `pytest.importorskip` calls.

### Task 2: Frontend test infrastructure

- **`frontend/src/test-utils/factorPinsMock.ts`** — `makeFactorPin(factor_key, position, category)` + `makeQueryClientWithPins(parcelId, pins, category)` exports. Inline cache pre-seed pattern (no MSW), mirrors Phase 3 `PotentieLayer.stories.tsx` precedent.
- **`PotentieLayer.stories.tsx`** — 8 Phase 7 stories appended after existing Phase 3 WOON-01 stories (ClickOpensPopup preserved): `PinnedPageEmpty`, `PinnedPagePartial`, `PinnedPageFull`, `GroupPagesNavigation`, `PinnedAlsoOnGroupPage`, `PinFlow`, `Max6Guard`, `MissingPinDashedBorder`. All use `pinDecorator` with explicit `<Toaster />` for toast assertions.
- **`RisicoLayer.stories.tsx`** — NEW file with 3 mirror stories for risico tab: `PinnedPageEmpty`, `PinnedPageWithRisicoPins`, `Max6Guard Risico`. Story assertions reference `data-testid="pin-star-filled"` and `data-testid="pin-star-button"` attributes that Plan 04 will add during layer refactor.

### Task 3: VALIDATION.md update

- Frontmatter: `nyquist_compliant: true`, `wave_0_complete: true`
- Per-Task Verification Map: 12 rows covering task IDs 7-01-T1 through 7-05-T2 with commands, file references, requirement IDs
- Validation Sign-Off: all 5 checkboxes checked

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Created

- [x] `backend/tests/unit/test_factor_registry_bron_field.py` exists
- [x] `backend/tests/unit/test_user_factor_pin_model.py` exists
- [x] `backend/tests/integration/test_factor_pins_router.py` exists
- [x] `backend/tests/integration/test_user_factor_pins_migration.py` exists
- [x] `frontend/src/test-utils/factorPinsMock.ts` exists
- [x] `frontend/src/stories/parcel/RisicoLayer.stories.tsx` exists

### Key Patterns

- [x] `VALID_BRON_VALUES` in test_factor_registry_bron_field.py
- [x] `from app.models.user_factor_pin import UserFactorPin` in test_user_factor_pin_model.py
- [x] `MAX_PINS_REACHED` in test_factor_pins_router.py
- [x] `uq_user_factor_pins_user_cat_key` in test_user_factor_pins_migration.py
- [x] `makeFactorPin` + `makeQueryClientWithPins` exports in factorPinsMock.ts
- [x] 8 Phase 7 stories in PotentieLayer.stories.tsx (PinnedPageEmpty/Partial/Full/GroupPagesNavigation/PinnedAlsoOnGroupPage/PinFlow/Max6Guard/MissingPinDashedBorder)
- [x] 3 stories in RisicoLayer.stories.tsx (PinnedPageEmpty/PinnedPageWithRisicoPins/Max6GuardRisico)
- [x] Zero `@storybook/test` imports (all use `storybook/test`)
- [x] Zero `pytest.skip`/`pytest.xfail`/`pytest.importorskip` calls
- [x] `nyquist_compliant: true` in 07-VALIDATION.md

### Commits

- [x] `e1e52d55` — test(07-01): add Wave 0 backend pytest stub files
- [x] `7994e002` — test(07-01): add Wave 0 frontend story stubs + factorPinsMock helper
- [x] `2954568b` — docs(07-01): update VALIDATION.md with per-task map + mark Wave 0 complete

## Self-Check: PASSED
