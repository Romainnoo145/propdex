---
phase: 17-projects-polish
plan: 03
subsystem: frontend-projects-ui
tags:
  - typescript
  - react
  - projects
  - crud
  - sidebar
dependency-graph:
  requires:
    - frontend/src/hooks/useProjects.ts (TanStack Query hooks)
    - frontend/src/lib/types/project.ts (TypeScript types)
    - frontend/src/components/layout/ReportSidebar.tsx (existing sidebar)
    - frontend/src/routes/_authenticated/projecten.tsx (page route)
  provides:
    - frontend/src/components/projects/ProjectList.tsx (project list with CRUD)
    - frontend/src/components/projects/ProjectCreateModal.tsx (create modal)
    - frontend/src/components/projects/ProjectEditModal.tsx (edit modal)
    - Enhanced ReportSidebar with project filtering and assignment
  affects:
    - Plan 17-04 (may use project components or patterns)
tech-stack:
  added: []
  patterns:
    - Glassmorphism modal pattern with FocusLock and useEscapeKey
    - Inline project assignment dropdowns in sidebar
    - Sorted accordion groups (special section first, then alphabetical)
    - Toast feedback for all mutations
    - Confirmation dialogs for destructive actions
key-files:
  created:
    - frontend/src/components/projects/ProjectList.tsx
    - frontend/src/components/projects/ProjectCreateModal.tsx
    - frontend/src/components/projects/ProjectEditModal.tsx
  modified:
    - frontend/src/routes/_authenticated/projecten.tsx
    - frontend/src/components/layout/ReportSidebar.tsx
decisions:
  - Project name lookup map: Convert project_id UUIDs to names for display, prevents showing raw UUIDs in UI
  - Sorted groups with "Geen project" first: Always show unassigned reports at top, then alphabetical project order
  - Inline assignment dropdowns: Quick project assignment directly in sidebar without modal or extra clicks
  - Increased maxHeight per report: Changed from 100px to 150px to accommodate assignment dropdown below each ReportCard
  - Centered modal pattern: Reuse glassmorphism styling but center on screen (not right-sliding drawer)
metrics:
  duration: 184
  completed: 2026-02-09T09:54:52Z
---

# Phase 17 Plan 03: Project UI (CRUD + Sidebar Integration) Summary

Complete project folder management UI with Projecten page, modals, and enhanced ReportSidebar with filtering and assignment.

## Overview

Built the full project management UI following R7 (Project Folders) requirement. Created three modal components for CRUD operations on the Projecten page, and enhanced the ReportSidebar to display project names, filter by project, and allow inline report-to-project assignment. All operations include toast feedback and proper cache invalidation.

## Tasks Completed

### Task 1: Project CRUD components and Projecten page

**Commit:** 8818742

**Files:**
- Created `frontend/src/components/projects/ProjectCreateModal.tsx` (172 lines)
  - Glassmorphism centered modal with FocusLock and useEscapeKey
  - Form with name (required, max 100 chars) and description (optional)
  - useCreateProject mutation with toast feedback
  - Disable submit while pending, reset form on success
- Created `frontend/src/components/projects/ProjectEditModal.tsx` (179 lines)
  - Similar to CreateModal but pre-fills from project prop
  - useUpdateProject mutation with projectId and data
  - Toast success "Project bijgewerkt"
- Created `frontend/src/components/projects/ProjectList.tsx` (156 lines)
  - Flat list of projects with report counts (badge)
  - Edit button (pencil icon) opens ProjectEditModal
  - Delete button (trash icon) with window.confirm dialog
  - Create button at top opens ProjectCreateModal
  - Loading state and empty state with CTA button
  - Card row styling: bg-white/5 hover:bg-white/10 rounded-lg
- Modified `frontend/src/routes/_authenticated/projecten.tsx`
  - Replaced "Binnenkort beschikbaar" placeholder with ProjectList
  - Centered layout (max-w-4xl mx-auto px-8 py-6)
  - Header: "Projecten" title + subtitle "Organiseer je rapporten in projectmappen"

**Implementation notes:**
- All modals use z-index var(--z-modal) for backdrop and calc(var(--z-modal) + 1) for card
- FocusLock + useEscapeKey + backdrop click-to-close pattern
- Delete shows confirm dialog: "Project verwijderen? Rapporten worden niet verwijderd."
- Toast feedback for all mutations (create/update/delete)
- Form reset on modal close (both Cancel and success)

### Task 2: ReportSidebar project filtering and report assignment

**Commit:** bbca6d0

