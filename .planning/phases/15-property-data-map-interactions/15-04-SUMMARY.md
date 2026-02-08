---
phase: 15
plan: 04
subsystem: frontend-ui
status: complete
completed: 2026-02-08

requires:
  - 15-01 # Frontend Data Layer (PropertyReportResponse types)
  - 15-02 # Parcel Boundaries Layer (glassmorphism patterns)

provides:
  - PropertyDetailPanel component tree
  - PropertyGeometryLayer map utilities
  - Progressive disclosure UI pattern
  - Mobile-responsive property panel

affects:
  - 15-05 # Property Lookup Integration (will wire PropertyDetailPanel)

tech-stack:
  added: []
  patterns:
    - Progressive disclosure with collapsible sections
    - Glassmorphism styling for floating panels
    - Touch event propagation prevention on mobile
    - Skeleton loading states

key-files:
  created:
    - frontend/src/components/property/PropertySection.tsx
    - frontend/src/components/property/PropertySummary.tsx
    - frontend/src/components/property/PropertyDetailPanel.tsx
    - frontend/src/components/map/PropertyGeometryLayer.tsx
  modified: []

decisions:
  - decision: "No external accordion/disclosure library - simple controlled state"
    rationale: "Avoid adding Headless UI dependency, keep bundle small"
    alternatives: ["Headless UI Disclosure", "Radix UI Accordion"]
  - decision: "max-height transition for section open/close animation"
    rationale: "Simple CSS-only animation, smooth and performant"
    alternatives: ["grid-rows animation", "height: auto transition"]
  - decision: "Desktop right sidebar, mobile bottom sheet responsive pattern"
    rationale: "Maximizes map visibility on mobile, natural desktop UX"
    alternatives: ["Full-screen modal on mobile", "Same layout both devices"]
  - decision: "Touch event stopPropagation on panel container"
    rationale: "Prevents map panning when scrolling panel on mobile"
    alternatives: ["Disable map interaction when panel open", "Custom scroll lock"]

metrics:
  duration: "2m 54s"
  tasks_completed: 2
  files_created: 4
  commits: 2

tags:
  - frontend
  - ui-components
  - progressive-disclosure
  - glassmorphism
  - mobile-responsive
  - maplibre
  - geojson
---

# Phase 15 Plan 04: Property Detail Panel & Geometry Layer Summary

**One-liner:** Floating property detail panel with progressive disclosure sections and map geometry rendering (blue property polygons, amber parcel boundaries).

## Overview

Built the complete property detail panel UI component tree with PropertySummary, PropertySection (collapsible sections), and PropertyDetailPanel (floating container). Created PropertyGeometryLayer utilities to render property/parcel geometries on the map as GeoJSON layers.

**Status:** ✅ Complete
**Duration:** 2 minutes 54 seconds
**Verification:** npm run check passes, no type or lint errors

## What Was Built

### Components Created

**1. PropertySection.tsx** (Collapsible section component)
- Controlled open/close state with defaultOpen prop
- Smooth max-height transition animation
- Chevron icon rotates 180deg when open
- Glassmorphism styling (border-white/10, hover:bg-white/5)
- Optional leading icon prop

**2. PropertySummary.tsx** (Property metrics summary card)
- Address display: straat + huisnummer + huisletter + toevoeging
- Postcode + woonplaats
- 3-column metric grid: Bouwjaar, Oppervlakte, Bestemming
- Monument badge (amber) when is_monument is true
- Completeness score progress bar (green fill)
- Handles null values gracefully ("Onbekend", "–")

**3. PropertyDetailPanel.tsx** (Main floating panel container)
- Three states: loading, error, data
- Header with "Eigendomsinformatie" title + close button
- Escape key handler to close panel
- Touch event propagation prevention for mobile scroll
- Desktop: right sidebar (absolute right-4, w-96)
- Mobile: bottom sheet (absolute bottom-0, h-[60vh]) at < 768px breakpoint

