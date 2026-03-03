# Phase 73: DSO Omgevingsplan Bouwregels - Research

**Researched:** 2026-03-03
**Domain:** Dutch DSO Ruimtelijke Plannen API v4 — bouwregels extraction + Transformatiepotentie formula rewrite
**Confidence:** MEDIUM (API structure verified from OAS3 spec; real response field coverage incomplete; bouwlagen field availability LOW confidence)

---

## Summary

Phase 73 makes the Transformatiepotentie pillar bar real. Currently `deriveTransformatiePotentie()` in `ParcelDetailModal.tsx` is a pure heuristic: 30pt bouwjaar + 30pt bestemming(wonen/gemengd) + 20pt area = always 20-80 range with no actual building regulation data. The goal is to replace this with a formula that uses `max_bouwhoogte` and `max_bouwlagen` extracted from DSO zoning data — data that the backend already fetches and stores.

The good news: the backend already has a complete DSO integration. `zoning_aggregator.py` already extracts `max_bouwhoogte` from maatvoeringen via keyword matching on the `naam` field. `BuildingDimensions` schema already has `max_bouwhoogte` and `max_bouwhoogte` fields. The DSO `DSOSpatialPlansClient` already calls `get_maatvoeringen()`. The property report already includes `zoning.building_dimensions`. The gap is: (1) `max_bouwlagen` is not yet extracted anywhere; (2) the extracted `max_bouwhoogte` is not surfaced on the scan results API (only on the property report); (3) the frontend `deriveTransformatiePotentie()` function does not consume these backend values.

The critical architectural decision: do we add `max_bouwhoogte`/`max_bouwlagen` to `ScanResultItem.building_metrics` (the per-parcel scan cache) or do we read from `ZoningData.building_dimensions` in the property report API? For the pillar bar on `ParcelDetailModal`, `building_metrics` is the right path since it avoids re-fetching the report. The `building_metrics` dict is already in `ScanResultItem` and stored as JSONB `flags["building_metrics"]` in the scan job. Phase 72 already stores `pand_oppervlakte_m2` there. The scan job just needs to also persist `max_bouwhoogte` and `max_bouwlagen` from `ZoningData.building_dimensions`.

**Primary recommendation:** Extend `ScanResultItem.building_metrics` to include `max_bouwhoogte` and `max_bouwlagen`, extract these from `ZoningData.building_dimensions` during the scan job, add `max_bouwlagen` parsing to `zoning_aggregator.py`, and rewrite `deriveTransformatiePotentie()` to consume real values. No new API client needed.

---

## Standard Stack

### Core (already in use)
| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `DSOSpatialPlansClient` | `backend/app/government_apis/dso_spatial_plans.py` | Fetches plans, maatvoeringen, bestemmingsvlakken | Complete |
| `zoning_aggregator.py` | `backend/app/services/zoning_aggregator.py` | Spatial intersection + dimension extraction | Needs `bouwlagen` |
| `BuildingDimensions` | `backend/app/schemas/zoning.py` | Pydantic schema for zoning constraints | Needs `max_bouwlagen` field |
| `ScanResultItem.building_metrics` | `backend/app/scans/schemas.py` | Per-parcel buildability metrics dict | Needs `max_bouwhoogte`/`max_bouwlagen` |
| `deriveTransformatiePotentie()` | `frontend/src/components/results/ParcelDetailModal.tsx` | Heuristic formula, must become data-driven | Rewrite target |

### Supporting
| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `shapely` | 2.x (already installed) | Spatial point-in-polygon for maatvoeringen intersection | Already used in zoning_aggregator |
| pytest | 7.4+ (installed) | Unit tests for extraction functions | Always for backend changes |
| TypeScript strict | current | Frontend type safety | Always |

### No New Dependencies Needed
This phase requires zero new Python packages and zero new npm packages. All required libraries are already installed.

---

## Architecture Patterns

