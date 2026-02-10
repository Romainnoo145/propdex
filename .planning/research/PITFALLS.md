# Pitfalls Research

**Domain:** Area Intelligence Features for Dutch Property Intelligence Platform
**Researched:** 2026-02-10
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: WFS 1000-Feature Limit Causes Silent Data Loss

**What goes wrong:**
PDOK BAG WFS services enforce a hard limit of 1000 features per request. When scanning an area with 2000+ parcels, the API silently returns only the first 1000, leading to incomplete datasets that users believe are complete. Results appear successful (200 OK) but are missing 50%+ of properties.

**Why it happens:**
Developers test with small areas (100-200 parcels) during development, never hitting the limit. Production area scans exceed 1000 parcels, but the WFS response doesn't fail—it just truncates. Without checking feature counts or implementing pagination, the silent truncation goes unnoticed.

**How to avoid:**
1. Always use `resultType=hits` first to get total feature count before fetching
2. Implement pagination with `count` (WFS 2.0) or `maxFeatures` (WFS 1.0) + `startIndex`
3. Set page size to 500-800 (below limit with safety margin)
4. Use `sortBy` with stable primary key (ObjectID) for consistent pagination
5. Verify returned feature count matches expected count from hits query
6. Log warning if single request returns exactly 1000 features (likely truncated)

**Warning signs:**
- Scan results have round numbers like exactly 1000 or 2000 parcels
- Edge parcels missing from results (pagination would show gaps at boundaries)
- Different scan runs return different feature counts for same area
- WFS response doesn't include `numberOfFeatures` attribute in FeatureCollection

**Phase to address:**
Phase 18.2 (Area Scanning - WFS Integration) - Must implement pagination from day one, not as later optimization.

---

### Pitfall 2: JSONB Bloat from Caching Thousands of Parcels

**What goes wrong:**
Existing cache stores full API responses in JSONB. Caching 2000 parcel scans means storing 2000 × ~5KB = 10MB per scan in single rows. TOAST storage kicks in at 2KB, causing 2-10× query slowdown. After 100 scans, cache table becomes multi-GB with degraded performance on cache lookups.

**Why it happens:**
Current per-property cache works well (one cache_key = one property). Naive extension to area scans stores entire scan result as single cache_key ("area:bbox:..."). The JSONB document grows from 5KB (single property) to 10MB+ (2000 properties), exceeding PostgreSQL TOAST thresholds and causing severe performance degradation.

**How to avoid:**
1. **Don't cache area scan results as single JSONB** - Cache individual parcels only
2. Store scan metadata separately (scan_id, bbox, timestamp, status)
3. Link individual parcel caches to scan via junction table
4. Implement cache eviction policy (LRU, size-based) before hitting GB scale
5. Monitor TOAST usage: `SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class WHERE relname = 'cached_api_responses'`
6. Consider pg_toast compression settings for JSONB columns

**Warning signs:**
- Cache queries taking >200ms (normal: <50ms for indexed lookup)
- `pg_toast` tables growing to multi-GB sizes
- `EXPLAIN ANALYZE` showing "TOAST fetch" operations dominating query time
- Database connection pool exhaustion during scan operations
- Sudden performance cliff after X scan operations

**Phase to address:**
Phase 18.3 (Area Scan Caching) - Architecture decision required. Also address in Phase 18.6 (Performance Optimization) for monitoring.

---

### Pitfall 3: EPSG Coordinate Mismatch Between Systems

**What goes wrong:**
Dutch government APIs return geometries in EPSG:28992 (RD New), MapLibre expects EPSG:4326 (WGS84), and web mercator tiles use EPSG:3857. Forgetting to transform coordinates causes properties to appear in wrong locations (off by kilometers) or MapLibre failing to render polygons entirely.

**Why it happens:**
Each API uses different coordinate systems: BAG/PDOK use RD (28992), DSO sometimes uses WGS84 (4326), MapLibre requires WGS84 for GeoJSON. Developers assume all Dutch data is RD, but mixing sources causes silent mismatches. Coordinate values look plausible (both systems use meters/degrees) so incorrect rendering isn't immediately obvious on small scales.

