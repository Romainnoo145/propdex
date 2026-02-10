# Project Research Summary

**Project:** Propdex v3.0 Area Intelligence
**Domain:** Area-based Property Opportunity Discovery (Dutch PropTech)
**Researched:** 2026-02-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

Propdex v3.0 transforms the platform from address-based property lookup to area-based opportunity scanning. Users select a gemeente, the system bulk-fetches all parcels in the bounding box, applies a smart filtering pipeline (BAG has_pand + bestemming + vergunningen), and surfaces ~50 qualified development leads from ~2000 raw parcels. The critical innovation is the three-tier cost optimization: free PDOK/BAG data eliminates 97.5% of parcels before triggering any paid Kadaster BRK owner lookups. This is both the core differentiator and the architectural constraint that shapes every design decision.

The recommended approach extends the existing v1.1/v2.0 architecture rather than replacing it. Four new government API clients (BAG WFS, SRU Bekendmakingen, Open Raadsinformatie, BRK Bevragen) follow the established `government_apis/` pattern. PostGIS enables spatial joins (10x faster than Python Shapely with GIST indexes). The existing ARQ worker handles background scan jobs with progress polling via TanStack Query. Vector tiles (via Martin tile server or PDOK services) solve the 2000+ polygon rendering problem that would crash MapLibre with raw GeoJSON. The database adds 3-4 new tables (area_scans, parcel_cache with PostGIS geometry, scan_results, opportunities) with RLS policies matching existing multi-tenant patterns.

The top risks are: (1) WFS 1000-feature silent truncation -- pagination must be implemented from day one, not retrofitted; (2) EPSG:28992/4326 coordinate mismatches across APIs that cause parcels to render in the ocean; (3) rate limit exhaustion from naive `asyncio.gather()` on 2000 parcels -- requires per-API semaphore rate limiting; (4) JSONB cache bloat from storing entire scan results as single rows -- must cache individual parcels, not bulk scan payloads; and (5) dubbele bestemming (multiple zoning overlays) data model confusion that leads to false "developable" signals. All five have documented prevention strategies but require correct implementation in the first phase they appear -- retrofitting is expensive.

## Key Findings

### Recommended Stack

v3.0 requires 7 new dependencies (5 backend, 2 frontend) integrated with the existing stack. No infrastructure rewrites needed.

**Backend additions:**
- **OWSLib 0.35.0**: OGC API Features client for PDOK BAG bulk queries -- handles 1000-feature pagination natively, actively maintained (Oct 2025 release)
- **lxml 5.3.0**: XML parsing for SRU Bekendmakingen API -- use with `resolve_entities=False, no_network=True` for XXE prevention. Replaces unmaintained defusedxml and sruthi
- **elasticsearch-py 9.3.0**: Official client for Open Raadsinformatie Elasticsearch endpoint -- async-capable, Feb 2026 release
- **geojson 3.1.0**: Serialize Shapely geometries to GeoJSON for OWSLib feature conversion
- **PostGIS extension**: Spatial joins via ST_Intersects/ST_Within with GIST indexes -- 5-40x faster than Python Shapely

**Frontend additions:**
- **@watergis/maplibre-gl-terradraw 1.10.0**: Drawing controls for area selection (polygon, rectangle) -- most actively maintained MapLibre drawing plugin
- **@turf/turf 7.3.0**: Client-side spatial operations (bbox calculation, area validation, containment checks)

**What NOT to add:** sruthi (unmaintained since 2023), defusedxml (unmaintained since 2021), Celery/RQ (extend existing ARQ instead), MapLibre Geoman (commercial, overkill), separate GeoJSON library (use Shapely 2.x native support).

**Critical deadline:** PDOK BAG OGC API v1 discontinued July 15, 2026 -- must use v2 endpoint from the start.

### Expected Features

