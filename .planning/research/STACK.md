# Technology Stack — v3.0 Area Intelligence Additions

**Project:** Propdex v3.0 Area Intelligence
**Researched:** 2026-02-10
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

v3.0 Area Intelligence requires **7 new dependencies** (5 backend, 2 frontend) integrated with existing httpx/shapely/PostgreSQL stack. Focus on bulk spatial queries (OGC API Features), government API integrations (SRU, ORI), and interactive area selection.

**Key decisions:**
- **OWSLib 0.35.0** for OGC API Features pagination (handles 1000-feature limit)
- **Raw httpx + lxml** for SRU API (sruthi unmaintained since 2023)
- **elasticsearch-py 9.3.0** for Open Raadsinformatie
- **PostGIS extensions** enabled (already have PostgreSQL)
- **@watergis/maplibre-gl-terradraw** + **@turf/turf** for frontend spatial tools
- **Extend existing ARQ** for background jobs (already proven at scale)

---

## Stack Additions for v3.0

### Backend: New Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **OWSLib** | 0.35.0 | OGC API Features / WFS client for PDOK BAG bulk queries | Official Python client for OGC standards, handles pagination, actively maintained (Oct 2025 release), integrates with existing httpx pattern |
| **lxml** | 5.3.0+ | XML parsing for SRU API (Officiële Bekendmakingen) | Fast C-based parser, production-grade, better performance than stdlib. Use `resolve_entities=False, no_network=True` for security |
| **elasticsearch-py** | 9.3.0 | Open Raadsinformatie API client | Official Elastic client, supports async, required for ORI Elasticsearch endpoint, Feb 2026 release |
| **GeoJSON** | 3.1.0 | Serialize Shapely geometries to GeoJSON | Lightweight, integrates with existing Shapely 2.0.0, needed for OWSLib feature conversion |

### Backend: PostgreSQL Extensions

| Extension | Purpose | Why |
|-----------|---------|-----|
| **PostGIS** | Spatial joins (percelen ∩ panden), geometry operations | Required for `ST_Intersects`, `ST_Within` in area queries. Already have PostgreSQL, zero new dependencies |
| **PostGIS GIST indexes** | Spatial index on geometry columns | 5-40x faster spatial joins, mandatory for production performance |

### Frontend: New Dependencies

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **@watergis/maplibre-gl-terradraw** | 1.10.0 | Drawing controls for area selection | Most actively maintained MapLibre drawing plugin (Feb 2026 update), uses Terra Draw (multi-library support), includes area measurement via Turf |
| **@turf/turf** | 7.3.0+ | Client-side spatial operations (bbox, booleanWithin, area calc) | Industry standard for JS geospatial, 10M+ weekly downloads, complements server-side Shapely |

---

## Integration Patterns

### 1. OGC API Features (PDOK BAG) with OWSLib

**Problem:** PDOK WFS serves max 1000 features per request, need pagination for large areas.

**Solution:**
```python
from owslib.ogcapi.features import Features

# OGC API Features endpoint (v2, replaces WFS)
ogc_client = Features("https://api.pdok.nl/kadaster/bag/ogc/v2")

# Paginated queries with bbox
features = []
for feature in ogc_client.collection_items(
    collection_id="pand",
    bbox=[xmin, ymin, xmax, ymax],  # RD New coordinates
    limit=1000  # Max per request
):
    features.append(feature)
```

**Integration:** Wrap in `backend/app/government_apis/bag_ogc.py` client, cache results in PostgreSQL JSONB (existing pattern), use with httpx for consistent error handling.

**Deadline:** Old BAG OGC v1 API discontinued **July 15, 2026** — must use v2 endpoint.

