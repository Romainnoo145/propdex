---
phase: 107-due-diligence-dashboard
plan: 01
subsystem: frontend/reports
tags: [dashboard, section-nav, framer-motion, notes, pdf-export]
dependency_graph:
  requires: []
  provides: [DueDiligenceDashboard, SectionNav, SectionShell, SectionStatusBadge, useUpdateNotes]
  affects: [frontend/src/routes/_authenticated/rapport.$id.tsx]
tech_stack:
  added: []
  patterns: [URL-synced section nav, per-section JSON notes, Framer Motion layoutId]
key_files:
  created:
    - frontend/src/components/reports/DueDiligenceDashboard.tsx
    - frontend/src/components/reports/components/SectionNav.tsx
    - frontend/src/components/reports/components/SectionShell.tsx
    - frontend/src/components/reports/components/SectionStatusBadge.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useReports.ts
    - frontend/src/lib/types/property.ts
    - frontend/src/routes/_authenticated/rapport.$id.tsx
decisions:
  - "parseNotes handles JSON object and plain-text migration (legacy notes field)"
  - "navigate search updated via window.history + navigate to . to avoid TanStack Router generic type conflict"
  - "computeSectionStatuses uses risk field count threshold (>=4 = complete, >0 = partial)"
  - "DueDiligenceDashboard does not delete ReportDetailPage — Plan 02 will extract section content from it"
metrics:
  duration: 5min
  completed: 2026-03-12
  tasks: 3
  files: 8
---

# Phase 107 Plan 01: Due Diligence Dashboard Shell Summary

**One-liner:** Interactive due diligence workspace with 7-section URL-synced nav, per-section JSON notes persistence, and Framer Motion animated selection using existing CategoryTabs spring config.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | API layer + useUpdateNotes hook + Phase 104 types | 3f61b6c | api.ts, useReports.ts, property.ts |
| 2 | Shared dashboard components | 8b6be50 | SectionNav.tsx, SectionShell.tsx, SectionStatusBadge.tsx |
| 3 | DueDiligenceDashboard + route rewire | 2408cde | DueDiligenceDashboard.tsx, rapport.$id.tsx |

## What Was Built

### API Layer (Task 1)
- `updateReportNotes(reportId, notes, accessToken)` — PATCH to existing backend endpoint `/api/reports/{id}/notes`
- `useUpdateNotes()` — mutation hook that invalidates `['report', reportId]` cache on success
- `PropertyReportResponse` extended with 13 Phase 104 enrichment fields (all optional)

### Shared Components (Task 2)
- **SectionNav**: 7-item vertical nav with Framer Motion `layoutId="section-nav-active"` (spring stiffness 380, damping 30), Plus Jakarta Sans, color `#1A1C1E` active / `#94a3b8` inactive, status dot per item
- **SectionShell**: Section wrapper with icon+title header, SectionStatusBadge, scrollable content area, collapsible notes textarea (auto-resize), PDF export button
- **SectionStatusBadge**: Full badge (complete/partial/empty) + `SectionStatusDot` 6px circle variant for nav

### Dashboard + Route (Task 3)
- **DueDiligenceDashboard**: 220px sidebar + flex-1 main, `AnimatePresence mode="wait"` with opacity+y transition per section
- `parseNotes()` handles JSON object or plain-text migration fallback
- `computeSectionStatuses()` derives 7 statuses from `PropertyReportResponse` fields
- Section content placeholders ("Inhoud volgt in Plan 107-02") for all 7 sections
- **Route rewired**: `rapport.$id.tsx` imports `DueDiligenceDashboard`, adds `section?: string` to search params

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TanStack Router navigate generic type conflict**
- **Found during:** Task 3
- **Issue:** `navigate({ search: (prev) => ({ ...prev, section: key }) })` produced type error — component is not route-aware so generic resolves to `never`
- **Fix:** Used `window.history.pushState` to update URL params, then `navigate({ to: '.', search: Object.fromEntries(...), replace: true })` for router sync
- **Files modified:** frontend/src/components/reports/DueDiligenceDashboard.tsx

### Out-of-Scope Pre-existing Errors

Two TypeScript errors exist in unstaged files modified before this session. Logged to `deferred-items.md`:
- `EigendomModal.tsx`: `import.meta.env.DEV` missing vite/client types
- `BronnenLayer.tsx`: missing `BookOpen` lucide import

These did not block plan execution (my files compile clean; errors are in unrelated components).

## Self-Check

### Files exist
- frontend/src/components/reports/DueDiligenceDashboard.tsx — FOUND
- frontend/src/components/reports/components/SectionNav.tsx — FOUND
- frontend/src/components/reports/components/SectionShell.tsx — FOUND
- frontend/src/components/reports/components/SectionStatusBadge.tsx — FOUND

### Commits exist
- 3f61b6c — Task 1
- 8b6be50 — Task 2
- 2408cde — Task 3

## Self-Check: PASSED
