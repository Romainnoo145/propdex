# S05: Enriched Opgeslagen + Pipeline — Research

**Date:** 2026-03-17

## Summary

This slice is already delivered. The current `opgeslagen.tsx` (485 lines) implements all PIPE-01 through PIPE-05 requirements:

1. **Pipeline stages** — 5 stages defined (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond) with colored pills
2. **Inline stage change** — `PipelineStagePill` component with dropdown showing all stages, checkmark on current
3. **Default Gesignaleerd** — Set in `useToggleFavorite` optimistic entry
4. **Stage filtering** — URL search param `?stage=Onderzoek` with filter pill bar showing counts per stage
5. **Afgerond reason** — Full modal (`AfgerondForm`) with Gekocht/Afgewezen selection and optional note field
6. **Grouped by gemeente** — `useMemo` groups favorites by `gemeente_naam` with expandable accordion
7. **Search** — Text search across address, parcel_id, and gemeente name
8. **Navigation** — Click parcel to navigate to map with parcel highlighted via `toMapParcelSearch`

The only roadmap item not present is **"completeness indicators show data coverage per parcel"**. This requires data that doesn't exist on `FavoriteResponse` — it would need a backend endpoint that joins favorites with `scan_results.flags` to compute data coverage per parcel. This is backend enrichment work, not frontend restructuring, and should be deferred.

## Recommendation

**No code changes needed.** The slice as described in the roadmap is already built. The opgeslagen page has all the features specified in the roadmap's "After this" description. The PIPE-01 through PIPE-05 requirements are all satisfied by the existing implementation.

The completeness indicator gap should be documented as a follow-up — it requires a new backend endpoint or enriching the favorites API response with scan data.

## Implementation Landscape

### Key Files

- `frontend/src/routes/_authenticated/opgeslagen.tsx` (485 lines) — Complete implementation with pipeline stage management, filtering, search, gemeente grouping, Afgerond reason modal
- `frontend/src/hooks/useFavorites.ts` (233 lines) — `useParcelFavorites`, `useToggleFavorite`, `useUpdatePipelineStage` with optimistic updates
- `frontend/src/lib/types/portfolio.ts` (77 lines) — `FavoriteResponse`, `PipelineStage`, `PortfolioResponse` types
- `frontend/src/hooks/useFavoriteCentroids.ts` (34 lines) — Map markers hook (already wired in S04)

### Verification Approach

- `npx tsc --noEmit` — TypeScript clean
- Navigate to /opgeslagen — page loads with grouped favorites
- Pipeline stage pills visible per parcel
- Click stage pill → dropdown shows 5 stages → selecting updates
- Stage filter bar at top filters across all gemeente groups
- Afgerond triggers reason modal (Gekocht/Afgewezen + note)
- Search filters by address/parcel/gemeente

## Constraints

- `FavoriteResponse` has no completeness/data-coverage fields — backend would need to join with `scan_results` to provide this
- No backend changes in M002 scope — all existing APIs remain unchanged

## Sources

- opgeslagen.tsx — full page implementation
- useFavorites.ts — all CRUD + pipeline hooks
- portfolio.ts — type definitions matching backend schemas
- favorites/router.py — backend API endpoints (unchanged)
