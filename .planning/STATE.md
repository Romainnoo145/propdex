# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v9.0 Professional Marketplace — Phase 69 Risicobeoordeling Dossier COMPLETE (both plans shipped); next: Phase 70
**Next milestone:** v9.0 Professional Marketplace (planned — Phases 68-71)

---

## Current Position

Phase: 73 of 73 (DSO Omgevingsplan Bouwregels — In Progress)
Plan: 1 of 2 — Plan 01 COMPLETE; Plan 02 pending
Status: Phase 73 Plan 01 complete — max_bouwlagen DSO schema + PLU WMS bouwhoogte/bouwlagen extraction + area_scan persistence via dict copy; cache v4 bumped
Last activity: 2026-03-03 — Phase 73 Plan 01 complete; backend bouwregels extraction flowing into ScanResult.flags["building_metrics"]

Progress (Phase 73): [█████░░░░░] 50% (1/2 plans complete)

---

## Performance Metrics

**v10.0 Parcel Detail Panel Redesign (Completed)**
- Phase 72 Plan 01: completed ~3min (5-tuple _derive_bag_attributes_for_parcel + total_footprint_area accumulator + pand_oppervlakte_m2 in ScanResult.flags.building_metrics — 6 unit tests GREEN)
- Phase 72 Plan 02: completed ~3min (ParcelDetailModal three real data pillar bars: Vrije ruimte + Beschikbaarheid + Transformatiepotentie; FAR/TAR dead code removed from ParcelDetailModal + InspectorPanel + ParcelCard)

**v9.0 Professional Marketplace (Completed)**
- Phase 67 Plan 01: completed ~4min (classify_wkb() + assess_asbest_risk() TDD — WkbClassification + AsbestIndicator schemas + aggregator wiring)
- Phase 67 Plan 02: completed ~2min (WkbClassificatieSection + AsbestSection frontend components — WkbClassification + AsbestIndicator TypeScript interfaces)
- Phase 68 Plan 01: completed ~3min (Bodemloket ArcGIS REST spike — BUFFER_M=10 decided, field names confirmed, SPIKE.md created)
- Phase 68 Plan 02: completed ~18min (Bodemloket backend TDD — BodemloketClient + WBBDossierRef + BodemData + fetch_bodem_data() 30-day cache + PropertyReportResponse.bodem_data wiring — 11 tests GREEN)
- Phase 69 Plan 01: completed ~3min (GeneratedDossier model + Alembic migration + generate_dossier_pdf() + POST/GET dossier router endpoints — DOSSIER-01)
- Phase 69 Plan 02: completed ~5min (Full wkb_kwaliteitsborger.html Jinja2 template 7 sections + per-page INDICATIEF footer + Genereer Startdossier CTA button — DOSSIER-01 DOSSIER-02 DOSSIER-03)

**v8.0 Client Demo Readiness (Completed)**
- Phase 62 Plan 01: completed ~25min (BAG WFS retry + abort-on-failure + coverage_ratio + completed_with_warnings)
- Phase 62 Plan 02: completed ~2min (force-mode clean-slate rescan + FORCE MODE log + WijkOutcome summary table)
- Phase 63 Plan 01: completed ~2min (validate_scan_data CLI + WijkValidation dataclass + parcel_addressing formalized)
- Phase 63 Plan 02: completed ~4hrs (21-wijk scan execution + validation — 108,789 parcels, 100% coverage)
- Phase 64 Plan 01: completed ~7min (BAGPandLayer.tsx + PDOK_BAG_PAND_WMS + showBAGPanden state + LayerToggle groups + gradient legend)
- Phase 65 Plan 01: completed ~6min (section reorder + empty states + ReportHeader + SatelliteThumbnail extraction)
- Phase 65 Plan 02: completed ~10min (@media print CSS + window.print() PDF export + white-label header/footer — RPT-02)
- Phase 65 Plan 03: completed ~5min (ActieVereistSection + computeWarnings — RPT-03 + RPT-04)

**v7.2 Developer Dossier Intelligence (Completed)**
- Phase 59 Plan 01: completed (buildability delta contract + calculations + report/map presentation)
- Phase 60 Plan 01: completed (Layer A Wkb precheck + optional Layer B refinement contract)
- Phase 61 Plan 01: completed (permit precedent benchmark by municipality + comparable type + report integration)

