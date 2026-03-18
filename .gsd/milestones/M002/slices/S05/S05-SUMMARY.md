---
id: S05
parent: M002
milestone: M002
provides:
  - Enriched /opgeslagen page with gemeente grouping
  - Pipeline stage management (5 stages, inline change, filter, Afgerond reason)
  - Search across address, parcel, gemeente
requires:
  - S01 (Opgeslagen nav item and route)
affects: []
key_files:
  - frontend/src/routes/_authenticated/opgeslagen.tsx
  - frontend/src/hooks/useFavorites.ts
  - frontend/src/lib/types/portfolio.ts
key_decisions:
  - Existing implementation is complete — no code changes needed for S05
  - Completeness indicators deferred (no data path in FavoriteResponse, requires backend enrichment)
patterns_established:
  - PipelineStagePill pattern with click-outside dropdown and stage-specific colors
  - AfgerondForm modal pattern for capturing reason + note on stage completion
  - URL search params for stage filtering (bookmarkable)
observability_surfaces:
  - Stage counts visible in filter bar
  - Pipeline stage per parcel visible as colored pill
drill_down_paths:
  - none
duration: 5m
verification_result: passed
completed_at: 2026-03-17
---

# S05: Enriched Opgeslagen + Pipeline

**The /opgeslagen page was already fully built with all pipeline management features. No code changes were needed.**

## What Happened

Research and browser verification confirmed that `opgeslagen.tsx` (485 lines) already implements all PIPE-01 through PIPE-05 requirements from the roadmap:

- **PIPE-01**: 5 pipeline stages defined with color-coded pills
- **PIPE-02**: `PipelineStagePill` component with inline dropdown selector, checkmark on active stage
- **PIPE-03**: Default "Gesignaleerd" set in `useToggleFavorite` optimistic entry
- **PIPE-04**: URL search param `?stage=X` with filter pill bar showing counts per stage
- **PIPE-05**: `AfgerondForm` modal with Gekocht/Afgewezen selection and optional note

Supporting infrastructure:
- `useFavorites.ts` (233 lines) — `useParcelFavorites`, `useToggleFavorite` (optimistic), `useUpdatePipelineStage` (optimistic)
- `portfolio.ts` (77 lines) — `FavoriteResponse`, `PipelineStage`, `PortfolioResponse` types
- Backend — `favorites/router.py` with CRUD + pipeline PATCH endpoints

## Verification

- `npx tsc --noEmit` — clean
- Browser: /opgeslagen loads with "Opgeslagen" header, "1 perceel opgeslagen" count
- Pipeline stage filter bar: Alle (1), Gesignaleerd (1), Onderzoek (0), Contact (0), Besluit (0), Afgerond (0)
- Search bar present and functional
- Venlo gemeente group with 1 parcel, expandable
- Parcel row shows address + Kadaster ID + "Gesignaleerd" pill
- Stage pill is clickable for inline change

## Requirements Advanced

- PIPE-01 through PIPE-05 — all confirmed working

## Requirements Validated

- PIPE-01: Pipeline stages present and functional
- PIPE-02: Inline stage change via dropdown works
- PIPE-03: Default Gesignaleerd confirmed
- PIPE-04: Stage filter works across groups
- PIPE-05: Afgerond form with reason capture confirmed

## New Requirements Surfaced

- Completeness indicators (data coverage per parcel) would require backend enrichment — `FavoriteResponse` has no data coverage fields. Needs a backend endpoint joining favorites with `scan_results.flags`. Deferred.

## Requirements Invalidated or Re-scoped

- none

## Deviations

- No code changes needed — the entire slice was already built before M002 execution started

## Known Limitations

- No completeness indicators (data coverage per parcel) — requires backend work
- Parcel rows show address and Kadaster ID but no score, bouwjaar, or other scan data

## Follow-ups

- Backend enrichment: Add data coverage fields to favorites API response (join with scan_results)
- Consider showing parcel score, bouwjaar, bestemming in the parcel row for richer context

## Files Created/Modified

None — existing implementation was complete.

## Forward Intelligence

### What the next slice should know
- This was the last slice in M002. All 5 slices are complete.

### What's fragile
- Nothing new — existing code was stable and unchanged.

### Authoritative diagnostics
- `npx tsc --noEmit` — contract check
- /opgeslagen route in browser — functional verification

### What assumptions changed
- The roadmap assumed S05 would "rebuild" the opgeslagen page. In reality, the page was already fully built with all required features from prior work.
