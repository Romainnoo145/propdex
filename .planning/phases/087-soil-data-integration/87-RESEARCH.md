# Phase 87: Soil Data Integration - Research

**Researched:** 2026-03-09
**Domain:** BRO Bodemkaart WMS soil classification + PDOK Funderingsrisicogebieden WFS
**Confidence:** HIGH

## Summary

Phase 87 integrates two new PDOK data sources into the existing property aggregation pipeline: (1) BRO Bodemkaart WMS for per-coordinate soil type classification (klei/veen/zand/leem), and (2) PDOK Funderingsrisicogebieden WFS for postcode-level foundation risk area context. Both endpoints are public, free (CC0), require no authentication, and have been verified via live API calls with real Venlo data during milestone research.

The implementation requires zero new dependencies. Both data sources are queryable via existing httpx, follow the established government API client pattern (rate limiter + retry_with_backoff + cache_manager), and integrate into the existing `asyncio.gather()` parallel fetch in `property_aggregator.py`. The soil code classification is a static Python dict lookup mapping BRO soil code prefixes to four risk-relevant categories.

The critical distinction this phase MUST maintain: BRO Bodemkaart provides per-coordinate soil type (parcel-specific), while PDOK Funderingsrisicogebieden provides postcode-level area context (NOT parcel-specific). The phase must also handle coverage gaps gracefully -- coordinates outside bodemkaart coverage (water, urban fill, reclaimed land) must return "onbekend" with explanation, never an error.

**Primary recommendation:** Build BRO Bodemkaart WMS client + soil classifier + PDOK Funderingsrisico WFS client + Pydantic schemas + JSONB caching, all following existing bodemloket_arcgis.py / bodem_aggregator.py patterns exactly.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BODEM-01 | User sees soil type classification (klei/veen/zand/leem) for any parcel via BRO Bodemkaart WMS | BRO WMS GetFeatureInfo endpoint verified live, returns soilcode + Dutch name. Soil code prefix mapping documented in STACK.md. Coverage gaps handled by returning "onbekend". |
| BODEM-02 | User sees PDOK Funderingsrisicogebieden context (% pre-1970, soil region, risk label) for parcel's postal code area | PDOK WFS GetFeature with CQL_FILTER by pc6 verified live. Returns percvoor1970, fgr, legenda. Postcode available from `address.postcode` in property_aggregator.py. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | >=0.27.0 (existing) | HTTP client for WMS GetFeatureInfo + WFS GetFeature | Already used for all 12 government API clients |
| aiolimiter | >=1.2.0 (existing) | Rate limiting via APIRateLimiter | Already used for all external API calls |
| pydantic | v2 (existing) | Schema validation for SoilProfile + FunderingsrisicogebiedData | Already used for all API response schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pyproj | >=3.7.0 (existing) | CRS transformation (not needed -- BRO WMS uses EPSG:28992 natively) | Only if a future soil API requires WGS84 input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BRO Bodemkaart WMS | WUR soilphysics.wur.nl REST | WUR is undocumented internal endpoint, no SLA, could break without notice. PDOK WMS is official, versioned. |
| BRO Bodemkaart WMS | PDOK Grondsoortenkaart WFS | Grondsoortenkaart is 4-class simplified; Bodemkaart gives full BRO codes with richer soil descriptions |
| BRO Bodemkaart WMS | Download Bodemkaart into PostGIS | Eliminates runtime API dependency but requires schema migration + data management. Future optimization, not v14.0. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  government_apis/
    bro_bodemkaart.py        # NEW: WMS GetFeatureInfo client
    pdok_funderingsrisico.py  # NEW: WFS GetFeature client
    rate_limiter.py           # MODIFY: add 2 new limiters
  schemas/
    fysiek_risico.py          # NEW: SoilProfile, FunderingsrisicogebiedData, FoundationRisk, FysiekRisicoProfiel
  services/
    soil_classifier.py        # NEW: static dict mapping soilcode prefix -> grondsoort
    soil_aggregator.py        # NEW: fetch + cache soil data (follows bodem_aggregator.py pattern)
    funderingsrisico_aggregator.py  # NEW: fetch + cache PDOK funderingsrisico data
  core/
    config.py                 # MODIFY: add CACHE_TTL entries
