# Technology Stack

**Project:** Propdex v14.0 Fysiek Risicoprofiel
**Researched:** 2026-03-09
**Confidence:** HIGH (both PDOK endpoints verified via live API calls with real data; BRO Bodemkaart WMS and Funderingsproblematiek WFS schemas confirmed)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for v14.0 Fysiek Risicoprofiel. Existing validated capabilities are NOT re-documented.

**Existing infrastructure reused without changes:**
- `httpx[http2]>=0.27.0` -- HTTP client for all government APIs
- `lxml>=5.3.0` -- XML parsing (WFS GML responses if needed, though JSON preferred)
- `aiolimiter>=1.2.0` -- rate limiting via `APIRateLimiter`
- `pyproj>=3.7.0` -- CRS transformations (WGS84 to RD New already used)
- `government_apis/base.py` -- `GovernmentAPIError`, `retry_with_backoff`
- `government_apis/rate_limiter.py` -- rate limiter pattern
- `government_apis/bodemloket_arcgis.py` -- existing Bodemloket client (soil contamination)
- `services/asbest_indicator.py` -- existing NEN 2991 bouwjaar-based risk bands
- `services/bodem_aggregator.py` -- existing bodem aggregation with JSONB cache
- `services/cache_manager.py` -- `get_cached_or_fetch` pattern
- PostgreSQL JSONB cache with source-specific TTLs

---

## Final Answer: Zero New Dependencies Required

All v14.0 features build on the existing stack. No new pip packages, no new npm packages. The two new data sources (BRO Bodemkaart WMS, PDOK Funderingsproblematiek WFS) return JSON and are queryable via httpx. The foundation heuristic engine and asbestos v2 are pure Python logic.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| BRO Bodemkaart soil type | None | `httpx` GET to WMS GetFeatureInfo (returns JSON) |
| PDOK Funderingsproblematiek | None | `httpx` GET to WFS GetFeature (returns GeoJSON) |
| Soil code classification | None | Python dict mapping (static lookup table) |
| Foundation risk heuristic | None | Pure Python logic combining bouwjaar + soil type |
| Asbestos v2 refinement | None | Extended Python logic in existing `asbest_indicator.py` |
| Frontend risk section | None | React components + existing Tailwind |

**`pyproject.toml` changes: none required.**
**`package.json` changes: none required.**

---

## New API 1: BRO Bodemkaart (SGM) -- Soil Type Classification

### Endpoint Details (Verified via Live API Call)

**Service:** PDOK BRO Bodemkaart WMS v1.0
**Provider:** TNO (via PDOK)
**Auth:** None required (public, CC0 licensed)
**Protocol:** WMS 1.3.0 GetFeatureInfo (NOT WFS -- WFS has been phased out for this dataset)

**Base URL:** `https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0`

**Note on URL:** The GetCapabilities XML redirects internal URLs to `service.pdok.nl/tno/bro-bodemkaart/wms/v1_0`. Both `/bzk/` and `/tno/` paths work. Use `/bzk/` as it matches the documented endpoint.

**Request pattern (verified):**
```
GET {BASE_URL}?
  service=WMS&
  version=1.3.0&
  request=GetFeatureInfo&
  layers=soilarea&
  query_layers=soilarea&
  info_format=application/json&
  crs=EPSG:28992&
  bbox={x-500},{y-500},{x+500},{y+500}&  # 1km window centered on point
  width=100&
  height=100&
  i=50&                                   # center pixel
  j=50
```