**v7.1 Workspace Productization (Completed)**
- Phase 58: 5 plans completed (workspace role context, URL-state hardening, operational UX, canonical parcel flow, handoff)

**v7.0 Deep Property Data (Completed)**
- Phase 54 Plan 01: 3 min (BRK schema + aggregator wiring)
- Phase 54 Plan 02: 5 min (BRK strip-before-save + re-fetch-on-view + 6 integration tests)
- Phase 55 Plan 01: 5 min (RCE Linked Data two-step enrichment in monument_aggregator)
- Phase 55 Plan 02: 2 min (EP-Online + WOZ into 5-parallel Step 2a gather, completeness 6->9)

---

## Accumulated Context

### Roadmap Evolution
- Phase 73 added: DSO Omgevingsplan Bouwregels — extract max_bebouwingspercentage, max_bouwhoogte, max_bouwlagen via STTR/IMOW APIs, rewrite Transformatiepotentie to objective formula

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- SET LOCAL f-string (not params): asyncpg doesn't support parameterized SET statements
- Three-state contract: return model | None (not-found/unconfigured) | raise GovernmentAPIError (error)
- retry_with_backoff: shared helper in base.py, wraps any async HTTP callable; 429-aware by default
- BAG WFS abort-on-failure: area_scan_job sets status=failed + error_detail JSONB, returns early
- coverage_ratio + address_resolution_ratio tracked on AreaScan post-scan; completed_with_warnings when thresholds breached
- --force-all clean-slate rescan: deletes ScanResult rows, logs "FORCE MODE: Deleting N existing results"
- WijkOutcome dataclass: per-wijk scan quality tracking, _print_summary() OK/WARN/FAIL table
- WijkValidation dataclass: per-wijk validation with bouwjaar_rate/address_rate/pand_status_rate computed from parcels_with_buildings (not total_parcels)
- validate_scan_data CLI: exit codes 0/1/2, normalize_gemeente_code(raw) returns (with_prefix, bare) tuple
- Conditional SQLAlchemy count: func.count(case(((condition), 1))) pattern for per-wijk aggregation
- ClassVar[bool] never_cache marker: BRKOwnership.never_cache = True
- Professional model uses NULL org_id (platform-wide, not tenant-isolated) -- v9.0 critical pattern

### Phase 67 Context (COMPLETE)

- Phase 67 Plan 01: Wkb Classification Engine backend complete
- Phase 67 Plan 02: Wkb Classification Engine frontend complete
- classify_wkb() exclusion order: rijksmonument (consensus_status == "rijksmonument") > verbouwing ("verbouwing pand" stripped+lowercased) > GK1 ("woonfunctie" in gebruiksdoel) > onbekend
- assess_asbest_risk() bands: >= 1994 geen, 1963-1993 hoog (NEN 2991), < 1963 middel (NEN 2991), None onbekend
- wkb_applicable=True for "onbekend" (optimistic — Phase 71 CTA will not be suppressed for unknown cases)
- Only rijksmonumenten excluded (not gemeentelijke) — checked via consensus_status field, not is_monument
- Pre-existing mypy dict[str, Any] type parameter errors exist in zoning.py, address.py — out of scope
- Frontend: WkbClassificatieSection 3-state render (null/exclusion/classification), AsbestSection returns null when indicator is null
- Frontend: ASBEST_RISK_STYLES module-level const for risk badge color mapping
- Frontend: WkbClassificatieSection shows "Indicatief" badge alongside gevolgklasse badge when wkb_applicable=true

### Phase 66 Context

- Phase 66 Plan 01: Results Table Noise Reduction complete
- SCORE_CUTOFF=40 matches QUALIFICATION_THRESHOLD — Top kansen toggle defaults ON, hides null-score + sub-40 parcels
- list_scan_results returns 3-tuple: (rows, filtered_total, unfiltered_total) — unfiltered count computed BEFORE score filters
- nulls_last() wraps all SQLAlchemy sort expressions (all columns, not just score)
- Toggle state is React useState only — not URL-persisted, resets to ON on mount
- Pre-existing bug fixed: pand_status filter was not being serialized in fetchScanResults API call

### v8.0 Context

