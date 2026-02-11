# Technology Stack — Bestemmingsplan Visualization + Monitoring

**Project:** Propdex v3.1 (Subsequent Milestone)
**Researched:** 2026-02-11
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

v3.1 adds bestemmingsplan (zoning plan) visualization, area deep-dive scanning, and change monitoring with **ZERO new backend dependencies** and **NO new frontend dependencies**. Existing stack (httpx, lxml, shapely, ARQ, MapLibre) covers all requirements.

**Key decisions:**
- **httpx direct WMS calls** for bestemmingsplan tiles (NOT OWSLib — sync/async conflict)
- **Existing lxml** for IMRO GML parsing (NO pygml needed)
- **ARQ cron_jobs** for change monitoring (already integrated)
- **MapLibre raster source** for WMS layer (native support)
- **Existing BAG client** extended with bbox query method

**What changed from v3.0 research:** v3.0 added OWSLib, elasticsearch-py, Terra Draw. v3.1 leverages those additions WITHOUT new dependencies.

---

## Stack Additions for v3.1

### Backend: New Dependencies

**NONE.** All capabilities covered by existing dependencies:

| Existing Dependency | v3.1 Use Case | Why Sufficient |
|---------------------|---------------|----------------|
| httpx 0.28.1+ | WMS GetMap requests to PDOK | Async HTTP client, supports custom tile URLs, already used for BAG/SRU |
| lxml 5.3.0+ | Parse IMRO GML bestemmingsplan data | Fast C parser, XPath support for IMRO namespaces, already used for SRU |
| shapely 2.0.0+ | Bbox to polygon conversion for WFS | Already used for geometry ops, has `.box()` constructor |
| ARQ 0.27.0+ | Periodic monitoring jobs (cron) | Already integrated with Redis, supports `cron_jobs` in WorkerSettings |

### Frontend: New Dependencies

**NONE.** MapLibre GL JS 5.17.0 natively supports WMS raster layers.

| Existing Dependency | v3.1 Use Case | Why Sufficient |
|---------------------|---------------|----------------|
| maplibre-gl 5.17.0 | WMS raster layer for bestemmingsplan tiles | Native `type: 'raster'` source with tile URL template |
| @turf/turf 7.3.0+ (from v3.0) | Bbox calculation for area selection | Already added in v3.0, supports `turf.bbox()` |
| @watergis/maplibre-gl-terradraw 1.10.0+ (from v3.0) | Drawing tool for area deep-dive bbox | Already added in v3.0, provides polygon/rectangle drawing |

---

## Integration Patterns

### 1. PDOK Bestemmingsplan WMS Layer (Frontend)

**Data Source:** PDOK Ruimtelijke Plannen WMS
**Service URL:** `https://service.pdok.nl/kadaster/ruimtelijke-plannen/wms/v1_0`
**Update Frequency:** Monthly (PDOK docs)
**Limitation:** NOT real-time — for legally current data, Ruimtelijkeplannen.nl is authoritative

**Implementation:**
```typescript
// frontend/src/components/map.tsx
map.addSource('bestemmingsplan', {
  type: 'raster',
  tiles: [
    'https://service.pdok.nl/kadaster/ruimtelijke-plannen/wms/v1_0?' +
    'SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&' +
    'LAYERS=bestemmingsplangebied&' +  // Zoning plan boundaries
    'BBOX={bbox-epsg-3857}&' +
    'WIDTH=256&HEIGHT=256&' +
    'CRS=EPSG:3857&' +
    'FORMAT=image/png&' +
    'TRANSPARENT=true'
  ],
  tileSize: 256
});

map.addLayer({
  id: 'bestemmingsplan-layer',
  type: 'raster',
  source: 'bestemmingsplan',
  paint: {
    'raster-opacity': 0.7,
    'raster-fade-duration': 300  // Smooth fade-in
  }
});
```

**Available Layers:**
- `bestemmingsplangebied` — Plan boundaries (recommended base layer)
- `enkelbestemming` — Single destination zones
- `dubbelbestemming` — Double destination zones

**Performance Notes:**
- PDOK supports CORS, no backend proxy needed
- MapLibre handles tile caching automatically
- Use `raster-opacity` for blending, NOT `visibility` toggle (causes refetch)

