# Phase 74: 3D BAG Building Data - Research

**Researched:** 2026-03-03
**Domain:** 3D BAG API integration, scan pipeline enrichment, BuildingMetrics extension
**Confidence:** HIGH (codebase analysis) / MEDIUM (3D BAG API specifics — pre-verified in prompt)

---

## Summary

Phase 74 adds actual building dimensions (height, floor count) from the TU Delft 3D BAG dataset into the scan pipeline. The existing `building_metrics` JSONB structure in `ScanResult.flags` already has fields for `max_bouwhoogte` and `max_bouwlagen` (permitted envelope, from PLU WMS in Phase 73). Phase 74 adds the complementary **actual** measurements: `actual_bouwhoogte` and `actual_bouwlagen`.

The integration point is `area_scan.py` Phase 2 (BAG cross-reference), where `bag_features` from the BAG WFS are already in memory. The 3D BAG API takes BAG pand identificaties (format: `NL.IMBAG.Pand.{id}`) and returns `b3_h_dak_50p`, `b3_h_maaiveld`, and `b3_bouwlagen`. Building height = `b3_h_dak_50p - b3_h_maaiveld`. The primary design question is **lookup strategy**: per-pand REST API calls vs. bbox-based batch query. Given that wijk scans may have thousands of panden, the bbox approach is more efficient.

The frontend change is straightforward: extend `BuildingMetrics` TypeScript interface with `actual_bouwhoogte` and `actual_bouwlagen`, then upgrade `deriveTransformatiePotentie` to compare actual vs. permitted envelope when both are available. The codebase follows a clear pattern: new API client in `government_apis/`, rate limiter singleton in `rate_limiter.py`, CACHE_TTL entry in `config.py`, and `final_bm` dict merge in `area_scan.py`.

**Primary recommendation:** Use the 3D BAG OGC API Features bbox query to fetch all panden in the scan bbox in one call, build a pand-id → heights dict, then join to BAG WFS features already in `BagSpatialIndex` by pand identificatie. Store `actual_bouwhoogte` and `actual_bouwlagen` in `final_bm` alongside the existing PLU WMS permitted fields.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| 3DBAG-01 | Area scan parcels with BAG buildings show `actual_bouwhoogte` and `actual_bouwlagen` in `building_metrics` JSONB; `deriveTransformatiePotentie` uses actual vs permitted when both available; graceful fallback when 3D BAG data absent; client handles rate limiting and caches responses | 3D BAG API verified (OGC Features endpoint); integration point identified (area_scan.py Phase 2); caching pattern established (CACHE_TTL + `get_cached_or_fetch`); BuildingMetrics extension path clear |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | Existing | HTTP client for 3D BAG REST calls | Already used by every API client in the project |
| aiolimiter | Existing | Token-bucket rate limiting | Already used in `rate_limiter.py` for all government APIs |
| SQLAlchemy 2.x | Existing | Cache persistence in `CachedAPIResponse` | Project-wide ORM pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| base64 / httpx.BasicAuth | stdlib | HTTP Basic Auth for 3D BAG | 3D BAG requires registration + Basic Auth |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OGC API Features bbox | Per-pand REST calls `/items/{NL.IMBAG.Pand.ID}` | Per-pand is simpler but creates N API calls per scan; bbox batch is 1 call for all panden in wijk |
| OGC API Features | WFS endpoint at `data.3dbag.nl` | WFS is an older interface; OGC API Features is the modern REST approach with better JSON support |

**Installation:** No new dependencies required — uses existing httpx + aiolimiter + SQLAlchemy stack.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/government_apis/
└── bag_3d.py                    # New: 3D BAG API client

backend/app/core/config.py       # Add CACHE_TTL["bag_3d"] and BAG_3D_USERNAME/BAG_3D_PASSWORD settings

backend/app/government_apis/rate_limiter.py  # Add bag_3d_limiter singleton

backend/app/jobs/area_scan.py    # Wire 3D BAG lookup into Phase 2, extend BagSpatialIndex

