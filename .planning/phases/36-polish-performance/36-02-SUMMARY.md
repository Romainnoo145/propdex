---
phase: 36-polish-performance
plan: "02"
subsystem: ui
tags: [tailwind, design-system, industrial-amber, css-variables, dark-mode]

# Dependency graph
requires: []
provides:
  - Auth UI (login, register, tabs, Google button) using correct Industrial Amber tokens
  - ReportDetailPage fully dark-themed with bg-grey-900/950 surfaces and text-grey hierarchy
  - BestemmingsplanLegend using dark Industrial Amber tokens (no backdrop-blur, no gray-*)
  - PropertyGeometryLayer using literal hex values for MapLibre paint (CSS vars removed)
  - Zero undefined CSS variable references in any .tsx file under frontend/src/
affects:
  - 36-03-polish (mobile blur reduction — legend already solid, auth flow already correct)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Undefined CSS var elimination: var(--color-primary/surface/text/border) -> Industrial Amber tokens"
    - "MapLibre paint: CSS variables unsupported, use literal hex (#d97706 for amber-accent)"
    - "Auth card surface: bg-grey-900 (not bg-white), tab active = border-amber-accent text-amber-accent"
    - "Report page chrome: bg-grey-950 (page), bg-grey-900 (cards), bg-grey-950 (nested items)"

key-files:
  created: []
  modified:
    - frontend/src/components/AuthLoadingScreen.tsx
    - frontend/src/components/ui/FormField.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/components/auth/RegisterForm.tsx
    - frontend/src/components/auth/GoogleButton.tsx
    - frontend/src/components/auth/AuthTabs.tsx
    - frontend/src/routes/auth/index.tsx
    - frontend/src/routes/auth/google-callback.tsx
    - frontend/src/components/map/PropertyGeometryLayer.tsx
    - frontend/src/components/reports/ReportDetailPage.tsx
    - frontend/src/components/map/BestemmingsplanLegend.tsx

key-decisions:
  - "LoginForm/RegisterForm submit button: bg-amber-accent text-grey-950 (dark text on amber per contrast requirements)"
  - "GoogleButton: border-grey-800 bg-grey-900 text-grey-100 — dark variant instead of white button (no bg-white in dark UI)"
  - "AuthTabs: active tab border-amber-accent text-amber-accent (accent for transient tab, not persistent nav per Phase 31-01)"
  - "ReportDetailPage page background: bg-grey-950 (darkest, page chrome), card surfaces bg-grey-900, nested items bg-grey-950"
  - "BestemmingsplanLegend: backdrop-blur-sm removed entirely (legend is UI layer not map-floating per DS-04)"
  - "PropertyGeometryLayer: var(--color-primary) -> '#d97706' literal hex (MapLibre paint cannot resolve CSS custom properties)"

patterns-established:
  - "Dark form fields: text-grey-100 label, border-grey-800 input, placeholder:text-grey-400, focus:ring-amber-accent"
  - "Report detail dark theme: bg-grey-950 page / bg-grey-900 card / bg-grey-950 nested subcard hierarchy"

# Metrics
duration: ~24min
completed: 2026-02-18
---

# Phase 36 Plan 02: CSS Variable Elimination and Token Migration Summary

