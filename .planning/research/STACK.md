# Technology Stack

**Project:** Propdex v12.0 Omgevings- & Leefbaarheids-Scorer
**Researched:** 2026-03-07
**Confidence:** HIGH (all data sources verified via live API calls)

---

## Context: Subsequent Milestone

This covers ONLY new stack requirements for v12.0. Existing validated capabilities are NOT re-documented.

**Existing infrastructure reused without changes:**
- `httpx[http2]>=0.27.0` -- HTTP client for all external APIs
- `aiolimiter>=1.2.0` -- rate limiting via `APIRateLimiter`
- `government_apis/base.py` -- `GovernmentAPIError`, `retry_with_backoff`
- `government_apis/cbs_odata.py` -- CBS OData v4 client (WijkenEnBuurtenCodes + Observations pattern)
- `government_apis/rate_limiter.py` -- per-API rate limiter singletons
- PostgreSQL JSONB cache with source-specific TTLs

---

## Final Answer: Zero New Dependencies Required

All four data domains build on the existing stack. No new pip packages, no new npm packages.

| Feature | New pip package? | Uses instead |
|---------|-----------------|-------------|
| CBS multi-year trends | None | Extend existing `CBSODataClient` -- loop over dataset IDs |
| Crime data (Politie) | None | New OData v3 client using httpx (same pattern as v4) |
| Voorzieningen proximity | None | Same CBS OData v4 client -- just different dataset IDs and measure codes |
| Score aggregation | None | Pure Python arithmetic + `statistics.linear_regression()` (stdlib) |

**`pyproject.toml` changes: none required.**
**`package.json` changes: none required.**

---

## Data Sources & Integration Points

### 1. CBS Multi-Year Trend Data (Kerncijfers wijken en buurten)

| Aspect | Detail |
|--------|--------|
| **API** | CBS OData v4 (`datasets.cbs.nl/odata/v1/CBS/{dataset_id}/Observations`) |
| **Protocol** | OData v4 (identical to existing `cbs_odata.py`) |
| **Auth** | None (public) |
| **Integration** | Extend existing `CBSODataClient` with multi-dataset iteration |

**Verified dataset IDs for 5-year trend window (all confirmed in CBS v4 catalog):**

| Dataset ID | Year | Status |
|------------|------|--------|
| `86165NED` | 2025 | Verified in v4 catalog |
| `85984NED` | 2024 | Verified, already in `DATASET_PEILJAAR` |
| `85618NED` | 2023 | Verified, already in `DATASET_PEILJAAR` |
| `85318NED` | 2022 | Verified, already in `DATASET_PEILJAAR` |
| `85039NED` | 2021 | Verified in v4 catalog |

Full historical range available: `84799NED` (2020), `84583NED` (2019), `84286NED` (2018), `83765NED` (2017) etc.

**New measure codes to add to `MEASURE_CODES` dict (verified stable across all yearly datasets):**

```python
# Leeftijdsverdeling (age distribution)
"leeftijd_0_15": "10680",           # 0 tot 15 jaar
"leeftijd_15_25": "53050",          # 15 tot 25 jaar
"leeftijd_25_45": "53310",          # 25 tot 45 jaar
"leeftijd_45_65": "53715",          # 45 tot 65 jaar
"leeftijd_65_plus": "80200",        # 65 jaar of ouder

# Huishoudenssamenstelling (household composition)
"huishoudens_totaal": "1050010_2",           # Huishoudens totaal
"eenpersoonshuishoudens": "1050015",         # Eenpersoonshuishoudens
"huishoudens_zonder_kinderen": "1016040",    # Huishoudens zonder kinderen
"huishoudens_met_kinderen": "1016030",       # Huishoudens met kinderen
"gem_huishoudensgrootte": "M000114",         # Gemiddelde huishoudensgrootte

# Inkomensverdeling (income distribution) -- M000223 already exists
"gem_inkomen_per_inwoner": "M000224",        # Gemiddeld inkomen per inwoner
"laagste_inkomen_40pct": "D000187",          # 40% personen met laagste inkomen
"hoogste_inkomen_20pct": "D000185",          # 20% personen met hoogste inkomen

# Nabijheid voorzieningen (proximity -- already in Kerncijfers dataset!)
"afstand_supermarkt": "D000025",             # Afstand tot grote supermarkt (km)
"afstand_huisarts": "D000028",               # Afstand tot huisartsenpraktijk (km)
"afstand_kinderdagverblijf": "D000029",      # Afstand tot kinderdagverblijf (km)
"afstand_school": "D000045",                 # Afstand tot school (km)
```