```

### Pattern 1: Government API Client (follow bodemloket_arcgis.py)
**What:** Async class with query methods accepting httpx.AsyncClient, using rate limiter and retry_with_backoff.
**When to use:** Every external government API integration.
**Example:**
```python
# Source: existing bodemloket_arcgis.py pattern
class BROBodemkaartClient:
    BASE_URL = "https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0"

    async def get_soil_at_point(
        self, x: float, y: float, client: httpx.AsyncClient
    ) -> dict | None:
        half = 500  # 1km window (meters, RD)
        params = {
            "service": "WMS", "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": "soilarea", "query_layers": "soilarea",
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": f"{x - half},{y - half},{x + half},{y + half}",
            "width": "100", "height": "100", "i": "50", "j": "50",
        }
        async with bro_bodemkaart_limiter:
            response = await retry_with_backoff(
                lambda: client.get(self.BASE_URL, params=params, timeout=15.0),
                source="bro_bodemkaart",
            )
        if response.status_code != 200:
            raise GovernmentAPIError("bro_bodemkaart", f"HTTP {response.status_code}")
        data = response.json()
        features = data.get("features", [])
        if not features:
            return None  # No coverage at this coordinate
        return features[0].get("properties", {})

bro_bodemkaart_client = BROBodemkaartClient()  # Module-level singleton
```

### Pattern 2: Aggregator with JSONB Cache (follow bodem_aggregator.py)
**What:** Async function wrapping API client with get_cached_or_fetch(). Cache key uses rounded coordinates.
**When to use:** Every external API data fetch.
**Example:**
```python
# Source: existing bodem_aggregator.py pattern
async def fetch_soil_profile(
    x: float, y: float, client: httpx.AsyncClient,
    organization_id: uuid.UUID, session: AsyncSession,
    force_refresh: bool = False,
) -> SoilProfile | None:
    cache_key = f"bro_bodemkaart:rd:{round(x)}:{round(y)}"

    async def fetch_fn() -> dict:
        props = await bro_bodemkaart_client.get_soil_at_point(x, y, client)
        if props is None:
            return {"soilcode": None, "dominant_type": "onbekend",
                    "dominant_type_label": "Onbekend (geen BRO dekking)"}
        soilcode = props.get("soilcode", "")
        grondsoort = classify_soil_code(soilcode)
        return {
            "soilcode": soilcode,
            "soilname": props.get("normal_soilprofile_name", ""),
            "dominant_type": grondsoort,
            "dominant_type_label": GRONDSOORT_LABELS[grondsoort],
        }

    cached = await get_cached_or_fetch(
        cache_key=cache_key, source="bro_bodemkaart",
        organization_id=organization_id, fetch_fn=fetch_fn,
        session=session, force_refresh=force_refresh,
    )
    return SoilProfile.model_validate(cached.data)
```

### Pattern 3: Static Lookup Classification (soil_classifier.py)
**What:** Pure function mapping BRO soil code prefix to grondsoort category via static dict.
**When to use:** Deterministic classification from known code systems.
**Example:**
```python
# Source: BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/)
SOIL_PREFIX_TO_GRONDSOORT: dict[str, str] = {
    "V": "veen", "aV": "veen", "hV": "veen", "pV": "veen",
    "kV": "veen", "iV": "veen",
    "M": "klei", "R": "klei", "pM": "klei", "kM": "klei",
    "Z": "zand", "Y": "zand", "H": "zand", "cY": "zand", "Zd": "zand",
    "L": "leem", "BL": "leem",
}

def classify_soil_code(code: str) -> str:
    """Classify BRO soilcode prefix to grondsoort category."""
    if not code:
        return "onbekend"
    # Try longest prefix first (2 chars), then 1 char
    for length in (2, 1):
        prefix = code[:length]
        if prefix in SOIL_PREFIX_TO_GRONDSOORT:
            return SOIL_PREFIX_TO_GRONDSOORT[prefix]
    return "onbekend"
