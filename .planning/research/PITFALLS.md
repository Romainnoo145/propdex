# Domain Pitfalls

**Domain:** Bestemmingsplan visualization, area deep-dive scanning, and change monitoring for Dutch proptech
**Researched:** 2026-02-11

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Ruimtelijkeplannen.nl WFS Services Are Discontinued
**What goes wrong:** Attempting to integrate bestemmingsplan data from ruimtelijkeplannen.nl WFS endpoints fails with service unavailability or incomplete/incorrect data.

**Why it happens:** As of January 1, 2024, the information provision from ruimtelijkeplannen.nl (including INSPIRE/PDOK data delivery) became incomplete and possibly incorrect. As of July 1, 2024, the WMS/WFS consumer services of ruimtelijkeplannen.nl are no longer available.

**Consequences:**
- Bestemmingsplan base layer fails to load or displays outdated data
- Development effort wasted on integrating deprecated services
- No migration path if built on legacy WFS endpoints
- User-facing feature becomes unreliable

**Prevention:**
- **Use the replacement REST API:** Existing spatial plans can now be retrieved from `https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4`
- **Verify service status:** Check PDOK/DSO documentation for current endpoint availability before integration
- **Plan for TAM-IMRO transition:** TAM-IMRO ends January 1, 2026 - municipalities must use STOP/TPOD instead
- **Architecture decision:** Choose DSO REST API (forward-compatible) over PDOK WFS (deprecated)

**Detection:**
- 404/503 errors on ruimtelijkeplannen.nl WFS GetFeature requests
- GetCapabilities responses missing expected layers
- Data freshness checks returning stale data (pre-2024)
- Community forum posts reporting "WFS service not available"

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Must use correct API from day 1 to avoid rewrite.

---

### Pitfall 2: Omgevingswet Data Format Fragmentation (IMRO vs STOP/TPOD)
**What goes wrong:** Bestemmingsplan data exists in two incompatible formats (legacy TAM-IMRO and new STOP/TPOD), causing inconsistent visualization, parsing failures, or missing data for some municipalities.

**Why it happens:** The Omgevingswet transition is ongoing. TAM-IMRO ends January 1, 2026, but municipalities transition at different rates. Not all municipalities had STOP/TPOD software ready (some fixes arriving spring 2026). Some bestemmingsplannen remain in old IMRO format until converted by 2032.

**Consequences:**
- Map displays bestemmingsplannen for some gemeenten but not others
- Parser built for one format fails on the other
- User confusion ("Why can't I see plans for municipality X?")
- Data quality varies wildly across municipalities
- Silent data loss if only one format is supported

**Prevention:**
- **Dual format support:** Build parsers for both TAM-IMRO and STOP/TPOD from the start
- **Format detection:** Check metadata fields to identify data format and route to appropriate parser
- **Graceful degradation:** Display partial data with clear UI indicators when one format is unavailable
- **Municipality-level feature flags:** Track which gemeenten use which format, update via background job
- **User messaging:** "Bestemmingsplan data for [gemeente] is being migrated to new format (available Q2 2026)"

**Detection:**
- GeoJSON/XML parsing errors for specific municipalities
- Empty bestemmingsplan layers despite API returning 200 OK
- Metadata fields indicating TAM-IMRO vs STOP/TPOD
- User reports of missing data for specific regions

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Format detection and dual parser support required in initial implementation.

---

### Pitfall 3: PDOK WFS 1000-Feature Hard Limit Causes Silent Data Truncation
**What goes wrong:** PDOK WFS requests silently return only first 1000 features even when thousands exist in bounding box, causing incomplete scans and missing parcels.

**Why it happens:** PDOK enforces a 1000-feature maximum per request. If a WFS GetFeature query matches more features, only the first 1000 are returned. Without checking `numberReturned` vs `numberMatched`, developers assume all data was retrieved.

**Consequences:**
- Area scans appear complete but miss 90%+ of parcels
- Users see empty patches on map in dense urban areas
- Scoring/analytics based on incomplete data (garbage in → garbage out)
- Legal risk if investment decisions made on incomplete data
- Production rewrite required to implement pagination

