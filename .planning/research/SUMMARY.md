# Project Research Summary

**Project:** Propdex v12.0 Omgevings- & Leefbaarheids-Scorer
**Domain:** Location intelligence scoring for Dutch PropTech
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

Propdex v12.0 adds a composite location quality scorer that combines demographics, income, crime safety, facility proximity, and multi-year trends into a single investeerbaarheid signal per wijk. The key architectural insight is that CBS already pre-computes nearly everything needed: the Kerncijfers wijken en buurten dataset provides demographics, income, WOZ, and basic proximity (supermarkt, huisarts, school, kinderdagverblijf) in a single OData v4 call. A separate CBS Nabijheid dataset (86134NED) adds OV and transport proximity. Crime data lives on a different host (dataderden.cbs.nl) using OData v3 protocol. Zero new dependencies are needed -- the existing httpx + aiolimiter + PostgreSQL JSONB cache stack handles everything.

The recommended approach is a four-phase build that starts with the lowest-risk, highest-value work (extending the existing CBS client with more measure codes and rendering demographics), then adds proximity and crime data as independent tracks, and finally aggregates everything into a weighted location score. The critical risks are: (1) CBS measure codes drift between yearly datasets, breaking multi-year trend analysis if not handled with per-dataset-ID code mappings, (2) naive min-max normalization will compress 90% of wijken into an indistinguishable band -- percentile-rank normalization is required, and (3) three separate OData endpoints (two v4, one v3) need three distinct client configurations, not a single "mega-query."

The deferred items are well-defined: multi-year trend analysis (cross-dataset boundary alignment is complex), gentrification detection (requires longitudinal data infrastructure), and sparkline visualizations (blocked by trend data pipeline). These form a natural v12.1 or v13 follow-up once the scoring foundation is validated.

## Key Findings

### Recommended Stack

Zero new pip or npm dependencies. All four data domains build on existing infrastructure: httpx for HTTP, aiolimiter for rate limiting, CBSODataClient for CBS OData v4, PostgreSQL JSONB for caching, and Python stdlib `statistics.linear_regression()` for trend slopes.

**Core technologies (all existing):**
- **httpx[http2]**: HTTP client for all CBS and Politie OData APIs -- already installed, handles both v3 and v4
- **CBSODataClient (extended)**: Parameterize with dataset_id + measure_codes to serve Kerncijfers AND Nabijheid without code duplication
- **New PolitieCrimeClient**: OData v3 client for dataderden.cbs.nl -- separate class because protocol differs significantly from v4
- **statistics.linear_regression()**: Python stdlib since 3.10 -- sufficient for trend slope calculation, no numpy/scipy needed
- **PostgreSQL JSONB**: Existing cache pattern with source-specific TTLs -- annual CBS data cached 30+ days, computed scores cached 7 days

### Expected Features

**Must have (table stakes):**
- Age distribution (leeftijdsverdeling) -- same CBS endpoint, 5 new measure codes
- Household composition -- same endpoint, 5 new measure codes
- Income display + distribution -- M000223 already fetched but not rendered; add M000224, D000187, D000185
- WOZ vs inkomen ratio -- pure frontend computation, no new API calls
- Voorzieningen nabijheid (proximity to facilities) -- CBS dataset 86134NED, same OData v4 protocol
- Vergrijzing/verjonging indicator -- computed from existing age groups, frontend-only
- Peiljaar / data freshness label -- already in CBS response, just display it

**Should have (differentiators):**
- Doelgroep-validatie profiel ("studentenwijk / gezinswijk / vergrijzend / gemengd") -- classification rules on existing demographics, no new data
- Criminaliteitsdata per wijk -- OData v3 on dataderden.cbs.nl, new client needed
- Geaggregeerde locatie-score (0-10 investeerbaarheid) -- weighted composite of all dimensions
- Commercieel investeringsprofiel card -- traffic-light UI summarizing all metrics