**Must have (v3.0 -- proves the area scan workflow):**
- Map-based gemeente selection via CBS gebiedsindelingen boundaries
- BAG bulk has_pand cross-reference (parcel has building: yes/no)
- Bestemming filter (Wonen zoning + bouwvlak present)
- Parcel list with basic filters (sort by size, bestemming, has_pand)
- Parcel detail modal with AI summary + expandable source cards
- CSV export of filtered parcels (no owner info yet)
- Progressive loading (pagination for 2000+ row tables)
- Vergunningen data in parcel detail via SRU API

**Should have (v3.1 -- add after workflow validated):**
- Kadaster BRK owner contact lookup (paid API, privacy-restricted, only for filtered <100 parcels)
- AI opportunity scoring (bestemming match + years unused + permit inactivity + parcel size)
- Saved area scans with re-run capability
- Polygon draw tool for custom areas (power users)
- Open Raadsinformatie integration (municipal council decisions)
- Vergunningen monitoring/alerts (daily background check via ARQ)

**Defer (v3.2+):**
- Wijk/buurt hierarchical selection, address radius, historical permit timeline, batch BRK optimization, multi-gemeente searches, email notifications, CRM API integration

**Anti-features to avoid:** Real-time permit polling (APIs update daily, not real-time), scan entire Netherlands (API cost/DB explosion), auto-generate owner letters (GDPR liability), 3D visualization (different product category), financial feasibility calculator (wrong domain).

### Architecture Approach

v3.0 adds area scanning alongside existing property lookup. The two systems share infrastructure (auth, multi-tenant RLS, cache, ARQ workers) but have distinct orchestration patterns. Property lookup is synchronous (single address, parallel API fetch, immediate response). Area scanning is asynchronous (municipality bbox, background job, progress polling).

**Major components:**
1. **Area Scanner Service** (`area_scanner.py`) -- orchestrates municipality scan: resolve bbox, create scan record, enqueue ARQ job, return scan_id for polling
2. **4 New API Clients** (`bag_wfs_client.py`, `sru_bekendmakingen.py`, `open_raadsinformatie.py`, `brk_bevragen_client.py`) -- follow existing `government_apis/` pattern with httpx async clients
3. **Spatial Query Layer** (`spatial_queries.py`) -- PostGIS functions (ST_Contains, ST_DWithin, ST_AsGeoJSON) with GIST-indexed geometry columns
4. **Three-Tier Cache** -- Tier 1: parcel_cache table (PostGIS geometry, 90-day TTL), Tier 2: cached_api_responses JSONB (source-specific TTLs), Tier 3: BRK ownership (never cache, privacy-sensitive)
5. **Batch Rate Limiter** (`batch_rate_limiter.py`) -- asyncio.Semaphore + token bucket per API (BAG=50, DSO=10, BRK=5 concurrent)
6. **Vector Tile Rendering** -- Martin tile server (PostGIS to MVT) or PDOK vector tile services for 2000+ parcel polygons on MapLibre

**Key architectural decisions already made:**
- PostGIS for spatial joins, not Python Shapely (10x performance)
- ARQ for batch processing, not WebSockets for progress (polling is sufficient for 5-30 min jobs)
- Vector tiles for map rendering, not GeoJSON (browser memory protection)
- Three-tier cache with BRK in "never-store" tier (GDPR compliance)
- Polling via TanStack Query refetchInterval, not SSE/WebSocket (simpler, sufficient)

### Critical Pitfalls

Research identified 10 pitfalls (7 critical, 3 major). The top 5 that must be addressed in architecture:

1. **WFS 1000-feature silent truncation** -- PDOK returns max 1000 features per request without error. Implement pagination from day one: use `resultType=hits` to get total count, paginate with `startIndex`, verify counts match. Log warning if response contains exactly 1000 features. Address in Phase 1.

