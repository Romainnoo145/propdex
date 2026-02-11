# Project Research Summary

**Project:** Propdex v3.1 Smart Area Intelligence
**Domain:** Dutch proptech GIS - zoning visualization, area-based property scanning, change monitoring
**Researched:** 2026-02-11
**Confidence:** MEDIUM-HIGH

## Executive Summary

Propdex v3.1 adds three capabilities to transform from address-first to area-first intelligence: bestemmingsplan (zoning) base layer visualization, focused area deep-dive scanning via user-drawn bbox, and change monitoring for permits and zoning updates. The milestone leverages existing v3.0 infrastructure (MapLibre, ARQ, PostGIS MVT) with zero new dependencies, making it a low-risk extension of proven patterns.

The recommended approach pivots from "scan entire gemeente" (15K+ parcels, expensive) to "bestemmingsplan-first browsing with targeted deep-dives" (hundreds of parcels, efficient). PDOK Ruimtelijke Plannen WMS provides the base layer using MapLibre native raster source. Area selection via MapLibre-Geoman drawing tools (rectangle/polygon) defines scan boundaries, filtering BAG API queries by bbox to reduce API load by 90%+. ARQ cron jobs monitor daily changes (vergunningen via Officiële Bekendmakingen SRU, bestemmingsplan changes via Ruimtelijkeplannen.nl REST API v4). Zoning-aware opportunity scoring adds intelligence by factoring bestemmingsplan hoofdgroep into existing scoring system.

Key risks center on API deprecation and data quality variance. The Ruimtelijkeplannen.nl WFS service was discontinued July 1, 2024 - the new REST API v4 must be used instead. TAM-IMRO (old format) ends January 1, 2026, requiring dual parser support for legacy IMRO and new STOP/TPOD formats. Municipality-level data quality varies wildly (incorrect coordinates, missing status fields). Mitigation: use official DSO REST API endpoints, validate coordinates against Netherlands bbox, implement format detection, add municipality quality indicators in UI. PostGIS spatial performance requires simple RLS policies, attribute reduction in MVT tiles, and regular VACUUM ANALYZE. PDOK WFS 1000-feature pagination is critical - existing bag_wfs.py handles this correctly.

## Key Findings

### Recommended Stack

v3.1 requires ZERO new backend dependencies and ZERO new frontend dependencies. All capabilities are covered by existing packages already integrated in v1.0-v3.0.

**Core technologies:**
- **httpx 0.28.1+**: Direct WMS GetMap requests to PDOK, Ruimtelijkeplannen.nl REST API calls — async-native HTTP client already used for BAG/SRU, handles custom tile URLs without OWSLib sync/async conflicts
- **lxml 5.3.0+**: IMRO GML parsing with XPath for bestemmingsplan data extraction — fast C parser already used for SRU, handles full IMRO schema unlike narrow-scope pygml
- **shapely 2.0.0+**: Bbox to polygon conversion for WFS geometry validation — already required for GeoAlchemy2, provides .box() constructor and GeoJSON mapping
- **ARQ 0.27.0+**: Cron jobs for daily change monitoring (vergunningen, bestemmingsplannen) — already integrated with Redis from v1.0, supports cron_jobs in WorkerSettings, proven in 275 tests
- **MapLibre GL JS 5.17.0**: Native WMS raster layer support for bestemmingsplan tiles — type: 'raster' source with tile URL template, PDOK supports CORS so no backend proxy needed
- **@turf/turf 7.3.0+ (from v3.0)**: Bbox calculation for area selection geometry — already added, supports turf.bbox()
- **@watergis/maplibre-gl-terradraw 1.10.0+ (from v3.0)**: Rectangle/polygon drawing tools for area deep-dive — already added, provides full Terra Draw integration

**Integration patterns critical for success:**
- PDOK WMS layer via MapLibre raster source (NOT OWSLib - sync/async conflict)
- Ruimtelijkeplannen.nl REST API v4 (NOT deprecated WFS endpoints)
- Existing BAG client extended with bbox query method using OWSLib from v3.0
- ARQ cron_jobs pattern for periodic monitoring (daily at 2-3 AM off-peak)
- PostGIS MVT with attribute reduction (NOT SELECT *) to keep tiles under 500KB

