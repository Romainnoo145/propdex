# S04: Map Color Modes + Kansenkaart

**Goal:** LayerToggle exposes 6 parcel overlay modes via a user-facing selector. Favorited parcels show red circle markers on the map. Each overlay mode has a matching legend.
**Demo:** With parcels active, user clicks a color mode selector and switches between Potentie / Bebouwd/Leeg / Rapporten / Leegstand / Planruimte / Funderingsrisico. Map tiles repaint instantly (client-side, no API calls). A per-mode legend appears bottom-right. Favorited parcels show as red dots regardless of active overlay.

## Must-Haves

- Color mode selector visible when parcels are active, showing all 6 overlay modes from MAP_LAYER_CATALOG
- Clicking a mode switches the visible fill layer via existing setParcelOverlayMode() — instant repaint
- Active mode visually indicated in the selector
- Per-mode legend (colors + labels) displayed when that mode is active
- Favorite parcel markers (red circles) rendered on map using existing FavoriteMarkersLayer
- Markers always visible (not gated by Percelen toggle)
- Default behavior unchanged — parcels still default to 'potential' overlay

## Verification

- `cd frontend && npx tsc --noEmit` — clean
- LayerToggle shows color mode selector when parcels are active
- All 6 modes selectable, each changes parcel fill colors on the map
- Legend changes per active mode with correct colors/labels
- Favorite markers appear after favoriting a parcel (red circle at centroid)
- Markers persist across overlay mode switches
- No regressions: default Perceel activation still shows potential/score overlay

## Tasks

- [x] **T01: Color mode selector UI + per-mode legends** `est:45m`
  - Why: Users currently have no way to switch between the 6 existing overlay modes. This is the core "Kansenkaart" feature — exposing map intelligence layers.
  - Files: `frontend/src/components/map/LayerToggle.tsx`, `frontend/src/components/map/OverlayLegend.tsx` (new), `frontend/src/routes/_authenticated/map.tsx`
  - Do:
    1. In LayerToggle.tsx, when `showParcels` is true, add a secondary row or popover showing the 6 overlay modes from `MAP_LAYER_CATALOG.parcelOverlays`. Each item shows the label. Clicking calls `setParcelOverlayMode()` with the corresponding mode key. Active mode gets a visual indicator (filled pill, highlight, etc.). Use the existing ToggleButton pattern or a compact pill row.
    2. Add a new `onOverlayChange` prop to LayerToggle that calls `layerActions.setActiveParcelOverlay()` in map.tsx — OR keep the existing internal `setParcelOverlayMode` + `activeParcelOverlay` prop flow (simpler, already wired). The `activeParcelOverlay` prop already tells LayerToggle which mode is active.
    3. Create `OverlayLegend.tsx` — a component that takes `activeOverlay: ParcelOverlayLayerId | null` and renders the appropriate legend. Extract the existing inline gradient legend from map.tsx (lines 2271-2282) into this component for the 'potential' mode. Add legends for:
       - `potential`: amber→green gradient bar, "40" to "100"
       - `built_status`: red dot "Bebouwd" + green dot "Onbebouwd"
       - `report_coverage`: amber dot "Rapport" + grey dot "Geen rapport"
       - `vacancy_signal`: green "Leeg perceel" + amber "Leegstaand" + red "In gebruik" + grey "Onbekend"
       - `build_capacity`: green→amber→grey gradient matching FAR/TAR thresholds
       - `foundation_risk`: amber "Hoog (pre-1970)" + light amber "Middel (1970-1990)" + grey "Laag (post-1990)"
    4. In map.tsx, replace the inline gradient legend div (lines 2271-2282) with `<OverlayLegend activeOverlay={layerState.activeParcelOverlay} visible={layerState.showParcels && !!activeScanId} />`. Position same as current (absolute bottom-4 right-4).
    5. Map the overlay mode IDs to the internal setParcelOverlayMode keys: potential→score, built_status→built, report_coverage→report, vacancy_signal→vacancy, build_capacity→capacity, foundation_risk→foundation.
  - Verify: `npx tsc --noEmit` passes. Visual: with parcels on, selector shows 6 modes. Clicking each changes map colors. Legend updates per mode.
  - Done when: All 6 overlay modes are user-selectable, each has a visible legend, and default (potential) behavior is unchanged.

- [x] **T02: Wire favorite markers into the map** `est:20m`
  - Why: FAV-03 requires favorited parcels to show a distinct marker on the map. FavoriteMarkersLayer and useFavoriteCentroids already exist but aren't connected.
  - Files: `frontend/src/routes/_authenticated/map.tsx`
  - Do:
    1. Import `addFavoriteMarkersLayer`, `updateFavoriteMarkers`, `removeFavoriteMarkersLayer` from `@/components/map/FavoriteMarkersLayer`.
    2. Import `useFavoriteCentroids` from `@/hooks/useFavoriteCentroids`.
    3. Call `useFavoriteCentroids()` at the top of the MapPage component (alongside other hooks).
    4. Add an effect that calls `addFavoriteMarkersLayer(map)` when `mapReady` is true. Must be called AFTER `addParcelScoreLayer` to render on top — place after the existing score layer setup effect. Add cleanup via `removeFavoriteMarkersLayer`.
    5. Add an effect that calls `updateFavoriteMarkers(map, centroids.data ?? [])` whenever centroids data changes. Guard on `mapReady` and `map.getSource('favorite-markers')`.
    6. Markers are NOT gated by `layerState.showParcels` — they serve portfolio awareness and should always be visible when user has favorites.
  - Verify: `npx tsc --noEmit` passes. After favoriting a parcel, a red circle marker appears at its centroid on the map. Marker persists across overlay mode switches and when parcels toggle is off.
  - Done when: Favorited parcels show red circle markers on the map at all times.

## Files Likely Touched

- `frontend/src/components/map/LayerToggle.tsx`
- `frontend/src/components/map/OverlayLegend.tsx` (new)
- `frontend/src/routes/_authenticated/map.tsx`
