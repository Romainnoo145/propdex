---
phase: 13-map-foundation-layout
plan: 03
subsystem: ui
tags: [maplibre-gl, layer-toggle, esri, glassmorphism]

# Dependency graph
requires:
  - phase: 13-02
    provides: MapView component with dual tile sources, AppLayout
provides:
  - LayerToggle component switching Kaart/Satellite views
  - ESRI World Imagery global satellite tiles
  - Dark background loading state
affects: [14-*, 15-*, 16-*, 17-*]

# Tech tracking
tech-stack:
  added: []
  changed:
    - "PDOK aerial → ESRI World Imagery (global coverage, no white borders)"
    - "PDOK topo → CartoDB Positron (modern greyscale)"
  patterns: [raster-opacity toggle, glassmorphism UI, dark loading background]

key-files:
  created:
    - frontend/src/components/map/LayerToggle.tsx
  modified:
    - frontend/src/components/map/MapView.tsx
    - frontend/src/lib/pdok.ts
    - frontend/src/App.tsx

self-check: PASSED
---

## Summary

Built the LayerToggle component and completed Phase 13 map foundation with human-verified visual checkpoint.

## What Was Built

**LayerToggle component** — glassmorphism pill toggle (bottom-left) switching between Kaart (CartoDB Positron greyscale) and Satellite (ESRI World Imagery) views. Kaart is default. Active button uses white/70 frosted glass, inactive uses transparent with white text.

**Tile provider changes:**
- Satellite: Switched from PDOK aerial (NL-only, white JPEG borders) to ESRI World Imagery (global coverage)
- Kaart: CartoDB Positron greyscale (from 13-02, confirmed working)
- Dark background layer (#1a1a2e) shows while tiles load

**Layer toggle logic:** Both layers toggled via raster-opacity (0/1) with 300ms transition. Carto hidden in satellite mode to prevent bleed-through while panning.

## Deviations from Plan

1. **ESRI instead of PDOK aerial** — PDOK aerial tiles are NL-only JPEGs with baked-in white backgrounds for ocean/borders. Looks broken when zoomed out. ESRI World Imagery provides global satellite coverage.
2. **Glassmorphism styling** — Plan specified CSS variable primary color for active state. User requested glassmorphism: dark blur backdrop, rounded pill, white/70 active state.
3. **Button order swapped** — Plan had Satellite left, Kaart right. User requested Kaart left (default) and Satellite right.

## Commits

- `47b3152` feat(13-03): add LayerToggle component for aerial/topo layer switching
- `c7f48b3` fix(13-03): correct PDOK aerial tile layer name
- `967b04b` feat(13-03): replace PDOK topo with CartoDB Positron greyscale basemap
- `b392ab8` feat(13-03): default to Kaart (greyscale) layer on load
- `6769375` fix(13-03): simplify layer order and default opacity
- `b6f79b6` fix(13-03): glassmorphism toggle, button order, dark map background
- `671958e` fix(13-03): keep basemap visible under aerial overlay
- `46d842a` fix(13-03): restrict aerial tiles to NL bounds with minzoom
- `2ce360b` fix(13-03): replace PDOK aerial with ESRI World Imagery satellite
- `8b5bc2b` feat(13-03): add dark background layer for loading state
- `256a374` fix(13-03): hide carto layer when in satellite mode

## Human Verification

Verified by user at http://localhost:9300:
- Full-page map with greyscale default view ✓
- Layer toggle switches between Kaart and Satellite ✓
- ESRI satellite shows global coverage (no white borders) ✓
- Glassmorphism toggle styling approved ✓
- Dark loading background approved ✓
