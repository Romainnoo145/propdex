# Phase 100: Score v3.0 Engine — Research

**Researched:** 2026-03-11
**Phase:** 100-score-v3-0-engine
**Objective:** Replace `compute_opportunity_score()` v2.1 with dual-subscore Potentie (8 factoren) + Risico (9 factoren) model, each with template-based narratieven.

---

## 1. Current Scoring Model (v2.1)

**File:** `backend/app/services/parcel_scoring.py` (750 lines)

### Architecture
- `compute_opportunity_score(parcel_data) -> ScoreBreakdown` — 5 factors, vacancy-heavy
- `derive_opportunity_insights(parcel_data) -> OpportunityInsights` — qualitative signals
- `compute_vacancy_confidence(parcel_data, permit_activity, listing_signal) -> VacancyConfidenceAssessment` — 0-1 confidence

### Current 5 Factors (total 100 points raw)
| Factor | Max Points | What it reads |
|--------|-----------|---------------|
| `pand_status_signal` | 40 | `has_pand`, `pand_status` |
| `underutilization` | 30 | vacancy_signal, `area_m2`, FAR, bebouwings% |
| `zoning_value` | 20 | `bestemmingen`, FAR, bebouwings% |
| `footprint_size` | 5 | `area_m2` |
| `building_age` | 5 | `bouwjaar` |

### Current Subscores
- `vacancy_subscore` (70% weight) = pand_status_signal + underutilization (max 70)
- `buildability_subscore` (30% weight) = zoning_value + footprint_size + building_age (max 30)
- `total_score` = weighted sum, then vacancy guardrail applied

### Current Output Shape (in `ScoreBreakdown` dataclass)
```python
@dataclass
class ScoreBreakdown:
    total_score: float      # 0-100
    vacancy_subscore: float # 0-100
    buildability_subscore: float  # 0-100
    category: str           # High, Medium, Low
    factors: dict[str, float]     # factor_name -> contribution
    model_version: str      # "opportunity-score-v2.1"
```

### What v2.1 Does NOT Have
- No risk dimension at all
- No narratives/toelichtingen
- No access to enrichment data (bodem, funderingsrisico, energielabel, etc.)
- No wijk-level factors (CBS demografie, criminaliteit, juridisch klimaat)
- Vacancy guardrail is a hard clamp, not a factor

### Key Code Insight
`compute_opportunity_score()` receives only a `parcel_data` object with attributes from `ParcelCache`: `has_pand`, `area_m2`, `bestemmingen`, `bouwjaar`, `pand_status`. It does NOT receive enrichment flags or wijk-level CBS data. The function signature must change.

---

## 2. Data Available in scan_results.flags JSONB

**File:** `backend/app/jobs/area_scan.py` (lines 681-714)

The `flags_dict` assembled per parcel during scan contains:

### Score/Classification Data (existing v2.1)
```python
{
    "category": "High" | "Medium" | "Low",
    "factors": { "pand_status_signal": 40.0, "underutilization": 12.0, ... },
    "subscores": { "vacancy": 85.3, "buildability": 42.1 },
    "score_model_version": "opportunity-score-v2.1",
    "vacancy_signal": "leeg_perceel" | "leegstaand_pand" | "in_gebruik" | "onbekend",
    "vacancy_confidence": 0.84,
    "vacancy_reasons": ["HARD: Geen pand geregistreerd op perceel", ...],
    "vacancy_model_version": "vacancy-confidence-v1",
    "market_signals": { "listing_duration_days": 180, "price_change_count": 2, ... } | null,
    "opportunity_signals": ["Leeg perceel", "Voldoende schaal", ...],
    "building_metrics": {
        "pand_oppervlakte_m2": 245.0,
        "max_bebouwingspercentage": 60.0,
        "max_floor_area_ratio": 1.8,
        "max_bouwhoogte": 12.0,
        "max_bouwlagen": 4,
        "actual_bouwhoogte": 8.5,
        "actual_bouwlagen": 2
    },
}
```

