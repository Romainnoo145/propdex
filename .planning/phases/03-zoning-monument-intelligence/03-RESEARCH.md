# Phase 3: Zoning & Monument Intelligence - Research

**Researched:** 2026-02-07
**Domain:** Dutch government spatial planning and cultural heritage APIs
**Confidence:** MEDIUM

## Summary

This phase enriches property intelligence reports with bestemmingsplan (zoning) data and monument/heritage status from Dutch government sources. The research reveals a transitioning ecosystem: the legacy Ruimtelijkeplannen.nl system is being replaced by the DSO (Digitaal Stelsel Omgevingswet) APIs, requiring a dual-API strategy with fallback. Monument data is available from three authoritative sources (RCE, BAG, Kadaster) via different API types.

The standard approach is to: (1) query DSO Ruimtelijke Plannen API v4 for spatial plans using coordinate-based POST requests with GeoJSON bodies, (2) fall back to legacy WFS services when DSO returns no results, (3) query RCE Solr API and check BAG/Kadaster fields for monument status from all three sources, (4) prepare GeoJSON geometry data in API responses for frontend map rendering with PDOK BRT Achtergrondkaart tiles, and (5) apply 90-day cache TTL for zoning data (already configured in CACHE_TTL).

The key technical challenge is that zoning APIs return geometry features (bestemmingsvlakken, bouwvlakken, maatvoeringen) requiring spatial intersection with property coordinates to extract relevant rules. Monument APIs are simpler but require reconciling potentially conflicting data from three sources.

**Primary recommendation:** Use httpx AsyncClient with asyncio.gather for parallel monument source fetching (follows Phase 2 pattern), implement spatial query POST requests to DSO API with EPSG:28992 RD coordinates (avoid coordinate transformation overhead), and structure responses with section-level source attribution and freshness timestamps.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Zoning API Strategy:**
- Both DSO (Omgevingswet) and Ruimtelijkeplannen.nl with fallback — try new DSO first, fall back to legacy Ruimtelijkeplannen.nl to cover the transition period

**Monument Sources:**
- RCE + BAG + Kadaster — check all three for comprehensive coverage

**Conflict Handling:**
- Show each source's answer side-by-side, note discrepancy — not a hard warning, but clear enough that users see the disagreement

**Map Tiles:**
- PDOK tiles (BRT Achtergrondkaart) — official Dutch government tiles, free, no API key

**Source Attribution:**
- Source attribution at section level — each report section (zoning, monuments, kadaster) gets a "Sources" footer, not per-field labels

**Freshness Display:**
- Freshness timestamps per section — "Laatst bijgewerkt: 3 uur geleden" so users see exactly how fresh each data source is

**Report Refresh:**
- Full report refresh — one "Vernieuwen" button to re-fetch everything from government APIs, bypassing cache

**Priority Zoning Fields:**
- Permitted function (bestemming) and building dimensions (max height, coverage, floor area ratio) are the headline data — these are the deal-makers for developers
- Show what's available, mark gaps explicitly ("Not specified in plan")

### Claude's Discretion