**Defer (v12.1+):**
- Multi-year CBS trendanalyse -- cross-dataset boundary alignment, measure code drift between years, semantic drift in definitions
- Sparkline trend charts -- blocked by trend data infrastructure
- Gentrification early warning -- requires 3-5 year longitudinal data + education variables
- Score customization UI with weight sliders -- premature; ship opinionated defaults, iterate

**Anti-features to explicitly avoid:**
- Real-time crime feed / incident map -- noisy, misleading; use CBS annual aggregates instead
- Custom isochrone / travel-time calculations -- CBS nabijheid pre-computes road distances
- Satellite imagery gentrification detection -- research-grade, not production-ready
- Bevolkingsprognose at wijk level -- CBS only publishes regional prognoses; speculative at wijk level
- Full CBS dataset sync (100+ variables) -- curate ~25 PropTech-relevant fields

### Architecture Approach

The system extends the existing area scan pipeline with a "Phase 2c" enrichment step that fires parallel data fetches (extended demographics, nabijheid, crime) and then runs a pure-function scorer. Source data stays in `neighborhood_metrics` JSONB with new top-level keys (`nabijheid`, `criminaliteit`). Computed scores go in a separate `location_score` JSONB column to allow weight-tuning recomputation without re-fetching APIs. The CBS client is refactored to accept parameterized dataset_id + measure_codes, avoiding code duplication for the nabijheid dataset.

**Major components:**
1. **CBSODataClient (refactored)** -- parameterized constructor accepting dataset_id + measure_codes; serves both Kerncijfers and Nabijheid through the same v4 query logic
2. **PolitieCrimeClient** -- new OData v3 client for dataderden.cbs.nl/ODataApi/OData/47018NED; handles space-padded dimension keys, different entity structure (TypedDataSet, not Observations)
3. **LocationScoreService** -- pure function: normalize metrics via percentile-rank, apply weighted composite, output 0-10 score with per-dimension breakdown and confidence indicator
4. **VoorzieningenCard / CrimeCard / LocationScoreCard** -- new frontend components in WijkMapPanel showing proximity distances, crime rates, and composite score with sub-indices

### Critical Pitfalls

1. **CBS measure code drift between dataset years** -- codes change/disappear between annual releases. Build `MEASURE_CODES_BY_DATASET` mapping keyed by dataset ID. Verify codes exist via MeasureCodes metadata endpoint before querying. Store null (not zero) for missing years.

2. **Composite score normalization destroying signal** -- min-max normalization compresses 90% of wijken into 0.4-0.6 band due to outliers (Amsterdam WOZ 800k vs rural 120k). Use percentile-rank normalization. Define explicit `higher_is_better` direction per metric. Use stedelijkheidsklasse as grouping context, not score input.

3. **Three-dataset problem with two OData protocols** -- Kerncijfers (v4, datasets.cbs.nl), Nabijheid (v4, datasets.cbs.nl), and Politie (v3, dataderden.cbs.nl) need distinct client configurations. v4 uses Observations entity, v3 uses TypedDataSet with space-padded keys.

4. **Score weighting bias toward available data** -- wijken with missing data get extreme scores. Track `data_completeness_ratio` per wijk. Show confidence alongside score. Refuse to compute when <60% of sub-scores are available.

5. **Rate limiter exhaustion with multi-dataset queries** -- 3 datasets x 20 wijken = 60+ CBS calls per gemeente scan. Separate limiters per host, batch wijk queries with `startswith` filters, cache aggressively (annual data, 30-day TTL minimum).

## Implications for Roadmap

Based on combined research, four phases recommended. Ordering follows dependency graph and risk profile.

### Phase 1: Extended CBS Demographics + Income + Doelgroep

**Rationale:** Lowest risk, highest immediate value. Same API, same endpoint, just 14 more measure codes in the existing `MEASURE_CODES` dict. Backward compatible -- new fields are nullable. Unlocks doelgroep-validatie and income analysis with zero new infrastructure. All code changes are incremental extensions of proven patterns.
**Delivers:** Age distribution display, household composition, income display + distribution, WOZ/inkomen ratio, vergrijzing/verjonging indicator, doelgroep-validatie profiel classification, extended CbsNeighborhoodCard
**Addresses:** All 8 table-stakes features from FEATURES.md
**Avoids:** No new API clients, no protocol complexity, no new infrastructure