2. **EPSG coordinate mismatch** -- BAG/PDOK use EPSG:28992 (RD New), MapLibre expects EPSG:4326 (WGS84). Transform at API boundary using pyproj. Store in PostGIS as EPSG:28992, convert to 4326 for GeoJSON responses. Validate: Netherlands bbox is [50.7, 3.2, 53.6, 7.2] in EPSG:4326. Address in Phase 1.

3. **Parallel API rate limit exhaustion** -- 2000 parcels x 3 APIs = 6000 requests. Use per-API semaphore rate limiting (10 concurrent max) + token bucket (800/hour). Implement exponential backoff on 429. Monitor `X-RateLimit-Remaining` headers. Address in Phase 2.

4. **JSONB cache bloat** -- Storing 2000 parcels as single JSONB row causes TOAST storage degradation (2-10x slower queries). Cache individual parcels only, link to scans via junction table. Monitor `pg_total_relation_size`. Address in Phase 1 schema design.

5. **Dubbele bestemming (multiple zoning)** -- Dutch parcels can have primary + overlay zonings (Wonen + Waarde-Archeologie + Waterstaat). Store as JSONB array, check ALL zonings in scoring. Single `zoning` string field = data loss and false positives. Address in Phase 1 schema + Phase 4 scoring.

**Additional critical pitfalls:** Invalid geometries from WFS breaking spatial operations (auto-repair with `shapely.make_valid()`), MapLibre memory exhaustion with 2000+ GeoJSON polygons (use vector tiles), GML version inconsistencies between WFS services (request JSON output format), long-running scan timeouts without progress feedback (ARQ background jobs with polling), multi-tenant cache isolation breach (always include organization_id in cache keys).

## Implications for Roadmap

Based on combined research, suggested 7-phase structure with foundation-first ordering:

### Phase 1: PostGIS Foundation + Database Schema
**Rationale:** All subsequent phases depend on the spatial database schema. PostGIS extension, geometry columns, GIST indexes, and RLS policies must exist before any API client can store data. The schema design decision (individual parcel cache vs bulk JSONB) is irreversible once data accumulates.
**Delivers:** PostGIS extension enabled, parcel_cache table with GIST-indexed geometry columns, area_scans table, scan_results table, RLS policies on all new tables, Alembic migrations, spatial query helpers (ST_Contains, ST_DWithin)
**Addresses:** FEATURES: parcel storage infrastructure; PITFALLS: JSONB bloat prevention (individual parcels, not bulk), coordinate system standardization (EPSG:28992 for storage), multi-tenant isolation (RLS from day one)
**Avoids:** JSONB TOAST bloat, multi-tenant cache leaks, schema migration pain after data exists
**Stack:** PostGIS, GeoAlchemy2, existing SQLAlchemy 2.x patterns

### Phase 2: Government API Clients
**Rationale:** API clients are independent of each other and can be built in parallel. They follow the established `government_apis/` pattern. Having all 4 clients ready before the scanner service avoids blocking the orchestration layer.
**Delivers:** BAG WFS client (bulk bbox queries with pagination), SRU Bekendmakingen client (httpx + lxml XML parsing), Open Raadsinformatie client (elasticsearch-py async), BRK Bevragen client (httpx mTLS with PKIOverheid cert), batch rate limiter (semaphore + token bucket), integration tests for each client
**Addresses:** FEATURES: vergunningen data, raadsinformatie context, owner lookup capability; PITFALLS: WFS pagination (1000-feature limit), rate limit exhaustion (per-API semaphore), GML version handling, geometry validation
**Stack:** OWSLib, lxml, elasticsearch-py, httpx mTLS, aiolimiter

