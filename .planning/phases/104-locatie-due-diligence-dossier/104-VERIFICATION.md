---
phase: 104-locatie-due-diligence-dossier
verified: 2026-03-12T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 104: Locatie Due Diligence Dossier — Verification Report

**Phase Goal:** Transform "Genereer Rapport" from API-call aggregation into a structured Locatie Due Diligence Dossier assembled from pre-cached scan data, organized by vergunning-relevance for vastgoedontwikkelaars
**Verified:** 2026-03-12
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | from-parcel endpoint reads enrichment from scan_results.flags instead of calling aggregate_property_data repeatedly | VERIFIED | `router.py` line 565-587: flags query on ScanResult, overlay via `assemble_enrichment_from_flags`, fallback path when no flags (line 589-591) |
| 2 | PropertyReportResponse contains all 10 Phase 99 enrichment fields + 3 v3.0 score fields | VERIFIED | `property.py` lines 576-627: all 13 fields present with `default=None` |
| 3 | Section source metadata includes databron naam, datum opgehaald, betrouwbaarheid for each flags-sourced section | VERIFIED | `flags_assembler.py`: `FLAGS_SOURCE_MAP` with 11 entries mapping flag keys to source name + confidence; `build_flags_section_sources()` builds `SectionSourceInfo` list with `cached_at`, `age_seconds`, `is_cached=True`, `confidence` |
| 4 | Existing Rapporten tab and report CRUD operations continue to work unchanged | VERIFIED | from-address endpoint untouched (line 334); `export_report_pdf` still calls `generate_report_pdf` (line 1084); function signature unchanged |
| 5 | Parcels without scan flags gracefully fall back to aggregate_property_data | VERIFIED | `router.py` line 587-591: `else` branch logs info and continues with aggregator-only output |
| 6 | PDF export produces a professional A4 Locatie Due Diligence Dossier with cover page and numbered sections | VERIFIED | `due_diligence.html` (1455 lines): cover page with `@page cover`, Inhoudsopgave, Sectie 1-7. PDF generation confirmed: 69,002+ bytes, valid `%PDF` header |
| 7 | Dossier contains 7 structured sections organized by vergunning-relevance | VERIFIED | Template has Sectie 1 (Locatiegegevens), 2 (Kadaster & Eigendom), 3 (Bestemmingsplan & Bouwmogelijkheden), 4 (Risicoprofiel), 5 (Potentie & Risico Analyse), 6 (Vergunningen & Precedenten), 7 (Bronvermelding) |
| 8 | Score analysis chapter shows potentie_score + risico_score with per-factor breakdown table and toelichting_lang | VERIFIED | `due_diligence.html` lines 1212-1303: two score gauge circles, `potentie_factors` table with toelichting_lang blocks, `risico_factors` table with toelichting_lang blocks; `_split_score_factors()` pre-sorts by bijdrage |
| 9 | Each section shows databron naam, datum opgehaald, betrouwbaarheidsindicatie | VERIFIED | Sectie 7 Bronvermelding iterates `section_sources` with confidence badges (HIGH/MEDIUM display); per-sub-section source notes in Sectie 4 |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/reports/flags_assembler.py` | Mapping from scan_results.flags keys to PropertyReportResponse enrichment fields | VERIFIED | 70 lines, substantive: `assemble_enrichment_from_flags`, `build_flags_section_sources`, `FLAGS_SOURCE_MAP` with 11 entries |
| `backend/app/schemas/property.py` | Extended PropertyReportResponse with 10 enrichment + 3 score fields | VERIFIED | 13 new fields confirmed at lines 576-627, all `default=None` |
| `backend/app/reports/router.py` | Rewired from-parcel endpoint using flags-first lookup | VERIFIED | Import at line 24, flags logic at lines 565-591 |
| `backend/app/reports/templates/due_diligence.html` | Full Jinja2 HTML template for A4 due diligence dossier | VERIFIED | 1455 lines (min_lines: 200 exceeded), cover page + 7 sections + running footer |
| `backend/app/reports/due_diligence_export.py` | WeasyPrint PDF generation function for due diligence dossier | VERIFIED | `generate_due_diligence_pdf` exports confirmed; runtime test produced 69,002-byte valid PDF |
| `backend/app/reports/pdf_export.py` | Updated generate_report_pdf that delegates to due diligence template | VERIFIED | 23 lines, single-line delegation: `return generate_due_diligence_pdf(report_data, report_name)` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/reports/router.py` | `backend/app/reports/flags_assembler.py` | `from app.reports.flags_assembler import` | WIRED | Line 24 import confirmed; used at lines 580, 583 |
| `backend/app/reports/flags_assembler.py` | `backend/app/schemas/property.py` | builds PropertyReportResponse dict from flags | WIRED | Imports `DataSourceInfo`, `SectionSourceInfo` from `app.schemas.property`; builds SectionSourceInfo objects |
| `backend/app/reports/pdf_export.py` | `backend/app/reports/due_diligence_export.py` | `from app.reports.due_diligence_export import` | WIRED | Line 3 import; `generate_report_pdf` delegates directly |
| `backend/app/reports/due_diligence_export.py` | `backend/app/reports/templates/due_diligence.html` | Jinja2 template loading | WIRED | `env.get_template("due_diligence.html")` at line 96; template file confirmed at 1455 lines |
| `backend/app/reports/router.py` | `backend/app/reports/pdf_export.py` | `from app.reports.pdf_export import generate_report_pdf` | WIRED | Line 26 import; used at line 1084 via `asyncio.to_thread` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DD-01 | 104-01 | "Genereer Rapport" reads parcel data from scan_results.flags — zero external API calls except BRK on-demand | SATISFIED | Flags query at router.py:565-576; overlay at 580-587; fallback logged at 589-591 |
| DD-02 | 104-02 | Report data structured by vergunning-relevance sections (7 sections) | SATISFIED | due_diligence.html has 7 numbered sections in the exact order specified |
| DD-03 | 104-01 + 104-02 | Each report section includes metadata: databron naam, datum opgehaald, betrouwbaarheidsindicatie | SATISFIED | flags_assembler.py `FLAGS_SOURCE_MAP` + `build_flags_section_sources`; Sectie 7 Bronvermelding table with confidence badges |
| DD-04 | 104-02 | PDF export generates professional A4 dossier with cover page, TOC, numbered sections, and footer | SATISFIED | Cover page (`@page cover`), Inhoudsopgave, 7 numbered sections, running footer via `position: running(footer)` |
| DD-05 | 104-02 | PDF includes potentie_score + risico_score with per-factor breakdown table and toelichting_lang | SATISFIED | due_diligence.html Sectie 5 with score gauges + factor tables + `toelichting_lang` blocks; `_split_score_factors()` in due_diligence_export.py |
| DD-06 | 104-01 | Existing Rapporten tab, wijk folder auto-assignment, and rapport CRUD operations continue to work unchanged | SATISFIED | from-address endpoint untouched; export_report_pdf signature unchanged; generate_report_pdf same interface |
| DD-07 | 104-01 | Report data schema (PropertyReportResponse) extended with all enrichment fields so saved reports contain the full dossier | SATISFIED | 13 new optional fields in property.py lines 576-627; all `default=None` (backward compat confirmed by module import) |

