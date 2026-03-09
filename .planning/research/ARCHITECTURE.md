# Architecture Patterns

**Domain:** Fysiek Risicoprofiel (Physical Risk Assessment) for Propdex
**Researched:** 2026-03-09
**Confidence:** HIGH (based on full codebase analysis + live API verification)

---

## Current State Assessment

The existing codebase already has two of the three physical risk domains partially implemented:

1. **Asbestos (v9.0):** `asbest_indicator.py` service does bouwjaar-based NEN 2991 risk classification. Returns `AsbestIndicator` schema with risk/bouwjaar/reden. Already wired into `property_aggregator.py` (line 1005) and `PropertyReportResponse.asbest_indicator` field.

2. **Soil contamination (v9.0):** `bodemloket_arcgis.py` client queries WBB dossiers via ArcGIS REST. `bodem_aggregator.py` wraps it with 30-day JSONB cache. Already in `asyncio.gather()` parallel fetch (index 6). Returns `BodemData` with dossier references. This is contamination data, NOT soil type (klei/veen/zand).

3. **Foundation risk:** Does not exist yet. No foundation-related service, schema, client, or API integration.

**The gap:** No soil TYPE data (klei/veen/zand/leem), no foundation risk heuristic, no PDOK funderingsrisicogebieden, no combined physical risk assessment. The existing asbest indicator uses only bouwjaar -- it does not consider building function or soil type.

---

## Recommended Architecture

### Component Map (New vs Modified)