### Existing Data Flow (what already works)
```
area_scan.py scan job
  → _derive_bag_attributes_for_parcel()  [gets pand_oppervlakte_m2]
  → fetch_zoning_data()                  [gets ZoningData with building_dimensions]
  → compute_opportunity_score()          [uses bestemmingen for scoring]
  → ScanResult.flags["building_metrics"] = {
        max_bebouwingspercentage: ...,
        max_floor_area_ratio: ...,
        pand_oppervlakte_m2: ...       [added in Phase 72]
    }
```

### What Phase 73 Adds to the Data Flow
```
area_scan.py scan job
  → fetch_zoning_data()  [already called]
    → ZoningData.building_dimensions.max_bouwhoogte  [already extracted from maatvoeringen]
    → ZoningData.building_dimensions.max_bouwlagen   [NEW: needs extraction]
  → ScanResult.flags["building_metrics"] = {
        ...existing fields...,
        max_bouwhoogte: 12.5,    [NEW: from ZoningData.building_dimensions]
        max_bouwlagen: 4,        [NEW: from ZoningData.building_dimensions]
    }
```

### Frontend Data Flow
```
ParcelDetailModal.tsx
  parcel.building_metrics.max_bouwhoogte  [NEW: from flags]
  parcel.building_metrics.max_bouwlagen   [NEW: from flags]
  parcel.building_metrics.pand_oppervlakte_m2  [existing Phase 72]

  deriveTransformatiePotentie(bouwhoogte, bouwlagen, bouwjaar, supportsWonen, area_m2)
    → score: 0-100
    → label: context string
```

### Recommended Project Structure (additions only)
```
backend/
├── app/
│   ├── schemas/
│   │   └── zoning.py           # Add max_bouwlagen: int | None to BuildingDimensions
│   ├── services/
│   │   └── zoning_aggregator.py # Add bouwlagen extraction to _extract_building_dimensions()
│   └── jobs/
│       └── area_scan.py         # Persist max_bouwhoogte + max_bouwlagen to building_metrics
└── tests/unit/
    └── test_zoning_aggregator.py # Extend with bouwlagen test cases
frontend/
└── src/components/results/
    └── ParcelDetailModal.tsx     # Rewrite deriveTransformatiePotentie()
```

### Pattern 1: Extracting `max_bouwlagen` from Maatvoeringen
**What:** The DSO `maatvoeringen` endpoint returns items with `naam` (label string) and `waarde` (value string). The existing code already extracts `bouwhoogte`, `goothoogte`, `bebouwingspercentage` via keyword matching on `naam`. Adding `bouwlagen` follows the exact same pattern.

**Key finding from OAS3 spec:** The `Maatvoering` schema has an `omvang` array containing `{naam, waarde}` pairs. However, the existing codebase treats `naam` and `waarde` as top-level keys (not nested in `omvang`). The existing unit tests pass with top-level structure, and the integration works. The API may flatten these in the HAL+JSON response. Trust the existing pattern; do not change it.

**When to use:** In `_extract_building_dimensions()` in `zoning_aggregator.py`.

**Example (follows existing pattern):**
```python
# Source: backend/app/services/zoning_aggregator.py (existing pattern)
# In _extract_building_dimensions():
if waarde is not None:
    if "bouwhoogte" in naam:
        dimensions.max_bouwhoogte = _max_existing(dimensions.max_bouwhoogte, waarde)
    elif "bouwlagen" in naam or "verdieping" in naam or "woonlagen" in naam:
        # bouwlagen is integer, but waarde is float — round to int at consumer
        dimensions.max_bouwlagen = _max_existing(dimensions.max_bouwlagen, waarde)
    elif "goothoogte" in naam:
        dimensions.max_goothoogte = _max_existing(dimensions.max_goothoogte, waarde)
    # ... etc
```