**Response schema (verified from live call near Venlo):**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "properties": {
      "soilcode": "cY23",
      "first_soilcode": "cY23",
      "first_soilname": "Loopodzolgronden; lemig fijn zand",
      "normal_soilprofile_code": "cY23",
      "normal_soilprofile_name": "Loopodzolgronden; lemig fijn zand",
      "maparea_collection": "Eerste opname met uitgebreide veldverkenning",
      "maparea_id": "V2025-1..soilarea.0000011010",
      "soilslope": "Niet opgenomen",
      "beginlifespan": "",
      "endlifespan": ""
    }
  }]
}
```

**Key fields for risk assessment:**
- `soilcode` -- BRO soil classification code (e.g., "cY23", "Zd21", "pMo80")
- `normal_soilprofile_name` -- Human-readable Dutch soil description

**Available layers:**
| Layer name | Title | Use |
|------------|-------|-----|
| `soilarea` | Bodemvlakken | Primary -- soil type polygons (1:50,000 scale) |
| `soilslope` | Bodemvlakken (met helling) | Same data with slope info |
| `areaofpedologicalinterest` | Vlakken van bodemkundig belang | Special soil areas |

### Soil Code Classification for Foundation Risk

The Dutch soil classification (Stiboka/WUR system) encodes soil type in the first 1-2 characters of the code. For foundation risk, we need to classify into four risk-relevant categories:

```python
# Soil code prefix → grondsoort mapping for foundation risk
# Source: BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/)
# + WUR Legenda's en indelingen op bodemkaarten

SOIL_PREFIX_TO_GRONDSOORT: dict[str, str] = {
    # VEEN (peat) -- highest foundation risk, compressible
    "V": "veen",   # Veengronden
    "aV": "veen",  # Associatie veengronden
    "hV": "veen",  # Koopveengronden
    "pV": "veen",  # Weideveengronden
    "kV": "veen",  # Waardveengronden
    "iV": "veen",  # Vlietveengronden

    # KLEI (clay) -- moderate-high foundation risk, shrink-swell
    "M": "klei",   # Zeekleigronden (marine clay)
    "R": "klei",   # Rivierkleigronden (river clay)
    "pM": "klei",  # Poldervaaggronden
    "kM": "klei",  # Knippige kleigronden

    # ZAND (sand) -- low foundation risk, good bearing capacity
    "Z": "zand",   # Zandgronden
    "Y": "zand",   # Vaaggronden (zand)
    "H": "zand",   # Podzolgronden (in sand)
    "cY": "zand",  # Loopodzolgronden
    "Zd": "zand",  # Duinvaaggronden

    # LEEM/LOSS (loess/silt) -- moderate risk
    "L": "leem",   # Leemgronden / Lossgronden
    "BL": "leem",  # Brikgronden (loess)
}
```

**Implementation approach:** Parse the `soilcode` prefix character(s) to determine grondsoort. The prefix system is deterministic -- the first uppercase letter(s) before digits identify the major soil group. Build a `classify_soil_code(code: str) -> str` function that walks the prefix lookup. Fall back to `"onbekend"` for unrecognized codes.

### Caching Strategy

| Data | Cache Key Pattern | TTL | Rationale |
|------|------------------|-----|-----------|
| Soil type per RD coordinate | `bro-bodem:rd:{round(x)}:{round(y)}` | 365 days | Soil map changes once per ~5 years (last update V2025-1) |

Use the existing `get_cached_or_fetch` pattern from `cache_manager.py`, identical to how `bodem_aggregator.py` works.

---

## New API 2: PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek

### Endpoint Details (Verified via Live API Call)

**Service:** PDOK Funderingsproblematiek WFS v1.0
**Provider:** RVO (Rijksdienst voor Ondernemend Nederland)
**Auth:** None required (public, CC0 licensed)
**Protocol:** WFS 2.0.0

**Base URL:** `https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0`

**Feature type:** `indgebfunderingsproblematiek:indgebfunderingsproblematiek`
**CRS:** EPSG:28992 (RD New) -- native, matches our existing coordinate system

**Two query strategies (both verified):**

1. **Spatial query by BBOX** (for area scans):
```
GET {BASE_URL}?
  request=GetFeature&
  service=WFS&
  version=2.0.0&
  typenames=indgebfunderingsproblematiek:indgebfunderingsproblematiek&
  outputFormat=application/json&
  bbox={minx},{miny},{maxx},{maxy},urn:ogc:def:crs:EPSG::28992&
  count=100
