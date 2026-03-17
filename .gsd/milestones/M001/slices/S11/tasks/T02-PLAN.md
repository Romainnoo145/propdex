# T02: 110-projectlist-refactor-heartbutton 02

**Slice:** S11 — **Milestone:** M001

## Description

Add a heart button to the parcel detail panel that lets users favorite/unfavorite parcels with optimistic updates, backed by the Phase 109 favorites API.

Purpose: FAV-01 (toggle favorite from parcel panel) and FAV-02 (heart button positioned next to close button) are the core user-facing features of v17.0.

Output: Portfolio types, useFavorites hook with optimistic TanStack Query mutations, HeartButton component, ParcelPanelShell header slot modification.

## Must-Haves

- [ ] "Heart button appears next to the close button on the parcel detail panel"
- [ ] "Clicking the heart button toggles favorite state immediately (optimistic update) and persists server-side"
- [ ] "Heart button reflects correct filled/unfilled state when the same parcel is reopened in a new session"
- [ ] "Unfavoriting via heart button removes the favorite server-side (DELETE endpoint)"

## Files

- `frontend/src/lib/types/portfolio.ts`
- `frontend/src/hooks/useFavorites.ts`
- `frontend/src/components/map/panels/parcel/HeartButton.tsx`
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx`
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx`