**Prevention:**
- **Always paginate:** Use `count` and `startIndex` parameters in WFS 2.0 requests (existing `bag_wfs.py` implementation is correct)
- **Verify completion:** Compare `numberReturned` vs `numberMatched` in FeatureCollection response
- **Pre-check counts:** Use `resultType=hits` to get total count before full fetch, warn users if area too large
- **Batch size awareness:** Keep PAGE_SIZE at 1000 (PDOK maximum)
- **Logging:** Log "fetched X/Y panden (page N)" to detect pagination issues early

**Detection:**
- `numberReturned` < `numberMatched` in WFS response
- Same number of parcels (1000) returned for different bbox sizes
- User reports of missing buildings in known dense areas
- Scan result counts suspiciously low for urban gemeenten

**Phase impact:** Phase 2 (Area Deep-Dive) - Pagination is critical for MVP. Existing `bag_wfs.py` handles this correctly, but new WFS integrations (bestemmingsplan) must follow same pattern.

---

### Pitfall 4: PostGIS MVT Tile Generation Performance Degrades with SELECT *
**What goes wrong:** Vector tile endpoint becomes slow (multi-second responses) and generates massive tiles (>500KB), causing map to freeze during pan/zoom.

**Why it happens:** Using `SELECT *` to include all columns in ST_AsMVT moves unnecessary data and bloats tile size. According to research, a point tile takes **9x longer** when including 42 properties vs 5 properties. Tiles become 50-100x bigger than recommended (<500KB).

**Consequences:**
- Map becomes unusable (multi-second lag on every tile request)
- Database CPU spikes to 100% during map interactions
- PostgreSQL parallelism triggered for large queries, consuming extra resources
- Mobile users on slow connections see blank map tiles
- Horizontal scaling doesn't help (bottleneck is per-query efficiency)

**Prevention:**
- **Select only needed columns:** In `tile_proxy.py`, existing query selects `parcel_id, address, area_m2, has_pand, score, score_category` - good pattern
- **Never use SELECT *:** Explicitly list columns needed for map display
- **Tile size budget:** Target <500KB per tile, log tile sizes in development
- **Attribute reduction:** Strip non-essential metadata before ST_AsMVT
- **Zoom-level LOD:** Include fewer attributes at low zoom levels (e.g., only score_category at z<12, full details at z>14)

**Detection:**
- Slow query logs showing ST_AsMVT queries >500ms
- Network tab showing tile responses >500KB
- Database CPU usage correlates with map panning
- EXPLAIN ANALYZE showing parallel query execution for tiles

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Tile endpoint must follow attribute reduction pattern from day 1. Adding bestemmingsplan polygons to MVT? Simplify geometry and limit attributes.

---

### Pitfall 5: Multi-Tenant RLS Policies Degrade PostGIS Spatial Query Performance
**What goes wrong:** Spatial tile queries become 10-100x slower after enabling RLS policies, causing map lag despite spatial indexes.

**Why it happens:** RLS policies are executed **for every row** before spatial index is applied. If policy condition is complex (e.g., joins to verify organization_id), it destroys spatial index efficiency. The query planner may choose to filter by RLS policy first, then by spatial predicate, instead of the reverse.

**Consequences:**
- Map tiles that loaded in 50ms now take 5 seconds
- ST_Intersects queries with GIST indexes become table scans
- Database CPU usage spikes during map usage
- Spatial index appears unused in EXPLAIN ANALYZE
- Horizontal scaling doesn't help (per-query inefficiency)

**Prevention:**
- **Simple RLS conditions:** Use direct column comparison only (e.g., `organization_id = current_setting('app.current_tenant_id')::uuid`)
- **No joins in RLS policies:** Avoid joining to other tables in USING clause
- **Session variable pattern:** Existing `rls_policies.sql` uses optimal pattern - replicate for new spatial tables
- **Force index hints:** Add `AND pc.geometry && bounds.geom` before `ST_Intersects` to ensure GIST index usage
- **Test with RLS enabled:** All spatial query performance tests must run with `SET LOCAL app.current_tenant_id`

**Detection:**
- EXPLAIN ANALYZE showing Seq Scan instead of Index Scan
- Query times increase linearly with table size despite GIST index
- Index usage stats show low usage (`pg_stat_user_indexes`)
- Queries fast as superuser, slow as app_role

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - New `bestemmingsplan_cache` table needs RLS policy. Phase 2 (Area Deep-Dive) - `parcel_cache` already has correct RLS pattern, new spatial tables must follow.

---

