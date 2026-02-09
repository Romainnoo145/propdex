---
phase: 17-projects-polish
verified: 2026-02-09T20:30:00Z
status: gaps_found
score: 10/12 must-haves verified
gaps:
  - truth: "ProjectList shows reports inside expanded project cards when using live API data"
    status: partial
    reason: "ProjectList.tsx line 151 has TODO: when not in demo mode, reports array is always empty ([]). Expanding a live project card shows 'Geen rapporten in dit project' even if reports exist."
    artifacts:
      - path: "frontend/src/components/projects/ProjectList.tsx"
        issue: "Line 151: `const reports = isDemo ? DEMO_REPORTS[project.id] ?? [] : [] // TODO: fetch from useReports({ project_id }) when live` -- empty array fallback for live mode"
    missing:
      - "Fetch reports per project using useReports({ project_id: project.id }) in live (non-demo) mode so expanded project cards show their reports"
  - truth: "PropertyBottomSheet is wired into the application"
    status: partial
    reason: "PropertyBottomSheet.tsx exists and is fully implemented, but it is not imported or used anywhere in the application. The responsive Drawer approach was chosen instead (Plan 17-04 made Drawer itself responsive). PropertyBottomSheet is orphaned."
    artifacts:
      - path: "frontend/src/components/property/PropertyBottomSheet.tsx"
        issue: "Component exists (72 lines, fully implemented) but is never imported or used. The Drawer component was made responsive instead."
    missing:
      - "Either remove the orphaned PropertyBottomSheet.tsx or integrate it somewhere. The Drawer's responsive approach covers the mobile bottom-sheet need, so this is a dead-code issue, not a functional gap."
human_verification:
  - test: "Open Projecten page, create a new project, verify it appears in the list"
    expected: "Project created with toast feedback, list updates immediately"
    why_human: "Requires running frontend + backend, visual confirmation"
  - test: "On mobile viewport, click a property. Verify bottom sheet appears from bottom (not right drawer)"
    expected: "Drawer renders as bottom sheet with drag handle on mobile, right panel on desktop"
    why_human: "Responsive behavior needs visual/device testing"
  - test: "In property drawer, click Ververs button"
    expected: "Loading state shown, then toast 'Gegevens bijgewerkt met laatste bronnen'"
    why_human: "Requires running backend to verify force_refresh=true param works end-to-end"
  - test: "In ReportSidebar, use project filter dropdown and inline assignment select"
    expected: "Filter narrows report list, assignment moves report to new group with toast"
    why_human: "Requires running frontend + backend with real data"
  - test: "Navigate from ProjectList report to /rapport/:id page"
    expected: "Full detail report page renders with all sections (Gebouw, Kadaster, Bestemming, Monument, AI, Bronnen)"
    why_human: "Visual layout verification, requires running frontend"
---

# Phase 17: Projects & Polish Verification Report

