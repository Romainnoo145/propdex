# Phase 104: Locatie Due Diligence Dossier — Research

**Researched:** 2026-03-12
**Domain:** PDF report generation, scan_results.flags data extraction, PropertyReportResponse schema extension
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DD-01 | "Genereer Rapport" reads from scan_results.flags (pre-cached) — zero external API calls except BRK on-demand | flags structure fully mapped; existing `from-parcel` endpoint pattern identified |
| DD-02 | Report data structured by vergunning-relevance sections: Locatiegegevens, Kadaster & Eigendom, Bestemmingsplan & Bouwmogelijkheden, Risicoprofiel, Potentie & Risico Scores met narratieven, Vergunningen & Precedenten, Bronvermelding | All data sources mapped to PropertyReportResponse fields + scan_results.flags keys |
| DD-03 | Each section includes metadata: databron naam, datum opgehaald, betrouwbaarheid | Existing `SectionSourceInfo` + `DataSourceInfo` schemas already model this; flags store raw data without explicit timestamps — need `flags_fetched_at` approach |
| DD-04 | PDF export generates professional A4 "Locatie Due Diligence Dossier" with cover page, TOC, numbered sections, footer | WeasyPrint >=68.0 + Jinja2 already in stack; `wkb_kwaliteitsborger.html` pattern shows CSS `@page` running footer |
| DD-05 | PDF includes potentie_score + risico_score with per-factor breakdown and toelichting_lang narratieven | `score_breakdown` stored in `scan_results.flags.score_breakdown` as dict; FactorResult has all needed fields |
| DD-06 | Existing Rapporten tab, wijk folder auto-assignment, and rapport CRUD continue to work | Service layer is clean; no changes needed to `save_report` / `list_reports` / wijk logic |
| DD-07 | PropertyReportResponse extended with all enrichment fields so saved reports contain the full dossier | Schema analysis reveals 10 enrichment flag keys NOT yet on PropertyReportResponse; must add |
</phase_requirements>

---

## Summary

Phase 104 transforms the "Genereer Rapport" flow from a slow live-API aggregation into a fast flags-first assembly. Since Phase 99, all enrichment data (10 sources) is pre-cached in `scan_results.flags` JSONB per parcel. Since Phase 100/101, `flags.score_breakdown` contains the complete v3.0 score with per-factor `toelichting_lang` narratieven. The backend already has everything needed — the work is (1) rewiring `from-parcel` to read from flags instead of calling `aggregate_property_data`, (2) extending `PropertyReportResponse` with the 10 missing enrichment fields, and (3) replacing the 7-section `report.html` template with a full due diligence dossier PDF template.

The approach is NOT to build a parallel data pipeline. The correct pattern is to load `scan_results.flags` for the parcel, map flag keys to `PropertyReportResponse` fields, and then the same `save_report` + `export_report_pdf` machinery continues to work unchanged. The PDF template is the primary creative work of this phase.

**Primary recommendation:** Keep `PropertyReportResponse` as the single source of truth for report data. Add 10 new optional fields (energielabel, woz_data, vergunningen, bodem/bodemtype, funderingsrisico, natura2000, overstromingsrisico, geluid, luchtkwaliteit, scores_v3). Rewrite `from-parcel` to assemble this from flags. Rewrite `report.html` with the full dossier structure.

---

## Standard Stack

### Core (already in project — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WeasyPrint | >=68.0 | HTML→PDF rendering | Already in `pyproject.toml`, used for both `report.html` and `wkb_kwaliteitsborger.html` |
| Jinja2 | (fastapi dep) | HTML template rendering | Already used in `pdf_export.py` + `dossier_export.py` |
| FastAPI/SQLAlchemy | existing | Backend API + DB | No changes to stack |
| asyncio.to_thread | stdlib | Run CPU-bound WeasyPrint off event loop | Established pattern in existing PDF endpoints |

### Pattern Reference: dossier_export.py

The `generate_dossier_pdf` function in `dossier_export.py` is the closest sibling:
- Loads Jinja2 template from `reports/templates/`
- Receives `report_data: dict`, `report_name: str`, `generated_by: str`
- Returns `bytes` synchronously
- Called via `asyncio.to_thread()` in the router