### Pitfall 6: BAG WFS Coordinate System Mismatch (EPSG:28992 vs EPSG:4326)
**What goes wrong:** Building footprints appear in wrong location (e.g., middle of ocean, foreign countries) or bbox queries return zero results despite data existing in area.

**Why it happens:** BAG WFS returns coordinates in EPSG:28992 (RD New, Dutch projection) but developers assume EPSG:4326 (WGS84). Using RD coordinates as lat/lon puts features at wrong location. Additionally, `srsName` parameter can cause lat/lon axis swap bugs.

**Consequences:**
- Map shows parcels in completely wrong locations
- Bbox queries miss all features due to coordinate mismatch
- Existing v3.0 attempt failed due to CBS bbox in EPSG:28992 used with BAG WFS expecting WGS84
- User sees empty map despite data existing
- Geometry calculations (area, distance) are wildly incorrect

**Prevention:**
- **Explicit SRID in bbox:** Use `bbox=minx,miny,maxx,maxy,urn:ogc:def:crs:EPSG::28992` in WFS requests (existing `bag_wfs.py` does this correctly)
- **Transform coordinates early:** If frontend uses WGS84, transform in PostGIS via `ST_Transform(geometry, 4326)` before sending to client
- **Validate coordinate ranges:** EPSG:28992 X is ~0-300k, Y is ~300k-600k. EPSG:4326 lon is 3-8°E, lat is 50-54°N for NL
- **Consistent storage:** Store geometries in EPSG:28992 (native BAG format), transform to 4326 only for MVT tiles or client API
- **Test with known locations:** Hardcode test for Amsterdam Centraal (EPSG:28992: 121000, 487000) to verify coordinate handling

**Detection:**
- Features render outside Netherlands bounding box
- Municipality in documentation says coordinates are abroad
- Geometry area calculations off by orders of magnitude (m² vs degrees²)
- `ST_Intersects` queries return no results despite overlapping bbox

**Phase impact:** Phase 2 (Area Deep-Dive) - Existing `bag_wfs.py` handles EPSG:28992 correctly. Phase 1 (Bestemmingsplan) - Verify which CRS bestemmingsplan API returns, transform explicitly.

---

### Pitfall 7: ARQ Job Failure Recovery Causes Duplicate Scans Without Idempotency
**What goes wrong:** Area scan job fails mid-execution (worker restart, database timeout), ARQ automatically requeues job, resulting in duplicate `ScanResult` entries and incorrect progress tracking.

**Why it happens:** ARQ guarantees at-least-once delivery. If a worker is stopped during job execution (deployment, Ctrl+C, crash), the job is automatically requeued. Without idempotent job design, the rerun creates duplicate database entries.

**Consequences:**
- Same parcel appears multiple times in scan results
- Progress percentage goes above 100% or resets
- Score aggregations double-count parcels
- User sees duplicate parcels on map
- Database bloat from duplicate entries
- Export/reporting shows wrong totals

**Prevention:**
- **Idempotent job design:** Use UPSERT (`ON CONFLICT` clause) instead of INSERT for all database writes
- **Unique constraints:** Add `UNIQUE(organization_id, scan_id, parcel_id)` on `scan_results` table
- **Status check on restart:** Job checks `AreaScan.status` at start - if already 'completed', exit early
- **Transaction boundaries:** Commit progress updates frequently (existing code does this) so partial work is visible
- **Retry limits:** Configure `max_tries=3` in ARQ to prevent infinite retry loops
- **Explicit idempotency tokens:** Include `scan_id` in all database writes to scope operations

**Detection:**
- Duplicate entries in `scan_results` for same scan + parcel combination
- Progress percentage exceeds 100%
- ARQ logs showing job running multiple times for same `scan_id`
- Redis key `arq:retry:job_id` exists with count > 0

**Phase impact:** Phase 2 (Area Deep-Dive) - Existing `area_scan_job` uses INSERT, should use UPSERT for `scan_results`. Phase 3 (Change Monitoring) - Periodic jobs must be idempotent by design.

---

## Moderate Pitfalls

### Pitfall 8: PDOK resultType=hits Returns XML Instead of JSON
**What goes wrong:** Pre-flight count check using `resultType=hits` fails to parse response, causing code to crash before full data fetch.

**Why it happens:** BAG WFS `resultType=hits` returns XML format even when `outputFormat=application/json` is specified. Existing v3.0 attempt failed due to parsing XML as JSON.