- Root cause fixed: BAG WFS abort-on-failure + retry (Phase 62 complete)
- Venlo data complete: 21 wijken, 108,789 parcels, 100% bouwjaar/address/pand_status coverage (Phase 63 complete)
- PDOK geocoding enhanced: distance fallback 100m/250m/500m + rate limiter 10 concurrent / 5000/hr
- Phase 64 complete: Map Visualization — grey-to-green gradient, hatch pattern, progressive labels, dashed wijk, BAGPanden wiring
- Canvas hatch pattern pattern: draw -> getImageData() -> addImage({width, height, data: Uint8Array}) — HTMLCanvasElement NOT accepted by MapLibre addImage()
- Progressive label disclosure: separate minzoom/maxzoom symbol layers, not JS zoom listeners
- fitBounds maxZoom guards: gemeente=15, wijk=17 to prevent over-zoom on small boundaries
- Phase 65 Plan 01: Section order locked: Bestemmingsplan → Kadaster → BRK → Gebouw → WOZ → Energielabel → Buildability → Wkb → Permits → Market → AI
- ESRI World Imagery static thumbnail: ArcGIS REST MapServer/export, no API key, bbox from center_wgs84 deltaKm=0.3
- ReportHeader extracted: full data prop, satellite thumbnail, kadaster perceel ID, 6-card metric grid (adds Bestemming + WOZ-waarde)
- Phase 65 Plan 02: @media print overrides CSS custom properties inline — no JS class toggle needed; window.print() = zero-dependency PDF; pdf-only/print-hide utility classes; report-grid/report-aside/section-card semantic print targets
- Phase 65 Plan 03: ActieVereistSection at top of main column; computeWarnings pure function (Wkb/asbest/BAG-status/monument)
- computeWarnings returns [] for clean properties → component returns null (RPT-04 pattern)
- STATUS_WARNING_DESCRIPTIONS inlined in ActieVereistSection (separate from STATUS_EXPLANATIONS in ReportDetailPage — different purpose)

### v9.0 Context (In Progress)

- Roadmap: .planning/ROADMAP.md Phases 67-71
- Phase 67 complete: Wkb Classification Engine (backend + frontend)
- Phase 68 Plan 01 complete: Bodemloket spike — BUFFER_M=10 (not 25), RESEARCH.md Schiermonnikoog coords were approximate (actual polygon centroid x=206259,y=610965)
- Phase 68 Plan 02 complete: BodemloketClient + WBBDossierRef schema + fetch_bodem_data() 30-day cache + PropertyReportResponse.bodem_data — 11 TDD tests GREEN
- Phase 68 Plan 03 COMPLETE: BodemSection 3-state component (null/empty/populated), WBBDossierRef + BodemData TypeScript types, bodem_data on PropertyReportResponse, inserted after AsbestSection — human-verify APPROVED (BODEM-02 + BODEM-03)
- BodemSection import pattern: only import WBBDossierRef (not BodemData) — BodemData accessed via data.bodem_data typing, direct import unused
- AsyncMock passthrough pattern: use named `async def _passthrough_retry(fn, **kwargs): return await fn()` — lambdas cannot await coroutines in side_effect
- Professional model: NULL org_id with separate RLS policy (NOT TenantMixin)
- AVG consent must be designed before lead routing code (LeadRequest needs consent fields from day 1)
- Supply recruitment (2-3 TloKB-verified kwaliteitsborgers) is Phase 70 launch gate
- Phase 69 Plan 01 complete: GeneratedDossier model (TenantMixin, FK saved_reports + users), Alembic migration 3d97e34821f2, generate_dossier_pdf() WeasyPrint sync fn, POST /{report_id}/dossier (5/min) + GET /{report_id}/dossiers (30/min) endpoints, GeneratedDossierResponse schema
- Alembic autogenerate PostGIS noise pattern: autogenerate detects tiger/postgis tables — manually clean migration to only include new tables
- generate_dossier_pdf(): file_size_bytes saved AFTER pdf_bytes in memory (ensures accurate size in audit record)
- Phase 69 Plan 02 COMPLETE: wkb_kwaliteitsborger.html full 7-section template with running footer disclaimer (position: running(footer) + @page @bottom-center) + generateStartdossier() API (POST /dossier, returns Blob) + Genereer Startdossier CTA button (amber/accent, disabled state, loading spinner) — human-verify APPROVED; user noted visual quality is mediocre (polish deferred to future phase)
- Jinja2 null-safe pattern for nested dicts: 'is not none' guard + | default() filter; 'report_data.zoning.plans[0]' requires zoning not none AND plans | length > 0
- reportId prop thread: rapport.$id.tsx (id.startsWith('r') ? null : id) -> ReportDetailPage -> ReportHeader -> handleGenerateDossier()

