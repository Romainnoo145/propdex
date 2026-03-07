# Domain Pitfalls: v12.0 Omgevings- & Leefbaarheids-Scorer

**Domain:** Location intelligence scoring for Dutch PropTech platform
**Researched:** 2026-03-07
**Context:** Adding multi-year CBS trends, crime data, proximity metrics, and composite location scoring to existing Propdex platform (v11.0)
**Overall confidence:** HIGH -- most pitfalls verified against CBS documentation and existing codebase

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamentally wrong scoring output.

### Pitfall 1: CBS Measure Code Drift Between Dataset Years

**What goes wrong:** CBS changes, adds, or removes measure codes between annual Kerncijfers wijken en buurten releases. The existing `MEASURE_CODES` dict in `cbs_odata.py` is hardcoded for a single dataset ID. When querying historical datasets (85318NED/2022, 85618NED/2023, 85984NED/2024, 86165NED/2025), the same human concept (e.g., "inkomen") may have different measure codes, or the measure may not exist at all in older years.

**Why it happens:** CBS restructures themes periodically. Confirmed changes:
- **2024**: Income theme redefined with new poverty definition (Nibud/SCP cooperation). New measure codes for armoede.
- **2024**: Energy theme restructured -- removed electricity/gas consumption by housing type, added housing type variables (gasvrij, zonnepanelen, laadpalen). Entirely new measure codes.
- **2023**: Labor theme expanded with working population figures and employee breakdown by contract type.
- **2025 (June)**: Housing stock figures corrected -- "unknown" replaced with "0" where no (non-)residential properties exist.

**Consequences:** Multi-year trend queries silently return `None` for measures that existed under a different code in prior years. Trend lines show artificial gaps or drops to zero that look like real neighborhood decline. Investment scores based on "declining income" could be completely wrong -- the data just moved to a different code.

**Prevention:**
- Build a `MEASURE_CODES_BY_DATASET` mapping: `dict[str, dict[str, str]]` keyed by dataset ID, not a single flat dict.
- Before querying a historical dataset, verify the measure code exists in that year's `MeasureCodes` metadata endpoint.
- When a code is missing for a year, store `null` (not zero) and surface "Geen data voor dit jaar" in the UI trend chart.
- Write an integration test that queries the `MeasureCodes` entity for each dataset in `DATASET_PEILJAAR` and asserts expected codes exist.

**Detection:** Trend charts showing sudden drops to zero for a single year while adjacent years have normal values. Unit tests should include at least one year with a missing/renamed code.

**Confidence:** HIGH -- CBS documentation explicitly confirms theme restructuring between 2023-2025.

### Pitfall 2: Composite Score Normalization Destroying Signal

**What goes wrong:** Naively normalizing heterogeneous metrics (WOZ values in euros, crime counts, distances in km, population counts) into 0-1 ranges using min-max normalization across all Dutch wijken creates scores where the normalization range is dominated by outliers. Amsterdam-Centrum WOZ of 800k+ and a rural buurt WOZ of 120k cause everything in between to compress into a narrow band, destroying meaningful differentiation.

**Why it happens:** Min-max normalization is the obvious first choice but assumes uniform distribution. Dutch neighborhood data is heavily skewed -- a few urban cores dominate most metrics.

**Consequences:** 90% of wijken get scores between 0.4-0.6, making the score useless for decision-making. Users lose trust in the platform when neighborhoods they know are very different get similar scores.

**Prevention:**
- Use **percentile-rank normalization** (rank / N) instead of min-max. This preserves ordinal relationships regardless of distribution shape.
- Apply domain-specific inversion: for crime, lower is better; for proximity to OV, lower distance is better. Define a `higher_is_better: bool` flag per metric.
- Consider z-score normalization **within the same stedelijkheidsklasse** (urban density class 1-5) -- comparing a rural village to Amsterdam is meaningless for investment decisions.
- Never combine more than 5-7 sub-scores into one composite. Group into themed sub-indices (Veiligheid, Bereikbaarheid, Demografie, Economie) and show those alongside the composite.
- Store raw values AND normalized scores. Allow users to see what drove the score.

