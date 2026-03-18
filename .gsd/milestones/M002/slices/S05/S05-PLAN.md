# S05: Enriched Opgeslagen + Pipeline

**Goal:** /opgeslagen shows favorited parcels grouped by gemeente with pipeline stage pills, inline stage changes, completeness indicators, and filter by pipeline stage.

**Demo:** Open /opgeslagen → parcels grouped by gemeente. Each parcel shows pipeline stage pill (Gesignaleerd by default). Click pill → dropdown to change stage. Select Afgerond → prompted for reason (Gekocht/Afgewezen). Filter bar at top to filter by stage. Completeness indicator shows data coverage.

## Must-Haves

- Pipeline stage pill on each parcel row (color-coded)
- Click pill → dropdown to change stage
- Afgerond captures reason (Gekocht/Afgewezen) with optional note
- Filter by pipeline stage across all gemeente groups
- Completeness indicator per parcel (based on available data sections)
- FAV-04: favorite count badge on gemeente headers
- ParcelDetailPanel and ParcelDetailModal NOT modified (KNOWLEDGE.md hard rule)

## Verification

- `cd frontend && npx tsc --noEmit` — no TypeScript errors
- Manual: pipeline stage pills visible on each parcel
- Manual: change stage via dropdown
- Manual: Afgerond shows reason input
- Manual: filter by stage works

## Tasks

- [ ] **T01: Pipeline stage pills, stage change dropdown, filters, and Afgerond reason** `est:1.5h`
  - Why: All pipeline UI is tightly coupled — pills need the dropdown, dropdown needs the Afgerond modal, filter needs the pills to show stage. Single task.
  - Files: `frontend/src/routes/_authenticated/opgeslagen.tsx`, `frontend/src/lib/types/portfolio.ts`
  - Do:
    1. Add pipeline stage filter bar at top of page: row of pill buttons for each stage + "Alle" default. Filter state in URL search params. Clicking a stage filters all groups.
    2. Update ParcelRow to show pipeline stage pill (color per stage: Gesignaleerd=neutral, Onderzoek=blue, Contact=amber, Besluit=purple, Afgerond=green/red depending on reden).
    3. Add click handler on pill → opens inline dropdown with stage options. Use a simple popover or select pattern.
    4. When selecting Afgerond → show a small modal/form for reason (Gekocht/Afgewezen radio) + optional notitie textarea. Submit calls `useUpdatePipelineStage`.
    5. For other stages → call `useUpdatePipelineStage` directly on selection.
    6. Add completeness indicator: show a small progress bar or percentage based on flags data coverage (if available from FavoriteResponse).
    7. Add validateSearch to opgeslagen route for pipeline_stage filter param.
  - Verify: `cd frontend && npx tsc --noEmit`. Stage pills visible. Stage change works. Filter works. Afgerond reason captured.
  - Done when: Full pipeline management UI works in /opgeslagen with filtering and reason capture.

## Files Likely Touched

- `frontend/src/routes/_authenticated/opgeslagen.tsx`