**Prevention:**
- **XML parsing for hits:** Use XML parser (lxml, xmltodict) for `resultType=hits` responses
- **Extract from XML:** Parse `<wfs:FeatureCollection numberMatched="12345">` attribute
- **JSON only for features:** Only expect JSON when `resultType=results` (default)
- **Test both formats:** Unit tests must cover both hits (XML) and features (JSON) requests

**Detection:**
- JSON parse errors on `resultType=hits` responses
- Response starts with `<?xml` instead of `{`
- 200 OK response but parsing exception

**Phase impact:** Phase 2 (Area Deep-Dive) - Existing `bag_wfs.py` doesn't specify `outputFormat` for hits query (relies on default). Should explicitly handle XML response or omit `resultType=hits` pre-checks.

---

### Pitfall 9: Bestemmingsplan Data Quality Varies Wildly Across Municipalities
**What goes wrong:** Bestemmingsplan layer displays correctly for some gemeenten but shows incorrect coordinates (abroad), missing status, or incomplete data for others.

**Why it happens:** Geonovum/Kadaster analysis shows many errors in bestemmingsplan data - often involving incorrect coordinates (some plans positioned abroad), wrong status, or incomplete fields. Quality varies from zero errors (some municipalities) to 10+ errors (others).

**Prevention:**
- **Municipality-level quality dashboard:** Track data quality per gemeente using ruimtelijkeplannen.nl quality dashboard API
- **Coordinate validation:** Reject geometries outside Netherlands bbox (EPSG:28992: X 0-300k, Y 300k-600k)
- **Status field validation:** Verify status field matches expected enum values (onherroepelijk, ontwerp, vastgesteld)
- **UI quality indicators:** Show data quality badge per gemeente ("Data laatste check: 2026-02-10, 3 warnings")
- **Fallback messaging:** "Bestemmingsplan data for [gemeente] may be incomplete (last updated 2023-11-02)"

**Detection:**
- Quality dashboard API returns errors for specific gemeenten
- Geometries render outside Netherlands
- Status field NULL or unexpected values
- User reports of incorrect bestemmingsplan boundaries

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Add coordinate validation before rendering. Phase 3 (Change Monitoring) - Monitor data quality changes, alert on degradation.

---

### Pitfall 10: MapLibre Layer Ordering Without z-index Causes Stacking Issues
**What goes wrong:** Bestemmingsplan polygons render on top of parcel boundaries, or parcel scores are hidden beneath satellite imagery, making map unreadable.

**Why it happens:** MapLibre doesn't support CSS-like `z-index`. Layer stacking is controlled by definition order in style. Layers defined later render on top. Dynamic layer addition can insert layers in wrong order.

**Prevention:**
- **Define layer order constant:** Create enum/array defining canonical layer order (background → satellite → bestemmingsplan → parcels → labels)
- **Use beforeId parameter:** When adding layers dynamically, specify `beforeId` to insert at correct position
- **sort-key for features:** Use `layout: { 'sort-key': ['get', 'score'] }` to control feature ordering within a layer
- **Test layer combinations:** Verify rendering with all layer combinations enabled (satellite + bestemmingsplan + parcels)
- **Documentation:** Comment expected z-order in MapView.tsx

**Detection:**
- Visual inspection: parcels hidden beneath other layers
- User reports of "can't see parcel boundaries"
- Layer toggle doesn't reveal expected features

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Must insert below parcel layers. Use `beforeId: 'parcel-scores-layer'` when adding bestemmingsplan source.

---

### Pitfall 11: MapLibre WebGL Doesn't Support CSS Variables in Paint Properties
**What goes wrong:** Attempting to use CSS variables like `var(--color-high)` in MapLibre paint properties causes layer to not render or throws WebGL errors.

**Why it happens:** MapLibre evaluates paint properties in WebGL shader, which doesn't have access to CSS custom properties. Known issue from v3.0 milestone context.

**Prevention:**
- **Hardcode colors in MapLibre:** Use literal hex values in paint properties: `'fill-color': '#10b981'`
- **JS constants file:** Define color constants in TypeScript, import into both CSS and MapLibre code
- **Runtime interpolation:** Use data-driven styling: `['match', ['get', 'score_category'], 'high', '#10b981', ...]`
- **Theme function:** Create `getMapThemeColors()` function that returns current theme colors as object

