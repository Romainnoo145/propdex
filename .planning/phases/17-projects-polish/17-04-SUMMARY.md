---
phase: 17-projects-polish
plan: 04
subsystem: frontend-integration
tags:
  - typescript
  - react
  - responsive
  - force-refresh
  - navigation
  - report-detail
dependency-graph:
  requires:
    - frontend/src/components/ui/Drawer.tsx (drawer primitive)
    - frontend/src/lib/api.ts (lookupProperty function)
    - frontend/src/hooks/usePropertyLookup.ts (mutation hook)
    - frontend/src/routes/_authenticated/map.tsx (map page)
    - frontend/src/components/property/PropertyDetailDrawer.tsx (drawer content)
  provides:
    - Responsive Drawer (bottom sheet on mobile, right panel on desktop)
    - Force refresh wiring (force_refresh query param to backend)
    - Centralized flyTo navigation (mapReady state + dedicated effects)
    - Full detail report page at /rapport/:id
    - Light theme for non-map pages (projecten, rapport)
  affects:
    - All property viewing workflows
    - Cross-route navigation (projecten → rapport, rapport → map)
tech-stack:
  added: []
  patterns:
    - mapReady state pattern for race-condition-free map operations
    - Declarative flyTo/geometry via useEffect (not mutation callbacks)
    - Light theme (stone-50 bg, white cards) for content pages
    - Demo data fallback for report detail view
---

## What Was Done

**Task 1: Responsive Drawer + Force Refresh** (commit c330217)
- Made Drawer component responsive: bottom sheet on mobile (<768px), right panel on desktop
- Added drag handle visible only on mobile, touch event stopPropagation
- Added `force_refresh` query param support to `lookupProperty` API function
- Updated `usePropertyLookup` mutation type to accept `forceRefresh` option
- Wired `handleForceRefresh` callback in map page with toast feedback

**Task 2: Human Verification + Bug Fixes** (7 additional commits)

Extensive user testing revealed multiple issues that were fixed iteratively:

1. **Blue buttons removed** (bad8e08) — Replaced `bg-blue-600` with glassmorphism styling in project modals
2. **White screen fix** (a6ef580) — Added dark background to authenticated layout for non-map pages
3. **Light theme redesign** (23c4f27) — User requested `bg-stone-50` with dark typography instead of dark theme for content pages. Complete rewrite of ProjectList, ProjectCreateModal, ProjectEditModal, and projecten page
4. **Expandable projects** (8b50b51) — Added accordion-style project cards with 16 demo reports across 3 demo projects (Venlo, Maastricht, Utrecht)
5. **Navigation regex fix** (ba7fa84) — Fixed `match(/\d+/)?.[1]` → `match(/\d+/)?.[0]` for huisnummer extraction
6. **FlyTo timing fix** (6889e6c) — Decoupled flyTo from mutation callbacks using `mapReady` state + dedicated `useEffect` hooks, preventing silent failures when map not yet initialized
7. **Full detail report page** (5fc04cd) — New `/rapport/:id` route with comprehensive property report view: Gebouw & BAG, Kadaster, Bestemmingsplan, Monument, AI Interpretatie, Bronnen. Light theme. AI parsing mock data added to Markt 1 Venlo demo

## Files Modified

| File | Action | Lines |
|------|--------|-------|
| `frontend/src/components/ui/Drawer.tsx` | Modified | Responsive bottom sheet / right panel |
| `frontend/src/lib/api.ts` | Modified | `force_refresh` query param |
| `frontend/src/hooks/usePropertyLookup.ts` | Modified | `forceRefresh` in mutation type |
| `frontend/src/routes/_authenticated/map.tsx` | Modified | flyTo effects, mapReady state, force refresh |
| `frontend/src/routes/_authenticated/projecten.tsx` | Modified | Light theme (`bg-stone-50`) |
| `frontend/src/routes/_authenticated/rapport.$id.tsx` | Created | Report detail page route |
| `frontend/src/components/reports/ReportDetailPage.tsx` | Created | Full detail report page (~400 lines) |
| `frontend/src/components/projects/ProjectList.tsx` | Modified | Expandable cards, demo data, light theme, `/rapport/:id` nav |
| `frontend/src/components/projects/ProjectCreateModal.tsx` | Modified | Light theme |
| `frontend/src/components/projects/ProjectEditModal.tsx` | Modified | Light theme |
| `frontend/src/lib/demo-data.ts` | Modified | AI parsing mock data for Markt 1 |

## Key Decisions

- **mapReady state pattern**: All map operations (flyTo, updatePropertyGeometry) flow through centralized useEffect hooks gated on `mapReady`, preventing race conditions when data arrives before map initialization
- **Light theme for content pages**: User explicitly requested `bg-stone-50` with dark typography for non-map pages, keeping glassmorphism for map overlays only
- **Report detail as own route**: `/rapport/:id` with search params for postcode/huisnummer — clean separation between map summary (drawer) and full detail view (page)
- **Demo report navigation**: ProjectList navigates to `/rapport/$id` with search params, route resolves demo data via `getDemoProperty(postcode, huisnummer)`

## Duration

- Task 1: ~3 minutes (auto execution)
- Task 2: ~90 minutes (human verification + 7 bug fix iterations)

## Commits

- `c330217` feat(17-04): make Drawer responsive, add force refresh wiring
- `bad8e08` fix(17): replace blue buttons with glassmorphism styling
- `a6ef580` fix(17): add dark background to authenticated layout
- `23c4f27` feat(17): light theme for projecten page with demo data fallback
- `8b50b51` feat(17): expandable project cards with demo reports
- `ba7fa84` fix(17): fix report-to-map navigation regex
- `6889e6c` fix(map): decouple flyTo from mutation callbacks
- `5fc04cd` feat(rapport): add full detail report page at /rapport/:id