### Expected Features

Research identifies clear MVP boundaries: visual foundation and area scanning are table stakes, monitoring is nice-to-have that can be deferred post-launch.

**Must have (table stakes):**
- **Bestemmingsplan WMS layer** — colored zones (wonen, bedrijven, agrarisch) with SVBP2012 standard styling, toggleable layer control with legend. Users expect this from ruimtelijkeplannen.nl, DSO Omgevingsloket, 3D Cityplanner
- **Click zone → show plan details** — WMS GetFeatureInfo on click displays plan name, hoofdgroep, link to official doc in QuickCard/toast
- **Rectangle/polygon drawing tools** — MapLibre-Geoman for area selection (all GIS platforms support this: Google Earth, ArcGIS, QGIS)
- **Bbox → BAG panden query** — replace current "scan ALL panden in gemeente" with user-drawn bbox only, reduces API load by 90%+
- **Scan progress indicator** — reuse existing ScanProgressOverlay from v2.0 for new scan type
- **Parcel boundary highlighting** — visual confirmation of scan area using existing Kadaster parcel WFS layer
- **Filter by zone type** — dropdown filter in results table for bestemmingsplan hoofdgroep

**Should have (competitive advantage):**
- **Zoning-aware opportunity scoring** — existing v2.0 scoring system extended to factor bestemmingsplan hoofdgroep (wonen=high, agrarisch=medium for residential dev), weight 0.3. Unique intelligence competitors lack
- **Bestemmingsplan + Kadaster overlay** — simultaneous display of parcel boundaries + zone colors + score heatmap with z-index stacking and opacity controls. Rare combination
- **Historical vergunning density heatmap** — MVT tile layer showing permit concentration reveals hot development areas (complex, storage-heavy)

**Defer (v2+ / anti-features):**
- **Real-time vergunning webhooks** — no gemeente offers webhooks, Officiële Bekendmakingen updates daily not real-time, use daily polling with morning digest instead
- **User-generated zone annotations** — liability risk if wrong info leads to bad investment, stick to official data only, provide private notes feature
- **Funda listing integration** — licensing complexity, Propdex's value is PRE-listing intelligence not aggregation
- **3D building visualization** — different product category (3D Cityplanner focus), Propdex is data intelligence not architectural modeling
- **Custom bestemmingsplan drawing** — requires legal knowledge, introduces liability, out of scope for intelligence platform

### Architecture Approach

The milestone is ADDITIVE - existing scan pipeline (AreaScan → ARQ job → ParcelCache → ScanResult) already supports arbitrary bboxes. New capabilities layer on top without core changes.

**Major components:**

1. **Bestemmingsplan WMS Proxy (Frontend)** — MapLibre raster source fetching PDOK Ruimtelijke Plannen WMS tiles directly (CORS-enabled), toggleable layer with SVBP2012 SLD styling for standard colors per hoofdgroep

2. **Ruimtelijkeplannen API Client (Backend)** — new httpx AsyncClient for REST API v4 at ruimte.omgevingswet.overheid.nl with methods: get_plan_by_id, get_plans_by_bbox, get_plans_by_date_range. Requires API key from Informatiehuis Ruimte

3. **IMRO GML Parser (Backend)** — new lxml-based parser for bestemmingsvlakken extraction from IMRO GML using XPath with security flags (resolve_entities=False, no_network=True to prevent XXE attacks), converts GML polygons to GeoJSON

4. **Extended BAG Client (Backend)** — add fetch_panden_by_bbox method to existing BAGClient, validates bbox area (<10 km²), uses OGC API Features bbox parameter with 1000-feature pagination