**Detection:** If the standard deviation of your composite score across all wijken in a scan is less than 0.15 on a 0-1 scale, your normalization is broken.

**Confidence:** HIGH -- well-documented problem in location analytics literature.

### Pitfall 3: CBS Nabijheid Dataset is Separate from Kerncijfers (Three-Dataset Problem)

**What goes wrong:** Developers assume all wijk statistics come from one CBS dataset. In reality, the v12.0 scorer needs data from **three separate CBS-hosted datasets**, each with different OData hosts, entity structures, and measure code namespaces:

| Dataset | ID | Host | Content |
|---------|-----|------|---------|
| Kerncijfers wijken en buurten | 86165NED (2025) | `datasets.cbs.nl/odata/v1/CBS` | WOZ, demografie, inkomen, woningvoorraad |
| Nabijheid voorzieningen | 86134NED (2024) | `opendata.cbs.nl/ODataApi/OData` (possibly v3!) | Afstand huisarts, supermarkt, school, OV |
| Geregistreerde misdrijven | 47018NED | `dataderden.cbs.nl/ODataApi/OData` (OData v3!) | Criminaliteit per wijk/buurt |

The existing `CBSODataClient` is hardcoded to `datasets.cbs.nl/odata/v1/CBS` with v4 query syntax. It cannot query the other two datasets without modification.

**Consequences:** Trying to query proximity measures from the kerncijfers dataset returns nothing. Trying to query crime data from `datasets.cbs.nl` returns 404. Building one "mega query" is impossible.

**Prevention:**
- Refactor `CBSODataClient` into a base class with host/version as constructor parameters, then create three specialized clients: `CBSKerncijfersClient`, `CBSNabijheidClient`, `PolitieCrimeClient`.
- The nabijheid and politie datasets may use OData v3 (`/ODataApi/OData/{id}/TypedDataSet` pattern). The existing v4 query syntax (`Observations`, `WijkenEnBuurtenCodes`) will NOT work. You need to handle both v3 and v4 entity structures.
- Test each dataset endpoint independently before integrating.

**Detection:** HTTP 404 or empty results when querying nabijheid/politie measure codes against the kerncijfers endpoint.

**Confidence:** HIGH -- dataset IDs and hosts verified via CBS and data.overheid.nl documentation.

### Pitfall 4: Bouwjaar Distributie Rolling Window (Semantic Drift)

**What goes wrong:** Already documented in the codebase: `bouwjaar_distributie` returns `None` because CBS v4 measure codes M008209/M008210 use a rolling 10-year window ("gebouwd in de afgelopen 10 jaar") instead of the fixed "voor 2000 / vanaf 2000" split. This pattern will repeat for other measures when doing multi-year comparisons.

**Why it happens:** CBS modernizes measure definitions without maintaining backward compatibility. The measure code exists but its semantic meaning changed between dataset years.

**Consequences:** A "10-year rolling window" percentage from 2022 covers 2012-2022, while from 2025 it covers 2015-2025. These are NOT comparable in a trend chart. Users see a "change" that is purely an artifact of the sliding window.

**Prevention:**
- For every measure used in trend analysis, verify not just code existence but **semantic stability** across the year range.
- Document the measure definition (not just the code) in a constants file with `semantic_stable: bool` flag.
- Flag measures with known semantic drift as "not suitable for multi-year comparison" and exclude them from trend calculations.
- Only include measures in trend analysis where the definition has been stable across the full comparison window.

**Detection:** Already detected for bouwjaar. Apply the same diligence to new measures (inkomen, huishoudens, leeftijd).

**Confidence:** HIGH -- confirmed in existing codebase comment.

---

## Moderate Pitfalls

### Pitfall 5: Politie Crime Data Privacy Suppression at Wijk Level

**What goes wrong:** Sexual crimes (kinderporno, kinderprostitutie, zedendelicten) are completely excluded from wijk/buurt-level data (47018NED) for disclosure risk prevention. They only appear in gemeente-level aggregates. Other crime types may show suppressed values in small wijken where counts are low enough to identify individuals.

