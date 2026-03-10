# Phase 99: Scan Pipeline Enrichment — Research

**Date:** 2026-03-11
**Phase Goal:** Move 5 on-demand data sources into the scan pipeline so all property data is pre-cached during wijk scans — no API calls needed when browsing the map or generating reports.

---

## 1. Current Architecture

### Scan Pipeline (`backend/app/jobs/area_scan.py`)

The scan pipeline has 6 phases:
1. **Phase 1 (0-20%)**: Fetch kadastrale percelen via PDOK BRK bbox
2. **Phase 2 (20-40%)**: BAG cross-reference + bestemmingen WMS + CBS data + 3D BAG
3. **Phase 3 (40-70%)**: Upsert all parcels to `parcel_cache`, compute scores
4. **Phase 4 (70-80%)**: Rank parcels, persist `scan_results` with flags JSONB
5. **Phase 5 (80-95%)**: Batch reverse geocode addresses
6. **Phase 6 (95-100%)**: Auto-create wijk project, finalize

**Already fetched during scan**: kadastrale percelen, BAG panden, bestemmingen (PLU WMS), CBS neighborhood metrics, CBS nabijheid, CBS crime, 3D BAG dimensions, Funda listing signals.

### On-Demand Data Sources (NOT in scan pipeline)

These 5 data sources are currently fetched lazily when a user clicks on a parcel:

| Source | API Client | Lookup Key | Current Consumer | Cache TTL |
|--------|-----------|------------|------------------|-----------|
| **Energielabel** | `ep_online_client.get_by_vbo_id()` | BAG VBO ID | `property_aggregator.aggregate_property_data()` | 30 days |
| **WOZ waarde** | `woz_waardeloket_client.get_by_nummeraanduiding_id()` | Nummeraanduiding ID | `property_aggregator.aggregate_property_data()` | 365 days |
| **Vergunningen** | `sru_client.query_by_postcode()` | Postcode (PC6) | `scans/router.py` enrichment endpoint | 7 days (parcel_cache.enrichment_data) |
| **Bodem/bodemtype** | `bodemloket_client.query_by_point()` + `bro_bodemkaart_client.get_soil_at_point()` | RD coordinate | `scans/router.py` risk-profile endpoint | 30 days / 365 days |
| **Funderingsrisico** | `pdok_funderingsrisico_client.get_by_postcode()` | Postcode (PC6) | `scans/router.py` risk-profile endpoint | 180 days |

### Data Storage Architecture

- **`parcel_cache`** table: Tier 1 (geometry, bouwjaar, bestemmingen) + Tier 2 (`enrichment_data` JSONB, `enriched_at`)
- **`scan_results`** table: `score` float + `flags` JSONB (contains score_breakdown, vacancy, building_metrics, market_signals)
- **`cached_api_responses`** table: Key-value cache for individual API responses with TTL
- **Tile proxy**: Reads `scan_results.flags` JSONB for map visualization

### Lookup Key Dependencies

Each data source requires a specific identifier that is available at different points:

| Source | Required Key | Available From |
|--------|-------------|----------------|
| Energielabel | VBO ID | NOT available during scan (requires BAG Bevragen API call per address) |
| WOZ | Nummeraanduiding ID | NOT available during scan (requires BAG Bevragen API call per address) |
| Vergunningen | Postcode (PC6) | Available AFTER Phase 5 address resolution (extracted from address string) |
| Bodem/bodemtype | RD centroid (x, y) | Available during Phase 3 (parcel centroid computed) |
| Funderingsrisico | Postcode (PC6) | Available AFTER Phase 5 address resolution |

---

## 2. Key Challenges

### Challenge 1: VBO ID and Nummeraanduiding ID Not Available During Scan

The current scan pipeline resolves **addresses** (street + housenumber + postcode) via PDOK Locatieserver reverse geocode. It does NOT resolve BAG identifiers (VBO ID, nummeraanduiding ID) which are needed for EP-Online and WOZ APIs.

