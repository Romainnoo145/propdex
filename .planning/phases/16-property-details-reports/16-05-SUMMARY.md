---
phase: 16
plan: 05
subsystem: ui-report-management
tags: [react, cmdk, sidebar, reports, search, glassmorphism]

requires:
  - "16-01: Drawer, Modal, useEscapeKey, report types"
  - "16-02: SideRailNav, app shell restructure"
  - "16-04: useReports, useRecentViewed hooks"

provides:
  - "Report Sidebar UI with search, recent viewed, accordion"
  - "Cmd+K fuzzy search with cmdk"
  - "ReportCard, RecentViewed, EmptyState components"
  - "Side-rail integration with toggle button"

affects:
  - "16-06: Report freshness badge integration"
  - "16-07: Report export and management actions"

tech-stack:
  added: []
  patterns:
    - "cmdk for command palette search"
    - "Accordion pattern with max-height transitions"
    - "Glassmorphism sidebar design"
    - "Grouped reports by project"

key-files:
  created:
    - frontend/src/components/reports/ReportCard.tsx
    - frontend/src/components/reports/RecentViewed.tsx
    - frontend/src/components/reports/EmptyState.tsx
    - frontend/src/components/reports/ReportSearch.tsx
    - frontend/src/components/layout/ReportSidebar.tsx
  modified:
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/routes/_authenticated.tsx

decisions:
  - name: "cmdk inline search vs dialog"
    choice: "Inline search in sidebar"
    reason: "Sidebar already provides focused context, no need for modal overlay"
    alternatives: ["Command.Dialog with overlay"]
  - name: "Freshness badge color"
    choice: "Amber for stale, subtle gray for fresh"
    reason: "Amber draws attention to outdated data without alarming red"
    alternatives: ["Red for stale", "Green for fresh"]
  - name: "Accordion default state"
    choice: "Geen project section expanded by default"
    reason: "Most reports start without project assignment, shows content immediately"
    alternatives: ["All sections collapsed", "All sections expanded"]
  - name: "Sidebar z-index"
    choice: "var(--z-sidebar) (200)"
    reason: "Consistent with existing CSS variable scale, below side-rail (250)"
    alternatives: ["Hardcoded 200"]

metrics:
  duration: "4 minutes"
  tasks_completed: 2
  commits: 2
  files_created: 5
  files_modified: 2
  lines_added: 715

completed: 2026-02-08
---

# Phase 16 Plan 05: Report Sidebar & Search Summary

**One-liner:** Report management sidebar with cmdk search, project accordion, recent viewed list, and onboarding empty state.

## Overview

Built the Report Sidebar as the core UI for report management (R6 requirement). The sidebar provides:
- **Cmd+K fuzzy search** using cmdk library for quick report access
- **Project-grouped accordion** showing saved reports organized by project
- **Recent viewed section** with clock icons for last visited properties
- **Empty state onboarding** with 3-step guide (Ontdek, Analyseer, Organiseer)
- **Side-rail integration** with toggle button between main navigation and logout

Design follows established glassmorphism patterns with slide-in animation.

## What Was Built

### Task 1: ReportCard, RecentViewed, and EmptyState Components
**Commit:** `b17f29e`

**Created:**
1. **ReportCard.tsx** (92 lines)
   - Glassmorphism card with border-white/10, bg-white/5, hover:bg-white/10
   - Freshness dot indicator (amber for stale, subtle gray for fresh)
   - Report name, postcode, city
   - Created date (formatted with Intl.DateTimeFormat 'nl-NL')
   - Completeness percentage display
   - Optional delete button with trash icon