```
NEW     backend/app/government_apis/pdok_funderingsrisico.py
          + WFS client for PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek
          + GetFeature by BBOX (EPSG:28992), GeoJSON output
          + Returns PC6-level: percvoor1970, fgr (soil region), legenda (risk class)

NEW     backend/app/government_apis/wur_bodemdata.py
          + REST client for WUR soilphysics.wur.nl/soil.php
          + Returns soil horizon profile (clay%, sand%, silt%, som%, density)
          + WGS84 coordinate input (lat/lon)

NEW     backend/app/schemas/fysiek_risico.py
          + SoilProfile (horizons with clay/sand/silt/peat composition)
          + FoundationRisk (risk level + heuristic inputs + reasoning)
          + FunderingsrisicogebiedData (PDOK PC6-level context data)
          + FysiekRisicoProfiel (combined: foundation + soil + asbest v2)

NEW     backend/app/services/soil_aggregator.py
          + Fetch soil profile from WUR with 90-day JSONB cache
          + Classify dominant soil type: klei/veen/zand/leem
          + Cache key: rounded lat/lon (3 decimal places = ~100m)

NEW     backend/app/services/funderingsrisico_aggregator.py
          + Fetch PDOK WFS data by point (BBOX around RD coordinate)
          + Cache by PC6 (postcode 6-digit) with 30-day TTL
          + Return context signal (not per-parcel assessment)

NEW     backend/app/services/foundation_risk_engine.py
          + Heuristic: bouwjaar x bodemtype -> risk classification
          + Combines: BAG bouwjaar + WUR soil type + PDOK area context
          + Returns explainable risk with triggered rules

MODIFY  backend/app/services/asbest_indicator.py
          + Accept optional gebruiksdoel (building function) + bodemtype
          + School/fabriek = higher risk multiplier (more asbestos materials)
          + Soil type as secondary signal (klei = trapped fibers)

MODIFY  backend/app/services/property_aggregator.py
          + Add soil + funderingsrisico to asyncio.gather (parallel fetch)
          + Post-gather: run foundation_risk_engine + asbest v2
          + Add fysiek_risico_profiel to PropertyReportResponse

MODIFY  backend/app/schemas/property.py
          + Add FysiekRisicoProfiel field to PropertyReportResponse
          + Extend AsbestIndicator with optional building function fields

MODIFY  backend/app/core/config.py
          + Add CACHE_TTL entries: "wur_bodemdata", "pdok_funderingsrisico"

MODIFY  backend/app/government_apis/rate_limiter.py
          + Add wur_bodemdata_limiter + pdok_funderingsrisico_limiter

NEW     frontend: FysiekRisicoProfiel section in ParcelDetailModal
          + Combined risk assessment card
          + Foundation risk with heuristic explanation
          + Soil type indicator with horizon visualization
          + Asbest v2 with building function context
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `WURBodemdataClient` (new) | HTTP GET to soilphysics.wur.nl, JSON parsing, soil horizon extraction | `rate_limiter`, `cache_manager` |
| `PDOKFunderingsrisicoClient` (new) | WFS GetFeature to PDOK, GML/GeoJSON parsing, PC6-level data | `rate_limiter`, `cache_manager` |
| `SoilAggregator` (new) | Fetch + cache soil profile, classify dominant type | `WURBodemdataClient`, `cache_manager` |
| `FunderingsrisicoAggregator` (new) | Fetch + cache PDOK area risk, extract per-PC6 attributes | `PDOKFunderingsrisicoClient`, `cache_manager` |
| `FoundationRiskEngine` (new) | Heuristic combining bouwjaar + soil type + area context | `SoilAggregator`, `FunderingsrisicoAggregator` (via results) |
| `AsbestIndicator` (modified) | Bouwjaar + building function + soil type -> risk level | Pure function (no I/O) |
| `PropertyAggregator` (modified) | Orchestrates parallel fetch, assembles report | All aggregators + engines |
| Frontend `FysiekRisicoProfiel` (new) | Renders combined risk card in ParcelDetailModal | API response data only |

---

## Data Flow

### Per-Parcel Physical Risk Assessment (Primary Use Case)

```
User opens ParcelDetailModal (or generates report)
  -> property_aggregator.aggregate_property_data() called
  -> STEP 1: Resolve address (BAG) -> get bouwjaar, gebruiksdoel, geometry
  -> STEP 2a: asyncio.gather() parallel fetch (EXISTING + NEW):
       [0] cadastral_parcels
       [1] zoning
       [2] monuments
       [3] energy_label
       [4] woz_data
       [5] market_data
       [6] bodem (existing bodemloket contamination)
       [7] soil_profile (NEW - WUR soilphysics)          <-- ADD
       [8] funderingsrisico_context (NEW - PDOK WFS)     <-- ADD
  -> STEP 2b: Sequential BRK ownership
  -> STEP 3: AI parsing trigger
  -> STEP 4: Derive computed fields (EXISTING + NEW):
       - buildability_delta
       - wkb_precheck
       - wkb_classification
       - asbest_indicator (MODIFIED: now with gebruiksdoel + soil type)
       - foundation_risk (NEW: bouwjaar x soil type x area context)   <-- ADD
       - fysiek_risico_profiel (NEW: combined assessment)              <-- ADD
  -> Return PropertyReportResponse with fysiek_risico_profiel field
```

### Soil Profile Fetch Flow

```
soil_aggregator.fetch_soil_profile(lat, lon, client, org_id, session)
  -> Cache key: "wur_bodem:{lat_3dp}:{lon_3dp}" (90-day TTL)
  -> Cache miss:
       GET https://www.soilphysics.wur.nl/soil.php?latitude={lat}&longitude={lon}
       -> JSON: { id, smu, horizon: [{code, top, bottom, som, clay, silt, sand, density, spu}] }
       -> Parse into SoilProfile schema
       -> Classify dominant type from weighted average of horizons (0-120cm)
       -> Cache in CachedAPIResponse
  -> Return SoilProfile with dominant_type: "klei"|"veen"|"zand"|"leem"|"gemengd"
