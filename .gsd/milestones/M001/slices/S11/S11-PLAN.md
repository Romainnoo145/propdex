# S11: Projectlist Refactor Heartbutton

**Goal:** Extract the 1867-line ProjectList.
**Demo:** Extract the 1867-line ProjectList.

## Must-Haves


## Tasks

- [x] **T01: 110-projectlist-refactor-heartbutton 01**
  - Extract the 1867-line ProjectList.tsx monolith into sub-components, each under 300 lines, before v17 portfolio features compound the problem.

Purpose: BACK-05 requires this refactor before new features. The file has ~50 hooks/memos in a single closure — extracting view branches as presentational components receiving computed props keeps the refactor mechanical and safe.

Output: 5 new/modified files, each under 300 lines. ProjectList.tsx becomes a thin re-export wrapper for backward compatibility.
- [x] **T02: 110-projectlist-refactor-heartbutton 02** `est:4min`
  - Add a heart button to the parcel detail panel that lets users favorite/unfavorite parcels with optimistic updates, backed by the Phase 109 favorites API.

Purpose: FAV-01 (toggle favorite from parcel panel) and FAV-02 (heart button positioned next to close button) are the core user-facing features of v17.0.

Output: Portfolio types, useFavorites hook with optimistic TanStack Query mutations, HeartButton component, ParcelPanelShell header slot modification.

## Files Likely Touched

- `frontend/src/components/projects/ProjectList.tsx`
- `frontend/src/components/projects/ProjectenPage.tsx`
- `frontend/src/components/projects/ProvincieView.tsx`
- `frontend/src/components/projects/GemeenteView.tsx`
- `frontend/src/components/projects/WijkView.tsx`
- `frontend/src/components/projects/ProjectIcons.tsx`
- `frontend/src/lib/types/portfolio.ts`
- `frontend/src/hooks/useFavorites.ts`
- `frontend/src/components/map/panels/parcel/HeartButton.tsx`
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx`
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx`