The new due diligence export function follows the SAME pattern.

---

## Architecture Patterns

### Recommended File Structure

```
backend/app/reports/
├── pdf_export.py              # existing — keep as-is (legacy export)
├── dossier_export.py          # existing — keep as-is (Wkb kwaliteitsborger)
├── due_diligence_export.py    # NEW — Locatie Due Diligence PDF
├── flags_assembler.py         # NEW — map scan_results.flags → enrichment dicts
└── templates/
    ├── report.html            # existing (leave intact for backwards compat)
    ├── wkb_kwaliteitsborger.html  # existing
    └── due_diligence.html     # NEW — full dossier template
```

```
backend/app/schemas/
└── property.py                # extend PropertyReportResponse with 10 new fields
```

### Pattern 1: Flags Assembler

**What:** Extract the 10 Phase 99 enrichment keys + Phase 100 score data from `scan_results.flags` and build a dict that can populate the new `PropertyReportResponse` fields.

**When to use:** In `from-parcel` endpoint, called once per parcel instead of `aggregate_property_data`.

```python
# Source: existing pattern in scans/router.py lines 1044-1060
def assemble_enrichment_from_flags(flags: dict) -> dict:
    """Extract pre-cached enrichment from scan_results.flags."""
    return {
        "vergunningen": flags.get("vergunningen"),
        "energielabel": flags.get("energielabel"),
        "woz": flags.get("woz"),
        "bodem": flags.get("bodem"),
        "bodemtype": flags.get("bodemtype"),
        "funderingsrisico": flags.get("funderingsrisico"),
        "natura2000": flags.get("natura2000"),
        "overstromingsrisico": flags.get("overstromingsrisico"),
        "geluid": flags.get("geluid"),
        "luchtkwaliteit": flags.get("luchtkwaliteit"),
        "scores": flags.get("scores"),          # {potentie, risico}
        "score_breakdown": flags.get("score_breakdown"),
        "score_model_version": flags.get("score_model_version"),
    }
```

### Pattern 2: from-parcel Rewire

**What:** The `/api/reports/from-parcel` endpoint currently calls `aggregate_property_data()` which makes 10+ live API calls. It must be rewired to:
1. Load `ParcelCache` (for address, geometry, gemeente_code, etc.)
2. Load `ScanResult.flags` for this parcel (best scan = most recent completed scan)
3. Call `assemble_enrichment_from_flags(flags)`
4. Build `PropertyReportResponse` from parcel + flags (no live API calls)
5. Call `save_report` as before

The existing parcel address resolution logic (including centroid reverse-geocode fallback) MUST be preserved.

**Critical:** The idempotency guard (`get_report_by_source_parcel`) must remain — it returns the existing report if already generated for this parcel.

**ScanResult lookup for best flags:**
```python
# Source: pattern from scans/router.py and tile_proxy.py
flags_row = await session.execute(
    select(ScanResult.flags)
    .join(AreaScan, ScanResult.scan_id == AreaScan.id)
    .where(
        ScanResult.parcel_id == parcel_id,
        ScanResult.organization_id == organization_id,
        AreaScan.status == "completed",
    )
    .order_by(ScanResult.created_at.desc())
    .limit(1)
)
scan_flags = flags_row.scalar_one_or_none() or {}
```

### Pattern 3: PropertyReportResponse Extension

**What:** Add 10 new optional fields to `PropertyReportResponse`. These are the Phase 99 enrichment data sources that currently only live in `scan_results.flags`.

