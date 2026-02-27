---
phase: 57-codebase-globalization
plan: 03
subsystem: frontend/hooks-selectors
tags: [refactor, deduplication, tanstack-query, selectors]
dependency_graph:
  requires: ["57-01", "57-02"]
  provides:
    - shared gemeente/provincie GeoJSON query hooks
    - centralized municipality workspace stats selector hook
  affects:
    - frontend/src/hooks/useGemeenteGeoJSON.ts
    - frontend/src/hooks/useProvincieGeoJSON.ts
    - frontend/src/hooks/useMunicipalityWorkspaceStats.ts
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/routes/_authenticated/map.tsx
tech_stack:
  added: []
  patterns:
    - tanstack-query wrappers around existing GeoJSON fetchers
    - shared memoized selector hook for workspace counters
    - behavior-preserving route/component refactor
key_files:
  created:
    - frontend/src/hooks/useGemeenteGeoJSON.ts
    - frontend/src/hooks/useProvincieGeoJSON.ts
    - frontend/src/hooks/useMunicipalityWorkspaceStats.ts
  modified:
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/routes/_authenticated/map.tsx
decisions:
  - GeoJSON hooks use 24h stale/gc windows due stable CBS boundaries
  - map route keeps lazy-loading behavior via enabled flag tied to gemeenten layer/deep-link intent
  - deep-link gemeente/wijk flow waits for hook data instead of manual fetch calls
metrics:
  completed_date: 2026-02-26
  tasks_completed: 2
  files_changed: 5
---

# Phase 57 Plan 03 Summary

GeoJSON loading and municipality workspace selectors are now centralized in shared hooks.

## What Was Built

- Added `useGemeenteGeoJSON` hook:
  - wraps `fetchGemeenteGeoJSON` in TanStack Query
  - shared query key + 24h cache window
- Added `useProvincieGeoJSON` hook:
  - wraps `fetchProvincieGeoJSON` in TanStack Query
  - shared query key + 24h cache window
- Added `useMunicipalityWorkspaceStats` hook:
  - centralizes gemeente-card workspace counters and mappings:
    - scanned wijken
    - rapporten totals
    - meldingen/unread totals
    - selected gemeente summary + wijk report counts
    - province-level stats for sidebar cards

## Refactors Applied

- `ProjectList.tsx`
  - removed local CBS GeoJSON `useEffect` fetch lifecycle
  - now uses `useGemeenteGeoJSON` + `useProvincieGeoJSON`
  - moved gemeente workspace counter derivations to `useMunicipalityWorkspaceStats`
- `map.tsx`
  - removed manual `fetchGemeenteGeoJSON` fetch paths
  - now uses `useGemeenteGeoJSON` with lazy `enabled` strategy
  - gemeenten toggle + deep-link flow now consume shared hook data

## Verification

- `frontend: npm run -s typecheck` ✅
- `frontend: npm run -s build` ✅
- Direct fetch/caching lifecycle removed from targeted route/component:
  - `ProjectList.tsx`
  - `map.tsx`

## Deviations from Plan

None.

## Next Step

Proceed to `57-04-PLAN.md` (guardrails, verification, and UX handoff).