frontend/src/lib/types/scan.ts   # Extend BuildingMetrics with actual_bouwhoogte, actual_bouwlagen
frontend/src/components/results/ParcelDetailModal.tsx  # Extend deriveTransformatiePotentie
```

### Pattern 1: 3D BAG Client (bbox batch query)

**What:** Fetch all 3D BAG pand data for the scan area in a single bbox request, returning a dict keyed by BAG pand identificatie.

**When to use:** During `area_scan_job` Phase 2, after BAG WFS fetch returns `bag_features`.

**Example:**
```python
# backend/app/government_apis/bag_3d.py

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import bag_3d_limiter

BASE_URL = "https://api.3dbag.nl/collections/pand/items"

class BAG3DClient:
    """Client for 3D BAG OGC API Features (TU Delft).

    Returns actual building height and floor count per BAG pand.
    Requires HTTP Basic Auth (register at 3dbag.nl).

    Key fields:
        b3_h_dak_50p   — median roof height (NAP meters)
        b3_h_dak_100p  — max roof height (NAP meters)
        b3_h_maaiveld  — ground level (NAP meters)
        b3_bouwlagen   — estimated floor count
    Building height = b3_h_dak_50p - b3_h_maaiveld
    """

    async def get_panden_in_bbox(
        self,
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        client: httpx.AsyncClient,
    ) -> dict[str, dict]:
        """Fetch 3D BAG data for all panden in bbox.

        Args:
            minx, miny, maxx, maxy: EPSG:28992 bounding box
            client: Shared httpx AsyncClient

        Returns:
            Dict keyed by BAG pand identificatie (e.g. "NL.IMBAG.Pand.0363100012345678")
            Value: {"actual_bouwhoogte": float | None, "actual_bouwlagen": int | None}

        Raises:
            GovernmentAPIError: On HTTP errors from 3D BAG API
        """
        # 3D BAG OGC API uses EPSG:28992 bbox
        bbox_str = f"{minx},{miny},{maxx},{maxy}"
        params = {
            "bbox": bbox_str,
            "bbox-crs": "http://www.opengis.net/def/crs/EPSG/0/28992",
            "limit": 1000,
            "f": "json",
        }

        results: dict[str, dict] = {}
        offset = 0

        while True:
            params["offset"] = offset
            async with bag_3d_limiter:
                response = await retry_with_backoff(
                    lambda: client.get(BASE_URL, params=params, timeout=30.0),
                    source="bag-3d",
                    retry_on_errors=True,
                )

            if response.status_code == 401:
                raise GovernmentAPIError("bag-3d", "Authentication required — check BAG_3D_USERNAME/PASSWORD", 401)
            if response.status_code != 200:
                raise GovernmentAPIError("bag-3d", f"HTTP {response.status_code}", response.status_code)

            data = response.json()
            features = data.get("features", [])

            for feature in features:
                pand_id = feature.get("id")
                if not isinstance(pand_id, str):
                    continue
                props = feature.get("properties", {}) or {}
                h_dak = props.get("b3_h_dak_50p")
                h_mv = props.get("b3_h_maaiveld")
                bouwlagen = props.get("b3_bouwlagen")

                actual_hoogte: float | None = None
                if isinstance(h_dak, (int, float)) and isinstance(h_mv, (int, float)):
                    hoogte = float(h_dak) - float(h_mv)
                    if 1.5 <= hoogte <= 200.0:  # Sanity bounds
                        actual_hoogte = round(hoogte, 1)

                actual_lagen: int | None = None
                if isinstance(bouwlagen, (int, float)) and 1 <= bouwlagen <= 100:
                    actual_lagen = int(round(bouwlagen))

                results[pand_id] = {
                    "actual_bouwhoogte": actual_hoogte,
                    "actual_bouwlagen": actual_lagen,
                }

            # Pagination: stop if fewer features than limit
            if len(features) < 1000:
                break
            offset += 1000

        return results