### Phase 3: Area Scanner Service + Background Jobs
**Rationale:** The scanner orchestrates API clients (Phase 2) against the database schema (Phase 1). It introduces the ARQ background job pattern for long-running scans and the three-tier caching strategy. This must work end-to-end before building any frontend.
**Delivers:** Area scanner service (municipality to bbox, create scan, enqueue ARQ job), ARQ job for batch processing (paginated WFS fetch, rate-limited enrichment, progress tracking), three-tier cache integration, scan status polling endpoint, duplicate scan prevention
**Addresses:** FEATURES: BAG bulk has_pand cross-reference, bestemming filter, smart pre-filtering pipeline; PITFALLS: long-running scan timeouts (ARQ + polling), parallel rate limit exhaustion (batch limiter), invalid geometry handling (make_valid)
**Avoids:** Synchronous HTTP timeout on 5-30 min scans, duplicate scan cost waste

### Phase 4: REST API Endpoints + Opportunity Scoring
**Rationale:** With the scanner producing results, expose them via REST API. Add opportunity scoring here because it shapes the default sort order for all result views. The scoring algorithm uses data from multiple API sources and must handle dubbele bestemming correctly.
**Delivers:** POST /area-scans (start scan), GET /area-scans/{id}/status (polling), GET /area-scans/{id}/results (paginated, sorted by score), DELETE /area-scans/{id}, opportunity scoring algorithm (bestemming match + years unused + permit inactivity + parcel size), CSV export endpoint
**Addresses:** FEATURES: parcel list with filters, CSV export, opportunity scoring; PITFALLS: dubbele bestemming in scoring (check ALL zonings), progressive loading (server-side pagination)
**Stack:** FastAPI routers following existing patterns, Pydantic response schemas

### Phase 5: Frontend -- Municipality Selection + Map Rendering
**Rationale:** The map is the entry point for area scanning. Municipality selection via CBS gebiedsindelingen boundaries and parcel rendering with vector tiles are the two frontend decisions that are hardest to change later. Vector tile rendering must be decided upfront (Martin tile server vs PDOK services vs client-side clustering).
**Delivers:** CBS gemeente boundary layer on MapLibre map, click-to-select gemeente interaction, vector tile rendering for 2000+ parcel polygons (score-based color coding), area scan trigger from map selection, scan progress dashboard (progress bar, phase indicators)
**Addresses:** FEATURES: map-based gemeente selection (table stakes), progressive loading on map; PITFALLS: MapLibre memory exhaustion (vector tiles, not GeoJSON), coordinate mismatch (backend converts before serving)
**Stack:** @watergis/maplibre-gl-terradraw, @turf/turf, Martin tile server or PDOK vector tiles

### Phase 6: Frontend -- Parcel List + Detail Modal
**Rationale:** With map rendering working, build the list-and-detail views that complete the scan workflow. Parcel detail modal extends the existing v2.0 report drawer pattern with expandable source cards and AI summary.
**Delivers:** Parcel list table (TanStack Table, sortable, filterable, paginated 50/page), parcel detail modal (AI summary + expandable Kadaster/Bestemming/Vergunningen/Raadsinformatie cards), TanStack Query hooks (useAreaScan, useAreaScanStatus, useAreaScanResults), CSV download button, filter controls (bestemming type, has_pand, min size, score threshold)
**Addresses:** FEATURES: parcel list with filters, parcel detail view, expandable source cards, CSV export; PITFALLS: frontend re-rendering cascade (TanStack Query manages server state, not Redux/Zustand)

### Phase 7: Integration Testing + Performance Optimization
**Rationale:** End-to-end validation with realistic data volumes (2000+ parcels). Catches integration issues between phases, validates rate limiting under load, confirms PostGIS query performance, and benchmarks vector tile rendering.
**Delivers:** Load test: 2000-parcel municipality scan end-to-end, PostGIS EXPLAIN ANALYZE optimization, vector tile rendering benchmarks (<3s for 2000 parcels, <200MB memory), cache hit rate monitoring, rate limit behavior verification, multi-tenant isolation integration tests
**Addresses:** All PITFALLS verification checklist items; FEATURES: progressive loading at scale

### Phase Ordering Rationale