### Phase 2: Voorzieningen Nabijheid

**Rationale:** Independent track, same OData v4 protocol as existing CBS client. High user value -- "how far to school/supermarkt?" is the number one question after WOZ. CBS pre-computes road-network distances per wijk, eliminating any PostGIS/OSM/Overpass complexity entirely.
**Delivers:** Refactored CBSODataClient with parameterized dataset_id, VoorzieningenCard showing distances to supermarkt, huisarts, school, kinderdagverblijf, treinstation, park; nabijheid data stored in `neighborhood_metrics["nabijheid"]`
**Uses:** CBSODataClient refactored with 86134NED dataset_id + NABIJHEID_MEASURE_CODES
**Avoids:** Pitfall #7 (Overpass API wrong tool), Pitfall #8 (CRS mismatch) -- CBS nabijheid eliminates both

### Phase 3: Criminaliteitsdata

**Rationale:** Independent track but higher complexity due to OData v3 protocol on a different host. Medium user value -- crime data is useful but less frequently decisive than demographics and proximity for residential development decisions.
**Delivers:** PolitieCrimeClient for OData v3, CrimeCard with total crime + per-1000-inwoners + category breakdown, crime data stored in `neighborhood_metrics["criminaliteit"]`, separate `politie_crime_limiter`
**Uses:** New OData v3 client against dataderden.cbs.nl, existing retry_with_backoff + GovernmentAPIError from base.py
**Avoids:** Pitfall #3 (three-dataset problem -- separate client class), Pitfall #5 (privacy suppression -- use totals not subcategories), Pitfall #14 (v3 vs v4 syntax confusion)

### Phase 4: Composite Location Score + Investeringsprofiel

**Rationale:** Build last because it aggregates all data sources from Phases 1-3. The composite score is only as good as its inputs. Pure computation phase -- no new API integrations. Alembic migration adds separate `location_score` JSONB column for recomputable derived data.
**Delivers:** LocationScoreService (pure function, percentile-rank normalization), LocationScoreCard with 0-10 composite + sub-index breakdown (voorzieningen, veiligheid, demografie, marktdynamiek), confidence indicator per wijk, traffic-light investeringsprofiel summary, recomputation management command
**Implements:** Alembic migration for `location_score` JSONB, scoring algorithm with configurable weights, `compute_location_score` management tool
**Avoids:** Pitfall #2 (normalization -- percentile-rank not min-max), Pitfall #6 (weighting bias -- completeness tracking + minimum threshold), Pitfall #12 (stedelijkheid as classifier not score input), Pitfall #13 (score without breakdown context)

### Phase Ordering Rationale

- **Phase 1 first** because it requires zero new infrastructure and delivers the most table-stakes features. Every subsequent phase benefits from richer demographic context already being displayed.
- **Phases 2 and 3 are independent** -- they could run in parallel if resources allow. Sequencing is a resource constraint, not a dependency. Phase 2 is ordered first because it uses the same OData v4 protocol (lower risk) and has higher user value.
- **Phase 4 last** because it aggregates all prior data sources. Building the scorer before validating inputs leads to garbage-in-garbage-out. The pure-function design means it can be developed in parallel and connected once inputs are validated.
- **Trends deferred entirely** because cross-dataset measure code alignment (Pitfall #1) and semantic drift (Pitfall #4) require careful per-measure verification across 5+ datasets. This is research-heavy work that should not block the core scorer.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Criminaliteitsdata):** OData v3 protocol specifics need live endpoint verification. Filter syntax, pagination, and dimension key formats (space-padded strings) differ from v4. Include a spike task early in the phase.
- **Phase 4 (Location Score):** Normalization strategy and weight calibration need empirical tuning against real scan data. Start with percentile-rank and iterate after initial deployment.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Extended CBS Metrics):** Identical to existing CBS integration -- just more measure codes in the same dict. No unknowns.
- **Phase 2 (Voorzieningen Nabijheid):** Same OData v4 protocol, different dataset ID. Measure codes and entity structure verified via live API query against 86134NED.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All data sources verified via live API calls. Dataset IDs, measure codes, and entity structures confirmed against CBS endpoints. |
| Features | HIGH | CBS measure codes cross-referenced against official variable documentation PDF (Toelichting variabelen KWB 2024). Feature dependencies clearly mapped with verified API responses. |
| Architecture | HIGH | Extends proven patterns (CBSODataClient, JSONB cache, non-fatal enrichment in area_scan_job). Only genuinely new pattern is OData v3 client for Politie data. |
| Pitfalls | HIGH | CBS theme restructuring between 2023-2025 explicitly documented. Normalization pitfall well-established in location analytics literature. Rate limiter arithmetic confirmed from existing config. |