bag_3d_client = BAG3DClient()
```

### Pattern 2: BagSpatialIndex Extension

**What:** Add `pand_identificaties` list to `BagSpatialIndex` so that when a parcel intersects BAG buildings, we can look up the 3D BAG data for those specific panden.

**Current gap:** `BagSpatialIndex` stores `bouwjaren`, `statuses`, `representative_points` but NOT `identificaties`. The BAG WFS feature `properties.get("identificatie")` contains the BAG pand ID (format: `0363100012345678` — numeric only, without the `NL.IMBAG.Pand.` prefix).

**3D BAG ID format:** The OGC API returns IDs as `NL.IMBAG.Pand.{numeric_id}`. When joining, prepend `NL.IMBAG.Pand.` to the numeric BAG WFS identificatie.

**Example:**
```python
# Extended BagSpatialIndex
@dataclass(slots=True)
class BagSpatialIndex:
    tree: STRtree
    geometries: list[BaseGeometry]
    bouwjaren: list[int | None]
    statuses: list[str | None]
    representative_points: list[tuple[float, float]]
    identificaties: list[str | None]  # NEW: BAG pand identificatie for 3D BAG join

# In _build_bag_spatial_index:
identificatie_raw = props.get("identificatie")
identificaties.append(identificatie_raw if isinstance(identificatie_raw, str) else None)
```

### Pattern 3: Scan Pipeline Integration

**What:** After the BAG WFS fetch and 3D BAG client call, pass the `bag_3d_data` dict down to `_derive_bag_attributes_for_parcel`, which merges actual dimensions into the return value.

**Where:** `area_scan_job` Phase 2, between BAG WFS fetch and parcel loop. The `final_bm` dict merge pattern in Phase 4 already carries all `building_metrics` keys forward.

**Example sketch for area_scan.py:**
```python
# Phase 2: fetch 3D BAG data for scan area (after BAG WFS)
bag_3d_data: dict[str, dict] = {}
try:
    bag_3d_data = await bag_3d_client.get_panden_in_bbox(
        scan.bbox_minx, scan.bbox_miny,
        scan.bbox_maxx, scan.bbox_maxy,
        http_client,
    )
    logger.info(f"Scan {scan_id}: 3D BAG data for {len(bag_3d_data)} panden")
except Exception as e:
    # Non-fatal: scan continues without actual dimensions
    logger.warning(f"Scan {scan_id}: 3D BAG fetch failed (non-fatal): {e}")

# Pass bag_3d_data into _derive_bag_attributes_for_parcel (or do merge in Phase 4)
```

### Pattern 4: Caching Strategy

**What:** The 3D BAG data for a wijk bbox doesn't change frequently. However, the pattern used by `get_cached_or_fetch` in `cache_manager.py` requires a DB session and is per-resource. For scan-time bbox queries, a simpler approach is: **no caching of the bbox result itself** (the result changes with each bbox), but ensure the `BagSpatialIndex` is built once per scan and the `bag_3d_data` dict is reused across all parcels within a single scan execution.

This is already guaranteed by the scan architecture — `bag_3d_data` is fetched once in Phase 2 and reused in the Phase 3 parcel loop. This satisfies the "caches responses to avoid redundant API calls during scans" success criterion without needing persistent JSONB caching.

**Alternative:** If re-scan of same wijk within N days is common, add CACHE_TTL entry and cache by bbox hash. This adds complexity. The simple single-scan-lifetime cache is sufficient for success criterion 4.

### Pattern 5: Frontend Extension

**What:** Add `actual_bouwhoogte` and `actual_bouwlagen` to `BuildingMetrics` interface. Upgrade `deriveTransformatiePotentie` to use actual vs permitted comparison when both are present.

**Logic:** When both actual and max (permitted) are known, the "headroom" (permitted - actual) is the key signal:
- If actual is close to max (> 80% of permitted), transformation potential is low (already at limit)
- If actual is well below max, transformation potential is high (room to add floors/height)

This comparison creates a genuinely data-driven score, which is the point of Phase 74.

**Example TypeScript:**
```typescript
// Extended BuildingMetrics
export interface BuildingMetrics {
  pand_oppervlakte_m2?: number | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
  max_bouwhoogte?: number | null       // Phase 73: permitted
  max_bouwlagen?: number | null        // Phase 73: permitted
  actual_bouwhoogte?: number | null    // Phase 74: actual (3D BAG)
  actual_bouwlagen?: number | null     // Phase 74: actual (3D BAG)
}