**Phase Goal:** Project folders CRUD, report-to-project assignment, mobile bottom sheet, monument badges, AI zoning display, force refresh (R7, R9)
**Verified:** 2026-02-09T20:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Project API functions can fetch, create, update, delete projects | VERIFIED | `api.ts` exports `fetchProjects`, `createProject`, `updateProject`, `deleteProject` at lines 382-476, all using `apiFetch`/raw fetch with `PROJECTS_BASE` constant |
| 2 | Project API functions can assign a report to a project | VERIFIED | `api.ts` line 478: `assignReportToProject(reportId, projectId, accessToken)` calls `PATCH /api/reports/{reportId}/project` |
| 3 | TanStack Query hooks provide reactive project data with cache invalidation | VERIFIED | `useProjects.ts` exports all 5 hooks with correct cache invalidation patterns (projects, reports, report keys) |
| 4 | Monument badge appears on PropertyQuickCard | VERIFIED | `PropertyQuickCard.tsx` lines 68-78: conditional rendering of amber "Rijksmonument" or green "Geen monument" based on `data.monuments?.is_monument` |
| 5 | AI zoning section shows confidence badge with explanatory text | VERIFIED | `PropertyDetailDrawer.tsx` lines 470-508: AI Interpretatie section with `ConfidenceBadge`, samenvatting text, LOW confidence warning, and disclaimers |
| 6 | ConfidenceBadge follows SourceBadge styling pattern | VERIFIED | `ConfidenceBadge.tsx` uses `inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium` matching SourceBadge |
| 7 | User can create, rename, delete projects from Projecten page | VERIFIED | `ProjectList.tsx` (291 lines) with create/edit/delete actions, `ProjectCreateModal.tsx` (169 lines), `ProjectEditModal.tsx` (183 lines), wired into `projecten.tsx` |
| 8 | User can filter reports by project in the sidebar | VERIFIED | `ReportSidebar.tsx` line 37-38: `projectFilter` state passed to `useReports({ project_id: projectFilter })`, filter dropdown at lines 130-154 |
| 9 | User can assign a report to a project from the sidebar | VERIFIED | `ReportSidebar.tsx` lines 88-104: `handleAssignReport` using `useAssignReportToProject`, inline select per report at lines 221-242 |
| 10 | On mobile, property details display in bottom sheet format | VERIFIED | `Drawer.tsx` line 57: responsive classes `fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] ... md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:rounded-none` with mobile drag handle at line 61 |
| 11 | Force refresh button triggers full property re-lookup with force_refresh=true | VERIFIED | `map.tsx` lines 245-260: `handleForceRefresh` calls `lookup.mutate({ ...input, forceRefresh: true })`, `usePropertyLookup.ts` line 23-25 spreads `forceRefresh` to `lookupProperty`, `api.ts` lines 169-170 sets `force_refresh=true` query param |
| 12 | ProjectList shows reports inside expanded project cards (live mode) | FAILED | `ProjectList.tsx` line 151: `const reports = isDemo ? DEMO_REPORTS[project.id] ?? [] : []` -- live mode always returns empty array. TODO comment acknowledges this. |

