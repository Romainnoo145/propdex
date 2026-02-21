---
phase: 42-theme-consistency
plan: 02
subsystem: ui
tags: [tailwind, css-variables, oklch, semantic-tokens, theme, components]

# Dependency graph
requires:
  - phase: 42-01
    provides: "--color-on-accent CSS token, FOUC fix, text-on-accent utility"
provides:
  - "All UI components use semantic error/success/info/warning tokens instead of raw Tailwind palette colors"
  - "All undefined grey-200 and grey-500 values replaced with defined grey-300 and grey-600"
  - "No raw blue-N, green-N, red-N, emerald-N, purple-N classes in components (outside documented exceptions)"
affects: [any future component work, 43, 44, 45]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "error token: bg-error/10 border-error/20 text-error for error states (forms, boxes, badges)"
    - "success token: bg-success/10 text-success for positive/non-monument/done indicators"
    - "info token: bg-info/10 text-info for informational badges, permit icons, external links"
    - "warning token: bg-warning/15 text-warning for medium confidence, data gaps"
    - "grey-500/grey-200 undefined: always use grey-600/grey-300 as the adjacent defined values"
    - "purple-500 exception: gebieds_aanduidingen (area designations) kept purple to visually distinguish from functie_aanduidingen (function designations)"

key-files:
  created: []
  modified:
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/components/auth/RegisterForm.tsx
    - frontend/src/components/auth/GoogleButton.tsx
    - frontend/src/components/ui/FormField.tsx
    - frontend/src/components/notifications/NotificationBadge.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - frontend/src/components/property/ConfidenceBadge.tsx
    - frontend/src/components/property/PropertyDetailPanel.tsx
    - frontend/src/components/property/PropertyDetailDrawer.tsx
    - frontend/src/components/property/PropertyQuickCard.tsx
    - frontend/src/components/property/PropertySummary.tsx
    - frontend/src/components/property/FreshnessIndicator.tsx
    - frontend/src/components/property/SourceBadge.tsx
    - frontend/src/components/reports/PDFExportModal.tsx
    - frontend/src/components/reports/ReportCard.tsx
    - frontend/src/components/reports/ReportDetailPage.tsx
    - frontend/src/components/reports/RecentViewed.tsx
    - frontend/src/components/reports/ReportSearch.tsx
    - frontend/src/components/results/ParcelDetailModal.tsx
    - frontend/src/components/results/ParcelEnrichmentCard.tsx
    - frontend/src/components/results/ParcelCard.tsx
    - frontend/src/components/results/ResultsFilterPanel.tsx
    - frontend/src/components/results/ResultsTable.tsx
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/layout/InspectorPanel.tsx
    - frontend/src/routes/_authenticated/resultaten.tsx
    - frontend/src/routes/_authenticated/rapporten.tsx
    - frontend/src/components/map/BestemmingsplanLegend.tsx
    - frontend/src/components/settings/AppearanceSection.tsx

key-decisions:
  - "grey-500 -> grey-600: grey-500 is not defined in the @theme block; grey-600 (0.45 lightness) is the next defined value and provides appropriate muted text contrast"
  - "grey-200 -> grey-300: grey-200 is not defined; grey-300 is the next defined lighter text value"
  - "purple-500 gebieds_aanduidingen exception: these area designation badges are intentionally different from functie_aanduidingen (info/blue) to visually distinguish two distinct Dutch zoning law categories at a glance"
  - "InspectorPanel hover:text-white -> hover:text-grey-100: grey-100 is primary text, adapts correctly in light mode; text-white is hardcoded and breaks in light mode"
  - "ConfidenceBadge MEDIUM uses warning token (not info): medium confidence is a cautionary state, not informational"

patterns-established:
  - "State color mapping: error=red states, success=green positive states, info=blue informational, warning=amber caution"
  - "Notification/unread badges: always bg-error text-white (semantically an alert state)"
  - "External links in dark contexts: text-info hover:text-info/80"
  - "Non-monument status: bg-success/10 text-success (absence of monument restriction is a positive signal for developers)"

