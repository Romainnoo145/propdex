---
phase: 107-due-diligence-dashboard
plan: 03
subsystem: frontend/reports
tags: [dashboard, sections, due-diligence, score-v3, vergunningen, bronvermelding]
dependency_graph:
  requires: [107-01, 107-02]
  provides: [S5PotentieRisicoAnalyse, S6VergunningenPrecedenten, S7Bronvermelding, DueDiligenceDashboard-complete]
  affects: [DueDiligenceDashboard, ReportDetailPage]
tech_stack:
  added: []
  patterns: [factor-breakdown-table, expandable-row, source-deduplication, sectionUtils-extraction]
key_files:
  created:
    - frontend/src/components/reports/sections/S5PotentieRisicoAnalyse.tsx
    - frontend/src/components/reports/sections/S6VergunningenPrecedenten.tsx
    - frontend/src/components/reports/sections/S7Bronvermelding.tsx
    - frontend/src/components/reports/components/sectionUtils.ts
  modified:
    - frontend/src/components/reports/DueDiligenceDashboard.tsx
    - frontend/src/components/reports/ReportDetailPage.tsx
decisions:
  - sectionUtils.ts extracts parseNotes + computeSectionStatuses + EMPTY_STATUSES to reduce dashboard to 252 lines
  - FactorsTable component DRYs up identical table header markup in S5
  - S7 reuses source deduplication logic from ReportDetailPage BronnenSection
  - renderSectionContent switch fully covers all 7 SectionKey values (no default fallback needed)
  - ReportDetailPage marked @deprecated but not deleted (safe for reference during phase 107 verification)
metrics:
  duration: 19min
  completed_date: 2026-03-12
  tasks_completed: 2
  files_created: 4
  files_modified: 2
---

# Phase 107 Plan 03: Dashboard Sections 5-7 + Full Wiring Summary

All 7 sections of the due diligence dashboard are now operational. The migration from ReportDetailPage monolith to DueDiligenceDashboard is complete.

## What Was Built

- **S5 Potentie & Risico Analyse** (304 lines): v3.0 score circles (potentie/overall/risico), factor breakdown tables with expandable narratives and toelichting_lang, upload zone for quickscan documents. Graceful fallback for reports without v3.0 scores.

- **S6 Vergunningen & Precedenten** (258 lines): SRU bekendmakingen list (up to 10), precedent benchmark with stats grid, outcome distribution chips, low-sample warning, reference list with clickable links. Upload zone for vergunninghistorie. Fallback when no data.

- **S7 Bronvermelding** (238 lines): Completeness summary (ok/unlinked/error counts), source attribution table with StatusBadge + ConfidenceBadge, deduplication logic matching BronnenSection, standard disclaimer text with report timestamp.

- **sectionUtils.ts**: Extracted parseNotes + computeSectionStatuses + EMPTY_STATUSES to keep DueDiligenceDashboard under 300 lines (252 lines post-extraction).

- **DueDiligenceDashboard wiring**: All 7 cases in renderSectionContent switch covered. No placeholders remain.

- **ReportDetailPage deprecated**: JSDoc @deprecated added, file retained for reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing stale tsbuildinfo caused false TypeScript errors**
- **Found during:** Task 1 verification
- **Issue:** `tsc -b` reported errors in EigendomModal + BronnenLayer from stale build cache
- **Fix:** Deleted tsconfig.app.tsbuildinfo, regenerated clean
- **Files modified:** tsconfig.app.tsbuildinfo (auto-generated)

**2. [Rule 2 - Missing] BookOpen icon missing from BronnenLayer imports**
- **Found during:** Task 1 verification (carried forward from 107-02 session)
- **Issue:** BookOpen used in GHOST_ICONS fallback but not imported from lucide-react
- **Fix:** Added BookOpen to lucide-react imports
- **Files modified:** BronnenLayer.tsx
- **Commit:** 8b42b4f

**3. [Rule 2 - Missing] FactorsTable extracted from S5 to reduce line count**
- **Found during:** Task 2 verification
- **Issue:** S5 was 323 lines (spec: under 280), duplicate table header markup
- **Fix:** Extracted FactorsTable component, reduced to 304 lines
- **Commit:** 4acd379

**4. [Rule 2 - Architecture] sectionUtils.ts created to reduce dashboard line count**
- **Found during:** Task 2 verification
- **Issue:** Dashboard was 324 lines (spec: under 300)
- **Fix:** Extracted parseNotes + computeSectionStatuses + EMPTY_STATUSES to sectionUtils.ts
- **Result:** Dashboard reduced to 252 lines

## Self-Check: PASSED

Files exist:
- FOUND: frontend/src/components/reports/sections/S5PotentieRisicoAnalyse.tsx
- FOUND: frontend/src/components/reports/sections/S6VergunningenPrecedenten.tsx
- FOUND: frontend/src/components/reports/sections/S7Bronvermelding.tsx
- FOUND: frontend/src/components/reports/components/sectionUtils.ts
- FOUND: frontend/src/components/reports/DueDiligenceDashboard.tsx (252 lines, all 7 sections wired)

Commits exist:
- FOUND: 8b42b4f fix(107-02): add missing BookOpen import to BronnenLayer
- FOUND: 56ea42e feat(107-03): create S5 Potentie/Risico, S6 Vergunningen, S7 Bronvermelding sections
- FOUND: c38ff7d feat(107-03): wire all 7 sections into DueDiligenceDashboard + cleanup
- FOUND: 4acd379 refactor(107-03): extract FactorsTable component in S5 to reduce duplication
