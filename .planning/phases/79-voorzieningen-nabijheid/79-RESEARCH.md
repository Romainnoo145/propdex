# Phase 79: Voorzieningen Nabijheid - Research

**Researched:** 2026-03-07
**Domain:** CBS OData v4 API (dataset 86134NED), proximity data modeling, frontend card components
**Confidence:** HIGH

## Summary

Phase 79 adds facility proximity data to the wijk detail view by querying CBS dataset 86134NED ("Nabijheid voorzieningen; afstand locatie, wijk- en buurtcijfers 2024"). This dataset uses the exact same OData v4 protocol on `datasets.cbs.nl/odata/v1/CBS/` with the same entity structure (Observations, WijkenEnBuurtenCodes) as the existing Kerncijfers dataset. The only difference is the dataset ID and measure codes.

The existing `CBSODataClient` in `cbs_odata.py` is tightly coupled to the Kerncijfers dataset (86165NED) -- it uses a single `MEASURE_CODES` dict and a single `dataset_id` field. For 86134NED, we need a second query method with its own measure codes, targeting the same region identifier (WK/GM prefix). The wijk identifier resolution logic (`_resolve_wijk_identifier`) can be shared since 86134NED has the same WijkenEnBuurtenCodes entity.

**Critical finding:** The requirement mentions "OV-halte" (public transport stop) but CBS dataset 86134NED does NOT contain OV-halte proximity data. It only has `D000052` (afstand tot treinstations totaal) and `D000014` (afstand tot belangrijk overstapstation). OV-halte proximity was a one-off CBS publication from 2020 (Excel-only, not available via OData). The planner should substitute "treinstation" for "OV-halte" or add "overstapstation" as the closest available proxy.

**Primary recommendation:** Add a `get_nabijheid_data()` method to `CBSODataClient` that queries 86134NED with 6 curated measure codes, store results in `neighborhood_metrics["nabijheid"]`, and build a `NabijheidCard` frontend component following the same pattern as `AgeDistributionCard`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOORZ-01 | CBS Nabijheid client (86134NED) haalt afstanden op via OData v4 met dezelfde patronen als bestaande CBS client | Dataset 86134NED verified live: same OData v4 protocol, same entity structure (Observations + WijkenEnBuurtenCodes). Measure codes confirmed via MeasureCodes endpoint |
| VOORZ-02 | Wijk detail toont afstand tot supermarkt, huisarts, school, kinderdagverblijf, treinstation en OV-halte | All verified EXCEPT OV-halte -- not in 86134NED. Available: D000025 (supermarkt), D000028 (huisarts), D000045_1 (basisschool), D000029 (kinderdagverblijf), D000052 (treinstation). Substitute D000014 (overstapstation) for OV-halte |
| VOORZ-03 | Nabijheidsdata opgeslagen in neighborhood_metrics JSONB onder "nabijheid" key | neighborhood_metrics JSONB column exists on AreaScan model. Currently stores CBS Kerncijfers data at root level. Add sibling "nabijheid" key |
</phase_requirements>

## Standard Stack

### Core (already installed -- zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | existing | CBS API requests | Already used by CBSODataClient |
| SQLAlchemy 2.x | existing | JSONB storage in AreaScan | Already in use |
| React | 19.x | Frontend card component | Already in use |
| Tailwind CSS | 4.x | Styling | Already in use |
| TanStack Query | 5.x | Data fetching (via existing hooks) | Already in use |

### No New Dependencies
This phase requires zero new pip or npm packages. The backend extends the existing CBS client. The frontend adds one new card component using existing UI patterns.

## Architecture Patterns

### Backend: Extending CBSODataClient with a Second Dataset

The current `CBSODataClient` uses `self.dataset_id` (from settings) for all queries. For nabijheid, we need to query a DIFFERENT dataset (86134NED) using the SAME wijk identifier. Two approaches:

**Recommended: Add `get_nabijheid_data()` method with hardcoded dataset ID**

The nabijheid dataset ID (86134NED) is fixed and does not change yearly like the Kerncijfers dataset. It gets its own yearly dataset ID, but unlike KWB the previous research identified 86134NED as the 2024 edition. Add a separate method that constructs its own URL with the nabijheid dataset ID.

```python
# Nabijheid-specific measure codes for 86134NED
NABIJHEID_MEASURE_CODES: dict[str, str] = {
    "afstand_supermarkt": "D000025",        # Afstand tot grote supermarkt (km)
    "afstand_huisarts": "D000028",          # Afstand tot huisartsenpraktijk (km)
    "afstand_basisschool": "D000045_1",     # Afstand tot basisschool (km)
    "afstand_kinderdagverblijf": "D000029", # Afstand tot kinderdagverblijf (km)
    "afstand_treinstation": "D000052",      # Afstand tot treinstation (km)
    "afstand_overstapstation": "D000014",   # Afstand tot belangrijk overstapstation (km)
}

NABIJHEID_DATASET_ID = "86134NED"

async def get_nabijheid_data(
    self,
    client: httpx.AsyncClient,
    gemeente_code: str,
    wijk_naam: str | None = None,
) -> dict | None:
    """Fetch voorzieningen proximity data from CBS 86134NED."""
    # Reuse _resolve_wijk_identifier but with nabijheid dataset
    # ... (similar pattern to get_neighborhood_data)
```