**Solution options:**
- **A) Add BAG Bevragen API call per address**: After address resolution, call `bag_api.get_vbo_by_nummeraanduiding()` to get VBO ID. This adds one extra API call per parcel but gets both IDs.
- **B) Use PDOK Locatieserver `vbo` type lookup**: The Locatieserver already returns `adresseerbaarobject_id` (which IS the nummeraanduiding ID) in its response. VBO ID may be extractable from the same response or via a subsequent BAG API call.
- **C) Derive from PDOK BAG WFS**: The BAG WFS response for panden contains `identificatie` (pand ID), but NOT VBO/nummeraanduiding IDs. Would need a separate WFS query for verblijfsobjecten.

**Recommended**: Option A or B — PDOK Locatieserver already called during address resolution. Check if the response includes nummeraanduiding_id. If yes, capture it. Then add a lightweight BAG API lookup for VBO ID per nummeraanduiding.

### Challenge 2: Postcode Not Available Until After Address Resolution

Vergunningen and funderingsrisico need a postcode, which is only available after Phase 5 (address resolution). The enrichment fetch must happen after addresses are resolved.

**Solution**: Insert a new **Phase 5b** between address resolution (Phase 5) and finalization (Phase 6) that batch-fetches enrichment data for all parcels that got an address.

### Challenge 3: Rate Limits and Scan Duration

Current rate limits for the 5 APIs:

| API | Concurrent | Per Hour | Parcels per Wijk |
|-----|-----------|----------|------------------|
| EP-Online | 3 | 500 | ~300-800 |
| WOZ Waardeloket | 3 | 500 | ~300-800 |
| SRU Bekendmakingen | 3 | 500 | Deduplicated by postcode (~20-50 unique) |
| Bodemloket | 3 | 300 | Deduplicated by meter-rounded coordinate |
| BRO Bodemkaart | 5 | 1000 | Deduplicated by meter-rounded coordinate |
| PDOK Funderingsrisico | 5 | 1000 | Deduplicated by postcode (~20-50 unique) |

**Deduplication opportunities** (critical for performance):
- **Postcode-level APIs** (SRU, funderingsrisico): Many parcels share a postcode. A wijk of 500 parcels may have only 20-50 unique postcodes. Fetch once per postcode, fan out to parcels.
- **Coordinate-level APIs** (bodemloket, BRO): Meter-rounded coordinates. Many parcels in same building share coordinates, but most parcels have unique centroids. However, BRO Bodemkaart 1:50.000 resolution means parcels within ~50m share the same soil type. Could use a coarser grid (e.g., round to nearest 50m) for deduplication.
- **VBO-level APIs** (EP-Online, WOZ): Per-address, no deduplication possible. These are the bottleneck.

**Estimated scan time addition per wijk (500 parcels, 30 unique postcodes):**
- EP-Online: 500 calls / 3 concurrent = ~167 batches, ~5 min at 500/hr rate
- WOZ: 500 calls / 3 concurrent = ~167 batches, ~5 min
- SRU: 30 calls / 3 concurrent = ~10 batches, <1 min
- Bodem/BRO: ~200 unique coords / 5 concurrent = ~40 batches, <1 min
- Funderingsrisico: 30 calls / 5 concurrent = 6 batches, <10 sec

**Total additional scan time: ~10-12 minutes per wijk** (EP-Online and WOZ dominate).

**Mitigation strategies:**
- Increase EP-Online and WOZ concurrency to 5 (public/API-key endpoints can handle it)
- Skip EP-Online/WOZ for parcels without buildings (has_pand=false) — these never have VBO/nummeraanduiding IDs
- Process all 5 data sources in parallel (not sequentially)
- Consider higher rate limits — test what the APIs actually tolerate

### Challenge 4: Where to Store Enriched Data

Currently, enrichment data uses two patterns:
- **`parcel_cache.enrichment_data`** JSONB: Vergunningen (via enrichment endpoint)
- **`cached_api_responses`** table: Individual API responses with cache keys

For the scan pipeline, the best approach is to store enrichment data in **`scan_results.flags`** JSONB alongside existing score/building_metrics data. This:
- Keeps data per-scan (not global per-parcel) — allows re-enrichment on rescan
- Aligns with how tile proxy already reads data
- Avoids schema migration on `parcel_cache`

**Alternative**: Add new JSONB columns to `parcel_cache` (e.g., `energielabel`, `woz_data`, `bodem_data`, `funderingsrisico_data`, `vergunningen_data`). This gives cleaner access but requires migration and breaks the Tier 1/2 architecture.