**Note:** `max_bouwlagen` should be `int | None` in `BuildingDimensions` schema. Use `round(waarde)` when storing. The `_max_existing()` helper works with floats; convert at schema assignment.

### Pattern 2: Persisting to `building_metrics` in Scan Job
**What:** Phase 72 already established the pattern for adding new fields to `building_metrics` in `area_scan.py`. Follow it exactly.

**Example (from area_scan.py Phase 72 pattern):**
```python
# Source: backend/app/jobs/area_scan.py (existing pattern from Phase 72)
final_bm: dict = dict(building_metrics) if isinstance(building_metrics, dict) else {}
if pand_oppervlakte_m2 is not None:
    final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2

# Phase 73 additions:
if zoning_data and zoning_data.building_dimensions:
    dims = zoning_data.building_dimensions
    if dims.max_bouwhoogte is not None:
        final_bm["max_bouwhoogte"] = dims.max_bouwhoogte
    if dims.max_bouwlagen is not None:
        final_bm["max_bouwlagen"] = dims.max_bouwlagen
```

**No schema migration needed** — `building_metrics` lives in the existing JSONB `flags` column. New fields are additive.

### Pattern 3: Frontend `deriveTransformatiePotentie()` Rewrite
**What:** Replace the heuristic formula with a data-driven one. When DSO data is available, use `max_bouwhoogte` and `max_bouwlagen` as primary signals. Fall back to the current heuristic when DSO data is absent.

**Formula design (based on PBL transformatiepotentie methodology):**

Real-world transformatiepotentie for real estate developers depends on:
1. **Bouwhoogte headroom**: How much taller than current can we build? (max_bouwhoogte vs typical existing building heights)
2. **Bouwlagen potential**: More allowed floors = more development potential
3. **Bestemming**: Wonen/gemengd = can build residential = high demand
4. **Scale**: Bigger parcel = more absolute opportunity
5. **Building age**: Older buildings are candidates for replacement

**Proposed formula (when DSO data available):**
```typescript
// Source: research recommendation
function deriveTransformatiePotentie(params: {
  max_bouwhoogte: number | null,
  max_bouwlagen: number | null,
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
}): { score: number; label: string; dataSource: 'dso' | 'heuristic' }

// DSO path (when bouwhoogte OR bouwlagen available):
// bouwhoogte score: >= 15m → 35pts, >= 10m → 25pts, >= 7m → 18pts, >= 4m → 10pts
// bouwlagen score: >= 4 lagen → 30pts, >= 3 lagen → 22pts, 2 lagen → 14pts
// bestemming score: wonen/gemengd → 20pts, other → 5pts
// area score: same as before (0-15pts)
// max total: 100

// Heuristic fallback (when no DSO data):
// Keep existing bouwjaar + bestemming + area formula
```

**Label should show data source:**
- DSO path: "DSO bouwregels · 4 lagen · 12m"
- Heuristic: "Inschatting · Bouwjaar 1975 · wonen ok"

### Anti-Patterns to Avoid
- **Do NOT query DSO again in the modal**: Data must come from `parcel.building_metrics` (already cached in scan). Never make a fresh DSO API call from the frontend or from the property enrichment endpoint just for pillar bars.
- **Do NOT create a new backfill script immediately**: Old scans will simply show the heuristic (null DSO data → fallback path). A backfill can be done later if needed. The frontend formula handles null gracefully.
- **Do NOT add `max_bouwlagen` to `ZoningData` only**: It must also flow into `ScanResult.flags["building_metrics"]` for the scan results list to show it.
- **Do NOT break existing `building_metrics` consumers**: `tile_proxy.py` reads `max_bebouwingspercentage` and `max_floor_area_ratio` from building_metrics via raw SQL. Adding new keys is additive and safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spatial intersection for maatvoeringen | Custom point-in-polygon | `shapely` via `_find_containing_features()` (already exists) | Edge cases with boundary points, ring polygons |
| DSO API client | New HTTP wrapper | `DSOSpatialPlansClient` (already complete) | Pagination, retry, headers all handled |
| Maatvoering text parsing | New regex | `_to_float()` + `_extract_tar_far_from_text()` (already exists) | Handles commas, units, edge cases |
| Merging dimension candidates | Custom merge | `_merge_building_dimensions()` (already exists) | Takes max across multiple plans |
| Caching DSO calls | Redis/custom | `get_cached_or_fetch()` via `cache_manager` (already exists) | DSO data cached at `dso:zoning:v3:{x}:{y}` |