**Score:** 10/12 truths verified (2 issues: 1 functional gap, 1 orphaned component)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/types/project.ts` | TypeScript types for ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse | VERIFIED | 33 lines, all 4 interfaces with correct fields matching backend schemas |
| `frontend/src/lib/api.ts` | Project CRUD API functions + assignReportToProject + force_refresh support | VERIFIED | 5 project functions at lines 382-500, `PROJECTS_BASE` constant at line 31, `forceRefresh` at lines 166-170 |
| `frontend/src/hooks/useProjects.ts` | 5 TanStack Query hooks with cache invalidation | VERIFIED | 136 lines, exports `useProjects`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`, `useAssignReportToProject` |
| `frontend/src/components/property/ConfidenceBadge.tsx` | Color-coded confidence badge (HIGH/MEDIUM/LOW) | VERIFIED | 42 lines, three confidence levels with semantic colors, title tooltip for LOW |
| `frontend/src/components/property/PropertyBottomSheet.tsx` | Mobile bottom sheet with touch-safe scrolling | ORPHANED | 73 lines, fully implemented with FocusLock, useEscapeKey, touch stopPropagation, but never imported anywhere. Drawer.tsx handles mobile responsiveness instead. |
| `frontend/src/components/property/PropertyQuickCard.tsx` | QuickCard with monument badge | VERIFIED | 122 lines, monument badge at lines 68-78, conditional amber/green rendering |
| `frontend/src/components/property/PropertyDetailDrawer.tsx` | Drawer with AI zoning display, force refresh button, ConfidenceBadge | VERIFIED | 774 lines, ConfidenceBadge imported at line 7, force refresh button at lines 52-71, AI Interpretatie section at lines 470-508 |
| `frontend/src/components/projects/ProjectList.tsx` | Project list with edit/delete actions and report counts | VERIFIED (with caveat) | 291 lines, expandable cards with demo data and CRUD actions, but live mode shows no reports per project |
| `frontend/src/components/projects/ProjectCreateModal.tsx` | Modal form for creating projects | VERIFIED | 169 lines, FocusLock, useEscapeKey, form with name+description, useCreateProject mutation, toast feedback |
| `frontend/src/components/projects/ProjectEditModal.tsx` | Modal form for editing projects | VERIFIED | 183 lines, pre-fills from project prop, useUpdateProject mutation, toast feedback |
| `frontend/src/routes/_authenticated/projecten.tsx` | Projecten page with ProjectList | VERIFIED | 26 lines, imports ProjectList, centered layout with header |
| `frontend/src/components/layout/ReportSidebar.tsx` | Sidebar with project grouping, filter, assignment | VERIFIED | 307 lines, useProjects + useAssignReportToProject imports, project name lookup map, filter dropdown, inline assignment select |
| `frontend/src/components/ui/Drawer.tsx` | Responsive Drawer (bottom sheet on mobile, right panel on desktop) | VERIFIED | 78 lines, responsive Tailwind classes, mobile drag handle, touch stopPropagation |
| `frontend/src/routes/_authenticated/map.tsx` | Map page with force refresh wiring | VERIFIED | 310 lines, handleForceRefresh at lines 245-260, passed as onRefreshAll to PropertyDetailDrawer at line 290 |
| `frontend/src/hooks/usePropertyLookup.ts` | Mutation hook with forceRefresh support | VERIFIED | 37 lines, accepts `AddressInput & { forceRefresh?: boolean }`, passes to lookupProperty |
| `frontend/src/styles/index.css` | slide-up animation keyframes | VERIFIED | Lines 64-71: @keyframes slide-up and .animate-slide-up class |
| `frontend/src/routes/_authenticated/rapport.$id.tsx` | Full detail report page route (bonus, from 17-04 bugfixes) | VERIFIED | 63 lines, resolves saved report or demo data, navigates to map |
| `frontend/src/components/reports/ReportDetailPage.tsx` | Comprehensive property report view (bonus) | VERIFIED | 606 lines, sections for Gebouw, Kadaster, Bestemming, Monument, AI Interpretatie, Bronnen |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useProjects.ts` | `api.ts` | import project API functions | WIRED | Line 17-22: imports `fetchProjects`, `createProject`, `updateProject`, `deleteProject`, `assignReportToProject` |
| `api.ts` | `/api/projects` | `PROJECTS_BASE` constant | WIRED | Line 31: `const PROJECTS_BASE = '/api/projects'`, used in all 5 functions |
| `PropertyDetailDrawer.tsx` | `ConfidenceBadge.tsx` | import ConfidenceBadge | WIRED | Line 7: `import { ConfidenceBadge } from './ConfidenceBadge'`, used at line 476 |
| `PropertyBottomSheet.tsx` | `useEscapeKey.ts` | import useEscapeKey | WIRED | Line 3: `import { useEscapeKey } from '@/hooks/useEscapeKey'`, used at line 23 |
| `ProjectList.tsx` | `useProjects.ts` | import useProjects, useDeleteProject | WIRED | Line 3: `import { useProjects, useDeleteProject } from '@/hooks/useProjects'` |
| `ReportSidebar.tsx` | `useProjects.ts` | import useProjects, useAssignReportToProject | WIRED | Line 3: `import { useProjects, useAssignReportToProject } from '@/hooks/useProjects'` |
| `projecten.tsx` | `ProjectList.tsx` | import ProjectList | WIRED | Line 2: `import ProjectList from '@/components/projects/ProjectList'` |
| `map.tsx` | `api.ts` | lookupProperty with forceRefresh | WIRED | Line 253: `lookup.mutate({ ...input, forceRefresh: true })` via usePropertyLookup which calls lookupProperty |
| `Drawer.tsx` | `index.css` | z-index CSS variables | WIRED | Line 49: `style={{ zIndex: 'var(--z-property-panel)' }}` references CSS variable defined in index.css line 48 |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| R7: Project Folders — Sidebar tab "Projecten" lists project folders | SATISFIED | Projecten page with ProjectList, side-rail navigation links to it |
| R7: Project Folders — Create, rename, delete projects | SATISFIED | ProjectCreateModal, ProjectEditModal, delete in ProjectList with confirm dialog |
| R7: Project Folders — Assign reports to projects | SATISFIED | ReportSidebar inline assignment dropdown per report |
| R7: Project Folders — Filter reports by project in sidebar | SATISFIED | ReportSidebar project filter dropdown passes project_id to useReports |
| R9: Polish — Bottom sheet pattern for property details on mobile | SATISFIED | Drawer.tsx made responsive with bottom sheet on mobile, drag handle, touch-safe scrolling |
| R9: Polish — Touch-friendly map interactions | SATISFIED | Drawer.tsx and PropertyBottomSheet.tsx both have onTouchStart/onTouchMove stopPropagation |
| R9: Polish — Monument badge on property cards | SATISFIED | PropertyQuickCard shows amber/green monument badge |
| R9: Polish — AI zoning summary display with confidence indicators | SATISFIED | PropertyDetailDrawer AI Interpretatie section with ConfidenceBadge, LOW warning, disclaimers |
| R9: Polish — Force refresh button for power users | SATISFIED | Drawer header "Ververs" button wired to handleForceRefresh in map.tsx with force_refresh=true query param |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/projects/ProjectList.tsx` | 151 | TODO: `[] // TODO: fetch from useReports({ project_id }) when live` | Warning | Expanded project cards show no reports in live mode -- only demo data works for project-report drilldown on Projecten page |
| `frontend/src/components/property/PropertyBottomSheet.tsx` | all | ORPHANED: Component never imported/used anywhere | Info | Dead code -- Drawer.tsx was made responsive instead. No functional impact since the Drawer approach works. |

