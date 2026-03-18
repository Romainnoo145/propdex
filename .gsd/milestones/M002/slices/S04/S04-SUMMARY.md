---
id: S04
parent: M002
milestone: M002
provides:
  - Color mode selector in LayerToggle exposing 6 parcel overlay modes
  - Per-mode legend component (OverlayLegend) replacing inline gradient
  - Favorite parcel markers wired into map (already existed, already wired)
requires:
  - S01 (clean nav structure)
affects:
  - S05
key_files:
  - frontend/src/components/map/LayerToggle.tsx
  - frontend/src/components/map/OverlayLegend.tsx
  - frontend/src/routes/_authenticated/map.tsx
key_decisions:
  - Dropdown popover (not pill row) for overlay mode selection — 6 modes too many for inline pills
  - AnimatePresence for dropdown open/close animation
  - Click-outside handler via mousedown listener for dropdown dismissal
  - OverlayLegend as separate component with LEGEND_MAP record pattern for per-mode rendering
  - FavoriteMarkersLayer was already fully wired (imports, hook, effects) — no T02 changes needed
patterns_established:
  - OVERLAY_TO_MODE mapping constant for ParcelOverlayLayerId → internal mode key translation
  - OverlayLegend component pattern — takes activeOverlay + visible, renders appropriate legend
observability_surfaces:
  - Active overlay mode visible in LayerToggle button label
  - Per-mode legend provides immediate visual feedback of active color scheme
drill_down_paths:
  - none — single execution context
duration: 15m
verification_result: passed
completed_at: 2026-03-17
---

# S04: Map Color Modes + Kansenkaart

**LayerToggle now exposes 6 parcel overlay modes via a dropdown selector. Per-mode legends show color keys. Favorite markers were already wired.**

## What Happened

**T01** added a color mode selector dropdown to LayerToggle.tsx. When parcels are active, a button showing the current overlay label (e.g. "Potentie ▾") appears. Clicking it opens an upward popover listing all 6 overlay modes from MAP_LAYER_CATALOG with labels and descriptions. Selecting a mode calls the existing `setParcelOverlayMode()` which handles mutual exclusivity (one layer visible, rest hidden). The dropdown uses AnimatePresence for open/close animation and a mousedown click-outside handler for dismissal.

Created `OverlayLegend.tsx` — a component that renders the appropriate legend per overlay mode. The potential gradient legend was extracted from the inline JSX in map.tsx (lines 2271-2282) into this component. Added legends for all 6 modes matching the paint expressions in ParcelScoreLayer.tsx: potential (gradient bar), built_status (red/green dots), report_coverage (amber/grey dots), vacancy_signal (4 color dots), build_capacity (FAR/TAR categories), foundation_risk (bouwjaar categories).

**T02** required no changes — FavoriteMarkersLayer.ts and useFavoriteCentroids.ts were already fully wired in map.tsx (imports at lines 75-78, hook call at line 317, layer creation at line 1188, update effect at lines 1240-1245). The implementation was complete from a previous phase.

## Verification

- `npx tsc --noEmit` — clean, no TypeScript errors
- Browser tested: Perceel activation shows "Potentie ▾" button + gradient legend
- Clicked dropdown: all 6 modes listed with labels and descriptions
- Switched to "Bebouwd/Leeg" — map repainted, legend changed to red/green dots
- Switched to "Funderingsrisico" — map repainted, legend changed to bouwjaar categories
- Switched back to "Potentie" — original gradient restored
- Default behavior unchanged — parcels still default to 'potential' overlay on activation

## Requirements Advanced

- FAV-03 (favorite markers on map) — already wired before this slice

## Requirements Validated

- none new — FAV-03 was already delivered

## New Requirements Surfaced

- none

## Requirements Invalidated or Re-scoped

- none

## Deviations

- T02 required no code changes — FavoriteMarkersLayer was already wired in map.tsx

## Known Limitations

- Overlay modes only show colored parcels when scan data is loaded (parcels need `score`, `has_pand`, etc. MVT properties). Without an active scan, switching modes shows parcels without fill colors.
- Dropdown menu opens upward which is correct for bottom-positioned toggle, but on very small screens the menu may extend above viewport.

## Follow-ups

- S05 will rebuild /opgeslagen — no dependencies on color mode selector

## Files Created/Modified

- `frontend/src/components/map/LayerToggle.tsx` — Added overlay mode selector dropdown with OVERLAY_TO_MODE mapping, click-outside handler, AnimatePresence popover
- `frontend/src/components/map/OverlayLegend.tsx` — New component with per-mode legend rendering
- `frontend/src/routes/_authenticated/map.tsx` — Replaced inline gradient legend with OverlayLegend component, added OverlayLegend import

## Forward Intelligence

### What the next slice should know
- The overlay selector is purely client-side — no new API calls, no backend changes. All 6 modes existed as hidden layers; this slice just exposed the switching UI.
- OverlayLegend is a standalone component — can be reused or extended without touching LayerToggle.

### What's fragile
- The OVERLAY_TO_MODE mapping must stay in sync with MAP_LAYER_CATALOG.parcelOverlays and `setParcelOverlayMode()` internal keys. If a new overlay is added to the catalog, both must be updated.

### Authoritative diagnostics
- `npx tsc --noEmit` — contract check for all imports and types
- MAP_LAYER_CATALOG in layers.ts — single source of truth for overlay definitions
- ParcelScoreLayer.tsx paint expressions — authoritative color values that legends must match

### What assumptions changed
- T02 (favorite markers) was already done — the FavoriteMarkersLayer was wired in a previous phase. The roadmap/plan anticipated this as new work but it was already complete.