5. **ARQ Cron Jobs (Backend)** — extend existing WorkerSettings with two daily jobs: check_vergunningen_changes (2 AM via SRU Bekendmakingen) and check_bestemmingsplan_changes (3 AM via Ruimtelijkeplannen API), both with idempotent UPSERT pattern

6. **Drawing Tools Integration (Frontend)** — MapLibre-Geoman for rectangle + polygon modes, calculate bbox from drawn geometry via Turf.js, visual confirmation with selected parcels highlight

7. **Zoning-Aware Scoring (Backend)** — extend existing opportunity scoring system to include bestemmingsplan hoofdgroep factor with weight 0.3, requires zone data in scan results

**Data flow:** User draws bbox → frontend calculates bounds → backend fetches BAG panden in bbox → ARQ job enriches each pand (existing pipeline) + fetches bestemmingsplan per pand → stores in scan_results with zone data → frontend renders results with filters → user applies zone-based scoring.

**Key architectural decisions:**
- Reuse existing area scan pipeline (AreaScan model, ARQ job, progress tracking)
- Direct PDOK WMS from frontend (no backend proxy needed due to CORS)
- PostGIS MVT tiles for score heatmap + bestemmingsplan polygons (unified tile endpoint)
- ARQ cron for monitoring (NOT pg_cron - more portable, already integrated)
- Dual format support (IMRO + STOP/TPOD parsers) via format detection

### Critical Pitfalls

Research identifies 16 pitfalls with 7 critical (cause rewrites), 6 moderate (impact quality), 3 minor (performance). Top 5 by impact:

1. **Ruimtelijkeplannen.nl WFS discontinued July 1, 2024** — using deprecated WFS endpoints causes service unavailability and incorrect data. Prevention: Use REST API v4 at ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4, verify endpoint before integration, plan for TAM-IMRO end January 1, 2026

2. **IMRO vs STOP/TPOD format fragmentation** — bestemmingsplan data exists in two incompatible formats causing inconsistent visualization and parsing failures across municipalities. Prevention: Build dual format parsers from start, format detection via metadata, municipality-level feature flags tracking which format, graceful degradation with UI indicators

3. **PDOK WFS 1000-feature hard limit** — silent data truncation when bbox matches more features, incomplete scans miss 90%+ parcels. Prevention: Always paginate with count/startIndex parameters (existing bag_wfs.py correct), verify numberReturned vs numberMatched, log "fetched X/Y panden (page N)", pre-check with resultType=hits

4. **PostGIS MVT performance degrades with SELECT *** — including all columns causes 9x slower tile generation and 50-100x bigger tiles (>500KB), map freezes. Prevention: Select only display columns (existing tile_proxy.py pattern correct), NEVER use SELECT *, zoom-level LOD (fewer attributes at low zoom), target <500KB per tile

5. **Multi-tenant RLS policies degrade spatial queries** — RLS executed for every row before spatial index causes 10-100x slowdown. Prevention: Simple RLS conditions (direct organization_id comparison only), use session variable pattern (existing rls_policies.sql optimal), no joins in USING clause, force index hints with && operator, test with RLS enabled

**Other critical pitfalls:** BAG WFS coordinate system mismatch (EPSG:28992 vs 4326), ARQ job failure recovery without idempotency (use UPSERT not INSERT), MapLibre layer z-order without beforeId parameter, bestemmingsplan data quality variance across municipalities, notification fatigue from naive change monitoring.

## Implications for Roadmap

Based on research, recommended 4-phase structure focuses on visual foundation first, then scanning, then intelligence layers. Monitoring deferred to post-MVP.

### Phase 1: Visual Foundation (Must Have)
**Rationale:** Bestemmingsplan visualization is table stakes - users expect colored zones like ruimtelijkeplannen.nl and DSO Omgevingsloket. Provides context for area selection in Phase 2.

**Delivers:**
- PDOK WMS bestemmingsplan raster layer with SVBP2012 standard colors
- Layer toggle UI control (aerial/topo + bestemmingsplan + kadaster + scores)
- Click zone → plan details (WMS GetFeatureInfo → QuickCard)
- Legend showing hoofdgroepen (wonen, bedrijven, agrarisch, groen)