```

### PDOK Foundation Risk Context Fetch Flow

```
funderingsrisico_aggregator.fetch_context(x_rd, y_rd, postcode, client, org_id, session)
  -> Cache key: "pdok_funderingsrisico:pc6:{postcode6}" (30-day TTL)
  -> Cache miss:
       WFS GetFeature with CQL_FILTER: pc6='{postcode6}'
       OR BBOX around RD coordinate (10m buffer)
       -> GeoJSON: { features: [{ properties: {
            pc6, gemeente, percvoor1970, fgr, legenda, n_bag, nvoor1970
          }}]}
       -> Parse into FunderingsrisicogebiedData
       -> Cache in CachedAPIResponse
  -> Return FunderingsrisicogebiedData with legenda (risk classification)
```

### Foundation Risk Heuristic Flow

```
foundation_risk_engine.assess(bouwjaar, soil_type, pdok_context)
  -> Rule 1: bouwjaar < 1970 + klei/veen = HOOG
       "Waarschijnlijk houten palen — kwetsbaar bij dalende grondwaterstand"
  -> Rule 2: bouwjaar < 1970 + zand = LAAG
       "Zanderige bodem geeft goede draagkracht, ook voor oudere funderingen"
  -> Rule 3: bouwjaar >= 1970 + any soil = LAAG
       "Na 1970 zijn betonnen palen standaard — minder kwetsbaar"
  -> Rule 4: bouwjaar unknown = ONBEKEND
  -> Context enrichment: PDOK legenda overrides if more specific
       e.g., "Kwetsbaar gebied - >60%" from PDOK escalates to HOOG
  -> Return FoundationRisk with triggered_rules + confidence
```

---

## New Schemas

### `fysiek_risico.py`

```python
class SoilHorizon(BaseModel):
    """Single soil layer from WUR soil profile."""
    code: str
    top_cm: int
    bottom_cm: int
    clay_pct: float
    silt_pct: float
    sand_pct: float
    organic_matter_pct: float
    bulk_density: float | None = None

class SoilProfile(BaseModel):
    """Soil profile from WUR soilphysics.wur.nl."""
    soil_map_unit: str | None = None         # WUR 'smu' code
    horizons: list[SoilHorizon] = []
    dominant_type: Literal["klei", "veen", "zand", "leem", "gemengd", "onbekend"]
    dominant_type_reden: str                  # Dutch explanation
    disclaimer: str = "Indicatief bodemprofiel op basis van de Bodemkaart 1:50.000."

class FunderingsrisicogebiedData(BaseModel):
    """PDOK Funderingsrisicogebieden at PC6 level."""
    pc6: str
    gemeente: str | None = None
    fgr: str | None = None                   # Soil region (Rivierengebied, Veengebied, etc.)
    percvoor1970: float | None = None        # % buildings pre-1970
    n_bag: int | None = None                 # Total BAG buildings in PC6
    nvoor1970: int | None = None             # Count pre-1970 buildings
    legenda: str | None = None               # Risk classification text
    disclaimer: str = (
        "Indicatieve kaart op postcodeniveau — "
        "doet geen uitspraken over specifieke funderingen."
    )

class FoundationRiskRule(BaseModel):
    """Single explainable rule in foundation risk assessment."""
    code: str
    title: str
    impact: Literal["verhoogd", "verlaagd", "neutraal"]
    reason: str

class FoundationRisk(BaseModel):
    """Foundation risk assessment from heuristic engine."""
    risk: Literal["hoog", "middel", "laag", "onbekend"]
    bouwjaar: int | None = None
    bodemtype: str | None = None
    triggered_rules: list[FoundationRiskRule] = []
    pdok_context: FunderingsrisicogebiedData | None = None
    confidence: Literal["high", "medium", "low"] = "low"
    reden: str                                # Dutch summary
    disclaimer: str = (
        "Indicatieve inschatting op basis van bouwjaar en bodemtype. "
        "Geen vervanging voor funderingsonderzoek."
    )

