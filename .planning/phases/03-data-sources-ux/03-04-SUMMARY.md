---
phase: 03-data-sources-ux
plan: 04
subsystem: ui
tags: [react, typescript, tanstack-router, tanstack-query, storybook, framer-motion, aura-design-system, data-sources, admin]

# Dependency graph
requires:
  - phase: 03-data-sources-ux
    plan: 01
    provides: "TypeScript type mirror (7 types) + TanStack Query hooks (useGemeentenSummary, useGemeenteDataSources, useRefreshDataSource)"
  - phase: 03-data-sources-ux
    plan: 02
    provides: "SettingsTabNav 5th pill with Data-bronnen link (superuser-gated)"
  - phase: 03-data-sources-ux
    plan: 03
    provides: "5-component Aura library (StatusPill, DataSourceRow, DataSourceSection, GemeentePicker, DataSourcesEmptyState)"

provides:
  - "TanStack Router index route: /instellingen/data-bronnen — superuser-gated, auto-redirect to first gemeente, DataSourcesEmptyState for empty roster"
  - "TanStack Router detail route: /instellingen/data-bronnen/$gemeenteCode — parseParams ^GM\\d{4}$ validation, 3 DataSourceSection rendering"
  - "routeTree.gen.ts regenerated: both routes type-checked, SettingsTabNav + GemeentePicker TS2322 errors resolved"
  - "Storybook stories: 4 DataSourceRow variants with play functions asserting data-status + data-enabled (TEST-04)"
  - "Mock fixtures: mockDataSources.ts with 4 named exports (live/broken/missing/not_applicable)"