// Extended deriveTransformatiePotentie logic:
const has3DData = metrics?.actual_bouwhoogte != null || metrics?.actual_bouwlagen != null
const hasDSOData = metrics?.max_bouwhoogte != null || metrics?.max_bouwlagen != null

if (has3DData && hasDSOData) {
  // Compare actual vs permitted — headroom analysis
  const hoogteHeadroom =
    metrics!.actual_bouwhoogte != null && metrics!.max_bouwhoogte != null
      ? 1 - metrics!.actual_bouwhoogte / metrics!.max_bouwhoogte
      : null
  // headroom 0 = fully used, 1 = completely empty
  // ...score from headroom
}
```

### Anti-Patterns to Avoid

- **Fetching 3D BAG per-parcel:** Would create N API calls per scan wijk (potentially 2000+ calls). Use the bbox query instead — one call covers all panden in the wijk.
- **Failing the scan on 3D BAG error:** 3D BAG is enrichment, not core data. Wrap in try/except and continue with empty `bag_3d_data = {}` on failure.
- **Storing raw 3D BAG response in JSONB cache:** The bbox result is large and tied to specific coordinates. Only cache if re-scanning same wijk is common — default to single-scan-lifetime reuse.
- **Using `b3_h_dak_100p` (peak height) instead of `b3_h_dak_50p` (median):** Peak height includes roof ridges/chimneys; median is more representative of buildable height.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry logic | Custom retry loop | `retry_with_backoff(fn, source, retry_on_errors=True)` | Already handles 429 + 5xx + network errors with exponential backoff |
| Rate limiting | asyncio.Semaphore alone | `APIRateLimiter` from `rate_limiter.py` | Combines concurrency control + token bucket for polite API usage |
| HTTP client | New httpx.AsyncClient | Shared client passed into client methods | Connection pooling; all API clients receive the shared client |
| Pagination | Custom while loop | Already implemented pattern in `bag_wfs.py` | The bbox query returns paginated results; copy the stop-on-partial-page pattern |

**Key insight:** Every government API client follows the same 4-element pattern: class with `BASE_URL`, async method accepting `httpx.AsyncClient`, `retry_with_backoff` + rate limiter, module-level singleton. Never deviate from this pattern.

---

## Common Pitfalls

### Pitfall 1: BAG Pand ID Format Mismatch

**What goes wrong:** The BAG WFS features return `identificatie` as a numeric string like `"0363100012345678"`. The 3D BAG OGC API returns IDs as `"NL.IMBAG.Pand.0363100012345678"`. If you use the wrong format for the dict key, no matches will be found.

**Why it happens:** The two BAG APIs use different ID representations.

**How to avoid:** When building `bag_3d_data` dict from OGC API responses, key by the full ID `"NL.IMBAG.Pand.{id}"`. When looking up from BAG WFS identificatie, prepend `"NL.IMBAG.Pand."` before lookup.

**Warning signs:** `bag_3d_data` is populated (non-empty) but no parcels ever get `actual_bouwhoogte`/`actual_bouwlagen`.

### Pitfall 2: Missing `BagSpatialIndex.identificaties` Makes Join Impossible

**What goes wrong:** The current `BagSpatialIndex` does not store BAG pand identificaties. `_derive_bag_attributes_for_parcel` returns the winning intersecting pand but has no way to look up its identificatie for a 3D BAG join.

**Why it happens:** `BagSpatialIndex` was built before 3D BAG integration was planned; only stored attributes needed for scoring.

**How to avoid:** Extend `BagSpatialIndex` with an `identificaties: list[str | None]` field, populated from `props.get("identificatie")` in `_build_bag_spatial_index`. In `_derive_bag_attributes_for_parcel`, return the winning pand's identificatie as part of the return tuple (or return all intersecting pand IDs).

**Warning signs:** Having to call `bag_3d_data.get(pand_id)` but not knowing `pand_id`.

### Pitfall 3: 3D BAG Auth Failure Silently Skips All Data

**What goes wrong:** If `BAG_3D_USERNAME`/`BAG_3D_PASSWORD` env vars are missing or incorrect, the API returns 401. If treated as a non-fatal error, all scans silently have no actual dimensions.

**Why it happens:** The "non-fatal" pattern is correct (don't fail scans), but without a visible warning, the issue is invisible.

**How to avoid:** Log a `logger.error` (not just `logger.warning`) when the 3D BAG response is 401. Ideally, emit a startup warning if `BAG_3D_USERNAME` is not configured.

**Warning signs:** Scans complete successfully but `actual_bouwhoogte` is always null in `building_metrics`.

### Pitfall 4: Altitude vs Height Confusion

**What goes wrong:** `b3_h_dak_50p` is an absolute NAP altitude (meters above sea level), not a building height. If stored directly, a building at sea level with a 10m roof appears as "10m high" but a building 5m above sea level with a 10m roof also appears as "10m high" — coincidentally correct but wrong for sloped terrain.

**Why it happens:** The field name "dak_50p" sounds like height but is actually an altitude.

**How to avoid:** Always compute `actual_bouwhoogte = b3_h_dak_50p - b3_h_maaiveld`. Both fields are required; if either is absent, leave `actual_bouwhoogte = None`.

**Warning signs:** Buildings in Amsterdam (NAP ~0m) look fine but buildings in hill terrain (NAP +20m) report incorrect heights.

### Pitfall 5: Scan Area Has No 3D BAG Coverage

**What goes wrong:** The 3D BAG API returns an empty feature list for certain areas (e.g., very new buildings not yet processed, or areas in ongoing update cycles).

**Why it happens:** 3D BAG coverage is 100% in principle but may lag for recently registered BAG panden.

**How to avoid:** Treat empty `bag_3d_data = {}` as a normal case — parcels gracefully fall back to Phase 73 heuristic. The fallback path already exists in `deriveTransformatiePotentie`.

### Pitfall 6: HTTP Basic Auth with httpx

**What goes wrong:** Passing auth credentials incorrectly (e.g., as headers instead of `auth=` parameter) causes 401 responses.

**How to avoid:** Use `client.get(url, auth=(username, password), ...)` or configure the shared client with auth. Since the shared `http_client` in `area_scan.py` is unauthenticated, pass auth per-request: `client.get(BASE_URL, params=params, auth=(user, pwd), timeout=30.0)`.

### Pitfall 7: Large Wijk Scans Exceed 3D BAG Pagination

**What goes wrong:** A wijk with 5000+ buildings requires multiple pages of 3D BAG results. If only page 1 is fetched (1000 features), buildings beyond page 1 get no 3D BAG data.

**Why it happens:** Forgetting to implement pagination in the 3D BAG client.

**How to avoid:** Implement the same partial-page-detection pagination pattern as `bag_wfs.py`: stop when `len(features) < limit`, otherwise increment offset and fetch next page.

---

## Code Examples

### 3D BAG rate limiter addition
```python
# backend/app/government_apis/rate_limiter.py — add at bottom:

# 3D BAG (TU Delft) — authenticated, conservative limits (rate not publicly documented)
# Use 2 concurrent / 200/hr as conservative default; adjust after observing behavior
bag_3d_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)
```

### CACHE_TTL and settings addition
```python
# backend/app/core/config.py — in CACHE_TTL dict:
"bag_3d": 604800,  # 7 days (3D BAG data is updated quarterly)

# In Settings class:
BAG_3D_USERNAME: str = Field(
    default="",
    description="3D BAG API username (register at 3dbag.nl)",
)
BAG_3D_PASSWORD: str = Field(
    default="",
    description="3D BAG API password",
)
```

### BagSpatialIndex extension
```python
# backend/app/jobs/area_scan.py — extend dataclass:
@dataclass(slots=True)
class BagSpatialIndex:
    tree: STRtree
    geometries: list[BaseGeometry]
    bouwjaren: list[int | None]
    statuses: list[str | None]
    representative_points: list[tuple[float, float]]
    identificaties: list[str | None]  # NEW

# In _build_bag_spatial_index, add to per-feature extraction:
id_raw = props.get("identificatie")
identificaties.append(id_raw if isinstance(id_raw, str) and id_raw.strip() else None)

# In BagSpatialIndex(...) constructor call:
identificaties=identificaties,
```

### _derive_bag_attributes_for_parcel return value extension
```python
# Current return: (has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2)
# New return:     (has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2, bag_identificaties)
# where bag_identificaties: list[str] — all intersecting pand IDs (for 3D BAG join)
```

### Phase 4 final_bm assembly with 3D BAG data
```python
# In area_scan.py Phase 4 (ranked_values construction):
# bag_identificaties comes from _derive_bag_attributes_for_parcel (all intersecting pands)
actual_hoogte: float | None = None
actual_lagen: int | None = None
for pand_id in (bag_identificaties or []):
    full_id = f"NL.IMBAG.Pand.{pand_id}" if not pand_id.startswith("NL.") else pand_id
    bag_3d_entry = bag_3d_data.get(full_id)
    if bag_3d_entry:
        h = bag_3d_entry.get("actual_bouwhoogte")
        l = bag_3d_entry.get("actual_bouwlagen")
        if h is not None:
            actual_hoogte = h if actual_hoogte is None else max(actual_hoogte, h)
        if l is not None:
            actual_lagen = l if actual_lagen is None else max(actual_lagen, l)