**Confidence:** HIGH
**Sources:**
- [OWSLib PyPI](https://pypi.org/project/OWSLib/) — Version 0.35.0 confirmed Oct 2025
- [PDOK BAG OGC API v2](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features?redirect=/nieuws) — v2 endpoint, v1 deprecation July 15, 2026
- [OGC API Features Pagination](https://ogcapi-workshop.ogc.org/api-deep-dive/features/) — limit/startIndex patterns

### 2. SRU API (Officiële Bekendmakingen) with httpx + lxml

**Problem:** Need to query government announcements by bbox, SRU uses XML responses, existing library unmaintained.

**Solution:**
```python
import httpx
from lxml import etree

# Custom SRU client following existing httpx pattern
class SRUClient:
    def __init__(self):
        self.client = httpx.AsyncClient()
        self.parser = etree.XMLParser(
            resolve_entities=False,  # Prevent XXE
            no_network=True          # Block external DTDs
        )

    async def search(self, query: str, bbox: tuple[float, ...]):
        # SRU CQL query with spatial filter
        response = await self.client.get(
            "https://repository.overheid.nl/sru",
            params={
                "version": "1.2",
                "operation": "searchRetrieve",
                "query": f"... geo.bbox=({bbox})"
            }
        )
        tree = etree.fromstring(response.content, self.parser)
        return self._parse_records(tree)
```

**Why lxml over defusedxml:** defusedxml unmaintained since 2021, lxml with explicit security flags provides same protection with better performance and active maintenance.

**Confidence:** HIGH
**Sources:**
- [sruthi PyPI](https://pypi.org/project/sruthi/) — Unmaintained since July 2023
- [lxml Security Discussion](https://discuss.python.org/t/status-of-defusedxml-and-recommendation-in-docs/34762) — defusedxml maintenance status
- [Python XML Security](https://www.sourcery.ai/vulnerabilities/python-lang-security-use-defused-xml-parse) — lxml security flags

### 3. Open Raadsinformatie with elasticsearch-py

**Endpoint:** `https://api.openraadsinformatie.nl/v1/elastic/`

**Solution:**
```python
from elasticsearch import AsyncElasticsearch

es_client = AsyncElasticsearch(
    ["https://api.openraadsinformatie.nl"],
    # Read-only public endpoint, no auth required
)

# Query council decisions by municipality + date range
results = await es_client.search(
    index="ori_*",  # All ORI indices
    body={
        "query": {
            "bool": {
                "must": [
                    {"term": {"organization.name": "Gemeente Amsterdam"}},
                    {"range": {"date": {"gte": "2024-01-01"}}}
                ]
            }
        }
    }
)
```

**Integration:** New client in `backend/app/government_apis/ori.py`, cache in PostgreSQL, use existing httpx timeout/retry patterns for reliability.

**Confidence:** MEDIUM-HIGH
**Sources:**
- [elasticsearch-py PyPI](https://pypi.org/project/elasticsearch/) — Version 9.3.0 confirmed Feb 2026
- [Open Raadsinformatie API Docs](https://github.com/openstate/open-raadsinformatie/blob/master/API-docs.md) — Elasticsearch endpoint specification

### 4. BRK Bevragen API with httpx mTLS

**Problem:** Requires PKIOverheid certificate + API key authentication (NOT OAuth2).

**Solution:**
```python
import ssl
import httpx

# Load PKI certificate for mutual TLS
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ssl_context.load_cert_chain(
    certfile="/path/to/pki_cert.pem",
    keyfile="/path/to/pki_key.pem"
)

# BRK client with certificate auth
brk_client = httpx.AsyncClient(
    verify=ssl_context,
    headers={"X-Api-Key": settings.BRK_API_KEY}
)

response = await brk_client.get(
    "https://api.brk.kadaster.nl/esd-eto-apikey/bevragen/v2/kadastraalonroerendezaken",
    params={"perceelIdentificatie": perceel_id}
)
```

**Access:** Government-only, requires authorization from Kadaster (review process). Store certificate in environment, NOT in repository.

**Confidence:** MEDIUM (government-only access, limited public documentation)
**Sources:**
- [BRK Bevragen Docs](https://github.com/kadaster/BRK-bevragen/blob/master/docs/getting-started.md) — PKI certificate + API key authentication
- [httpx SSL Documentation](https://www.python-httpx.org/advanced/ssl/) — mTLS certificate configuration

### 5. PostGIS Spatial Joins

**Enable PostGIS:**
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

**Spatial join pattern:**
```sql
-- Find all buildings (panden) within cadastral parcels (percelen)
CREATE INDEX IF NOT EXISTS idx_panden_geom ON panden USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_percelen_geom ON percelen USING GIST(geometry);

SELECT
    p.bag_id,
    pc.kadaster_id,
    ST_Area(p.geometry) as building_area
FROM panden p
JOIN percelen pc ON ST_Within(p.geometry, pc.geometry)
WHERE pc.organization_id = :org_id  -- Multi-tenant filter
  AND pc.area_scan_id = :scan_id;
```

**Performance:** GIST indexes mandatory — 5-40x speedup for spatial joins. Use `ST_Within` for containment, `ST_Intersects` for overlap detection.

**Confidence:** HIGH
**Sources:**
- [PostGIS Spatial Joins](https://postgis.net/workshops/postgis-intro/joins.html) — ST_Within, ST_Intersects patterns
- [PostGIS Performance](http://blog.cleverelephant.ca/2018/09/postgis-external-storage.html) — GIST index optimization

### 6. MapLibre Drawing with Terra Draw

**Installation:**
```bash
pnpm add @watergis/maplibre-gl-terradraw @turf/turf
```

**Usage:**
```typescript
import { MaplibreTerraDrawControl } from '@watergis/maplibre-gl-terradraw';
import * as turf from '@turf/turf';

// Add drawing control to map
const drawControl = new MaplibreTerraDrawControl({
  modes: ['polygon', 'rectangle'],
  onFinish: (geojson) => {
    // Calculate bbox for backend query
    const bbox = turf.bbox(geojson);

    // Validate size
    const area = turf.area(geojson); // square meters
    if (area > 10_000_000) {  // 10 km²
      toast.error('Area too large, max 10 km²');
      return;
    }

    // Send to backend for area scan
    queryClient.mutate({
      mutationFn: () => api.createAreaScan({ bbox, geometry: geojson })
    });
  }
});

map.addControl(drawControl, 'top-right');
```

**Why Terra Draw over alternatives:**
- Most actively maintained (1.10.0 in Feb 2026)
- Built-in Turf integration for measurements
- Supports multiple map libraries (future-proof)
- Better than mapbox-gl-draw (stale fork issues)

**Confidence:** MEDIUM-HIGH
**Sources:**
- [@watergis/maplibre-gl-terradraw npm](https://www.npmjs.com/package/@watergis/maplibre-gl-terradraw) — Version 1.10.0, Feb 2026 update
- [Terra Draw MapLibre Example](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) — Official MapLibre documentation
- [Turf.js bbox](https://turfjs.org/docs/api/bbox) — bbox calculation

### 7. ARQ Background Jobs (Extend Existing)

**Pattern:** Add new job functions to existing ARQ worker, no new infrastructure.

```python
# backend/app/workers/jobs.py
from app.government_apis.bag_ogc import BAGOGCClient

async def process_area_scan(ctx: dict, area_scan_id: int, bbox: list[float]):
    """
    Background job: fetch 1000s of buildings for area scan.
    Expected duration: 30-300 seconds depending on area size.
    """
    ogc_client = BAGOGCClient()

    # Paginated fetch (may take minutes for large areas)
    features = []
    async for feature in ogc_client.get_panden_in_bbox(bbox):
        features.append(feature)

        # Checkpoint every 1000 features
        if len(features) % 1000 == 0:
            await ctx['redis'].set(
                f"scan:{area_scan_id}:progress",
                len(features)
            )

    # Store in PostgreSQL with spatial index
    await store_scan_results(area_scan_id, features)
```

**Why NOT separate queue:**
- ARQ already handles 100s of parallel jobs (proven in v1.1)
- Redis already configured
- 275 existing tests cover ARQ patterns
- Adding Celery = unnecessary complexity

**Confidence:** HIGH
**Sources:**
- [ARQ Documentation](https://arq-docs.helpmanual.io/) — Job patterns
- [ARQ Scalability Article](https://medium.com/@saber.solooki/solving-job-distribution-problems-in-arq-with-redis-streams-59eb4e4d3ec5) — Redis Streams improvements (July 2025)

---

## Installation

### Backend
```bash
cd backend
pip install owslib>=0.35.0 lxml>=5.3.0 elasticsearch>=9.3.0 geojson>=3.1.0
```

Update `pyproject.toml`:
```toml
dependencies = [
    # ... existing deps ...
    "owslib>=0.35.0",
    "lxml>=5.3.0",
    "elasticsearch>=9.3.0",
    "geojson>=3.1.0",
]

[[tool.mypy.overrides]]
module = [
    # ... existing overrides ...
    "owslib.*",
    "lxml.*",
    "elasticsearch.*",
    "geojson.*",
]
ignore_missing_imports = true
```

### Frontend
```bash
cd frontend
pnpm add @watergis/maplibre-gl-terradraw @turf/turf
```

### Database
```sql
-- Enable PostGIS (run as superuser)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verify
SELECT PostGIS_Version();
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **sruthi** (SRU library) | Unmaintained since July 2023, only supports SRU 1.1/1.2 | Raw httpx + lxml with custom SRU client (follows existing pattern) |
| **defusedxml** | Unmaintained since 2021, underlying expat updates more important | lxml with security flags: `XMLParser(resolve_entities=False, no_network=True)` |
| **pygeoapi** | Server framework, not client library | OWSLib (client library) |
| **Separate task queue** (Celery, RQ) | Adds infrastructure complexity | Extend existing ARQ (already proven with Redis, 275 tests) |
| **Kadaster BRK SDK** | No official SDK exists | Raw httpx + mTLS with PKIOverheid certificate |
| **owslib-async fork** | Unofficial, wrap sync calls in threadpool instead | Official OWSLib + asyncio.to_thread() |
| **MapLibre Geoman** | Commercial ($), overkill for polygon selection | Terra Draw (open source) |
| **Separate GeoJSON library** | Shapely 2.x has native GeoJSON support | Use shapely.to_geojson() + geojson lib for serialization |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| OWSLib 0.35.0 | httpx >=0.27.0 | OWSLib uses requests internally, wrap responses in httpx for consistency |
| elasticsearch-py 9.3.0 | Python >=3.10 | Already on Python 3.11 |
| lxml 5.3.0 | libxml2 2.9.0+ | System dependency, install via apt/brew |
| shapely 2.0.0 | GEOS 3.13.1 | Already installed, add geojson for serialization |
| @turf/turf 7.x | MapLibre GL 5.17.0 | No conflicts, pure JS library |
| @watergis/maplibre-gl-terradraw 1.10.0 | MapLibre GL 5.17.0, Terra Draw 0.x | Peer dependency satisfied |

---

## Security Considerations

### XML Parsing (lxml)
```python
# ALWAYS use these flags for untrusted XML
parser = etree.XMLParser(
    resolve_entities=False,  # Prevent XXE attacks
    no_network=True,         # Block external DTD/entity loading
    remove_comments=True,    # Strip comments
    remove_pis=True          # Strip processing instructions
)
```

### BRK mTLS Certificates
- Store PKI cert/key in secure storage (NOT repository)
- Rotate annually per PKIOverheid policy
- Environment variables: `BRK_CERT_PATH`, `BRK_KEY_PATH`, `BRK_API_KEY`

### PostGIS Query Injection
- Use SQLAlchemy parameterized queries
- NEVER construct spatial SQL with f-strings
- Validate geometry input before `ST_GeomFromGeoJSON`

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| OWSLib 0.35.0 | pygeoapi | Never (pygeoapi is a server, not client) |
| httpx + lxml | sruthi library | Never (sruthi unmaintained since 2023) |
| lxml with flags | defusedxml | Never (defusedxml unmaintained since 2021) |
| elasticsearch-py 9.3.0 | Raw HTTP requests | If ORI changes from Elasticsearch |
| PostGIS extensions | Shapely-only | For small datasets (<1000 geometries), but PostGIS scales better |
| Terra Draw | MapLibre Geoman | If budget allows ($), provides more features |
| Extend ARQ | Celery | If need advanced workflows (chains, chords), but overkill for v3.0 |

---

## Migration Checklist

### Backend
- [ ] Add dependencies to pyproject.toml
- [ ] Enable PostGIS extension (superuser required)
- [ ] Create spatial indexes on geometry columns
- [ ] Add OWSLib client in `government_apis/bag_ogc.py`
- [ ] Add SRU client in `government_apis/sru.py`
- [ ] Add ORI client in `government_apis/ori.py`
- [ ] Add BRK client in `government_apis/brk.py` (if authorized)
- [ ] Add ARQ jobs for area scanning
- [ ] Update mypy overrides

### Frontend
- [ ] Install Terra Draw + Turf
- [ ] Add drawing control to map component
- [ ] Add bbox validation (max area)
- [ ] Add area scan mutation
- [ ] Add progress indicators for long-running scans

### Infrastructure
- [ ] Verify PostGIS version >=3.0
- [ ] Obtain BRK PKIOverheid certificate (if needed)
- [ ] Test ORI Elasticsearch endpoint access
- [ ] Verify Redis capacity for larger job payloads

---

## Research Confidence

| Component | Confidence | Evidence |
|-----------|------------|----------|
| OWSLib for OGC API | HIGH | Official OGC client, active maintenance, PDOK documentation confirms compatibility |
| lxml for SRU | HIGH | Industry standard, clear security guidance, sruthi definitively unmaintained |
| elasticsearch-py | HIGH | Official client, latest version confirmed (Feb 2026), ORI endpoint documented |
| PostGIS patterns | HIGH | Official PostGIS docs, standard spatial database patterns |
| Terra Draw | MEDIUM-HIGH | Active maintenance confirmed, but limited production usage reports found |
| BRK mTLS | MEDIUM | Certificate auth confirmed, but government-only access means limited external documentation |
| ARQ scalability | HIGH | Already proven in v1.1 (275 tests), documented patterns for long-running jobs |

---

## Sources

### High Confidence (Official Documentation)
- [OWSLib PyPI](https://pypi.org/project/OWSLib/) — Version 0.35.0 confirmed Oct 2025
- [OWSLib Documentation](https://owslib.readthedocs.io/) — OGC API Features client usage
- [elasticsearch-py PyPI](https://pypi.org/project/elasticsearch/) — Version 9.3.0 confirmed Feb 2026
- [Open Raadsinformatie API Docs](https://github.com/openstate/open-raadsinformatie/blob/master/API-docs.md) — Elasticsearch endpoint specification
- [PDOK BAG OGC API v2](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features?redirect=/nieuws) — v2 endpoint, v1 deprecation July 15, 2026
- [BRK Bevragen Docs](https://github.com/kadaster/BRK-bevragen/blob/master/docs/getting-started.md) — PKI certificate + API key authentication
- [PostGIS Spatial Joins](https://postgis.net/workshops/postgis-intro/joins.html) — ST_Within, ST_Intersects patterns
- [Shapely 2.1.2 Documentation](https://shapely.readthedocs.io/) — GeoJSON conversion functions
- [Turf.js Documentation](https://turfjs.org/docs/api/bbox) — bbox, booleanWithin, area functions

### Medium Confidence (Community + Package Metadata)
- [@watergis/maplibre-gl-terradraw npm](https://www.npmjs.com/package/@watergis/maplibre-gl-terradraw) — Version 1.10.0, Feb 2026 update
- [Terra Draw MapLibre Example](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) — Official MapLibre documentation
- [lxml Security Discussion](https://discuss.python.org/t/status-of-defusedxml-and-recommendation-in-docs/34762) — defusedxml maintenance status, lxml alternatives
- [httpx SSL Documentation](https://www.python-httpx.org/advanced/ssl/) — mTLS certificate configuration
- [ARQ Scalability Article](https://medium.com/@saber.solooki/solving-job-distribution-problems-in-arq-with-redis-streams-59eb4e4d3ec5) — Redis Streams improvements (July 2025)

### Low Confidence (Requires Validation)
- sruthi library status — PyPI shows July 2023 last update, no GitHub activity since
- BRK API access process — government-only, authorization process not publicly documented
- Terra Draw production usage — limited case studies found, but active maintenance confirmed

---
*Stack research for: v3.0 Area Intelligence*
*Researched: 2026-02-10*