**Panel sections:**
- PropertySummary (always visible)
- Kadaster: List of cadastral_parcels with aanduiding, perceelnummer, sectie, oppervlakte
- Bestemming: Primary bestemming, building dimensions (max_hoogte, max_goothoogte, max_bebouwingspercentage, FSI), zoning plans with rules, data gaps warning
- Monument: Status badge (green "Geen monument" or amber "Rijksmonument"), conflict warning, restrictions list, sources
- Bronnen: Section sources with age formatting (Zojuist, X min geleden, X uur geleden, X dagen geleden), confidence badges (HIGH=green, MEDIUM=yellow, LOW=red)

**Loading state:** 5 skeleton blocks with animate-pulse
**Error state:** Error icon + Dutch message + "Probeer opnieuw"

**4. PropertyGeometryLayer.tsx** (Map GeoJSON utilities)

`updatePropertyGeometry(map, data)`:
- Clears existing layers first (prevents "already exists" errors)
- Adds property_geometry as blue polygon (var(--color-primary), opacity 0.15)
- Adds cadastral_parcels as amber polygons (#f59e0b, opacity 0.08, dashed lines)
- Flies to center_wgs84 at zoom 17 with 1s animation

`clearPropertyGeometry(map)`:
- Removes 4 layers (property fill/line, parcel fill/line)
- Removes 2 sources (property, parcels)
- Always checks existence before removal (safe, no errors)

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create PropertySection and PropertySummary | `6a4cc46` | PropertySection.tsx, PropertySummary.tsx |
| 2 | Create PropertyDetailPanel and PropertyGeometryLayer | `39bc385` | PropertyDetailPanel.tsx, PropertyGeometryLayer.tsx |

## Technical Decisions

### Progressive Disclosure Pattern
Used simple controlled state for sections rather than Headless UI or Radix. Keeps bundle size small, no external dependency needed. Max-height transition provides smooth CSS-only animation.

### Responsive Layout Strategy
Desktop: Right sidebar preserves map visibility on large screens.
Mobile: Bottom sheet pattern maximizes map space on small screens.
Breakpoint: 768px (Tailwind md:)

### Touch Event Handling
Added stopPropagation on panel container's touch events (onTouchStart, onTouchMove, onTouchEnd). Prevents map panning/zooming when user scrolls panel content on mobile.

### GeoJSON Type Safety
Used `as unknown as GeoJSON.Geometry` double cast to bridge GeoJSONGeometry (Record<string, unknown>) with MapLibre's GeoJSON.Geometry type. Necessary because backend returns untyped JSON, frontend needs strict GeoJSON types.

### Map Layer Management
Always clear before adding (prevents duplicate layer errors). Always remove layers before sources (MapLibre requirement). Always check existence before removal (safe, no "layer not found" errors).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Type errors with GeoJSONGeometry → GeoJSON.Geometry cast:**
- Problem: GeoJSONGeometry is Record<string, unknown>, MapLibre expects GeoJSON.Geometry
- Solution: Used `as unknown as GeoJSON.Geometry` double cast (Rule 1 - Bug fix)
- Files: PropertyGeometryLayer.tsx

**Type error with center_wgs84 array indexing:**
- Problem: TypeScript inferred `number | undefined` for array[0] and array[1]
- Solution: Added length check and explicit `as number` cast
- Files: PropertyGeometryLayer.tsx

## Testing Notes

**Manual verification needed:**
- PropertyDetailPanel shows loading skeleton while fetching
- Error state displays Dutch message when API fails
- PropertySummary displays all metrics from PropertyReportResponse
- PropertySection toggles open/close with smooth animation
- PropertyGeometryLayer renders blue property polygon + amber parcel boundaries
- Map flies to center on data load
- Escape key closes panel
- Mobile bottom sheet layout at < 768px
- Touch scrolling panel doesn't pan map on mobile

## Next Phase Readiness

**Ready for:**
- Phase 15-05: Wire PropertyDetailPanel into MapView, connect to property lookup hook, handle map click events

**Blocks:** None

**Concerns:** None

## Self-Check: PASSED

All created files exist:
- frontend/src/components/property/PropertySection.tsx ✓
- frontend/src/components/property/PropertySummary.tsx ✓
- frontend/src/components/property/PropertyDetailPanel.tsx ✓
- frontend/src/components/map/PropertyGeometryLayer.tsx ✓

All commits exist:
- 6a4cc46 ✓
- 39bc385 ✓