### Coordinate-based Enrichment (Phase 99, Plan 01)
```python
{
    "bodem": {
        "dossiers_count": 2,
        "has_known_contamination": true,
        "disclaimer": "Bodemloket bevat niet alle locaties..."
    },
    "bodemtype": {
        "dominant_type": "klei",
        "dominant_type_label": "Poldervaaggronden",
        "soilcode": "pVb"
    },
    "natura2000": {
        "naam": "Groote Peel",
        "nr": "138",
        "bescherming": "Habitatrichtlijn",
        "binnen_5km": true
    },
    "overstromingsrisico": {
        "description": "...",
        "qualitative_value": "middelgroot",
        "in_risk_zone": true
    },
    "geluid": {
        "lden_db": 55.0,
        "classification": "redelijk rustig",
        "boven_grenswaarde": false
    },
    "luchtkwaliteit": {
        "no2_ugm3": 18.5,
        "pm10_ugm3": 22.3,
        "boven_grenswaarde": false
    }
}
```

### Address-based Enrichment (Phase 99, Plan 02)
```python
{
    "vergunningen": {
        "records": [{"title": "...", "type": "...", "date": "...", "identifier": "..."}],
        "total_postcode_count": 12
    },
    "funderingsrisico": {
        "fgr": "hoog",
        "legenda": "Hoog indicatief risico op funderingsproblemen",
        "percvoor1970": 85.0
    },
    "energielabel": {
        "energieklasse": "C",
        "is_geregistreerd": true,
        "registratie_datum": "2023-05-01",
        "geldig_tot": "2033-05-01"
    },
    "woz": {
        "meest_recente_waarde": 285000,
        "meest_recente_peildatum": "2024-01-01",
        "low_confidence": false
    }
}
```

---

## 3. Wijk-level Data (AreaScan.neighborhood_metrics JSONB)

**File:** `backend/app/models/area_scan.py` — stored at scan level, NOT per-parcel.

### Available CBS Data Shape
```json
{
    "bron": "CBS StatLine",
    "dataset": "85618NED",
    "peiljaar": 2023,
    "data": {
        "gemiddelde_woz_waarde": 285000,
        "stedelijkheid": { "klasse": 2, "omschrijving": "Sterk stedelijk", "omgevingsadressendichtheid": 2100 },
        "demografie": {
            "aantal_inwoners": 12500,
            "percentage_huurwoningen": 45.0,
            "percentage_koopwoningen": 55.0
        },
        "bouwjaar_distributie": {
            "percentage_bouwjaar_voor_2000": 78.0,
            "percentage_bouwjaar_vanaf_2000": 22.0
        },
        "leeftijdsverdeling": { "perc_0_14": 15.0, "perc_15_24": 12.0, "perc_25_44": 28.0, "perc_45_64": 25.0, "perc_65_plus": 20.0 },
        "huishoudens": { "totaal": 5800, "eenpersoons": 2100, "zonder_kinderen": 1800, "met_kinderen": 1900, "gemiddelde_grootte": 2.1 },
        "inkomen": { "gem_per_ontvanger": 35200, "gem_per_inwoner": 24100, "gem_gestandaardiseerd": 28900, "perc_laagste_40": 42.0, "perc_hoogste_20": 18.0 }
    },
    "nabijheid": {
        "bron": "CBS StatLine",
        "dataset": "86134NED",
        "peiljaar": 2022,
        "afstanden": { "supermarkt_km": 0.6, "huisarts_km": 0.9, "basisschool_km": 0.5, "kinderdagverblijf_km": 0.7, "treinstation_km": 2.1, "overstapstation_km": 3.5 }
    },
    "criminaliteit": {
        "bron": "CBS dataderden",
        "dataset": "47018NED",
        "peiljaar": 2022,
        "totaal_misdrijven": 450,
        "per_1000_inwoners": 36.0,
        "categorien": {
            "vermogensdelicten": { "aantal": 250, "per_1000": 20.0 },
            "vernieling": { "aantal": 120, "per_1000": 9.6 },
            "geweld": { "aantal": 80, "per_1000": 6.4 }
        }
    }
}
```

### Critical Design Decision: Wijk Data is Per-Scan, Not Per-Parcel
The CBS demografie, criminaliteit, and nabijheid data lives in `area_scans.neighborhood_metrics`, NOT in `scan_results.flags`. The scoring function currently receives only parcel-level data. To use wijk-level factors (demografie, criminaliteit), the scoring function must receive `neighborhood_metrics` as an additional parameter — or these wijk-level values must be passed into flags at scan time.

