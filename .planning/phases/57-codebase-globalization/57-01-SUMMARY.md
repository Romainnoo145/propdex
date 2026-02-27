---
phase: 57-codebase-globalization
plan: 01
subsystem: frontend/shared-helpers-navigation
tags: [refactor, deduplication, navigation, map, geo]
dependency_graph:
  requires: []
  provides:
    - shared geo normalizers (normalizeAreaName, normalizeGemeenteCode)
    - shared wijk bbox resolver (resolveWijkBbox)
    - shared map search builders (parcel/address/gemeente+wijken)
  affects:
    - frontend/src/lib/geo/normalizers.ts
    - frontend/src/lib/geo-utils.ts
    - frontend/src/lib/navigation/mapSearch.ts
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/projects/WijkDetailView.tsx
    - frontend/src/components/projects/GemeenteDetailView.tsx
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - frontend/src/routes/_authenticated/meldingen.tsx
tech_stack:
  added: []
  patterns:
    - shared pure helper modules in lib/
    - typed route-search builder functions
    - behavior-preserving refactor (no UX changes)
key_files:
  created:
    - frontend/src/lib/geo/normalizers.ts
    - frontend/src/lib/navigation/mapSearch.ts
  modified:
    - frontend/src/lib/geo-utils.ts
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/projects/WijkDetailView.tsx
    - frontend/src/components/projects/GemeenteDetailView.tsx
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - frontend/src/routes/_authenticated/meldingen.tsx
decisions:
  - normalizeGemeenteCode implemented with TS overloads so string input returns string, nullable input returns nullable
  - map search builders always add _t timestamp for stable deep-link retrigger behavior
  - fallback_address handling standardized (trimmed + optional)
  - resolveWijkBbox moved to geo-utils and reused by both project and wijk detail flows
metrics:
  completed_date: 2026-02-26
  tasks_completed: 2
  files_changed: 9
---

# Phase 57 Plan 01 Summary

Shared geo helpers and map search builders are now centralized and consumed by projects/meldingen/map routes.

## What Was Built

- Added shared normalizers in `frontend/src/lib/geo/normalizers.ts`:
  - `normalizeAreaName`
  - `normalizeGemeenteCode`
- Added shared map-search builders in `frontend/src/lib/navigation/mapSearch.ts`:
  - `toMapParcelSearch`
  - `toMapAddressSearch`
  - `toMapGemeenteWijkSearch`
- Added shared `resolveWijkBbox` in `frontend/src/lib/geo-utils.ts`.

## Refactors Applied

- Removed duplicated local normalizer/bbox helper functions from:
  - `ProjectList.tsx`
  - `WijkDetailView.tsx`
  - `GemeenteDetailView.tsx`
  - `map.tsx`
- Replaced manual `/map` search object literals with shared builders in:
  - `ProjectList.tsx` (gemeente/wijk open-op-kaart actions)
  - `ChangeTimeline.tsx` (timeline + detail panel map actions)
  - `meldingen.tsx` (list + detail panel map actions)

## Verification

- `frontend: npm run -s typecheck` ✅
- `frontend: npm run -s build` ✅
- No local duplicate declarations remain for:
  - `function normalizeAreaName`
  - `function normalizeGemeenteCode`
  - `function resolveWijkBbox`

## Deviations from Plan

None.

## Next Step

Proceed to `57-02-PLAN.md` (shared `MetricChip` and shared `SearchInput` primitives).
