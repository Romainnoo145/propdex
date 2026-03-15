---
phase: 110-projectlist-refactor-heartbutton
plan: 02
subsystem: ui
tags: [react, tanstack-query, typescript, favorites, optimistic-update, heart-button, portfolio]

requires:
  - phase: 109-backend-foundation
    plan: 02
    provides: POST /api/parcels/favorites, GET /api/parcels/favorites, DELETE /api/parcels/favorites/{parcel_id} endpoints

provides:
  - HeartButton component with filled/unfilled state (FAV-02)
  - useParcelFavorites hook — TanStack Query list from GET /api/parcels/favorites
  - useToggleFavorite hook — optimistic mutation with POST/DELETE
  - ParcelPanelShell headerActions prop slot
  - FavoriteResponse, PortfolioResponse TypeScript types

affects:
  - 111 (portfolio navigation panel will use FavoriteResponse + PortfolioResponse types)

tech-stack:
  added: []
  patterns:
    - Optimistic mutation pattern: onMutate cancel+snapshot+update, onError rollback, onSettled invalidate
    - headerActions prop slot pattern: ParcelPanelShell accepts ReactNode for additional header buttons

key-files:
  created:
    - frontend/src/lib/types/portfolio.ts
    - frontend/src/hooks/useFavorites.ts
    - frontend/src/components/map/panels/parcel/HeartButton.tsx
  modified:
    - frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx
    - frontend/src/components/map/panels/ParcelDetailPanel.tsx

key-decisions:
  - "Uses parcel.parcel_code (Kadaster string) for all favorites API calls — NOT parcel.parcel_id (UUID). FavoriteResponse.parcel_id stores the Kadaster string, making this the correct comparison key."
  - "fill-aura-amber text-aura-amber for filled heart state — uses Aura CSS variable token matching design system"
  - "headerActions renders left of close button in flex row — natural reading order, both buttons share same absolute-positioned container"

patterns-established:
  - "HeartButton is pure — receives parcel prop, manages its own favorite state via hooks"
  - "ParcelPanelShell headerActions slot: optional ReactNode, renders left of close button in top-right flex container"

requirements-completed: [FAV-01, FAV-02]

duration: 4min
completed: 2026-03-16
---

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