New fields to add (all `Optional`, default `None`):
```python
# Phase 99 enrichment (10 data sources)
vergunningen_data: list[dict] | None = None         # SRU bekendmakingen records
energielabel_flags: EnergyLabel | None = None       # (or dict) EP-Online result
woz_flags: WOZData | None = None                    # Waardeloket result
bodem_flags: str | None = None                      # bodemkwaliteitsklasse
bodemtype_flags: str | None = None                  # klei/veen/zand/leem
funderingsrisico_flags: dict | None = None          # PDOK WFS result
natura2000_flags: dict | None = None                # WFS distance + zone
overstromingsrisico_flags: dict | None = None       # WMS signal
geluid_flags: dict | None = None                    # Lden dB category
luchtkwaliteit_flags: dict | None = None            # NO2/PM10 indicators
# Phase 100 scores
scores_v3: dict | None = None                       # {potentie, risico, overall}
score_breakdown_v3: dict | None = None              # per-factor FactorResult dicts
score_model_version: str | None = None              # "score-v3.0"
```

NOTE: Some of these overlap with existing fields (`energy_label`, `woz_data`, `funderingsrisicogebied`). Strategy: check if existing field is already populated from the aggregator path; if NOT, populate from flags. To avoid schema confusion, use `_flags` suffix for the raw flag versions, and have the assembler also attempt to populate the existing typed fields.

### Pattern 4: PDF Template Structure

**What:** New `due_diligence.html` Jinja2 template following WeasyPrint `@page` CSS pattern.

**Template sections (in order):**
1. Cover page — address, score gauges (potentie/risico), generation date, Propdex branding
2. Inhoudsopgave (table of contents) — auto-generated via CSS counter or static links
3. Sectie 1: Locatiegegevens — address, BAG building data, coordinates
4. Sectie 2: Kadaster & Eigendom — cadastral parcels table, BRK stub (if available)
5. Sectie 3: Bestemmingsplan & Bouwmogelijkheden — zoning data, buildability delta, AI rules
6. Sectie 4: Risicoprofiel — bodem, fundering, asbest, monument, geluid, luchtkwaliteit, natura2000, overstroming
7. Sectie 5: Potentie & Risico Analyse — score gauges, per-factor breakdown table with toelichting_lang
8. Sectie 6: Vergunningen & Precedenten — recent bekendmakingen, permit benchmark
9. Sectie 7: Bronvermelding — all data sources with datum opgehaald + betrouwbaarheid

**WeasyPrint CSS patterns (HIGH confidence — verified in wkb_kwaliteitsborger.html):**
```css
@page {
    size: A4;
    margin: 2cm 2cm 3cm 2cm;
    @bottom-center { content: element(footer); }
}
.page-footer { position: running(footer); }

/* Page break before each section */
.section-start { page-break-before: always; }

/* Cover page gets its own @page */
@page cover { margin: 0; }
.cover { page: cover; }
```

**TOC approach:** WeasyPrint supports CSS-generated content but NOT automatic TOC from headings. Use a static Jinja2-rendered list with page markers, or skip page numbers and use section headings only. **Recommendation:** Skip page numbers in TOC — use section list with anchor links that WeasyPrint renders as text references.

### Pattern 5: Section Source Metadata

**What:** Each report section must show `databron naam`, `datum opgehaald`, `betrouwbaarheidsindicatie` (DD-03).

The existing `SectionSourceInfo` + `DataSourceInfo` models already do this for aggregator-sourced data. For flags-sourced data, the timestamps come from when the scan ran (scan `created_at`), not from separate API call timestamps.

```python
# Build section source from scan timestamp
def make_flags_source_info(
    section: str,
    source_name: str,
    scan_created_at: datetime,
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "HIGH",
) -> SectionSourceInfo:
    age_seconds = int((datetime.utcnow() - scan_created_at).total_seconds())
    return SectionSourceInfo(
        section=section,
        sources=[DataSourceInfo(
            source=source_name,
            cached_at=scan_created_at.isoformat(),
            age_seconds=age_seconds,
            is_cached=True,
            confidence=confidence,
        )],
        cached_at=scan_created_at.isoformat(),
        age_seconds=age_seconds,
    )
```

### Anti-Patterns to Avoid