**Key insight:** This phase is predominantly a wiring task, not a new API client task. The DSO infrastructure already exists; Phase 73 extends the field set it populates.

---

## Common Pitfalls

### Pitfall 1: `max_bouwlagen` Not Present in Most Plans
**What goes wrong:** Developer adds bouwlagen extraction, runs against real DSO data, gets null for 80%+ of parcels.
**Why it happens:** As confirmed by the geoforum discussion, even `max_bouwhoogte` is only in ~50% of plans. `max_bouwlagen` is less standardized — many municipalities use "bouwhoogte in meters" exclusively. MEDIUM confidence that bouwlagen will have <40% coverage.
**How to avoid:** The formula MUST have a graceful fallback. When `max_bouwlagen` is null and `max_bouwhoogte` is also null, fall back to the current heuristic formula. Do not show "Onbekend" for most parcels — show the heuristic with a label that explains it's an estimate.
**Warning signs:** If more than 80% of parcels show heuristic fallback, that's expected — not a bug.

### Pitfall 2: Maatvoering `naam` Variations for Bouwlagen
**What goes wrong:** Code only matches "bouwlagen" but plans use "aantal bouwlagen", "verdiepingen", "woonlagen", "lagen", etc.
**Why it happens:** Dutch municipal bestemmingsplannen have no enforced vocabulary for maatvoeringen labels.
**How to avoid:** Match multiple Dutch synonyms:
```python
BOUWLAGEN_KEYWORDS = ("bouwlagen", "bouwlaag", "verdieping", "woonlagen", "lagen")
if any(kw in naam for kw in BOUWLAGEN_KEYWORDS) and "bouw" not in naam.replace("bouwlagen", ""):
    # ... extract bouwlagen value
```
Also scan the maatvoering free-text fields (the `maatvoering` key in the dict, as the test case at line 279 shows).

### Pitfall 3: Cache Version Mismatch
**What goes wrong:** Existing cached DSO zoning responses (cache key `dso:zoning:v3:{x}:{y}`) don't have `max_bouwlagen` since it wasn't extracted when they were cached.
**Why it happens:** The cache stores the result of `_fetch()` as a dict. The `building_dimensions` sub-dict won't have `max_bouwlagen` for cached entries until re-fetched.
**How to avoid:** Bump the cache version from `v3` to `v4` in `fetch_zoning_data()`:
```python
cache_key = f"dso:zoning:v4:{x}:{y}"  # bumped from v3
```
This forces all existing caches to expire on next access. The previous version key becomes orphan entries that TTL out naturally.
**Warning signs:** `max_bouwlagen` is always None even for plans known to have bouwlagen data.

### Pitfall 4: Omgevingsplan vs Bestemmingsplan — Different Data Quality
**What goes wrong:** Developer expects omgevingsplannen (the new Omgevingswet plans) to have clean machine-readable bouwregels. In practice, as of 2026, most Dutch municipalities are still in the transition period. Their "omgevingsplan" is the "bruidsschat" — the temporary plan consisting of old bestemmingsplannen carried forward plus transition rules. Machine-readable maatvoeringen are only well-populated for municipalities that have actively published new-style omgevingsplannen.
**Why it happens:** The Omgevingswet transition period runs until December 31, 2031. The existing DSO RP API v4 returns BOTH old-style bestemmingsplannen (from ruimtelijkeplannen.nl) AND new-style omgevingsplannen. Plan priority logic (`_filter_and_sort_plans()`) already handles this correctly by prioritizing `omgevingsplan` and `bestemmingsplan` type plans.
**How to avoid:** Do not assume omgevingsplan data is cleaner. Treat both equally via the existing plan-type priority ranking. The existing fallback chain (DSO maatvoeringen → plan teksten → PLU WMS) handles coverage gaps.
**Warning signs:** Maatvoeringen absent for a plan but plan_type is "omgevingsplan".