**Recommended**: Store in `scan_results.flags` under new keys: `energielabel`, `woz`, `vergunningen`, `bodem`, `funderingsrisico`. Also populate `cached_api_responses` to avoid redundant API calls on subsequent on-demand fetches.

### Challenge 5: Backwards Compatibility

The on-demand endpoints (`/parcels/{id}/enrichment`, `/parcels/{id}/risk-profile`, `aggregate_property_data()`) must continue to work:
- For parcels in old scans (before Phase 99) — no pre-cached data, fall back to on-demand
- For parcels outside scanned areas — no scan data at all
- Frontend hooks (`useParcelEnrichment`, risk-profile fetcher) should check scan data first, then fall back to API calls

---

## 3. Data Source Analysis

### 3.1 Energielabel (EP-Online)

- **Input**: BAG VBO ID (16-digit string like "0363010000000001")
- **Output**: `EnergyLabel` schema — energieklasse (A+++...G), registratie_datum, geldig_tot, is_geregistreerd
- **Rate limit**: 3 concurrent, 500/hour (API key required)
- **Coverage**: ~70-80% of residential properties have registered labels
- **Scan relevance**: HIGH — energielabel is a score factor in v3.0 (Phase 100)
- **Key gap**: VBO ID not available during scan — needs BAG API lookup after address resolution

### 3.2 WOZ Waarde (Waardeloket)

- **Input**: Nummeraanduiding ID (16-digit string)
- **Output**: `WOZData` schema — meest_recente_waarde (EUR), peildatum, waarden history
- **Rate limit**: 3 concurrent, 500/hour (public endpoint, no auth)
- **Coverage**: ~90%+ of addressed properties
- **Scan relevance**: HIGH — WOZ is a market value signal for scoring
- **Key gap**: Nummeraanduiding ID not available — needs BAG API or PDOK Locatieserver resolution
- **Note**: `low_confidence=True` always (public display endpoint, not authoritative)

### 3.3 Vergunningen (SRU Bekendmakingen)

- **Input**: Postcode (PC6, e.g., "5927NX")
- **Output**: `list[BekendmakingRecord]` — title, type, date, municipality, URL
- **Rate limit**: 3 concurrent, 500/hour
- **Coverage**: All postcodes with government publications
- **Scan relevance**: HIGH — vergunningsactiviteit is a score factor
- **Dedup opportunity**: Per-postcode (20-50 unique per wijk). Fetch once, filter per address.
- **Current enrichment pattern**: Fetches by postcode, then filters by address string match. In scan pipeline, can fetch per postcode and store raw records, with address filtering happening at read time.

### 3.4 Bodem (Bodemloket + BRO Bodemkaart)

- **Input**: RD centroid coordinates (x, y in EPSG:28992)
- **Output**: `BodemData` (WBB dossiers with contamination status) + `SoilProfile` (soil type classification)
- **Rate limit**: Bodemloket 3/300hr, BRO 5/1000hr
- **Coverage**: Bodemloket: spotty (only known contamination sites). BRO: ~80% of NL
- **Scan relevance**: MEDIUM — risk factor in v3.0
- **Dedup opportunity**: Meter-level coordinate rounding. BRO could use coarser grid (50m) since it is 1:50000 scale.
- **Already available during scan**: Parcel centroids computed in Phase 3. Can fetch in Phase 3 alongside bestemmingen.

### 3.5 Funderingsrisico (PDOK WFS)

- **Input**: Postcode (PC6)
- **Output**: `dict` — fgr (risk class), legenda, percvoor1970 (% pre-1970 buildings), gemeente
- **Rate limit**: 5 concurrent, 1000/hour
- **Coverage**: PC6 areas with foundation risk data
- **Scan relevance**: HIGH — foundation risk is major factor in v3.0
- **Dedup opportunity**: Per-postcode (same as SRU). Very fast API.
- **Note**: This is area-level (PC6), not per-parcel. Same data for all parcels sharing a postcode.

---

## 4. Proposed Pipeline Architecture

### New Scan Pipeline Phases