class FysiekRisicoProfiel(BaseModel):
    """Combined physical risk profile for a property."""
    foundation_risk: FoundationRisk | None = None
    soil_profile: SoilProfile | None = None
    asbest_indicator: AsbestIndicator | None = None   # v2 with function
    bodem_data: BodemData | None = None               # existing contamination
```

---

## Patterns to Follow

### Pattern 1: Parallel Fetch with Graceful Degradation

**What:** Add soil + funderingsrisico to the existing `asyncio.gather()` in `property_aggregator.py`. Each new fetch follows the identical pattern: inner async function, try/except, append to errors list on failure, return None.

**Why:** This is how ALL existing fetches work (cadastral, zoning, monuments, energy, woz, market, bodem). Adding to the gather keeps latency flat -- the new calls run concurrently with existing ones.

**Critical constraint:** The gather result indices shift. Current bodem is at index 6. Adding two new fetches makes it index 7 and 8 (or reorganize). Use named results to avoid fragile index counting.

```python
# Better pattern: use dict-based result collection
fetch_tasks = {
    "cadastral": fetch_cadastral_parcels(),
    "zoning": fetch_zoning(),
    "monuments": fetch_monuments(),
    "energy": fetch_energy_label(),
    "woz": fetch_woz_data(),
    "market": fetch_market_data(),
    "bodem": fetch_bodem(),
    "soil": fetch_soil_profile(),           # NEW
    "funderingsrisico": fetch_funderingsrisico(),  # NEW
}
# asyncio.gather preserves order, but named keys are clearer
results = dict(zip(
    fetch_tasks.keys(),
    await asyncio.gather(*fetch_tasks.values(), return_exceptions=True),
))
```

### Pattern 2: Government API Client Pattern (Identical to Existing)

**What:** Each new API client follows the established pattern:
- Module in `backend/app/government_apis/`
- Class with async methods accepting `httpx.AsyncClient`
- Rate limiter from `rate_limiter.py`
- Uses `retry_with_backoff()` from `base.py`
- Module-level singleton instance

**Example for WUR:**

```python
# backend/app/government_apis/wur_bodemdata.py
class WURBodemdataClient:
    BASE_URL = "https://www.soilphysics.wur.nl/soil.php"

    async def get_soil_profile(
        self, lat: float, lon: float, client: httpx.AsyncClient
    ) -> SoilProfile | None:
        async with wur_bodemdata_limiter:
            response = await retry_with_backoff(
                lambda: client.get(
                    self.BASE_URL,
                    params={"latitude": lat, "longitude": lon},
                    timeout=15.0,
                ),
                source="wur_bodemdata",
            )
        if response.status_code != 200:
            raise GovernmentAPIError("wur_bodemdata", f"HTTP {response.status_code}")
        data = response.json()
        if isinstance(data, str):  # "No soil information available"
            return None
        return self._parse_profile(data)

wur_bodemdata_client = WURBodemdataClient()
```

### Pattern 3: Aggregator Service with JSONB Cache

**What:** Each new aggregator wraps the API client with `get_cached_or_fetch()` from `cache_manager.py`. Identical to existing `bodem_aggregator.py` pattern.

**When:** Every fetch that hits an external API goes through an aggregator.

```python
# backend/app/services/soil_aggregator.py
async def fetch_soil_profile(
    lat: float, lon: float, client: httpx.AsyncClient,
    organization_id: uuid.UUID, session: AsyncSession,
    force_refresh: bool = False,
) -> SoilProfile | None:
    # Round to 3 decimal places (~100m precision) for cache stability
    cache_key = f"wur_bodem:{round(lat, 3)}:{round(lon, 3)}"

    async def fetch_fn() -> dict:
        result = await wur_bodemdata_client.get_soil_profile(lat, lon, client)
        return result.model_dump() if result else {}

    cached = await get_cached_or_fetch(
        cache_key=cache_key, source="wur_bodemdata",
        organization_id=organization_id, fetch_fn=fetch_fn,
        session=session, force_refresh=force_refresh,
    )
    return SoilProfile.model_validate(cached.data) if cached.data else None