### Pitfall 5: Frontend Type Safety for building_metrics
**What goes wrong:** `building_metrics` typed as `Record<string, unknown>` — TypeScript doesn't enforce the new fields.
**Why it happens:** The schema uses a generic dict on both backend and frontend.
**How to avoid:** Create a typed interface in `scan.ts`:
```typescript
export interface BuildingMetrics {
  pand_oppervlakte_m2?: number | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
  max_bouwhoogte?: number | null    // NEW Phase 73
  max_bouwlagen?: number | null     // NEW Phase 73
}
```
Then cast in `ParcelDetailModal.tsx`:
```typescript
const metrics = parcel.building_metrics as BuildingMetrics | null
```

### Pitfall 6: Bouwlagen as Float in API, Should Be Int
**What goes wrong:** Maatvoering `waarde` for bouwlagen is returned as a string like "3.0" or "4". The `_to_float()` helper returns 3.0. Code stores float where int is semantically correct.
**How to avoid:** In `BuildingDimensions`, use `max_bouwlagen: int | None`. Convert in `zoning_aggregator.py`:
```python
bouwlagen_float = _to_float(waarde)
if bouwlagen_float is not None and 0 < bouwlagen_float <= 50:
    bouwlagen_int = round(int(bouwlagen_float))
    dimensions.max_bouwlagen = max(dimensions.max_bouwlagen or 0, bouwlagen_int) or None
```

---

## Code Examples

### Current `BuildingDimensions` Schema (needs `max_bouwlagen`)
```python
# Source: backend/app/schemas/zoning.py (current)
class BuildingDimensions(BaseModel):
    max_hoogte: float | None = Field(default=None)
    max_bebouwingspercentage: float | None = Field(default=None)
    max_floor_area_ratio: float | None = Field(default=None)
    max_goothoogte: float | None = Field(default=None)
    max_bouwhoogte: float | None = Field(default=None)
    # Phase 73 ADD:
    max_bouwlagen: int | None = Field(default=None, description="Maximum allowed building floors")
```

### Current `_extract_building_dimensions()` (add bouwlagen branch)
```python
# Source: backend/app/services/zoning_aggregator.py (current pattern)
if waarde is not None:
    if "bouwhoogte" in naam:
        dimensions.max_bouwhoogte = _max_existing(dimensions.max_bouwhoogte, waarde)
    elif "goothoogte" in naam:
        dimensions.max_goothoogte = _max_existing(dimensions.max_goothoogte, waarde)
    elif "hoogte" in naam:
        dimensions.max_hoogte = _max_existing(dimensions.max_hoogte, waarde)
    # Phase 73 ADD:
    elif any(kw in naam for kw in ("bouwlagen", "bouwlaag", "verdieping", "woonlagen")) and 1 < waarde <= 50:
        dimensions.max_bouwlagen = max(dimensions.max_bouwlagen or 0, round(int(waarde))) or None
```

### Current Scan Job Building Metrics Write (Phase 72 pattern)
```python
# Source: backend/app/jobs/area_scan.py (Phase 72 pattern)
final_bm: dict = dict(building_metrics) if isinstance(building_metrics, dict) else {}
if pand_oppervlakte_m2 is not None:
    final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2

# Phase 73 ADD (after zoning_data is available):
if zoning_data and zoning_data.building_dimensions:
    bd = zoning_data.building_dimensions
    if bd.max_bouwhoogte is not None:
        final_bm["max_bouwhoogte"] = bd.max_bouwhoogte
    if bd.max_bouwlagen is not None:
        final_bm["max_bouwlagen"] = bd.max_bouwlagen
```