```

### Anti-Patterns to Avoid
- **Using bodemdata.nl or WUR soilphysics.wur.nl:** These are undocumented internal endpoints with no SLA. Use PDOK BRO Bodemkaart WMS exclusively.
- **Adding postcode column to ParcelCache:** Postcode is already available from `address.postcode` in the aggregator. Do not add a migration.
- **Using GetMap instead of GetFeatureInfo:** GetMap returns an image. GetFeatureInfo with `info_format=application/json` returns structured data.
- **Sending WGS84 coordinates to BRO WMS:** The WMS uses EPSG:28992 (RD New) natively. Propdex stores coordinates in RD. No transformation needed.
- **Storing derived soil classification in a new DB table:** Use existing JSONB cache infrastructure. Soil classification is computed from cached API response + static lookup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retry with backoff | Custom retry loop | `retry_with_backoff()` from `base.py` | Already handles 429, configurable retries |
| API response caching | Custom cache table | `get_cached_or_fetch()` from `cache_manager.py` | Handles upsert, TTL, cache hit/miss, organization isolation |
| Rate limiting | asyncio.sleep() delays | `APIRateLimiter` from `rate_limiter.py` | Combines semaphore (concurrency) + token bucket (throughput) |
| Soil code taxonomy | Database lookup table | Static Python dict in `soil_classifier.py` | BRO soil codes are a fixed classification system, not dynamic data |
| CRS transformation | Manual math | `pyproj.Transformer` (if needed) | Already in `rce_monuments.py` -- but NOT needed here since BRO WMS accepts EPSG:28992 |

**Key insight:** This phase introduces zero new patterns. Every component follows an existing, tested pattern in the codebase. The only novelty is the WMS GetFeatureInfo protocol (vs WFS/REST), but it is still a simple HTTP GET returning JSON.

## Common Pitfalls

### Pitfall 1: Wrong Soil Data Source
**What goes wrong:** Using bodemdata.nl, WUR soilphysics.wur.nl, or other undocumented endpoints instead of PDOK BRO Bodemkaart WMS.
**Why it happens:** bodemdata.nl sounds like an API; WUR soilphysics.wur.nl was tested and works. But neither has a documented public API, versioning, or SLA.
**How to avoid:** Use `https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0` exclusively. This is PDOK-hosted, versioned, CC0 licensed.
**Warning signs:** Any URL containing "bodemdata.nl" or "soilphysics.wur.nl" in the client code.

### Pitfall 2: BRO Bodemkaart Coverage Gaps Causing Errors
**What goes wrong:** Coordinates over water bodies, urban fill areas, or recent land reclamation return empty feature collections from GetFeatureInfo. Code raises an exception instead of returning "onbekend".
**Why it happens:** The Bodemkaart is at 1:50,000 scale and does not cover all of the Netherlands. Urban areas with historical fill, water bodies, and post-publication reclamation have no data.
**How to avoid:** When `features` list is empty, return `SoilProfile(dominant_type="onbekend", ...)` with explanation "Geen BRO bodemdata beschikbaar voor deze locatie." Never raise an error for missing coverage.
**Warning signs:** Any `raise` or `assert` after checking `len(features)`.

### Pitfall 3: PDOK Funderingsgebieden Treated as Parcel-Specific
**What goes wrong:** Displaying PDOK data (percvoor1970, legenda) as if it describes a specific building rather than a postcode area.
**Why it happens:** The WFS returns a polygon that spatially contains the parcel, making it seem parcel-specific.
**How to avoid:** Always label as "aandachtsgebied" context. Schema must include a disclaimer field. Phase 88 combines this with per-parcel bouwjaar for the actual risk assessment.
**Warning signs:** UI text saying "Dit pand heeft funderingsrisico" based solely on PDOK data.

### Pitfall 4: WMS GetFeatureInfo BBOX Miscalculation
**What goes wrong:** Using too small a BBOX (0 width/height) or wrong pixel coordinates (i/j), causing GetFeatureInfo to return no features even when data exists.
**Why it happens:** WMS GetFeatureInfo requires a valid BBOX with non-zero area, plus pixel coordinates (i, j) within the width x height grid. The pixel must fall on the actual soil polygon.
**How to avoid:** Use a 1km window (500m half-width in RD meters) with 100x100 pixel grid and center pixel (i=50, j=50). This is verified to work from STACK.md live testing.
**Warning signs:** GetFeatureInfo returning empty features for coordinates that should have soil data.

### Pitfall 5: PDOK WFS Property Types Are All Strings
**What goes wrong:** Code assumes `percvoor1970` is a float and `n_bag` is an int. They are strings in the WFS response.
**Why it happens:** DescribeFeatureType shows all properties as string type. The values look numeric but are returned as strings like `"66.66666666666666"`.
**How to avoid:** Parse explicitly: `float(props.get("percvoor1970", "0"))` with try/except for malformed values. Use Pydantic validators or model_validator to handle the conversion.
**Warning signs:** `TypeError: '<' not supported between instances of 'str' and 'float'` at runtime.

## Code Examples

### BRO Bodemkaart WMS GetFeatureInfo Request (verified live)
```python
# Source: STACK.md verified live API call
# GET https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0?
#   service=WMS&version=1.3.0&request=GetFeatureInfo&
#   layers=soilarea&query_layers=soilarea&
#   info_format=application/json&crs=EPSG:28992&
#   bbox={x-500},{y-500},{x+500},{y+500}&
#   width=100&height=100&i=50&j=50

# Response:
{
    "type": "FeatureCollection",
    "features": [{
        "properties": {
            "soilcode": "cY23",
            "normal_soilprofile_name": "Loopodzolgronden; lemig fijn zand",
            "maparea_collection": "Eerste opname met uitgebreide veldverkenning"
        }
    }]
}
```

### PDOK Funderingsrisicogebieden WFS by Postcode (verified live)
```python
# Source: STACK.md verified live API call
# GET https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0?
#   request=GetFeature&service=WFS&version=2.0.0&
#   typenames=indgebfunderingsproblematiek:indgebfunderingsproblematiek&
#   outputFormat=application/json&CQL_FILTER=pc6='5927NX'

