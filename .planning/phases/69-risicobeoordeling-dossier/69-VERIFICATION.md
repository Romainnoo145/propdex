---
phase: 69-risicobeoordeling-dossier
verified: 2026-03-02T14:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Open a property report in the browser (http://localhost:9300/rapport/{report-id}), click 'Genereer Startdossier', open the downloaded PDF and confirm all 7 section headings are visible, the per-page INDICATIEF footer is present on every page, and the prominent amber disclaimer box appears at the top of the document."
    expected: "PDF file named risicobeoordeling-{postcode}.pdf downloads. Document contains: header 'Risicobeoordeling Startdossier', amber disclaimer box, sections 1-7 visible, footer 'INDICATIEF | Risicobeoordeling Startdossier | Propdex | ...' on every page."
    why_human: "WeasyPrint PDF rendering of CSS running elements (@bottom-center / position: running) and visual layout cannot be verified programmatically. The Jinja2 template and CSS are present and correct, but WeasyPrint must actually render the running footer correctly — this requires opening the PDF. User approved this checkpoint (2026-03-02) but noted visual quality was 'middelmaat' (mediocre), so human re-confirmation of baseline acceptability is recommended."
  - test: "Test with a property that has NO bodemloket data (bodem_data=None). Verify the Bodemkwaliteit section shows 'Geen gegevens beschikbaar' and does NOT imply clean soil."
    expected: "Section 3 Bodemkwaliteit reads: 'Geen gegevens beschikbaar — Bodemloket is niet bevraagd of heeft geen data voor deze locatie.' No phrase implying positive status (e.g. 'schone grond')."
    why_human: "Requires a real property lookup with no bodem data to confirm the three-state logic renders correctly in the actual downloaded PDF (as opposed to Jinja2 render confirmed programmatically)."
---

# Phase 69: Risicobeoordeling Dossier Verification Report

**Phase Goal:** Risicobeoordeling Startdossier — PDF generation for kwaliteitsborgers with 7 sections + per-page disclaimer + frontend CTA button
**Verified:** 2026-03-02T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/reports/{report_id}/dossier returns a PDF with application/pdf content type | VERIFIED | `router.py:1080` — `@router.post("/{report_id}/dossier")` returns `StreamingResponse(media_type="application/pdf")` |
| 2 | GeneratedDossier row is created in the database after PDF generation | VERIFIED | `router.py:1130` — `await service.save_generated_dossier(...)` called after PDF bytes are in memory; service.py:863 creates the row via `session.add/flush/commit` |
| 3 | GET /api/reports/{report_id}/dossiers returns list of previously generated dossiers | VERIFIED | `router.py:1162` — `@router.get("/{report_id}/dossiers", response_model=list[GeneratedDossierResponse])` wired to `service.list_generated_dossiers()` |
| 4 | Alembic migration creates generated_dossiers table with correct schema | VERIFIED | Migration `3d97e34821f2` is at head (`alembic current` confirmed); creates table with all required columns, FKs (saved_reports CASCADE, users SET NULL, organizations CASCADE), and composite indexes |
| 5 | Generated PDF contains all 7 required sections | VERIFIED | Template verified programmatically: sections 1 (Perceelgegevens), 2 (Gebouwgegevens), 3 (Bodemkwaliteit), 4 (Bestemmingsplan), 5 (Monumentstatus), 6 (Energielabel), 7 (Wkb Classificatie) all present at lines 190, 241, 274, 348, 414, 467, 518 of wkb_kwaliteitsborger.html |
| 6 | Every page of the PDF carries the mandatory disclaimer footer | VERIFIED (programmatic) / UNCERTAIN (visual) | CSS `position: running(footer)` + `@page { @bottom-center { content: element(footer); } }` is correctly implemented (lines 18-33 of template). Running footer text: "INDICATIEF \| Risicobeoordeling Startdossier \| Propdex \| {{ generated_at }} \| Niet geschikt als formeel Wkb-nalevingsdocument". WeasyPrint rendering requires human confirmation. |
| 7 | A property with bodem_data=None shows 'geen gegevens beschikbaar' | VERIFIED | Template three-state logic verified: `{% if report_data.bodem_data is none %}` → "Geen gegevens beschikbaar — Bodemloket is niet bevraagd of heeft geen data voor deze locatie." Jinja2 render test passed. |
| 8 | A property with bodem_data.dossiers=[] shows 'Geen geregistreerde verontreiniging gevonden' with disclaimer | VERIFIED | `{% elif report_data.bodem_data.dossiers \| length == 0 %}` → info-note + caution-note "geen bewijs van schone grond". Jinja2 render test passed. |
| 9 | Clicking 'Genereer Startdossier' downloads a PDF file | VERIFIED | `ReportHeader.tsx:238-255` — `handleGenerateDossier` calls `generateStartdossier()`, creates blob URL, programmatic anchor click, revokes URL. Button at line 296 wired to handler. |
| 10 | The CTA button shows a loading spinner during PDF generation | VERIFIED | `isDossierGenerating` state + `{isDossierGenerating ? <SpinnerIcon /> : <DocumentIcon />}` and `{isDossierGenerating ? 'Bezig...' : 'Genereer Startdossier'}` at lines 300-301. |

**Score:** 9/10 truths verified programmatically (truth 6 has CSS-in-PDF uncertainty requiring human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/generated_dossier.py` | GeneratedDossier SQLAlchemy model | VERIFIED | 52 lines; `class GeneratedDossier(Base, TenantMixin, TimestampMixin)`; Mapped[type] + mapped_column() syntax; correct FKs and indexes; Python import confirmed |
| `backend/alembic/versions/3d97e34821f2_add_generated_dossiers_table.py` | Migration creates generated_dossiers table | VERIFIED | Applied at head; correct down_revision=5a8a4c23d4e6; table + 3 indexes created; downgrade also correct |
| `backend/app/reports/dossier_export.py` | generate_dossier_pdf() sync function | VERIFIED | 55 lines; synchronous; FileSystemLoader pointing at templates/; renders wkb_kwaliteitsborger.html; returns HTML().write_pdf(); import confirmed |
| `backend/app/reports/templates/wkb_kwaliteitsborger.html` | Full dossier template (7 sections + per-page disclaimer) | VERIFIED | 596 lines (well above 100 line minimum); all 7 sections confirmed; running footer CSS correct; Jinja2 render tests pass for both full and minimal data |
| `frontend/src/lib/api.ts` | generateStartdossier() API function | VERIFIED | POST to `${REPORTS_BASE}/${reportId}/dossier`; returns `response.blob()`; error handling matches exportReportPDF pattern |
| `frontend/src/components/reports/ReportHeader.tsx` | Genereer Startdossier CTA button | VERIFIED | Amber-styled button with DocumentIcon/SpinnerIcon; disabled when !reportId or isDossierGenerating; handleGenerateDossier wired to onClick |
| `backend/app/models/__init__.py` | GeneratedDossier registered in model registry | VERIFIED | `from app.models.generated_dossier import GeneratedDossier  # noqa: F401` at line 9; "GeneratedDossier" in `__all__` at line 38 |
| `backend/app/schemas/report.py` | GeneratedDossierResponse Pydantic schema | VERIFIED | `class GeneratedDossierResponse(BaseModel)` with all required fields; `model_config = ConfigDict(from_attributes=True)` |
| `backend/app/reports/service.py` | save_generated_dossier() + list_generated_dossiers() | VERIFIED | Both async functions present; save uses `session.add/flush/commit` pattern (NOT async with db.begin()); list returns ordered by created_at desc |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/reports/router.py` | `backend/app/reports/dossier_export.py` | `asyncio.to_thread(generate_dossier_pdf, ...)` | WIRED | `router.py:1120` — `pdf_bytes = await asyncio.to_thread(generate_dossier_pdf, report.report_data, report.report_name, generated_by)` |
| `backend/app/reports/router.py` | `backend/app/reports/service.py` | `save_generated_dossier()` | WIRED | `router.py:1130` — `await service.save_generated_dossier(report_id=report.id, ...)` |
| `backend/app/models/__init__.py` | `backend/app/models/generated_dossier.py` | `import GeneratedDossier` | WIRED | Line 9: `from app.models.generated_dossier import GeneratedDossier  # noqa: F401` |
| `frontend/src/components/reports/ReportHeader.tsx` | `frontend/src/lib/api.ts` | `generateStartdossier()` call | WIRED | Line 10: `import { generateStartdossier } from '@/lib/api'`; line 242: `const blob = await generateStartdossier(reportId, accessToken)` |
| `frontend/src/lib/api.ts` | `backend/app/reports/router.py` | POST `/api/reports/{reportId}/dossier` | WIRED | `fetch(\`${REPORTS_BASE}/${reportId}/dossier\`, { method: 'POST', ... })` — matches `@router.post("/{report_id}/dossier")` |
| `frontend/src/routes/_authenticated/rapport.$id.tsx` | `frontend/src/components/reports/ReportDetailPage.tsx` | `reportId` prop | WIRED | Line 91: `reportId={id.startsWith('r') ? null : id}` passed to `<ReportDetailPage>` |
| `frontend/src/components/reports/ReportDetailPage.tsx` | `frontend/src/components/reports/ReportHeader.tsx` | `reportId` prop pass-through | WIRED | Line 106: `reportId = null` in destructuring; line 181: `reportId={reportId}` passed to `<ReportHeader>` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOSSIER-01 | 69-01, 69-02 | User can generate a "Risicobeoordeling Startdossier" PDF for any property | SATISFIED | POST endpoint returns StreamingResponse PDF; frontend button triggers download via generateStartdossier() blob flow; all commits verified (3a622f7, b75b514, be6670e, b773a0d) |
| DOSSIER-02 | 69-02 | Dossier includes: perceelgegevens, bouwjaar, bodemkwaliteit, bestemmingsplan, monumentstatus, energielabel, Wkb classificatie | SATISFIED | All 7 sections present in wkb_kwaliteitsborger.html (596 lines); Jinja2 render test confirmed all section headings |
| DOSSIER-03 | 69-02 | Dossier includes legal disclaimer (data is indicatief, assembled from public sources) | SATISFIED (programmatic) | Running footer with "INDICATIEF" + "Niet geschikt als formeel Wkb-nalevingsdocument" via CSS running elements; prominent amber disclaimer box in body; three-state bodem logic prevents false positive status; WeasyPrint rendering of per-page footer requires human confirmation |

All 3 DOSSIER requirements mapped to Phase 69 are accounted for in plan frontmatter. No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/lib/api.ts` | 784 | Comment uses word "placeholder" (in JSDoc `{z}/{x}/{y} placeholders`) | Info | Not a code stub — tile URL template placeholders is correct usage; no impact |

No blockers or warnings found in phase 69 modified files.

### Human Verification Required

#### 1. PDF Visual Rendering — All 7 Sections and Per-Page Footer

**Test:** Open a property report at `http://localhost:9300/rapport/{any-valid-report-id}`. Click "Genereer Startdossier" in the report header. Open the downloaded PDF.

**Expected:**
- PDF filename: `risicobeoordeling-{postcode}.pdf`
- Document title: "Risicobeoordeling Startdossier"
- Amber disclaimer box visible near top of first page (yellow background, orange left border)
- All 7 sections visible: 1. Perceelgegevens, 2. Gebouwgegevens, 3. Bodemkwaliteit, 4. Bestemmingsplan, 5. Monumentstatus, 6. Energielabel, 7. Wkb Classificatie
- Footer on EVERY page reads: "INDICATIEF | Risicobeoordeling Startdossier | Propdex | {date} | Niet geschikt als formeel Wkb-nalevingsdocument"

**Why human:** WeasyPrint's CSS running elements (`position: running(footer)` + `@page @bottom-center { content: element(footer); }`) must be confirmed in the rendered PDF. The CSS is correctly authored, but visual rendering is outside programmatic verification scope. User approved checkpoint 2026-03-02 but noted mediocre visual quality — baseline confirmation needed.

#### 2. Absent Bodem Data Edge Case

**Test:** Find or create a property report where bodemloket data is absent (bodem_data is null). Generate the startdossier and open section 3 (Bodemkwaliteit) of the PDF.

**Expected:** Section 3 reads "Geen gegevens beschikbaar — Bodemloket is niet bevraagd of heeft geen data voor deze locatie." The text must NOT imply clean soil or a positive assessment.

**Why human:** Requires a real property with missing bodem data to confirm the three-state logic (null / empty list / populated list) in the actual rendered PDF, not just the Jinja2 render.

### Gaps Summary

No gaps found. All automated checks passed:
- `ruff check` passes on all modified backend files
- TypeScript compilation passes (`npx tsc --noEmit` exits clean)
- Alembic migration `3d97e34821f2` applied at head
- All Python imports verified: `GeneratedDossier`, `generate_dossier_pdf`, `GeneratedDossierResponse`
- Jinja2 template renders correctly for both full data and edge cases (bodem_data=None, dossiers=[])
- All 4 commits from SUMMARY exist in git history (3a622f7, b75b514, be6670e, b773a0d)
- All key links verified as wired (no orphaned artifacts)
- Requirements DOSSIER-01, DOSSIER-02, DOSSIER-03 all satisfied with implementation evidence

The two human verification items relate to visual PDF rendering quality, which is outside programmatic verification scope. The user checkpoint (Task 3) was approved on 2026-03-02 with a note about visual quality. The automated infrastructure is fully wired and correct.

---

_Verified: 2026-03-02T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