### Frontend `deriveTransformatiePotentie()` Rewrite
```typescript
// Source: research recommendation for ParcelDetailModal.tsx
interface BuildingMetrics {
  pand_oppervlakte_m2?: number | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
  max_bouwhoogte?: number | null
  max_bouwlagen?: number | null
}

function deriveTransformatiePotentie(
  metrics: BuildingMetrics | null,
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
): { score: number; label: string; dataSource: 'dso' | 'heuristic' } {
  const bouwhoogte = metrics?.max_bouwhoogte ?? null
  const bouwlagen = metrics?.max_bouwlagen ?? null
  const hasDSOData = bouwhoogte != null || bouwlagen != null

  if (hasDSOData) {
    // DSO data-driven path
    const hoogtePts =
      bouwhoogte == null ? 0
      : bouwhoogte >= 15 ? 35
      : bouwhoogte >= 10 ? 25
      : bouwhoogte >= 7 ? 18
      : bouwhoogte >= 4 ? 10
      : 5

    const lagenPts =
      bouwlagen == null ? 0
      : bouwlagen >= 5 ? 30
      : bouwlagen >= 4 ? 25
      : bouwlagen >= 3 ? 18
      : bouwlagen >= 2 ? 10
      : 5

    // Use the stronger signal (bouwhoogte or bouwlagen), not both additive
    const buildingPts = bouwhoogte != null && bouwlagen != null
      ? Math.max(hoogtePts, lagenPts)   // take highest if both present
      : hoogtePts + lagenPts             // take whichever is non-zero

    const bestemmingPts = supportsResidentialMixed ? 20 : 5
    const areaScore =
      area_m2 == null ? 3
      : area_m2 >= 2000 ? 15
      : area_m2 >= 1000 ? 10
      : area_m2 >= 500 ? 6
      : 3

    const score = Math.min(100, buildingPts + bestemmingPts + areaScore)

    const parts: string[] = []
    if (bouwlagen != null) parts.push(`${bouwlagen} lagen`)
    if (bouwhoogte != null) parts.push(`${bouwhoogte}m`)
    parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
    const label = parts.join(' · ')

    return { score, label, dataSource: 'dso' }
  }

  // Heuristic fallback (no DSO data)
  const bouwjaarScore =
    bouwjaar == null ? 10
    : bouwjaar < 1960 ? 30
    : bouwjaar < 1980 ? 22
    : bouwjaar < 2000 ? 14
    : bouwjaar < 2010 ? 8
    : 3
  const bestemmingScore = supportsResidentialMixed ? 30 : 10
  const areaScore =
    area_m2 == null ? 5
    : area_m2 >= 2000 ? 20
    : area_m2 >= 1000 ? 15
    : area_m2 >= 500 ? 10
    : 3
  const score = bouwjaarScore + bestemmingScore + areaScore
  const parts: string[] = []
  if (bouwjaar != null) parts.push(`Bouwjaar ${bouwjaar}`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'niet-wonen')
  return { score, label: parts.join(' · '), dataSource: 'heuristic' }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bestemmingsplan (WRO) | Omgevingsplan (Ow) | Jan 1, 2024 | Old plans still in DSO API via RP APIv4; new omgevingsplannen via same API |
| DSO RP API v3 | DSO RP API v4 | 2023 | v4 supports time travel, umbrella plans; project already uses v4 |
| Plans without transition rights | `eindeRechtsgeldigheid: 01-01-2024` | Jan 2024 | Old bestemmingsplannen marked expired; `_filter_and_sort_plans()` handles |
| Maatvoeringen at plan level | Maatvoeringen per zoekgebied | Always | Use `/plannen/{id}/maatvoeringen?expand=geometrie` — already implemented |

**Deprecated/outdated:**
- DSO API v1/v2/v3: All superseded by v4. Project already uses v4.
- `locaties/_zoek` endpoint: Replaced by `locatieidentificaties/_zoek` in v6+ of Omgevingsdocument Presenteren API. **Not relevant** — this phase uses the Ruimtelijke Plannen API, not the Omgevingsdocument Presenteren API.

---

## Open Questions

1. **`max_bouwlagen` field coverage in production**
   - What we know: Max building heights are in ~50% of plans (per geoforum). Bouwlagen coverage is likely lower.
   - What's unclear: What percentage of plans have machine-readable `bouwlagen` in maatvoeringen vs. only in plan teksten as free text?
   - Recommendation: Implement both the structured parse AND a text-based fallback (scan plan teksten for "maximaal X bouwlagen"). Accept that coverage will be partial; the heuristic fallback ensures the pillar bar always shows.

2. **Where `zoning_data` is available in `area_scan.py` scan loop**
   - What we know: `fetch_zoning_data()` is called in the scan job and its result goes into `insights = derive_opportunity_insights(parcel)`. The `building_metrics` dict comes from `insights.building_metrics`.
   - What's unclear: The exact variable name and location of `zoning_data` within the scan job loop — whether it's directly accessible when building `final_bm`.
   - Recommendation: Read `area_scan.py` carefully during plan execution. `zoning_data` is passed to `compute_opportunity_score()` via `parcel_data.bestemmingen`; the raw `ZoningData` object may need to be returned or stored separately to access `building_dimensions`. The scan job may need a small refactor to capture the `ZoningData` object in scope.

3. **Whether `omvang` array vs flat `naam`/`waarde` matters**
   - What we know: The OAS3 spec says maatvoeringen have `omvang: [{naam, waarde}]`. The existing code uses `maatvoering.get("naam")` flat. Tests pass.
   - What's unclear: Whether the HAL+JSON response from the live API actually flattens `omvang` items into the top-level maatvoering dict, or if there's already a normalization step.
   - Recommendation: Trust the existing pattern — it works in production. If `max_bouwlagen` extraction fails in testing, check whether the API returns `omvang` as an array and add a parsing branch.

---

## DSO API Technical Reference

### Maatvoeringen Endpoint (confirmed in use)
```
GET /plannen/{plan_id}/maatvoeringen?expand=geometrie&pageSize=100
Host: ruimte.omgevingswet.overheid.nl
Headers:
  X-Api-Key: {DSO_API_KEY}
  Content-Crs: epsg:28992
  Accept-Crs: epsg:28992