# Metrics
duration: 9min
completed: 2026-02-21
---

# Phase 42 Plan 02: Semantic Token Sweep Summary

**Replaced all raw Tailwind palette colors (blue-N, green-N, red-N, emerald-N) with semantic CSS variable tokens (error, success, info, warning) across 29 components, and fixed all undefined grey-200/grey-500 values to adjacent defined grey-300/grey-600**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-21T16:56:00Z
- **Completed:** 2026-02-21T17:04:44Z
- **Tasks:** 2
- **Files modified:** 29

## Accomplishments

- Auth forms (LoginForm, RegisterForm, GoogleButton, FormField) now use `bg-error/10 border-error/20 text-error` for error states — previously showed a jarring light-pink box on dark backgrounds
- ChangeTimeline notification icons use `bg-info/10 text-info` (permit) and `bg-success/10 text-success` (zoning) — previously used raw blue-100/green-100 that didn't adapt to light mode
- All property components (PropertyDetailPanel, Drawer, QuickCard, Summary, ConfidenceBadge) replaced raw green/red palette with success/error tokens
- ReportDetailPage functie_aanduidingen badges use info token; verboden gebruik (forbidden uses) use error token; PDF upload success uses success token
- ProjectList unread badges use `bg-error` and scan status uses `bg-info/20 text-info` / `bg-error/20 text-error`
- All undefined `grey-500` (not in theme) replaced with `grey-600`; all undefined `grey-200` replaced with `grey-300`
- `npm run check` passes with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace raw palette colors in auth, form, and notification components** - `9181878` (feat)
2. **Task 2: Replace raw palette colors in property, report, and result components** - `a0edc65` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/auth/LoginForm.tsx` - Error box: bg-red-50/text-red-700 -> bg-error/10 border-error/20 text-error
- `frontend/src/components/auth/RegisterForm.tsx` - Same error box fix
- `frontend/src/components/auth/GoogleButton.tsx` - Error text: text-red-600 -> text-error
- `frontend/src/components/ui/FormField.tsx` - Validation: border-red-500 -> border-error, text-red-600 -> text-error
- `frontend/src/components/notifications/NotificationBadge.tsx` - Count badge: bg-red-500 -> bg-error
- `frontend/src/components/notifications/ChangeTimeline.tsx` - Icon circles: blue-100/green-100 -> info/10/success/10; link colors: blue-* -> info
- `frontend/src/components/property/ConfidenceBadge.tsx` - HIGH/LOW: green-500/red-500 -> success/error tokens
- `frontend/src/components/property/PropertyDetailPanel.tsx` - Multiple: red-400 icon -> error; blue-500/10 -> info/10; green-* monument -> success; confidence badge colors
- `frontend/src/components/property/PropertyDetailDrawer.tsx` - Same patterns as PropertyDetailPanel; blue-400 save icon -> info
- `frontend/src/components/property/PropertyQuickCard.tsx` - Non-monument: green-500/10 text-green-200/70 -> success/10 text-success
- `frontend/src/components/property/PropertySummary.tsx` - Progress bar: bg-green-500 -> bg-success; grey-500 -> grey-600
- `frontend/src/components/property/FreshnessIndicator.tsx` - amber-500/amber-400 -> amber-accent (pre-existing unstaged change)
- `frontend/src/components/property/SourceBadge.tsx` - grey-500 -> grey-600
- `frontend/src/components/reports/PDFExportModal.tsx` - Download button: bg-blue-500 -> bg-info
- `frontend/src/components/reports/ReportCard.tsx` - Trash icon hover: red-400 -> error; grey-500 -> grey-600
- `frontend/src/components/reports/ReportDetailPage.tsx` - functie badges: blue-500 -> info; gebieds kept purple (exception); emerald PDF success -> success; emerald monument source -> success; verboden gebruik red-500 -> error; grey-200 -> grey-300; grey-500 -> grey-600
- `frontend/src/components/reports/RecentViewed.tsx` - grey-500 -> grey-600
- `frontend/src/components/reports/ReportSearch.tsx` - grey-500 -> grey-600
- `frontend/src/components/results/ParcelDetailModal.tsx` - Score circle: green/emerald gradient -> success/15; bar: green-400/60 -> success/60; change dots: blue-400/green-400 -> info/success; external link hover -> info; grey-200 -> grey-300
- `frontend/src/components/results/ParcelEnrichmentCard.tsx` - External link: blue-400 -> info; grey-200 -> grey-300; grey-500 -> grey-600
- `frontend/src/components/results/ParcelCard.tsx` - grey-500 -> grey-600
- `frontend/src/components/results/ResultsFilterPanel.tsx` - grey-500 -> grey-600
- `frontend/src/components/results/ResultsTable.tsx` - grey-500 -> grey-600
- `frontend/src/components/projects/ProjectList.tsx` - Unread badges: red-500 -> error; scan status: blue/red-500 -> info/error; grey-200 -> grey-300; grey-500 -> grey-600; delete hover -> error
- `frontend/src/components/layout/InspectorPanel.tsx` - Close button: hover:text-white -> hover:text-grey-100
- `frontend/src/routes/_authenticated/resultaten.tsx` - grey-500 -> grey-600
- `frontend/src/routes/_authenticated/rapporten.tsx` - delete hover: red-500 -> error; grey-500 -> grey-600; grey-200 -> grey-300
- `frontend/src/components/map/BestemmingsplanLegend.tsx` - Legend text: grey-200 -> grey-300
- `frontend/src/components/settings/AppearanceSection.tsx` - No changes needed (already clean)

## Decisions Made

- `grey-500` replaced with `grey-600` throughout: grey-500 is not defined in the CSS `@theme` block (defined values are ...400, 600...) and produces no CSS output in Tailwind v4. grey-600 (lightness 0.45) is the next defined downward value and provides the correct muted text contrast.
- `grey-200` replaced with `grey-300` throughout: grey-200 is not defined in `@theme`; grey-300 is the next defined value and is appropriate for slightly lighter secondary content text.
- purple-500 gebieds_aanduidingen (gebiedsaanduidingen) in ReportDetailPage retained as a documented exception: these area designation badges need to visually differ from functie_aanduidingen (info/blue) badges because they represent distinct categories under Dutch zoning law (SVBP2012). This is a semantic color use, not a branding color.
- ConfidenceBadge MEDIUM uses `warning` token rather than `info`: medium confidence is a cautionary signal (verify this data), not a neutral informational one.
- InspectorPanel close button changed from `hover:text-white` to `hover:text-grey-100`: `text-white` is hardcoded and breaks in light mode; `text-grey-100` is the semantic primary text that correctly inverts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FreshnessIndicator amber-500/amber-400 included in commit**
- **Found during:** Task 2 (git status review)
- **Issue:** FreshnessIndicator.tsx had an unstaged pre-existing fix (amber-500 -> amber-accent, amber-400 -> amber-accent-hover) from a prior session that was not yet committed
- **Fix:** Included the file in Task 2 commit since it was a valid semantic token fix
- **Files modified:** `frontend/src/components/property/FreshnessIndicator.tsx`
- **Committed in:** `a0edc65` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix for pre-existing unstaged change)
**Impact on plan:** Minimal - file was already correctly fixed, just not yet committed. No scope creep.

## Issues Encountered

None. All replacements were straightforward text substitutions. `npm run check` passed with 0 errors and 132 warnings (all pre-existing from other files, none introduced).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UI components now use semantic color tokens that adapt correctly between dark and light modes
- Zero undefined grey values remain in components/routes/lib directories
- Theme consistency phase (42) is complete - both plans executed
- Ready to proceed to phase 43 (next roadmap phase)

---
*Phase: 42-theme-consistency*
*Completed: 2026-02-21*
