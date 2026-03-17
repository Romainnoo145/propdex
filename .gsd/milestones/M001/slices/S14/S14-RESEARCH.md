# S14: Pipeline Stages — Research

**Date:** 2026-03-17
**Depth:** Light

## Summary

S14 ("Pipeline Stages") is marked **⚠️ SUPERSEDED** in the roadmap: "Pipeline UI moves to Opgeslagen view in v18.0; Projecten page killed." All backend infrastructure for pipeline stages already exists and is fully functional: `ParcelFavorite` model with `pipeline_stage` column, CRUD + PATCH endpoints, Pydantic schemas with `Literal` validation, and optimistic TanStack Query hooks. On the frontend, a complete set of pipeline UI components already exists in `/projecten`'s PortfolioView: `PipelineStagePill`, `PipelineStageSelector`, `PipelineStageFilter`, `AfgerondModal`, and `FavoritedParcelCard`. The `/opgeslagen` route (238 lines) is a simple gemeente-grouped favorites list with search — it has zero pipeline stage UI.

The slice work is: bring existing pipeline stage components into the `/opgeslagen` view. No new backend work. No new components to create — all five pipeline components are reusable as-is.

## Recommendation

Integrate existing pipeline components into `opgeslagen.tsx`. Three additions: (1) `PipelineStageFilter` bar below the header for filtering by stage, (2) `PipelineStagePill` + `PipelineStageSelector` + `AfgerondModal` on each parcel row for viewing/changing stage, (3) URL param for stage filter persistence. This is a wiring task with zero new dependencies.

## Implementation Landscape

### Key Files

- `frontend/src/routes/_authenticated/opgeslagen.tsx` (238 lines) — The target. Currently renders `ParcelRow` inline component with address + "Bekijk op kaart" link. Needs pipeline stage UI added to each row and a filter bar added to the page.
- `frontend/src/components/projects/PipelineStagePill.tsx` (37 lines) — Displays stage as colored pill. Already accepts `onClick` prop for opening selector. Reuse directly.
- `frontend/src/components/projects/PipelineStageSelector.tsx` (66 lines) — Dropdown to pick a new stage. Uses `useUpdatePipelineStage` hook internally. Reuse directly.
- `frontend/src/components/projects/PipelineStageFilter.tsx` (64 lines) — Horizontal pill bar for filtering by stage. Currently uses `useNavigate` to set `portfolio_stage` URL param on `/projecten`. Needs minor adaptation to work with `/opgeslagen` route's search params.
- `frontend/src/components/projects/AfgerondModal.tsx` (87 lines) — Modal for Afgerond reason + note. Uses `useUpdatePipelineStage` hook. Reuse directly.
- `frontend/src/components/projects/FavoritedParcelCard.tsx` (69 lines) — Full card with pipeline pill + selector. Could be reused, but `/opgeslagen` uses a row layout not a card grid — more natural to add pill/selector inline to existing `ParcelRow`.
- `frontend/src/hooks/useFavorites.ts` — `useUpdatePipelineStage` mutation hook. Already imported by PipelineStageSelector. No changes needed.
- `frontend/src/lib/types/portfolio.ts` — `PipelineStage` type. Already defined.
- `backend/app/favorites/router.py` — PATCH pipeline endpoint. Already works, no changes.

### Build Order

1. **Add `stage` search param to opgeslagen route** — Add Zod validation for `stage` param (same pattern as `projecten.tsx`'s `portfolio_stage`). This unblocks the filter bar.
2. **Add PipelineStageFilter to page** — Render below header, wire to the new URL param. The filter currently targets `portfolio_stage` param — either adapt PipelineStageFilter to accept a generic param name, or create a thin wrapper.
3. **Add pipeline stage to ParcelRow** — Import PipelineStagePill, PipelineStageSelector, AfgerondModal. Add stage pill to each row. Add selector dropdown + AfgerondModal state management.
4. **Filter favorites by active stage** — Apply client-side filter on `favorites` array using the URL param value (same pattern as PortfolioView's `filteredFavorites`).

### Verification Approach

- Frontend builds without errors: `cd frontend && npx tsc --noEmit`
- Visual: navigate to `/opgeslagen`, verify stage pills visible on each parcel row
- Functional: click a stage pill → selector dropdown appears → select "Onderzoek" → pill updates → page refresh preserves via URL param
- Functional: click "Afgerond" → modal appears → select reason → confirm → stage updates
- Functional: click stage filter pill → list filters to only parcels in that stage
- Backend: no changes needed, existing tests still pass

## Constraints

- `PipelineStageFilter` uses `useNavigate` with `search: (prev) => ({ ...prev, portfolio_stage: stage })`. On `/opgeslagen` the param name may differ — either reuse `portfolio_stage` or make the component accept a configurable param name via prop.
- The `/opgeslagen` route currently has no Zod search schema (uses `createFileRoute` without `validateSearch`). Adding one is required for URL param persistence.

## Common Pitfalls

- **PipelineStageFilter hardcodes `portfolio_stage` param** — Either adapt the component to accept a prop for param name, or use the same `portfolio_stage` param name on `/opgeslagen`. Using the same name is simpler and avoids component changes.
- **ParcelRow is an inline function component** — Adding state (selectorOpen, afgerondOpen) to an inline component inside `.map()` is fine since each gets its own instance, but extracting to a named component is cleaner.