**Prevention:**
- Accept the suppression -- do not try to estimate missing categories.
- When displaying crime data, note exclusions: "Exclusief zedendelicten (privacy)"
- For composite scoring, use the "Totaal misdrijven" aggregate as the primary metric (includes everything except suppressed categories). Do NOT sum subcategories -- you will undercount.
- Normalize per 1,000 inhabitants using population data from kerncijfers to make crime counts comparable across differently-sized wijken.

**Confidence:** HIGH -- explicitly documented by politie/CBS.

### Pitfall 6: Score Weighting Bias Toward Available Data

**What goes wrong:** When building a composite location score, the real bias is data availability: wijken with more CBS data points get more stable, confident scores. Wijken with suppressed crime data, missing nabijheid values, or no WOZ data get extreme scores (all weight shifts to the few available metrics).

**Why it happens:** Missing data treated as zero distorts the composite downward. Excluding missing data from the denominator distorts it upward. Both approaches systematically bias rural/small wijken.

**Consequences:** Rural wijken with sparse data get artificially extreme scores. Urban wijken with complete data get moderate, averaged scores. Developers avoid good rural opportunities or over-value ones with incomplete data.

**Prevention:**
- Track data completeness per wijk as a separate `data_completeness_ratio = available_measures / total_measures`.
- Display confidence alongside the score: "Locatiescore: 7.2 (betrouwbaarheid: hoog)" vs "Locatiescore: 8.1 (betrouwbaarheid: laag -- 40% data ontbreekt)".
- Set a minimum threshold: if fewer than 60% of sub-scores are available, show "Onvoldoende data voor score" instead of computing a misleading number.
- When a sub-score is missing, do NOT redistribute its weight. Use a fixed denominator.

**Detection:** Compare score distributions between urban (stedelijkheid 1-2) and rural (stedelijkheid 4-5) wijken. If rural scores cluster at extremes, data availability bias is present.

**Confidence:** MEDIUM -- standard scoring pitfall, specific thresholds need empirical tuning.

### Pitfall 7: Overpass API is the Wrong Tool for Dutch Voorzieningennabijheid

**What goes wrong:** Developers default to Overpass API for "find nearest school/supermarket" queries. For a Dutch platform, this means: unreliable rate limits (429 errors, slot-based throttling), incomplete Dutch POI coverage (varies wildly by category), no guaranteed update frequency, complex query syntax, and coordinate system issues (OSM uses EPSG:4326, ParcelCache uses EPSG:28992).

**Why it happens:** Overpass is the standard answer in the GIS community. CBS nabijheid data is less well-known internationally.

**Consequences:** Wasted development time building Overpass queries, rate limiters, retry logic, and CRS transformation -- only to get lower quality data than CBS provides for free.

**Prevention:**
- **Use CBS nabijheid dataset (86134NED for 2024) as the primary source.** It covers: huisarts, apotheek, supermarkt, kinderdagverblijf, buitenschoolse opvang, basisschool, middelbare school, treinstation, lokaal OV-station, museum, restaurant.
- Distances are pre-computed over the **road network** (not Euclidean), which is exactly what real estate developers care about.
- Data is per wijk/buurt level, matching the existing scan granularity perfectly.
- Only fall back to OSM for niche facility types not covered by CBS (e.g., sportscholen, EV charging).

**Detection:** N/A -- design-time decision, not a runtime bug.

**Confidence:** HIGH -- CBS nabijheid dataset verified to exist and cover all relevant facility types.

### Pitfall 8: CRS Mismatch in Any Custom Proximity Calculations

**What goes wrong:** ParcelCache geometry is EPSG:28992 (RD New). If custom proximity is ever attempted, mixing EPSG:4326 coordinates from external sources with EPSG:28992 produces wildly wrong distances. `ST_Distance` on mixed-CRS geometries computes Cartesian distance on raw coordinate numbers.

**Prevention:**
- Use CBS nabijheid data (eliminates the problem entirely).
- If custom proximity is ever needed: ALWAYS `ST_Transform(geometry, 28992)` before `ST_Distance`. EPSG:28992 returns meters directly; EPSG:4326 returns degrees.
- This is already a known issue in the project (MEMORY: "parcel_cache.geometry is EPSG:28992; always ST_Transform before GeoJSON").