- **Database first (Phase 1):** Every other phase writes to or reads from the spatial database. Schema mistakes compound.
- **API clients second (Phase 2):** Independent of each other, can be built in parallel. Needed by scanner service.
- **Scanner third (Phase 3):** Orchestrates clients + database. Must work E2E before any frontend.
- **REST API fourth (Phase 4):** Exposes scanner results. Scoring shapes default sort for all views.
- **Map fifth (Phase 5):** Vector tile decision is architectural. Municipality selection is entry point for entire workflow.
- **List/detail sixth (Phase 6):** Consumes API endpoints. Extends existing v2.0 drawer pattern.
- **Testing seventh (Phase 7):** Validates all integration points under realistic load.

**Dependency chain:**
```
Phase 1 (DB Schema) --> Phase 2 (API Clients) --> Phase 3 (Scanner) --> Phase 4 (REST API)
                                                                             |
                                                         Phase 5 (Map) --> Phase 6 (List/Detail)
                                                                             |
                                                                      Phase 7 (Testing)
```

Note: Phases 1 and 2 can run in parallel. Phases 5 and 4 can overlap (frontend starts once status endpoint exists).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (API Clients):** BRK Bevragen requires PKIOverheid certificate and Kadaster authorization -- government-only access, limited public documentation. Validate: do we have API access? If not, defer BRK integration to v3.1.
- **Phase 5 (Map Rendering):** Vector tile server decision (Martin vs PDOK native vs client-side clustering) needs performance testing with real Dutch parcel data. Martin adds infrastructure (Docker container). Alternative: use PDOK Kadastrale Kaart vector tiles directly.
- **Phase 3 (Scanner):** Rate limits for PDOK/DSO APIs are undocumented. Need empirical testing to set semaphore limits. Start conservative (10 concurrent) and tune.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (DB Schema):** PostGIS patterns well-documented. GeoAlchemy2 + Alembic standard approach.
- **Phase 4 (REST API):** Follows existing FastAPI router patterns from v1.0/v1.1 with 275 tests as reference.
- **Phase 6 (List/Detail):** Extends existing v2.0 PropertyDetailDrawer. TanStack Table + TanStack Query standard patterns.

## Critical Decisions for Requirements Phase

These decisions must be made during requirements definition, not deferred to implementation:

1. **BRK API access:** Do we have Kadaster authorization + PKIOverheid certificate? If no, defer owner lookup to v3.1 entirely and focus v3.0 on free-API opportunity discovery.

2. **Vector tile server:** Martin (self-hosted, full control, adds Docker container) vs PDOK Kadastrale Kaart tiles (no infrastructure, but less control over styling/filtering). Decision impacts Phase 5 scope and infrastructure requirements.

3. **Scan size limits:** Maximum gemeente size to allow (Amsterdam = 50,000+ addresses, takes hours). Recommend hard limit of 10,000 parcels per scan for v3.0 with frontend area size validation via Turf.js.

4. **Parcel cache sharing:** Should raw PDOK/BAG parcel geometries be shared across tenants (same government data, different scans) or fully isolated? Recommendation: share raw geometry cache (government data is public), isolate enriched results (tenant-specific metadata). Requires two-layer cache key design.

5. **Omgevingswet transition:** DSO is in transition period until 2032 (old bestemmingsplannen vs new omgevingsplannen). Must support both or pick one. Recommendation: support both with a unified bestemming model that normalizes the differences.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | All packages verified with recent releases. OWSLib and elasticsearch-py confirmed. Terra Draw has limited production usage reports but active maintenance. |
| Features | MEDIUM | Based on US competitor analysis (PropertyRadar, LightBox) adapted to Dutch market. No direct Dutch PropTech competitor analysis available. Feature prioritization relies on inferred Dutch developer workflow. |
| Architecture | HIGH | Extends proven v1.1/v2.0 patterns (275 tests, 15,947 LOC). PostGIS spatial patterns well-documented. ARQ background jobs already proven at scale. |
| Pitfalls | MEDIUM-HIGH | Government API limitations verified from official docs. Performance thresholds based on documented benchmarks. Rate limits for PDOK/DSO estimated (undocumented). |