```
Phase 1 (0-15%):   Fetch kadastrale percelen (PDOK BRK)
Phase 2 (15-35%):  BAG cross-reference + bestemmingen + CBS + 3D BAG
Phase 3 (35-55%):  Upsert parcels + compute initial scores
                    + BATCH FETCH bodem/BRO (coordinate-based, available now)
Phase 4 (55-65%):  Rank + persist scan_results
Phase 5 (65-80%):  Addresses — batch reverse geocode
Phase 5b (80-90%): ENRICHMENT — batch fetch by postcode/VBO:
                    - Resolve VBO IDs + nummeraanduiding IDs (BAG API)
                    - EP-Online energielabels (per VBO)
                    - WOZ waarden (per nummeraanduiding)
                    - SRU vergunningen (per unique postcode)
                    - PDOK funderingsrisico (per unique postcode)
Phase 6 (90-95%):  Update scan_results.flags with enrichment data
Phase 7 (95-100%): Project creation + finalize
```

### Batch Fetching Strategy

**Postcode-grouped APIs (SRU, funderingsrisico):**
1. After address resolution, extract unique postcodes from resolved addresses
2. Fetch once per unique postcode (asyncio.Semaphore for concurrency control)
3. Build lookup map: `postcode -> data`
4. Fan out to individual parcels

**Coordinate-based APIs (bodemloket, BRO):**
1. Can run during Phase 3 when centroids are computed
2. Deduplicate by rounded coordinates (meter-level for bodemloket, 50m for BRO)
3. Build lookup map: `(rounded_x, rounded_y) -> data`
4. Fan out to individual parcels

**Per-VBO APIs (EP-Online, WOZ):**
1. After address resolution, resolve VBO + nummeraanduiding IDs via BAG API
2. Skip parcels without buildings (has_pand=false)
3. Batch fetch with semaphore concurrency control
4. These dominate scan time — consider parallelizing EP-Online and WOZ batches

### Data Storage Plan

Store enrichment in `scan_results.flags` JSONB under new top-level keys:

```python
flags = {
    # Existing keys (unchanged)
    "category": "kansrijk",
    "factors": {...},
    "subscores": {...},
    "vacancy_signal": "leeg_perceel",
    "building_metrics": {...},
    "market_signals": {...},

    # NEW enrichment keys
    "energielabel": {
        "energieklasse": "C",
        "is_geregistreerd": True,
        "registratie_datum": "2022-01-15",
        "geldig_tot": "2032-01-15",
    },
    "woz": {
        "meest_recente_waarde": 285000,
        "meest_recente_peildatum": "2025-01-01",
        "low_confidence": True,
    },
    "vergunningen": {
        "records": [...],
        "total_postcode_count": 42,
        "address_filtered_count": 3,
    },
    "bodem": {
        "dossiers_count": 0,
        "disclaimer": "Bodemloket bevat niet alle...",
    },
    "bodemtype": {
        "dominant_type": "klei",
        "dominant_type_label": "Kleigrond",
        "soilcode": "Mn25A",
    },
    "funderingsrisico": {
        "fgr": "Laag",
        "legenda": "...",
        "percvoor1970": 66.7,
    },
}
```

### Frontend Integration

The existing on-demand endpoints stay as fallbacks. New approach:
1. `useParcelEnrichment` hook first checks if `scan_results.flags` contains enrichment keys
2. If present, use pre-cached data (no API call needed)
3. If absent (old scans), fall back to existing on-demand endpoints
4. The `at-point` endpoint already returns `flags` — frontend can read enrichment from there

---

## 5. Risk Analysis

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| EP-Online rate limit hit during large wijk scan | Scan fails or throttles heavily | Medium | Exponential backoff, lower concurrency, skip on sustained 429 |
| VBO ID resolution adds significant time | +5-10 min per wijk | High | Batch BAG API calls, parallelize with other enrichment |
| WOZ Waardeloket response format changes | WOZ parsing fails | Low | Already has error handling, non-fatal in scan |
| Scan duration doubles from current ~5 min to ~15 min | User perception of slow scans | High | Progress reporting per sub-phase, can make enrichment optional |
| Enrichment data bloats scan_results.flags JSONB | Slower tile queries | Medium | Only store essential fields, not full API responses |
| SRU XML parsing errors for some postcodes | Vergunningen missing for some parcels | Low | Already robust XML parser with error handling |

