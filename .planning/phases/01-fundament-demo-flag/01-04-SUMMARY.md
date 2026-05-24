---
phase: 01-fundament-demo-flag
plan: "04"
subsystem: favorites-projecttype
tags: [backend, frontend, multi-tenant, favorites, project-type, aura, tdd]
dependency_graph:
  requires: [01-03]
  provides: [FavoriteResponse.project_type, projectTypeChip, SavedParcelCard-chip, FavoritedParcelCard-chip, picker-intention-copy]
  affects: [GET /api/parcels/favorites, SavedParcelCard, FavoritedParcelCard, ProjectTypePickerModal]
tech_stack:
  added: []
  patterns: [SQLAlchemy outerjoin subquery, before_cursor_execute event listener, fs.readFileSync copy assertion, pure-logic vitest helper]
key_files:
  created:
    - backend/tests/regression/test_m052_s01_favorites_project_type_isolation.py
    - backend/tests/integration/test_favorites_project_type_join.py
    - frontend/src/lib/types/projectTypeChip.ts
    - frontend/src/lib/types/__tests__/projectTypeChip.test.ts
    - frontend/src/components/parcel/__tests__/projectTypePickerCopy.test.ts
  modified:
    - backend/app/favorites/schemas.py
    - backend/app/favorites/favorites_service.py
    - frontend/src/lib/types/portfolio.ts
    - frontend/src/components/projects/SavedParcelCard.tsx
    - frontend/src/components/projects/FavoritedParcelCard.tsx
    - frontend/src/components/parcel/ProjectTypePickerModal.tsx
    - frontend/src/stories/projects/SavedParcelCard.stories.tsx
    - frontend/src/hooks/useFavorites.ts
    - frontend/src/components/cockpit/__tests__/OnderzoekPhaseView.parity.test.tsx
decisions:
  - "project_type join on Kadaster-string parcel_id (not parcel_cache_id UUID) — matches parcel_project_types.parcel_id String(50) column"
  - "org resolved via scalar User.organization_id query inside list_favorites — keeps router callsite (list_favorites(user_id, db)) unchanged"
  - "no-N+1 proven via before_cursor_execute counter == 1 for 3-favorite fixture — structural check insufficient"
  - "project_type chip uses passive Aura glass tokens (not loud amber pill) — chip is a label, not an action"
  - "copy tests use fs.readFileSync source-text assertion (not render) — project convention per RisicoLayer.factor-coverage precedent"
metrics:
  duration: "30m 24s"
  completed_date: "2026-05-24"
  tasks_completed: 3
  files_modified: 9
  files_created: 5
---

# Phase 01 Plan 04: Picker copy intentie + project_type chip op Opgeslagen-kaarten Summary

Org-scoped bulk-join brengt `project_type` naar `FavoriteResponse` via een derde outerjoin-subquery op `parcel_project_types` (Kadaster-string join, org via `User.organization_id`), picker-copy geeft intentie-framing zonder scoring-claim, en beide Opgeslagen-kaarten tonen een subtiele Aura-chip voor een concreet gekozen type.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend org-scoped project_type bulk-join + schema field + CRITICAL isolation/bulk/type-guard tests | c394f693 | favorites_service.py, schemas.py, 2 test files |
| 2 | Picker copy intentie (both invocations) + copy-assertion test | 70729492 | ProjectTypePickerModal.tsx, projectTypePickerCopy.test.ts |
| 3 | Frontend project_type type + chip helper + Aura chip on both cards + chip-render test | 76381552 | 7 frontend files |

## Verification Results

- Backend: 5/5 tests green (CRITICAL isolation + Kadaster-string guard + with-type + without-type + N+1 counter)
- Frontend: 17/17 tests green (6 copy + 11 chip-helper)
- ruff: no new errors vs baseline (pre-existing B904 in favorites_service.py remains)
- tsc: 91 errors (baseline unchanged — 3 Rule-2 auto-fixes in mock sites kept count stable)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing field] Add project_type: null to 3 FavoriteResponse mock sites**
- Found during: Task 3
- Issue: Adding `project_type` as required field in FavoriteResponse broke 3 existing mock objects (SavedParcelCard.stories.tsx, useFavorites optimistic entry, OnderzoekPhaseView.parity.test.tsx)
- Fix: Added `project_type: null` to each mock object
- Files modified: frontend/src/stories/projects/SavedParcelCard.stories.tsx, frontend/src/hooks/useFavorites.ts, frontend/src/components/cockpit/__tests__/OnderzoekPhaseView.parity.test.tsx
- Commit: 76381552

### Deferred (do NOT fix in 01-04)

**DEF-01: favorites_service.py 300-line overage**
File is 641 lines (pre-existing). 01-04 adds only ~15 lines (minimal join + field). Split would endanger shipped scores_sq/report_sq/delete logic. Log as standalone refactor todo for a future slice.

**DEF-02: scores_sq key-mismatch**
`scores_sq` reads `flags['scores']['potentie']` / `'risico'` while rescore-paths write `'potentie_score'` / `'risico_score'`. Same latent mismatch as tile-proxy. Post-rescore favorite scores may be stale. Out of 01-04 scope per eng-review lock. Standalone investigation todo.

## Self-Check: PASSED

All 7 key files exist. All 3 task commits verified (c394f693, 70729492, 76381552).
