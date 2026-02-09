---
phase: 17-projects-polish
plan: 01
subsystem: frontend-data-layer
tags:
  - typescript
  - tanstack-query
  - api-client
  - projects
  - crud
dependency-graph:
  requires:
    - backend/app/schemas/project.py (ProjectResponse, ProjectCreate, ProjectUpdate, ProjectListResponse)
    - backend/app/projects/router.py (project CRUD endpoints)
    - backend/app/reports/router.py (assign report to project endpoint)
    - frontend/src/lib/auth/useAuth.ts (useAuth hook)
    - frontend/src/lib/api.ts (apiFetch wrapper)
  provides:
    - frontend/src/lib/types/project.ts (TypeScript types)
    - frontend/src/lib/api.ts (project API functions)
    - frontend/src/hooks/useProjects.ts (TanStack Query hooks)
  affects:
    - Plan 17-02 (Project UI components will consume these hooks)
tech-stack:
  added: []
  patterns:
    - TanStack Query hooks with cache invalidation
    - apiFetch wrapper for authenticated requests
    - snake_case TypeScript types matching backend JSON
key-files:
  created:
    - frontend/src/lib/types/project.ts
    - frontend/src/hooks/useProjects.ts
  modified:
    - frontend/src/lib/api.ts
decisions: []
metrics:
  duration: 115
  completed: 2026-02-09T09:47:12Z
---

# Phase 17 Plan 01: Project Data Layer Summary

JWT-authenticated project CRUD + report assignment via TanStack Query hooks with proper cache invalidation.

## Overview

Created the complete project data layer following the exact same patterns as the existing report data layer. This provides three files: TypeScript types matching backend schemas, API client functions for all project endpoints, and TanStack Query hooks with reactive cache invalidation.

## Tasks Completed

### Task 1: Project types and API client functions

**Commit:** ef43668

**Files:**
- Created `frontend/src/lib/types/project.ts` with 4 interfaces:
  - `ProjectCreate` (POST /api/projects body)
  - `ProjectUpdate` (PATCH /api/projects/{id} body)
  - `ProjectResponse` (single project from API)
  - `ProjectListResponse` (GET /api/projects response)
- Modified `frontend/src/lib/api.ts` with 5 new functions:
  - `fetchProjects(accessToken)` - GET /api/projects
  - `createProject(data, accessToken)` - POST /api/projects
  - `updateProject(projectId, data, accessToken)` - PATCH /api/projects/{projectId}
  - `deleteProject(projectId, accessToken)` - DELETE /api/projects/{projectId}
  - `assignReportToProject(reportId, projectId, accessToken)` - PATCH /api/reports/{reportId}/project

**Implementation notes:**
- All types use snake_case to match backend JSON exactly (project decision from Phase 15-01)
- API functions follow existing patterns: `apiFetch<T>()` for JSON responses, raw fetch for DELETE
- Added `PROJECTS_BASE = '/api/projects'` constant
- Backend DELETE returns `{"message": "...", "project_id": "..."}` which is discarded (matches deleteReport pattern)

### Task 2: TanStack Query hooks for project CRUD

**Commit:** 8405ca6

**Files:**
- Created `frontend/src/hooks/useProjects.ts` with 5 hooks:
  - `useProjects()` - useQuery(['projects'], staleTime 10 minutes)
  - `useCreateProject()` - useMutation, invalidates ['projects']
  - `useUpdateProject()` - useMutation, invalidates ['projects'] and ['reports']
  - `useDeleteProject()` - useMutation, invalidates ['projects'] and ['reports']
  - `useAssignReportToProject()` - useMutation, invalidates ['report', id], ['reports'], ['projects']

**Implementation notes:**
- 10-minute stale time for projects (longer than reports' 5 minutes - projects change less frequently)
- useUpdateProject invalidates reports cache because project name changes affect report grouping labels
- useDeleteProject invalidates reports cache because reports move to "Geen project" section
- useAssignReportToProject invalidates all three caches (specific report, all reports, all projects)
- All hooks use useAuth() pattern and explicit TypeScript generics matching useReports.ts

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compilation passes (`npx tsc --noEmit`)
- All 4 type interfaces exported from types/project.ts
- All 5 API functions added to api.ts (fetchProjects, createProject, updateProject, deleteProject, assignReportToProject)
- All 5 hooks exported from useProjects.ts
- Cache invalidation patterns follow TanStack Query best practices
- Code follows existing patterns from useReports.ts and api.ts

## Technical Notes

### Type Definitions

All types match backend schemas exactly:
- `ProjectResponse.id` is string (UUID) to match JSON serialization
- `created_at`/`updated_at` are ISO datetime strings
- `report_count` is computed field from backend (subquery in router)

### API Functions

- `deleteProject` uses raw fetch pattern (not apiFetch) to match deleteReport
- `assignReportToProject` sends `{ project_id: projectId }` body to PATCH /api/reports/{reportId}/project
- All functions include Bearer token authentication via headers

### Query Hooks

Query keys:
- `['projects']` - project list
- `['report', reportId]` - specific report (invalidated by assign)
- `['reports']` - all report lists (invalidated by update/delete/assign)

Stale times:
- Projects: 10 minutes (longer than reports - projects change rarely)
- Reports: 5 minutes (existing from Phase 16-04)

## Dependencies

**Requires:**
- Backend project schemas and router (Phase 6)
- Backend report assign endpoint (Phase 6)
- TanStack Query (installed Phase 13)
- useAuth hook (Phase 14)

**Enables:**
- Plan 17-02: Project UI components (project list, create/edit/delete dialogs)

## Self-Check: PASSED

**Created files exist:**
```
FOUND: frontend/src/lib/types/project.ts
FOUND: frontend/src/hooks/useProjects.ts
```

**Modified files exist:**
```
FOUND: frontend/src/lib/api.ts
```

**Commits exist:**
```
FOUND: ef43668
FOUND: 8405ca6
```

**TypeScript compilation:**
```
PASSED: npx tsc --noEmit (no errors)
```

**Exports verified:**
```
FOUND: ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
FOUND: fetchProjects, createProject, updateProject, deleteProject, assignReportToProject
FOUND: useProjects, useCreateProject, useUpdateProject, useDeleteProject, useAssignReportToProject
```
