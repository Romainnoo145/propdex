# S04: Map Color Modes + Kansenkaart — Research

**Date:** 2026-03-17

## Summary

This slice is straightforward application of existing infrastructure. All the hard parts are already built:

1. **6 parcel overlay modes exist** in `ParcelScoreLayer.tsx` — potential, built_status, report_coverage, vacancy_signal, build_capacity, foundation_risk. Each has its own fill layer, visibility toggle function, and color scheme. They share a single MVT vector tile source.

2. **The overlay switching logic exists** in `LayerToggle.tsx` via `setParcelOverlayMode()` — it turns one layer visible and all others invisible. But there's **no UI** for the user to pick between modes. The toggle always defaults to 'score' (potential). The user only sees Gemeente | Perceel | Bestemmingsplan pills.

3. **FavoriteMarkersLayer.ts is fully implemented** — GeoJSON source + circle layer with red markers. `addFavoriteMarkersLayer()` and `updateFavoriteMarkers()` are ready to call. **But it's not wired into map.tsx at all** — zero imports, zero usage.

4. **useFavoriteCentroids.ts hook exists** — fetches `GET /api/parcels/favorites/centroids` returning `{ parcel_code, lon, lat }[]`. Backend endpoint exists in `favorites/router.py:161`. Hook is not used anywhere.

5. **MAP_LAYER_CATALOG** in `layers.ts` already has all 6 overlay definitions with Dutch labels and descriptions — ready for a dropdown UI.

The work is: (a) add a color mode selector UI inside LayerToggle, (b) wire FavoriteMarkersLayer + useFavoriteCentroids into map.tsx, (c) add per-mode legend components. No new backend endpoints, no new tile sources, no new data fetching.

## Recommendation

Two tasks:

**T01: Color mode selector in LayerToggle** — When parcels are active, show a dropdown/pill selector below the toggle bar (or as a popover from the Perceel button) exposing the 6 overlay modes from `MAP_LAYER_CATALOG.parcelOverlays`. Selecting a mode calls the existing `setParcelOverlayMode()` and updates `layerState.activeParcelOverlay` via existing `layerActions.setActiveParcelOverlay()`. Add per-mode legends (the potential gradient legend already exists inline in map.tsx — extract it and add equivalents for built_status, vacancy_signal, etc.).

**T02: Wire favorite markers into the map** — Import `addFavoriteMarkersLayer`/`updateFavoriteMarkers` and `useFavoriteCentroids` in map.tsx. On map ready, add the markers layer. When centroids data updates, call `updateFavoriteMarkers()`. Markers should always be visible when user has favorites (not gated by Percelen toggle). This satisfies FAV-03.

T01 is the larger task (UI component work + legend extraction). T02 is small wiring work.

## Implementation Landscape

### Key Files

- `frontend/src/components/map/LayerToggle.tsx` (319 lines) — Needs color mode selector UI. Currently has `setParcelOverlayMode()` internally but no user-facing control. The `activeParcelOverlay` prop already tracks which mode is active. Add a dropdown/popover showing `MAP_LAYER_CATALOG.parcelOverlays` when parcels are active.

- `frontend/src/components/map/ParcelScoreLayer.tsx` (616 lines) — **No changes needed.** All 6 overlay modes with their visibility toggle functions already exist.

- `frontend/src/lib/map/layers.ts` (93 lines) — **No changes needed.** `MAP_LAYER_CATALOG.parcelOverlays` already has all 6 modes with labels/descriptions.

- `frontend/src/lib/map/useMapLayerState.ts` (85 lines) — **No changes needed.** `setActiveParcelOverlay` action already exists.

- `frontend/src/routes/_authenticated/map.tsx` (~2345 lines) — Two changes: (1) Wire favorite markers layer + centroids hook. (2) Extract the inline score gradient legend (lines 2271-2282) into a component, add per-mode legends for other overlays, and conditionally show based on `layerState.activeParcelOverlay`.