final_bm: dict = dict(building_metrics) if isinstance(building_metrics, dict) else {}
if pand_oppervlakte_m2 is not None:
    final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2
if actual_hoogte is not None:
    final_bm["actual_bouwhoogte"] = actual_hoogte
if actual_lagen is not None:
    final_bm["actual_bouwlagen"] = actual_lagen
```

### Frontend BuildingMetrics extension
```typescript
// frontend/src/lib/types/scan.ts — extend BuildingMetrics:
export interface BuildingMetrics {
  pand_oppervlakte_m2?: number | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
  max_bouwhoogte?: number | null        // Phase 73: permitted height
  max_bouwlagen?: number | null         // Phase 73: permitted floors
  actual_bouwhoogte?: number | null     // Phase 74: actual height from 3D BAG
  actual_bouwlagen?: number | null      // Phase 74: actual floor count from 3D BAG
}
```

### deriveTransformatiePotentie headroom logic
```typescript
// In ParcelDetailModal.tsx — new branch in deriveTransformatiePotentie:
const actualHoogte = metrics?.actual_bouwhoogte ?? null
const actualLagen = metrics?.actual_bouwlagen ?? null
const has3DData = actualHoogte != null || actualLagen != null

if (has3DData && hasDSOData) {
  // Headroom path: actual vs permitted
  const hoogteHeadroom =
    actualHoogte != null && bouwhoogte != null && bouwhoogte > 0
      ? Math.max(0, 1 - actualHoogte / bouwhoogte)
      : null
  const lagenHeadroom =
    actualLagen != null && bouwlagen != null && bouwlagen > 0
      ? Math.max(0, 1 - actualLagen / bouwlagen)
      : null

  // Use best available headroom signal (0=no headroom, 1=fully unused)
  const headroom = hoogteHeadroom != null && lagenHeadroom != null
    ? Math.max(hoogteHeadroom, lagenHeadroom)
    : (hoogteHeadroom ?? lagenHeadroom ?? 0)

  const headroomPts =
    headroom >= 0.6 ? 50
    : headroom >= 0.4 ? 35
    : headroom >= 0.2 ? 20
    : 10

  const bestemmingPts = supportsResidentialMixed ? 20 : 5
  const areaScore = /* same as existing */ ...
  const score = Math.min(100, headroomPts + bestemmingPts + areaScore)

  const parts: string[] = []
  if (actualLagen != null) parts.push(`${actualLagen}/${bouwlagen ?? '?'} lagen`)
  if (actualHoogte != null) parts.push(`${actualHoogte}/${bouwhoogte ?? '?'}m`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'geen wonen')
  return { score, label: parts.join(' \u00b7 ') }
}
// ... existing hasDSOData path and heuristic fallback unchanged
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No actual building dimensions | Phase 74 adds `actual_bouwhoogte` + `actual_bouwlagen` from 3D BAG | Phase 74 | `deriveTransformatiePotentie` can compare actual vs permitted for real headroom analysis |
| Heuristic-only transformatiepotentie | DSO path (Phase 73) + 3D BAG headroom path (Phase 74) + heuristic fallback | Phases 73-74 | Three-tier scoring: data-driven with headroom > data-driven permitted-only > heuristic |
| PLU WMS maatvoeringen (low coverage) | 3D BAG (100% NL coverage) | Phase 74 | 3D BAG covers every registered building; PLU WMS has ~0-4% maatvoering coverage |

