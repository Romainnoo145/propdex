# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v9.0 Professional Marketplace — Phase 68 Bodemloket Integration (Plan 02 complete)
**Next milestone:** v9.0 Professional Marketplace (planned — Phases 68-71)

---

## Current Position

Phase: 68 of 71 (Bodemloket Integration — Plan 02 complete)
Plan: 2 of 3 complete
Status: Phase 68 Plan 02 complete — Bodemloket ArcGIS REST client + BodemData schema + bodem_aggregator + PropertyReportResponse.bodem_data wiring
Last activity: 2026-03-02 — Phase 68 Plan 02 complete (Bodemloket backend — TDD GREEN, 11 tests pass)

Progress (v9.0): [████░░░░░░] 40% (4/10 plans complete)

---

## Performance Metrics

**v9.0 Professional Marketplace (In Progress)**
- Phase 67 Plan 01: completed ~4min (classify_wkb() + assess_asbest_risk() TDD — WkbClassification + AsbestIndicator schemas + aggregator wiring)
- Phase 67 Plan 02: completed ~2min (WkbClassificatieSection + AsbestSection frontend components — WkbClassification + AsbestIndicator TypeScript interfaces)
- Phase 68 Plan 01: completed ~3min (Bodemloket ArcGIS REST spike — BUFFER_M=10 decided, field names confirmed, SPIKE.md created)
- Phase 68 Plan 02: completed ~18min (Bodemloket backend TDD — BodemloketClient + WBBDossierRef + BodemData + fetch_bodem_data() 30-day cache + PropertyReportResponse.bodem_data wiring — 11 tests GREEN)

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
- Phase 68 Plan 03 next: Frontend BodemSection component using BodemData schema
- AsyncMock passthrough pattern: use named `async def _passthrough_retry(fn, **kwargs): return await fn()` — lambdas cannot await coroutines in side_effect
- Professional model: NULL org_id with separate RLS policy (NOT TenantMixin)
- AVG consent must be designed before lead routing code (LeadRequest needs consent fields from day 1)
- Supply recruitment (2-3 TloKB-verified kwaliteitsborgers) is Phase 70 launch gate

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

**Last Session:** 2026-03-02T08:45:30Z
**Stopped At:** Completed Phase 68 Plan 02
**Resume File:** .planning/phases/68-bodemloket-integration/68-02-SUMMARY.md

**Next Action:** Execute Phase 68 Plan 03 — Frontend BodemSection component.

---

*State updated: 2026-03-02 -- Phase 68 Plan 02 complete: Bodemloket backend TDD (BodemloketClient + schema + 30-day cache + PropertyReportResponse.bodem_data — 11 tests GREEN)*