**Key insight:** The Kerncijfers dataset already includes 4 proximity measures (supermarkt, huisarts, kinderdagverblijf, school) in the same Observations entity as demographics. This means **zero extra API calls** for basic proximity data -- just expand the `MEASURE_CODES` dict.

---

### 2. Crime Data (Politie Open Data via OData v3)

| Aspect | Detail |
|--------|--------|
| **API** | OData v3 at `dataderden.cbs.nl/ODataApi/OData/47018NED` |
| **Protocol** | OData v3 (**NOT v4** -- different entity structure) |
| **Auth** | None (public) |
| **Granularity** | Wijk + buurt level, annual figures, 2012-2021 |
| **Transport** | httpx (already installed) |

**Why OData v3?** The wijk-level crime dataset (47018NED) is NOT in the CBS v4 catalog (`datasets.cbs.nl`). Verified by querying `datasets.cbs.nl/odata/v1/Datasets?$filter=Identifier eq '47018NED'` -- returns empty. It is only available on the separate `dataderden.cbs.nl` portal which uses OData v3.

**OData v3 vs v4 differences:**

| Aspect | OData v4 (existing CBS) | OData v3 (crime data) |
|--------|------------------------|-----------------------|
| Base URL | `datasets.cbs.nl/odata/v1/CBS` | `dataderden.cbs.nl/ODataApi/OData` |
| Data entity | `Observations` | `TypedDataSet` |
| Region entity | `WijkenEnBuurtenCodes` | `WijkenEnBuurten` |
| Region key format | Clean (e.g. `WK098311`) | Padded with spaces (e.g. `WK098311  `) |
| Value field | `Value` + `ValueAttribute` validity flag | Direct column name (e.g. `GeregistreerdeMisdrijven_1`) |
| Period format | N/A (separate datasets per year) | `2021JJ00` format in same dataset |

**Verified crime categories (from `SoortMisdrijf` dimension):**

| Key | Description | Use in scoring |
|-----|-------------|----------------|
| `0.0.0` | Totaal misdrijven | Overall safety index |
| `1.1.1` | Diefstal/inbraak woning | Direct property risk |
| `1.4.3` | Openlijk geweld (persoon) | Neighborhood safety |
| `1.4.4` | Bedreiging | Neighborhood safety |
| `1.4.5` | Mishandeling | Neighborhood safety |
| `1.6.1` | Brand/ontploffing | Property risk |

**Sample response structure (verified from live API):**

```json
{
  "ID": 28,
  "SoortMisdrijf": "0.0.0 ",
  "WijkenEnBuurten": "WK168000  ",
  "Perioden": "2012JJ00",
  "GeregistreerdeMisdrijven_1": 116,
  "Gemeentenaam_2": "                              ",
  "SoortRegio_3": "        "
}
```

**Note:** String values are padded with spaces -- `.strip()` required on all dimension keys.

---

### 3. Voorzieningen Proximity (CBS Nabijheid Dataset)

| Aspect | Detail |
|--------|--------|
| **API** | CBS OData v4 (`datasets.cbs.nl/odata/v1/CBS/{dataset_id}/Observations`) |
| **Protocol** | OData v4 (identical to existing CBS client) |
| **Auth** | None (public) |
| **Entity structure** | Same: `WijkenEnBuurtenCodes` + `Observations` |

**Two-tier approach:**

| Tier | Source | What it provides | When to use |
|------|--------|------------------|-------------|
| **Basic** (Kerncijfers) | `85984NED` etc. | Supermarkt, huisarts, kinderdagverblijf, school | Default -- included in same API call as demographics |
| **Extended** (Nabijheid) | `86134NED` etc. | 30+ facility types incl. OV, sport, cultuur, groen | When OV/transport proximity data needed |

**Extended Nabijheid measure codes for OV/transport (not in Kerncijfers):**