**30 undefined CSS variable references eliminated across 9 auth/form files, plus ReportDetailPage (72 gray-* classes) and BestemmingsplanLegend fully migrated to Industrial Amber dark token system**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-02-18T15:00:38Z
- **Completed:** 2026-02-18T15:24:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Eliminated all 30+ undefined CSS variable references (`--color-primary`, `--color-text`, `--color-surface`, `--color-border`) from 9 auth/form component files — these rendered as transparent/default browser colors in production
- Migrated ReportDetailPage from light-theme (bg-white/gray-*) to fully dark Industrial Amber design system (72 class replacements across all sub-components)
- Migrated BestemmingsplanLegend from glassmorphism-adjacent (bg-white/95 backdrop-blur-sm) to solid dark UI layer (bg-grey-900 per DS-04)
- Fixed PropertyGeometryLayer MapLibre paint properties: replaced CSS var() references with literal hex values (MapLibre cannot resolve CSS custom properties at paint time)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate auth/form components from undefined CSS variables** - `7573bcf` (feat)
2. **Task 2: Migrate ReportDetailPage and BestemmingsplanLegend to grey-* tokens** - `e21d935` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/components/AuthLoadingScreen.tsx` - inline style var(--color-*) -> bg-grey-950/text-grey-100/bg-amber-accent className
- `frontend/src/components/ui/FormField.tsx` - label/input/ring var() refs -> grey-100/grey-800/amber-accent tokens
- `frontend/src/components/auth/LoginForm.tsx` - submit button bg-amber-accent hover:bg-amber-accent-hover text-grey-950
- `frontend/src/components/auth/RegisterForm.tsx` - same submit button pattern as LoginForm
- `frontend/src/components/auth/GoogleButton.tsx` - dark button: border-grey-800 bg-grey-900 text-grey-100 hover:bg-grey-950
- `frontend/src/components/auth/AuthTabs.tsx` - card bg-grey-900 border-grey-800, active tab border-amber-accent text-amber-accent
- `frontend/src/routes/auth/index.tsx` - page bg-grey-950, heading text-grey-100, subtitle text-grey-400
- `frontend/src/routes/auth/google-callback.tsx` - loading text text-grey-400
- `frontend/src/components/map/PropertyGeometryLayer.tsx` - MapLibre fill/line colors: var(--color-primary) -> '#d97706' hex literal
- `frontend/src/components/reports/ReportDetailPage.tsx` - full dark migration: 72 class replacements across page, MetricCard, Section, Row, all sub-sections
- `frontend/src/components/map/BestemmingsplanLegend.tsx` - bg-white/95 -> bg-grey-900, backdrop-blur-sm removed, all gray-* -> grey-* tokens

## Decisions Made

- Submit buttons (LoginForm, RegisterForm): `bg-amber-accent text-grey-950` — dark text on amber per contrast requirement (amber is light color, dark text needed)
- GoogleButton uses dark variant (bg-grey-900) not white — no bg-white in dark UI design system
- Active auth tab uses `border-amber-accent text-amber-accent` — accent correct for transient tab selection (vs persistent nav which uses neutral per Phase 31-01)
- ReportDetailPage hierarchy: bg-grey-950 (page/outermost) > bg-grey-900 (primary card) > bg-grey-950 (nested sub-cards) — creates depth via alternating dark levels
- BestemmingsplanLegend `backdrop-blur-sm` removed entirely per DS-04: legend is a fixed-position UI panel (not floating map chrome), so solid background is correct
- PropertyGeometryLayer: MapLibre GL JS cannot resolve CSS custom properties in paint specs — literal hex '#d97706' (amber-accent approximate) and '#2a2a2a' (grey-800 approximate) used instead

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — `npm run check` reports zero errors throughout (59 pre-existing warnings from unrelated files, unchanged from baseline).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Auth UI, form fields, and report detail page all use correct Industrial Amber tokens with zero undefined variable references
- Plan 03 (mobile blur reduction on map floating controls) can proceed — BestemmingsplanLegend is already fully solid (Plan 02 removed its blur entirely), so Plan 03 only needs to handle LayerToggle, AddressSearch, ScanProgressOverlay etc.

---
*Phase: 36-polish-performance*
*Completed: 2026-02-18*

## Self-Check: PASSED

Verified:
- `frontend/src/components/AuthLoadingScreen.tsx` — exists
- `frontend/src/components/ui/FormField.tsx` — exists
- `frontend/src/components/auth/LoginForm.tsx` — exists
- `frontend/src/components/auth/RegisterForm.tsx` — exists
- `frontend/src/components/auth/GoogleButton.tsx` — exists
- `frontend/src/components/auth/AuthTabs.tsx` — exists
- `frontend/src/routes/auth/index.tsx` — exists
- `frontend/src/routes/auth/google-callback.tsx` — exists
- `frontend/src/components/map/PropertyGeometryLayer.tsx` — exists
- `frontend/src/components/reports/ReportDetailPage.tsx` — exists
- `frontend/src/components/map/BestemmingsplanLegend.tsx` — exists
- Commit `7573bcf` — confirmed in git log
- Commit `e21d935` — confirmed in git log
- Zero `--color-*` references in src/ .tsx files — confirmed
- Zero gray-*/bg-white in ReportDetailPage and BestemmingsplanLegend — confirmed
- `npm run check` — 0 errors, 59 pre-existing warnings