---

## 4. How area_scan.py Calls Scoring and Stores Results

**File:** `backend/app/jobs/area_scan.py`

### Call Sequence
1. CBS data fetched early (lines 366-426) and stored on `scan.neighborhood_metrics`
2. Parcels processed in batches of 500 (PARCEL_PROCESSING_BATCH_SIZE)
3. Per parcel (line 523): `score_breakdown = compute_opportunity_score(parcel)` — receives only ParcelCache ORM object
4. `derive_opportunity_insights(parcel)` — also only ParcelCache
5. Later (line 652): `compute_vacancy_confidence(parcel, listing_signal=listing_signal)` — adds market signals
6. `flags_dict` assembled (line 681) combining score, vacancy, building_metrics, enrichment data
7. Enrichment data (bodem, env) merged from `bodem_by_parcel` and `env_by_parcel` dicts
8. Bulk INSERT via `pg_insert(ScanResult).values(ranked_values).on_conflict_do_nothing()`
9. Phase 5b (line 800+): address enrichment merged via UPDATE to existing scan_results.flags

### Key Timing Constraint
Scoring currently happens BEFORE enrichment data is available in flags. The enrichment data (bodem, env, funderingsrisico, energielabel, WOZ, vergunningen) is fetched in parallel with or after scoring. For v3.0 scoring to use enrichment data, either:
- **Option A:** Reorder — fetch enrichment BEFORE scoring (changes scan pipeline order)
- **Option B:** Score after all enrichment — add a final scoring pass after all data is gathered
- **Option C:** Two-pass scoring — initial score, then rescore with enrichment data

**Recommended: Option B** — Accumulate all data first, then score once. This is the cleanest approach. Currently scoring happens inline during parcel processing (line 523), but it could be moved to a separate phase after enrichment.

---

## 5. Frontend Score Consumption

### Types (`frontend/src/lib/types/scan.ts`)
- `ScanResultItem.score`: `number | null` (0-100)
- `ScanResultItem.score_category`: `string | null` (High/Medium/Low)
- `ScanResultItem.score_breakdown`: `Record<string, unknown> | null`
- `ScanResultItem.vacancy_signal`, `vacancy_confidence`, `vacancy_reasons`, `vacancy_model_version`

### Score Utilities (`frontend/src/lib/score.ts`)
- `extractScoreFactors(scoreBreakdown)` — extracts numeric entries from factors/breakdown
- `extractScoreSubscores(scoreBreakdown)` — reads `subscores.vacancy`/`subscores.buildability`

### PotentieLayer (`frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx`, 438 lines)
- Reads `parcel.score`, `parcel.score_breakdown`, `parcel.building_metrics`
- `deriveVerdict(score)` — maps score to ZEER KANSRIJK/MOGELIJKHEDEN/BEPERKT POTENTIEEL
- `deriveOptoppotentie(metrics)` — computes lagen/hoogte headroom
- `getBestemmingDisplay(bestemmingen)` — derives transform compatibility
- `extractFactors(scoreBreakdown)` — reads v2.1 factor names directly
- `generateOneLiner(...)` — Dutch one-line narrative
- `deriveSignals(parcel, score)` — market/vacancy/transform signals

### What Must Change in Frontend
1. `ScanResultItem` type needs `potentie_score`, `risico_score` alongside or replacing `score`
2. `score_breakdown` shape changes — needs `categorie: "potentie" | "risico"` per factor
3. `score.ts` utilities must understand new breakdown structure
4. `PotentieLayer.tsx` `extractFactors()` hardcodes v2.1 factor names — must be updated
5. `deriveVerdict()` currently uses single score thresholds — needs dual-score logic
6. Tile proxy SQL (tile_proxy.py) extracts `score` column — needs to work with new structure

### Tile Proxy Impact (`backend/app/services/tile_proxy.py`)
The tile proxy SQL reads `sr.score` and `sr.flags->>'category'`. If the overall score stays in `sr.score` column and category stays in flags, tiles continue working without changes. If the score column semantics change, the frontend map coloring (amber gradient) needs adjustment.