**How to avoid:**
1. Standardize on single internal CRS: EPSG:4326 for GeoJSON, EPSG:28992 for PostGIS storage
2. Transform at API boundary: Parse CRS from WFS response, transform to 4326 before caching
3. Use pyproj/shapely with explicit CRS: `transformer = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)`
4. Include CRS metadata in cached geometries for debugging
5. Validate transformed coordinates: Netherlands bbox is roughly [50.7, 3.2, 53.6, 7.2] in EPSG:4326
6. Test with known landmark coordinates in both systems

**Warning signs:**
- Properties rendering in ocean or outside Netherlands bounding box
- MapLibre console errors: "Coordinate is out of bounds"
- Geometry precision issues (coordinates with 10+ decimal places)
- Polygons rendering at wrong zoom levels (size mismatch indicates CRS error)
- Different APIs returning geometries that don't align when overlayed

**Phase to address:**
Phase 18.2 (WFS Integration) - Must define CRS transformation pipeline before caching any geometries.

---

### Pitfall 4: Multi-Tenant Area Scan Cache Isolation Broken

**What goes wrong:**
Cached area scan results are shared across organizations (to save API costs), but cache keys don't include organization_id. Organization A scans area, result cached. Organization B scans same area, gets Organization A's cached data including metadata like "scanned_by", "project_id". Privacy leak and incorrect data associations occur.

**Why it happens:**
Developer reasons "government data is public, so sharing cache across tenants is fine." But cache includes not just raw API responses, but enriched data with tenant-specific metadata (which project, which user, custom tags). Existing cache_manager.py requires organization_id, but area scan code might skip it to enable sharing.

**How to avoid:**
1. **Always include organization_id in cache keys** even for "shared" government data
2. Separate caching layers: Raw API responses (shareable) vs. enriched results (tenant-isolated)
3. Use cache key pattern: `raw:bag:parcel:{parcel_id}` (shared) vs `enriched:{org_id}:scan:{scan_id}` (isolated)
4. Audit cache_manager.py calls to verify organization_id always provided
5. Add database constraint verification: RLS policies on cached_api_responses table
6. Monitor for cache keys missing organization_id pattern

**Warning signs:**
- Cache hit rate suspiciously high (>90%) across different organizations
- Metadata fields (created_by, project_id) showing wrong user/project
- RLS violations in logs: "UPDATE/DELETE on cached_api_responses failed RLS check"
- Integration tests showing Organization B can access Organization A's scan results

**Phase to address:**
Phase 18.3 (Area Scan Caching) - Critical security decision. Must be correct from first implementation.

---

### Pitfall 5: Invalid Geometries from Government APIs Break Spatial Operations

**What goes wrong:**
BAG/DSO WFS services occasionally return invalid geometries (self-intersecting polygons, unclosed rings, topology errors). When passed to Shapely/PostGIS for spatial operations (contains, intersects), they raise GEOS TopologyException, crashing the scan pipeline. 1 invalid parcel out of 2000 fails entire area scan.

**Why it happens:**
Government data isn't always topologically valid. Municipal updates can create edge cases (parcel splits, merges). WFS GML→WKT conversion can introduce precision errors. Shapely/GEOS enforce strict topology rules that source data violates. Developers test with clean data, production hits edge cases.