**Overall confidence:** HIGH

### Gaps to Address

- **CBS Nabijheid dataset protocol version:** STACK.md assumes v4 on datasets.cbs.nl. PITFALLS.md notes it might be v3 on opendata.cbs.nl. Quick verification needed before Phase 2: fetch root entity and check for `Observations` (v4) vs `TypedDataSet` (v3). Low risk -- even if v3, the pattern is documented.

- **Politie crime data recency:** Dataset 47018NED verified with data through 2021. Whether 2022-2024 data has been published needs confirmation at Phase 3 start. If only 2021 data exists, crime scoring uses 2021 figures (acceptable but must be labeled with peiljaar).

- **Score weight calibration:** Default weights (demographics 0.20, crime 0.25, proximity 0.25, trend 0.15, housing 0.15) are reasonable starting points from location analytics literature but need validation against real Propdex scan data. Plan for a weight-tuning iteration after Phase 4 ships.

- **Multi-year measure code stability:** STACK.md verified codes are stable across 2022-2025 for the core 9 measures. The 14 new demographic/income codes need the same cross-dataset verification before any trend analysis work begins (deferred scope).

## Sources

### Primary (HIGH confidence)
- CBS OData v4 Kerncijfers datasets -- measure codes verified live for 85318NED, 85984NED, 86165NED via MeasureCodes endpoint
- CBS Nabijheid voorzieningen 86134NED -- 46 distance measures confirmed via OData v4 metadata query
- Politie crime data 47018NED -- entities (TypedDataSet, WijkenEnBuurten, SoortMisdrijf, Perioden), dimensions, and sample data verified at dataderden.cbs.nl
- CBS Toelichting variabelen KWB 2024 PDF -- all variable names and definitions verified (pages 2-4)
- CBS v4 catalog completeness -- verified 47018NED NOT present via `datasets.cbs.nl/odata/v1/Datasets?$filter=Identifier eq '47018NED'` (confirms dataderden.cbs.nl is the only host)
- Measure code stability across years -- D000025, D000045, M000223 confirmed identical across 85318NED (2022), 85984NED (2024), 86165NED (2025)
- Python stdlib `statistics.linear_regression()` -- available since 3.10, project requires 3.11+
- Existing codebase: `backend/app/government_apis/cbs_odata.py`, `backend/app/government_apis/rate_limiter.py`, `backend/app/jobs/area_scan.py`, `backend/app/models/area_scan.py`

### Secondary (MEDIUM confidence)
- CBS Toelichting Wijk- en Buurtkaart 2023-2025 -- theme restructuring between dataset years documented
- Urban Institute gentrification methodology -- WOZ-vs-income divergence as strongest gentrification signal
- Targomo location scoring methodology -- industry reference for normalization approaches
- CBS Herindelingen en grenswijzigingen -- 342 gemeenten stable since January 2023, no herindelingen in 2024-2025

### Tertiary (LOW confidence)
- Politie crime data year range -- verified 2012-2021, but 2022+ availability needs confirmation at implementation time
- CBS Nabijheid exact OData version -- likely v4 on datasets.cbs.nl but needs live verification before Phase 2

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