**Addresses features:** Bestemmingsplan WMS layer, click zone details, layer toggle (all table stakes from FEATURES.md)

**Uses stack:** MapLibre raster source (existing), httpx for GetFeatureInfo (existing), PDOK WMS endpoint

**Avoids pitfalls:**
- Pitfall 1 (use REST API v4 not deprecated WFS)
- Pitfall 2 (add format detection for IMRO/STOP)
- Pitfall 4 (attribute reduction if adding MVT polygon layer)
- Pitfall 10 (layer ordering with beforeId)
- Pitfall 11 (hardcoded colors not CSS vars)

**Research flag:** LOW - PDOK WMS is well-documented, MapLibre raster source is standard pattern. Skip phase research.

---

### Phase 2: Area Selection & Focused Scanning (Must Have)
**Rationale:** Replaces inefficient "scan all gemeente panden" with user-drawn bbox, reduces API load by 90%+. Drawing tools + bbox calculation enable targeted deep-dives. Core value proposition shift from address-first to area-first.

**Delivers:**
- MapLibre-Geoman drawing tools (rectangle + polygon modes)
- Bbox calculation from drawn geometry via Turf.js
- Selected parcels highlight (visual confirmation)
- Extended BAG client with fetch_panden_by_bbox method
- Replace existing area scan logic with bbox-filtered scan
- Reuse ScanProgressOverlay for new scan type
- Scan results with bestemmingsplan hoofdgroep column

**Addresses features:** Drawing tools, bbox BAG query, scan progress, parcel highlighting, filter by zone (all table stakes)

**Uses stack:** @watergis/maplibre-gl-terradraw (v3.0), @turf/turf (v3.0), shapely for bbox validation, existing BAG client with OWSLib (v3.0), ARQ for bulk enrichment (v1.0)

**Implements architecture:** Extended BAG Client component, reuses existing scan pipeline

**Avoids pitfalls:**
- Pitfall 3 (WFS pagination - existing bag_wfs.py correct)
- Pitfall 6 (EPSG:28992 explicit SRID in bbox)
- Pitfall 7 (UPSERT not INSERT for scan_results)
- Pitfall 8 (XML parser for resultType=hits)
- Pitfall 12 (ARQ for scans not BackgroundTasks)

**Research flag:** LOW - Extends existing proven patterns (area scan pipeline, BAG client, ARQ jobs). Spatial queries are well-documented. Skip phase research.

---

### Phase 3: Zoning Intelligence (Should Have)
**Rationale:** Adding bestemmingsplan hoofdgroep as scoring factor provides Dutch-specific intelligence competitors lack. Differentiates from simple data aggregation platforms. Requires Phase 2 (scan with zone data) to be complete.

**Delivers:**
- Zoning-aware opportunity scoring (hoofdgroep factor, weight 0.3)
- Filter scan results by zone type dropdown
- Bestemmingsplan + Kadaster + scores simultaneous overlay
- Score recalculation with zone context

**Addresses features:** Zoning-aware scoring, filter by zone type (competitive advantage), bestemmingsplan + kadaster overlay (differentiator)

**Uses stack:** Existing scoring system (v2.0), PostgreSQL JSONB for zone storage

**Implements architecture:** Zoning-Aware Scoring component extending existing opportunity model

**Avoids pitfalls:** None directly, but Phase 2 must avoid Pitfall 7 (idempotency) for score recalculation reliability

**Research flag:** LOW - Scoring system exists, just adding factor. SVBP2012 hoofdgroep mapping is documented. Skip phase research.

---

### Phase 4: Change Monitoring Foundation (Nice to Have - DEFER)
**Rationale:** Monitoring requires saved scans (user account feature) and notification infrastructure. Adds significant complexity. Value unproven until users validate scan workflow (Phases 1-3). Defer post-MVP.