affects: [storybook-plays, S04-upload-modal-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Router routeTree.gen.ts codegen: triggered via Generator class from @tanstack/router-generator (not tsr CLI which lacks entrypoints config)"
    - "Storybook story with real routeTree + AuthContext.Provider: pattern for testing auth-aware + router-aware components without MSW"
    - "noUncheckedIndexedAccess guard: gemeenten[0]?.gemeente_naam with nullish coalescing avoids TS2532 on array access"

key-files:
  created:
    - frontend/src/routes/_authenticated/instellingen.data-bronnen.tsx
    - frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx
    - frontend/src/components/settings/data-bronnen/mockDataSources.ts
    - frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx
  modified:
    - frontend/src/routeTree.gen.ts

key-decisions:
  - "routeTree.gen.ts regenerated via Generator class from @tanstack/router-generator (not tsr CLI — lacks entrypoints config for this project setup)"
  - "Stories use real routeTree (not createRootRoute stub) + AuthContext.Provider + QueryClientProvider — matches existing story patterns in project"
  - "noUncheckedIndexedAccess TS2532: used gemeenten[0]?.gemeente_naam (nullish coalescing) rather than non-null assertion"

patterns-established:
  - "Route codegen pattern: Generator({ config: getConfig({...}, __dirname), root: __dirname }).run() from @tanstack/router-generator in CI/headless env"
  - "Story provider pattern: routeTree + createMemoryHistory + AuthContext.Provider + QueryClientProvider wraps for auth-aware TanStack Router components"

requirements-completed: [UX-01, UX-02, UX-06, TEST-04]

# Metrics
duration: 7min
completed: 2026-05-14
---

# Phase 3 Plan 04: Data-bronnen Routes + Storybook Plays Summary

**2 TanStack Router routes (index auto-redirect + detail 3-section view) + 4 Storybook plays asserting status-pill and action-button states — closes M049/S03 frontend track**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-14T18:40:42Z
- **Completed:** 2026-05-14T18:47:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created index route `/instellingen/data-bronnen` with superuser-gate, auto-redirect to first gemeente via `useEffect`, and DataSourcesEmptyState for zero-gemeente roster
- Created detail route `/instellingen/data-bronnen/$gemeenteCode` with `parseParams` regex validation (`^GM\d{4}$`), 3 DataSourceSection instances (Beleidsdocumenten / Open API-bronnen / Betaalde integraties), empty-state for totalRows === 0
- Regenerated `routeTree.gen.ts` via `@tanstack/router-generator` Generator class — resolves TS2322 on SettingsTabNav Link + GemeentePicker Link from plans 03-02/03-03
- Created 4 Storybook play stories (LiveWithActions, BrokenWithError, MissingPlaceholder, NotApplicable) asserting `data-status` and `data-enabled` attributes; Storybook build passed (11.52s)
- No pre-existing errors introduced; all our file errors zero after routeTree regeneration

## Task Commits

1. **Task 1+2: Index route + detail route** - `85395747` (feat)
2. **Task 3: Mock fixtures + Storybook stories** - `b84e09a0` (feat)

## Files Created/Modified

- `frontend/src/routes/_authenticated/instellingen.data-bronnen.tsx` (75 lines) — index route with superuser gate, gemeente auto-redirect, empty state
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` (114 lines) — detail route with parseParams, 3 sections, GemeentePicker
- `frontend/src/components/settings/data-bronnen/mockDataSources.ts` (72 lines) — 4 inline Storybook fixtures
- `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` (163 lines) — 4 stories with play functions
- `frontend/src/routeTree.gen.ts` — regenerated with both new routes

## Decisions Made

- **Route codegen trigger:** `npm run check` alone doesn't regenerate routeTree (tsc-only). Used `Generator` class from `@tanstack/router-generator` directly (not `npx tsr generate` which lacks entrypoints config). Pattern: `getConfig({...}, __dirname)` + `new Generator({ config, root: __dirname }).run()`.
- **Stories use real routeTree** (not minimal stub): DataSourceRow's Upload action is a `<Link to="/instellingen/beleid-beheer">` — real routeTree avoids TS route-type errors and matches the pattern in `BottomTabNav.stories.tsx`.
- **noUncheckedIndexedAccess fix:** `gemeenten[0]?.gemeente_naam ?? firstGemeenteCode` — project has `noUncheckedIndexedAccess: true` in tsconfig; direct index access throws TS2532.

## routeTree.gen.ts Regeneration

Required explicit codegen — Vite plugin only runs during `vite dev`/`vite build`. Used:

```js
const { Generator, getConfig } = require('@tanstack/router-generator/dist/cjs/index.cjs')
const config = getConfig({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }, __dirname)
new Generator({ config, root: __dirname }).run()
```

Both routes (`/_authenticated/instellingen/data-bronnen` and `/$gemeenteCode`) now present in routeTree with 23 occurrences.

## Storybook Build Status

**PASSED** — `storybook build` completed in 11.52s. Stories use `storybook/test` (Storybook 10 path), real routeTree, AuthContext mock, QueryClientProvider.

## SettingsTabNav Plan-02 Type-Check

**RESOLVED** — `! grep -q "as any" frontend/src/components/settings/SettingsTabNav.tsx` → clean (no `as any` cast present; errors were TS2322 from missing routes, now resolved by routeTree regeneration).

## Visual Smoke Status

**PENDING USER REVIEW** — Manual check against DESIGN.md required for Phase 3 success criterion 6. Run `npm run dev` (port 9300), navigate to `/instellingen/data-bronnen` as superuser. Verify: Aura Morning Mist canvas (`#F2F6F3`), Pure Glass cards (`bg-white/60 backdrop-blur-[24px]`), 3 sections, status pills with correct colors, action buttons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] noUncheckedIndexedAccess TS2532 on gemeente array access**
- **Found during:** Task 1 (index route)
- **Issue:** `gemeenten[0].gemeente_naam` throws TS2532 under `noUncheckedIndexedAccess: true` tsconfig setting despite earlier `gemeenten.length === 0` guard
- **Fix:** Changed to `gemeenten[0]?.gemeente_naam ?? firstGemeenteCode` using optional chaining + nullish coalescing
- **Files modified:** `frontend/src/routes/_authenticated/instellingen.data-bronnen.tsx`
- **Verification:** `npm run check` passes, no TS errors on new files
- **Committed in:** `b84e09a0` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in strict TypeScript config)
**Impact on plan:** Minor. Single-line nullish-coalescing guard. No scope change.

## Issues Encountered

- `npx tsr generate` failed ("No files matched the entrypoints pattern") — the `tsr` CLI version installed (1.3.4) requires explicit entrypoints config that the project doesn't provide. Resolved by using the `Generator` class directly from `@tanstack/router-generator`.

## Phase 3 ROADMAP Status

| Criterion | Status |
|---|---|
| 1. Route mount + gemeente-picker auto-redirect | DONE (both routes) |
| 2. 3 DataSourceSection instances in detail route | DONE (Beleidsdocumenten / Open API-bronnen / Betaalde integraties) |
| 3. 5th SettingsTabNav pill (Data-bronnen, superuser) | DONE (03-02) + TS resolved |
| 4. DataSourcesEmptyState in index + detail | DONE |
| 5. 4 Storybook plays (TEST-04) | DONE (build passes) |
| 6. Visual smoke vs DESIGN.md | PENDING USER REVIEW |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 (03-data-sources-ux) is complete through criteria 1-5; criterion 6 is a manual visual check
- S04 (Upload-flow integration) replaces the interim `<Link to="/instellingen/beleid-beheer">` deep-link in DataSourceRow Upload action with an inline UploadDocumentModal
- S05 (Credential modal) enables the `configure_credential` action buttons currently disabled with tooltip "Beschikbaar vanaf S05"

---
*Phase: 03-data-sources-ux*
*Completed: 2026-05-14*
