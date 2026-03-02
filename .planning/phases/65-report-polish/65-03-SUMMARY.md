---
phase: 65-report-polish
plan: 03
subsystem: ui
tags: [react, typescript, reports, warnings, wkb, asbest, monument]

# Dependency graph
requires:
  - phase: 65-01
    provides: ReportDetailPage with section order locked, STATUS_EXPLANATIONS/getStatusInfo utilities retained, SignalBanner/monument alert commented out
  - phase: 60-wkb-precheck
    provides: wkb_precheck.status field on PropertyReportResponse
  - phase: 55-monument-enrichment
    provides: monuments.is_monument field on PropertyReportResponse
provides:
  - ActieVereistSection component with computeWarnings pure function
  - Color-coded actionable warnings: blocking (red), attention (amber), awareness (blue)
  - Section absent for properties with no actionable warnings (RPT-04)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "computeWarnings pure function: derives warnings from PropertyReportResponse fields, no API calls"
    - "Returns null from component when warnings array is empty — RPT-04 pattern for conditional sections"
    - "Severity styling map: Record<WarningSeverity, styles> pattern for type-safe color mapping"

key-files:
  created:
    - frontend/src/components/reports/ActieVereistSection.tsx
  modified:
    - frontend/src/components/reports/ReportDetailPage.tsx

key-decisions:
  - "Inline STATUS_WARNING_DESCRIPTIONS in ActieVereistSection rather than importing from ReportDetailPage — avoids import cycle and the warning text is actionable-developer-oriented vs informational in ReportDetailPage"
  - "computeWarnings exported as pure function — enables unit testing without React renderer"
  - "4 warnings implemented: Wkb-plichtig, Asbestrisico, BAG-status (4 actionable statuses), Rijksmonument — bestemmingsplan conflict skipped (no clear conflict signal in ZoningData type)"

patterns-established:
  - "computeWarnings(data): exported pure function, returns ActionWarning[] — testable without React"
  - "Component returns null on empty warnings array — clean RPT-04 implementation, no empty section rendered"

requirements-completed: [RPT-03, RPT-04]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 65 Plan 03: Actie Vereist Section Summary

**ActieVereistSection component with computeWarnings derives blocking/attention/awareness warnings from existing property data; absent for clean properties (RPT-04)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-02T03:20:24Z
- **Completed:** 2026-03-02T03:25:00Z
- **Tasks:** 2
- **Files modified:** 1 created + 1 modified

## Accomplishments

- New `ActieVereistSection.tsx`: `computeWarnings` pure function + component with severity-coded warnings
- Wkb-plichtig (blocking/red): triggered when `wkb_precheck.status === 'likely_required'`
- Asbestrisico (blocking/red): triggered when `building.bouwjaar < 1994`
- BAG status (attention/amber): triggered for 4 actionable statuses (sloop/bouw/buiten gebruik)
- Rijksmonument (awareness/blue): triggered when `monuments.is_monument === true`
- Component returns `null` for clean properties — section completely absent (RPT-04)
- Wired into `ReportDetailPage.tsx` as first element before BestemmingSection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActieVereistSection component** - `8bb4a11` (feat)
2. **Task 2: Wire ActieVereistSection into ReportDetailPage** - `24d660d` (feat)

## Files Created/Modified

- `frontend/src/components/reports/ActieVereistSection.tsx` - New component: computeWarnings + ActieVereistSection + WarningRow + inline SVG icons (~180 lines)
- `frontend/src/components/reports/ReportDetailPage.tsx` - Added import + inserted as first child in main column div

## Decisions Made

- Inlined `STATUS_WARNING_DESCRIPTIONS` in `ActieVereistSection` rather than importing from `ReportDetailPage` — the text is actionable-developer-oriented (different purpose) and avoids a potential import cycle
- Skipped bestemmingsplan conflict warning: `ZoningData` has no `has_conflict` field, `data_gaps` is informational, no clear single-field conflict signal available
- Exported `computeWarnings` as standalone pure function for future unit testability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 65 complete (3/3 plans done): Report Polish shipped
- All report sections in final order with actionable warnings, satellite thumbnail header, standardized empty states
- RPT-03 and RPT-04 requirements satisfied

## Self-Check: PASSED

- ActieVereistSection.tsx: FOUND
- ReportDetailPage.tsx: FOUND (modified)
- Commit 8bb4a11: FOUND
- Commit 24d660d: FOUND
- npm run check: 0 errors

---
*Phase: 65-report-polish*
*Completed: 2026-03-02*