**Key design decision:** The `_resolve_wijk_identifier` method currently uses `self.dataset_id` to construct the URL. For nabijheid, we need to pass the dataset ID as a parameter or make the method accept it. Refactor `_resolve_wijk_identifier` and `_fetch_observations` to accept an optional `dataset_id` parameter, defaulting to `self.dataset_id`.

```python
async def _resolve_wijk_identifier(
    self,
    client: httpx.AsyncClient,
    gemeente_code: str,
    wijk_naam: str,
    dataset_id: str | None = None,  # NEW: override for different datasets
) -> str | None:
    dataset = dataset_id or self.dataset_id
    url = f"{BASE_URL}/{dataset}/WijkenEnBuurtenCodes"
    # ... rest unchanged
```

### Backend: Storing Nabijheid Data

The `neighborhood_metrics` JSONB currently stores the full CBS response at the root level with structure `{ bron, dataset, peiljaar, data: { ... } }`. Nabijheid data should be stored as a SIBLING key at the root level of `neighborhood_metrics`:

```python
# In area_scan.py job:
scan.neighborhood_metrics = cbs_data  # existing Kerncijfers data
# After nabijheid fetch:
if nabijheid_data and scan.neighborhood_metrics:
    scan.neighborhood_metrics["nabijheid"] = nabijheid_data
elif nabijheid_data:
    scan.neighborhood_metrics = {"nabijheid": nabijheid_data}
```

The nabijheid payload structure:
```python
{
    "bron": "CBS Nabijheid voorzieningen OData v4",
    "dataset": "86134NED",
    "peiljaar": 2024,
    "afstanden": {
        "supermarkt_km": 0.8,
        "huisarts_km": 0.6,
        "basisschool_km": 0.5,
        "kinderdagverblijf_km": 0.7,
        "treinstation_km": 2.3,
        "overstapstation_km": 8.1,
    }
}
```

### Frontend: NabijheidCard Component

Follow the exact same pattern as `AgeDistributionCard`:
- Section with rounded-xl border, amber-accent header
- List of facilities with distance values
- Color-code distances: green (<1 km), amber (1-3 km), red (>3 km) for daily facilities; different thresholds for stations

```typescript
// New interface in scan.ts
export interface CbsNabijheid {
    bron: string
    dataset: string
    peiljaar: number
    afstanden: {
        supermarkt_km: number | null
        huisarts_km: number | null
        basisschool_km: number | null
        kinderdagverblijf_km: number | null
        treinstation_km: number | null
        overstapstation_km: number | null
    }
}

// Extend CbsNeighborhoodMetrics
export interface CbsNeighborhoodMetrics {
    // ... existing fields
    nabijheid?: CbsNabijheid  // NEW
}
```

Wait -- actually `neighborhood_metrics` is currently typed as the CBS Kerncijfers response directly. The nabijheid data would be stored as a sibling key. So `CbsNeighborhoodMetrics` is NOT the right place. Instead, `neighborhood_metrics` should be a union type or the `ScanListItem.neighborhood_metrics` should remain `dict | null` and the frontend casts appropriately. The simplest approach: keep `neighborhood_metrics` as the Kerncijfers structure, and add `nabijheid` as a top-level key alongside `bron`, `dataset`, `peiljaar`, `data`. The frontend reads `metrics.nabijheid` directly.

### Integration Point: WijkDetailView

The `WijkDetailView` already renders cards conditionally based on `latestScan.neighborhood_metrics`. Add the nabijheid card after the income card:

```tsx
{(latestScan.neighborhood_metrics as any)?.nabijheid && (
    <NabijheidCard
        nabijheid={(latestScan.neighborhood_metrics as any).nabijheid}
    />
)}
```

### Anti-Patterns to Avoid