# Response:
{
    "type": "FeatureCollection",
    "features": [{
        "properties": {
            "pc6": "5927NX",
            "gemeente": "Venlo",
            "fgr": "Hogere Zandgronden",
            "percvoor1970": "66.66666666666666",  # STRING, not float
            "n_bag": "7",                          # STRING, not int
            "legenda": "Niet kwetsbaar gebied - 60-80 %"
        }
    }]
}
```

### Soil Code Prefix Classification Reference
```python
# Source: BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/)
# First character(s) before digits determine the major soil group:
# V = Veengronden (peat) -- highest foundation risk
# M = Zeekleigronden, R = Rivierkleigronden (clay) -- moderate-high risk
# Z = Zandgronden, Y = Vaaggronden, H = Podzolgronden (sand) -- low risk
# L = Leemgronden / Lossgronden (loess/silt) -- moderate risk
# Lowercase prefixes modify: p = polder, k = knipklei, c = cumulatief, etc.
```

### Cache TTL Configuration
```python
# Add to CACHE_TTL dict in config.py:
"bro_bodemkaart": 31536000,        # 365 days (soil map updated ~every 5 years)
"pdok_funderingsrisico": 15552000,  # 180 days (dataset updated ~annually)
```

### Rate Limiter Configuration
```python
# Add to rate_limiter.py:
# BRO Bodemkaart WMS (PDOK/TNO) -- public, polite limits
bro_bodemkaart_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)

# PDOK Funderingsproblematiek WFS (RVO) -- public, polite limits
pdok_funderingsrisico_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BRO Bodemkaart via WFS | BRO Bodemkaart via WMS only | ~2024 (PDOK phased out WFS) | Must use GetFeatureInfo, not GetFeature |
| OGC WFS for all PDOK data | Mix of WMS/WFS/OGC API Features | 2023-2025 | Check each dataset individually for available protocols |

**Deprecated/outdated:**
- BRO Bodemkaart WFS endpoint -- phased out by PDOK (Geoforum announcement)
- bodemdata.nl as a programmatic API -- it is a viewer application, not an API

## Open Questions

1. **Soil code prefix completeness**
   - What we know: The static dict covers the most common prefixes (V, M, R, Z, Y, H, L, BL, and their lowercase-prefixed variants)
   - What's unclear: Edge cases like "W" (waterbodem), "G" (grindgronden), "S" (steengronden) may exist but are rare
   - Recommendation: Start with the documented prefixes, log any unrecognized codes as warnings, classify as "onbekend". Extend the dict based on production logs.

2. **PDOK Funderingsrisico CQL_FILTER support**
   - What we know: PITFALLS.md warns CQL_FILTER may not be supported. STACK.md shows it working in a verified live test.
   - What's unclear: Whether all PDOK WFS instances support CQL_FILTER or if it is dataset-specific.
   - Recommendation: Use CQL_FILTER by postcode as primary strategy (verified working). Fall back to BBOX spatial query if CQL_FILTER fails with 400.

3. **Postcode availability for parcels without addresses**
   - What we know: `address.postcode` is available in property_aggregator for addressed parcels. Bouwkavels (empty parcels) may lack addresses.
   - What's unclear: What percentage of parcels lack postcode data.
   - Recommendation: When postcode is unavailable, skip PDOK funderingsrisico lookup and return None for that field. Soil type (coordinate-based) still works.

## Sources

### Primary (HIGH confidence)
- PDOK BRO Bodemkaart WMS GetFeatureInfo -- verified live 2026-03-09, soilarea layer, returns soilcode/soilname JSON
- PDOK Funderingsrisicogebieden WFS GetFeature -- verified live 2026-03-09, CQL_FILTER by pc6, returns GeoJSON
- BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/) -- soil code prefix classification system
- Existing codebase: bodemloket_arcgis.py, bodem_aggregator.py, cache_manager.py, rate_limiter.py, base.py, property_aggregator.py

### Secondary (MEDIUM confidence)
- WUR Legenda's en indelingen op bodemkaarten -- soil code prefix meanings (documentation not always current)
- Geoforum PDOK WFS phase-out announcement -- confirms BRO Bodemkaart WFS no longer available

### Tertiary (LOW confidence)
- WUR soilphysics.wur.nl API -- works but undocumented, explicitly NOT recommended for production use

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, both endpoints verified live
- Architecture: HIGH - follows identical patterns to 6 existing government API integrations
- Pitfalls: HIGH - all verified against existing codebase behavior and known data limitations from STACK.md/PITFALLS.md

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (30 days -- PDOK endpoints are stable, government data)
