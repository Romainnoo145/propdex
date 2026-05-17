---
phase: 03-data-sources-ux
plan: 01
subsystem: ui
tags: [typescript, tanstack-query, react, data-sources, admin]

# Dependency graph
requires:
  - phase: 02-admin-api-layer
    provides: "S02 backend API contract (GET /gemeenten, GET /{code}, POST /{code}/{key}/refresh) + Pydantic schemas in data_sources_schemas.py"

provides:
  - "TypeScript type mirror of 7 backend Pydantic DTOs (SourceType, SourceStatus, ActionType, Action, DataSourceRow, GemeenteDataSourcesPayload, GemeenteSummary)"
  - "TanStack Query cache-key factory dataSourcesAdminKeys with all/gemeenten/gemeente keys"
  - "useGemeentenSummary() hook — GET /api/admin/data-sources/gemeenten, staleTime 60s"
  - "useGemeenteDataSources(code) hook — GET /api/admin/data-sources/{code}, staleTime 30s"
  - "useRefreshDataSource() mutation — POST /{code}/{key}/refresh, dual cache invalidation + sonner toasts"

affects: [03-03-component-library, 03-04-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query-key factory pattern: dataSourcesAdminKeys with typed const tuples, single source of truth for cache invalidation"
    - "Hand-maintained type mirror pattern (M045/S05 policy-admin.ts convention)"
    - "lib/queries/ subdirectory for domain-specific hook modules (new directory, first inhabitant)"

key-files:
  created:
    - frontend/src/lib/types/data-sources-admin.ts
    - frontend/src/lib/queries/data-sources-admin.ts
  modified: []

key-decisions:
  - "lib/queries/ directory created as new sub-namespace for domain-scoped query hooks (distinct from src/hooks/ which holds component-level hooks)"
  - "RefreshArgs interface inline in queries file (not exported) — only useRefreshDataSource callers need it, keeps API surface minimal"
  - "Dual invalidation on refresh success: both gemeente detail + gemeenten summary caches invalidated so picker status-dots update immediately"

patterns-established:
  - "Type mirror: hand-maintained TypeScript twin of Pydantic schemas, header comment references source file, pattern matches policy-admin.ts"
  - "Query keys: const factory object with typed as const tuples — gemeente() takes gemeenteCode string param for per-gemeente cache segmentation"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 3 Plan 01: Data Sources Admin — Types Mirror + Query Hooks Summary

**7-type Pydantic mirror + 3 TanStack Query hooks with cache-key factory wiring M049/S03 frontend to S02 REST API**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-14T18:15:23Z
- **Completed:** 2026-05-14T18:16:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `data-sources-admin.ts` with 7 exports mirroring backend Pydantic schemas exactly (SourceType, SourceStatus, ActionType, Action, DataSourceRow, GemeenteDataSourcesPayload, GemeenteSummary)
- Created `lib/queries/` directory (new sub-namespace) and `data-sources-admin.ts` with dataSourcesAdminKeys factory + 3 query hooks
- All hooks use apiFetch from `@/lib/api` (no new fetch wrappers), auth via useAuth(), sonner toasts on mutation success/error
- Zero TypeScript errors in both new files; pre-existing errors in verkenner.tsx/stories are out of scope

## Task Commits

1. **Task 1: Create TypeScript type mirror file** - `36fc24e0` (feat)
2. **Task 2: Create TanStack Query hooks module** - `7c620490` (feat)

## Files Created/Modified
- `frontend/src/lib/types/data-sources-admin.ts` - TypeScript mirror of backend/app/admin/data_sources_schemas.py — 7 exported types
- `frontend/src/lib/queries/data-sources-admin.ts` - TanStack Query hooks: dataSourcesAdminKeys factory + useGemeentenSummary + useGemeenteDataSources + useRefreshDataSource

## Type-Mirror Cross-Check (Backend vs Frontend)

| Backend field | TypeScript field | Match |
|---|---|---|
| `SourceType = Literal["A","B","C"]` | `type SourceType = 'A' \| 'B' \| 'C'` | OK |
| `DataSourceStatusValue` (live/broken/missing/not_applicable) | `type SourceStatus = 'live' \| 'broken' \| 'missing' \| 'not_applicable'` | OK |
| `ActionType = Literal["upload","configure_credential","view_versions","refresh"]` | `type ActionType = 'upload' \| 'configure_credential' \| 'view_versions' \| 'refresh'` | OK |
| `Action.action, .enabled, .label_nl, .reason_disabled` | `Action.action, .enabled, .label_nl, .reason_disabled` | OK |
| `DataSourceRow` 8 fields | `DataSourceRow` 8 fields | OK |
| `GemeenteDataSourcesPayload` 5 fields | `GemeenteDataSourcesPayload` 5 fields | OK |
| `GemeenteSummary` 5 fields | `GemeenteSummary` 5 fields | OK |

No drift detected. `dict | None` → `Record<string, unknown> | null`, `datetime | None` → `string | null` (ISO serialization).

## Decisions Made
- `lib/queries/` directory created as new sub-namespace for domain-scoped query hooks, distinct from `src/hooks/` (component-level hooks)
- `RefreshArgs` interface kept inline (not exported) — minimizes public API surface
- Dual cache invalidation on refresh: both `gemeente(code)` and `gemeenten()` keys invalidated so picker status-dots refresh immediately

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing TypeScript errors in `verkenner.tsx` and Storybook stories are out-of-scope (pre-existing, not caused by these changes).

## Next Phase Readiness
- 03-03 (component library) can import `import type { DataSourceRow, SourceStatus } from '@/lib/types/data-sources-admin'`
- 03-04 (routes) can import `import { useGemeentenSummary, useGemeenteDataSources, useRefreshDataSource } from '@/lib/queries/data-sources-admin'`
- Cache invalidation strategy proven: refresh mutation correctly flushes both per-gemeente detail and summary list caches

## Self-Check: PASSED

- `frontend/src/lib/types/data-sources-admin.ts` — FOUND
- `frontend/src/lib/queries/data-sources-admin.ts` — FOUND
- Commit `36fc24e0` — FOUND
- Commit `7c620490` — FOUND

---
*Phase: 03-data-sources-ux*
*Completed: 2026-05-14*