- `frontend/src/components/map/FavoriteMarkersLayer.ts` (77 lines) — **No changes needed.** Complete implementation ready to use.

- `frontend/src/hooks/useFavoriteCentroids.ts` (34 lines) — **No changes needed.** Hook is complete and ready.

### Existing Patterns to Follow

1. **Overlay mode switching** — `setParcelOverlayMode('score' | 'built' | ...)` in LayerToggle.tsx already handles the mutual exclusivity (turns one on, rest off). The mode selector UI just needs to call this with the selected mode.

2. **ToggleButton with layoutId** — LayerToggle uses framer-motion `layoutId` for sliding pill indicators. The overlay selector could follow this pattern or use a simpler dropdown.

3. **MAP_LAYER_CATALOG** — Labels and descriptions for all 6 modes are pre-defined. Render these directly in the selector UI.

4. **Inline legend pattern** — The potential score gradient legend is already rendered inline in map.tsx (lines 2271-2282). Each overlay mode needs its own legend. Extract to a `<OverlayLegend overlay={activeParcelOverlay} />` component.

5. **FavoriteMarkersLayer** — Uses GeoJSON source pattern (not MVT tiles). `addFavoriteMarkersLayer()` on map ready, `updateFavoriteMarkers(centroids)` on data change. Same pattern as other GeoJSON layers in the codebase.

### Build Order

1. **T01: Color mode selector + legends** — This is the visible "Kansenkaart" feature. Add a selector UI in LayerToggle so users can switch between overlay modes. Extract the gradient legend from map.tsx into a reusable component, add legends for each mode. This delivers the "2+ switchable color modes" success criterion.

2. **T02: Favorite markers on map** — Wire the existing FavoriteMarkersLayer and useFavoriteCentroids into map.tsx. Delivers FAV-03. Small, independent task.

### Verification Approach

- **TypeScript**: `npx tsc --noEmit` passes
- **Color mode switching**: With a scan active and parcels visible, the overlay selector shows 6 modes. Clicking each mode changes the fill colors on the map (client-side repaint, no network requests). The active mode is visually indicated. A per-mode legend appears.
- **Favorite markers**: After favoriting a parcel, a red circle marker appears at the parcel centroid on the map. Markers persist regardless of which overlay mode is active. Markers update when favorites change.
- **No regressions**: Default behavior unchanged — parcels still default to 'potential' (score) overlay when enabled.

## Constraints

- `map.tsx` is ~2345 lines. Avoid adding significant logic — the color mode selector lives in LayerToggle, legends in their own component. map.tsx only gets wiring for favorite markers (~20 lines).
- ParcelScoreLayer and all existing overlay toggle handlers in map.tsx must remain unchanged.
- Favorite markers must NOT be gated by the Percelen toggle — they serve a different purpose (portfolio awareness).

## Common Pitfalls

- **Overlay mutual exclusivity** — `setParcelOverlayMode` already handles this correctly (shows one, hides rest). The UI just needs to call it. Don't add separate visibility logic.
- **Legend per mode** — Each overlay has a different color scheme and meaning. The legends need to match the actual paint expressions in ParcelScoreLayer.tsx. Check the paint properties for each layer.
- **FavoriteMarkersLayer z-order** — Must be added AFTER parcel score layers so markers render on top. The JSDoc in FavoriteMarkersLayer.ts already notes this.
- **Centroids empty on first load** — `useFavoriteCentroids` returns empty array when user has no favorites. `updateFavoriteMarkers()` with empty array is safe (clears markers).

## Sources

- ParcelScoreLayer.tsx — 6 overlay modes with paint expressions
- LayerToggle.tsx — setParcelOverlayMode() and activeParcelOverlay prop
- layers.ts — MAP_LAYER_CATALOG.parcelOverlays with labels/descriptions
- FavoriteMarkersLayer.ts — Complete GeoJSON marker layer implementation
- useFavoriteCentroids.ts — TanStack Query hook for centroid fetching
- favorites/router.py — Backend centroids endpoint at /favorites/centroids