---

## 6. Jurisprudentie Data for Juridisch Klimaat Factor

**File:** `backend/app/models/ruling_cache.py`

The `ruling_cache` table stores court rulings with:
- `uitkomst`: outcome (toewijzing/afwijzing/etc.) — only 18/286 Venlo rulings have this analyzed
- `vergunningstype`: type of permit — same coverage gap (268/286 unanalyzed)
- `gemeente_query` / `extracted_gemeente`: gemeente linkage

### Availability Problem
The juridisch klimaat factor requires aggregation across rulings for a gemeente (approval rate, avg doorlooptijd). This data exists but:
1. 268/286 Venlo rulings are unanalyzed (missing `uitkomst`, `vergunningstype`)
2. No pre-computed gemeente-level aggregation exists
3. Would need a new aggregation query per gemeente (not per parcel)

### Scoring Integration Path
- Pre-compute gemeente-level juridisch klimaat metrics during scan (alongside CBS data)
- Store in `area_scans.neighborhood_metrics` or a new field
- Pass to scoring function alongside CBS data

---

## 7. Mapping Phase 100 Factors to Available Data Sources

### Potentie Factors (8)

| # | Factor | Gewicht | Data Source | Available? | Notes |
|---|--------|---------|-------------|------------|-------|
| 1 | Vrije grond / onderbenutting | 12 | `area_m2` + `building_metrics.pand_oppervlakte_m2` | YES | Already derived in PotentieLayer |
| 2 | Optoppotentie (lagen/hoogte headroom) | 10 | `building_metrics.{max,actual}_{bouwhoogte,bouwlagen}` | PARTIAL | max_bouwlagen 0% dekking (PLU WMS), actual_bouwlagen 61% dekking |
| 3 | Bestemming compatibiliteit | 12 | `bestemmingen[].type` | YES | Already in v2.1 zoning_value |
| 4 | Leegstand (acquisitiekans) | 8 | `vacancy_signal`, `pand_status` | YES | Already in v2.1 pand_status_signal |
| 5 | Funda-frictie / gemotiveerde verkoper | 5 | `market_signals.{listing_duration_days, price_change_count}` | YES | From funda_listing_ingestion |
| 6 | Perceelgrootte (schaal) | 12 | `area_m2` | YES | Already in v2.1 footprint_size |
| 7 | Demografie (CBS) | 8 | `neighborhood_metrics.data.demografie` + `inkomen` + `leeftijdsverdeling` | YES | Wijk-level, needs to be passed to scoring |
| 8 | Vergunnings-succeskans (juridisch klimaat) | 13 | `ruling_cache` aggregation per gemeente | PARTIAL | 268/286 rulings unanalyzed, needs new aggregation |

### Risico Factors (9)

| # | Factor | Gewicht | Data Source | Available? | Notes |
|---|--------|---------|-------------|------------|-------|
| 1 | Funderingsrisico | 15 | `flags.funderingsrisico.{fgr, percvoor1970}` + `flags.bodemtype` + `bouwjaar` | YES | Phase 99 pre-cached |
| 2 | Asbest-risico | 6 | `bouwjaar` (< 1994) + `bestemmingen` (function-based) | YES | Heuristic, no external data |
| 3 | Bodemverontreiniging | 7 | `flags.bodem.{has_known_contamination, dossiers_count}` | YES | Phase 99 pre-cached |
| 4 | Monument-/erfgoedstatus | 5 | `parcel_cache.enrichment_data` or bestemmingen | PARTIAL | Not in scan flags yet; on-demand only |
| 5 | Bestemmingswijziging nodig | 8 | `bestemmingen[].type` (inverse of bestemming compatibiliteit) | YES | |
| 6 | Constructieve staat | 7 | `bouwjaar` + `flags.energielabel.energieklasse` | YES | Phase 99 pre-cached |
| 7 | Juridisch klimaat ongunstig | 8 | Same as potentie factor 8 (inverse) | PARTIAL | Same data gap |
| 8 | Criminaliteit in wijk | 6 | `neighborhood_metrics.criminaliteit.per_1000_inwoners` | YES | Wijk-level |
| 9 | Maximale bouwhoogte bereikt | 5 | `building_metrics.{max,actual}_{bouwhoogte,bouwlagen}` | PARTIAL | Same dekking gap as optoppotentie |

