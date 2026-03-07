# Architecture Patterns

**Domain:** Omgevings- & Leefbaarheids-Scorer -- Location intelligence scoring for PropTech
**Researched:** 2026-03-07
**Confidence:** HIGH (verified against live CBS OData endpoints + existing codebase)

---

## Key Architectural Insight: CBS Has Pre-Computed Proximity Data

The biggest finding is that CBS provides **"Nabijheid voorzieningen"** as a separate OData v4 dataset (86134NED for 2024) with pre-calculated road-distance metrics at wijk/buurt level. This eliminates the need for PostGIS ST_Distance calculations, OSM data imports, or external routing APIs for voorzieningen proximity.

**Verified distance measures (live API query against 86134NED/MeasureCodes):**

| CBS Code | Facility | Unit | Real Estate Relevance |
|----------|----------|------|----------------------|
| D000025 | Grote supermarkt | km | Table-stakes for residential |
| D000045_1 | Basisonderwijs (primary school) | km | Family appeal |
| D000045_2 | Voortgezet onderwijs totaal | km | Family appeal |
| D000052 | Treinstations totaal | km | Commuter attractiveness |
| D000014 | Belangrijk overstapstation | km | Transit connectivity |
| D000028 | Huisartsenpraktijk | km | Livability baseline |
| D000037 | Oprit hoofdverkeersweg | km | Car accessibility |
| D000029 | Kinderdagverblijf | km | Young family appeal |
| D000039 | Park of plantsoen | km | Green premium |
| D000036 | Openbaar groen totaal | km | Green premium |
| D000010 | Apotheek | km | Healthcare access |
| D000043 | Restaurant | km | Lifestyle indicator |

Each distance measure also has "count within X km" variants (e.g., A045790_1 = huisartsen within 1km). Useful for density indicators.

---

## Data Source Architecture

### CBS OData v4 -- KWB Multi-Year (Existing Pattern, New Scale)

CBS publishes one dataset ID per year. Multi-year queries require querying N separate dataset IDs in parallel.

**KWB (Kerncijfers wijken en buurten) -- existing metrics, extended for trends:**

| Year | Dataset ID | Status |
|------|-----------|--------|
| 2020 | 84799NED | Available |
| 2021 | 85039NED | Available |
| 2022 | 85318NED | Configured in cbs_odata.py |
| 2023 | 85618NED | Configured in cbs_odata.py |
| 2024 | 85984NED | Configured in cbs_odata.py |
| 2025 | 86165NED | Configured in cbs_odata.py (current) |

**Nabijheid voorzieningen -- NEW dataset series:**

| Year | Dataset ID | Status |
|------|-----------|--------|
| 2020 | 84953NED | Available |
| 2021 | 85231NED | Available |
| 2022 | 85560NED | Available |
| 2023 | 85830NED | Available |
| 2024 | 86134NED | Latest (use this) |

**Measure codes already verified in cbs_odata.py `MEASURE_CODES` dict -- extends with:**
- `inkomen` (`M000223`) -- already defined but may not be fetched depending on dataset

### Politie Crime Data -- OData v3 (New Protocol)

Crime data lives on `dataderden.cbs.nl` using OData v3 (NOT v4). This is a separate API protocol.

**Endpoint:** `https://dataderden.cbs.nl/ODataApi/OData/47018NED`

**Verified entities:**
- `TypedDataSet` -- actual data rows
- `WijkenEnBuurten` -- region codes (same WK/BU format as CBS KWB)
- `SoortMisdrijf` -- crime type dimension
- `Perioden` -- year/month dimension

**Key field:** `GeregistreerdeMisdrijven_1` (count of registered crimes)

**OData v3 vs v4 differences:**
- Response wrapper: `{"odata.metadata": ..., "value": [...]}` (v3) vs `{"@odata.context": ..., "value": [...]}` (v4)
- No `$count` in v3 by default
- Entity names use PascalCase differently
- Single dataset with time dimension (unlike KWB which has separate datasets per year)

---

## Component Boundaries

