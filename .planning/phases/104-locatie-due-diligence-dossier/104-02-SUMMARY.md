---
phase: 104-locatie-due-diligence-dossier
plan: "02"
subsystem: backend-reports
tags: [reports, pdf, due-diligence, weasyprint, jinja2, score-v3]
dependency_graph:
  requires: [104-01-flags-first-enrichment]
  provides: [due-diligence-pdf-template, updated-pdf-export-endpoint]
  affects: [backend/app/reports/pdf_export.py]
tech_stack:
  added: []
  patterns: [weasyprint-a4-page, jinja2-template, running-footer, cover-page]
key_files:
  created:
    - backend/app/reports/due_diligence_export.py
    - backend/app/reports/templates/due_diligence.html
  modified:
    - backend/app/reports/pdf_export.py
decisions:
  - "generate_report_pdf delegates to generate_due_diligence_pdf — same signature, zero router/frontend changes"
  - "Cover page uses @page cover with full-bleed dark obsidian background and score circles"
  - "score_breakdown_v3 pre-processed into potentie_factors/risico_factors sorted by bijdrage before template render"
  - "All None values handled gracefully with 'Niet beschikbaar' fallback — backward compat with old reports"
metrics:
  duration: "4min"
  completed: "2026-03-12"
  tasks: 2
  files_modified: 3
---

# Phase 104 Plan 02: Due Diligence PDF Template Summary

Created a professional A4 "Locatie Due Diligence Dossier" PDF template with cover page, inhoudsopgave, and 7 numbered sections organized by vergunning-relevance, and wired it as the default PDF export replacing the old 7-section report.html template.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create due diligence HTML template + export function | e6970da | due_diligence_export.py, due_diligence.html |
| 2 | Replace existing PDF export with due diligence template | 1d25118 | pdf_export.py |

## What Was Built

**due_diligence_export.py** — New export module with:
- `generate_due_diligence_pdf(report_data, report_name) -> bytes` — synchronous, following dossier_export.py pattern
- `_format_dutch_datetime()` — formats datetime as "12 maart 2026, 14:30"
- `_split_score_factors()` — splits score_breakdown_v3 dict into potentie_factors / risico_factors sorted by bijdrage descending
- `_build_section_sources_dict()` — builds dict keyed by section name for template lookup

**due_diligence.html** — Full 580-line Jinja2 template:
- **Cover page** (`@page cover`, full-bleed dark obsidian `#0E1111`): title, address, two score circles (green/red), generation date, disclaimer
- **Inhoudsopgave**: numbered list of 7 sections
- **Sectie 1 Locatiegegevens**: address kv-table, BAG building data, coordinates
- **Sectie 2 Kadaster & Eigendom**: cadastral parcels table, BRK on-demand note
- **Sectie 3 Bestemmingsplan & Bouwmogelijkheden**: zoning, building dimensions, AI planregels if available
- **Sectie 4 Risicoprofiel**: 8 sub-sections (bodem, fundering, asbest, monument, geluid, luchtkwaliteit, natura2000, overstroming) each with colored dot status indicator
- **Sectie 5 Potentie & Risico Analyse**: score gauges, factors tables with toelichting_lang per factor
- **Sectie 6 Vergunningen & Precedenten**: bekendmakingen table, permit benchmark
- **Sectie 7 Bronvermelding**: full source attribution table with confidence badges, disclaimer
- Running page footer on all non-cover pages via WeasyPrint `position: running(footer)`

**pdf_export.py** (updated):
- `generate_report_pdf` now a one-liner delegating to `generate_due_diligence_pdf`
- Same function signature — existing `export_report_pdf` route in router.py unchanged

## Success Criteria Met

- [x] Professional A4 PDF with cover page, TOC, 7 numbered sections, footer (DD-04)
- [x] Sections organized by vergunning-relevance (DD-02)
- [x] Score analysis chapter with per-factor breakdown and toelichting_lang (DD-05)
- [x] Each section shows databron + datum + betrouwbaarheid (DD-03)
- [x] Old reports without enrichment render without errors
- [x] Existing `/{report_id}/export/pdf` endpoint signature unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/reports/due_diligence_export.py
- FOUND: backend/app/reports/templates/due_diligence.html
- FOUND: backend/app/reports/pdf_export.py (delegates to due_diligence_export confirmed)

Commits verified:
- FOUND: e6970da (feat(104-02): create due diligence HTML template + export function)
- FOUND: 1d25118 (feat(104-02): replace existing PDF export with due diligence template)