**Overall confidence:** MEDIUM-HIGH

The architecture is high-confidence because it extends proven patterns. The features are medium-confidence because Dutch PropTech competitor intelligence is limited -- we are inferring from US market leaders. The stack is solid except for Terra Draw (limited production evidence) and BRK API access (government authorization required).

### Gaps to Address

1. **BRK API authorization status:** Government-only access. Unknown if Propdex/Klarifai has or can obtain PKIOverheid certificate and Kadaster approval. This gates the entire owner lookup feature. Must resolve before requirements finalize.

2. **PDOK/DSO rate limits:** Undocumented. Estimated at 10-50 req/sec based on community reports. Need empirical testing in Phase 3 to calibrate semaphore limits. Start conservative.

3. **ORI municipality coverage:** Open Raadsinformatie covers 265 of 344 municipalities (77%). Must handle missing municipalities gracefully (empty result, not error). Need to test specific target gemeentes.

4. **Omgevingswet data model:** Transition period until 2032. Some municipalities on old bestemmingsplannen, others on new omgevingsplannen. DSO API may return different response structures. Need to test with municipalities in both states.

5. **Terra Draw production readiness:** Active maintenance confirmed (Feb 2026 update), but limited production usage case studies. Fallback: use @mapbox/mapbox-gl-draw fork if Terra Draw has issues.

6. **Vector tile rendering performance:** Martin tile server vs PDOK native tiles vs client-side approaches. Need real-world benchmark with 2000+ Dutch parcels before committing to infrastructure.

## Sources

### Primary (HIGH confidence)
- [PDOK BAG OGC API v2](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features) -- v2 endpoint confirmed, v1 deprecation July 15, 2026
- [PostGIS Spatial Joins](https://postgis.net/workshops/postgis-intro/joins.html) -- ST_Within, ST_Intersects, GIST index patterns
- [BRK Bevragen API](https://kadaster.github.io/BRK-bevragen/) -- PKI certificate + API key authentication
- [OWSLib PyPI](https://pypi.org/project/OWSLib/) -- v0.35.0, Oct 2025
- [elasticsearch-py PyPI](https://pypi.org/project/elasticsearch/) -- v9.3.0, Feb 2026
- [CBS Gebiedsindelingen](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/cbs-gebiedsindelingen) -- Municipality boundary polygons
- [Kadaster BAG-BRK Quality](https://labs.kadaster.nl/dataanalyse/koppelingbagbrk/kwaliteit_bag_brk_koppeling/) -- Known data quality issues

### Secondary (MEDIUM confidence)
- [PropertyRadar Features](https://www.propertyradar.com/features-overview) -- US competitor feature set (250+ filters, census tract selection)
- [LightBox Appraisal Intelligence](https://www.prnewswire.com/news-releases/lightbox-enhances-appraisal-intelligence-302638256.html) -- Q1 2026 competitor enhancements
- [@watergis/maplibre-gl-terradraw npm](https://www.npmjs.com/package/@watergis/maplibre-gl-terradraw) -- v1.10.0, Feb 2026
- [MapLibre Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) -- Vector tiles, clustering patterns
- [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt) -- 342 municipalities, 8M+ residents
- [Open Raadsinformatie](https://vng.nl/projecten/open-raadsinformatie) -- 265/344 municipality coverage

### Tertiary (LOW confidence -- needs validation)
- PDOK/DSO rate limits -- undocumented, community estimates only
- BRK API pricing -- "likely EUR 0.50-1.00 per lookup" based on Kadaster product pages, exact pricing requires account
- Terra Draw production usage -- limited case studies, active maintenance confirmed
- sruthi library status -- confirmed unmaintained (July 2023 last PyPI release)

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