```

2. **Filter by postcode** (for parcel-level lookup):
```
GET {BASE_URL}?
  request=GetFeature&
  service=WFS&
  version=2.0.0&
  typenames=indgebfunderingsproblematiek:indgebfunderingsproblematiek&
  outputFormat=application/json&
  CQL_FILTER=pc6='5912AA'
```

**Response schema (verified from live call, Venlo area):**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "properties": {
      "pc6": "5927NX",
      "woonplaats": "Venlo",
      "gemeente": "Venlo",
      "provincie": "Gelderland",
      "fgr": "Hogere Zandgronden",
      "afk": "hz",
      "perc_fgr": "95.16766960541688",
      "percvoor1970": "66.66666666666666",
      "n_bag": "7",
      "nvoor1970": "4",
      "legenda": "Niet kwetsbaar gebied - 60-80 %",
      "popuptext": "...(HTML text with context)...",
      "website": "http://www.kcaf.nl"
    },
    "geometry": { "type": "MultiPolygon", "coordinates": [...] }
  }]
}
```

**Key fields for risk assessment:**

| Field | Type | Description | Use |
|-------|------|-------------|-----|
| `pc6` | string | Postcode 6 | Lookup key |
| `fgr` | string | Fysiografische regio | "Rivierengebied", "Hogere Zandgronden", etc. -- soil bearing context |
| `afk` | string | Regio abbreviation | "ri" (rivieren), "hz" (hogere zand), etc. |
| `percvoor1970` | string (float) | Percentage buildings pre-1970 | Area-level risk indicator |
| `n_bag` | string (int) | Total BAG buildings in PC6 | Context for statistics |
| `nvoor1970` | string (int) | Buildings pre-1970 in PC6 | Raw count |
| `legenda` | string | Risk label | "Kwetsbaar gebied - 40-60 %", "Niet kwetsbaar gebied - 60-80 %" |
| `perc_fgr` | string (float) | Percentage of PC6 area in this soil region | Confidence indicator |

**Critical data interpretation:**
- `fgr` values that indicate WEAK soil (higher foundation risk): `"Rivierengebied"`, `"Zeekleigebied"`, `"Veengebied"`, `"Kustgebied"`
- `fgr` values that indicate STRONG soil (lower foundation risk): `"Hogere Zandgronden"`, `"Lossgebied"` (partial)
- `legenda` combines soil vulnerability with pre-1970 building percentage into a risk label
- Data is per POSTCODE (PC6), NOT per parcel -- use as area context signal only

### Caching Strategy

| Data | Cache Key Pattern | TTL | Rationale |
|------|------------------|-----|-----------|
| Funderingsdata per PC6 | `fundering:pc6:{postcode}` | 180 days | Dataset updated infrequently (~annually) |

---

## Foundation Risk Heuristic Engine

### Architecture: Pure Python, No Dependencies

The heuristic combines three inputs to produce a risk classification:

```
INPUT:
  1. bouwjaar (from BAG, already available in scan data)
  2. grondsoort (from BRO Bodemkaart WMS -- NEW)
  3. PDOK funderingsgebied context (from WFS -- NEW)

OUTPUT:
  FunderingRisico {
    risk_level: "hoog" | "middel" | "laag" | "onbekend"
    reden: str  (explanation)
    bouwjaar: int | None
    grondsoort: str | None  ("klei", "veen", "zand", "leem", "onbekend")
    fysiografische_regio: str | None
    funderingsgebied_legenda: str | None
  }
```

### Risk Matrix