### Summary of Data Gaps
1. **Optoppotentie & max hoogte bereikt**: `max_bouwlagen` is 0% dekking from PLU WMS. Phase 98 (Gemeente Bouwregels) would provide fallback defaults. Without Phase 98, this factor will mostly score neutral.
2. **Juridisch klimaat**: 268/286 rulings unanalyzed. Either run AI analysis batch (~$2) or score neutral for municipalities without sufficient data.
3. **Monument-/erfgoedstatus**: Not in scan_results.flags. Would need to add to scan pipeline or use bestemmingen "Waarde - Archeologie"/"Waarde - Cultuurhistorie" as proxy.

---

## 8. Narrative Templates — Current State

### Frontend PotentieLayer.tsx Already Has
- `generateOneLiner()` — one-line summary combining vrije ruimte, headroom, bestemming, leegstand
- `deriveVerdict()` — verdict label (ZEER KANSRIJK, MOGELIJKHEDEN, BEPERKT POTENTIEEL)
- `getBestemmingDisplay()` — bestemming compatibility and transform label
- `deriveOptoppotentie()` — headroom reason string
- `deriveSignals()` — market friction, vacancy, transformation candidate signals

### What v3.0 Needs (Backend)
Per the CONTEXT.md, each factor must produce:
- `toelichting_kort`: 1-sentence dashboard summary (Dutch)
- `toelichting_lang`: Full paragraph for rapport (Dutch)
- `data_bronnen`: list of source names

These are template-based (no AI calls). The frontend narrative logic provides patterns but must move to backend so both frontend and rapport use identical texts.

---

## 9. Scan Pipeline Reordering Implications

### Current Scan Pipeline Order
1. Phase 1: CBS data (wijk-level)
2. Phase 2: BAG WFS parcels + bestemmingen + 3D BAG
3. Phase 3a: Address resolution
4. Phase 3b: Coordinate-based enrichment (bodem, env) — parallel with 3a
5. **Scoring happens here** (line 523, inline during parcel processing in Phase 2)
6. Phase 4: Vacancy confidence + market signals → flags assembled
7. Phase 5a: Postcode enrichment (vergunningen, funderingsrisico)
8. Phase 5b: Address enrichment (energielabel, WOZ)

### Required New Order for v3.0
1. Phase 1: CBS data (unchanged)
2. Phase 2: BAG WFS parcels + bestemmingen + 3D BAG (unchanged, but **defer scoring**)
3. Phase 3a/3b: Enrichment (unchanged)
4. Phase 4: Market signals (unchanged)
5. Phase 5a/5b: Postcode + address enrichment (unchanged)
6. **NEW Phase 6: Score v3.0** — all data available, score once with full context

This means `compute_opportunity_score()` call moves from the inner parcel-processing loop to a final pass over all accumulated data. The flags_dict assembly also needs restructuring.

---

## 10. Database Schema Considerations

### Current Schema
- `scan_results.score`: single float (0-100)
- `scan_results.flags`: JSONB with everything

### v3.0 Options
**Option A: Keep single score column, add subscores to flags** (RECOMMENDED)
- `score` column = overall score (potentie - risico, normalized 0-100)
- `flags.scores.potentie` = 0-100
- `flags.scores.risico` = 0-100
- `flags.scores.overall` = same as score column
- `flags.score_breakdown` = full per-factor breakdown with narratives
- PRO: Tile proxy and existing queries continue to work unchanged
- PRO: No migration needed
- PRO: Existing sort-by-score works

**Option B: Add potentie_score + risico_score columns**
- CON: Requires Alembic migration
- CON: Tile proxy SQL changes
- CON: More columns to maintain
- Minor PRO: Can query/filter by potentie or risico directly in SQL

**Recommended: Option A.** The score column remains the "overall" ranking value. Potentie and risico subscores go in flags JSONB alongside the per-factor breakdown. No migration needed.