### New Components

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `CbsNabijheidClient` | `backend/app/government_apis/cbs_nabijheid.py` | Fetch proximity data from CBS OData v4 (86134NED). Reuse wijk resolution pattern from CBSODataClient |
| `PolitieCrimeClient` | `backend/app/government_apis/politie_crime.py` | Fetch crime stats from dataderden OData v3 (47018NED). New protocol, cannot inherit from CBS v4 base |
| `CbsMultiYearService` | `backend/app/services/cbs_multiyear.py` | Orchestrate parallel queries across multiple KWB dataset IDs for historical trends |
| `LocationScoreService` | `backend/app/services/location_scoring.py` | Pure function: aggregate all metrics into weighted location score |
| `VoorzieningenCard` | `frontend/src/components/projects/VoorzieningenCard.tsx` | Display proximity distances with visual distance bars |
| `CrimeCard` | `frontend/src/components/projects/CrimeCard.tsx` | Display crime statistics with per-1000-inwoners metric |
| `TrendChart` | `frontend/src/components/projects/TrendChart.tsx` | Lightweight sparkline for multi-year metric trends |
| `LocationScoreCard` | `frontend/src/components/projects/LocationScoreCard.tsx` | Aggregated score with categorical breakdown |

### Modified Components

| Component | Change | Rationale |
|-----------|--------|-----------|
| `backend/app/government_apis/cbs_odata.py` | Extract shared `_resolve_wijk_identifier` into a reusable function or base class. Add multi-dataset-ID querying method | Nabijheid client needs identical wijk resolution; multi-year needs same pattern across dataset IDs |
| `backend/app/models/area_scan.py` | Add `location_score: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)` | Store computed location score separate from source data (different lifecycle) |
| `backend/app/jobs/area_scan.py` | Add Phase 2c after existing CBS fetch: nabijheid + crime + trends + score computation | Non-fatal enrichment, same try/except pattern as existing CBS |
| `backend/app/scans/schemas.py` | Add `location_score: dict | None` to `ScanListItem`, `ScanResultsResponse` | Expose score to frontend |
| `backend/app/government_apis/rate_limiter.py` | Add `politie_crime_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)` | New API needs its own rate limiter |
| `frontend/src/lib/types/scan.ts` | Add `LocationScore`, `NabijheidData`, `CriminaliteitData`, `TrendData` interfaces. Extend `CbsNeighborhoodMetrics` with optional `nabijheid`, `criminaliteit`, `trends` keys | Type new data flowing through existing `neighborhood_metrics` |
| `frontend/src/components/map/panels/WijkMapPanel.tsx` | Add VoorzieningenCard, CrimeCard, LocationScoreCard, TrendChart sections below existing CbsNeighborhoodCard | Display new data in wijk context |
| `frontend/src/components/projects/CbsNeighborhoodCard.tsx` | Add income row (data already in MEASURE_CODES). Add optional trend indicators (arrow up/down) when trends data available | Extended display |

---

## Data Flow

### Scan-Time Data Acquisition (Extended Phase 2)

```
area_scan_job
  |
  +-- Phase 2 (existing): BAG + bestemmingen + CBS KWB
  |     +-- cbs_client.get_neighborhood_data() -> neighborhood_metrics JSONB
  |
  +-- Phase 2c (NEW): Location intelligence enrichment
  |     |
  |     +-- [parallel] cbs_nabijheid_client.get_proximity_data(gemeente_code, wijk_naam)
  |     |     -> {supermarkt_km: 0.8, basisonderwijs_km: 1.2, treinstation_km: 3.4, ...}
  |     |
  |     +-- [parallel] politie_crime_client.get_crime_data(wijk_code, year=current)
  |     |     -> {totaal_misdrijven: 245, per_1000_inwoners: 42.1}
  |     |
  |     +-- [parallel] cbs_multiyear.get_trends(gemeente_code, wijk_naam, years=5)
  |     |     -> {jaren: [2020..2024], woz: [...], inkomen: [...], inwoners: [...]}
  |     |
  |     +-- [sequential] location_scoring.compute_score(all_collected_data)
  |           -> {total: 7.2, voorzieningen: 8.1, veiligheid: 6.5, demografie: 7.0, trend: 7.8}
  |
  +-- scan.neighborhood_metrics = {**existing, nabijheid: {...}, criminaliteit: {...}, trends: {...}}
  +-- scan.location_score = computed_score_dict
```

### Storage Strategy: Extend neighborhood_metrics JSONB + Separate Score Column

**Source data** goes into `neighborhood_metrics` JSONB (new top-level keys):