**Delivers:**
- Save scan areas (bbox + filters stored in DB)
- ARQ cron job: daily vergunning check via SRU Bekendmakingen (2 AM)
- ARQ cron job: daily bestemmingsplan change check via Ruimtelijkeplannen API (3 AM)
- Notification UI (in-app badges for "3 new permits", "1 plan changed")
- Change tracking tables (BestemmingsplanChange, VergunningChange)

**Addresses features:** Vergunning monitoring, bestemmingsplan change monitoring (nice-to-have, not table stakes)

**Uses stack:** ARQ cron_jobs, SRU client (v3.0), new Ruimtelijkeplannen API client

**Implements architecture:** ARQ Cron Jobs component, Ruimtelijkeplannen API Client component, IMRO GML Parser component

**Avoids pitfalls:**
- Pitfall 7 (idempotent periodic jobs with UPSERT)
- Pitfall 9 (municipality quality dashboard integration)
- Pitfall 13 (scheduled VACUUM ANALYZE for spatial tables)
- Pitfall 14 (request spacing to avoid rate limits)
- Pitfall 15 (significance filtering to prevent notification fatigue)

**Research flag:** MEDIUM - Ruimtelijkeplannen.nl API v4 endpoint found but WebFetch denied verification (needs API key request to validate). IMRO GML parsing is documented but complex. Consider `/gsd:research-phase` if API integration unclear during planning.

---

### Phase Ordering Rationale

- **Phase 1 first:** Visual layer provides context for all subsequent features. Users need to see zones before selecting areas. Zero backend changes, low risk, immediate value.
- **Phase 2 depends on Phase 1:** Drawing tools make sense when bestemmingsplan layer shows what to target. Bbox scans need zone context for filtering.
- **Phase 3 depends on Phase 2:** Scoring requires scan results with zone data. Can't score without scan pipeline complete.
- **Phase 4 deferred:** Monitoring is orthogonal enhancement, not critical path. Requires user accounts + notification infrastructure = significant scope. Validate core workflow (Phases 1-3) before investing in monitoring.

**Dependency chain:** Phase 1 (visual) → Phase 2 (scanning) → Phase 3 (intelligence) → Phase 4 (monitoring)

**Risk mitigation:** Front-load table stakes (Phases 1-2) to deliver core value early. Defer competitive features (Phase 3) until foundation proven. Postpone nice-to-haves (Phase 4) post-MVP.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Change Monitoring):** Ruimtelijkeplannen.nl REST API v4 endpoint documentation incomplete, WebFetch denied verification. Requires API key request to Informatiehuis Ruimte to validate endpoint. IMRO GML parsing is complex (XPath namespaces, geometry extraction). Consider `/gsd:research-phase` for API integration + GML parsing patterns if uncertainty blocks planning.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Visual Foundation):** PDOK WMS integration is well-documented with official MapLibre examples. Raster source pattern is standard. Skip phase research.
- **Phase 2 (Area Scanning):** Extends existing proven patterns (area scan job, BAG client, ARQ infrastructure). Spatial queries follow PostGIS best practices. Skip phase research.
- **Phase 3 (Zoning Intelligence):** Scoring system exists, SVBP2012 hoofdgroep mapping is documented standard. Skip phase research.

**Overall:** Only Phase 4 potentially needs `/gsd:research-phase`. Phases 1-3 are well-understood extensions of existing codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies, all capabilities covered by existing packages. httpx/lxml/shapely/ARQ proven in v1.0-v3.0 with 275 tests. MapLibre WMS is native feature with official examples |
| Features | MEDIUM-HIGH | Table stakes (bestemmingsplan layer, drawing tools, bbox scans) validated by competitor analysis (3D Cityplanner, Assetmaps, ruimtelijkeplannen.nl). MVP boundaries clear (visual + scanning = must, monitoring = defer). Anti-features identified (real-time webhooks, UGC) |
| Architecture | HIGH | ADDITIVE approach reusing existing scan pipeline, MapLibre setup, ARQ worker, PostGIS MVT. Minimal core changes. Proven patterns from 275 tests + 8,804 LOC v2.0 + 15,947 LOC v1.1 |
| Pitfalls | MEDIUM-HIGH | 16 pitfalls identified from Dutch GIS community sources (Geoforum), official documentation, and PostGIS/MapLibre performance research. Top 5 critical pitfalls have clear prevention strategies. Phase-specific warnings mapped |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

