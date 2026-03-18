# S05: Enriched Opgeslagen + Pipeline

**Goal:** /opgeslagen shows favorited parcels grouped by gemeente with pipeline stage management.
**Demo:** Already built — page displays gemeente-grouped favorites with pipeline stage pills, inline stage change dropdown, stage filtering, search, and Afgerond reason modal.

## Must-Haves

- Favorites grouped by gemeente with expandable accordion ✅
- Pipeline stage pills (Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond) ✅
- Inline pipeline stage change via dropdown ✅
- Default stage Gesignaleerd on favorite ✅
- Filter by pipeline stage across all groups ✅
- Afgerond captures reason (Gekocht/Afgewezen) with optional note ✅

## Verification

- `cd frontend && npx tsc --noEmit` — clean
- /opgeslagen loads with header, stage filter bar, search, gemeente groups
- Expanding a gemeente shows parcel rows with pipeline stage pills
- Clicking a pill opens dropdown to change stage
- Stage filter buttons filter across all gemeente groups
- Afgerond selection triggers reason modal

## Tasks

- [x] **T01: Verify existing implementation** `est:10m`
  - Why: Research revealed the opgeslagen page is already fully built with all PIPE-01 through PIPE-05 requirements
  - Files: `frontend/src/routes/_authenticated/opgeslagen.tsx`
  - Do: Verify TypeScript compiles, browser-test the page functionality
  - Verify: `npx tsc --noEmit` passes, browser shows working page with all features
  - Done when: All 5 PIPE requirements confirmed working in browser

## Files Likely Touched

None — existing implementation is complete.
