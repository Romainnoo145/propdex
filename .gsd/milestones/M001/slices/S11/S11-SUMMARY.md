---
id: S11
parent: M001
milestone: M001
provides:
  - HeartButton component with filled/unfilled state (FAV-02)
  - useParcelFavorites hook — TanStack Query list from GET /api/parcels/favorites
  - useToggleFavorite hook — optimistic mutation with POST/DELETE
  - ParcelPanelShell headerActions prop slot
  - FavoriteResponse, PortfolioResponse TypeScript types
requires: []
affects: []
key_files: []
key_decisions:
  - "Uses parcel.parcel_code (Kadaster string) for all favorites API calls — NOT parcel.parcel_id (UUID). FavoriteResponse.parcel_id stores the Kadaster string, making this the correct comparison key."
  - "fill-aura-amber text-aura-amber for filled heart state — uses Aura CSS variable token matching design system"
  - "headerActions renders left of close button in flex row — natural reading order, both buttons share same absolute-positioned container"
patterns_established:
  - "HeartButton is pure — receives parcel prop, manages its own favorite state via hooks"
  - "ParcelPanelShell headerActions slot: optional ReactNode, renders left of close button in top-right flex container"
observability_surfaces: []
drill_down_paths: []
duration: 4min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# S11: Projectlist Refactor Heartbutton

**# Phase 110 Plan 01: ProjectList Refactor Summary**

## What Happened

# Phase 110 Plan 01: ProjectList Refactor Summary

Mechanical extraction of the 1867-line ProjectList.tsx monolith into 9 focused files, each under 300 lines. Zero visual or functional regressions.

## What Was Built

Pure refactor — no behavior changes. The 1867-line `ProjectList.tsx` was split into:

| File | Lines | Purpose |
|------|-------|---------|
| `ProjectList.tsx` | 6 | Thin re-export for backward compat |
| `ProjectenPage.tsx` | 220 | Render orchestrator (loading state, view dispatch, regular projects) |
| `useProjectenWorkspace.ts` | 285 | All hooks/state for the Projecten workspace |
| `useMunicipalityResolver.ts` | 190 | Municipality-to-project resolution logic |
| `ProvincieView.tsx` | 233 | Province selector panel + gemeente card grid |
| `GemeenteView.tsx` | 200 | Gemeente detail workspace (by project ID or gemeente card) |
| `WijkView.tsx` | 279 | UnlinkedGemeenteWorkspace + WorkspaceMetricCard |
| `WijkScanList.tsx` | 139 | Scan list for expanded project rows |
| `WorkspaceHeader.tsx` | 108 | ProjectWorkspaceHeader + MonitoringToggleAction |
| `ProjectIcons.tsx` | 119 | 12 SVG icon helper components |

## Verification

- TypeScript: `npx tsc --noEmit` — PASSED (0 errors)
- ESLint: 0 errors, 22 warnings (all pre-existing Tailwind arbitrary value warnings from original code)
- All files under 300 lines
- Backward compatibility: `ProjectList.tsx` re-exports default from `ProjectenPage.tsx`

## Deviations from Plan

### Auto-added files

**1. WijkScanList.tsx — needed to keep WijkView.tsx under 300 lines**
- Plan proposed WijkView.tsx to contain both UnlinkedGemeenteWorkspace + WijkScanList
- Combined would have been ~420 lines — extracted WijkScanList to its own file
- **Files created:** `frontend/src/components/projects/WijkScanList.tsx`

**2. WorkspaceHeader.tsx — needed to keep GemeenteView.tsx under 300 lines**
- Plan proposed GemeenteView.tsx to include ProjectWorkspaceHeader + MonitoringToggleAction
- Combined would have been ~350 lines — extracted to WorkspaceHeader.tsx
- **Files created:** `frontend/src/components/projects/WorkspaceHeader.tsx`

**3. useMunicipalityResolver.ts — needed to keep useProjectenWorkspace.ts under 300 lines**
- Plan proposed all hooks in one file; municipality resolution is ~190 lines
- Extracted as a focused, reusable hook
- **Files created:** `frontend/src/components/projects/useMunicipalityResolver.ts`

## Commits

- `4d0ebd0`: refactor(110-01): extract ProjectList.tsx monolith into sub-components

## Self-Check: PASSED

All 10 files verified present. Commit 4d0ebd0 verified in git log.

# Phase 110 Plan 02: Heart Button Summary

**Heart button on parcel detail panel with optimistic toggle favorites via TanStack Query mutation, backed by Phase 109 POST/DELETE endpoints — fills amber (Aura token) when favorited, rolls back on API error**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-16T17:16:00Z
- **Completed:** 2026-03-16T17:20:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Portfolio types (FavoriteResponse, PortfolioResponse, PipelineStage) matching Phase 109 backend Pydantic schemas
- useFavorites.ts with useParcelFavorites (list query, 5min stale, auth-gated) and useToggleFavorite (optimistic mutation with rollback)
- HeartButton component positioned next to close button in parcel detail panel header
- ParcelPanelShell extended with headerActions prop slot (backward compatible)

## Task Commits

Each task was committed atomically:

1. **Task 1: Portfolio types + useFavorites hook** - `a2f873e` (feat)
2. **Task 2: HeartButton component + ParcelPanelShell header slot** - `0f81cbf` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `frontend/src/lib/types/portfolio.ts` - PipelineStage union, FavoriteResponse, PortfolioWijkGroup, PortfolioGemeenteGroup, PortfolioResponse interfaces
- `frontend/src/hooks/useFavorites.ts` - useParcelFavorites list query + useToggleFavorite optimistic mutation
- `frontend/src/components/map/panels/parcel/HeartButton.tsx` - Heart toggle button, fills amber when favorited, guards on missing parcel_code
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` - Added headerActions prop, replaced single close button with flex container
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` - Added HeartButton import + headerActions prop on ParcelPanelShell

## Decisions Made
- Uses `parcel.parcel_code` (Kadaster string) for all favorites API calls throughout: DELETE URL segment, POST body `parcel_id` field, and `isFavorited` comparison against `FavoriteResponse.parcel_id` — all consistently Kadaster string, never UUID.
- `fill-aura-amber text-aura-amber` for filled heart — matches the `--color-aura-amber: #F9A826` CSS variable token (verified in `src/styles/index.css`)
- Optimistic entry in `onMutate` uses `id: 'optimistic-${parcel_code}'` placeholder — server canonical version replaces it after `onSettled` invalidation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FAV-01 and FAV-02 satisfied: heart button visible on parcel detail panel, toggles with server persistence and optimistic update
- Phase 111 (portfolio navigation panel) can import FavoriteResponse + PortfolioResponse from portfolio.ts
- useFavorites hooks are reusable across any future portfolio views

## Self-Check: PASSED

- frontend/src/lib/types/portfolio.ts: FOUND
- frontend/src/hooks/useFavorites.ts: FOUND
- frontend/src/components/map/panels/parcel/HeartButton.tsx: FOUND
- Commit a2f873e: FOUND
- Commit 0f81cbf: FOUND

---
*Phase: 110-projectlist-refactor-heartbutton*
*Completed: 2026-03-16*