### Human Verification Required

### 1. Project CRUD Operations

**Test:** Navigate to /projecten, create a new project "Test Project", edit it, delete it
**Expected:** All operations succeed with toast feedback, list updates immediately
**Why human:** Requires running frontend + backend with authentication

### 2. Mobile Bottom Sheet Behavior

**Test:** In browser DevTools, set viewport to 375px width, search a property address
**Expected:** Property drawer appears as bottom sheet from bottom with drag handle, scrollable content does not pan map
**Why human:** Responsive layout and touch interaction behavior

### 3. Force Refresh End-to-End

**Test:** Open a property drawer, click "Ververs" button
**Expected:** Loading state "Bezig...", then toast "Gegevens bijgewerkt met laatste bronnen", data refreshes
**Why human:** Requires backend running to verify force_refresh=true query param triggers fresh data fetch

### 4. Report Sidebar Project Integration

**Test:** Open report sidebar, use project filter dropdown, use inline assignment select on a report
**Expected:** Filter narrows visible reports, assignment moves report to new project group with toast "Rapport verplaatst"
**Why human:** Requires authenticated session with saved reports and projects

### 5. Report Detail Page

**Test:** From ProjectList, click a report in an expanded project card
**Expected:** Navigates to /rapport/:id with full detail page showing all sections
**Why human:** Visual layout verification, demo data navigation

### Gaps Summary

Two issues were found, one functional and one hygiene:

1. **ProjectList live-mode reports (Warning):** When running against the real API (non-demo), expanding a project card in ProjectList always shows "Geen rapporten in dit project" because the code hardcodes an empty array instead of fetching reports via `useReports({ project_id })`. This only affects the Projecten page's expandable view -- the ReportSidebar correctly fetches and groups reports by project. The Projecten page still shows project CRUD (create/edit/delete) and report counts correctly; only the inline report listing within each project card is missing in live mode.

2. **Orphaned PropertyBottomSheet (Info):** The `PropertyBottomSheet.tsx` component was created in Plan 17-02 but never integrated. Plan 17-04 instead made the existing `Drawer.tsx` responsive (bottom sheet on mobile, right panel on desktop), which achieves the same goal more elegantly with less code duplication. PropertyBottomSheet is dead code and could be removed.

Both R7 (Project Folders) and R9 (Polish & Mobile Responsiveness) acceptance criteria are functionally met. The ProjectList live-mode gap is a polish issue (demo mode works, sidebar works, only the Projecten page drilldown is missing in live mode) rather than a blocker for the requirements.

---

_Verified: 2026-02-09T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