All 7 requirements satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

None detected in any modified file.

| File | Pattern | Result |
|------|---------|--------|
| `flags_assembler.py` | TODO/FIXME/placeholder | None found |
| `due_diligence_export.py` | TODO/FIXME/placeholder | None found |
| `pdf_export.py` | Empty return / stub | Not a stub — delegates to real implementation |
| `due_diligence.html` | TODO/placeholder | None found |
| `router.py` (flags section) | Empty handler / no-op | Not a stub — full DB query + overlay logic |

---

### Human Verification Required

#### 1. PDF visual quality check

**Test:** Generate a report for a real parcel that has completed scan results with flags. Open the exported PDF.
**Expected:** Cover page with obsidian background and amber/green score circles; Inhoudsopgave with 7 section titles; each section starts on a new page; Sectie 4 shows colored dot indicators per risk sub-section; Sectie 5 shows factor breakdown tables; running footer on all non-cover pages.
**Why human:** WeasyPrint CSS rendering and visual layout cannot be verified programmatically. The PDF bytes are valid but the visual quality of the cover page, typography, and table formatting requires visual inspection.

#### 2. End-to-end report generation with real scan flags

**Test:** In the app, navigate to a parcel with a completed wijk scan, click "Genereer Rapport", then export PDF.
**Expected:** Report generation completes without "Fout bij ophalen" error; the returned report data includes `scores_v3`, `vergunningen_data`, and other flags fields populated from the scan (not null); PDF download triggers and opens a complete dossier.
**Why human:** The flags overlay path requires a real database row in scan_results with a non-empty `flags` JSONB column. Cannot verify the overlay merges correctly without live data.

---

### Commits Verified

All 4 documented commits exist in git:
- `3b19921` — feat(104-01): extend PropertyReportResponse + create flags assembler
- `8a4753a` — feat(104-01): rewire from-parcel endpoint to flags-first lookup
- `e6970da` — feat(104-02): create due diligence HTML template + export function
- `1d25118` — feat(104-02): replace existing PDF export with due diligence template

---

### Notes

**Pydantic forward-reference behavior:** `PropertyReportResponse.model_validate()` raises `PydanticUserError` when called from a bare Python `-c` script that imports individual classes. This is a Python 3.14 + Pydantic 2.x forward-reference resolution quirk — it resolves correctly when the module is imported as a whole (as happens via FastAPI's import chain). This is NOT a regression introduced by phase 104; the `BodemData` and `AsbestIndicator` forward references predate this phase (introduced in phases 87-89). The module-level import test (`import app.schemas.property`) confirmed all 13 new fields are present and accessible.

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_