| Bouwjaar | Grondsoort | Risk | Rationale |
|----------|-----------|------|-----------|
| < 1970 | veen | HOOG | Pre-1970 likely wooden pile foundation on compressible peat |
| < 1970 | klei | HOOG | Wooden/shallow foundations on shrink-swell clay |
| < 1970 | zand | MIDDEL | Old building but stable soil; only risk if groundwater issues |
| < 1970 | leem | MIDDEL | Old building on moderate bearing capacity |
| 1970-1993 | veen/klei | MIDDEL | Concrete piles likely but soil still problematic |
| 1970-1993 | zand/leem | LAAG | Modern foundation on stable soil |
| >= 1994 | any | LAAG | Modern building codes ensure adequate foundations |
| None | any | ONBEKEND | Cannot assess without bouwjaar |
| any | None | ONBEKEND | Cannot assess without soil data |

**No external library needed.** This is a decision tree with ~10 branches.

---

## Asbestos Indicator v2 Refinement

### What Changes from v1

**Current v1** (`asbest_indicator.py`): Pure bouwjaar-based NEN 2991 bands.

**v2 additions:**
1. **Building function** (from BAG `gebruiksdoel`): Schools (`onderwijs`) and factories (`industrie`) had higher asbestos use, especially for insulation and floor tiles.
2. **Grondsoort context** (from new BRO data): When soil contamination from bodemloket overlaps with asbest-period building on klei/veen, risk of soil-bound asbestos fibers increases.

**Implementation:** Extend `assess_asbest_risk()` to accept optional `gebruiksdoel: str | None` and `grondsoort: str | None` parameters. The risk classification stays the same (geen/middel/hoog/onbekend) but the `reden` text becomes richer.

```python
def assess_asbest_risk(
    *,
    building: BuildingData | None,
    gebruiksdoel: str | None = None,  # NEW
    has_bodem_dossiers: bool = False,  # NEW
) -> AsbestIndicator:
    ...
```

**No new dependencies.** Same pure Python logic, extended branches.

---

## New Code Modules Required

| Module | Purpose | Pattern follows |
|--------|---------|----------------|
| `government_apis/bro_bodemkaart.py` (new) | BRO Bodemkaart WMS GetFeatureInfo client | `bodemloket_arcgis.py` -- same async + rate limiter pattern |
| `government_apis/pdok_funderingsproblematiek.py` (new) | PDOK Funderingsproblematiek WFS client | `bag_wfs.py` -- same WFS query pattern |
| `services/soil_classifier.py` (new) | Soil code prefix to grondsoort mapping | Pure Python dict lookup |
| `services/foundation_risk.py` (new) | Foundation risk heuristic engine | `asbest_indicator.py` -- same pure function pattern |
| `services/fysiek_risico_aggregator.py` (new) | Orchestrates all physical risk data + caching | `bodem_aggregator.py` -- same cache pattern |
| `schemas/fysiek_risico.py` (new) | Pydantic models: `Grondsoort`, `FunderingRisico`, `FysiekRisicoprofiel` | `schemas/bodem.py` |
| `services/asbest_indicator.py` (extend) | Add `gebruiksdoel` and `has_bodem_dossiers` params | Existing file |

### New Rate Limiters

```python
# In rate_limiter.py -- add two new limiters

# BRO Bodemkaart WMS (PDOK/TNO) -- public, polite limits
bro_bodemkaart_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# PDOK Funderingsproblematiek WFS (RVO) -- public, polite limits
funderingsproblematiek_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)
```

Both are PDOK-hosted public endpoints with the same infrastructure as BAG WFS, so identical rate limits are appropriate.

### Alembic Migration

No new database tables needed. All data is cached via the existing JSONB cache infrastructure (`get_cached_or_fetch`). The physical risk data is derived from public APIs and computed heuristics -- no persistent storage beyond the existing cache.

---

## API Integration Patterns

### BRO Bodemkaart Client (WMS GetFeatureInfo)

This is a WMS, NOT a WFS. The query pattern differs from other PDOK clients:

```python
class BROBodemkaartClient:
    """WMS GetFeatureInfo client for BRO Bodemkaart soil classification."""

    BASE_URL = "https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0"
    WINDOW_SIZE = 1000  # 1km bbox window (meters, RD coordinates)

    async def get_soil_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Query soil classification at RD coordinate via WMS GetFeatureInfo.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient

        Returns:
            Dict with soilcode, normal_soilprofile_name, etc. or None if no data.
        """
        half = self.WINDOW_SIZE / 2
        params = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": "soilarea",
            "query_layers": "soilarea",
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": f"{x - half},{y - half},{x + half},{y + half}",
            "width": "100",
            "height": "100",
            "i": "50",  # center pixel
            "j": "50",
        }
        ...
```

**Why WMS GetFeatureInfo instead of WFS:**
- BRO Bodemkaart WFS has been **phased out** by PDOK (confirmed via Geoforum announcement)
- WMS GetFeatureInfo with `info_format=application/json` returns structured JSON -- equally usable
- Same data, same accuracy, just different protocol
- OGC API Features endpoint was NOT found at expected PDOK API paths (tested `/bzk/` and `/tno/`)

### PDOK Funderingsproblematiek Client (WFS GetFeature)

Standard WFS 2.0.0 pattern, similar to existing `bag_wfs.py`:

```python
class FunderingsproblematiekClient:
    """WFS client for PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek."""

    BASE_URL = "https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0"
    TYPENAME = "indgebfunderingsproblematiek:indgebfunderingsproblematiek"

    async def get_by_postcode(
        self,
        postcode: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Query foundation risk data for a PC6 postcode area."""
        params = {
            "request": "GetFeature",
            "service": "WFS",
            "version": "2.0.0",
            "typenames": self.TYPENAME,
            "outputFormat": "application/json",
            "CQL_FILTER": f"pc6='{postcode}'",
        }
        ...
```

**Postcode lookup preferred over spatial query** because:
1. The dataset IS per-postcode -- each feature covers one PC6 area
2. CQL_FILTER by pc6 returns exactly 0 or 1 result -- fast and deterministic
3. Postcode is already available from BAG/PDOK address data in scan results
4. Spatial BBOX queries may return multiple overlapping PC6 polygons

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `owslib` | Python WMS/WFS wrapper -- adds dependency for simple GET requests that httpx handles fine |
| `geopandas` | Heavy dependency (pandas + shapely + fiona) for reading WFS -- we only need JSON parsing |
| `gdal` / `rasterio` | Not raster analysis -- WMS GetFeatureInfo returns JSON, not raster data |
| `fiona` | GML/GeoJSON reading -- httpx + json stdlib suffice |
| `requests-cache` | Already have JSONB caching via `get_cached_or_fetch` |
| `BRO Python client` | No official client exists; community wrappers are unmaintained |
| `recharts` / `chart.js` | Risk assessment is discrete categories, not chart data -- colored badges suffice |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Soil type data | BRO Bodemkaart WMS GetFeatureInfo | bodemdata.nl direct | bodemdata.nl has no documented REST API; BRO Bodemkaart WMS is PDOK-hosted, stable, returns same WUR soil data |
| Soil type data | BRO Bodemkaart WMS GetFeatureInfo | PDOK Grondsoortenkaart WFS | Grondsoortenkaart is 4-class simplified (klei/zand/veen/leem); Bodemkaart gives full BRO codes with Dutch soil name for richer risk descriptions |
| Soil type data | BRO Bodemkaart WMS GetFeatureInfo | BRO OGC API Features | Tested -- endpoint not found at expected PDOK API paths; WMS is confirmed working |
| Foundation risk | PDOK Funderingsproblematiek WFS | FunderMaps API | FunderMaps is proprietary/paid; PDOK data is free CC0 and sufficient for indicative risk |
| Foundation risk | PDOK Funderingsproblematiek WFS | BRO Grondwatermonitoring | 380 wells nationwide (~10km apart) is too sparse for per-parcel assessment |
| Foundation risk | PC6 postcode filter | Spatial BBOX query | Dataset is per-PC6; postcode filter returns exact match; BBOX returns multiple overlapping polygons |
| Soil classification | Static Python dict | Machine learning classifier | Soil codes follow deterministic prefix rules; ML adds complexity for zero value |
| Asbestos v2 | Extend existing function | Separate service | Same risk classification framework; adding params is simpler than a new module |