**Gap 1: Ruimtelijkeplannen.nl REST API v4 authentication and endpoint validation**
- Research found API endpoint via Ontwikkelaarsportaal but WebFetch was denied verification
- Requires API key request to Informatiehuis Ruimte to confirm endpoint structure, authentication method, and response format
- Mitigation: Request API key during Phase 4 planning, use documented WMS GetFeatureInfo as fallback for Phase 1-3 (provides plan ID, can link to external viewer)

**Gap 2: TAM-IMRO to STOP/TPOD transition timeline per municipality**
- TAM-IMRO ends January 1, 2026 but municipality adoption of STOP/TPOD varies
- Some software fixes arriving spring 2026, conversion deadline is 2032
- Gap: No central registry of which gemeenten use which format
- Mitigation: Implement format detection via metadata inspection, maintain municipality format mapping via background job, display UI indicator "Data format: IMRO (converting to STOP 2027)"

**Gap 3: PDOK WMS service availability SLA**
- Service URL verified, CORS support confirmed, but no public SLA found
- Unknown: uptime guarantees, rate limits, performance during peak hours
- Mitigation: Implement client-side tile caching (MapLibre built-in), add retry logic with exponential backoff, monitor PDOK status via existing health check infrastructure

**Gap 4: Bestemmingsplan data quality variance quantification**
- Research confirms quality varies wildly across municipalities (incorrect coordinates, missing status) but no quantitative baseline
- Gap: Which gemeenten have HIGH vs LOW quality data?
- Mitigation: Integrate ruimtelijkeplannen.nl quality dashboard API during Phase 4, add coordinate validation (reject geometries outside Netherlands bbox), display municipality quality badges in UI

**Gap 5: SVBP2012 to new Omgevingswet symbology transition**
- SVBP2012 defines standard colors for TAM-IMRO bestemmingsplannen
- STOP/TPOD omgevingsplannen may use different symbology standards
- Gap: Are old SVBP2012 colors still valid for new plans?
- Mitigation: Use PDOK WMS default styling (they handle symbology updates), allow custom opacity/blending in UI, defer custom styling until Omgevingswet symbology stabilizes

## Sources

### Primary (HIGH confidence)