- **Don't call aggregate_property_data in the new flags-first path.** It makes 10+ live API calls and defeats the purpose of DD-01.
- **Don't remove the from-address endpoint.** It still exists for monitoring items without parcel scan data. Keep it calling `aggregate_property_data`.
- **Don't modify the existing `save_report` service.** It already validates via `PropertyReportResponse.model_validate()`. Just add new optional fields to the schema.
- **Don't strip enrichment fields before persisting.** Unlike BRK (which is never-store), Phase 99 enrichment data is fine to persist in `saved_reports.report_data` JSONB. The service already does `report_data_json.pop("brk_ownership", None)` — keep only that strip.
- **Don't use WeasyPrint's `base_url` for external images.** System fonts are unreliable in Docker. Use `system-ui` CSS stack only (already established in existing templates).
- **Don't add new DB columns.** All enrichment data goes into the JSONB `report_data` field via extended `PropertyReportResponse`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML→PDF rendering | Custom renderer | WeasyPrint (already in project) | Handles A4 pagination, running headers/footers, CSS columns |
| Template rendering | String concatenation | Jinja2 (already in project) | Safe HTML escaping, loops, conditionals |
| Async PDF generation | Blocking endpoint | `asyncio.to_thread(generate_X_pdf, ...)` | Already established pattern in both PDF endpoints |
| Per-section timestamps | Custom timing code | `SectionSourceInfo` + `DataSourceInfo` | Already typed, already used in aggregator path |
| Score narratieven | Re-generate text | Read from `flags.score_breakdown[factor].toelichting_lang` | Already computed and stored by Phase 100 |

---

## Common Pitfalls

### Pitfall 1: from-parcel Idempotency on Existing Reports
**What goes wrong:** When a report already exists for a parcel (idempotency guard), the current code returns the stored report without re-fetching flags. If the scan ran AFTER the report was saved (e.g., user generated report before enrichment backfill), the stored report may be missing enrichment data.
**Why it happens:** The idempotency guard returns early before flags are read.
**How to avoid:** Add a `report_needs_enrichment_upgrade(report_data)` check similar to `_report_needs_v7_backfill`. If enrichment fields are missing AND scan_flags have them, update the stored report data.
**Warning signs:** Existing report has `score_breakdown_v3=None` but parcel has flags with score data.