- **Do NOT create a separate NabijheidClient class** -- the CBS API patterns are identical, just different dataset ID and measure codes. Extend the existing `CBSODataClient`.
- **Do NOT add nabijheid data inside `data.voorzieningen`** -- the `data` key is specifically for Kerncijfers measures. Nabijheid is a separate dataset and should be a sibling key.
- **Do NOT fetch nabijheid in a separate HTTP client** -- reuse the same `httpx.AsyncClient` passed to the scan job.
- **Do NOT add new settings/env vars** -- the nabijheid dataset ID (86134NED) is stable and should be hardcoded.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OV-halte proximity | Custom GTFS/9292 API integration | CBS treinstation + overstapstation distances | OV-halte data not in any CBS OData dataset; one-off 2020 Excel publication exists but is stale. Train station proximity is the closest reliable proxy |
| Distance color coding | Custom threshold logic per facility type | Simple 3-tier thresholds (green/amber/red) | CBS distances are pre-computed road distances in km. Simple thresholds are sufficient for PropTech use case |
| Wijk identifier resolution for 86134NED | Duplicate resolver | Refactor existing `_resolve_wijk_identifier` to accept dataset_id param | Same WijkenEnBuurtenCodes entity structure, same identifier format |

## Common Pitfalls

### Pitfall 1: OV-Halte Data Gap
**What goes wrong:** Requirement VOORZ-02 specifies "OV-halte" but 86134NED does not contain this measure.
**Why it happens:** The requirements were written based on the feature description which assumed CBS had OV-halte data. CBS published OV-halte proximity once in 2020 as a custom Excel file, not as a standard OData dataset.
**How to avoid:** Substitute with treinstation (D000052) and overstapstation (D000014). Document the gap for the user. Optionally add a "Geen OV-halte data beschikbaar" note in the UI.
**Warning signs:** `None` values for an "ov_halte_km" field that does not exist in the API.

### Pitfall 2: Duplicate Wijk Resolution Calls
**What goes wrong:** Calling `_resolve_wijk_identifier` twice (once for Kerncijfers, once for 86134NED) doubles the API calls during scan.
**Why it happens:** Each dataset has its own WijkenEnBuurtenCodes entity.
**How to avoid:** Cache the resolved identifier from the first call and reuse it for the nabijheid query. The wijk codes (WK036300 format) are the same across CBS datasets for the same reference year.
**Warning signs:** Scan taking noticeably longer after adding nabijheid. Check API call count in logs.

### Pitfall 3: Measure Code Suffix Confusion for Schools
**What goes wrong:** Using wrong school measure code and getting distances for vmbo instead of basisonderwijs.
**Why it happens:** 86134NED has D000045_1 (basisonderwijs), D000045_2 (voortgezet onderwijs totaal), D000045_3 (vmbo), D000045_4 (havo/vwo). The `_1` suffix matters.
**How to avoid:** Use D000045_1 for "afstand tot school" -- this is basisonderwijs (primary school), which is the most universally relevant for residential development livability assessment.

### Pitfall 4: JSONB Merge Overwrites
**What goes wrong:** Setting `scan.neighborhood_metrics["nabijheid"] = nabijheid_data` does not trigger SQLAlchemy dirty tracking on JSONB.
**Why it happens:** SQLAlchemy does not detect in-place mutations on JSONB columns by default.
**How to avoid:** Use `flag_modified(scan, "neighborhood_metrics")` from `sqlalchemy.orm.attributes` after mutating the dict, OR reconstruct the entire dict: `scan.neighborhood_metrics = {**scan.neighborhood_metrics, "nabijheid": nabijheid_data}`.

### Pitfall 5: Nabijheid Dataset Year Mismatch
**What goes wrong:** Hardcoding 86134NED but CBS publishes a new dataset ID for 2025 nabijheid data.
**Why it happens:** CBS publishes each year under a new dataset ID (like KWB: 85984NED=2024, 86165NED=2025).
**How to avoid:** Hardcode 86134NED for now (2024 data, published August 2025). CBS stated "first figures for 2025 will be added in summer 2026." When a 2025 nabijheid dataset appears, update the ID. Consider making it configurable via env var (CBS_NABIJHEID_DATASET_ID) for easier updates.

## Code Examples

### Backend: Nabijheid Fetch Method
```python
# Source: Verified against live CBS OData v4 endpoint
NABIJHEID_DATASET_ID = "86134NED"

NABIJHEID_MEASURE_CODES: dict[str, str] = {
    "afstand_supermarkt": "D000025",
    "afstand_huisarts": "D000028",
    "afstand_basisschool": "D000045_1",
    "afstand_kinderdagverblijf": "D000029",
    "afstand_treinstation": "D000052",
    "afstand_overstapstation": "D000014",
}

_NABIJHEID_CODE_TO_KEY: dict[str, str] = {v: k for k, v in NABIJHEID_MEASURE_CODES.items()}
```

### Backend: Observations Query for Nabijheid
```python
# Same OData v4 query pattern as existing Kerncijfers
url = f"{BASE_URL}/{NABIJHEID_DATASET_ID}/Observations"
measure_filter = " or ".join(
    f"Measure eq '{code}'" for code in NABIJHEID_MEASURE_CODES.values()
)
params = {
    "$filter": f"WijkenEnBuurten eq '{region_identifier}' and ({measure_filter})",
    "$select": "Measure,Value,ValueAttribute",
}
```

