---
phase: 05-report-management
plan: 03
subsystem: api
tags: [weasyprint, jinja2, pdf, export, freshness-detection, asyncio]

# Dependency graph
requires:
  - phase: 05-01
    provides: SavedReport model with JSONB report_data storage
  - phase: 05-02
    provides: Report service layer with get_report() and tenant validation
  - phase: 02-01
    provides: CachedAPIResponse model with fetched_at timestamps

provides:
  - WeasyPrint PDF generation service with professional A4 template
  - Data freshness detection comparing saved snapshots with cache timestamps
  - PDF export endpoint (/api/reports/{id}/export/pdf) with asyncio.to_thread
  - Freshness check endpoint (/api/reports/{id}/freshness) with 24h threshold

affects: [frontend-dashboard, report-sharing, email-delivery]

# Tech tracking
tech-stack:
  added: [weasyprint>=68.0, jinja2>=3.1.0]
  patterns: [asyncio.to_thread for CPU-bound PDF generation, 24h freshness threshold, section-to-cache-key mapping]

key-files:
  created:
    - backend/app/reports/pdf_export.py
    - backend/app/reports/templates/report.html
    - backend/app/reports/freshness.py
  modified:
    - backend/app/reports/router.py
    - backend/pyproject.toml

key-decisions:
  - "24-hour threshold for freshness detection (sections with cache data >24h newer flagged)"
  - "asyncio.to_thread for PDF generation (WeasyPrint is sync/CPU-bound, must not block event loop)"
  - "Section-to-cache-key mapping (address/building→bag, cadastral→pdok_cadastral, zoning→dso, monuments→rce, ai_parsing→ai_parsed)"
  - "Professional A4 template with 7 sections (address, building, cadastral, zoning, monument, AI analysis, sources)"

patterns-established:
  - "asyncio.to_thread pattern: Synchronous CPU-bound function wrapped in executor call from async endpoint"
  - "PDF template graceful degradation: Each section checks for data availability with {% if %}"
  - "Freshness detection via timestamp comparison: saved_cached_at vs latest cache.fetched_at"

# Metrics
duration: 3min 41s
completed: 2026-02-07
---

# Phase 5 Plan 3: Report Export Summary

**WeasyPrint PDF generation with professional 7-section A4 template and 24-hour freshness detection comparing saved snapshots with latest cache timestamps**

## Performance

- **Duration:** 3 minutes 41 seconds
- **Started:** 2026-02-07T10:53:09Z
- **Completed:** 2026-02-07T10:56:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Professional PDF export with branded header, all report sections, confidence indicators, and source citations
- Data freshness detection identifies sections with cache data >24 hours newer than saved snapshot
- PDF generation runs in executor via asyncio.to_thread (non-blocking for CPU-bound WeasyPrint)
- Complete report management API with 16 endpoints (14 from Plans 1-2 + 2 new export endpoints)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WeasyPrint dependency, create PDF template and generation service** - `98d8abd` (feat)
2. **Task 2: Create freshness detection service and add export/freshness endpoints** - `4bb57ba` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `backend/pyproject.toml` - Added weasyprint>=68.0 and jinja2>=3.1.0 dependencies
- `backend/app/reports/pdf_export.py` - Synchronous PDF generation service using WeasyPrint and Jinja2
- `backend/app/reports/templates/report.html` - Professional A4 template with 7 sections, CSS styling, confidence indicators
- `backend/app/reports/freshness.py` - Data freshness detection comparing saved timestamps with latest cache entries
- `backend/app/reports/router.py` - Added PDF export endpoint (10/min rate limit) and freshness check endpoint (30/min rate limit)

## Decisions Made

**1. 24-hour threshold for freshness detection**
- Rationale: Research recommendation from 05-RESEARCH identified 24h as meaningful threshold for "update available" indicator; shorter periods would flag routine cache refreshes, longer would miss significant data changes

**2. asyncio.to_thread for PDF generation**
- Rationale: WeasyPrint is synchronous and CPU-bound (HTML rendering, font layout, PDF encoding); running in executor prevents blocking FastAPI event loop (research pitfall #3)

**3. Section-to-cache-key mapping for freshness**
- Rationale: SavedReport stores PropertyReportResponse with section_sources list; each section maps to specific cache key patterns (address/building→bag, cadastral→pdok_cadastral, etc.) for targeted timestamp comparison

**4. Professional template with graceful degradation**
- Rationale: Real estate due diligence documents need professional presentation (branded header, structured sections, confidence indicators); template handles partial data with {% if %} checks to avoid errors when sections missing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** See [05-USER-SETUP.md](./05-USER-SETUP.md) for:
- WeasyPrint system dependencies installation
- Verification commands

## Next Phase Readiness

**Phase 5 complete (all 3 plans executed):**
- Report storage foundation (Plan 1): SavedReport/Project models, JSONB storage, soft-delete
- Report CRUD API (Plan 2): 14 endpoints (save, list, get, delete, restore, notes, project, refresh, cities)
- Report export (Plan 3): PDF generation and freshness detection

**Complete report management system ready for:**
- Frontend integration (dashboard, report list, PDF download buttons)
- Email delivery (attach PDF to client emails)
- Report sharing workflows (download, print, send to notaris/bank)

**No blockers for frontend development.** All backend requirements for Milestone 1 Report Management complete.

---
*Phase: 05-report-management*
*Completed: 2026-02-07*

## Self-Check: PASSED