**Detection:**
- Layer not rendering despite source having data
- Browser console warnings about invalid color values
- WebGL errors in DevTools

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Use hardcoded colors or data-driven expressions, not CSS vars.

---

### Pitfall 12: FastAPI BackgroundTasks vs ARQ Worker Queue Misuse
**What goes wrong:** Using FastAPI `BackgroundTasks` for area scanning causes API server to hang during large scans, blocking other requests.

**Why it happens:** `BackgroundTasks` runs in the same process as the API server. CPU-intensive tasks (processing thousands of parcels) block the event loop. If the server crashes, background tasks are lost.

**Consequences:**
- API unresponsive during scans
- Scan progress lost on server restart
- Cannot scale workers independently
- No retry mechanism for failed tasks

**Prevention:**
- **Use ARQ for long-running tasks:** Area scans, change monitoring, bulk enrichment
- **Use BackgroundTasks only for:** Sending emails, logging, cache updates (<1s duration)
- **Decision matrix:**
  - <1s duration + non-critical → BackgroundTasks
  - >1s duration OR critical OR needs retry → ARQ
- **Existing pattern is correct:** `area_scan_job` uses ARQ worker

**Detection:**
- API response times spike during background tasks
- Scan progress resets on server restart
- Server logs showing event loop blocked warnings

**Phase impact:** Phase 2 (Area Deep-Dive) - Existing ARQ usage is correct. Phase 3 (Change Monitoring) - Periodic monitoring jobs must use ARQ scheduler.

---

### Pitfall 13: PostGIS GIST Index Performance Degrades Without VACUUM
**What goes wrong:** Spatial queries with GIST indexes become progressively slower over time despite indexes existing.

**Why it happens:** PostgreSQL doesn't maintain BRIN indexes dynamically; changes append to end of index, degrading search performance. GIST indexes also fragment with many updates. Without regular VACUUM ANALYZE, query planner uses stale statistics.

**Prevention:**
- **Regular VACUUM ANALYZE:** Schedule daily `VACUUM ANALYZE parcel_cache, bestemmingsplan_cache`
- **Auto-vacuum tuning:** Ensure autovacuum is enabled and aggressive enough for spatial tables
- **REINDEX on major updates:** After bulk imports (area scans), run `REINDEX TABLE parcel_cache`
- **Monitor bloat:** Track index size growth, alert if >50% bloat
- **Avoid BRIN for frequently updated tables:** Use GIST for parcel_cache (frequent updates), consider BRIN only for append-only bestemmingsplan cache

**Detection:**
- Spatial query times increasing over weeks/months
- `pg_stat_user_indexes` showing low index scans
- EXPLAIN ANALYZE preferring seq scans over index scans
- Index size grows but row count stable

**Phase impact:** Phase 2 (Area Deep-Dive) - Add VACUUM ANALYZE to ARQ maintenance job. Phase 3 (Change Monitoring) - Include REINDEX in periodic maintenance.

---

## Minor Pitfalls

### Pitfall 14: PDOK API Rate Limiting Causes Intermittent Failures
**What goes wrong:** Area scans fail with 429 Too Many Requests during pagination, causing partial data loss.

**Why it happens:** PDOK enforces rate limits (exact limits not publicly documented). Rapid-fire requests during WFS pagination or concurrent scans trigger throttling.

**Prevention:**
- **Rate limiting in client:** Existing `bag_wfs_limiter` (correct pattern) - replicate for all PDOK endpoints
- **Exponential backoff:** Catch 429 errors, retry with exponential delay (1s, 2s, 4s, 8s)
- **Concurrent scan limits:** Limit ARQ workers to 2-3 concurrent area scan jobs
- **Request spacing:** Add 100-200ms delay between pagination requests

**Detection:**
- 429 HTTP status codes in logs
- ARQ job failures with "Too Many Requests" error
- Scan failures during peak usage times

**Phase impact:** Phase 2 (Area Deep-Dive) - Extend rate limiting to concurrent job limit. Phase 3 (Change Monitoring) - Space periodic checks across time to avoid burst requests.

---

### Pitfall 15: Change Monitoring Notification Fatigue
**What goes wrong:** Users receive dozens of change notifications per day for minor updates, disable notifications, then miss critical changes.

**Why it happens:** Every bestemmingsplan metadata update, vergunning status change, or boundary tweak triggers notification. Naive implementation sends all changes.