**Dutch Government APIs:**
- [PDOK Ruimtelijke Plannen WMS](https://www.pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen) — WMS service URL, layers (bestemmingsplangebied, enkelbestemming, dubbelbestemming), update frequency (monthly)
- [Ruimtelijke Plannen API - Ontwikkelaarsportaal](https://aandeslagmetdeomgevingswet.nl/ontwikkelaarsportaal/api-register/api/rp-opvragen/) — REST API v4 endpoint (WebFetch denied, needs validation)
- [BAG API Individuele Bevragingen](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-api-individuele-bevragingen) — bbox parameter support
- [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt) — Officiële Bekendmakingen SRU endpoint, 342 gemeenten, daily updates

**Standards & Documentation:**
- [IMRO2012 Documentation](https://docs.geostandaarden.nl/ro/imro/) — Official IMRO schema, namespace definitions
- [IMRO XSD Schema (GitHub)](https://github.com/Geonovum/imro/blob/master/xmlschema/2012-v1.3/20120209-IMRO2012-Schema-Lokaal/IMRO2012.xsd) — XML schema reference
- [SVBP2012 v1.3.1 PDF](https://ro-standaarden.geonovum.nl/2012/SVBP/1.3/SVBP2012-v1.3.1.pdf) — Standard colors per hoofdgroep (wonen, bedrijven, agrarisch, groen)
- [TAM-IMRO eindigt per 1 januari 2026 | VNG](https://vng.nl/nieuws/tam-imro-eindigt-per-1-januari-2026) — Transition timeline
- [Afnemersservices ruimtelijkeplannen.nl vanaf 1 juli 2024 niet beschikbaar](https://aandeslagmetdeomgevingswet.nl/actueel/nieuws-digitaal-stelsel-omgevingswet-dso/nieuws-2024/mei/ruimtelijkeplannen-vanaf-1-juli-niet-beschikbaar/) — WFS discontinuation confirmation

**Technical Documentation:**
- [MapLibre Add WMS Source](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-wms-source/) — Official WMS raster source integration pattern
- [MapLibre RasterTileSource API](https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/) — TypeScript types, tile options
- [ARQ Cron Documentation](https://arq-docs.helpmanual.io/) — cron_jobs configuration in WorkerSettings
- [Shapely Documentation](https://shapely.readthedocs.io/en/stable/geometry.html) — box(), to_geojson(), mapping() methods
- [PostGIS Spatial Indexing](https://postgis.net/workshops/postgis-intro/indexing.html) — GIST indexes, 5-40x speedup

**Performance Research:**
- [Serving Dynamic Vector Tiles from PostGIS | Crunchy Data](https://www.crunchydata.com/blog/dynamic-vector-tiles-from-postgis) — SELECT * causes 9x slowdown, 50-100x tile bloat
- [Heavy Map Visualizations Fundamentals](https://advena.hashnode.dev/heavy-map-visualizations-fundamentals-for-web-developers) — Tile size budget <500KB
- [Row Level Security for Tenants | Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) — Simple RLS policies for spatial performance

### Secondary (MEDIUM confidence)

**Community & Forums:**
- [DSO Omgevingsloket API Discussion - Geoforum](https://geoforum.nl/t/hoe-vraag-ik-omgevingsplannen-op-met-dso-api/9216) — No public API for omgevingsplannen by location (community confirmation)
- [BAG bbox querying - Geoforum](https://geoforum.nl/t/perceel-in-bbox/4600) — Bbox parameter usage patterns
- [Bestemmingsplan data quality - Quarant](https://www.quarant.nl/worden-onze-bestemmingsplannen-straks-wel-getoond-in-de-dso-viewer/) — Quality variance across municipalities (incorrect coords, missing status)

**Competitors & Tools:**
- [3D Cityplanner](https://3dcityplanner.com/) — Bestemmingsplan layers + drawing tools (table stakes validation)
- [Assetmaps](https://www.assetmaps.nl/en/) — Interactive real estate info platform (polygon drawing expected)
- [OmgevingsAlert](https://www.omgevingsalert.nl/) — Permit monitoring service (list/notifications, not heatmap visualization)
- [Ruimtelijkeplannen.nl viewer](https://www.ruimtelijkeplannen.nl/viewer/view) — Standard for plan viewing (colored zones, click for details)

**Drawing Tools:**
- [MapLibre-Geoman Docs](https://geoman.io/docs/maplibre/category/draw-modes) — Rectangle + polygon modes, active maintenance 2025+
- [Draw geometries with terra-draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) — Alternative drawing library
- [mapbox-gl-draw](https://github.com/mapbox/mapbox-gl-draw) — Legacy (EOL, no longer maintained)

**Background Tasks:**
- [Building Resilient Task Queues in FastAPI with ARQ Retries](https://davidmuraya.com/blog/fastapi-arq-retries/) — Idempotency patterns, retry configuration
- [Managing Background Tasks: BackgroundTasks vs ARQ](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/) — Decision matrix: <1s → BackgroundTasks, >1s → ARQ

### Tertiary (LOW confidence - needs validation)

- Ruimtelijkeplannen.nl API authentication process — not documented, requires validation via API key request
- DSO Omgevingsloket roadmap for future public API — unknown
- PDOK WMS SLA and rate limits — not found in public docs, needs operational testing
- STOP/TPOD symbology standards for new omgevingsplannen — transition in progress, standards may not be finalized

---

*Research completed: 2026-02-11*
*Ready for roadmap: yes*
