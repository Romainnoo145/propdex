# Feature Landscape

**Domain:** Location Intelligence Scoring for PropTech (v12.0 Omgevings- & Leefbaarheids-Scorer)
**Researched:** 2026-03-07
**Confidence:** HIGH -- CBS OData API measure codes verified live, variable documentation confirmed via official PDF, existing codebase analyzed

---

## Context: What's Already Built

**CBS OData v4 client** (`backend/app/government_apis/cbs_odata.py`):
- `CBSODataClient` targets OData v4 endpoint (`datasets.cbs.nl/odata/v1/CBS/`)
- Currently fetches 9 measure codes: WOZ, stedelijkheid, OAD, inwoners, woningvoorraad, koopwoningen, huurwoningen, bevolkingsdichtheid, inkomen
- Inkomen (`M000223`) is already in `MEASURE_CODES` dict but NOT exposed in UI
- Result stored as `neighborhood_metrics` JSONB on `AreaScan` model
- `CbsNeighborhoodCard` renders: stedelijkheid badge, WOZ, inwoners, koop/huur ratio, adressendichtheid, bouwjaar
- `WijkMapPanel` includes `CbsNeighborhoodCard` when scan has completed

**Key insight:** The existing OData client fetches from a single dataset per call. Adding more measure codes to the same dataset is trivial (expand the `MEASURE_CODES` dict). Adding a *separate* dataset (voorzieningen, criminaliteit) requires new client methods or a second query.

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Age distribution (leeftijdsverdeling) | Any location profiler shows age breakdown; developers need it for doelgroep-validatie (student housing vs senior living vs families) | Low | CBS KWB measure codes: `10680` (0-14), `53050` (15-24), `53310` (25-44), `53715` (45-64), `80200` (65+). Same OData endpoint, same query pattern |
| Household composition | Eenpersoonshuishoudens vs gezinnen determines housing product type (studio's vs eengezinswoningen) | Low | CBS KWB: `1050010_2` (totaal), `1050015` (eenpersoons), `1016040` (zonder kinderen), `1016030` (met kinderen), `M000114` (gem. grootte). Same endpoint |
| Income display in wijk panel | Income data next to WOZ validates purchasing power -- "can residents here afford what we want to build?" | Low | `M000223` already fetched but not rendered. Add `M000224` (per inwoner), `M000222` (gestandaardiseerd huishouden). Only UI work for existing code |
| Income distribution indicators | % laagste/hoogste inkomens signals wealth inequality and target market viability | Low | `D000187` (40% laagste), `D000185` (20% hoogste). Same OData endpoint |
| WOZ vs inkomen ratio | Developers need marktconformiteits-check: "are property values aligned with local purchasing power?" | Low | Pure frontend computation: `gemiddelde_woz_waarde / g_ink_po`. No new API calls, just a derived display metric |
| Vergrijzing/verjonging indicator | Simple "is this wijk aging or getting younger?" arrow gives instant demographic trajectory | Low | Computed from age groups: `a_65_oo / a_inw` vs `(a_00_14 + a_15_24) / a_inw`. Frontend-only calculation |
| Voorzieningen nabijheid (proximity to facilities) | "How far to nearest supermarket/school/doctor?" is fundamental location quality for residential development | Medium | **Separate CBS dataset** `86134NED`. Measure codes: `D000028` (huisarts), `D000025` (supermarkt), `D000029` (kdv), `D000045` (school), `D000263` (scholen <3km). Requires second OData query but same v4 protocol |
| Peiljaar / data freshness display | Users must know if statistics are 2023 or 2025 data to calibrate trust | Low | `peiljaar` already in CBS response. Add label to card header. Already partially shown in CbsNeighborhoodCard |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Doelgroep-validatie profiel | "Wie woont hier?" classification: studentenwijk / gezinswijk / vergrijzend / gemengd. Instantly tells developer if planned product matches neighborhood | Low | Classification rules on age groups + household composition. E.g., >30% single-person + high 15-24 = "studentenwijk". No new data, just logic |
| Criminaliteitsdata per wijk | Quantified safety score for go/no-go decisions. Hard data instead of gut feeling about neighborhood safety | Medium | CBS table `47018NED` on `dataderden.cbs.nl/ODataApi/OData/` (OData v3 protocol, NOT v4). Annual data by wijk. Need new client for OData v3 endpoint |
| Geaggregeerde locatie-score | Single 0-100 "investeerbaarheid" number combining ALL location factors into one go/no-go signal | Medium | Weighted composite: income/WOZ ratio + voorzieningen proximity + crime rate + demographic fit. Weighting is opinionated. Store as `location_score` alongside existing `opportunity_score` |
| Commercieel investeringsprofiel card | Dashboard-style summary card with traffic-light indicators replacing scattered metrics | Low | UI composition work. Green/amber/red indicators per dimension (demografie, inkomen, veiligheid, voorzieningen). No new data |
| Multi-year CBS trendanalyse | "WOZ +18% over 3 years, inkomen stagnant" -- market momentum indicator for investment thesis | High | Each CBS year is a SEPARATE dataset (85318NED=2022, 85618NED=2023, 85984NED=2024, 86165NED=2025). Wijk boundaries may change between years (`ind_wbi` flag). Significant data alignment challenge |
| Sparkline trend charts | Mini inline charts showing WOZ/inkomen/bevolking trajectory over 3-5 years | Medium | Depends on multi-year data infrastructure. Frontend sparkline rendering itself is trivial (CSS/SVG) |
| Gentrification early warning | Flag wijken where WOZ rises faster than income, or demographic shift toward younger/higher-educated | High | Requires multi-year trend data + education data (`a_opl_lg`, `a_opl_md`, `a_opl_hg` in KWB). Research confirms WOZ-growth vs income-growth divergence is the strongest gentrification signal |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time crime feed / incident map | Politie incident API is per-event, not statistical; creates noisy/alarming UI that misleads about actual risk levels | Use CBS aggregated annual crime stats per wijk (47018NED) -- methodologically sound, privacy-respecting |
| Veiligheidsmonitor leefbaarheidsperceptie | CBS Veiligheidsmonitor (85146NED) is survey-based, only at *regional* level (not wijk), biannual. Measures perception not reality | Use registered crime counts + CBS nabijheid data. Objective metrics beat subjective surveys for investment decisions |
| Custom isochrone / travel-time calculations | Building own routing engine for "15-minute city" analysis is massive scope (GTFS, routing, map rendering) | CBS nabijheid voorzieningen (86134NED) already pre-computes road-distance to nearest facilities per wijk. Use their data |
| Satellite imagery gentrification detection | ML on satellite/Street View images is research-grade, not production-ready. Papers show 74% accuracy -- insufficient for investment decisions | Use CBS demographic shift indicators (age/income change over years) as proxy. Proven methodology, available data |
| Score customization UI with weight sliders | Premature; users don't know what weights to set. Creates "analysis paralysis" and support burden | Ship opinionated default weights. Allow per-organization override via config (not UI). Iterate on weights based on user feedback |
| Bevolkingsprognose (population forecast) | CBS publishes regional prognoses but NOT at wijk level. Any wijk-level forecast would be speculative and misleading | Show historical trend + direction arrow. Let the developer draw their own conclusion. Responsible data presentation |
| OV-score / PTAL calculation | UK-style Public Transport Accessibility Level requires GTFS feed parsing, stop-level frequency weighting | Use CBS `afstand tot treinstation` + `afstand tot OV-halte` from nabijheid dataset (86134NED). Simpler, same quality |
| Full CBS dataset sync (100+ variables) | 100+ fields x 12,000+ wijken = massive payload; most irrelevant to PropTech (jeugdzorg, WMO, brandstoftype auto's) | Curated ~25 field selection covering demographics, income, housing, voorzieningen. Fast, focused, maintainable |

---

## Feature Dependencies

```
Extended CBS demographics (age, households) -----> Doelgroep-validatie profiel
         |                                                    |
         v                                                    v
Income metrics (display + distribution) ---------> WOZ/inkomen marktconformiteit ratio
         |                                                    |
         v                                                    v
Voorzieningen nabijheid (new dataset) -----------> Geaggregeerde locatie-score <--- Criminaliteitsdata
                                                              |
Multi-year trendanalyse (cross-dataset) --------->  Sparkline trends
         |                                                    |
         v                                                    v
         +---- Gentrification early warning (DEFER)
```

### Dependency Notes

- **Extended demographics + income are prerequisites for ALL derived features.** They extend the existing CBS client with minimal code changes.
- **Voorzieningen nabijheid is an independent track.** New dataset (86134NED) uses same OData v4 protocol but different dataset ID. Can be built in parallel.
- **Criminaliteitsdata is an independent track** with extra complexity: OData v3 protocol on `dataderden.cbs.nl` (not `datasets.cbs.nl`). Different API client needed.
- **Multi-year trends are the hardest feature** due to cross-dataset boundary alignment. The `ind_wbi` indicator (values 1/2/3) flags whether a wijk changed between years. Value 3 = "boundary changed, cannot compare" -- requires excluding those wijken from trend analysis.
- **Geaggregeerde locatie-score depends on ALL data sources.** Build it last, once all inputs are available and validated.

---

## MVP Recommendation

**Phase 1 -- Extended CBS Metrics (Low complexity, highest value):**

Priority:
1. Add age group measure codes to `MEASURE_CODES` dict (5 codes)
2. Add household composition measure codes (5 codes)
3. Add income distribution codes (2 codes)
4. Extend `CbsNeighborhoodMetrics` TypeScript type with new optional fields
5. Extend `CbsNeighborhoodCard` with demographics section (age pie/bar, household breakdown)
6. Add income section (inkomen display, WOZ/inkomen ratio)
7. Add vergrijzing/verjonging indicator badge
8. Add doelgroep-validatie profiel classification

*Rationale:* Same API, same endpoint, same query. Just more measure codes in the filter and more fields in the response. Backward compatible (new fields are nullable).

**Phase 2 -- Voorzieningen Nabijheid (Medium complexity, high value):**

Priority:
1. Add `get_voorzieningen_data()` method to CBS client targeting dataset `86134NED`
2. Fetch during area scan job (alongside existing CBS call)
3. Store in `neighborhood_metrics` JSONB (new `voorzieningen` key)
4. New `VoorzieningenCard` component showing distances
5. Integrate into wijk panel alongside CbsNeighborhoodCard

*Rationale:* Same OData v4 protocol, different dataset. Independent of Phase 1. High user value -- "how far to school/supermarkt?" is the #1 question after "what is the WOZ?"

**Phase 3 -- Criminaliteitsdata (Medium complexity, medium value):**

Priority:
1. New OData v3 client for `dataderden.cbs.nl/ODataApi/OData/47018NED`
2. Fetch crime statistics per wijk (total + by category: vermogensdelicten, vernieling, geweld)
3. Store in `neighborhood_metrics` JSONB (new `veiligheid` key)
4. New `VeiligheidCard` component with crime rate per 1000 inwoners

*Rationale:* Different API protocol (OData v3) adds complexity. Crime data is useful but less frequently decisive than demographics and voorzieningen for residential development decisions.

**Phase 4 -- Aggregated Score + Investeringsprofiel (Medium complexity, ties everything together):**

Priority:
1. Location score algorithm: weighted normalization of all dimensions
2. `InvesteringsprofielCard` as summary dashboard with traffic-light indicators
3. `location_score` column in scan results for wijk-level comparison
4. Score explanation breakdown (which factors contribute most)

*Rationale:* Build last because it depends on all data sources being validated. The composite score is only as good as its inputs.

**Defer:**
- **Multi-year trendanalyse:** Cross-dataset boundary alignment is a data engineering project. Research needed on whether CBS provides any cross-year reconciled datasets. `ind_wbi` handling adds significant complexity.
- **Gentrification detection:** Blocked by trend infrastructure. Academic research shows this works but requires 3-5 year longitudinal data.
- **Sparkline trends:** Blocked by trend data. The visualization is easy; the data pipeline is hard.

---

## CBS OData Measure Code Reference

### Already implemented (v11.0)
| Code | Variable | Description |
|------|----------|-------------|
| M001642 | g_wozbag | Gemiddelde WOZ-waarde (x1000 EUR) |
| ST0001 | ste_mvs | Mate van stedelijkheid (1-5) |
| ST0003 | ste_oad | Omgevingsadressendichtheid (adressen/km2) |
| T001036 | a_inw | Aantal inwoners |
| M000297 | a_woning | Woningvoorraad |
| 1014800 | p_koopw | Koopwoningen % |
| 1014850_2 | p_huurw | Huurwoningen totaal % |
| M000100 | bev_dich | Bevolkingsdichtheid (inw/km2) |
| M000223 | g_ink_po | Gem. inkomen per inkomensontvanger |

### To add -- Demographics (same dataset)
| Code | Variable | Description | Phase |
|------|----------|-------------|-------|
| 10680 | a_00_14 | 0 tot 15 jaar (aantal) | 1 |
| 53050 | a_15_24 | 15 tot 25 jaar (aantal) | 1 |
| 53310 | a_25_44 | 25 tot 45 jaar (aantal) | 1 |
| 53715 | a_45_64 | 45 tot 65 jaar (aantal) | 1 |
| 80200 | a_65_oo | 65 jaar of ouder (aantal) | 1 |
| 1050010_2 | a_hh | Huishoudens totaal | 1 |
| 1050015 | a_1p_hh | Eenpersoonshuishoudens | 1 |
| 1016040 | a_hh_z_k | Huishoudens zonder kinderen | 1 |
| 1016030 | a_hh_m_k | Huishoudens met kinderen | 1 |
| M000114 | g_hhgro | Gemiddelde huishoudensgrootte | 1 |

### To add -- Income (same dataset)
| Code | Variable | Description | Phase |
|------|----------|-------------|-------|
| M000224 | g_ink_pi | Gem. inkomen per inwoner | 1 |
| M000222 | g_hh_sti | Gem. gestandaardiseerd huish. inkomen | 1 |
| D000187 | p_ink_li | 40% personen met laagste inkomen | 1 |
| D000185 | p_ink_hi | 20% personen met hoogste inkomen | 1 |

### Separate dataset 86134NED -- Voorzieningen
| Code | Variable | Description | Phase |
|------|----------|-------------|-------|
| D000028 | g_afs_hp | Afstand tot huisartsenpraktijk (km) | 2 |
| D000025 | g_afs_gs | Afstand tot grote supermarkt (km) | 2 |
| D000029 | g_afs_kv | Afstand tot kinderdagverblijf (km) | 2 |
| D000045 | g_afs_sc | Afstand tot school (km) | 2 |
| D000263 | g_3km_sc | Scholen binnen 3 km (aantal) | 2 |

### Separate dataset 47018NED -- Criminaliteit (dataderden.cbs.nl, OData v3)
| Endpoint | Protocol | Description | Phase |
|----------|----------|-------------|-------|
| `dataderden.cbs.nl/ODataApi/OData/47018NED` | OData v3 | Geregistreerde misdrijven per wijk/buurt, jaarcijfers | 3 |
| `dataderden.cbs.nl/ODataApi/OData/47022NED` | OData v3 | Geregistreerde misdrijven per wijk/buurt, maandcijfers | 3 |

### Multi-year dataset IDs (for future trend analysis)
| Dataset ID | Peiljaar | Status |
|------------|----------|--------|
| 85318NED | 2022 | Available |
| 85618NED | 2023 | Available |
| 85984NED | 2024 | Available, current default |
| 86165NED | 2025 | Available (partial, quarterly updates) |

---

## Sources

- [CBS Kerncijfers wijken en buurten 2024 (85984NED)](https://www.cbs.nl/nl-nl/cijfers/detail/85984NED) -- confirmed via OData v4 query
- [CBS Kerncijfers wijken en buurten 2025 (86165NED)](https://www.cbs.nl/nl-nl/maatwerk/2025/40/kerncijfers-wijken-en-buurten-2025)
- [CBS Toelichting variabelen KWB 2024 (PDF)](https://www.cbs.nl/-/media/_pdf/2024/35/toelichting-variabelen-kwb-2024.pdf) -- all variable names/definitions verified, pages 2-4 contain full variable listing
- [CBS Nabijheid voorzieningen wijk/buurt 2024 (86134NED)](https://www.cbs.nl/nl-nl/cijfers/detail/86134NED) -- confirmed dataset ID and facility types
- [CBS Nabijheidsstatistieken per wijk/buurt reeks](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/wijk-en-buurtstatistieken/nabijheidsstatistieken-per-wijk-buurt) -- historical versions available
- [Geregistreerde misdrijven per wijk/buurt jaarcijfers (47018NED)](https://data.overheid.nl/dataset/5252-geregistreerde-misdrijven--soort-misdrijf--wijk--buurt--jaarcijfers) -- OData v3 on dataderden.cbs.nl, confirmed
- [CBS Veiligheidsmonitor kerncijfers regio (85146NED)](https://www.cbs.nl/nl-nl/cijfers/detail/85146NED) -- evaluated and rejected (regional only, not wijk-level)
- [CBS Kerncijfers wijken en buurten reeks 2004-2025](https://www.cbs.nl/nl-nl/reeksen/publicatie/kerncijfers-wijken-en-buurten) -- historical dataset listing for trend analysis
- [Local Logic - Location Intelligence](https://www.trendingaitools.com/ai-tools/local-logic/) -- competitor reference using 85+ billion data points for location scoring
- [Urban Institute - Guide to Measuring Neighborhood Change](https://www.urban.org/sites/default/files/publication/100135/guide_to_measuring_neighborhood_change_to_understand_and_prevent_displacement.pdf) -- gentrification detection methodology
- [US Census - Identifying Gentrification using ML](https://www.census.gov/content/dam/Census/library/working-papers/2023/demo/sehsd-wp2023-15.pdf) -- WOZ-vs-income divergence as strongest signal
- [CBS OData v4 MeasureCodes endpoint](https://datasets.cbs.nl/odata/v1/CBS/85984NED/MeasureCodes) -- measure codes confirmed live
- Existing Propdex codebase: `backend/app/government_apis/cbs_odata.py`, `frontend/src/components/projects/CbsNeighborhoodCard.tsx`, `frontend/src/components/map/panels/WijkMapPanel.tsx`

---

*Feature research for: Propdex v12.0 Omgevings- & Leefbaarheids-Scorer*
*Researched: 2026-03-07*
