---
phase: 69-risicobeoordeling-dossier
plan: "02"
subsystem: ui
tags: [weasyprint, jinja2, pdf, react, typescript, fastapi]

# Dependency graph
requires:
  - phase: 69-risicobeoordeling-dossier
    provides: generate_dossier_pdf() + POST /reports/{id}/dossier endpoint + wkb_kwaliteitsborger.html placeholder

provides:
  - Full wkb_kwaliteitsborger.html Jinja2 dossier template (7 sections + per-page INDICATIEF disclaimer)
  - generateStartdossier() API function in frontend/src/lib/api.ts
  - "Genereer Startdossier" CTA button in ReportHeader with amber styling and loading state
  - reportId prop thread: rapport.$id.tsx -> ReportDetailPage -> ReportHeader

affects:
  - 69-03 (if any follow-up plans refine dossier template or UX)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Jinja2 CSS running elements: position: running(footer) + @page @bottom-center { content: element(footer) } for per-page disclaimers"
    - "Three-state bodem template logic: none (not queried) / dossiers=[] (none found, caution note) / dossiers=[...] (contamination, show list)"
    - "generateStartdossier() follows exportReportPDF() pattern exactly: POST instead of GET, same blob download flow"
    - "reportId prop thread pattern: route param -> page -> header (mirrors existing source_parcel_id threading)"

key-files:
  created: []
  modified:
    - backend/app/reports/templates/wkb_kwaliteitsborger.html
    - frontend/src/lib/api.ts
    - frontend/src/components/reports/ReportDetailPage.tsx
    - frontend/src/components/reports/ReportHeader.tsx
    - frontend/src/routes/_authenticated/rapport.$id.tsx

key-decisions:
  - "asbest_indicator rendered inside Section 7 Wkb block (not separate section) — asbest risk is part of the Wkb risk assessment"
  - "Dossier button shown even when reportId would be null (disabled state) — consistent UI; only truly enabled when valid UUID present"
  - "SpinnerIcon uses CSS @keyframes spin defined inline — no external dependency, matches pattern of other inline SVG icons"

patterns-established:
  - "Jinja2 null-safe access: use 'is not none' guards before nested field access (report_data.zoning.plans[0] needs zoning is not none AND plans | length > 0)"
  - "Blob download pattern: fetch -> response.blob() -> createObjectURL -> anchor.click() -> revokeObjectURL"

requirements-completed: [DOSSIER-01, DOSSIER-02, DOSSIER-03]

# Metrics
duration: 5min
completed: "2026-03-02"
---

# Phase 69 Plan 02: Risicobeoordeling Dossier Frontend + Template Summary

**Full Jinja2 dossier template with 7 required sections and per-page INDICATIEF disclaimer, plus "Genereer Startdossier" amber CTA button in ReportHeader with download flow — DOSSIER-01, DOSSIER-02, DOSSIER-03 complete**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-02T13:35:55Z
- **Completed:** 2026-03-02T13:40:43Z
- **Tasks:** 2 automated (Task 3 is human-verify checkpoint)
- **Files modified:** 5

## Accomplishments
- Complete wkb_kwaliteitsborger.html with all 7 required sections: Perceelgegevens, Gebouwgegevens, Bodemkwaliteit, Bestemmingsplan, Monumentstatus, Energielabel, Wkb Classificatie
- Per-page running footer via CSS `position: running(footer)` + `@page @bottom-center { content: element(footer) }` — "INDICATIEF | Risicobeoordeling Startdossier | Propdex | ..." on every page (DOSSIER-03)
- Prominent amber disclaimer box (left border #e67e00) in document body with full legal warning text (DOSSIER-03)
- Three-state bodem logic: null (not queried) / empty dossiers (geen verontreiniging + caution) / populated dossiers (show per-dossier data) (DOSSIER-03)
- generateStartdossier() API function following exportReportPDF() pattern exactly (POST /dossier endpoint) (DOSSIER-01)
- "Genereer Startdossier" button in ReportHeader with amber styling, DocumentIcon, loading spinner, and disabled state

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete wkb_kwaliteitsborger.html Jinja2 template** - `be6670e` (feat)
2. **Task 2: Frontend generateStartdossier() API + CTA button + reportId prop threading** - `b773a0d` (feat)
3. **Task 3: Human verify checkpoint** - `a0efd38` (docs — checkpoint, APPROVED)

**Plan metadata:** see final docs commit

## Files Created/Modified
- `backend/app/reports/templates/wkb_kwaliteitsborger.html` - Full 7-section dossier template (578 lines) with per-page disclaimer and three-state bodem logic
- `frontend/src/lib/api.ts` - Added generateStartdossier() function (POST /dossier, returns Blob)
- `frontend/src/components/reports/ReportDetailPage.tsx` - Added reportId? prop to interface + destructuring + ReportHeader pass-through
- `frontend/src/components/reports/ReportHeader.tsx` - Added reportId prop, useState/useCallback/useAuth/generateStartdossier imports, handleGenerateDossier handler, DocumentIcon + SpinnerIcon SVGs, "Genereer Startdossier" CTA button
- `frontend/src/routes/_authenticated/rapport.$id.tsx` - Added reportId={id.startsWith('r') ? null : id} prop to ReportDetailPage

## Decisions Made
- asbest_indicator rendered inside Section 7 Wkb block — asbest risk is integral to the Wkb risk assessment, not a standalone section
- "Genereer Startdossier" button shown in all states (disabled when !reportId) for consistent UI
- SpinnerIcon with inline CSS @keyframes — no external dep, follows project pattern of inline SVG icons in ReportHeader

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## User Feedback (Task 3 Checkpoint)
- Checkpoint: APPROVED (2026-03-02)
- User comment: "het werkt hoor, maar allemaal freaking middelmaat" (it works, but everything is mediocre)
- Interpretation: PDF generation and download flow are functional (DOSSIER-01/02/03 satisfied), but visual presentation quality is below desired level
- Action: No blocker for current phase — requirements met. UI polish and PDF visual design refinement noted for a future phase.

## Next Phase Readiness
- Full dossier PDF feature is complete: backend endpoint (Plan 01) + full template with all 7 sections (Plan 02) + CTA button (Plan 02)
- DOSSIER-01, DOSSIER-02, DOSSIER-03 all satisfied — Phase 69 is fully complete
- Phase 70 (supply recruitment / kwaliteitsborger onboarding) and Phase 71 (professional CTA) can proceed
- Future polish opportunity: visual design of the PDF dossier template (typography, section headers, brand styling)

---
*Phase: 69-risicobeoordeling-dossier*
*Completed: 2026-03-02*
