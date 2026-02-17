---
phase: 31-component-migration
plan: 03
subsystem: ui
tags: [react, tailwindcss, industrial-amber, glassmorphism-migration, design-system]

# Dependency graph
requires:
  - phase: 31-01
    provides: Drawer, Modal, SideRailNav, ReportSidebar migrated to Industrial Amber tokens
  - phase: 31-02
    provides: ResultsLayout, ResultsFilterPanel, ResultsTable, ParcelDetailModal migrated

provides:
  - PropertyDetailPanel with solid bg-grey-900 surface and bg-grey-850 inner data cells
  - PropertyDetailDrawer with grey tokens for all borders, text, and data cells
  - PropertyQuickCard with grey tokens for non-semantic elements; monument badges preserved
  - LayerToggle with bg-grey-900/90 backdrop-blur-md (DS-04 map-floating compliant)
  - AddressSearch with bg-grey-900/90 backdrop-blur-md (floating) and bg-grey-950 dropdown (solid)
  - Dashboard and instellingen placeholder pages with bg-grey-900 Industrial Amber tokens
affects: [31-04, any future component migration, map UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DS-04: map-floating elements use bg-grey-900/90 backdrop-blur-md; data panels use solid bg-grey-900
    - amber-accent active tab in map-floating controls (LayerToggle)
    - text-grey-100/400/600 three-tier text hierarchy established throughout property components
    - semantic amber/green monument badges preserved unchanged across all components

key-files:
  created: []
  modified:
    - frontend/src/components/property/PropertyDetailPanel.tsx
    - frontend/src/components/property/PropertyDetailDrawer.tsx
    - frontend/src/components/property/PropertyQuickCard.tsx
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/components/search/AddressSearch.tsx
    - frontend/src/routes/_authenticated/dashboard.tsx
    - frontend/src/routes/_authenticated/instellingen.tsx

key-decisions:
  - "PropertyDetailPanel and PropertyDetailDrawer use solid bg-grey-900 (data panels, not map-floating) — no backdrop-blur per DS-04"
  - "LayerToggle active tab uses bg-amber-accent text-grey-950 (amber accent on map controls is correct use of accent — persistent indicators like nav items should NOT use accent per Phase 31-01)"
  - "AddressSearch dropdown uses solid bg-grey-950 without backdrop-blur — dropdown is UI, not rendered over map canvas"
  - "PropertyDetailDrawer exceeds 300-line limit but glassmorphism migration is prioritized over splitting; file split is a follow-on concern"

patterns-established:
  - "Data panel pattern: bg-grey-900 outer surface, bg-grey-850 inner data cells, border-grey-800 all borders"
  - "Map-floating control pattern: bg-grey-900/90 backdrop-blur-md border border-grey-800 (DS-04 compliant)"
  - "Dropdown pattern: bg-grey-950 solid, border-grey-800, no blur — dropdowns sit in UI layer not map layer"
  - "Semantic badge preservation: bg-amber-500/N and bg-green-500/N badges are status indicators, not glassmorphism"

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 31 Plan 03: Property Components and Map Controls Migration Summary

**Seven components migrated from glassmorphism to Industrial Amber solid tokens: PropertyDetailPanel, PropertyDetailDrawer (773 lines), PropertyQuickCard, LayerToggle (DS-04 blur retained), AddressSearch (DS-04 blur on floating, solid on dropdown), and dashboard/instellingen placeholder pages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T07:00:48Z
- **Completed:** 2026-02-18T07:05:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- PropertyDetailPanel (605 lines) fully migrated: solid bg-grey-900 outer surface, bg-grey-850 data cells, border-grey-800, text-grey-100/400/600 hierarchy, backdrop-blur-xl removed
- PropertyDetailDrawer (773 lines — largest migration file) fully migrated: all glassmorphism classes replaced with grey tokens throughout all content components
- LayerToggle migrated with DS-04 compliant bg-grey-900/90 backdrop-blur-md (map-floating), amber-accent active tab
- AddressSearch migrated with DS-04 compliant bg-grey-900/90 backdrop-blur-md on floating elements, solid bg-grey-950 on dropdown
- PropertyQuickCard non-semantic elements migrated; semantic amber/green monument badges preserved
- Dashboard and instellingen placeholder cards migrated from glassmorphism to bg-grey-900 border-grey-800

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate PropertyDetailPanel, PropertyQuickCard, and placeholder pages** - `d0bf149` (feat)
2. **Task 2: Migrate PropertyDetailDrawer, LayerToggle, and AddressSearch** - `6f9f37c` (feat)

**Plan metadata:** [to be committed]

## Files Created/Modified

- `frontend/src/components/property/PropertyDetailPanel.tsx` - Solid bg-grey-900 outer surface, bg-grey-850 data cells, grey text hierarchy, no backdrop-blur
- `frontend/src/components/property/PropertyDetailDrawer.tsx` - All glassmorphism replaced; grey tokens for all borders/text/data cells/buttons throughout 773-line file
- `frontend/src/components/property/PropertyQuickCard.tsx` - bg-grey-800 detail button, grey-600 close button icon, grey-800 skeleton; amber/green monument badges preserved
- `frontend/src/components/map/LayerToggle.tsx` - bg-grey-900/90 backdrop-blur-md container, amber-accent active tab, grey-400 inactive text, grey-700 dividers
- `frontend/src/components/search/AddressSearch.tsx` - bg-grey-900/90 backdrop-blur-md for button/input, bg-grey-950 solid dropdown, grey-100/400/600 text
- `frontend/src/routes/_authenticated/dashboard.tsx` - bg-grey-900 border-grey-800 card, removed backdrop-blur-xl
- `frontend/src/routes/_authenticated/instellingen.tsx` - bg-grey-900 border-grey-800 card, removed backdrop-blur-xl

## Decisions Made

- **Data panels = solid, map-floating = blur**: PropertyDetailPanel and PropertyDetailDrawer use solid bg-grey-900 (DS-04 rule: data panels are not floating over the map canvas and do not need backdrop-blur)
- **amber-accent for map control active tab**: LayerToggle uses `bg-amber-accent text-grey-950` for the active layer tab — map controls are interactive widgets where accent color is appropriate (unlike persistent nav items in Phase 31-01 which use neutral grey)
- **AddressSearch dropdown uses bg-grey-950 solid**: The dropdown results list is UI, not rendered directly over the map canvas, so no backdrop-blur needed
- **PropertyDetailDrawer file splitting deferred**: At 773 lines, the file exceeds the 300-line limit; migration was prioritized first, splitting is a follow-on concern for a dedicated refactor phase

## Deviations from Plan

None - plan executed exactly as written. All substitutions applied per the DS-04 rules and substitution table in the plan.

## Issues Encountered

None - all seven files migrated cleanly with 0 new TypeScript or ESLint errors. Pre-existing 69 warnings are unchanged from before this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 31 Plan 03 complete: all seven files migrated
- PropertyDetailPanel, PropertyDetailDrawer, PropertyQuickCard, LayerToggle, AddressSearch, dashboard, and instellingen are now using Industrial Amber tokens
- Ready for Phase 31 Plan 04 (if planned) or next phase of v4.0 UX Redesign
- No glassmorphism remains except DS-04 compliant backdrop-blur on map-floating elements (LayerToggle, AddressSearch search button/input)

## Self-Check: PASSED

- PropertyDetailPanel.tsx: FOUND
- PropertyDetailDrawer.tsx: FOUND
- PropertyQuickCard.tsx: FOUND
- LayerToggle.tsx: FOUND
- AddressSearch.tsx: FOUND
- dashboard.tsx: FOUND
- instellingen.tsx: FOUND
- 31-03-SUMMARY.md: FOUND
- Commit d0bf149 (Task 1): FOUND
- Commit 6f9f37c (Task 2): FOUND

---
*Phase: 31-component-migration*
*Completed: 2026-02-18*