### Pitfall 2: PropertyReportResponse Validation on Existing Reports
**What goes wrong:** Adding new required fields to `PropertyReportResponse` will break `save_report` validation for OLD stored reports (when they're re-validated via `model_validate`).
**Why it happens:** `service.py` calls `PropertyReportResponse.model_validate(report_data)` on read AND write.
**How to avoid:** All new fields MUST have `default=None`. Never use `Field(...)` without a default for new fields added to existing schema.
**Warning signs:** `ValidationError` on list_reports or get_report for old data.

### Pitfall 3: WeasyPrint Table Page Breaks
**What goes wrong:** Long score_breakdown tables (17 factors) split awkwardly across pages.
**Why it happens:** Default CSS has no page-break rules on `<tr>`.
**How to avoid:** Add `page-break-inside: avoid` on each factor row. Group potentie factors and risico factors into separate tables with `page-break-before: avoid` on the table header.

### Pitfall 4: Missing Scan Flags for Parcels Without Enrichment
**What goes wrong:** If a parcel was scanned before Phase 99 (enrichment backfill), `scan_results.flags` may have score data but no enrichment keys. Or flags may be `NULL`.
**Why it happens:** Phase 101.1 backfilled Venlo but not necessarily all orgs/municipalities.
**How to avoid:** Always use `scan_flags.get("key")` with `None` fallback. Pass `None` into the new optional fields. Template renders "Niet beschikbaar" for `None` values.

### Pitfall 5: BRK Data in Report Data
**What goes wrong:** Accidentally persisting BRK data in the new report data schema.
**Why it happens:** If the assembler pulls BRK from somewhere and doesn't strip it.
**How to avoid:** The existing `service.save_report` already does `report_data_json.pop("brk_ownership", None)`. Do NOT add BRK to the flags assembler — BRK is on-demand only (Phase 105 pattern).

### Pitfall 6: from-parcel Fallback Path (No Scan Flags)
**What goes wrong:** A parcel exists in `parcel_cache` but has NO `scan_results` record. This happens for parcels found via address search but not yet scanned.
**Why it happens:** "Genereer Rapport" can be triggered from map click on any parcel.
**How to avoid:** If no flags found, fall back gracefully to `aggregate_property_data` (the old path). This preserves DD-01 spirit (zero API calls when flags exist) while maintaining backward compatibility.

---

## Code Examples

### Existing flags-first pattern (scans/router.py ~line 1029)

```python
# Source: backend/app/scans/router.py
flags_query = (
    select(ScanResult.flags)
    .join(AreaScan, ScanResult.scan_id == AreaScan.id)
    .where(
        ScanResult.parcel_id == parcel_id,
        ScanResult.organization_id == organization_id,
    )
    .order_by(ScanResult.created_at.desc())
    .limit(1)
)
flags_row = (await db.execute(flags_query)).scalar_one_or_none()
scan_flags = flags_row if isinstance(flags_row, dict) else {}
```

### Existing PDF endpoint pattern (reports/router.py ~line 1050)

```python
# Source: backend/app/reports/router.py
pdf_bytes = await asyncio.to_thread(
    generate_report_pdf,
    report.report_data,
    report.report_name,
)
filename = f"rapport-{postcode_clean}.pdf"
return StreamingResponse(
    io.BytesIO(pdf_bytes),
    media_type="application/pdf",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
)
```

### WeasyPrint cover page + running footer CSS (verified pattern)

```css
/* Source: backend/app/reports/templates/wkb_kwaliteitsborger.html */
@page {
    size: A4;
    margin: 2cm 2cm 3cm 2cm;
    @bottom-center { content: element(footer); }
}
.page-footer {
    position: running(footer);
    font-size: 7.5pt;
    color: #555;
    text-align: center;
    border-top: 1px solid #ccc;
    padding-top: 0.4em;
}
```

### Flags structure (from area_scan.py Phase 99 + 100)

```python
# Source: backend/app/jobs/area_scan.py lines ~924-960
# All 10 Phase 99 enrichment keys in flags:
flags = {
    "vacancy_signal": ...,
    "building_metrics": {...},
    "market_signals": ...,
    "bodem": "klasse",          # bodemkwaliteitsklasse string
    "bodemtype": "veen",        # klei/veen/zand/leem
    "funderingsrisico": {...},  # PDOK WFS result dict
    "energielabel": {...},      # EP-Online result dict
    "vergunningen": {...},      # SRU bekendmakingen result dict
    "natura2000": {...},        # distance + zone name
    "overstromingsrisico": {...},
    "geluid": {...},            # Lden dB band
    "luchtkwaliteit": {...},    # NO2 + PM10 indicators
    "woz": {...},               # Waardeloket result
    # Phase 100 scores:
    "scores": {"potentie": 72.0, "risico": 31.0},
    "score_breakdown": {
        "vrije_grond": {
            "waarde": 0.45,
            "genormaliseerde_score": 0.8,
            "gewicht": 12,
            "bijdrage": 9.6,
            "categorie": "potentie",
            "toelichting_kort": "45% vrije grond",
            "toelichting_lang": "Het perceel heeft 45% onbebouwde ruimte...",
            "data_bronnen": ["BAG", "ParcelCache"],
            "missing": False,
        },
        # ... 16 more factors
    },
    "score_model_version": "score-v3.0",
    "category": "Gemiddeld",
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `from-parcel` calls `aggregate_property_data` (10+ live API calls) | Read from `scan_results.flags` (pre-cached) | Phase 99 completed 2026-03-10 | Zero API latency, no rate-limit exposure |
| 7-section `report.html` template | Full due diligence dossier with 7 sections + cover + TOC | Phase 104 | Professionele output suitable for adviesbureau forwarding |
| PropertyReportResponse lacks enrichment fields | Extended with Phase 99 + 100 data | Phase 104 | Saved reports contain full dossier data |
| Score data only on scan map | Full score narratieven in PDF dossier | Phase 104 | Actionable per-factor analysis in document |

**Note on backwards compatibility:** The existing `report.html` template and `generate_report_pdf` function should NOT be deleted. They serve the `GET /{report_id}/export/pdf` endpoint. A new `due_diligence.html` + `generate_due_diligence_pdf` function serves the new dossier endpoint (or replaces the existing export endpoint — see Open Questions).

---

## Open Questions

1. **Replace existing PDF endpoint or add new one?**
   - What we know: Existing `GET /{report_id}/export/pdf` returns the 7-section report. Frontend uses `exportReportPDF` in `useReports.ts`. The report detail page has a PDF download button.
   - What's unclear: Should the new due diligence PDF replace the old one (same endpoint), or be a new endpoint?
   - Recommendation: Replace the existing endpoint — the old 7-section PDF is clearly inferior. Update `generate_report_pdf` in `pdf_export.py` to call the new due diligence template. Zero frontend changes needed.

2. **What to do when parcel has no scan (no flags)?**
   - What we know: `generate_report_from_parcel` currently always calls `aggregate_property_data`. Some parcels in `parcel_cache` have never been scanned.
   - What's unclear: How common is this case post-enrichment-backfill? Should the new `from-parcel` path fall back to `aggregate_property_data`?
   - Recommendation: Keep fallback to `aggregate_property_data` when `scan_flags` is empty/null. Log a warning. This satisfies DD-01 ("zero external API calls" when flags exist) while not breaking non-scanned parcels.

3. **Scores_v3 data in PropertyReportResponse — new top-level fields or nested?**
   - What we know: `score_breakdown` is a large dict (~17 factors × ~7 fields). Nesting it directly in PropertyReportResponse would make it available but increase the JSONB payload significantly.
   - Recommendation: Add as top-level optional fields (`scores_v3: dict | None`, `score_breakdown_v3: dict | None`). Raw dicts rather than typed Pydantic models for the breakdown, since the breakdown schema is already validated at compute time.

4. **Datum opgehaald for flags data (DD-03)**
   - What we know: `scan_results` has `created_at` but flags themselves don't record individual API call timestamps.
   - What's unclear: Should we use scan `created_at` as the proxy for all enrichment data fetched during that scan?
   - Recommendation: Yes, use `scan_result.created_at` as `datum opgehaald` for all flag-sourced data. It's accurate enough — all enrichment happens during a single scan job run.

---

## Validation Architecture

Nyquist validation: `workflow.nyquist_validation` not present in `.planning/config.json` — skip this section per instructions.

---

## Sources

### Primary (HIGH confidence)
- Codebase read: `backend/app/jobs/area_scan.py` — lines 662-960, confirmed all 10 flag keys + score_breakdown structure
- Codebase read: `backend/app/reports/router.py` — confirmed `from-parcel` flow, idempotency guard, PDF endpoints
- Codebase read: `backend/app/reports/pdf_export.py` + `dossier_export.py` — confirmed WeasyPrint/Jinja2 pattern
- Codebase read: `backend/app/reports/templates/report.html` — confirmed existing 7 sections
- Codebase read: `backend/app/reports/templates/wkb_kwaliteitsborger.html` — confirmed CSS @page pattern for running footer
- Codebase read: `backend/app/schemas/property.py` — confirmed all current PropertyReportResponse fields
- Codebase read: `backend/app/scans/router.py` lines ~1029-1065 — confirmed flags-first lookup pattern already used

### Secondary (MEDIUM confidence)
- `backend/pyproject.toml` — WeasyPrint >=68.0 confirmed

### Tertiary (LOW confidence)
- WeasyPrint automatic TOC generation: NOT supported — confirmed by absence in existing templates + known WeasyPrint limitation. Use static Jinja2-rendered section list instead.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libs already in project, versions confirmed
- Architecture: HIGH — flags structure read from actual source code, not assumed
- Pitfalls: HIGH — based on direct analysis of existing code patterns and known schema validation behavior
- PDF template design: MEDIUM — WeasyPrint CSS patterns verified from existing templates; specific A4 layout choices are design decisions for implementation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain — WeasyPrint, Jinja2, SQLAlchemy patterns don't change fast)