---

## 6. Dependencies and Prerequisites

### No schema migration needed IF storing in scan_results.flags JSONB
The `flags` column is already JSONB and can accept arbitrary keys. No Alembic migration required for the data storage aspect.

### BAG API for VBO/Nummeraanduiding Resolution
Need to verify: does the existing PDOK Locatieserver response include `adresseerbaarobject_id` or `nummeraanduiding_id`? Check `reverse_geocode_rd_point()` in `parcel_addressing.py`.

### Existing API Clients Ready
All 5 API clients already exist and work:
- `backend/app/government_apis/ep_online.py`
- `backend/app/government_apis/woz_waardeloket.py`
- `backend/app/government_apis/sru_bekendmakingen.py`
- `backend/app/government_apis/bodemloket_arcgis.py` + `bro_bodemkaart.py`
- `backend/app/government_apis/pdok_funderingsrisico.py`

### Existing Aggregator Services Ready
- `backend/app/services/bodem_aggregator.py`
- `backend/app/services/soil_aggregator.py`
- `backend/app/services/funderingsrisico_aggregator.py`

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `backend/app/jobs/area_scan.py` | Add Phase 5b enrichment batch-fetch + update flags |
| `backend/app/services/parcel_addressing.py` | Capture nummeraanduiding_id from Locatieserver response |
| `backend/app/scans/router.py` | Enrichment + risk-profile endpoints check scan flags first |
| `backend/app/scans/schemas.py` | Add enrichment fields to response schemas |
| `backend/app/government_apis/rate_limiter.py` | Potentially increase concurrency for scan-mode batch fetches |
| `frontend/src/hooks/useScans.ts` | Check flags for pre-cached enrichment before API call |
| `frontend/src/lib/types/scan.ts` | Add enrichment types to ScanResultItem flags |

### Files NOT to modify
- Individual API clients — already work correctly
- `parcel_cache` model — no new columns needed
- `scan_results` model — JSONB flags column handles arbitrary data
- `cached_api_responses` — can optionally populate for on-demand endpoint dedup

---

## 8. Estimation

| Task | Complexity | Estimated Time |
|------|-----------|---------------|
| Capture nummeraanduiding_id from address resolution | Low | 10 min |
| Add BAG VBO ID resolution batch function | Medium | 15 min |
| Coordinate-based enrichment (bodem + BRO) in Phase 3 | Medium | 15 min |
| Postcode-based enrichment (SRU + funderingsrisico) in Phase 5b | Medium | 15 min |
| VBO-based enrichment (EP-Online + WOZ) in Phase 5b | Medium | 15 min |
| Update scan_results.flags with enrichment data | Low | 10 min |
| Backend endpoint fallback (check flags first) | Medium | 15 min |
| Frontend type updates + flags-first enrichment | Medium | 15 min |
| Testing + validation with Venlo scan | Medium | 20 min |

**Total: ~2 hours estimated, 2-3 plans**

---

## 9. Suggested Plan Breakdown

### Plan 99-01: Coordinate-Based Scan Enrichment (Bodem + BRO)
- Add batch bodem/BRO fetch in Phase 3 (centroids available)
- Deduplicate by rounded coordinates
- Store results in scan_results.flags under `bodem` and `bodemtype` keys
- Update risk-profile endpoint to check flags first

### Plan 99-02: Address-Based Scan Enrichment (SRU + Funderingsrisico + EP-Online + WOZ)
- Capture nummeraanduiding_id from Locatieserver during address resolution
- Add BAG VBO ID resolution per nummeraanduiding
- Add Phase 5b: batch fetch by postcode (SRU, funderingsrisico) and by VBO/nummeraanduiding (EP-Online, WOZ)
- Deduplicate postcode-level fetches
- Store results in scan_results.flags
- Update enrichment + risk-profile endpoints to check flags first

### Plan 99-03: Frontend Integration + Validation
- Update TypeScript types for enrichment data in flags
- Update useParcelEnrichment to check scan flags before API call
- Test with full Venlo wijk scan
- Validate scan duration remains reasonable

---

*Research completed: 2026-03-11*