```python
scan.neighborhood_metrics = {
    # EXISTING (unchanged)
    "bron": "CBS StatLine OData v4",
    "dataset": "86165NED - Kerncijfers wijken en buurten",
    "peiljaar": 2025,
    "data": {
        "gemiddelde_woz_waarde": 275.0,
        "stedelijkheid": {"klasse": 2, "omschrijving": "Sterk stedelijk", "omgevingsadressendichtheid": 2450.0},
        "demografie": {"aantal_inwoners": 4820, "percentage_huurwoningen": 55.0, "percentage_koopwoningen": 45.0},
        "bouwjaar_distributie": {"percentage_bouwjaar_voor_2000": None, "percentage_bouwjaar_vanaf_2000": None},
    },

    # NEW: proximity data
    "nabijheid": {
        "bron": "CBS Nabijheid voorzieningen",
        "dataset": "86134NED",
        "peiljaar": 2024,
        "data": {
            "afstand_supermarkt_km": 0.8,
            "afstand_basisonderwijs_km": 1.2,
            "afstand_voortgezet_onderwijs_km": 2.1,
            "afstand_treinstation_km": 3.4,
            "afstand_overstapstation_km": 8.2,
            "afstand_huisarts_km": 0.6,
            "afstand_kinderdagverblijf_km": 0.9,
            "afstand_park_km": 0.3,
            "afstand_hoofdverkeersweg_km": 1.5,
        },
    },

    # NEW: crime data
    "criminaliteit": {
        "bron": "Politie Open Data (CBS)",
        "dataset": "47018NED",
        "peiljaar": 2024,
        "data": {
            "totaal_misdrijven": 245,
            "per_1000_inwoners": 42.1,
        },
    },

    # NEW: historical trends (5-year)
    "trends": {
        "jaren": [2020, 2021, 2022, 2023, 2024],
        "woz": [210.0, 225.0, 248.0, 260.0, 275.0],
        "inkomen": [29.5, 30.1, 30.8, 31.2, 32.0],
        "inwoners": [4520, 4610, 4680, 4750, 4820],
    },
}
```

**Computed score** goes into separate `location_score` JSONB column:

```python
scan.location_score = {
    "total": 7.2,
    "breakdown": {
        "voorzieningen": 8.1,
        "veiligheid": 6.5,
        "demografie": 7.0,
        "marktdynamiek": 7.8,
        "trend": 6.9,
    },
    "model_version": "location-v1",
    "computed_at": "2026-03-07T14:30:00Z",
}
```

**Rationale for separation:**
- Source data in `neighborhood_metrics` is immutable after fetch (no reason to change it)
- Computed score in `location_score` may need recomputation when we tune weights
- Management command can recompute scores across all scans without re-fetching APIs
- Backward compatible: scans without new data simply have null keys

### Frontend Data Flow

```
WijkMapPanel
  |
  +-- latestScan.neighborhood_metrics.data (existing)
  |     +-- CbsNeighborhoodCard (existing, reads .data -- unchanged)
  |
  +-- latestScan.neighborhood_metrics.nabijheid (NEW key)
  |     +-- VoorzieningenCard (NEW component)
  |
  +-- latestScan.neighborhood_metrics.criminaliteit (NEW key)
  |     +-- CrimeCard (NEW component)
  |
  +-- latestScan.neighborhood_metrics.trends (NEW key)
  |     +-- TrendChart (NEW component, sparklines per metric)
  |
  +-- latestScan.location_score (NEW field on ScanListItem)
        +-- LocationScoreCard (NEW component, prominent placement)
```

---

## Patterns to Follow

### Pattern 1: Refactored CBS Base for Client Reuse

The `CbsNabijheidClient` shares 80% of `CBSODataClient` logic (headers, retry, limiter, wijk resolution). Extract shared functionality:

```python
# Option A: Constructor-parameterized client (RECOMMENDED)
class CBSODataClient:
    def __init__(self, dataset_id: str | None = None, measure_codes: dict[str, str] | None = None):
        self.dataset_id = dataset_id or settings.cbs_dataset_id
        self.measure_codes = measure_codes or DEFAULT_KWB_MEASURE_CODES
        self.peiljaar = DATASET_PEILJAAR.get(self.dataset_id, 2025)

# Usage:
kwb_client = CBSODataClient()  # existing behavior
nabijheid_client = CBSODataClient(
    dataset_id="86134NED",
    measure_codes=NABIJHEID_MEASURE_CODES,
)
```

This avoids creating a separate class and duplicating the wijk resolution + observation fetch logic.

### Pattern 2: OData v3 Client for Politie (New Pattern)

The politie data uses OData v3 on `dataderden.cbs.nl`. Requires a distinct client class:

```python
class PolitieCrimeClient:
    """Politie misdrijfcijfers via CBS dataderden OData v3."""

    BASE_URL = "https://dataderden.cbs.nl/ODataApi/OData/47018NED"

    async def get_crime_data(
        self, client: httpx.AsyncClient, wijk_code: str, year: int
    ) -> dict | None:
        """Fetch total registered crimes for a wijk in a given year."""
        # 1. Query WijkenEnBuurten to resolve wijk identifier
        # 2. Query TypedDataSet filtered by WijkenEnBuurten key + Perioden
        # 3. Sum GeregistreerdeMisdrijven_1 across crime types
```