**Confidence:** HIGH -- well-known GIS pitfall, already documented in project memory.

### Pitfall 9: Multi-Year Trend Analysis With Provisional Data

**What goes wrong:** CBS datasets have staggered publication. Some measures are provisional (voorlopig) when first published, updated to definitive (definitief) months later. Politie 2025 data was "last updated February 2026, updated again March 2026." Comparing 2024 (definitive) with 2025 (provisional) shows artificial dips/spikes that disappear when data finalizes.

**Prevention:**
- Store the `ValueAttribute` flag from CBS observations (existing code already checks for empty string = valid data). Extend to track provisional status.
- In multi-year comparisons, only compare like with like: definitive-to-definitive, or label "2025: voorlopige cijfers" in the UI.
- Cache provisional data with shorter TTL (re-fetch after 3 months). Definitive data can be cached for 1 year.
- Default trend window: current year minus 3 through minus 1 (all definitive).

**Detection:** Suspicious deviations only in the most recent year often indicate provisional data artifacts.

**Confidence:** MEDIUM -- CBS publication schedule documented, but provisional/definitive distinction not always clearly exposed via OData.

### Pitfall 10: Gemeente Herindeling Breaking Historical Wijk Codes

**What goes wrong:** When municipalities merge (herindeling), CBS assigns new gemeente codes and restructures wijk/buurt boundaries. Historical data under old codes is unreachable under the new code.

**Why it happens:** CBS publishes each year's data against that year's geographic classification. After herindeling, codes change completely.

**Current risk assessment:**
- No herindelingen in 2024 or 2025 (342 gemeenten stable since January 2023).
- The only recent merger: Voorne aan Zee (2023, from Brielle/Hellevoetsluis/Westvoorne).
- For the 2022-2025 trend window, this affects only Voorne aan Zee.

**Prevention:**
- For the near term: low risk, but handle gracefully. If a historical query returns no data, log a warning rather than crashing.
- **Key advantage of politie data**: "Data per neighborhood are presented for ALL years according to the 2025 neighborhood classification." This means politie data is already re-mapped retroactively. CBS kerncijfers is NOT.
- Build a `gemeente_herindeling` lookup table for known mergers: `{"0501": "1992", "0502": "1992", "0559": "1992"}` (old codes -> new code). Apply when querying pre-merger datasets.
- When querying historical CBS data, use the year-appropriate gemeente code, not the current one.

**Detection:** Multi-year query returning data for some years but not others for the same gemeente_code -- check herindeling before assuming missing data.

**Confidence:** HIGH -- CBS documents herindelingen explicitly. Risk is LOW for the 2022-2025 window.

### Pitfall 11: Rate Limiter Exhaustion With Multi-Dataset Queries

**What goes wrong:** The current `cbs_odata_limiter` is configured at 3 concurrent / 500 per hour. With the scorer querying 3 CBS datasets per wijk, a gemeente scan touching 20 wijken makes 60+ CBS API calls. Combined with existing CBS calls from area scans, the hourly limit gets exhausted in high-usage periods.

**Prevention:**
- Create separate rate limiters per host: `datasets.cbs.nl` and `dataderden.cbs.nl` are different servers with independent limits.
- Batch wijk queries: fetch ALL wijken for a gemeente in one OData call using `startswith(Identifier, 'WK{gemeente_code}')` instead of per-wijk lookups.
- Cache aggressively: CBS data is annual. Cache for 30 days minimum. Score data never needs real-time freshness.
- Pre-compute scores during area scan (ARQ job) rather than on-demand per wijk click.

**Confidence:** HIGH -- arithmetic from existing rate limiter config confirms this will be hit.

---

## Minor Pitfalls

### Pitfall 12: Stedelijkheidsklasse is a Classifier, Not a Score Input

**What goes wrong:** Stedelijkheid (1-5 scale, 1 = most urban) gets treated as a scoring dimension. It is an inverted scale and a categorical classifier, not a quality metric. Including it in the composite score penalizes either urban or rural areas depending on the direction.

