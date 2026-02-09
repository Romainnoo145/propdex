---
phase: 16
plan: 07
subsystem: frontend-integration
tags: [react, tanstack-router, tanstack-query, sonner, state-management, navigation, pdf-export, report-management]

requires:
  - 16-03: PropertyDetailDrawer and QuickCard components
  - 16-04: useReports hooks (useSaveReport, useExportPDF, useReport)
  - 16-05: ReportSidebar with search and recent viewed
  - 16-06: FreshnessIndicator and SourceBadge

provides:
  - Complete three-tier progressive disclosure (none → quick → drawer → modal)
  - Save report flow with toast notifications
  - PDF export flow with modal and download handling
  - Sidebar navigation to saved reports (map flyTo + drawer)
  - Recent viewed tracking on address lookups
  - reportId URL parameter handling for deep linking

affects:
  - Future property features can use established tier state machine
  - PDF export pattern reusable for other export types
  - Recent viewed pattern reusable for projects/other entities

tech-stack:
  added: []
  patterns:
    - ViewTier state machine: 'none' | 'quick' | 'drawer' | 'modal' prevents invalid states
    - Search param navigation: reportId/postcode/huisnummer for deep linking
    - Ref-based duplicate prevention: handledSearchRef/handledReportRef to avoid re-triggers
    - Toast-driven feedback: loading → success/error pattern with toast IDs

key-files:
  created:
    - frontend/src/components/reports/PDFExportModal.tsx
    - frontend/src/components/reports/SaveReportFlow.tsx
  modified:
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/routes/_authenticated.tsx
    - frontend/src/components/layout/ReportSidebar.tsx
    - frontend/src/components/property/PropertyDetailDrawer.tsx

decisions:
  - id: viewtier-state-machine
    choice: "Single enum ViewTier = 'none' | 'quick' | 'drawer' | 'modal' over boolean flags"
    context: "Complex UI state with multiple tiers and transitions"
    rationale: "Single source of truth prevents invalid states (quick+drawer simultaneously), makes transitions explicit and predictable"

  - id: search-param-navigation
    choice: "Use TanStack Router search params for reportId/postcode/huisnummer navigation"
    context: "Need deep linking and sidebar navigation to map"
    rationale: "Type-safe, enables browser back/forward, allows sharing URLs, separates concerns (layout handles nav, map handles display)"

  - id: duplicate-prevention-refs
    choice: "useRef to track handled search params (handledSearchRef, handledReportRef)"
    context: "Effects re-run on deps change, need to prevent duplicate API calls"
    rationale: "Refs persist across renders without triggering re-renders, prevent duplicate lookups when URL doesn't actually change"

  - id: toast-id-pattern
    choice: "Store toast ID and update with same ID for loading → success/error transitions"
    context: "Show single persistent toast that updates, not multiple toasts"
    rationale: "Better UX - toast morphs from loading to result, avoids toast spam, uses Sonner's built-in update mechanism"

  - id: saved-report-state
    choice: "Track savedReportId in local state separate from mutation result"
    context: "Need to persist report ID across renders for PDF export"
    rationale: "Mutation result clears on component unmount, local state persists for session lifetime"

metrics:
  duration: 346s
  completed: 2026-02-09
---

# Phase 16 Plan 07: Save/Export/Navigate Integration Summary

**One-liner:** Complete three-tier progressive disclosure with save/export flows, sidebar navigation to saved reports, and recent viewed tracking

## What Was Built

Final integration plan connecting all Phase 16 components into a cohesive property viewing and report management system:

1. **PDFExportModal (Tier 3):** Modal overlay for PDF export with "save first" prompt
2. **SaveReportFlow hook:** Encapsulates save logic with toast notifications
3. **Map.tsx integration:** Wire save/export/reportId navigation/recent tracking
4. **Sidebar navigation:** Click saved report → map flyTo location + open drawer
5. **Recent viewed tracking:** Every address lookup adds to recent list

## Acceptance Criteria

**Must-haves:**
- [x] Clicking save icon in drawer header saves report with toast confirmation
- [x] Clicking export icon opens PDF export modal (Tier 3)
- [x] PDF export shows loading toast, downloads file when ready
- [x] Clicking saved report in sidebar flies map to location and opens drawer
- [x] Recently viewed properties tracked in sidebar on address search
- [x] Tier state machine: none → quick → drawer → modal (full cycle)