### Pattern 3: Multi-Year Parallel Fetch

```python
async def get_historical_kwb(
    self, client: httpx.AsyncClient,
    gemeente_code: str, wijk_naam: str | None,
    gemeente_naam: str, years: int = 5,
) -> list[dict]:
    """Fetch KWB metrics for last N years from separate CBS dataset IDs."""
    dataset_ids = list(KWB_DATASET_PEILJAAR.items())[-years:]

    async def fetch_year(dataset_id: str, year: int) -> dict | None:
        year_client = CBSODataClient(dataset_id=dataset_id)
        return await year_client.get_neighborhood_data(
            client, gemeente_naam, wijk_naam, gemeente_code
        )

    results = await asyncio.gather(
        *[fetch_year(did, yr) for did, yr in dataset_ids],
        return_exceptions=True,
    )
    return [r for r in results if isinstance(r, dict)]
```

### Pattern 4: Non-Fatal Scan Enrichment

All new data fetches MUST be wrapped in the existing non-fatal pattern:

```python
# In area_scan_job, Phase 2c:
try:
    proximity_data = await nabijheid_client.get_neighborhood_data(
        client=http_client, gemeente_naam=scan.gemeente_naam,
        wijk_naam=scan.wijk_naam, gemeente_code=scan.gemeente_code,
    )
    if proximity_data:
        scan.neighborhood_metrics["nabijheid"] = proximity_data
        logger.info(f"Scan {scan_id}: nabijheid data fetched")
except Exception as e:
    logger.warning(f"Scan {scan_id}: nabijheid fetch failed (non-fatal): {e}")
```

### Pattern 5: Pure Location Score Function

Score computation is a pure function (no I/O). Easy to test, easy to recompute:

```python
@dataclass(frozen=True)
class LocationScore:
    total: float              # 0-10 overall
    voorzieningen: float      # 0-10 proximity sub-score
    veiligheid: float         # 0-10 safety sub-score
    demografie: float         # 0-10 demographics sub-score
    marktdynamiek: float      # 0-10 market dynamics sub-score
    trend: float              # 0-10 improving/declining trajectory
    model_version: str = "location-v1"

def compute_location_score(
    neighborhood: dict | None,     # KWB data
    proximity: dict | None,        # nabijheid data
    crime: dict | None,            # criminaliteit data
    trends: list[dict] | None,     # historical series
) -> LocationScore:
    """Pure scoring. All inputs optional -- partial data yields partial score."""
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: PostGIS Distance for Voorzieningen
**What:** Using ST_Distance to calculate proximity to schools/supermarkets from parcel coordinates
**Why bad:** Requires maintaining POI database, geocoding, road-network routing. CBS already computes this per wijk using actual road distances (more accurate).
**Instead:** Use CBS Nabijheid voorzieningen dataset. Pre-computed, authoritative, updated annually.

### Anti-Pattern 2: Storing Computed Score Inside Source Data
**What:** Putting location score inside `neighborhood_metrics` JSONB alongside source data
**Why bad:** When scoring weights change, you cannot recompute without re-fetching all APIs. Source data and derived scores have different lifecycles.
**Instead:** Separate `location_score` column. Source data immutable, score recomputable.

### Anti-Pattern 3: Sequential Multi-Year Fetches
**What:** Querying 5 years of CBS data one-by-one, awaiting each
**Why bad:** 5 years x 2 datasets (KWB + Nabijheid) = 10 sequential API calls at 1-2s each = 10-20s added to scan
**Instead:** `asyncio.gather` for parallel fetch. All 10 calls fire simultaneously, total time = slowest single call.

### Anti-Pattern 4: Duplicating CBSODataClient for Nabijheid
**What:** Copy-pasting the entire CBS client class with different measure codes
**Why bad:** 80% identical code (headers, retry, limiter, wijk resolution, observation fetch). Bug fixes must be applied twice.
**Instead:** Parameterize CBSODataClient to accept dataset_id + measure_codes, or extract shared base.

### Anti-Pattern 5: Using v4 Protocol for Politie Data
**What:** Calling `dataderden.cbs.nl` with OData v4 query syntax
**Why bad:** Politie data uses OData v3. Response format, entity names, and filter syntax differ. Will get 404s or malformed responses.
**Instead:** Build a separate `PolitieCrimeClient` that handles OData v3 specifics.

---

## Scalability Considerations

| Concern | Current (per scan) | At 1K scans | Mitigation |
|---------|-------------------|-------------|------------|
| CBS API calls | +3 new (nabijheid + multi-year) | 3K extra calls/day | Rate limiter already handles this. CBS has no documented limit but 500/hr is polite |
| Multi-year historical | 10 parallel calls (5yr x 2 datasets) | Could be cached | Use CachedAPIResponse with 90-day TTL (data changes annually at most) |
| neighborhood_metrics size | ~2KB -> ~5KB per scan | 5MB total in DB | JSONB handles fine. No content indexing needed |
| Score recomputation | Pure function, <1ms | Batch across all scans | Management command: `python -m app.tools.recompute_scores` |
| Politie data freshness | Monthly updates | Same for all orgs | Cache at organization-agnostic level (same wijk = same crime data) |

---

## Suggested Build Order

Build order follows dependency graph and risk profile:

### Phase 1: CBS Nabijheid Client + VoorzieningenCard
**Risk:** LOW (same OData v4 pattern as existing CBS client)
**Dependencies:** None
- Refactor `CBSODataClient` to accept parameterized dataset_id + measure_codes
- Create nabijheid instance with 86134NED + proximity measure codes
- Add nabijheid fetch to `area_scan.py` Phase 2c (non-fatal)
- Merge into `neighborhood_metrics["nabijheid"]`
- New `VoorzieningenCard.tsx` component
- Mount in `WijkMapPanel.tsx`

### Phase 2: Politie Crime Client + CrimeCard
**Risk:** MEDIUM (new OData v3 protocol, different from all existing clients)
**Dependencies:** None (parallel with Phase 1)
- New `PolitieCrimeClient` in `politie_crime.py`
- New `politie_crime_limiter` in `rate_limiter.py`
- Add crime fetch to `area_scan.py` Phase 2c
- Merge into `neighborhood_metrics["criminaliteit"]`
- New `CrimeCard.tsx`

### Phase 3: Multi-Year CBS Trends + TrendChart
**Risk:** LOW (same API, just multiple calls)
**Dependencies:** Phase 1 (uses refactored CBSODataClient)
- New `CbsMultiYearService` orchestrating parallel year queries
- Add trends fetch to `area_scan.py` Phase 2c
- Merge into `neighborhood_metrics["trends"]`
- New `TrendChart.tsx` sparkline component
- Add trend indicators to `CbsNeighborhoodCard.tsx`

### Phase 4: Location Score Aggregation + LocationScoreCard
**Risk:** LOW (pure computation, no external dependencies)
**Dependencies:** Phases 1-3 (needs all data sources)
- Alembic migration: `location_score JSONB` on `area_scans`
- New `LocationScoreService` with weighted scoring algorithm
- Compute + store during scan Phase 2c
- Extend `ScanListItem` schema with `location_score`
- New `LocationScoreCard.tsx` (prominent placement in WijkMapPanel)
- Add `compute_location_score` management command for recomputation

### Phase 5: Extended CBS Metrics + Polish
**Risk:** LOW (incremental improvements)
**Dependencies:** Phases 1-4
- Add income data display to `CbsNeighborhoodCard` (measure already in MEASURE_CODES)
- Extend `CbsNeighborhoodMetrics` TypeScript type
- Polish trend arrows, color scales, responsive layout

---

## Sources

- CBS Kerncijfers wijken en buurten series: https://www.cbs.nl/nl-nl/reeksen/publicatie/kerncijfers-wijken-en-buurten
- CBS Nabijheid voorzieningen 2024 (86134NED): https://www.cbs.nl/nl-nl/cijfers/detail/86134NED
- Politie Open Data portal: https://politieopendata.cbs.nl/portal.html?_la=nl&_catalog=Politie
- CBS OData v4 metadata: https://www.cbs.nl/nl-nl/onze-diensten/open-data/statline-als-open-data/metadata-odata-v4
- Live verification: `datasets.cbs.nl/odata/v1/CBS/86134NED/MeasureCodes` -- 46 distance measures confirmed
- Live verification: `dataderden.cbs.nl/ODataApi/OData/47018NED` -- OData v3 structure with WijkenEnBuurten + Perioden + SoortMisdrijf entities
- Live verification: All KWB dataset IDs (84799NED through 86165NED) confirmed via Datasets endpoint
- Live verification: All Nabijheid dataset IDs (84953NED through 86134NED) confirmed via Datasets endpoint

---

*Architecture research for: Propdex v12.0 Omgevings- & Leefbaarheids-Scorer*
*Researched: 2026-03-07*