```python
# OV/transport proximity -- only in Nabijheid dataset
"afstand_oprit_snelweg": "D000037",         # Afstand tot oprit hoofdverkeersweg (km)
"afstand_treinstation": "D000052",           # Afstand tot treinstations totaal (km)
"afstand_overstapstation": "D000014",        # Afstand tot belangrijk overstapstation (km)
```

**Verified Nabijheid dataset IDs per year:**

| Dataset ID | Year |
|------------|------|
| `86134NED` | 2024 |
| `85830NED` | 2023 |
| `85560NED` | 2022 |
| `85231NED` | 2021 |
| `84953NED` | 2020 |

The `CBSODataClient._fetch_observations()` method works unmodified against these datasets -- same entity names, same region coding, same value format. The only change needed is passing a different `dataset_id`.

---

### 4. Scoring Aggregation

| Aspect | Detail |
|--------|--------|
| **Computation** | Server-side Python (pure arithmetic) |
| **Trend calculation** | `statistics.linear_regression()` (stdlib, Python 3.10+) |
| **Storage** | PostgreSQL JSONB (existing cache pattern) |

**Why no ML/statistical library:**

| Operation | How | Library needed? |
|-----------|-----|-----------------|
| Min-max normalization | `(x - min) / (max - min)` | No |
| Weighted average | `sum(w * v) / sum(w)` | No |
| Linear trend (slope) | `statistics.linear_regression(years, values)` | No (stdlib) |
| Score classification | `if slope > threshold` | No |

**Scoring dimensions and weights (configurable):**

| Dimension | Data source | Default weight | Direction |
|-----------|-------------|---------------|-----------|
| Demographics | CBS Kerncijfers (age, income, households) | 0.20 | Context |
| Crime safety | Politie OData v3 (totaal + categories) | 0.25 | Lower = better |
| Proximity | CBS Kerncijfers + Nabijheid (facilities) | 0.25 | Lower distance = better |
| Trend trajectory | CBS multi-year delta | 0.15 | Positive slope = better |
| Housing market | CBS Kerncijfers (WOZ, voorraad) | 0.15 | Context |

---

## New Code Modules Required

| Module | Purpose | Based on |
|--------|---------|----------|
| `government_apis/politie_crime.py` | OData v3 client for wijk/buurt crime data at `dataderden.cbs.nl` | `cbs_odata.py` patterns, `base.py` infra |
| `services/location_scorer.py` | Score aggregation: demographics + crime + proximity -> 0-10 composite | New module, pure Python |

**NOT a separate module** (fold into existing):
- CBS nabijheid proximity -- extend `CBSODataClient` with a `dataset_id` parameter or add `get_nabijheid_data()` method
- CBS multi-year trends -- add `get_multi_year_data()` and `get_trend_data()` methods to `CBSODataClient`

### New Rate Limiters (add to `rate_limiter.py`)

```python
# Politie Open Data (dataderden.cbs.nl) -- public, same infra as CBS
politie_crime_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
```

The existing `cbs_odata_limiter` covers Nabijheid queries (same CBS infra).

### New Configuration (add to `Settings`)