```

### Response Structure (per OAS3 spec + existing code observation)
```json
{
  "_embedded": {
    "maatvoeringen": [
      {
        "id": "...",
        "naam": "maximum bouwhoogte",
        "waarde": "12",
        "geometrie": { "type": "Polygon", "coordinates": [...] },
        "omvang": [
          { "naam": "maximum bouwhoogte", "waarde": "12" }
        ]
      }
    ]
  },
  "_links": { "next": {"href": "..."} }
}
```

### Known `naam` Values for Building Dimensions (from test data + geoforum)
| naam contains | Maps to | Type |
|---------------|---------|------|
| `"bouwhoogte"` | `max_bouwhoogte` | meters (float) |
| `"goothoogte"` | `max_goothoogte` | meters (float) |
| `"bebouwingspercentage"` | `max_bebouwingspercentage` | % (float 0-100) |
| `"fsi"`, `"far"`, `"vloerindex"` | `max_floor_area_ratio` | ratio (float) |
| `"bouwlagen"`, `"bouwlaag"`, `"verdieping"` | `max_bouwlagen` | count (int) [NOT YET EXTRACTED] |

### Authentication
- Config key: `settings.DSO_API_KEY` or `settings.RUIMTELIJKE_PLANNEN_API_KEY`
- Both already exist in `DSOSpatialPlansClient.get_dso_client()`. No changes needed.

---

## Validation Architecture

*nyquist_validation not set in config.json (key absent) — including validation section as best practice*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 7.4+ with pytest-asyncio |
| Config file | `backend/pyproject.toml` → `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && python -m pytest tests/unit/test_zoning_aggregator.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |
| Estimated runtime | ~15 seconds (unit), ~2 min (full) |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| P73-01 | `BuildingDimensions.max_bouwlagen` field added to schema | unit | `pytest tests/unit/test_zoning_aggregator.py::TestExtractBuildingDimensions -x -q` | Extend existing |
| P73-02 | Bouwlagen extracted from maatvoeringen with keyword "bouwlagen" | unit | `pytest tests/unit/test_zoning_aggregator.py::TestExtractBuildingDimensions::test_dimension_field_mapping -x -q` | Extend existing |
| P73-03 | `max_bouwhoogte` and `max_bouwlagen` written to `ScanResult.flags["building_metrics"]` | unit | `pytest tests/unit/test_area_scan.py -x -q` (NEW) | Wave 0 gap |
| P73-04 | Frontend `deriveTransformatiePotentie()` returns DSO-path score when metrics present | manual | n/a — pure function logic | Manual verify |
| P73-05 | Frontend falls back to heuristic when `building_metrics` has no DSO data | manual | n/a | Manual verify |