**Prevention:**
- **Significance filtering:** Only notify on "significant" changes (status: ontwerp→vastgesteld, new vergunning, geometry change >10%)
- **Batching:** Daily/weekly digest instead of instant notifications
- **User preferences:** Let users configure notification frequency and significance threshold
- **Smart defaults:** New vergunningen (instant), bestemmingsplan updates (daily digest), minor changes (weekly)

**Detection:**
- High notification opt-out rate
- User feedback: "too many emails"
- Low notification click-through rate

**Phase impact:** Phase 3 (Change Monitoring) - Implement significance scoring from day 1 to avoid user backlash.

---

### Pitfall 16: Bestemmingsplan Geometry Complexity Causes Browser Rendering Lag
**What goes wrong:** Bestemmingsplan polygons with thousands of vertices cause browser to freeze during rendering or tile decoding.

**Why it happens:** Detailed bestemmingsplan geometries can have 10k+ vertices. MapLibre must decode and render all vertices, overwhelming GPU on mobile devices.

**Prevention:**
- **Server-side simplification:** Use ST_Simplify in tile query, tolerance based on zoom level (z<10: 10m, z10-14: 5m, z>14: 1m)
- **Douglas-Peucker algorithm:** `ST_SimplifyPreserveTopology` maintains topology while reducing vertices
- **Zoom-dependent LOD:** Only include detailed geometries at high zoom levels
- **Vertex budget:** Log geometries with >1000 vertices, investigate if common

**Detection:**
- Mobile browser freezing when panning over bestemmingsplan layer
- Tile decode times >500ms in Chrome DevTools
- Memory usage spikes when layer enabled

**Phase impact:** Phase 1 (Bestemmingsplan Base Layer) - Add ST_Simplify to MVT query based on zoom level.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Bestemmingsplan Base Layer | Pitfall 1 (Deprecated WFS), Pitfall 2 (IMRO/STOP dual format), Pitfall 4 (MVT performance), Pitfall 10 (Layer ordering), Pitfall 11 (CSS vars) | Use DSO REST API v4, dual format parsers, attribute reduction in tiles, beforeId for layers, hardcoded colors |
| Phase 2: Area Deep-Dive Scanning | Pitfall 3 (WFS 1000 limit), Pitfall 6 (CRS mismatch), Pitfall 7 (ARQ idempotency), Pitfall 8 (XML hits), Pitfall 12 (BackgroundTasks misuse) | Pagination (existing code correct), EPSG:28992 explicit, UPSERT not INSERT, XML parser for hits, ARQ for scans |
| Phase 3: Change Monitoring | Pitfall 7 (ARQ idempotency), Pitfall 9 (Data quality variance), Pitfall 13 (GIST degradation), Pitfall 14 (Rate limits), Pitfall 15 (Notification fatigue) | Idempotent periodic jobs, quality dashboard integration, scheduled VACUUM, request spacing, significance filtering |
| Phase 4: Integration Hardening | Pitfall 5 (RLS spatial performance), Pitfall 13 (Index maintenance), Pitfall 16 (Geometry complexity) | Simple RLS policies, REINDEX schedule, ST_Simplify in queries |

---

## Sources