**Files:**
- Modified `frontend/src/components/layout/ReportSidebar.tsx` (131 insertions, 44 deletions)
  - Added projectFilter state (string | undefined) for filter dropdown
  - Pass projectFilter to useReports({ project_id: projectFilter })
  - useProjects hook to fetch project list for lookups and dropdowns
  - useAssignReportToProject mutation for inline assignment
  - Project lookup map: `new Map(projectsData?.projects.map(p => [p.id, p.name]) ?? [])`
  - Convert report.project_id to project name in grouping logic
  - Sort groups: "Geen project" first (-1 sort), then alphabetical
  - Project filter dropdown (above search): select with "Alle projecten" + project options
  - Inline assignment dropdown per report: select with "Geen project" + project options
  - handleAssignReport function with toast success/error feedback
  - Increased accordion maxHeight from 100px to 150px per report (to fit assignment dropdown)

**Implementation notes:**
- Filter dropdown only shows when reports exist AND projects exist
- Assignment dropdown only shows when projects exist (per report)
- Filter passes to useReports query, triggers new fetch with project_id filter
- Assignment uses stopPropagation on select to prevent report click
- Sorted groups ensure "Geen project" is always first and expanded by default
- All three caches invalidated on assignment (specific report, all reports, all projects)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compilation passes (`npx tsc --noEmit`) after both tasks
- ProjectList imports useProjects and useDeleteProject hooks
- ProjectCreateModal and ProjectEditModal use useCreateProject and useUpdateProject
- Projecten page imports ProjectList component
- ReportSidebar imports useProjects and useAssignReportToProject
- Project filter passes to useReports({ project_id: projectFilter })
- "Geen project" default expanded state maintained (still in initial Set)
- All CRUD operations have toast feedback
- Delete project shows confirmation dialog before mutation

## Technical Notes

### Modal Pattern

Both create and edit modals follow the same pattern:
- Centered positioning: `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`
- Glassmorphism: `bg-black/60 backdrop-blur-xl border-white/15 rounded-2xl`
- Form fields: `bg-white/5 border-white/10 text-white placeholder-white/30`
- Footer buttons: Cancel (ghost) + Submit (blue primary)
- Form reset on success and cancel

### Project Name Lookup

ReportSidebar converts UUIDs to names using a Map lookup:
```typescript
const projectMap = new Map(projectsData?.projects.map(p => [p.id, p.name]) ?? [])
const key = report.project_id ? (projectMap.get(report.project_id) || report.project_id) : 'Geen project'
```

Fallback to UUID if project not found (edge case: project deleted but report still has old ID).

### Sorted Groups

Custom sort ensures "Geen project" is always first:
```typescript
const sortedGroups = Object.entries(groupedReports).sort(([a], [b]) => {
  if (a === 'Geen project') return -1
  if (b === 'Geen project') return 1
  return a.localeCompare(b)
})
```

### Inline Assignment

Each report gets a small select dropdown below the ReportCard:
- Value is report.project_id or empty string
- onChange triggers assignMutation with reportId and new projectId (or null)
- stopPropagation prevents triggering report click when interacting with select
- Disabled while mutation pending

### Cache Invalidation

Assignment invalidates all three relevant caches:
- `['report', reportId]` - specific report (project_id field changed)
- `['reports']` - all report lists (grouping changes, filters may vary)
- `['projects']` - project list (report_count field changes)

## Dependencies

**Requires:**
- Phase 17-01: useProjects hooks and project types
- Phase 16-05: ReportSidebar component with accordion
- Phase 16-01: Drawer/Modal patterns and toast library

**Enables:**
- R7 (Project Folders) complete: Users can create/edit/delete projects, filter reports by project, assign reports to projects

## Self-Check: PASSED

**Created files exist:**
```
FOUND: frontend/src/components/projects/ProjectList.tsx
FOUND: frontend/src/components/projects/ProjectCreateModal.tsx
FOUND: frontend/src/components/projects/ProjectEditModal.tsx
```

**Modified files exist:**
```
FOUND: frontend/src/routes/_authenticated/projecten.tsx
FOUND: frontend/src/components/layout/ReportSidebar.tsx
```

**Commits exist:**
```
FOUND: 8818742 (Task 1: Project CRUD components and Projecten page)
FOUND: bbca6d0 (Task 2: ReportSidebar project filtering and assignment)
```

**TypeScript compilation:**
```
PASSED: npx tsc --noEmit (no errors)
```

**Imports verified:**
```
FOUND: ProjectList imports useProjects, useDeleteProject
FOUND: ReportSidebar imports useProjects, useAssignReportToProject
FOUND: projecten.tsx imports ProjectList
```

**Key features verified:**
```
FOUND: Project filter dropdown in ReportSidebar
FOUND: Inline assignment dropdown per report
FOUND: Sorted groups with "Geen project" first
FOUND: Toast feedback on create/update/delete/assign
FOUND: Confirmation dialog on delete
```