---

## Frontend: No New Dependencies

All frontend features use existing libraries:

| Feature | Implementation | Library |
|---------|---------------|---------|
| Fysiek Risicoprofiel section | React component in ParcelDetailModal | Existing React + Tailwind |
| Risk level badges | Colored badges (hoog=red, middel=amber, laag=green) | Existing Tailwind color tokens |
| Soil type display | Text with soil code and Dutch name | Plain text |
| Foundation risk card | Expandable card with risk level + explanation | Existing card patterns |
| Asbestos risk (v2) | Updated card showing refined risk with building function | Existing patterns |

**Why no visualization library:** Physical risk is categorical data (hoog/middel/laag), not quantitative. Colored badges and explanation text are the appropriate UI pattern. No charts needed.

---

## Integration Points with Existing Data

The physical risk assessment integrates data already available in the scan pipeline:

| Data | Source | Already Available? | How |
|------|--------|-------------------|-----|
| Bouwjaar | BAG WFS | YES | `scan_results.data['building']['bouwjaar']` |
| Postcode | BAG/PDOK | YES | `scan_results.data['address']['postcode']` |
| RD coordinates (x, y) | Parcel centroid | YES | `scan_results.data['parcel']['centroid']` |
| Gebruiksdoel | BAG API | YES | `scan_results.data['building']['gebruiksdoel']` |
| Bodemloket dossiers | ArcGIS REST | YES | `scan_results.data['bodem_data']['dossiers']` |

**No new scan data needed.** The fysiek risicoprofiel is computed on-demand from existing parcel data plus the two new API calls (BRO Bodemkaart + PDOK Funderingsproblematiek).

---

## Sources

- PDOK BRO Bodemkaart WMS GetCapabilities: `https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0?request=GetCapabilities&service=WMS` (HIGH confidence -- verified live)
- PDOK BRO Bodemkaart WMS GetFeatureInfo: verified live for `soilarea` layer at Venlo coordinates, returns `soilcode`, `normal_soilprofile_name` (HIGH confidence)
- BRO Bodemkaart WFS phase-out: [Geoforum announcement](https://geoforum.nl/t/pdok-faseert-huidige-webservices-bodemkaart-en-geomorfologische-kaart-uit/3351) (HIGH confidence)
- PDOK Funderingsproblematiek WFS GetCapabilities: `https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0?request=GetCapabilities&service=WFS` (HIGH confidence -- verified live)
- PDOK Funderingsproblematiek sample data: verified live via WFS GetFeature with GeoJSON output, Venlo area (HIGH confidence)
- [PDOK Funderingsproblematiek introduction](https://www.pdok.nl/introductie/-/article/indicatieve-aandachtsgebieden-funderingsproblematiek) (HIGH confidence -- official PDOK page)
- [Data.overheid.nl dataset description](https://data.overheid.nl/dataset/11058-indicatieve-aandachtsgebieden-funderingsproblematiek) (HIGH confidence)
- [BRO Catalogus Bodemkaart (SGM)](https://docs.geostandaarden.nl/bro/SGM/) -- soil code classification system (HIGH confidence -- official BRO spec)
- [WUR Legenda's en indelingen op bodemkaarten](https://landschapsleutel.wur.nl/documentatie/htm/Legendas%20Bodemkaarten.htm) -- soil code prefix meanings (MEDIUM confidence -- WUR documentation, not always current)
- Existing codebase: `bodemloket_arcgis.py`, `asbest_indicator.py`, `bodem_aggregator.py`, `bag_wfs.py`, `rate_limiter.py`, `cache_manager.py` (HIGH confidence -- direct code review)

---

*Stack research for: Propdex v14.0 Fysiek Risicoprofiel*
*Researched: 2026-03-09*
