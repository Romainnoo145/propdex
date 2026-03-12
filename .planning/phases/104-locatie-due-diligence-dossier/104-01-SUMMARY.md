---
phase: 104-locatie-due-diligence-dossier
plan: "01"
subsystem: backend-reports
tags: [reports, flags, enrichment, schema, due-diligence]
dependency_graph:
  requires: [phase-99-scan-pipeline-enrichment, phase-100-score-v3]
  provides: [flags-first-report-enrichment, extended-property-report-schema]
  affects: [backend/app/reports/router.py, backend/app/schemas/property.py]
tech_stack:
  added: []
  patterns: [flags-first-lookup, section-source-metadata, aggregator-overlay]
key_files:
  created:
    - backend/app/reports/flags_assembler.py
  modified:
    - backend/app/schemas/property.py
    - backend/app/reports/router.py
decisions:
  - "Flags overlay applied on top of aggregator output — aggregator still runs for address/building/cadastral/zoning data (internal caching makes it fast)"
  - "assemble_enrichment_from_flags only updates non-None values to avoid overwriting valid aggregator data"
  - "PropertyReportResponse.model_validate() used to re-validate merged dict after flags overlay"
  - "from-address endpoint untouched — only from-parcel rewired (DD-06 compliance)"
metrics:
  duration: "3min"
  completed: "2026-03-12"
  tasks: 2
  files_modified: 3
---

# Phase 104 Plan 01: Flags-First Report Enrichment Summary

Extended PropertyReportResponse with 13 new optional Phase 99 enrichment fields and v3.0 score fields, and rewired the from-parcel endpoint to overlay pre-cached scan data from scan_results.flags instead of making 10+ live API calls per report generation.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend PropertyReportResponse + create flags assembler | 3b19921 | property.py, flags_assembler.py |
| 2 | Rewire from-parcel endpoint to flags-first lookup | 8a4753a | router.py |

## What Was Built

**flags_assembler.py** — New module with:
- `assemble_enrichment_from_flags(flags)` — extracts all 10 enrichment keys + 3 score keys from scan_results.flags into PropertyReportResponse field dict
- `build_flags_section_sources(flags, scan_created_at)` — builds SectionSourceInfo list with databron naam, datum opgehaald, betrouwbaarheid for each present flag key
- `FLAGS_SOURCE_MAP` — 11 source entries mapping flag keys to display names, API source names, and confidence levels (HIGH/MEDIUM)

**PropertyReportResponse additions** (backend/app/schemas/property.py):
- 10 enrichment fields: `vergunningen_data`, `energielabel_flags`, `woz_flags`, `bodem_flags`, `bodemtype_flags`, `funderingsrisico_flags`, `natura2000_flags`, `overstromingsrisico_flags`, `geluid_flags`, `luchtkwaliteit_flags`
- 3 score fields: `scores_v3`, `score_breakdown_v3`, `score_model_version`
- All fields have `default=None` — no breaking changes to old reports

**router.py rewiring** (step 4b in generate_report_from_parcel):
- After aggregate_property_data(), queries best completed scan flags for the parcel
- If flags found: overlays enrichment via assemble_enrichment_from_flags(), extends section_sources with build_flags_section_sources()
- If no flags: logs info and falls through with aggregator-only output
- from-address endpoint remains unchanged

## Success Criteria Met

- [x] from-parcel endpoint reads from scan_results.flags when available (DD-01)
- [x] PropertyReportResponse extended with 13 new optional fields (DD-07)
- [x] Section source metadata includes databron, datum, betrouwbaarheid (DD-03)
- [x] Existing reports validate without errors — all fields default=None (DD-06)
- [x] Fallback to aggregate_property_data when no flags exist

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/reports/flags_assembler.py
- FOUND: backend/app/schemas/property.py (13 new fields confirmed)
- FOUND: backend/app/reports/router.py (step 4b flags logic confirmed)

Commits verified:
- FOUND: 3b19921 (feat(104-01): extend PropertyReportResponse + create flags assembler)
- FOUND: 8a4753a (feat(104-01): rewire from-parcel endpoint to flags-first lookup)