```

### Pattern 4: Pure-Function Heuristic Engine

**What:** The foundation risk engine is a pure function (no I/O, no database), identical to `asbest_indicator.py`. Takes pre-fetched data, returns risk assessment.

**Why:** Testable without mocking. Deterministic. Fast. The heuristic logic is the core domain intelligence -- it should be isolated from data fetching concerns.

```python
# backend/app/services/foundation_risk_engine.py
def assess_foundation_risk(
    *,
    bouwjaar: int | None,
    dominant_soil_type: str | None,
    pdok_context: FunderingsrisicogebiedData | None,
) -> FoundationRisk:
    rules: list[FoundationRiskRule] = []
    # ... heuristic logic ...
    return FoundationRisk(risk=risk, triggered_rules=rules, reden=reden)
```

### Pattern 5: Coordinate Transformation for WUR API

**What:** WUR soilphysics API uses WGS84 (lat/lon). The codebase works with RD New (EPSG:28992). The `rd_to_wgs84()` function already exists in `rce_monuments.py`.

**When:** Before calling WUR API, transform RD coordinates to WGS84.

**Why:** Reuse existing utility, no new dependency.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate API Call for Each Risk Component

**What:** Calling soil API, then funderingsrisico API, then running heuristic sequentially.

**Why bad:** Adds 2-4 seconds latency on top of existing 3-5 second aggregate time.

**Instead:** Add both API calls to the existing `asyncio.gather()`. They run in parallel with all other fetches. Total latency increase: near zero (limited by slowest existing call).

### Anti-Pattern 2: Over-Engineering Soil Classification

**What:** Building a complex ML model or multi-layer analysis for soil type classification.

**Why bad:** The WUR API returns clay/silt/sand/organic matter percentages per horizon. A simple weighted average + threshold is sufficient. The data itself is at 1:50,000 scale -- adding precision beyond "klei/veen/zand" is false accuracy.

**Instead:** Weighted average of top 120cm horizons:
- clay > 25% -> klei
- organic_matter > 15% -> veen
- sand > 70% -> zand
- silt > 50% -> leem
- else -> gemengd

### Anti-Pattern 3: Storing FysiekRisicoProfiel in Database

**What:** Creating a new database model to persist the combined physical risk profile.

**Why bad:** All inputs are already cached (bouwjaar in BAG cache, soil in WUR cache, PDOK in funderingsrisico cache). The heuristic is a pure function -- recomputing it takes microseconds. Storing derived data creates staleness risk.

**Instead:** Compute on every report generation from cached inputs. The caches have appropriate TTLs (BAG 24h, soil 90d, PDOK 30d).

### Anti-Pattern 4: Using PDOK Funderingsrisico as Per-Parcel Assessment

**What:** Treating PDOK `legenda` field as a definitive per-parcel foundation risk.

**Why bad:** PDOK data is at PC6 (6-digit postcode) level, covering multiple buildings. The `percvoor1970` is a percentage across ALL buildings in the postcode area. A new building in a "kwetsbaar" postcode area is not at risk itself.

**Instead:** Use PDOK as context signal that informs but does not override the per-parcel heuristic. The heuristic uses the actual bouwjaar of THIS building, with PDOK providing regional soil classification context.

### Anti-Pattern 5: New Schema File Per Risk Type

**What:** Creating `schemas/foundation_risk.py`, `schemas/soil_profile.py`, `schemas/funderingsrisico.py` as separate files.

**Why bad:** These are closely related schemas that form one conceptual unit. Spreading across files makes the dependency graph complex.

**Instead:** One file: `schemas/fysiek_risico.py` with all risk-related schemas. The top-level `FysiekRisicoProfiel` composes them. Only the existing `AsbestIndicator` stays in `property.py` (it is already there and used elsewhere).

---

## Integration Points Summary

| Integration | Type | Existing Component | Change |
|-------------|------|-------------------|--------|
| WUR soilphysics API | NEW CLIENT | None | `wur_bodemdata.py` in `government_apis/` |
| PDOK Funderingsrisico WFS | NEW CLIENT | None | `pdok_funderingsrisico.py` in `government_apis/` |
| Rate limiter | ADD | `rate_limiter.py` | Add `wur_bodemdata_limiter` + `pdok_funderingsrisico_limiter` |
| Cache TTL config | ADD | `config.py` CACHE_TTL dict | Add `"wur_bodemdata": 7776000` (90d) + `"pdok_funderingsrisico": 2592000` (30d) |
| Cache manager | NONE | `cache_manager.py` | Reuse as-is via aggregator pattern |
| Soil aggregator | NEW | None | `soil_aggregator.py` in `services/` |
| Funderingsrisico aggregator | NEW | None | `funderingsrisico_aggregator.py` in `services/` |
| Foundation risk engine | NEW | None | `foundation_risk_engine.py` in `services/` |
| Asbest indicator | MODIFY | `asbest_indicator.py` | Accept optional gebruiksdoel + bodemtype params |
| Property aggregator | MODIFY | `property_aggregator.py` | Add 2 fetches to gather, wire up heuristics post-gather |
| PropertyReportResponse | MODIFY | `property.py` schema | Add `fysiek_risico_profiel: FysiekRisicoProfiel \| None` field |
| Coordinate transform | REUSE | `rce_monuments.py` `rd_to_wgs84()` | Import for WUR API coordinate conversion |
| ParcelDetailModal | MODIFY | Frontend component | Add FysiekRisicoProfiel section after Property Info Grid |
| Frontend types | MODIFY | `types/scan.ts` or new `types/risk.ts` | Add TypeScript types matching backend schemas |

---

## Suggested Build Order

Based on dependency analysis:

1. **Schemas** (`fysiek_risico.py`) -- All components depend on shared types. No external dependencies.

2. **WUR Bodemdata client** (`wur_bodemdata.py`) + **soil aggregator** (`soil_aggregator.py`) -- First external API integration. Needs rate limiter entry + CACHE_TTL entry. Testable independently via unit test with mocked HTTP.

3. **PDOK Funderingsrisico client** (`pdok_funderingsrisico.py`) + **funderingsrisico aggregator** (`funderingsrisico_aggregator.py`) -- Second external API integration. Same pattern as step 2. Can be built in parallel with step 2.

4. **Foundation risk engine** (`foundation_risk_engine.py`) -- Pure function, depends on schemas from step 1. Write with comprehensive test coverage (bouwjaar x soil type matrix). Can be built in parallel with steps 2-3.

5. **Asbest indicator v2** (modify `asbest_indicator.py`) -- Extend existing function signature. Backward compatible (new params are optional). Update tests.

6. **Property aggregator wiring** (modify `property_aggregator.py` + `property.py`) -- Wire soil + funderingsrisico into `asyncio.gather()`, call heuristic engines post-gather, add `fysiek_risico_profiel` to response schema. Depends on steps 1-5.

7. **Frontend FysiekRisicoProfiel section** -- Render combined risk card in ParcelDetailModal. Depends on step 6 for API response shape.

**Hard dependencies:** 1 -> {2, 3, 4} -> 6 -> 7
**Parallelizable:** Steps 2, 3, and 4 are independent of each other
**Step 5** can happen at any point after step 1

---

## Verified API Details

### WUR Soilphysics API (VERIFIED via live request)

- **Endpoint:** `https://www.soilphysics.wur.nl/soil.php?latitude={lat}&longitude={lon}`
- **Auth:** None required (public)
- **CRS:** WGS84 (decimal degrees)
- **Response format:** JSON
- **Sample response (lat=52.1, lon=5.2):**
  ```json
  {
    "id": 8010,
    "smu": "EZg21",
    "horizon": [
      {"code": "1Aap", "top": 0, "bottom": 15, "som": 5, "clay": 4, "silt": 9, "sand": 87, "density": 1.3718, "spu": "B2"},
      {"code": "1Cu", "top": 70, "bottom": 120, "som": 0, "clay": 3, "silt": 5, "sand": 92, "density": 1.6735, "spu": "O1"}
    ]
  }
  ```