2. **RecentViewed.tsx** (66 lines)
   - Section header with clock icon
   - Compact list of recent properties
   - Click handlers for navigation
   - Null render when no items (doesn't show empty section)

3. **EmptyState.tsx** (95 lines)
   - 3-step minimalist onboarding guide
   - Step 1: Ontdek - Zoek een adres op de kaart
   - Step 2: Analyseer - Bekijk kadaster, bestemming en monument data
   - Step 3: Organiseer - Sla rapporten op in projecten
   - Each step with icon + title + description

**Verification:** `pnpm exec tsc --noEmit` passed with no type errors.

### Task 2: ReportSearch, ReportSidebar, and Side-Rail Integration
**Commit:** `bc6b779`

**Created:**
1. **ReportSearch.tsx** (122 lines)
   - Inline Command component from cmdk (not dialog)
   - Global Cmd+K / Ctrl+K shortcut registration
   - Groups reports by project_id
   - Search input with glassmorphism styling
   - Command.List with Command.Empty fallback
   - Shows completeness percentage in results

2. **ReportSidebar.tsx** (231 lines)
   - Fixed position: left-0 md:left-16 (after side-rail)
   - Width: w-80 (320px)
   - Z-index: var(--z-sidebar) (200)
   - Glassmorphism: bg-black/40 backdrop-blur-xl border-r border-white/10
   - Slide-in animation: translate-x-0 / -translate-x-full
   - Mobile backdrop overlay
   - Accordion sections with max-height transitions
   - Integrates: ReportSearch, RecentViewed, ReportCard, EmptyState
   - Data: useReports() + useRecentViewed() hooks

**Modified:**
1. **SideRailNav.tsx**
   - Added `sidebarOpen` and `onToggleSidebar` props
   - Added "Rapporten" toggle button with DocumentIcon
   - Button positioned between main nav and logout
   - Divider before Rapporten button
   - Active state when sidebar is open

2. **_authenticated.tsx**
   - Lifted sidebar state: `[sidebarOpen, setSidebarOpen]`
   - Rendered ReportSidebar at layout level
   - Added placeholder handlers:
     - `handleSelectReport`: Console log + close sidebar
     - `handleSelectRecent`: Console log + close sidebar
   - Passed state and handlers to SideRailNav and ReportSidebar

**Verification:** `npm run check` passed (type-check + lint).

## Technical Decisions

### cmdk Inline vs Dialog
**Choice:** Inline search in sidebar (not Command.Dialog)
**Reason:** Sidebar already provides focused context. A modal dialog would add unnecessary visual hierarchy. The inline pattern keeps search within the report management context.

### Freshness Badge Colors
**Choice:** Amber for stale, subtle gray (white/30) for fresh
**Reason:** Amber (bg-amber-400) draws attention to outdated data without alarming users with red. Fresh reports use subtle gray to indicate status without visual clutter.

### Accordion Default State
**Choice:** "Geen project" section expanded by default
**Reason:** Most reports start without project assignment. Expanding this section shows content immediately without requiring interaction.

### Sidebar Positioning
**Choice:** Fixed left-0 on mobile, left-16 (after side-rail) on desktop
**Reason:** Mobile: Full-width sidebar from left edge. Desktop: Position after 64px side-rail to avoid overlap. Both use fixed positioning for overlay behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

**Manual testing required:**
1. Click "Rapporten" icon in side-rail → Sidebar should slide in
2. Press Cmd+K (Mac) or Ctrl+K (Windows) → Search input should focus
3. Type in search → Results should filter and group by project
4. Click accordion header → Section should expand/collapse with smooth transition
5. Empty state → Should show 3-step guide when no reports AND no recent items
6. Recent viewed → Should show when items exist, hide when empty

**Integration testing required:**
- handleSelectReport and handleSelectRecent are placeholder implementations
- Need wiring to map flyTo and drawer opening (Phase 16-06/16-07)
- Freshness badge currently static (isStale prop) - needs freshness check integration

## Known Limitations

1. **Placeholder handlers:** onSelectReport and onSelectRecent log to console, don't trigger map flyTo or drawer
2. **No freshness check:** ReportCard accepts isStale prop but sidebar doesn't fetch freshness data yet
3. **No delete functionality:** ReportCard shows delete button but handler is optional, not wired
4. **No project names:** Accordion groups by project_id, shows "Geen project" for null, doesn't fetch actual project names
5. **Mobile navigation:** Side-rail hidden on mobile, no replacement mobile navigation (existing limitation)

## Next Phase Readiness

**Ready for:**
- Phase 16-06: Report freshness badge integration (use useReportFreshness hook)
- Phase 16-07: Report export and management actions (wire delete, export PDF)

**Blockers:** None

**Concerns:** None

## Integration Points

**Uses:**
- `useReports()` from @/hooks/useReports.ts
- `useRecentViewed()` from @/hooks/useRecentViewed.ts
- `ReportListItem` type from @/lib/types/report.ts
- `RecentItem` type from @/hooks/useRecentViewed.ts
- `Command` from cmdk package

**Provides:**
- ReportCard component for displaying saved reports
- ReportSearch component for Cmd+K search
- RecentViewed component for recent properties
- EmptyState component for onboarding
- ReportSidebar integrated into _authenticated layout
- Rapporten toggle in SideRailNav

**Future integration:**
- Phase 16-06: Add useReportFreshness to set isStale prop
- Phase 16-07: Wire onDelete handler and export functionality
- Map integration: Wire onSelectReport to trigger map.flyTo + drawer open
- Property lookup: Wire onSelectRecent to fetch property data

## Files Changed

**Created (5 files, 606 lines):**
- `frontend/src/components/reports/ReportCard.tsx` (92 lines)
- `frontend/src/components/reports/RecentViewed.tsx` (66 lines)
- `frontend/src/components/reports/EmptyState.tsx` (95 lines)
- `frontend/src/components/reports/ReportSearch.tsx` (122 lines)
- `frontend/src/components/layout/ReportSidebar.tsx` (231 lines)

**Modified (2 files, 109 lines added):**
- `frontend/src/components/layout/SideRailNav.tsx` (+54 lines)
- `frontend/src/routes/_authenticated.tsx` (+55 lines)

**Total:** 7 files, 715 lines added

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ReportCard, RecentViewed, and EmptyState components | b17f29e | ReportCard.tsx, RecentViewed.tsx, EmptyState.tsx |
| 2 | Create ReportSearch and ReportSidebar, wire to SideRailNav | bc6b779 | ReportSearch.tsx, ReportSidebar.tsx, SideRailNav.tsx, _authenticated.tsx |

## Self-Check: PASSED

All created files exist:
- ✓ frontend/src/components/reports/ReportCard.tsx
- ✓ frontend/src/components/reports/RecentViewed.tsx
- ✓ frontend/src/components/reports/EmptyState.tsx
- ✓ frontend/src/components/reports/ReportSearch.tsx
- ✓ frontend/src/components/layout/ReportSidebar.tsx

All commits exist:
- ✓ b17f29e
- ✓ bc6b779
