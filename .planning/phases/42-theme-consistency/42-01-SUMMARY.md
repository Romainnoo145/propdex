---
phase: 42-theme-consistency
plan: 01
subsystem: ui
tags: [tailwind, css-variables, oklch, fouc, theme, amber, button]

# Dependency graph
requires: []
provides:
  - "--color-on-accent CSS variable defined in @theme (oklch dark, not overridden in light mode)"
  - "FOUC prevention inline script in index.html <head>"
  - "All amber-background elements use text-on-accent for legible text in both dark and light modes"
affects: [42-02, all components with bg-amber-accent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "text-on-accent utility for text on amber/accent colored backgrounds (never text-grey-950/900/white)"
    - "--color-on-accent defined only in @theme, never overridden in html.light (intentionally static dark)"
    - "FOUC prevention: synchronous localStorage read in inline <script> before all <link> tags"

key-files:
  created: []
  modified:
    - frontend/src/styles/index.css
    - frontend/index.html
    - frontend/src/components/primitives/Button.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/components/auth/RegisterForm.tsx
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/components/map/ScanProgressOverlay.tsx
    - frontend/src/components/layout/InspectorPanel.tsx
    - frontend/src/components/results/BulkActionBar.tsx
    - frontend/src/components/results/ParcelDetailModal.tsx
    - frontend/src/components/reports/PDFExportModal.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "--color-on-accent uses oklch(0.12 0.005 270) — same dark value as dark-mode grey-950 but a fixed independent token that stays dark in light mode"
  - "FOUC script must be first child of <head> before any <link> tags to prevent CSS loading before class is applied"
  - "text-grey-200 in map.tsx wijk name span replaced with text-grey-300 (grey-200 not defined in theme)"

patterns-established:
  - "text-on-accent: all amber/accent-background elements use this utility for text — never text-grey-950, text-grey-900, or text-white"
  - "FOUC pattern: inline <script> reads 'propdex-theme' key, adds .light class synchronously before first paint"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 42 Plan 01: on-accent Token + FOUC Fix Summary

**Fixed invisible-button-in-light-mode bug via --color-on-accent CSS token across 10 components, and eliminated FOUC with synchronous localStorage script before first paint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T16:51:16Z
- **Completed:** 2026-02-21T16:54:08Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added `--color-on-accent: oklch(0.12 0.005 270)` to `@theme` block — stays dark in both modes because amber stays golden, text must always be dark
- Added FOUC prevention inline script as first `<head>` child — reads `propdex-theme` from localStorage synchronously, applies `.light` class before any CSS loads
- Replaced all `text-grey-950`, `text-grey-900`, and `text-white` on amber/success backgrounds across 10 components with `text-on-accent`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add on-accent CSS token and FOUC prevention script** - `c614825` (feat)
2. **Task 2: Replace all hardcoded text colors on amber backgrounds with text-on-accent** - `28c09ab` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/styles/index.css` - Added `--color-on-accent` token to `@theme` block (not in `html.light`)
- `frontend/index.html` - Inline FOUC prevention script before `<link>` tags
- `frontend/src/components/primitives/Button.tsx` - Primary variant: text-on-accent
- `frontend/src/components/auth/LoginForm.tsx` - Submit button: text-on-accent
- `frontend/src/components/auth/RegisterForm.tsx` - Submit button: text-on-accent
- `frontend/src/components/map/LayerToggle.tsx` - Active tab string: text-on-accent
- `frontend/src/components/map/ScanProgressOverlay.tsx` - Completed/active step badges + CTA button: text-on-accent
- `frontend/src/components/layout/InspectorPanel.tsx` - Generate report button: text-on-accent
- `frontend/src/components/results/BulkActionBar.tsx` - Export button: text-on-accent
- `frontend/src/components/results/ParcelDetailModal.tsx` - Confirm button: text-on-accent
- `frontend/src/components/reports/PDFExportModal.tsx` - 'Eerst opslaan' button: text-on-accent (was text-white)
- `frontend/src/routes/_authenticated/map.tsx` - Viewport scan button, zone scan button: text-on-accent; wijk name: text-grey-300 (was text-grey-200, undefined in theme)

## Decisions Made

- `--color-on-accent` is NOT overridden in `html.light` — amber accent stays golden in both modes, so text must always be dark regardless of mode
- FOUC script placed as first child of `<head>` (before icon link, font preconnects, stylesheet) to guarantee class applied before any resource loads
- PDFExportModal 'Eerst opslaan' button used `text-white` which is incorrect on amber — changed to `text-on-accent` (this was a latent bug)
- `text-grey-200` in map.tsx wijk name fixed to `text-grey-300` as grey-200 is not defined in the theme scale

## Deviations from Plan

None - plan executed exactly as written. The `text-grey-200` fix was explicitly listed in the plan (item 14).

## Issues Encountered

None. `npm run check` passed with 0 errors (132 pre-existing warnings from other code, none introduced by these changes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `--color-on-accent` token available globally for Plan 02 component updates
- FOUC eliminated — light mode sessions start correctly without dark flash
- All amber button text is now readable in both dark and light modes
- Plan 02 can proceed to fix remaining grey-scale token inversions in components

---
*Phase: 42-theme-consistency*
*Completed: 2026-02-21*