- Zoning data layout structure (grouped sections vs summary card)
- Monument restriction display format (plain language vs structured checklist)
- Rijksmonument vs gemeentelijk visual treatment
- Map rendering approach (data-only API vs static image) — likely prepare coordinates + geometry data in API response for future frontend rendering
- Map interactivity level
- Whether to show confidence indicators on API-sourced data in Phase 3 (to prepare for Phase 4's mandatory LOW/MEDIUM/HIGH)

### Deferred Ideas (OUT OF SCOPE)

- Auto-mailing perceel owners for missing data
- Per-section refresh buttons (currently: full report refresh only)

</user_constraints>

## Standard Stack

### Core Government APIs

| API | Version | Purpose | Why Standard |
|-----|---------|---------|--------------|
| DSO Ruimtelijke Plannen API | v4 | Query spatial plans (bestemmingsplan) by coordinates | Official Omgevingswet replacement for Ruimtelijkeplannen.nl, REST+JSON with GeoJSON geometries |
| RCE Rijksmonumenten API | Solr | Query rijksmonument status by location or monument number | Official cultural heritage registry from Rijksdienst voor het Cultureel Erfgoed |
| PDOK BRT Achtergrondkaart | OGC API v1 | Map tiles for location visualization | Official government basemap, free, CC BY 4.0 license |
| BAG API | v2 (existing) | Monument status fields in verblijfsobject | Already integrated in Phase 2, includes monument indicators |
| PDOK Cadastral | OGC v1 (existing) | Parcel geometry and monument fields | Already integrated in Phase 2 |

**DSO API Base URL:** `https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4`
**RCE API Base URL:** `https://api.rijksmonumenten.info/select/`
**BRT Tiles Base URL:** `https://api.pdok.nl/kadaster/brt-achtergrondkaart/ogc/v1`

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shapely | 2.x | GeoJSON geometry operations, point-in-polygon queries | Spatial intersection to match property coordinates with zoning polygons |
| geojson | 3.x | GeoJSON parsing and validation | Parse DSO API responses, validate geometry structures |
| pyproj | 3.7+ | Coordinate system transformations EPSG:28992 ↔ WGS84 | Only if frontend requires WGS84; prefer RD for all Dutch APIs |

**Note:** GeoPandas is NOT recommended for this use case — adds heavyweight dependencies (pandas, matplotlib) for simple point-in-polygon checks that shapely handles directly.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DSO REST API | Legacy WFS service | WFS returns GML (XML-based), harder to parse; REST API returns JSON+GeoJSON; use WFS only as fallback |
| Shapely for spatial queries | PostGIS spatial queries | PostGIS requires storing geometry in database; shapely works in-memory with API responses; use shapely unless caching geometries long-term |
| RCE Solr API | RCE Linked Data API | Linked Data API is RDF/SPARQL, more complex; Solr API returns JSON with simpler queries |

**Installation:**
```bash
# Add to backend requirements
shapely>=2.0.0
geojson>=3.0.0
pyproj>=3.7.0  # Only if coordinate transformation needed
```

## Architecture Patterns

### Recommended API Client Structure

```
backend/app/government_apis/
├── dso_spatial_plans.py         # DSO Ruimtelijke Plannen v4 client
├── rce_monuments.py             # RCE Rijksmonument Solr API client
├── pdok_brt_tiles.py            # BRT Achtergrondkaart tile URL generator (optional)
├── bag_api.py                   # Existing - extend with monument fields
├── pdok_cadastral.py            # Existing - extend with monument fields
└── base.py                      # Existing - shared error handling
```

### Pattern 1: Spatial Query with POST + GeoJSON Body

**What:** DSO API requires POST requests with GeoJSON body for location-based queries
**When to use:** All spatial plan queries by property coordinates
**Example:**

```python
# Source: https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/openapi.yaml
async def find_plans_by_point(
    self,
    x: float,  # EPSG:28992 RD coordinates
    y: float,
    client: httpx.AsyncClient,
) -> list[dict]:
    """Find spatial plans at location using POST with GeoJSON body."""
    url = f"{self.BASE_URL}/plannen/_zoek"

    headers = {
        "Content-Type": "application/json",
        "Content-Crs": "EPSG:28992",  # Specify input coordinate system
        "Accept-Crs": "EPSG:28992",   # Request output in same CRS
    }

    # GeoJSON Point body for spatial query
    body = {
        "type": "Point",
        "coordinates": [x, y]
    }

    response = await client.post(url, headers=headers, json=body, timeout=30.0)
    data = handle_api_response(response, source="dso-spatial-plans")

    # HAL+JSON response format
    plans = data.get("_embedded", {}).get("plannen", [])
    return plans
```

**Key insights:**
- DSO uses HAL+JSON format with `_embedded` and `_links` structures
- POST method required for spatial queries (not GET with query params)
- `Content-Crs` and `Accept-Crs` headers control coordinate systems
- EPSG:28992 (RD New) is native system for all Dutch spatial data

### Pattern 2: Parallel Monument Source Fetching with asyncio.gather

**What:** Query monument status from 3 sources simultaneously
**When to use:** Monument data aggregation (RCE + BAG + Kadaster)
**Example:**

```python
# Source: Existing pattern from property_aggregator.py
async def fetch_monument_status(
    coordinates: tuple[float, float],  # RD coordinates
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> MonumentStatusResponse:
    """Fetch monument status from all three sources in parallel."""

    x, y = coordinates

    # Define fetch coroutines
    async def fetch_rce():
        cache_key = f"rce:monument:{x}:{y}"
        return await get_cached_or_fetch(
            cache_key=cache_key,
            source="rce",  # Add to CACHE_TTL config
            organization_id=organization_id,
            fetch_fn=lambda: rce_client.query_by_location(x, y, client),
            session=session,
        )

    async def fetch_bag_monument_field():
        # BAG verblijfsobject may have monument indicators
        # Use existing BAG data from Phase 2 aggregation
        return bag_data.get("monumentStatus")  # Field name TBD

    async def fetch_kadaster_monument_field():
        # Kadaster parcel may have monument indicators
        return cadastral_data.get("monumentStatus")  # Field name TBD

    # Execute in parallel with exception handling
    results = await asyncio.gather(
        fetch_rce(),
        fetch_bag_monument_field(),
        fetch_kadaster_monument_field(),
        return_exceptions=True,
    )

    # Process results and detect conflicts
    rce_result, bag_result, kadaster_result = results

    # Conflict detection: compare sources
    sources = []
    if not isinstance(rce_result, Exception):
        sources.append(DataSourceInfo(source="RCE", status=rce_result))
    if bag_result:
        sources.append(DataSourceInfo(source="BAG", status=bag_result))
    if kadaster_result:
        sources.append(DataSourceInfo(source="Kadaster", status=kadaster_result))

    # Detect disagreements
    statuses = {s.status for s in sources if s.status}
    has_conflict = len(statuses) > 1

    return MonumentStatusResponse(
        sources=sources,
        has_conflict=has_conflict,
        conflict_note="Monument status differs across sources" if has_conflict else None,
    )
```

### Pattern 3: Spatial Intersection for Zoning Rule Extraction

**What:** Find which zoning polygons contain property point, extract rules
**When to use:** DSO returns bestemmingsvlakken/bouwvlakken geometries, need to filter relevant ones
**Example:**

```python
# Source: GeoPandas point-in-polygon patterns
from shapely.geometry import Point, shape

async def extract_zoning_rules(
    plan_id: str,
    property_coords: tuple[float, float],
    client: httpx.AsyncClient,
) -> dict:
    """Extract zoning rules for property by spatial intersection."""

    x, y = property_coords
    property_point = Point(x, y)

    # Fetch zoning geometries with expand=geometrie
    url = f"{self.BASE_URL}/plannen/{plan_id}/bestemmingsvlakken"
    params = {"expand": "geometrie,teksten"}  # Include texts for permitted uses

    response = await client.get(url, params=params, timeout=30.0)
    data = handle_api_response(response, source="dso-spatial-plans")

    bestemmingsvlakken = data.get("_embedded", {}).get("bestemmingsvlakken", [])

    # Find polygons containing property
    relevant_zones = []
    for zone in bestemmingsvlakken:
        geometry_data = zone.get("geometrie")
        if not geometry_data:
            continue

        # Convert GeoJSON to Shapely geometry
        zone_polygon = shape(geometry_data)

        # Spatial intersection check
        if zone_polygon.contains(property_point):
            relevant_zones.append({
                "bestemming": zone.get("naam"),  # Permitted function
                "teksten": zone.get("_embedded", {}).get("teksten", []),
                "geometry": geometry_data,  # For frontend rendering
            })

    # Fetch building dimensions (bouwvlakken, maatvoeringen)
    # Similar pattern for building heights, coverage ratios, etc.

    return {
        "zones": relevant_zones,
        "building_rules": await _fetch_building_rules(plan_id, property_point, client),
    }
```

**Key insights:**
- Shapely's `shape()` converts GeoJSON to geometry objects
- `.contains()` method performs point-in-polygon check
- `expand=geometrie,teksten` parameter fetches related data in single request
- Store original GeoJSON for frontend map rendering

### Pattern 4: Section-Level Source Attribution with Freshness

**What:** Extend existing DataSourceInfo pattern with per-section timestamps
**When to use:** All Phase 3 API responses (zoning, monuments)
**Example:**

```python
# Source: Existing DataSourceInfo from Phase 2
@dataclass
class SectionSourceInfo:
    """Source attribution for a report section."""
    section: str  # "zoning", "monuments", "cadastral"
    sources: list[DataSourceInfo]  # May be multiple for monuments
    cached_at: str  # ISO timestamp
    age_seconds: int  # For freshness display

    @property
    def age_display_nl(self) -> str:
        """Dutch relative time display."""
        if self.age_seconds < 3600:
            minutes = self.age_seconds // 60
            return f"{minutes} minuten geleden"
        elif self.age_seconds < 86400:
            hours = self.age_seconds // 3600
            return f"{hours} uur geleden"
        else:
            days = self.age_seconds // 86400
            return f"{days} dagen geleden"

class PropertyReportResponse(BaseModel):
    """Extended property report with zoning and monuments."""
    # ... existing fields from Phase 2 ...
    zoning: ZoningData | None
    monuments: MonumentStatus | None
    map_data: MapData | None
    section_sources: list[SectionSourceInfo]  # Section-level attribution
    completeness_score: float  # Extended to include new sections
```

### Anti-Patterns to Avoid

- **Converting coordinates to WGS84 for Dutch APIs:** All Dutch government APIs natively use EPSG:28992 (RD New). Converting to WGS84 and back adds unnecessary complexity and potential precision loss. Only convert for frontend display if required.

- **GET requests for spatial queries:** DSO API requires POST with GeoJSON body for location queries. GET with bbox query params is not supported for `_zoek` endpoints.

- **Storing full zoning geometries in cache:** Zoning plan polygons can be megabytes of GeoJSON. Cache the API response but extract only relevant rules (text, dimensions) for database storage. Store geometry references, not full geometry.

- **Hard errors on monument source conflicts:** User decision specifies side-by-side display, not validation errors. Conflicts are informational, not blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GeoJSON geometry parsing | Manual dict parsing of coordinate arrays | `shapely.geometry.shape()` | GeoJSON spec supports 7 geometry types with nested structures; shapely handles all edge cases |
| Point-in-polygon checks | Ray casting algorithm from scratch | `shapely_polygon.contains(point)` | Efficient C++ implementation, handles edge cases (point on boundary, holes in polygons) |
| Coordinate transformations | Manual PROJ.4 string calculations | `pyproj.Transformer.from_crs()` | RDNAPTRANS requires specific grid shift files; pyproj includes them |
| GeoJSON validation | Manual schema checks | `geojson` library's validation | Validates against RFC 7946 spec, checks coordinate ordering, geometry types |
| Map tile URLs | String formatting for zoom/x/y | PDOK tile matrix documentation | Tile matrix sets have specific zoom level ranges, projection boundaries; use official endpoints |

**Key insight:** Spatial operations look simple ("just check if point is in polygon") but have edge cases that libraries have spent years solving. The DSO API returns geometries that may have holes (MultiPolygon with interior rings), require coordinate system awareness, and need proper validation.

## Common Pitfalls

### Pitfall 1: Assuming Single Bestemmingsplan per Property

**What goes wrong:** Properties can be covered by multiple overlapping spatial plans (old plan being replaced, provincial + municipal plans, etc.)
**Why it happens:** DSO API returns all plans intersecting coordinates without filtering by status/validity
**How to avoid:**
- Check `plan.status` field (only use "vastgesteld" = finalized)
- Sort by `plan.datum` descending to get most recent
- Return multiple plans if legitimately overlapping (user decides)

**Warning signs:** API returns 5+ plans for single address

### Pitfall 2: Monument Source Field Assumptions

**What goes wrong:** Assuming BAG/Kadaster have dedicated "monumentStatus" fields
**Why it happens:** Research shows monument data is LINKED to BAG/Kadaster via separate registries, not necessarily embedded fields
**How to avoid:**
- Verify actual BAG API v2 response schema for monument fields
- May need to query separate monument endpoint with BAG IDs
- RCE API is authoritative; BAG/Kadaster may only have flags

**Warning signs:** WebSearch results mention "Beschermde Status" as separate entity from BAG

### Pitfall 3: Ignoring DSO API Pagination

**What goes wrong:** Only getting first page of results (default 20 items)
**Why it happens:** DSO API uses HAL+JSON pagination with `_links.next`
**How to avoid:**
- Check for `_links.next` in response
- For zoning data, implement pagination (bestemmingsvlakken can be 100+ per plan)
- Use `pageSize` parameter to request more items upfront (max TBD from API docs)

**Warning signs:** Missing zoning rules even though plan exists

### Pitfall 4: EPSG:28992 Coordinate Order Confusion

**What goes wrong:** Swapping X/Y coordinates (longitude/latitude confusion)
**Why it happens:** EPSG:28992 uses Easting/Northing (X=East, Y=North), not lat/lon
**How to avoid:**
- RD coordinates: X is ~50,000-300,000 (East), Y is ~300,000-625,000 (North)
- Always validate range before API calls
- Use existing BAG coordinate extraction pattern from Phase 2

**Warning signs:** DSO API returns 0 results for valid Dutch address

### Pitfall 5: Cache Invalidation on Full Refresh

**What goes wrong:** "Vernieuwen" button doesn't bypass cache
**Why it happens:** Existing `get_cached_or_fetch()` doesn't support force-refresh
**How to avoid:**
- Add optional `force_refresh: bool` parameter to cache manager
- When True, skip cache lookup and fetch fresh data
- Update cache entry with fresh data after fetch

**Warning signs:** User clicks refresh but sees same stale timestamp

## Code Examples

### DSO Spatial Plans Client

```python
# Source: https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/openapi.yaml
"""DSO Ruimtelijke Plannen API v4 client for spatial planning data."""

import logging
import httpx
from app.government_apis.base import handle_api_response

logger = logging.getLogger(__name__)

class DSOSpatialPlansClient:
    """
    Client for DSO Ruimtelijke Plannen API v4.

    Provides access to Dutch spatial plans (bestemmingsplannen) via REST API.
    Requires API key authentication.
    """

    BASE_URL = "https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def _headers(self) -> dict[str, str]:
        """Get authentication and coordinate system headers."""
        return {
            "Content-Type": "application/json",
            "Content-Crs": "EPSG:28992",  # Input CRS
            "Accept-Crs": "EPSG:28992",   # Output CRS
            # API key header format TBD - check API docs
        }

    async def find_plans_at_location(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Find spatial plans at coordinates using POST with GeoJSON.

        Args:
            x: Easting in EPSG:28992 (RD New)
            y: Northing in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient

        Returns:
            list[dict]: Plans intersecting location
        """
        url = f"{self.BASE_URL}/plannen/_zoek"

        # GeoJSON Point body
        body = {
            "type": "Point",
            "coordinates": [x, y]
        }

        logger.info(f"Querying DSO spatial plans at ({x}, {y})")

        response = await client.post(
            url,
            headers=self._headers,
            json=body,
            timeout=30.0,
        )

        data = handle_api_response(response, source="dso-spatial-plans")

        # HAL+JSON format
        plans = data.get("_embedded", {}).get("plannen", [])
        logger.info(f"Found {len(plans)} spatial plans")

        return plans

    async def get_zoning_areas(
        self,
        plan_id: str,
        client: httpx.AsyncClient,
        expand_geometry: bool = True,
    ) -> list[dict]:
        """
        Get bestemmingsvlakken (zoning areas) for a plan.

        Args:
            plan_id: Plan identifier from find_plans_at_location
            client: Shared httpx AsyncClient
            expand_geometry: Include GeoJSON geometry in response

        Returns:
            list[dict]: Zoning areas with permitted uses
        """
        url = f"{self.BASE_URL}/plannen/{plan_id}/bestemmingsvlakken"
        params = {}

        if expand_geometry:
            params["expand"] = "geometrie,teksten"

        response = await client.get(
            url,
            headers=self._headers,
            params=params,
            timeout=30.0,
        )

        data = handle_api_response(response, source="dso-spatial-plans")
        return data.get("_embedded", {}).get("bestemmingsvlakken", [])
```

### RCE Monument API Client

```python
# Source: https://api.rijksmonumenten.info/
"""RCE Rijksmonument API client using Solr."""

import logging
import httpx
from app.government_apis.base import handle_api_response

logger = logging.getLogger(__name__)

class RCEMonumentClient:
    """
    Client for RCE Rijksmonument API (Solr-based).

    Query rijksmonument status by location or monument number.
    Public API, no authentication required.
    """

    BASE_URL = "https://api.rijksmonumenten.info/select/"

    async def query_by_location(
        self,
        latitude: float,
        longitude: float,
        client: httpx.AsyncClient,
        distance_km: float = 0.01,  # 10 meters
    ) -> list[dict]:
        """
        Find rijksmonumenten near coordinates using geofilt.

        Args:
            latitude: WGS84 latitude (note: RCE uses lat/lon, not RD)
            longitude: WGS84 longitude
            client: Shared httpx AsyncClient
            distance_km: Search radius in kilometers

        Returns:
            list[dict]: Monuments within distance
        """
        params = {
            "q": "*:*",  # Match all
            "fq": "{!geofilt}",  # Geographic filter
            "sfield": "abc_locatie",  # Location field
            "pt": f"{latitude},{longitude}",  # Point
            "d": distance_km,  # Distance
            "wt": "json",  # JSON response
            "rows": 10,  # Limit results
        }

        logger.info(f"Querying RCE monuments at ({latitude}, {longitude})")

        response = await client.get(
            self.BASE_URL,
            params=params,
            timeout=30.0,
        )

        data = handle_api_response(response, source="rce-monuments")
        docs = data.get("response", {}).get("docs", [])

        logger.info(f"Found {len(docs)} monuments")
        return docs

    async def get_by_monument_number(
        self,
        monument_number: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """
        Get monument by rijksmonument number.

        Args:
            monument_number: Monument number (e.g., "5941")
            client: Shared httpx AsyncClient

        Returns:
            dict | None: Monument data or None if not found
        """
        params = {
            "q": f"rce_objrijksnr:{monument_number}",
            "wt": "json",
        }

        response = await client.get(
            self.BASE_URL,
            params=params,
            timeout=30.0,
        )

        data = handle_api_response(response, source="rce-monuments")
        docs = data.get("response", {}).get("docs", [])

        return docs[0] if docs else None
```

### Spatial Intersection Helper

```python
# Source: GeoPandas point-in-polygon patterns
"""Spatial geometry utilities for zoning rule extraction."""

from shapely.geometry import Point, shape

def find_containing_zones(
    property_coords: tuple[float, float],
    zone_features: list[dict],
) -> list[dict]:
    """
    Find which zoning features contain the property point.

    Args:
        property_coords: (x, y) in EPSG:28992
        zone_features: List of GeoJSON features from DSO API

    Returns:
        list[dict]: Features that contain the point
    """
    x, y = property_coords
    property_point = Point(x, y)

    containing = []
    for feature in zone_features:
        geometry_data = feature.get("geometrie")
        if not geometry_data:
            continue

        try:
            # Convert GeoJSON to Shapely geometry
            zone_geom = shape(geometry_data)

            # Point-in-polygon check
            if zone_geom.contains(property_point):
                containing.append(feature)

        except Exception as e:
            # Invalid geometry - log and skip
            logger.warning(f"Invalid geometry in zone feature: {e}")
            continue

    return containing

def extract_zoning_properties(zone_feature: dict) -> dict:
    """
    Extract relevant zoning properties from DSO feature.

    Args:
        zone_feature: Bestemmingsvlak or bouwvlak feature

    Returns:
        dict: Extracted properties
    """
    props = zone_feature.get("properties", {})

    return {
        "bestemming": props.get("naam"),  # Permitted function
        "omschrijving": props.get("omschrijving"),  # Description
        # Dimensions may be in separate maatvoeringen features
        "geometry": zone_feature.get("geometrie"),  # For map display
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ruimtelijkeplannen.nl WFS | DSO REST API v4 | 2024-2026 transition | Must support both during transition; DSO returns JSON+GeoJSON instead of GML/XML |
| Gemeente-specific monument registries | Unified RCE + BAG integration | Ongoing standardization | Monument data increasingly linked to BAG IDs; still need multi-source checking |
| Static map image generation | GeoJSON data + frontend rendering | Modern web mapping | Backend provides data + tile URLs, frontend renders with Leaflet/MapLibre |
| Per-field confidence scores | Section-level source attribution | Phase 3 preparation for Phase 4 | Cleaner UX with fewer labels; Phase 4 will add field-level for AI data |

**Deprecated/outdated:**
- **WFS GetFeature with GML parsing:** DSO provides REST API with JSON; only use WFS as fallback when DSO returns empty
- **Ruimtelijkeplannen.nl as primary source:** Being replaced by DSO; website still exists but no longer updated
- **Separate monument number lookup:** RCE API supports both geographic and ID queries in one interface

## Open Questions

1. **DSO API Authentication Method**
   - What we know: Requires API key for authentication
   - What's unclear: Header name (X-Api-Key? Authorization: Bearer?) and key acquisition process
   - Recommendation: Check API docs or contact DSO support; implement same pattern as BAG API if similar

2. **Monument Fields in BAG/Kadaster APIs**
   - What we know: Monument status is "linked" to BAG/Kadaster, not necessarily embedded
   - What's unclear: Exact field names in BAG verblijfsobject and Kadaster perceel responses for monument indicators
   - Recommendation: Test actual API responses; may need separate monument lookup by BAG ID rather than direct field

3. **DSO Pagination Limits**
   - What we know: HAL+JSON with `_links.next`, default 20 items
   - What's unclear: Maximum pageSize value, whether to paginate bestemmingsvlakken
   - Recommendation: Start with pageSize=100, implement pagination if >100 zones exist

4. **Confidence Indicators for API Data**
   - What we know: Phase 4 requires LOW/MEDIUM/HIGH for AI-parsed data
   - What's unclear: Whether Phase 3 API data should also show confidence (e.g., "MEDIUM" for cached data >30 days old)
   - Recommendation: Defer to planning; user marked as "Claude's discretion"

5. **Legacy WFS Fallback Implementation**
   - What we know: User wants DSO first, Ruimtelijkeplannen.nl WFS fallback
   - What's unclear: How to detect "fallback needed" (DSO returns 0 plans? 404? timeout?)
   - Recommendation: Fallback on empty `plannen` array from DSO; don't wait for timeout

## Sources

### Primary (HIGH confidence)

- [DSO Ruimtelijke Plannen OpenAPI Spec](https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/openapi.yaml) - Complete API v4 specification
- [RCE Rijksmonument API Documentation](https://api.rijksmonumenten.info/) - Solr query interface
- [PDOK BRT Achtergrondkaart OGC API](https://api.pdok.nl/kadaster/brt-achtergrondkaart/ogc/v1?f=html&lang=en) - Tile service documentation
- [DSO Developer Portal - Ruimtelijke Plannen](https://developer.omgevingswet.overheid.nl/dso/gegevens-gebruiken/ruimtelijke-plannen/) - API overview and authentication
- [GeoPandas Point-in-Polygon Documentation](https://geopandas.org/en/stable/docs/user_guide/geometric_manipulations.html) - Spatial operations
- [pyproj Transformer Documentation](https://pyproj4.github.io/pyproj/stable/api/transformer.html) - EPSG:28992 coordinate transformations

### Secondary (MEDIUM confidence)

- [Gemeentelijk Gegevensmodel - Monumenten](https://www.gemeentelijkgegevensmodel.nl/v2.0.0/domeinen/monumenten/) - Monument data model showing BAG/Kadaster relationships
- [Business.gov.nl - Monument Permits](https://business.gov.nl/regulations/all-in-one-permit-monuments/) - Monument renovation restrictions
- [SuburbStory Asyncio Government APIs Pattern](https://dev.to/roberttidball/how-suburbstory-uses-asyncio-to-pull-multi-source-government-data-in-parallel-28d8) - Parallel API fetching architecture
- [Data Reconciliation Patterns](https://www.montecarlodata.com/blog-data-reconciliation/) - Handling conflicting sources

### Tertiary (LOW confidence)

- [PDOK Webservices Workshop](https://pdok.github.io/webservices-workshop/) - General PDOK patterns (not Phase 3 specific)
- [Spatial Planning in NL Overview](https://www.government.nl/topics/spatial-planning-and-infrastructure/spatial-planning-in-the-netherlands) - High-level context, no technical details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official API documentation and specifications verified
- Architecture patterns: MEDIUM - Based on OpenAPI spec + existing Phase 2 patterns; some details need testing
- Monument source fields: LOW - BAG/Kadaster monument fields not verified in actual responses; may differ from WebSearch results
- DSO authentication: LOW - API key required but exact header/process not confirmed
- Pitfalls: MEDIUM - Based on API spec analysis and general spatial data patterns; not Phase 3 specific

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - DSO is in active transition, APIs may change)