### Frontend: Distance Color Coding
```typescript
// Color thresholds for facility distance (km)
function distanceColor(km: number | null, type: 'daily' | 'transport'): string {
    if (km == null) return 'text-grey-500'
    if (type === 'daily') {
        // Daily facilities: supermarkt, huisarts, school, kdv
        if (km <= 1) return 'text-green-400'
        if (km <= 3) return 'text-amber-400'
        return 'text-red-400'
    }
    // Transport: treinstation, overstapstation
    if (km <= 3) return 'text-green-400'
    if (km <= 10) return 'text-amber-400'
    return 'text-red-400'
}
```

### Frontend: NabijheidCard Structure
```tsx
// Follow AgeDistributionCard pattern exactly
const FACILITIES: { key: string; label: string; type: 'daily' | 'transport' }[] = [
    { key: 'supermarkt_km', label: 'Supermarkt', type: 'daily' },
    { key: 'huisarts_km', label: 'Huisarts', type: 'daily' },
    { key: 'basisschool_km', label: 'Basisschool', type: 'daily' },
    { key: 'kinderdagverblijf_km', label: 'Kinderdagverblijf', type: 'daily' },
    { key: 'treinstation_km', label: 'Treinstation', type: 'transport' },
    { key: 'overstapstation_km', label: 'Overstapstation', type: 'transport' },
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CBS OData v3 | OData v4 on datasets.cbs.nl | 2023-2024 | 86134NED uses v4, same as KWB. No v3 complexity |
| Single CBS dataset per client | Multiple datasets sharing client infrastructure | Phase 79 | First time CBSODataClient queries a second dataset |
| OV-halte from CBS | Not available in standard CBS OData | 2020 was last publication | Must use treinstation/overstapstation as proxy |

## Open Questions

1. **OV-halte data source**
   - What we know: CBS 86134NED has treinstation (D000052) and overstapstation (D000014) but NOT OV-halte. A 2020 one-off Excel exists but is stale.
   - What's unclear: Whether the user considers treinstation + overstapstation an acceptable substitute for OV-halte.
   - Recommendation: Use treinstation + overstapstation. Flag in UI that OV-halte data is not available from CBS. If user insists on OV-halte, a future phase could integrate 9292 OV-API or NDOV data, but that is significant scope.

2. **Nabijheid dataset ID stability**
   - What we know: 86134NED is the 2024 edition. CBS typically publishes yearly editions with new IDs.
   - What's unclear: When 2025 edition will appear (CBS says "summer 2026").
   - Recommendation: Hardcode 86134NED. Add env var override (CBS_NABIJHEID_DATASET_ID) for easy future update.

3. **Wijk identifier caching across datasets**
   - What we know: WijkenEnBuurtenCodes identifiers (WK/GM format) are consistent across CBS datasets for the same reference period.
   - What's unclear: Whether 86134NED (2024 reference) identifiers match 86165NED (2025 reference) identifiers when wijk boundaries change.
   - Recommendation: Resolve from the nabijheid dataset itself (86134NED) for correctness, but cache within the scan job to avoid duplicate API calls. Since both datasets target the same wijk, the existing resolver should find the same identifier.

## Sources

### Primary (HIGH confidence)
- CBS OData v4 endpoint `https://datasets.cbs.nl/odata/v1/CBS/86134NED/` -- verified live, entities confirmed: Observations, WijkenEnBuurtenCodes, MeasureCodes
- CBS MeasureCodes endpoint for 86134NED -- all measure codes listed and verified (D000025, D000028, D000045_1, D000029, D000052, D000014, plus 80+ others)
- Existing codebase: `backend/app/government_apis/cbs_odata.py` (CBSODataClient patterns)
- Existing codebase: `backend/app/jobs/area_scan.py` (neighborhood_metrics storage pattern)
- Existing codebase: `frontend/src/components/projects/AgeDistributionCard.tsx` (card UI pattern)

### Secondary (MEDIUM confidence)
- [CBS Nabijheid voorzieningen page](https://www.cbs.nl/nl-nl/cijfers/detail/86134NED) -- confirmed dataset metadata and publication info
- [CBS OV-halte 2020 publication](https://www.cbs.nl/nl-nl/maatwerk/2021/24/nabijheid-van-ov-haltes--excl-trein---in-2020) -- confirmed one-off Excel publication, not OData

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, extends existing patterns
- Architecture: HIGH - same OData v4 protocol verified live, same entity structure
- Pitfalls: HIGH - OV-halte gap confirmed via live API verification, JSONB dirty tracking is well-documented SQLAlchemy behavior
- Measure codes: HIGH - verified via live MeasureCodes endpoint

**Research date:** 2026-03-07
**Valid until:** 2026-09-07 (stable CBS dataset, yearly updates)