**Artifacts:**
- [x] `frontend/src/components/reports/PDFExportModal.tsx` (135 lines)
- [x] `frontend/src/components/reports/SaveReportFlow.tsx` (57 lines)
- [x] Key links verified:
  - map.tsx → useReports hooks (useSaveReport, useExportPDF, useReport)
  - map.tsx → useRecentViewed.addRecentItem on address lookup
  - PDFExportModal → Modal primitive + sonner toast
  - _authenticated.tsx → sidebar callbacks wired to navigation

## Task Commits

| Task | Commit | Files Changed | Description |
|------|--------|---------------|-------------|
| 1 | Pre-existing | `PDFExportModal.tsx`, `SaveReportFlow.tsx` | Components already implemented in previous work |
| 2 | `4aed4c1` | `map.tsx` | Add saved report navigation: useReport hook, reportId effect, fly to location |
| 3 | N/A | N/A | Human verification checkpoint (approved) |

**Note:** Task 1 files were already implemented (PDFExportModal and SaveReportFlow), so only Task 2 required a commit.

## Files Created/Modified

### Created (Pre-existing)
- `frontend/src/components/reports/PDFExportModal.tsx` - Tier 3 modal for PDF export with save-first prompt
- `frontend/src/components/reports/SaveReportFlow.tsx` - useSaveReportFlow hook with toast feedback

### Modified
- `frontend/src/routes/_authenticated/map.tsx` - Added reportId handling, saved report navigation, recent tracking

## Implementation Details

### PDFExportModal Component

**Features:**
- Props: `reportId`, `propertyData`, `isOpen`, `onClose`, `onSaveFirst`
- Two states: unsaved (prompt to save first) vs saved (show export options)
- Export flow: toast.loading → exportPDF.mutateAsync → createObjectURL → download → toast.success
- Cancel button and ESC key close modal
- Disabled state during export (exportPDF.isPending)

**Toast pattern:**
```typescript
const toastId = toast.loading('PDF wordt gegenereerd...')
// ... async work ...
toast.success('PDF succesvol gedownload', { id: toastId })
```

### SaveReportFlow Hook

**API:**
```typescript
const { handleSave, isSaving, savedReportId } = useSaveReportFlow(propertyData)
```

**Logic:**
1. Validate propertyData exists
2. Build ReportSaveRequest with report_data/notes/project_id
3. Call saveReport.mutateAsync
4. Show loading → success/error toasts
5. Return saved report ID for further actions

**Type conversion:** `propertyData as unknown as Record<string, unknown>` to satisfy API types

### Map.tsx Integration

**Added:**
1. **Import useReport hook** for fetching saved reports
2. **Extract reportId** from search params
3. **Fetch saved report:** `useReport(reportId || null)` with enabled guard
4. **Effect for reportId:** Fetch report → extract PropertyReportResponse → set state → fly to location → open drawer
5. **Recent tracking:** addRecentItem on lookup success with address details
6. **Save handler:** Call saveFlow.handleSave, store returned ID in savedReportId state
7. **Export handler:** setTier('modal') to open PDF modal
8. **Modal close:** setTier('drawer') to return to drawer

**State machine transitions:**
- Search → quick (loading)
- Quick → drawer (view details)
- Drawer → modal (export)
- Modal → drawer (cancel/complete)
- Drawer → quick (back)
- Quick → none (close)

**Duplicate prevention:**
```typescript
const handledReportRef = useRef<string | null>(null)
if (handledReportRef.current === reportId) return
handledReportRef.current = reportId
```

### Recent Viewed Integration

**Tracking:**
```typescript
addRecentItem({
  id: data.address.nummeraanduiding_id,
  report_name: `${data.address.straat} ${data.address.huisnummer}...`,
  postcode: data.address.postcode,
  huisnummer: data.address.huisnummer,
  woonplaats: data.address.woonplaats,
})
```

**Triggered on:**
- Address lookup success (real data)
- Demo data fallback

**Storage:** localStorage via useRecentViewed hook, max 10 items

### Sidebar Navigation

**Already implemented in _authenticated.tsx:**
- `handleSelectReport(reportId)` → navigate to `/map?reportId={id}`
- `handleSelectRecent(item)` → navigate to `/map?postcode={pc}&huisnummer={hn}`
- Sidebar closes after navigation

## Decisions Made