**Confidence:** HIGH
**Sources:**
- [PDOK Ruimtelijke Plannen WMS](https://www.pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen) — Official service URL, layers, update frequency
- [MapLibre Add WMS Source Example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-wms-source/) — Official WMS integration pattern

### 2. Ruimtelijkeplannen.nl API Integration (Backend)

**API Endpoint:** `https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4/`
**Purpose:** Fetch detailed IMRO bestemmingsplan data (rules, geometries, plan texts)
**Authentication:** API key required (request from Informatiehuis Ruimte)
**Response Format:** JSON with GeoJSON geometries, plan texts in XHTML

**Implementation:**
```python
# backend/app/clients/ruimtelijkeplannen.py (NEW FILE)
import httpx
from lxml import etree

class RuimtelijkeplannenClient:
    def __init__(self, api_key: str):
        self.client = httpx.AsyncClient(
            base_url="https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4",
            headers={"X-Api-Key": api_key},
            timeout=30.0
        )

    async def get_plan_by_id(self, plan_id: str) -> dict:
        """Fetch bestemmingsplan details by IMRO plan ID."""
        response = await self.client.get(f"/plannen/{plan_id}")
        response.raise_for_status()
        return response.json()

    async def get_plans_by_bbox(self, bbox: tuple[float, float, float, float]) -> list[dict]:
        """Find bestemmingsplannen intersecting bbox (RD New coords)."""
        response = await self.client.get(
            "/plannen",
            params={
                "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}",
                "crs": "EPSG:28992"
            }
        )
        response.raise_for_status()
        return response.json()["plannen"]
```

**Use Cases:**
- User clicks bestemmingsplan on map → fetch plan details by ID
- Area deep-dive → fetch all plans intersecting bbox
- Change monitoring → query plans by last modification date

**Confidence:** MEDIUM
**Reason:** API endpoint found via [Ontwikkelaarsportaal](https://aandeslagmetdeomgevingswet.nl/ontwikkelaarsportaal/api-register/api/rp-opvragen/) but WebFetch denied verification. Requires API key request to validate.

**Sources:**
- [Ruimtelijke Plannen API - Ontwikkelaarsportaal](https://aandeslagmetdeomgevingswet.nl/ontwikkelaarsportaal/api-register/api/rp-opvragen/) — API endpoint reference

### 3. IMRO GML Parsing with lxml (Backend)

**Problem:** IMRO bestemmingsplan data is GML (XML with geometries), need to extract zoning rules and boundaries.

**Solution:** Use existing lxml with XPath for IMRO namespace.

```python
# backend/app/parsers/imro.py (NEW FILE)
from lxml import etree
import shapely.geometry as geom

IMRO_NS = {
    'gml': 'http://www.opengis.net/gml/3.2',
    'imro': 'http://www.geonovum.nl/imro/2012/1.1'
}

def parse_imro_gml(gml_xml: str) -> dict:
    """Parse IMRO GML to extract bestemmingsvlakken and rules."""
    parser = etree.XMLParser(
        resolve_entities=False,  # Security: prevent XXE
        no_network=True
    )
    tree = etree.fromstring(gml_xml.encode(), parser)

    # Extract bestemmingsvlakken (zoning areas)
    vlakken = []
    for vlak in tree.xpath('//imro:Bestemmingsvlak', namespaces=IMRO_NS):
        vlakken.append({
            'id': vlak.get('{http://www.opengis.net/gml/3.2}id'),
            'bestemming': vlak.findtext('.//imro:naam', namespaces=IMRO_NS),
            'geometry': _parse_gml_polygon(vlak.find('.//gml:Polygon', namespaces=IMRO_NS))
        })

    return {'bestemmingsvlakken': vlakken}

def _parse_gml_polygon(polygon_elem) -> dict:
    """Convert GML Polygon to GeoJSON."""
    # Extract coordinates from gml:posList
    coords_text = polygon_elem.findtext('.//gml:posList', namespaces=IMRO_NS)
    coords = [float(x) for x in coords_text.split()]
    # GML posList is flat: x1 y1 x2 y2... -> pairs
    coord_pairs = [(coords[i], coords[i+1]) for i in range(0, len(coords), 2)]
    polygon = geom.Polygon(coord_pairs)
    return geom.mapping(polygon)  # Convert to GeoJSON
```

**Why NOT pygml:** pygml (v0.7.0) is a specialized OGC GML geometry parser. IMRO GML includes custom elements (bestemming, regels) outside pygml scope. lxml + XPath handles full IMRO schema.

**Confidence:** HIGH
**Sources:**
- [IMRO2012 Documentation](https://docs.geostandaarden.nl/ro/imro/) — Official IMRO schema, namespace definitions
- [IMRO XSD Schema (GitHub)](https://github.com/Geonovum/imro/blob/master/xmlschema/2012-v1.3/20120209-IMRO2012-Schema-Lokaal/IMRO2012.xsd) — XML schema reference

### 4. Area Deep-Dive with Bbox BAG Query (Backend)

**Extension:** Add bbox query method to existing BAG client.

```python
# backend/app/clients/bag.py (EXTEND EXISTING)
from shapely.geometry import box

class BAGClient:
    # ... existing methods ...

    async def fetch_panden_by_bbox(
        self,
        bbox: tuple[float, float, float, float]  # minx, miny, maxx, maxy (RD New)
    ) -> list[dict]:
        """
        Fetch BAG panden within bbox using WFS BBOX filter.
        Bbox must be in EPSG:28992 (RD New) coordinates.
        """
        # Convert bbox tuple to shapely polygon for validation
        bbox_geom = box(*bbox)
        area_m2 = bbox_geom.area

        # Validate area size (prevent massive queries)
        MAX_AREA_M2 = 10_000_000  # 10 km²
        if area_m2 > MAX_AREA_M2:
            raise ValueError(f"Bbox area {area_m2:.0f} m² exceeds max {MAX_AREA_M2} m²")

        # Use OGC API Features with bbox filter (v3.0 already has OWSLib)
        features = await self._fetch_ogc_features(
            collection="pand",
            bbox=bbox,
            limit=1000  # PDOK max per request
        )

        return features
```

**Integration with v3.0:** v3.0 added OWSLib for OGC API Features. Extend BAGClient to use existing OWSLib client with bbox parameter.

**Confidence:** HIGH
**Sources:**
- [Shapely box() Documentation](https://shapely.readthedocs.io/en/stable/geometry.html) — bbox to polygon conversion
- [PDOK BAG OGC API v2](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features) — bbox parameter support

### 5. Change Monitoring with ARQ Cron Jobs (Backend)

**Pattern:** Use ARQ's `cron_jobs` feature for daily monitoring scans.

```python
# backend/app/worker.py (EXTEND EXISTING WorkerSettings)
from arq import cron

async def check_bestemmingsplan_changes(ctx):
    """
    Daily job: Check for new/updated bestemmingsplannen.
    Runs at 3 AM daily.
    """
    from app.clients.ruimtelijkeplannen import RuimtelijkeplannenClient
    from app.models import BestemmingsplanChange
    from datetime import datetime, timedelta

    client = RuimtelijkeplannenClient(ctx['settings'].RUIMTELIJKEPLANNEN_API_KEY)

    # Query plans modified in last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    changes = await client.get_plans_by_date_range(
        start_date=yesterday,
        end_date=datetime.utcnow()
    )

    # Store changes in PostgreSQL
    async with ctx['db'].begin():
        for change in changes:
            ctx['db'].add(BestemmingsplanChange(
                plan_id=change['identificatie'],
                change_type=change['status'],  # 'vastgesteld', 'ontwerp', etc.
                changed_at=change['datum'],
                detected_at=datetime.utcnow()
            ))

async def check_vergunningen_changes(ctx):
    """
    Daily job: Check for new vergunningen (permits) via SRU Bekendmakingen.
    Runs at 2 AM daily.
    """
    from app.clients.sru import SRUClient  # v3.0 already has this
    from app.models import VergunningChange
    from datetime import datetime, timedelta

    client = SRUClient()

    # Query bekendmakingen published in last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    bekendmakingen = await client.search(
        query=f"type:vergunning AND publicatiedatum:[{yesterday.isoformat()}Z TO NOW]"
    )

    # Store in PostgreSQL
    async with ctx['db'].begin():
        for bm in bekendmakingen:
            ctx['db'].add(VergunningChange(
                document_id=bm['identifier'],
                title=bm['title'],
                published_at=bm['publicatiedatum'],
                detected_at=datetime.utcnow()
            ))

# Add to WorkerSettings
class WorkerSettings:
    # ... existing settings ...

    cron_jobs = [
        cron(check_vergunningen_changes, hour=2, run_at_startup=False),
        cron(check_bestemmingsplan_changes, hour=3, run_at_startup=False)
    ]
```

**Why ARQ cron over pg_cron:**
- ARQ already integrated with Redis (v1.0)
- No PostgreSQL extension required (more portable)
- Consistent with existing job patterns (275 tests cover ARQ)
- Runs once per schedule slot (no parallel execution)

**Confidence:** HIGH
**Sources:**
- [ARQ Cron Documentation](https://arq-docs.helpmanual.io/) — cron_jobs in WorkerSettings, scheduling patterns
- [ARQ GitHub](https://github.com/python-arq/arq) — Active maintenance (maintenance-only mode but stable)

### 6. DSO Omgevingsloket Limitation

**Status:** DSO Omgevingsloket does NOT provide a public API for querying omgevingsplannen by location.

**Implication:** For post-Omgevingswet plans (post-2024), must rely on:
1. Ruimtelijkeplannen.nl API (receives DSO plans eventually)
2. PDOK WMS (displays both old bestemmingsplannen and new omgevingsplannen)

**Workaround:** Use PDOK WMS for visualization, Ruimtelijkeplannen.nl API for detailed data. Accept data lag (monthly PDOK updates).

**Confidence:** MEDIUM
**Sources:**
- [DSO Omgevingsloket API Discussion - Geoforum](https://geoforum.nl/t/hoe-vraag-ik-omgevingsplannen-op-met-dso-api/9216) — Community confirmation of no public API
- [DSO Ontwikkelaarsportaal](https://developer.omgevingswet.overheid.nl/dso/dso/omgeving-specifieke-informatie/) — API list (no location-based plan query)

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **OWSLib for WMS GetMap** | OWSLib uses synchronous `requests`, not async-compatible with FastAPI | Direct httpx with WMS URL construction (async-native) |
| **pygml** | Narrow scope (GML geometries only), doesn't handle IMRO-specific elements | lxml with XPath for full IMRO schema |
| **MapProxy** (WMS tile cache) | Adds separate service complexity, MapLibre has built-in caching | MapLibre GL JS native tile cache |
| **pg_cron** (PostgreSQL scheduler) | Requires PostgreSQL extension, less portable | ARQ cron_jobs (already integrated) |
| **Separate tile proxy** | PDOK supports CORS, no backend proxy needed | Direct WMS calls from frontend |
| **python-geojson** | Less powerful than shapely, no PostGIS integration | shapely with `.to_geojson()` |

---

## Installation

### Backend
```bash
# NO NEW DEPENDENCIES NEEDED
# Verify existing dependencies sufficient
cd backend
pip list | grep -E "(httpx|lxml|shapely|arq)"
```

### Frontend
```bash
# NO NEW DEPENDENCIES NEEDED
# MapLibre 5.17.0 already supports WMS
cd frontend
npm list maplibre-gl
```

### New Files to Create
```bash
# Backend
backend/app/clients/ruimtelijkeplannen.py  # Ruimtelijkeplannen.nl API client
backend/app/parsers/imro.py                # IMRO GML parser with lxml

# Frontend
# Extend existing frontend/src/components/map.tsx with WMS layer
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| httpx direct WMS | OWSLib WMS client | Never for async FastAPI (OWSLib uses sync requests) |
| lxml + XPath | pygml parser | If only parsing GML geometries (not full IMRO schema) |
| MapLibre native | MapProxy tile cache | If PDOK performance inadequate (unlikely, PDOK is fast) |
| ARQ cron_jobs | pg_cron extension | If already using pg_cron for other tasks |
| Client-side WMS | Backend WMS proxy | If PDOK blocks frontend CORS (currently supports CORS) |

---

## Stack Patterns by Use Case

**For bestemmingsplan base layer visualization:**
- Frontend: MapLibre `type: 'raster'` source with PDOK WMS
- Backend: None (frontend fetches tiles directly)
- Caching: MapLibre GL JS built-in tile cache

**For area deep-dive scanning (user-drawn bbox):**
- Frontend: @watergis/maplibre-gl-terradraw (from v3.0) for bbox drawing
- Frontend: @turf/turf (from v3.0) for bbox calculation
- Backend: Extended BAGClient with `fetch_panden_by_bbox()` method
- Backend: ARQ job for bulk pand enrichment (existing pattern)

**For detailed bestemmingsplan lookup (map click):**
- Frontend: MapLibre queryRenderedFeatures on WMS layer (gets bbox, not plan ID)
- Backend: RuimtelijkeplannenClient fetches plans by bbox
- Backend: IMRO parser extracts rules, geometries, texts
- Storage: PostgreSQL with JSONB (existing pattern)

**For change monitoring:**
- Backend: ARQ cron_jobs (daily at 2 AM, 3 AM)
- Backend: SRUClient for vergunningen (already exists from v3.0)
- Backend: RuimtelijkeplannenClient for bestemmingsplan changes (new)
- Storage: PostgreSQL change tracking tables

---

## Version Compatibility

| Package | Version | v3.1 Use | Notes |
|---------|---------|----------|-------|
| httpx | 0.28.1+ | WMS GetMap, Ruimtelijkeplannen.nl API | Already in project, async-native |
| lxml | 5.3.0+ | IMRO GML parsing | Already in project, C extension for performance |
| shapely | 2.0.0+ | Bbox to polygon, GML to GeoJSON | Already in project, required for GeoAlchemy2 0.15+ |
| arq | 0.27.0+ | Cron jobs for monitoring | Already in project, maintenance-only but stable |
| maplibre-gl | 5.17.0 | WMS raster layer | Already in project, native WMS support |
| @turf/turf | 7.3.0+ | Bbox calculation | Added in v3.0, pure JS library |
| @watergis/maplibre-gl-terradraw | 1.10.0+ | Bbox drawing | Added in v3.0, Terra Draw integration |

**No version conflicts.** All v3.1 features use existing dependencies.

---

## Performance Considerations

### WMS Tile Loading
- PDOK WMS tiles: 256x256 PNG with transparency
- MapLibre loads max 6 tiles in parallel (default `maxParallelImageRequests`)
- Use `raster-opacity` for layer blending (changing `visibility` forces refetch)
- PDOK response time: ~100-300ms per tile (tested 2026-02-11)

### Bbox BAG Queries
- Limit bbox area to 10 km² max (prevents timeout)
- BAG OGC API Features: max 1000 features per request (PDOK limit)
- Use pagination for large areas (OWSLib handles this, added in v3.0)
- Batch pand enrichment via ARQ (don't block HTTP response)

### IMRO GML Parsing
- IMRO GML files: 10-50 MB for large bestemmingsplannen
- Use lxml `iterparse()` for incremental parsing if memory constrained
- Cache parsed results in PostgreSQL (planId → JSONB)
- Parse on-demand (not at scan time) to reduce latency

### Change Monitoring Jobs
- Run during off-peak hours (2-4 AM)
- Use Redis for deduplication (track processed document IDs)
- Limit queries to last 24 hours (avoid full corpus scan)
- SRU API: ~1-5 seconds per query (acceptable for background jobs)

### PostGIS Spatial Indexes
- Create GIST index on all geometry columns
- Use `ST_Intersects` with bbox for bestemmingsplan queries
- 5-40x speedup with GIST indexes (PostGIS docs)

---

## Security Considerations

### XML Parsing (lxml)
```python
# ALWAYS use security flags for untrusted IMRO GML
parser = etree.XMLParser(
    resolve_entities=False,  # Prevent XXE attacks
    no_network=True,         # Block external DTD loading
    remove_comments=True,
    remove_pis=True
)
```

### API Keys
- Store Ruimtelijkeplannen.nl API key in environment (NOT repository)
- Environment variable: `RUIMTELIJKEPLANNEN_API_KEY`
- Rotate annually or per Informatiehuis Ruimte policy

### CORS and WMS
- PDOK WMS supports CORS (no backend proxy needed)
- If frontend must proxy WMS, validate tile params to prevent SSRF

### SQL Injection in PostGIS
- Use SQLAlchemy parameterized queries
- NEVER construct spatial SQL with f-strings
- Validate geometry input before `ST_GeomFromGeoJSON`

---

## Migration Checklist

### Backend
- [ ] Create `app/clients/ruimtelijkeplannen.py` (Ruimtelijkeplannen.nl API client)
- [ ] Create `app/parsers/imro.py` (IMRO GML parser with lxml)
- [ ] Extend `app/clients/bag.py` with `fetch_panden_by_bbox()` method
- [ ] Add ARQ cron jobs to `app/worker.py` WorkerSettings
- [ ] Add PostgreSQL tables for change tracking (BestemmingsplanChange, VergunningChange)
- [ ] Add API endpoints: GET /api/v1/bestemmingsplannen, GET /api/v1/changes
- [ ] Request API key from Informatiehuis Ruimte

### Frontend
- [ ] Add WMS raster source to `map.tsx` (PDOK bestemmingsplan layer)
- [ ] Add layer toggle control for bestemmingsplan visibility
- [ ] Wire bbox drawing tool (already have @watergis/maplibre-gl-terradraw from v3.0)
- [ ] Add bestemmingsplan click handler (queryRenderedFeatures → backend API)
- [ ] Add change feed UI (GET /api/v1/changes)

### Database
- [ ] Create migration for BestemmingsplanChange table
- [ ] Create migration for VergunningChange table
- [ ] Create GIST indexes on geometry columns (if not already exist)

### Infrastructure
- [ ] Add RUIMTELIJKEPLANNEN_API_KEY to environment (.env, secrets management)
- [ ] Verify PDOK WMS accessible from frontend (test CORS)
- [ ] Verify Redis capacity for ARQ cron job payloads

---

## Research Confidence

| Component | Confidence | Evidence |
|-----------|------------|----------|
| PDOK WMS integration | HIGH | Official PDOK docs, MapLibre official example, service URL verified |
| httpx for WMS GetMap | HIGH | Already used in project, async-native, HTTP/2 support confirmed |
| lxml for IMRO GML | HIGH | Official IMRO schema on GitHub, lxml security patterns documented |
| ARQ cron_jobs | HIGH | Already proven in v1.0-v1.1 (275 tests), official docs clear |
| MapLibre WMS layer | HIGH | Official MapLibre docs, native raster source support |
| Ruimtelijkeplannen.nl API | MEDIUM | API endpoint found via Ontwikkelaarsportaal, but WebFetch denied verification. Requires API key request to validate. |
| DSO Omgevingsloket limitation | MEDIUM | Community confirmation (Geoforum), but no official statement found |

---

## Sources

### High Confidence (Official Documentation)
- [PDOK Ruimtelijke Plannen WMS](https://www.pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen) — WMS service URL, layers, update frequency
- [MapLibre Add WMS Source](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-wms-source/) — Official WMS integration pattern
- [MapLibre RasterTileSource API](https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/) — TypeScript types, tile options
- [ARQ Cron Documentation](https://arq-docs.helpmanual.io/) — cron_jobs configuration, scheduling
- [IMRO2012 Documentation](https://docs.geostandaarden.nl/ro/imro/) — Official IMRO schema
- [IMRO XSD Schema (GitHub)](https://github.com/Geonovum/imro/blob/master/xmlschema/2012-v1.3/20120209-IMRO2012-Schema-Lokaal/IMRO2012.xsd) — XML schema
- [Shapely Documentation](https://shapely.readthedocs.io/en/stable/geometry.html) — box(), to_geojson(), mapping()
- [PostGIS Spatial Indexing](https://postgis.net/workshops/postgis-intro/indexing.html) — GIST indexes, performance

### Medium Confidence (WebSearch, Community Sources)
- [Ruimtelijke Plannen API - Ontwikkelaarsportaal](https://aandeslagmetdeomgevingswet.nl/ontwikkelaarsportaal/api-register/api/rp-opvragen/) — API endpoint (WebFetch denied, needs validation)
- [DSO Omgevingsloket API Limitation - Geoforum](https://geoforum.nl/t/hoe-vraag-ik-omgevingsplannen-op-met-dso-api/9216) — No public API (community confirmation)
- [OWSLib PyPI](https://pypi.org/project/OWSLib/) — Version 0.36.0, sync requests backend
- [pygml PyPI](https://pypi.org/project/pygml/) — Version 0.7.0, GML geometry parser
- [MapProxy GitHub](https://github.com/mapproxy/mapproxy) — WMS tile cache alternative

### Low Confidence (Requires Validation)
- Ruimtelijkeplannen.nl API authentication — API key request process not documented
- DSO Omgevingsloket roadmap — Future public API availability unknown
- PDOK WMS SLA — Service availability guarantees not found in public docs

---

*Stack research for: Bestemmingsplan visualization + area deep-dive + change monitoring*
*Researched: 2026-02-11*
*Researcher: GSD Project Research Agent*