**Dutch Government API Services:**
- [WFS service van Ruimtelijke Plannen geeft af en toe aan GML 3.1.1 niet te ondersteunen - Geoforum](https://geoforum.nl/t/wfs-service-van-ruimtelijke-plannen-geeft-af-en-toe-aan-gml-3-1-1-niet-te-ondersteunen/3713)
- [Uitfasering ruimtelijkeplannen.nl - GeoBusiness](https://www.geobusiness.nl/nieuws/nieuwsberichten/1354-uitfasering-ruimtelijkeplannen-nl)
- [Afnemersservices ruimtelijkeplannen.nl vanaf 1 juli 2024 niet beschikbaar](https://aandeslagmetdeomgevingswet.nl/actueel/nieuws-digitaal-stelsel-omgevingswet-dso/nieuws-2024/mei/ruimtelijkeplannen-vanaf-1-juli-niet-beschikbaar/)
- [Ruimtelijke plannen opvragen - Developer Overheid](https://apis.developer.overheid.nl/apis/dso-ruimtelijke-plannen-opvragen)
- [Geo services en APIs — PDOK / NGR documentatie](https://pdok-ngr.readthedocs.io/services.html)

**Omgevingswet Transition:**
- [TAM-IMRO eindigt per 1 januari 2026 | VNG](https://vng.nl/nieuws/tam-imro-eindigt-per-1-januari-2026)
- [Omgevingswet: nog knelpunten bij uitfaseren TAM-IMRO - Gemeente.nu](https://www.gemeente.nu/ruimte-milieu/omgevingswet/omgevingswet-nog-knelpunten-bij-uitfaseren-tam-imro/)
- [Einde TAM-IMRO | Informatiepunt Leefomgeving](https://iplo.nl/regelgeving/instrumenten/omgevingsplan/wijzigen-omgevingsplan/einde-tam-imro-per-1-januari-2026/)
- [Tijdelijke Alternatieve Maatregelen (TAM) stoppen definitief per 1 januari 2026 | Geonovum](https://www.geonovum.nl/nieuws/tijdelijke-alternatieve-maatregelen-tam-stoppen-definitief-per-1-januari-2026)

**Coordinate Systems and WFS:**
- [Verblijfsobject geeft coordinaten in EPSG28992 - Geoforum](https://geoforum.nl/t/verblijfsobject-geeft-coordinaten-in-epsg28992-hoe-krijg-ik-ze-in-epsg4326-latlong/6388)
- [Handleidingen — PDOK / NGR documentatie](https://pdok-ngr.readthedocs.io/handleidingen.html)
- [Axis ordering — GeoServer 2.28.0 User Manual](https://docs.geoserver.org/main/en/user/services/wfs/axis_order.html)

**PostGIS Performance:**
- [Serving Dynamic Vector Tiles from PostGIS | Crunchy Data Blog](https://www.crunchydata.com/blog/dynamic-vector-tiles-from-postgis)
- [An update on MVT encoders - Carto](https://carto.com/blog/an-update-on-mvt-encoders-c)
- [Heavy Map Visualizations Fundamentals for Web Developers](https://advena.hashnode.dev/heavy-map-visualizations-fundamentals-for-web-developers)
- [The Many Spatial Indexes of PostGIS | Crunchy Data Blog](https://www.crunchydata.com/blog/the-many-spatial-indexes-of-postgis)
- [PostgreSQL Best Practices: PostGIS Spatial Indexes (GiST, BRIN) - Alibaba Cloud](https://www.alibabacloud.com/blog/postgresql-best-practices-selection-and-optimization-of-postgis-spatial-indexes-gist-brin-and-r-tree_597034)

**MapLibre Performance:**
- [Optimising MapLibre Performance: Tips for Large GeoJSON Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [Layers - MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/layers/)
- [Dynamic z-ordering across groups of style layers · Issue #2108](https://github.com/maplibre/maplibre-gl-js/issues/2108)

**ARQ and Background Tasks:**
- [Building Resilient Task Queues in FastAPI with ARQ Retries](https://davidmuraya.com/blog/fastapi-arq-retries/)
- [The Inner Workings of: Arq](https://threeofwands.com/the-inner-workings-of-arq/)
- [Managing Background Tasks in FastAPI: BackgroundTasks vs ARQ + Redis](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)

**Multi-Tenant Security:**
- [Row Level Security for Tenants in Postgres | Crunchy Data Blog](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [Multi-tenant data isolation with PostgreSQL Row Level Security | AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Postgres RLS Implementation Guide - Best Practices, and Common Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide)

**Data Quality:**
- [Worden onze bestemmingsplannen straks wel getoond in de DSO-viewer? - Quarant](https://www.quarant.nl/worden-onze-bestemmingsplannen-straks-wel-getoond-in-de-dso-viewer/)

**Change Monitoring Services:**
- [Kan ik een melding krijgen als er wat gaat veranderen in mijn wijk? | Planviewer](https://www.planviewer.nl/artikelen/toekomst/kan-ik-een-melding-krijgen-als-er-wat-gaat-veranderen-in-mijn-wijk)
- [Mobiele app met buurt- en vergunningsinformatie - OmgevingsAlert](https://www.omgevingsalert.nl/app)

**Geometry Simplification:**
- [Line simplification algorithms | Martin Fleischmann](https://martinfleischmann.net/line-simplification-algorithms/)
- [Ramer–Douglas–Peucker algorithm - Wikipedia](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