- **No data response:** `"No soil information available for this location."` (string, not JSON object)
- **Coverage:** Netherlands only, based on Bodemkaart 1:50.000
- **Rate limiting:** Unknown (public WUR endpoint), use conservative limiter (3 concurrent, 300/hr)

### PDOK Funderingsrisicogebieden WFS (VERIFIED via live request)

- **Endpoint:** `https://service.pdok.nl/rvo/indicatieve-aandachtsgebieden-funderingsproblematiek/wfs/v1_0`
- **NOTE:** URL in GetCapabilities redirects to `/rvo/indicatieve-aandachtsgebieden-funderingsproblematiek/` (different from the `/rvo/indgebfunderingsproblematiek/` alias in STATE.md)
- **Auth:** None required (CC0 license)
- **CRS:** EPSG:28992 (RD New)
- **Output formats:** GeoJSON (`application/json`), GML
- **Feature type:** `indgebfunderingsproblematiek:indgebfunderingsproblematiek`
- **Properties (from DescribeFeatureType):**
  - `pc6` (string) -- 6-digit postcode
  - `woonplaats` (string)
  - `gemeente` (string)
  - `provincie` (string)
  - `perc_fgr` (string) -- percentage of PC6 area covered by this soil region
  - `afk` (string) -- abbreviation (e.g., "ri" = rivierengebied)
  - `fgr` (string) -- soil region full name (Rivierengebied, Veengebied, etc.)
  - `percvoor1970` (string) -- percentage of buildings pre-1970 (as float string)
  - `n_bag` (string) -- total BAG buildings count in PC6
  - `nvoor1970` (string) -- count of pre-1970 buildings
  - `legenda` (string) -- risk classification text (e.g., "Kwetsbaar gebied - 40-60 %")
  - `popuptext` (string) -- human-readable HTML description
  - `website` (string) -- always "http://www.kcaf.nl"