### Backward Compatibility
Old scans with v2.1 breakdown will have different flags structure. The frontend must handle both:
- v2.1: `flags.factors.pand_status_signal`, `flags.subscores.vacancy`
- v3.0: `flags.scores.potentie`, `flags.score_breakdown.perceelgrootte`

Use `flags.score_model_version` to distinguish.

---

## 11. Testing Patterns

**File:** `backend/tests/test_parcel_scoring.py`

- Uses `MockParcelData` class with parcel attributes
- Tests individual factor functions and overall scoring
- 275 tests total (104 unit + 171 integration)
- Existing tests will BREAK when v2.1 function signature changes — tests must be updated

### Test Strategy for v3.0
- Existing `MockParcelData` needs enrichment fields (flags-style data)
- Need new mock for wijk-level data (neighborhood_metrics)
- Test each of 17 factor scoring functions individually
- Test normalization (log-scale, percentile, binary)
- Test missing-data strategy (neutral, penalty, weight redistribution)
- Test narrative template generation per factor
- Integration test: full scoring with all data present vs. partial data

---

## 12. Performance Considerations

### Current Scan Performance
- Venlo: 21 wijk scans covering full gemeente
- Average scan: ~500-2000 parcels per wijk
- Scoring is CPU-only (no I/O), negligible time in current pipeline

### v3.0 Impact
- 17 factors instead of 5 — ~3x more computation per parcel
- Template narrative generation adds string formatting per factor
- With 2000 parcels: 17 factors x 2000 = 34,000 factor evaluations (still trivial)
- **Real concern:** Moving scoring to end of pipeline means all parcel data must be held in memory until scoring completes. Currently scored and inserted inline.

### Mitigation
- Process scoring in batches (same PARCEL_PROCESSING_BATCH_SIZE)
- Score function remains pure CPU (no async, no I/O)
- Narrative templates are simple f-string formatting

---

## 13. Key Risks and Unknowns

| Risk | Impact | Mitigation |
|------|--------|------------|
| PLU WMS bouwlagen dekking 0% | Optoppotentie + max hoogte bereikt factors will mostly score neutral | Phase 98 (Gemeente Bouwregels) provides fallback; score neutral until then |
| 268 unanalyzed rulings | Juridisch klimaat factors will have weak signal | Score neutral for municipalities without data; plan AI batch ($2) separately |
| Monument status not in flags | Factor cannot score without data | Add monument detection to scan pipeline OR use bestemmingen "Waarde" proxy |
| Pipeline reordering complexity | area_scan.py is 850+ lines, careful refactoring needed | Extract scoring into separate function called after all enrichment phases |
| Backward compatibility | Old v2.1 scans have different flags shape | Version flag (`score_model_version`) already exists; frontend checks version |
| Wijk-level data threading | neighborhood_metrics is on AreaScan, not per-parcel | Pass neighborhood_metrics to scoring function as separate parameter |

---

## 14. Recommended Implementation Approach

### Task Breakdown (suggested plan structure)

**Plan 100-01: Scoring Engine Core**
1. New `compute_score_v3()` function with Potentie + Risico dual subscore
2. 17 individual factor scoring functions
3. Normalization framework (log/percentile/binary per factor)
4. Missing data strategy implementation
5. Unit tests for all factors

**Plan 100-02: Narrative Templates**
1. Template-based `toelichting_kort` + `toelichting_lang` per factor
2. `data_bronnen` mapping per factor
3. Move narrative logic from PotentieLayer.tsx to backend
4. Test narrative generation

**Plan 100-03: Pipeline Integration**
1. Reorder area_scan.py to defer scoring to final phase
2. Pass enrichment flags + neighborhood_metrics to new scoring function
3. Update flags_dict structure with new score breakdown shape
4. Backward-compatible flags format with version tagging
5. Integration tests

**Plan 100-04: Frontend Type Updates**
1. Update `ScanResultItem` types for dual-score
2. Update `score.ts` utilities
3. Update `PotentieLayer.tsx` factor extraction
4. Handle v2.1 vs v3.0 score_breakdown gracefully
5. Tile proxy: verify no changes needed (if score column = overall)

---

*Research completed: 2026-03-11*
*Phase: 100-score-v3-0-engine*
