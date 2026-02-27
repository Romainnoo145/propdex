---
phase: 57-codebase-globalization
plan: 02
subsystem: frontend/primitives
tags: [refactor, deduplication, ui-primitives, search]
dependency_graph:
  requires: ["57-01"]
  provides:
    - shared MetricChip primitive with tone variants
    - shared SearchInput primitive with centralized anti-autofill defaults
  affects:
    - frontend/src/components/primitives/MetricChip.tsx
    - frontend/src/components/primitives/SearchInput.tsx
    - frontend/src/components/primitives/index.ts
    - frontend/src/components/projects/GemeenteCard.tsx
    - frontend/src/components/projects/WijkCard.tsx
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/projects/WijkDetailView.tsx
    - frontend/src/components/reports/ReportSearch.tsx
    - frontend/src/routes/_authenticated/rapporten.tsx
tech_stack:
  added: []
  patterns:
    - shared primitive replacement for duplicated chip markup/classes
    - shared anti-autofill attribute constants for search fields
    - behavior-preserving component migration
key_files:
  created:
    - frontend/src/components/primitives/MetricChip.tsx
    - frontend/src/components/primitives/SearchInput.tsx
  modified:
    - frontend/src/components/primitives/index.ts
    - frontend/src/components/projects/GemeenteCard.tsx
    - frontend/src/components/projects/WijkCard.tsx
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/projects/WijkDetailView.tsx
    - frontend/src/components/reports/ReportSearch.tsx
    - frontend/src/routes/_authenticated/rapporten.tsx
decisions:
  - MetricChip de-emphasizes zero values by default (neutral tone fallback)
  - MetricChip supports compact mode for dense card rows
  - SearchInput exposes DEFAULT_SEARCH_INPUT_PROPS for non-native wrappers (cmdk Command.Input)
metrics:
  completed_date: 2026-02-26
  tasks_completed: 2
  files_changed: 9
---

# Phase 57 Plan 02 Summary

Shared UI primitives now replace duplicated metric chip and anti-autofill search input implementations.

## What Was Built

- Added `MetricChip` primitive in `frontend/src/components/primitives/MetricChip.tsx`:
  - tone variants: `neutral`, `amber`, `info`, `error`
  - zero-value de-emphasis behavior
  - optional compact size for dense layouts
- Added `SearchInput` primitive in `frontend/src/components/primitives/SearchInput.tsx`:
  - centralized anti-password-manager / anti-autofill defaults
  - optional left icon rendering
  - exported `DEFAULT_SEARCH_INPUT_PROPS` for `cmdk` inputs
- Exported both primitives from `frontend/src/components/primitives/index.ts`.

## Refactors Applied

- Replaced local metric-chip implementations with shared `MetricChip` in:
  - `frontend/src/components/projects/GemeenteCard.tsx`
  - `frontend/src/components/projects/WijkCard.tsx`
  - `frontend/src/components/projects/ProjectList.tsx`
- Replaced duplicated search input attributes with shared primitive/defaults in:
  - `frontend/src/routes/_authenticated/rapporten.tsx` (`SearchInput`)
  - `frontend/src/components/projects/WijkDetailView.tsx` (`SearchInput`)
  - `frontend/src/components/reports/ReportSearch.tsx` (`DEFAULT_SEARCH_INPUT_PROPS` on `Command.Input`)

## Verification

- `frontend: npm run -s typecheck` ✅
- `frontend: npm run -s build` ✅
- Duplicate local implementations removed from targeted files:
  - local `MetricChip` in `GemeenteCard.tsx`
  - local `WijkMetricChip` in `WijkCard.tsx`
  - local `WijkCountChip` in `ProjectList.tsx`

## Deviations from Plan

None.

## Next Step

Proceed to `57-03-PLAN.md` (shared GeoJSON query hooks + municipality workspace selectors).