- **Query options:** CQL_FILTER (e.g., `pc6='7251RG'`), BBOX, propertyName
- **Gotcha:** All properties are STRING type (including percvoor1970, n_bag, nvoor1970) -- must parse to float/int in client

---

## Sources

- Existing codebase: `asbest_indicator.py`, `bodem_aggregator.py`, `bodemloket_arcgis.py`, `property_aggregator.py`, `property.py` schemas, `cache_manager.py`, `rate_limiter.py`, `base.py` (HIGH confidence)
- WUR soilphysics API: Live test `curl https://www.soilphysics.wur.nl/soil.php?latitude=52.1&longitude=5.2` verified 2026-03-09 (HIGH confidence)
- PDOK Funderingsrisicogebieden WFS: Live GetCapabilities + DescribeFeatureType + GetFeature verified 2026-03-09 (HIGH confidence)
- PDOK WFS schema: All 17 properties confirmed from DescribeFeatureType XSD (HIGH confidence)
- Memory notes: v14.0 milestone context, foundation heuristic design, deferred items (HIGH confidence)
- [Bodemdata.nl](https://bodemdata.nl) - WUR soil information system
- [PDOK WFS documentation](https://www.pdok.nl/wfs) - General WFS patterns
- [Grondsoortenkaart data.overheid.nl](https://data.overheid.nl/dataset/67735-grondsoortenkaart) - Source dataset reference

---

*Architecture research for: Propdex v14.0 Fysiek Risicoprofiel*
*Researched: 2026-03-09*