```python
cbs_trend_years: int = 5                    # Number of years for trend analysis
crime_dataset_id: str = "47018NED"          # Politie crime data OData v3 dataset
cbs_nabijheid_dataset_id: str = "86134NED"  # CBS nabijheid voorzieningen dataset
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Crime data source | Politie OData v3 (47018NED) | data.politie.nl REST API | No wijk/buurt granularity; OData has structured dimensional data with wijk codes matching CBS pattern |
| Crime data source | Politie OData v3 (47018NED) | CBS v4 83648NED (regio) | Only province-level granularity -- too coarse for wijk-level scoring |
| Proximity data | CBS Kerncijfers + Nabijheid | PDOK WFS + PostGIS spatial queries against OSM/BAG POI data | CBS pre-computes proximity for all wijken nationally. Building from POI data duplicates CBS's work with lower accuracy |
| Proximity data | CBS Kerncijfers + Nabijheid | Overpass API (OSM) | Rate-limited, complex query language, NL data quality varies. CBS is authoritative |
| Scoring library | Pure Python + `statistics` | numpy, scipy, scikit-learn | Weighted averages don't need ML libraries |
| Trend calculation | `statistics.linear_regression()` | numpy `polyfit` | stdlib function available since Python 3.10, project requires 3.11+ |
| OData v3 client | Custom httpx client | `cbsodata` PyPI package | Sync-only (uses `requests`), depends on `pandas`. httpx handles OData v3 REST trivially |

---

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `cbsodata` (PyPI) | Synchronous HTTP (blocks async event loop), depends on pandas |
| `pandas` / `numpy` | Heavy dependencies for simple arithmetic |
| PDOK WFS for POI queries | CBS already provides pre-computed proximity stats at wijk/buurt level |
| Overpass/OSM queries | Unreliable rate limits, variable NL data quality |
| PostGIS proximity calculations | Not needed -- CBS provides distance-to-nearest-facility |
| `scipy` | No statistical modeling needed |
| Redis caching for scores | Annual data with long TTL -- PostgreSQL JSONB cache is ideal |
| `python-odata` / `PyOData` / `odata-query` | SAP-oriented OData libraries; overkill for simple read-only CBS queries |

---

## Integration Architecture

```
Existing CBSODataClient (cbs_odata.py)
  |-- Extend MEASURE_CODES dict (+17 codes for demographics, income, proximity)
  |-- Add DATASET_IDS: dict[int, str] mapping (year -> dataset ID, 2017-2025)
  |-- Add NABIJHEID_DATASET_IDS: dict[int, str] for OV proximity datasets
  |-- Add get_multi_year_data(client, gemeente_code, wijk_naam, years) method
  |-- Add get_nabijheid_data(client, gemeente_code, wijk_naam) method

New PolitieCrimeClient (politie_crime.py)
  |-- OData v3 at dataderden.cbs.nl/ODataApi/OData/47018NED
  |-- Uses retry_with_backoff, GovernmentAPIError from base.py
  |-- Uses politie_crime_limiter from rate_limiter.py
  |-- get_wijk_crime_stats(client, wijk_code, years=[]) -> crime data dict
  |-- get_crime_trend(client, wijk_code) -> trend direction + magnitude

LocationScorer (services/location_scorer.py)
  |-- normalize(value, min, max) -> 0.0 to 1.0
  |-- compute_trend(yearly_values) -> slope via statistics.linear_regression()
  |-- score_location(demographics, crime, proximity, trends) -> LocationScore
  |-- LocationScore: composite 0-10 + per-dimension breakdown + confidence
```

---

## Cache Strategy

| Data source | TTL | Rationale |
|-------------|-----|-----------|
| CBS Kerncijfers (current year) | 30 days | Annual dataset, rarely changes mid-year |
| CBS Kerncijfers (historical years) | 90 days | Finalized data, never changes |
| CBS Nabijheid | 30 days | Same as Kerncijfers |
| Politie crime data | 30 days | Annual figures, stable once published |
| Computed location scores | 7 days | Derived from cached inputs; recompute weekly |

---

## Sources

- CBS OData v4 Kerncijfers datasets: verified via `datasets.cbs.nl/odata/v1/CBS/{id}/MeasureCodes` for 85318NED, 85984NED, 86165NED (HIGH confidence)
- CBS Nabijheid voorzieningen 86134NED: verified entity structure + all measure codes via OData v4 (HIGH confidence)
- Politie crime data 47018NED: verified via `dataderden.cbs.nl/ODataApi/OData/47018NED` -- entities, dimensions, sample data (HIGH confidence)
- CBS v4 catalog completeness: verified 47018NED NOT present via `datasets.cbs.nl/odata/v1/Datasets?$filter=Identifier eq '47018NED'` (HIGH confidence)
- Measure code stability: verified D000025, D000045, M000223 etc. identical across 85318NED (2022), 85984NED (2024), 86165NED (2025) (HIGH confidence)
- `statistics.linear_regression()`: Python stdlib since 3.10, project requires 3.11+ (HIGH confidence)
- CBS Nabijheidsstatistieken: https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/wijk-en-buurtstatistieken/nabijheidsstatistieken-per-wijk-buurt
- Politie Open Data portal: https://data.politie.nl/
- CBS OData v4 quickstart: https://www.cbs.nl/nl-nl/onze-diensten/open-data/statline-als-open-data/snelstartgids-odata-v4
- cbsodata PyPI package (alternative, rejected): https://github.com/J535D165/cbsodata

---

*Stack research for: Propdex v12.0 Omgevings- & Leefbaarheids-Scorer*
*Researched: 2026-03-07*