**How to avoid:**
1. Validate all geometries immediately after WFS parsing: `geometry.is_valid`
2. Auto-repair invalid geometries: `shapely.make_valid()` (requires GEOS >=3.10, shapely >=2.1)
3. Use 'structure' repair method to preserve topology
4. Log validation failures for monitoring (track which parcels/sources produce invalid data)
5. Implement fallback: Skip invalid parcel but continue scan (don't fail entire operation)
6. Store validation status in cache: `{"geometry": {...}, "validation": {"is_valid": false, "error": "Self-intersection"}}`

**Warning signs:**
- GEOS errors in logs: "TopologyException", "IllegalArgumentException"
- Shapely warnings: "Invalid geometry"
- Area scans failing inconsistently on same bbox (different parcels returned)
- PostGIS queries returning NULL for geometry operations
- Geometry simplification creating invalid output even with `preserve_topology=True`

**Phase to address:**
Phase 18.2 (WFS Integration) - Validation pipeline must be built into WFS parser, not added later.

---

### Pitfall 6: Parallel API Requests Exhaust Rate Limits

**What goes wrong:**
Scanning 2000 parcels requires 2000 API calls (one per parcel for detailed zoning/monument data). Developer implements `asyncio.gather()` to parallelize, spawning 2000 concurrent requests. PDOK rate limiter triggers HTTP 429, DSO blocks IP, BRK API costs spike. Scan fails or incurs unexpected charges.

**Why it happens:**
Government APIs have undocumented rate limits (DSO: ~10 req/s, PDOK: ~50 req/s). Naive parallelization (`asyncio.gather(*[fetch(p) for p in parcels])`) creates thundering herd. Developer tests with 50 parcels (works fine), production scans 2000 parcels (rate limit). Each API has different limits; no unified rate limiter.

**How to avoid:**
1. Implement per-API rate limiting with asyncio.Semaphore: `semaphore = asyncio.Semaphore(10)  # Max 10 concurrent`
2. Use aiometer or custom token bucket: `async for result in aiometer.run_all(tasks, max_per_second=10)`
3. Configure per-API limits: BAG=50, DSO=10, BRK=5 concurrent requests
4. Implement exponential backoff on 429 responses
5. Use asyncio.Queue for request queuing across worker tasks
6. Monitor rate limit headers in responses: `X-RateLimit-Remaining`, `Retry-After`

**Warning signs:**
- HTTP 429 errors in logs during parallel scans
- Sporadic API failures that resolve after waiting
- Increasing error rates as scan size grows
- API responses returning "Service Temporarily Unavailable"
- BRK API costs exceeding budget estimates

**Phase to address:**
Phase 18.2 (WFS Integration) for pagination, Phase 18.5 (Parallel Processing) for rate limiting strategy.

---

### Pitfall 7: MapLibre Memory Exhaustion Rendering 2000+ Polygons

**What goes wrong:**
Loading 2000 parcels as GeoJSON FeatureCollection (10MB+) into MapLibre causes browser tab to freeze/crash on mobile. Re-rendering on pan/zoom causes jank. Browser DevTools shows memory climbing to 500MB+. UX becomes unusable.

**Why it happens:**
MapLibre GL JS is optimized for vector tiles, not massive GeoJSON. Loading 2000 complex polygons as single source bypasses tile-based rendering. Every pan/zoom triggers full re-render. Mobile browsers have limited memory (512MB-1GB), desktop can handle it but slowly.

**How to avoid:**
1. **Use vector tiles, not GeoJSON** for area scan results >100 parcels
2. Generate tiles server-side with Martin (PostGIS→MVT) or Tegola
3. Set appropriate maxZoom on GeoJSON sources (e.g., 12) to reduce precision at high zoom
4. Implement clustering for overview zoom levels (zoom <10)
5. Use simplifyGeoJSON or Turf.js to reduce polygon complexity based on zoom level
6. Lazy-load: Only render parcels in current viewport + buffer
7. Consider feature reduction: show simplified parcels at low zoom, detailed on click

**Warning signs:**
- Browser "Page Unresponsive" warnings during map load
- Frame rate drops below 30fps during pan/zoom
- Mobile browsers crashing on scan result load
- MapLibre performance warnings in console
- Memory usage >200MB for single map instance

**Phase to address:**
Phase 18.6 (Frontend Integration - Map Rendering) - Vector tiles decision required upfront, hard to retrofit later.

---

### Pitfall 8: GML Version Inconsistencies Between WFS Services

**What goes wrong:**
BAG API returns GML3 by default (WFS 2.0), DSO returns GML2 (WFS 1.0), parsing library expects consistent format. Geometry parsing fails on DSO responses with errors like "Unknown GML namespace". Developer builds parser for GML3, breaks on GML2.

**Why it happens:**
WFS version determines default GML version: WFS 1.0→GML2, WFS 1.1/2.0→GML3. Different agencies use different WFS versions. GML2 vs GML3 have different SRS specifications (epsg.xml#XXXX vs urn:x-ogc:def:crs:EPSG:XXXX) and geometry encoding. Single lxml parser can't handle both without namespace handling.

**How to avoid:**
1. Request specific output format: `outputFormat=application/json` instead of GML where supported
2. Use OGR/GDAL for WFS parsing (handles both GML versions transparently)
3. If using lxml: Implement namespace-aware parsing with `nsmap` handling
4. Explicitly request GML version in WFS params: `outputFormat=gml3` or `gml2`
5. Test against all target APIs (BAG, DSO, PDOK) not just one
6. Fall back to alternative format (GeoJSON) if GML parsing fails

**Warning signs:**
- lxml parsing errors: "Namespace not found", "Unknown element"
- Geometry extraction working for BAG but failing for DSO
- SRS parsing returning None or wrong EPSG code
- FeatureCollection parsing succeeding but features empty
- Different WFS services requiring different parsing code paths

**Phase to address:**
Phase 18.2 (WFS Integration) - Parser must support multiple GML versions from start.

---

### Pitfall 9: Long-Running Scans Timeout Without Progress Feedback

**What goes wrong:**
Scanning 2000 parcels takes 5-10 minutes (rate-limited parallel requests). User clicks "Scan Area", sees loading spinner, waits 2 minutes, assumes it's broken, clicks again. Multiple scans start in parallel. No progress indication, no timeout handling. User frustration, duplicate API costs.

**Why it happens:**
Area scan is long-running background task but implemented as synchronous HTTP request. HTTP clients timeout at 30-60 seconds by default. No WebSocket/SSE for progress updates. Frontend shows binary state (loading/done), not progress. Backend has no job queue—scan runs in request context.

**How to avoid:**
1. Implement background job queue (Arq already in project, use it for area scans)
2. Return job_id immediately, poll for status: `POST /scans → {scan_id}`, `GET /scans/{id}/status → {progress: 40%, status: "scanning"}`
3. Use Server-Sent Events for progress streaming: `EventSource` in frontend, `yield` in FastAPI
4. Implement progress tracking: `{total: 2000, completed: 800, failed: 5, current_phase: "fetching_zoning"}`
5. Set realistic timeouts: Background job timeout (15 min), HTTP timeout (60s), show "background processing" message
6. Prevent duplicate scans: Check for existing in-progress scan on same area before starting new one

**Warning signs:**
- User support tickets: "Area scan never finishes"
- High rate of timeout errors in logs
- Multiple concurrent scans for same user/area in database
- API cost spikes from duplicate scan attempts
- Frontend spinner showing indefinitely with no feedback

**Phase to address:**
Phase 18.4 (Background Job Processing) - Must be implemented before frontend integration. UX refinement in Phase 18.7.

---

### Pitfall 10: Dubbele Bestemming (Multiple Zoning) Creates Data Model Confusion

**What goes wrong:**
Single parcel has multiple bestemmingen: primary zoning "Wonen" + overlay "Waarde-Archeologie" + "Waterstaat-Waterkering". Database schema assumes one zoning per parcel. Frontend displays only first zoning. Opportunity scoring misses archaeological restrictions, fails to flag flood defense constraints.

**Why it happens:**
Developers familiar with US zoning (one zone per parcel) don't understand Dutch system allows multiple overlapping designations. DSO API returns array of bestemmingen, developer takes [0] and stores in single field. Data model has `parcel.zoning` (singular) not `parcel.zonings` (plural). Frontend filters/scoring logic doesn't account for overlay restrictions.

**How to avoid:**
1. Data model: `zonings` as JSONB array, not single `zoning` string
2. Parse all bestemmingen from DSO response, store complete list with types (primair, dubbelbestemming)
3. Frontend: Show all zonings, distinguish primary vs overlay visually
4. Opportunity scoring: Check ALL zonings for restrictions, not just primary
5. Document Dutch zoning semantics in code comments and schema
6. Test with parcels known to have dubbele bestemmingen (archaeological areas, waterkeringen)

**Warning signs:**
- Opportunity scores flagging parcels as "developable" that have archaeological/heritage overlays
- User reports: "App says I can build but municipality says no"
- Zoning data not matching DSO ruimtelijkeplannen.nl for same parcel
- Database contains only single zoning per parcel (should be ~30% with multiple)
- Archaeological survey requirements not appearing in reports

**Phase to address:**
Phase 18.8 (Opportunity Scoring) - Data model decision in Phase 18.3 (Caching schema), scoring logic here.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store entire scan as single JSONB cache entry | Simple cache implementation, one DB row per scan | TOAST bloat, 10× query slowdown, cache unusable at scale | Never - costs too high |
| Skip WFS pagination, rely on 1000-feature limit | Faster development, simpler code | Silent data loss on large areas, broken production scans | Never - data integrity critical |
| Use GeoJSON instead of vector tiles for map | No tile generation infrastructure needed | Browser memory issues, poor mobile UX | Only for MVP with <100 parcels, migrate by Phase 18.6 |
| Synchronous scan endpoint instead of background jobs | No job queue setup, simpler architecture | Timeouts, poor UX, duplicate scans | Only for early prototype, must migrate before beta |
| Hardcode rate limits instead of dynamic configuration | No need to research per-API limits | API blocks, 429 errors in production | Never - API stability critical |
| Skip geometry validation/repair | Faster WFS parsing | Random GEOS crashes on invalid parcels | Never - reliability critical |
| Share area scan cache across tenants | Lower API costs, better cache hit rate | Privacy leaks, GDPR violation | Never - security/legal risk |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BAG WFS | Assume all requests return all features | Always check `numberOfFeatures`, implement pagination for counts >800 |
| DSO Ruimtelijkeplannen | Store only primary bestemming | Parse and store all bestemmingen (primary + dubbelbestemmingen) as array |
| PDOK Cadastral | Assume EPSG:28992 throughout | Parse `srsName` from GML, transform to 4326 for cache/GeoJSON |
| BRK Bevragen | Treat as free API like PDOK | Track API call costs per organization, implement budget alerts |
| Open Raadsinformatie | Scrape HTML from officielebekendmakingen.nl | Use ORI API, respect robots.txt, check license for commercial use |
| All WFS services | Single GML parser for all sources | Handle both GML2 and GML3, or request JSON output format |
| Area scan cache | Use existing per-property cache pattern | Separate architecture for bulk results (junction table, not single JSONB) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading 2000-parcel GeoJSON in MapLibre | Browser freeze, mobile crash, 500MB+ memory | Use vector tiles (Martin/Tegola) or clustering | >200 complex polygons |
| JSONB cache documents >2KB | Query slowdown 2-10×, TOAST fetch overhead | Split large documents, cache individual parcels | Single JSONB >2KB |
| Unbounded parallel API requests | HTTP 429 rate limit errors | Semaphore rate limiting (10-50 concurrent max) | >50 concurrent requests |
| Sequential parcel enrichment | 2000 parcels × 1s = 33 minutes scan time | Parallel with rate limiting: 2000 parcels ÷ 10 concurrent ÷ 0.5s = 100s | >100 parcels sequentially |
| PostGIS spatial query without index | Full table scan, multi-second queries | GIST index on geometry columns, use bbox filter first | >10k geometries in table |
| Shapely in-memory for all parcels | Memory leak, 1GB+ Python process | Stream processing, process in batches of 100 | >1000 geometries in memory |
| Frontend re-rendering all parcels on filter | UI jank, React re-render cascade | Virtualization, memoization, vector tiles | >500 features in React state |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sharing area scan cache across organizations without tenant isolation | GDPR violation, data leak, metadata exposure | Always include organization_id in cache keys, verify RLS policies |
| Storing BRK eigendomsgegevens (ownership data) in multi-tenant cache | Personal data (AVG/GDPR) exposure between tenants | Separate storage for personal data, strict RLS, encryption at rest |
| Scraping officielebekendmakingen.nl without checking robots.txt | IP block, legal issues, ToS violation | Use Open Raadsinformatie API, respect rate limits and licensing |
| Exposing API cost tracking without tenant isolation | Organization A sees Organization B's API usage/costs | Per-tenant cost tracking, RLS on usage_metrics table |
| Caching BRK data without tracking data subject rights | Unable to comply with GDPR deletion requests | Track which cache entries contain personal data, implement deletion cascade |
| Allowing unlimited area scans without rate limiting | DoS vector, API cost attack, resource exhaustion | Per-tenant scan rate limiting, maximum scan area/parcel limits |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication on long scans | User assumes broken, clicks again, duplicate scans | Progress bar with phase: "Fetching parcels... 800/2000" |
| Empty area scan results without explanation | User confused why area has no data | Differentiate: "No parcels found" vs "All parcels filtered out" vs "API error" |
| Showing stale cached data without age indication | User makes decisions on outdated zoning info | Show cache age prominently: "Data from 2 weeks ago - Refresh?" |
| Opportunity score without explanation | User doesn't trust score, ignores feature | Show scoring factors: "Score: 8/10 - Zoning: Wonen (✓), Archeologie: None (✓), Monuments: 1 nearby (−2)" |
| Map rendering 2000 polygons at low zoom | Slow, cluttered, unusable | Cluster at low zoom, show individual parcels at zoom >12 |
| Error message "GEOSTopologyException" | User has no idea what this means | User-friendly: "Property data contains invalid geometry - this parcel was skipped" |
| No indication of multiple bestemmingen | User sees only primary zoning, misses restrictions | Badge: "Wonen +2 more" with tooltip showing overlay zonings |

## "Looks Done But Isn't" Checklist

- [ ] **WFS Pagination:** Often missing when tested with small areas — verify pagination triggers at 800 features, not 1000
- [ ] **Coordinate Transformation:** Often missing EPSG handling — verify test includes RD→WGS84 transform and checks output coordinates in correct range
- [ ] **Geometry Validation:** Often missing validation on happy path — verify test includes invalid geometry case and auto-repair
- [ ] **Rate Limiting:** Often missing when tested sequentially — verify load test with 500+ concurrent requests confirms rate limiter works
- [ ] **Multi-tenant Cache Isolation:** Often missing in dev (single tenant) — verify integration test confirms Org A cannot access Org B's cached scan results
- [ ] **Progress Updates:** Often missing WebSocket/SSE connection — verify long-running scan sends incremental progress, not just start/done
- [ ] **Dubbele Bestemming Handling:** Often missing complex zoning cases — verify test parcel with 3+ zonings shows all in UI and scoring
- [ ] **Vector Tile Rendering:** Often works with GeoJSON in dev — verify production uses MVT, not GeoJSON, for 1000+ parcel scans
- [ ] **TOAST Storage Monitoring:** Often missing until production bloat — verify monitoring alert triggers when TOAST tables exceed threshold
- [ ] **BRK Cost Tracking:** Often missing per-tenant accounting — verify Organization A's BRK calls don't count toward Organization B's budget

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| JSONB bloat from large cache entries | MEDIUM | 1. Stop writes, 2. Export data, 3. Redesign schema with junction table, 4. Migrate data, 5. VACUUM FULL (downtime required) |
| Silent WFS truncation data loss | MEDIUM | 1. Identify affected scans (exactly 1000/2000 features), 2. Invalidate cache, 3. Re-scan with pagination, 4. Notify affected users |
| Coordinate system mismatch | LOW | 1. Identify affected cache entries (coordinates outside NL bbox), 2. Invalidate, 3. Re-fetch with correct CRS transformation |
| Shared cache tenant isolation breach | HIGH | 1. Immediate: Invalidate all area scan cache, 2. Audit data access logs, 3. GDPR breach notification if personal data exposed, 4. Redesign cache keys, 5. Migrate to tenant-isolated architecture |
| Rate limit API block | MEDIUM | 1. Implement exponential backoff, 2. Contact API provider to unblock IP, 3. Add rate limiter to prevent recurrence, 4. Resume scans in batches |
| Invalid geometry crashes | LOW | 1. Add geometry validation to pipeline, 2. Auto-repair with make_valid(), 3. Re-process failed scans |
| MapLibre memory exhaustion | HIGH (if GeoJSON architecture) | 1. Implement vector tile generation (Martin), 2. Migrate frontend to MVT source, 3. May require significant frontend refactor |
| Missing dubbele bestemmingen | MEDIUM | 1. Update data model to array, 2. Re-fetch all zoning data, 3. Update opportunity scoring logic, 4. Re-calculate all scores |
| Background job timeout | LOW | 1. Move to Arq job queue, 2. Return job_id instead of results, 3. Add polling endpoint, 4. Update frontend to poll for status |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WFS 1000-feature limit truncation | Phase 18.2 (WFS Integration) | Integration test: Scan area with 1500+ parcels, verify all returned |
| JSONB cache bloat | Phase 18.3 (Caching Architecture) | Design review: Cache schema supports individual parcel entries, not bulk scans |
| EPSG coordinate mismatches | Phase 18.2 (WFS Integration) | Unit test: RD coordinates transform to valid WGS84 range for Netherlands |
| Multi-tenant cache isolation | Phase 18.3 (Caching) + Phase 18.1 (Multi-tenant design) | Integration test: Org A cannot retrieve Org B's scan via cache |
| Invalid geometries from WFS | Phase 18.2 (WFS Integration) | Unit test: Invalid geometry auto-repaired with make_valid() |
| Parallel request rate limiting | Phase 18.5 (Parallel Processing) | Load test: 500 concurrent requests stay below API rate limit |
| MapLibre memory exhaustion | Phase 18.6 (Map Rendering) | Performance test: 2000 parcels render in <3s, memory <200MB |
| GML version inconsistencies | Phase 18.2 (WFS Integration) | Integration test: Parser handles both GML2 (DSO) and GML3 (BAG) |
| Long-running scan timeouts | Phase 18.4 (Background Jobs) | Integration test: 10-minute scan completes via Arq, returns job status |
| Dubbele bestemming data loss | Phase 18.8 (Opportunity Scoring) | Integration test: Parcel with 3 bestemmingen stores all, scoring checks all |

## Sources

### Dutch Government API Documentation
- [PDOK WFS Documentation](https://www.pdok.nl/wfs) - WFS maxFeatures, pagination best practices
- [PDOK NGR Handleidingen](https://pdok-ngr.readthedocs.io/handleidingen.html) - Count parameter, startIndex usage
- [Kadaster BRK Bevragen API](https://kadaster.github.io/BRK-bevragen/) - Authentication, PKI requirements
- [DSO Ruimtelijke Plannen API](https://apis.developer.overheid.nl/apis/dso-ruimtelijke-plannen-opvragen) - REST API structure
- [Open Raadsinformatie GitHub](https://github.com/openstate/open-raadsinformatie) - License: MIT/LGPL

### Technical Research
- [WFS Paging Support](https://github.com/eblondel/ows4R/issues/29) - Pagination workarounds, sortBy requirements
- [GeoServer WFS Basics](https://docs.geoserver.org/main/en/user/services/wfs/basics.html) - GML2 vs GML3 differences
- [Postgres JSONB Performance](https://pganalyze.com/blog/5mins-postgres-jsonb-toast) - TOAST thresholds, performance cliffs
- [MapLibre Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) - Vector tiles, clustering, maxZoom optimization
- [Martin Vector Tile Server](https://github.com/maplibre/martin) - PostGIS→MVT performance (2-3× faster than alternatives)
- [GeoPandas Performance](https://github.com/geopandas/geopandas/issues/2395) - Shapely vs PostGIS performance comparison
- [Shapely Geometry Validation](https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoSeries.make_valid.html) - make_valid() structure algorithm

### Multi-Tenant Architecture
- [Multi-Tenant Caching Strategies](https://medium.com/@okan.yurt/multi-tenant-caching-strategies-why-redis-alone-isnt-enough-hybrid-pattern-f404877632e5) - Tenant isolation patterns
- [OWASP Multi-Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) - RLS, data isolation
- [Azure Cache for Redis Multitenancy](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/service/cache-redis) - Key prefixing, tenant separation

### Rate Limiting & Async Python
- [Python Async Rate Limiting](https://scrapfly.io/blog/posts/how-to-rate-limit-asynchronous-python-requests) - Semaphore, aiometer patterns
- [httpx Rate Limiting](https://github.com/encode/httpx/discussions/1933) - aiolimiter integration
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/) - Progress updates via WebSocket
- [FastAPI SSE](https://medium.com/@inandelibas/real-time-notifications-in-python-using-sse-with-fastapi-1c8c54746eb7) - Server-Sent Events for progress

### Dutch Spatial Data
- [EPSG:28992 RD New](https://epsg.io/28992) - TOWGS84 parameters, transformation accuracy
- [3DBAG Data Sources](https://docs.3dbag.nl/en/overview/sources/) - BAG data quality, municipality update lag
- [Bestemmingsplan Dubbele Bestemming](https://www.caddesk.nl/kennisbankartikel/wat-betekent-de-dubbelbestemming-in-het-bestemmingsplan/) - Dutch overlay zoning semantics
- [BAG Data Quality Issues](https://data.4tu.nl/articles/dataset/3D_Registration_of_Buildings_and_Addresses_BAG_2020/13088933/1) - Address coverage gaps (90% vs 70%), demolished buildings lag

### GeoJSON & Memory Optimization
- [GeoJSONL Format](https://www.interline.io/blog/geojsonl-extracts/) - Line-delimited for memory-efficient streaming
- [Optimizing Large GeoJSON](https://open-innovations.org/blog/2023-07-25-tips-for-optimising-geojson-files) - Whitespace removal, property reduction
- [GeoPandas Chunked Processing](https://github.com/geopandas/geopandas/issues/2782) - Chunk iteration to reduce peak memory

---
*Pitfalls research for: Area Intelligence Features (Dutch Property Platform v3.0)*
*Researched: 2026-02-10*
*Confidence: MEDIUM-HIGH (web search verified, Dutch API specifics from official docs, some details may need validation during implementation)*