### Wave 0 Gaps
- `tests/unit/test_area_scan_bouwregels.py` — unit test for the building_metrics persistence logic (the part that copies `max_bouwhoogte`/`max_bouwlagen` from `ZoningData.building_dimensions` into `final_bm`). Alternatively, extend `test_zoning_aggregator.py` with `BuildingDimensions.max_bouwlagen` schema tests.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/government_apis/dso_spatial_plans.py` — existing DSOSpatialPlansClient implementation (endpoint structure, auth pattern)
- `backend/app/services/zoning_aggregator.py` — existing maatvoeringen extraction logic (naam/waarde pattern)
- `backend/app/schemas/zoning.py` — existing BuildingDimensions schema
- `backend/app/jobs/area_scan.py` — existing building_metrics persistence pattern (Phase 72)
- `https://github.com/PDOK/open-api-specs/blob/master/ruimtelijke-plannen/oas3.yaml` — OAS3 schema confirming `omvang: [{naam, waarde}]` structure
- `backend/tests/unit/test_zoning_aggregator.py` — existing test patterns for maatvoeringen

### Secondary (MEDIUM confidence)
- `https://geoforum.nl/t/ervaring-met-destilleren-van-maximale-bouwhoogten-uit-bestemmingsplan/7535` — community evidence that maatvoeringen have variable coverage (~50%) and require text parsing fallbacks
- `https://developer.omgevingswet.overheid.nl/api-register/beschikbare-api-services/` — confirmed API landscape (RP API v4 + Omgevingsdocument APIs)
- `https://developer.omgevingswet.overheid.nl/api-register/api/omgevingsdocument-presenteren/` — confirmed v8 endpoints (NOT used by this phase)

### Tertiary (LOW confidence)
- Bouwlagen keyword variations ("verdieping", "woonlagen") — inferred from Dutch planning vocabulary; verify against real API responses
- Bouwlagen coverage rate estimate (<40%) — inferred from bouwhoogte coverage data; no authoritative figure found

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components exist and work; only extension needed
- Architecture: HIGH — pattern established by Phase 72; just adding fields
- `max_bouwlagen` keyword variations: MEDIUM — naam values observed in test data; production coverage unknown
- Bouwlagen API coverage: LOW — no authoritative data on how many plans include bouwlagen maatvoeringen
- Frontend formula weights: MEDIUM — reasonable domain logic; will need tuning after seeing real data

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (DSO API is stable; 30-day validity reasonable)
