---
phase: 69-risicobeoordeling-dossier
plan: "01"
subsystem: api
tags: [weasyprint, jinja2, pdf, sqlalchemy, alembic, fastapi]

# Dependency graph
requires:
  - phase: 65-report-presentation
    provides: existing pdf_export.py pattern + report router pattern

provides:
  - GeneratedDossier SQLAlchemy model (generated_dossiers table, FK saved_reports + users)
  - Alembic migration 3d97e34821f2 creating generated_dossiers table
  - generate_dossier_pdf() synchronous function using WeasyPrint via asyncio.to_thread
  - POST /api/reports/{report_id}/dossier endpoint (5/min rate limit, returns PDF)
  - GET /api/reports/{report_id}/dossiers endpoint (30/min, returns generation history)
  - save_generated_dossier() + list_generated_dossiers() service functions
  - GeneratedDossierResponse Pydantic schema
  - Minimal wkb_kwaliteitsborger.html placeholder template (Plan 02 replaces)

affects:
  - 69-02 (Plan 02 replaces placeholder template with full Jinja2 dossier template)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "asyncio.to_thread pattern for CPU-bound WeasyPrint PDF generation"
    - "GeneratedDossier audit trail: one row per PDF generation event"
    - "Minimal placeholder template in Plan 01, full template in Plan 02"

key-files:
  created:
    - backend/app/models/generated_dossier.py
    - backend/alembic/versions/3d97e34821f2_add_generated_dossiers_table.py
    - backend/app/reports/dossier_export.py
    - backend/app/reports/templates/wkb_kwaliteitsborger.html
  modified:
    - backend/app/models/__init__.py
    - backend/app/reports/service.py
    - backend/app/reports/router.py
    - backend/app/schemas/report.py

key-decisions:
  - "Minimal placeholder template in Plan 01 ensures endpoint is testable; full Jinja2 template is Plan 02"
  - "template_version='v1' default in model — Plan 02 may introduce v2 if template structure changes significantly"
  - "Alembic autogenerate detected PostGIS tiger tables as removed — migration manually cleaned to only include generated_dossiers"
  - "generated_by: current_user.full_name or current_user.email (fallback to email if no display name set)"

patterns-established:
  - "generate_dossier_pdf() follows generate_report_pdf() pattern exactly: sync, FileSystemLoader, HTML(string=).write_pdf()"
  - "Dossier endpoint saves audit record AFTER PDF bytes are in memory (not before), so file_size_bytes is accurate"
  - "GET /dossiers verifies report ownership via service.get_report() before returning dossier list (tenant isolation)"

requirements-completed: [DOSSIER-01]

# Metrics
duration: 3min
completed: "2026-03-02"
---

# Phase 69 Plan 01: Risicobeoordeling Dossier Backend Summary

**GeneratedDossier DB model + Alembic migration + generate_dossier_pdf() WeasyPrint function + POST/GET dossier endpoints wired into existing reports router**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T13:29:57Z
- **Completed:** 2026-03-02T13:33:09Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- GeneratedDossier SQLAlchemy model with TenantMixin + FK to saved_reports and users; Alembic migration applied cleanly at head (3d97e34821f2)
- generate_dossier_pdf() synchronous function using WeasyPrint via asyncio.to_thread with Jinja2 FileSystemLoader pointing at wkb_kwaliteitsborger.html template
- Two new router endpoints: POST /{report_id}/dossier (5/min rate limit, returns StreamingResponse PDF with audit record) + GET /{report_id}/dossiers (30/min, returns GeneratedDossierResponse list)

## Task Commits

Each task was committed atomically:

1. **Task 1: GeneratedDossier model + Alembic migration** - `3a622f7` (feat)
2. **Task 2: dossier_export + router endpoints + service functions** - `b75b514` (feat)

**Plan metadata:** see final docs commit

## Files Created/Modified
- `backend/app/models/generated_dossier.py` - GeneratedDossier SQLAlchemy 2.x model (TenantMixin, TimestampMixin, FKs, composite indexes)
- `backend/alembic/versions/3d97e34821f2_add_generated_dossiers_table.py` - Clean migration (manually trimmed PostGIS tiger noise)
- `backend/app/models/__init__.py` - Added GeneratedDossier import + __all__ entry
- `backend/app/reports/dossier_export.py` - generate_dossier_pdf() WeasyPrint function
- `backend/app/reports/templates/wkb_kwaliteitsborger.html` - Minimal placeholder HTML template
- `backend/app/reports/service.py` - save_generated_dossier() + list_generated_dossiers() added; GeneratedDossier imported
- `backend/app/reports/router.py` - POST /{report_id}/dossier + GET /{report_id}/dossiers endpoints added; generate_dossier_pdf + GeneratedDossierResponse imported
- `backend/app/schemas/report.py` - GeneratedDossierResponse Pydantic schema added

## Decisions Made
- Minimal placeholder template in Plan 01 (just h1 + report_name + generated_at + generated_by) — Plan 02 replaces with full WKB dossier sections including risk assessment and disclaimer
- Alembic autogenerate included PostGIS tiger table noise in the migration — manually cleaned to only include the generated_dossiers table create/indexes
- template_version="v1" hardcoded in save_generated_dossier() — Plan 02 can bump to "v2" if template structure changes significantly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Alembic autogenerate detected unrelated PostGIS/tiger schema differences — manually edited the generated migration file to include only the generated_dossiers table DDL. This is standard practice for this project's postgis setup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POST /api/reports/{report_id}/dossier endpoint is functional and returns a valid PDF (minimal template)
- Plan 02 can immediately start implementing the full Jinja2 dossier template (wkb_kwaliteitsborger.html) with all sections, risk assessment table, disclaimer, and professional styling
- GeneratedDossier audit trail persists to DB so dossier history is ready for frontend display

---
*Phase: 69-risicobeoordeling-dossier*
*Completed: 2026-03-02*