### Phase 72 Context (COMPLETE)

- Phase 72 Plan 01 complete: _derive_bag_attributes_for_parcel returns 5-tuple with pand_oppervlakte_m2; total_footprint_area accumulates all qualifying BAG pand overlaps (post MIN_BUILDING_OVERLAP_M2 guard); stored in ScanResult.flags["building_metrics"]["pand_oppervlakte_m2"]
- Return None (not 0.0) for empty parcels — consumer distinguishes missing vs zero
- Phase 4 uses final_bm dict copy-merge pattern — preserves existing building_metrics keys
- No schema migration needed — pand_oppervlakte_m2 stored in existing JSONB flags column
- Phase 72 Plan 02 complete: ParcelDetailModal three pillars replaced (Bebouwbaarheid→Vrije ruimte, Leegstandsrisico→Beschikbaarheid, Transformatiekans→Transformatiepotentie)
- deriveTransformatiePotentie: 40pt bouwjaar + 40pt bestemming(wonen/gemengd=true) + 20pt area — score always 20-100 range
- Vrije ruimte null for pre-Phase-72 scans (pand_oppervlakte_m2 not yet in building_metrics) — shows "Footprint onbekend" context
- Beschikbaarheid uses vacancy_confidence * 100 directly (not deriveVacancyScore fallback chain)
- topVacancyReason strips /^(HARD|PROXY):\s*/i prefix before display in Beschikbaarheid pillar context
- formatPlanruimteLabel, deriveBuildabilityScore, deriveTransformationScore, toMetricNumber, deriveBuildabilityForInspector all deleted
- extractScoreSubscores import removed from both ParcelDetailModal and ParcelCard

### Phase 73 Context (In Progress)

- Phase 73 Plan 01 complete: BuildingDimensions.max_bouwlagen (int | None) + has_any_data updated; _merge_building_dimensions handles bouwlagen; _extract_building_dimensions extracts bouwlagen from Dutch synonyms (bouwlagen/bouwlaag/verdieping/woonlagen); cache key bumped v3→v4
- int(round(waarde)) pattern for float→int rounding (NOT round(int(waarde)) which truncates)
- Bouwlagen branch must come BEFORE generic "hoogte" branch in _extract_building_dimensions
- PLU WMS _extract_metrics_from_features: max_bouwhoogte (2.0-100.0m, excludes "goot" text), max_bouwlagen (1 < v <= 50 int); both propagated into bestemmingen dict entries
- extract_building_metrics() now always returns 4 keys: max_bebouwingspercentage, max_floor_area_ratio, max_bouwhoogte, max_bouwlagen
- area_scan.py: final_bm = dict(building_metrics) automatically carries max_bouwhoogte/max_bouwlagen — no code changes needed
- 38 zoning aggregator tests GREEN; ruff check all modified files: clean

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)
- v9.0: Recruit 2-3 TloKB-verified kwaliteitsborgers before Phase 71 CTA is enabled
- v9.0: Draft verwerkersovereenkomst for professionals receiving lead data (before Phase 71)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-03
**Stopped At:** Completed Phase 73 Plan 01 — backend bouwregels extraction (max_bouwhoogte + max_bouwlagen) from PLU WMS + DSO into ScanResult.flags["building_metrics"]
**Resume File:** .planning/phases/73-dso-omgevingsplan-bouwregels/73-02-PLAN.md

**Next Action:** Execute Phase 73 Plan 02 — frontend Transformatiepotentie formula rewrite using max_bouwlagen data from building_metrics.

---

*State updated: 2026-03-03 -- Phase 73 Plan 01 complete: BuildingDimensions.max_bouwlagen + PLU WMS bouwregels extraction + extract_building_metrics 4-key return; DSO cache v4*