**Prevention:** Use stedelijkheid as a **grouping/context variable** for normalization (compare wijken within the same class), NOT as a sub-score input. Define explicit `ScoreDirection` enums per metric.

**Confidence:** HIGH -- verified in existing `STEDELIJKHEID_MAP`.

### Pitfall 13: Frontend Score Without Context is Misleading

**What goes wrong:** Displaying "Locatiescore: 7.2/10" without breakdown leads users to over-trust or dismiss it. Developers need to understand WHY a location scores well or poorly.

**Prevention:**
- Always show composite alongside sub-indices (Veiligheid, Bereikbaarheid, Voorzieningen, Demografie, Economie).
- Show trend direction (arrow up/down/stable) for each sub-index.
- Include gemeente-relative context: a wijk scoring 6/10 nationally might be 8/10 within its gemeente.
- Use the existing ParcelDetailModal pattern for progressive disclosure.

**Confidence:** MEDIUM -- UX best practice.

### Pitfall 14: OData v3 vs v4 Syntax for Politie and Nabijheid Datasets

**What goes wrong:** The existing CBS client uses OData v4 syntax (`/Observations`, `WijkenEnBuurtenCodes`, `eq` filters). The politie dataset (47018NED on `dataderden.cbs.nl`) and possibly the nabijheid dataset likely use OData v3 (`/TypedDataSet`, dimension tables, different filter syntax). Using v4 queries against v3 endpoints returns 404 or garbled results.

**Prevention:**
- Test each endpoint independently before building the client. Fetch the root entity of each dataset to determine the available entities (`TypedDataSet` = v3, `Observations` = v4).
- Build the client to handle both v3 and v4 response formats, or create separate client classes.
- The v3 entity for crime data is likely `https://dataderden.cbs.nl/ODataApi/OData/47018NED/TypedDataSet` with different filter syntax.

**Detection:** HTTP 404 when querying `Observations` on a v3-hosted dataset.