### 1. ViewTier State Machine
**Choice:** Single enum `ViewTier = 'none' | 'quick' | 'drawer' | 'modal'`

**Rationale:**
- Prevents invalid states (can't have quick + drawer simultaneously)
- Makes transitions explicit and traceable
- Single source of truth for UI state
- Easier to debug than multiple boolean flags

### 2. Search Param Navigation
**Choice:** Use TanStack Router search params for reportId/postcode/huisnummer

**Rationale:**
- Type-safe via validateSearch
- Enables deep linking (share URLs)
- Browser back/forward support
- Separates concerns: layout handles navigation, map handles display
- Clear communication contract between sidebar and map

### 3. Duplicate Prevention with Refs
**Choice:** `handledSearchRef` and `handledReportRef` to track processed params

**Rationale:**
- Effects re-run when dependencies change
- Search params cleared after handling (navigate with replace: true)
- Without refs, would trigger duplicate API calls
- Refs persist across renders without causing re-renders

### 4. Toast ID Pattern
**Choice:** Store toast ID and update same toast for loading → success/error

**Implementation:**
```typescript
const toastId = toast.loading('Bezig...')
toast.success('Klaar!', { id: toastId })
```

**Rationale:**
- Single toast morphs from loading to result
- Avoids toast spam (no separate loading + success toasts)
- Uses Sonner's built-in update mechanism
- Better UX - user tracks single notification

### 5. Saved Report ID State
**Choice:** Track `savedReportId` in component state separate from mutation result

**Rationale:**
- Mutation result (`saveReport.data.id`) clears on unmount
- PDF export needs report ID even after mutation completes
- Local state persists for session lifetime
- Updated when: save completes OR loading saved report from URL

## Deviations from Plan

None - plan executed exactly as written. Task 1 files were already implemented, Task 2 added the missing reportId navigation logic as specified.

## Issues Encountered

None - implementation proceeded smoothly. All hooks and components existed, only wiring was needed.

## User Verification Completed

Human verification checkpoint approved. Verified:
- Side-rail navigation functional
- Three-tier progressive disclosure working
- Save flow with toast notifications
- PDF export modal and download
- Sidebar report selection → map navigation
- Recent viewed tracking
- Cmd+K search functionality
- Source badges and freshness indicators
- Close flow (ESC key)

## Next Phase Readiness

**Phase 16 Complete:** 7/7 plans finished

**Deliverables:**
- ✓ Three-tier progressive disclosure (QuickCard → Drawer → Modal)
- ✓ Side-rail navigation with icon menu
- ✓ Report sidebar with search and recent viewed
- ✓ Save/export report flows with user feedback
- ✓ Freshness indicators and source attribution
- ✓ Deep linking via URL parameters

**R6 Acceptance Criteria Met:**
- ✓ Save report button on detail panel → POST to backend /reports
- ✓ Sidebar tab "Rapporten" lists saved reports with search
- ✓ Click saved report → reopens on map with detail panel
- ✓ PDF export button → downloads from backend /reports/{id}/pdf
- ✓ Freshness indicators showing data age per source

**Ready for:** Phase 17 or next milestone planning

**Known limitations:**
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation yet (deferred)
- PDF export options: UI shows options but backend doesn't support section filtering yet
- Parcel click/highlight: Not possible with WMS raster tiles (requires vector features)

## Phase 16 Summary

**Total plans:** 7
**Duration:** ~6 sessions
**Components created:** 15+ (modals, drawers, cards, sidebars, navigation, search, indicators)
**Patterns established:** ViewTier state machine, progressive disclosure, toast feedback, deep linking, recent tracking
**Tech stack:** React 19, TanStack Router, TanStack Query, Sonner, MapLibre, cmdk

**Phase 16 transforms the frontend from basic map view to a comprehensive property intelligence platform with professional UX patterns.**

## Self-Check: PASSED

**Files verified:**
- ✓ frontend/src/components/reports/PDFExportModal.tsx (exists, 135 lines)
- ✓ frontend/src/components/reports/SaveReportFlow.tsx (exists, 57 lines)
- ✓ frontend/src/routes/_authenticated/map.tsx (modified, reportId handling added)

**Commits verified:**
- ✓ 4aed4c1 (Task 2: saved report navigation)

**Quality checks:**
- ✓ `npm run check` passes (TypeScript + ESLint)
- ✓ No type errors
- ✓ No lint errors
- ✓ Human verification approved