**Deprecated/outdated:**
- Single-path `deriveTransformatiePotentie`: Now becomes three-tier (headroom > DSO > heuristic); old DSO-path code becomes the fallback when `has3DData` is false.

---

## Open Questions

1. **3D BAG Authentication — Credentials Availability**
   - What we know: 3D BAG requires HTTP Basic Auth registration with admins; it is free but requires sign-up.
   - What's unclear: Whether credentials have been obtained; what the actual rate limits are after registration.
   - Recommendation: Check if credentials exist in `backend/.env` as `BAG_3D_USERNAME`/`BAG_3D_PASSWORD`. If not, registration must happen before implementation. The Ongoing TODOs in STATE.md do not mention 3D BAG credentials, suggesting they have not been registered yet.

2. **3D BAG Pagination — OGC API `limit` Parameter Cap**
   - What we know: The OGC API Features standard supports `limit` parameter; the research context mentions pagination is needed for >10 buildings.
   - What's unclear: What the actual server-side `limit` cap is for the 3D BAG API. The standard default is often 10; we may need `limit=1000` explicitly.
   - Recommendation: In the client, explicitly set `limit=1000` and implement partial-page pagination. A single wijk can have thousands of panden; always paginate.

3. **Return Tuple Arity Change in `_derive_bag_attributes_for_parcel`**
   - What we know: Currently returns a 5-tuple. Adding `bag_identificaties: list[str]` makes it a 6-tuple. Multiple callers must be updated.
   - What's unclear: Whether adding `bag_identificaties` to the return vs passing `bag_3d_data` dict directly into the function is cleaner.
   - Recommendation: Two options: (A) Return 6-tuple and do the 3D BAG join in Phase 4 (follows established pattern of `pand_oppervlakte_m2`). (B) Pass `bag_3d_data` into `_derive_bag_attributes_for_parcel` and return `actual_bouwhoogte`/`actual_bouwlagen` directly (encapsulates logic). Option A is simpler given the existing `final_bm` merge pattern in Phase 4. Use Option A.

4. **Multiple Intersecting Panden — Which Height to Use?**
   - What we know: A parcel may intersect multiple BAG buildings. The current code picks the "best" pand by overlap area for address point, but accumulates `total_footprint_area`.
   - What's unclear: For actual height/floors, should we use the tallest building, the dominant building (most overlap), or the most common floor count?
   - Recommendation: Use the dominant building (most overlap area, same as `best_address_point` selection) for actual dimensions. This is consistent with how bouwjaar is already chosen (`min` of all intersecting panden for oldest building). Log all intersecting pand IDs and pick the one with the highest `best_overlap_area`.