**Confidence:** MEDIUM -- politie host confirmed as `dataderden.cbs.nl`, but exact OData version needs live verification.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Extended CBS metrics (inkomen, huishoudens, leeftijd) | Measure code drift between years (#1), semantic drift (#4) | Build year-aware measure code mapping; verify codes AND definitions against MeasureCodes entity per dataset |
| Criminaliteitsdata integration | Different OData host + v3 syntax (#3, #14), privacy suppression (#5) | Separate client class for `dataderden.cbs.nl`; accept suppression; use totals not subcategories |
| Voorzieningennabijheid | Wrong tool choice (#7), CRS mismatch (#8) | Use CBS 86134NED nabijheid dataset; avoid Overpass API entirely |
| Multi-year CBS trendanalyse | Code drift (#1), semantic drift (#4), herindeling (#10), provisional data (#9) | Year-aware codes; semantic stability checks; herindeling mapping; provisional labeling |
| Geaggregeerde locatie-score | Normalization destroying signal (#2), weighting bias (#6), no context (#13) | Percentile-rank normalization; confidence tracking; sub-index breakdown in UI |
| Integration with existing area scan | Rate limiter exhaustion (#11), three-dataset problem (#3) | Batch queries; aggressive caching; pre-compute in ARQ job; separate limiters per host |

---

## Key Architectural Recommendations

### 1. Use CBS Nabijheid Dataset for Proximity (NOT Overpass/OSM)

CBS dataset 86134NED (2024) provides pre-computed road-network distances to: huisarts, apotheek, supermarkt, kinderdagverblijf, buitenschoolse opvang, basisschool, middelbare school, treinstation, OV-halte, museum, restaurant -- per wijk/buurt.

This eliminates pitfalls #7 (wrong tool) and #8 (CRS mismatch) entirely, provides higher quality data (road-network distances, not Euclidean), and requires zero additional infrastructure.

### 2. Use Politie CBS Portal for Crime (NOT raw politie APIs)

Dataset 47018NED at `dataderden.cbs.nl` provides crime counts per wijk/buurt with **2025 classification applied retroactively to all years**. This means historical crime comparisons are already geography-normalized -- eliminating pitfall #10 (herindeling) for crime data specifically.

### 3. Three-Client Architecture

Build three OData clients, not one:
- `CBSKerncijfersClient` -- v4, `datasets.cbs.nl`, for WOZ/demografie/inkomen
- `CBSNabijheidClient` -- v3 or v4 (verify), `opendata.cbs.nl`, for proximity data
- `PolitieCrimeClient` -- v3 (verify), `dataderden.cbs.nl`, for crime data

All three follow the same caching and rate-limiting patterns but with host-specific configurations.

---

## "Looks Done But Isn't" Checklist for v12.0

- [ ] **Multi-year measure codes**: `MEASURE_CODES` is per-dataset-ID, not a single flat dict
- [ ] **Semantic stability**: Each trend-eligible measure has a `semantic_stable` flag verified across the full year range
- [ ] **Three datasets**: Kerncijfers, Nabijheid, and Politie all have separate client code with correct host URLs
- [ ] **OData version**: Each client uses the correct entity structure (v3 TypedDataSet vs v4 Observations) for its host
- [ ] **Normalization method**: Percentile-rank (not min-max) used for composite scoring
- [ ] **Score direction**: Each metric has an explicit `higher_is_better` flag; stedelijkheid excluded from composite
- [ ] **Data completeness**: Confidence/completeness ratio tracked per wijk; minimum threshold enforced
- [ ] **Missing data**: `null` stored and displayed as "Geen data", never treated as zero
- [ ] **Provisional labeling**: Most recent year's data flagged as "voorlopig" where applicable
- [ ] **Crime normalization**: Per-1000-inhabitants, using kerncijfers population data
- [ ] **Crime suppression**: "Totaal misdrijven" used as primary metric; subcategory suppression documented in UI
- [ ] **Proximity source**: CBS nabijheid dataset used, NOT Overpass/OSM
- [ ] **Rate limiters**: Separate limiters per host; batch queries per gemeente
- [ ] **Cache TTL**: Annual data cached 30+ days; provisional data cached with shorter TTL
- [ ] **Score breakdown**: UI shows sub-indices alongside composite; trend arrows per dimension
- [ ] **Peiljaar visible**: Every data point shows its reference year in the UI

---

## Sources

- [CBS Kerncijfers wijken en buurten 2025 (86165NED)](https://www.cbs.nl/nl-nl/cijfers/detail/86165NED)
- [CBS Toelichting Wijk- en Buurtkaart 2023-2025 -- theme/measure changes](https://www.cbs.nl/nl-nl/longread/diversen/2025/toelichting-wijk-en-buurtkaart-2023-2024-en-2025?onepage=true)
- [CBS Nabijheid voorzieningen 2024 (86134NED)](https://www.cbs.nl/nl-nl/cijfers/detail/86134NED)
- [CBS Nabijheidsstatistieken per wijk/buurt](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/wijk-en-buurtstatistieken/nabijheidsstatistieken-per-wijk-buurt)
- [Politie misdrijven wijk/buurt jaarcijfers (47018NED)](https://data.overheid.nl/dataset/5252-geregistreerde-misdrijven--soort-misdrijf--wijk--buurt--jaarcijfers)
- [CBS Herindelingen en grenswijzigingen](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/informatie-voor-gemeenten/herindelingen-en-grenswijzigingen)
- [CBS Gemeentelijke indeling 2025 -- 342 gemeenten, geen herindeling](https://www.cbs.nl/nl-nl/onze-diensten/methoden/classificaties/overig/gemeentelijke-indelingen-per-jaar/indeling-per-jaar/gemeentelijke-indeling-op-1-januari-2025)
- [Targomo: Meaningful Location Scoring for Real Estate](https://www.targomo.com/meaningful-location-scoring-for-real-estate-search/)
- [Overpass API rate limits and usage policy (OSM Wiki)](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [Politie Open Data portal](https://data.politie.nl/)
- Existing codebase: `backend/app/government_apis/cbs_odata.py`, `backend/app/government_apis/rate_limiter.py`, `backend/app/models/parcel_cache.py`

---

*Pitfalls research for: v12.0 Omgevings- & Leefbaarheids-Scorer -- location scoring, multi-year trends, proximity, crime data*
*Researched: 2026-03-07*