---

## Integration Points Summary

| File | Change | Details |
|------|--------|---------|
| `backend/app/government_apis/bag_3d.py` | **New** | `BAG3DClient` with `get_panden_in_bbox()`, HTTP Basic Auth, pagination, `bag_3d_client` singleton |
| `backend/app/government_apis/rate_limiter.py` | **Add** | `bag_3d_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)` |
| `backend/app/core/config.py` | **Add** | `"bag_3d": 604800` in CACHE_TTL; `BAG_3D_USERNAME`/`BAG_3D_PASSWORD` in Settings |
| `backend/app/jobs/area_scan.py` | **Modify** | Extend `BagSpatialIndex` with `identificaties`; call `bag_3d_client.get_panden_in_bbox()` in Phase 2; return `bag_identificaties` from `_derive_bag_attributes_for_parcel`; merge `actual_bouwhoogte`/`actual_bouwlagen` into `final_bm` in Phase 4 |
| `frontend/src/lib/types/scan.ts` | **Modify** | Add `actual_bouwhoogte` and `actual_bouwlagen` to `BuildingMetrics` interface |
| `frontend/src/components/results/ParcelDetailModal.tsx` | **Modify** | Add headroom path to `deriveTransformatiePotentie` when `has3DData && hasDSOData` |

**No DB migrations required** — `actual_bouwhoogte` and `actual_bouwlagen` stored in existing `ScanResult.flags["building_metrics"]` JSONB.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/jobs/area_scan.py` — full scan pipeline, `BagSpatialIndex`, `_derive_bag_attributes_for_parcel`, `final_bm` merge pattern
- Codebase analysis: `backend/app/government_apis/bag_wfs.py` — existing API client pattern to replicate
- Codebase analysis: `backend/app/government_apis/bodemloket_arcgis.py` — rate limiter + retry_with_backoff pattern
- Codebase analysis: `backend/app/government_apis/rate_limiter.py` — `APIRateLimiter` with `aiolimiter`
- Codebase analysis: `backend/app/core/config.py` — CACHE_TTL structure, Settings pattern
- Codebase analysis: `frontend/src/lib/types/scan.ts` — `BuildingMetrics` interface (Phase 73 additions visible)
- Codebase analysis: `frontend/src/components/results/ParcelDetailModal.tsx` — `deriveTransformatiePotentie` three-path structure

### Secondary (MEDIUM confidence — from research prompt)
- 3D BAG API: `https://api.3dbag.nl/collections/pand/items/{NL.IMBAG.Pand.ID}` — OGC API Features endpoint
- 3D BAG fields: `b3_h_dak_50p`, `b3_h_dak_100p`, `b3_bouwlagen`, `b3_h_maaiveld` — per research brief
- 3D BAG coverage: 100% of 10M registered NL buildings — per research brief
- 3D BAG auth: HTTP Basic Auth, registration required — per research brief
- 3D BAG CRS: EPSG:7415 (RD New + NAP height) — per research brief; bbox queries use EPSG:28992

### Tertiary (LOW confidence — verify during implementation)
- Actual 3D BAG rate limits (not publicly documented — must be verified with admin after registration)
- Exact OGC API `limit` cap (assumed 1000, must verify with live API test)
- Whether BAG WFS `properties.identificatie` is numeric-only or already prefixed with `NL.IMBAG.Pand.`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing patterns verified in codebase
- Architecture: HIGH — integration points fully mapped from codebase analysis
- 3D BAG API specifics: MEDIUM — key fields and endpoint verified via research brief; rate limits and exact pagination unconfirmed
- Frontend: HIGH — existing `deriveTransformatiePotentie` code read directly

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (3D BAG API format stable; 3D BAG data updated quarterly)
