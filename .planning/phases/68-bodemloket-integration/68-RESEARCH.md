# Phase 68: Bodemloket Integration - Research

**Researched:** 2026-03-02
**Domain:** ArcGIS REST / WMS spatial query, government API client pattern, JSONB caching
**Confidence:** HIGH (API tested live, field names confirmed from live responses)

## Summary

The Bodemloket service exposes WBB (Wet bodembescherming) soil contamination dossiers via two interfaces: a WMS (GetFeatureInfo) and an ArcGIS REST MapServer query endpoint. Live probing during research confirmed that the ArcGIS REST endpoint at `gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer` is operational (version 11.5, certificate valid to May 2026). The old URL referenced in the 2019 blog posts (`www.gdngeoservices.nl/arcgis/...`) returns 404; only the `gis.gdngeoservices.nl/standalone/rest/...` path works.

The primary query method for parcel-level lookup is an ArcGIS REST spatial intersection query against layer 0 (WBB_locaties), using an envelope (bounding box) built from the parcel centroid plus a 25-50m buffer. This approach was tested live and returns GeoJSON with confirmed field names. The WMS GetFeatureInfo endpoint also works technically but the WBB_locaties layer has a `MaxScaleDenominator=100000` constraint, making it tricky to hit at parcel scale — the REST query is simpler and more reliable.

Caching follows the established `get_cached_or_fetch()` pattern with a 30-day TTL, keyed by parcel RD centroid (rounded to 1m). The frontend section follows the WkbClassificatieSection 3-state pattern (null / no-records / records-found) with a mandatory disclaimer when no records are found. No new dependencies are required; all needed libraries (httpx, pyproj, shapely) are already in pyproject.toml.

**Primary recommendation:** Use the ArcGIS REST layer 0 query with an envelope geometry (±25m buffer around parcel centroid), return fields `WBB_DOSSIER_DBK, SIKB_ID, TYPE_CD, VERVOLG_WBB, STATUS_OORD, ADMINISTRATOR_NM, LOCATIECODE_BEVOEGD_GEZAG, BIS_LOCCODE`, cache 30 days per parcel centroid key, surface in a BodemSection frontend component with disclaimer on empty result.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BODEM-01 | System queries Bodemloket for soil contamination data at parcel coordinates | ArcGIS REST layer 0 spatial query confirmed live. Parcel centroid from `_extract_rd_coordinates()` is the input. Envelope query ±25m buffer returns intersecting WBB polygons. |
| BODEM-02 | Property report includes "Bodemkwaliteit" section showing contamination status and WBB dossier references | BodemData schema + BodemSection frontend component. Fields: `WBB_DOSSIER_DBK` (int OID, unique dossier reference), `STATUS_OORD` (contamination verdict), `VERVOLG_WBB` (follow-up status), `ADMINISTRATOR_NM` (competent authority). |
| BODEM-03 | Absent Bodemloket data displayed as "geen gegevens beschikbaar" (never "schone grond") | Empty feature collection = no records. Display message must say "Geen geregistreerde verontreiniging gevonden" with mandatory disclaimer that Bodemloket coverage is incomplete and absence is not a soil clearance certificate. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | >=0.27.0 (already installed) | Async HTTP for ArcGIS REST queries | Already used for all government APIs |
| pyproj | >=3.7.0 (already installed) | RD↔WGS84 coordinate transforms | Already used in rce_monuments.py |
| aiolimiter | >=1.2.0 (already installed) | Rate limiting | Used in all API limiters |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shapely | >=2.0.0 (already installed) | Optional: polygon centroid from cadastral geometry | Only if using parcel polygon for tighter envelope; parcel centroid from building geometry is sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ArcGIS REST layer 0 query | WMS GetFeatureInfo | WMS has MaxScaleDenominator constraint making bbox calculation error-prone; REST is cleaner |
| Envelope (bbox) ±25m buffer | Point geometry query | Point queries returned 0 features even when inside a polygon (edge case); envelope is more reliable |
| get_cached_or_fetch() | Custom JSONB cache | Consistent with all other government API cache patterns in codebase |

**Installation:**
No new packages required. All dependencies already in `backend/pyproject.toml`.

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── government_apis/
│   └── bodemloket_arcgis.py          # NEW: ArcGIS REST client for WBB_locaties
├── schemas/
│   └── bodem.py                       # NEW: BodemData, WBBDossierRef schemas
├── services/
│   └── bodem_aggregator.py            # NEW: fetch_bodem_data() with caching
└── schemas/property.py               # MODIFY: add bodem_data field to PropertyReportResponse

frontend/src/
├── components/reports/
│   └── BodemSection.tsx               # NEW: 3-state render component
└── lib/types/property.ts             # MODIFY: add BodemData + WBBDossierRef types
```

### Pattern 1: ArcGIS REST Spatial Query Client

**What:** Spatial intersection query using envelope geometry against WBB_locaties (layer 0).
**When to use:** Given RD centroid (x, y) from parcel, build ±25m envelope, query for intersecting WBB polygons.

**Confirmed live URL:**
```
https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer/0/query
```

**Confirmed live field names (from live API probe 2026-03-02):**
```
WBB_DOSSIER_DBK     (esriFieldTypeOID)      — dossier primary key (integer)
SIKB_ID             (esriFieldTypeString)    — SIKB identification number
NEN3610_ID_SOIL_LOCATION   (esriFieldTypeString)
NEN3610_ID_SOIL_MANAGEMENT (esriFieldTypeString)
LOCATIECODE_BEVOEGD_GEZAG  (esriFieldTypeString)   — competent authority code
BIS_LOCCODE         (esriFieldTypeString)    — BIS location code
TYPE_CD             (esriFieldTypeString)    — contamination type code (1-23)
VERVOLG_WBB         (esriFieldTypeString)    — follow-up status (e.g. "voldoende onderzocht")
STATUSVER           (esriFieldTypeString)    — sanering status (often null)
STATUS_OORD         (esriFieldTypeString)    — contamination verdict (e.g. "niet ernstig, licht tot matig verontreinigd")
ADMINISTRATOR_NM    (esriFieldTypeString)    — name of competent authority
```

**Example query (tested live):**
```python
# Build envelope ±25m around parcel centroid
buffer = 25
bbox = f"{x - buffer},{y - buffer},{x + buffer},{y + buffer}"
url = (
    "https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1"
    "/MapServer/0/query"
)
params = {
    "geometry": bbox,
    "geometryType": "esriGeometryEnvelope",
    "inSR": "28992",
    "spatialRel": "esriSpatialRelIntersects",
    "outFields": "WBB_DOSSIER_DBK,SIKB_ID,TYPE_CD,VERVOLG_WBB,STATUSVER,STATUS_OORD,ADMINISTRATOR_NM,LOCATIECODE_BEVOEGD_GEZAG,BIS_LOCCODE",
    "returnGeometry": "false",
    "f": "geojson",
}
```

**Live response example (confirmed 2026-03-02):**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "properties": {
        "WBB_DOSSIER_DBK": 17892535,
        "SIKB_ID": "0200880020071119121157056",
        "TYPE_CD": "20",
        "VERVOLG_WBB": "voldoende onderzocht",
        "STATUSVER": null,
        "STATUS_OORD": "niet ernstig, plaatselijk sterk verontreinigd",
        "ADMINISTRATOR_NM": "Schiermonnikoog",
        "LOCATIECODE_BEVOEGD_GEZAG": "FR008800069",
        "BIS_LOCCODE": "NZ008800004"
      }
    }
  ]
}
```

**Empty result (clean/unregistered parcel):**
```json
{ "type": "FeatureCollection", "features": [] }
```

### Pattern 2: Cache Manager Integration

**What:** 30-day JSONB cache using existing `get_cached_or_fetch()` + `CACHE_TTL` dict.
**When to use:** Always — one cache entry per parcel centroid (rounded to nearest meter).

**Cache key format:** `"bodemloket:rd:{x_rounded}:{y_rounded}"`

Add to `backend/app/core/config.py`:
```python
CACHE_TTL = {
    ...
    "bodemloket": 2592000,   # 30 days (soil contamination status changes rarely)
}
```

The `get_cached_or_fetch()` function serializes the `fetch_fn` return value as JSON into `CachedAPIResponse.response_data` (JSONB). The fetch function must return a `dict`. For Bodemloket, serialize the BodemData as `bodem_data.model_dump()`.

### Pattern 3: Three-State Contract for Empty Results

The Bodemloket's "no records" state is semantically different from an error. Follow the established three-state contract:

```
fetch_bodem_data() returns:
  BodemData with dossiers=[]   → "geen geregistreerde verontreiniging" (must show disclaimer)
  BodemData with dossiers=[..]  → show dossier references
  raises GovernmentAPIError     → error state (not "clean ground")
```

**CRITICAL:** Never display an empty result as "schone grond" or "geen verontreiniging". The required disclaimer text (from BODEM-03): "Bodemloket bevat niet alle locaties in Nederland. Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."

### Pattern 4: Aggregator Wiring

Bodemloket fetch goes in the parallel `asyncio.gather()` block in `property_aggregator.py`, alongside zoning, monuments, energy_label, woz. It requires RD coordinates (from building geometry) — same dependency as monuments.

```python
# In aggregate_property_data(), add to parallel gather:
results = await asyncio.gather(
    fetch_cadastral_parcels(),
    fetch_zoning(),
    fetch_monuments(),
    fetch_energy_label(),
    fetch_woz_data(),
    fetch_market_data(),
    fetch_bodem_data(),      # NEW: index 6
    return_exceptions=True,
)
```

### Pattern 5: Frontend Section Component

Follows the WkbClassificatieSection 3-state pattern from `ReportDetailPage.tsx`:

```tsx
function BodemSection({ data }: { data: PropertyReportResponse }) {
  const bodem = data.bodem_data

  if (!bodem) {
    // coordinates unavailable
    return (
      <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
        <p className="text-sm text-grey-600">Bodemdata niet beschikbaar</p>
      </Section>
    )
  }

  if (bodem.dossiers.length === 0) {
    // No records found — MUST show disclaimer
    return (
      <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
        <p className="text-sm text-grey-400">Geen geregistreerde verontreiniging gevonden</p>
        <p className="text-[11px] text-grey-600 mt-2">{bodem.disclaimer}</p>
      </Section>
    )
  }

  // Records found
  return (
    <Section title="Bodemkwaliteit" icon={<BodemIcon />}>
      {bodem.dossiers.map(d => <WBBDossierRow key={d.wbb_dossier_dbk} dossier={d} />)}
      <p className="text-[11px] text-grey-600 mt-2">{bodem.disclaimer}</p>
    </Section>
  )
}
```

### Anti-Patterns to Avoid

- **Point geometry query:** Live testing showed that querying with `esriGeometryPoint` at exact parcel centroid returned 0 features even when inside a polygon. Use `esriGeometryEnvelope` with ±25m buffer instead.
- **Old gdngeoservices.nl URL:** `www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer` returns 404. Use `gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer`.
- **WMS GetFeatureInfo for parcel queries:** WBB_locaties layer has `MaxScaleDenominator=100000` in WMS — requires tiny BBOX to satisfy scale constraint. The REST query is simpler.
- **Interpreting empty results as clean ground:** BODEM-03 explicitly forbids this. Always show the coverage disclaimer.
- **Displaying "schone grond":** Never use this term. Use "Geen geregistreerde verontreiniging gevonden".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom throttle | `APIRateLimiter` from `rate_limiter.py` | Pattern already in every API client |
| Cache management | Custom DB writes | `get_cached_or_fetch()` from `cache_manager.py` | TTL, upsert, and org isolation handled |
| HTTP retries | Custom retry loop | `retry_with_backoff()` from `base.py` | 429-aware, handles 5xx when `retry_on_errors=True` |
| Coordinate transform | Custom math | `rd_to_wgs84()` from `rce_monuments.py` (already imported in aggregator) | pyproj-backed, module-level singleton |
| HTTP client lifecycle | Per-request clients | Shared `httpx.AsyncClient` passed to all APIs | Connection pooling, keep-alive |

## Common Pitfalls

### Pitfall 1: ArcGIS REST Returns 400 for f=json on MapServer root
**What goes wrong:** `GET /MapServer?f=json` returns an HTML error page (400 status from ArcGIS Server).
**Why it happens:** The `gis.gdngeoservices.nl` server only accepts `?f=json` on the layer query endpoint, not the MapServer root.
**How to avoid:** Only use `?f=json` or `?f=geojson` on the `/0/query` endpoint, not on `/MapServer` root.
**Warning signs:** Response contains `<html>` instead of JSON.

### Pitfall 2: Empty FeatureCollection is Not an Error
**What goes wrong:** Treating empty `{"type": "FeatureCollection", "features": []}` as a failure.
**Why it happens:** Most parcels have no WBB records — this is a normal state.
**How to avoid:** Only raise `GovernmentAPIError` on HTTP errors (non-200 status). Parse the features list and return `BodemData(dossiers=[])` for empty.

### Pitfall 3: Cache Key Must Use Rounded Coordinates
**What goes wrong:** Using float coordinates directly in cache key (e.g. `bodemloket:rd:121234.567:487654.321`) — same parcel hits different cache entries due to floating point variance.
**Why it happens:** Centroids computed from different geometry representations can differ by fractions.
**How to avoid:** Round x, y to nearest integer: `cache_key = f"bodemloket:rd:{round(x)}:{round(y)}"`.

### Pitfall 4: Spike Plan Must Precede Client Code
**What goes wrong:** Writing client code based on assumed field names, discovering discrepancies at integration time.
**Why it happens:** The research already confirmed live field names, but Plan 68-01 (spike) must document this formally and verify the query format against a real property address (with known RD coordinates from the propdex stack).
**How to avoid:** Plan 68-01 spike explicitly runs the query with a known address from the test DB and records actual field values in a `.planning/phases/68-bodemloket-integration/SPIKE.md` artifact.

### Pitfall 5: Beschikbaarheid_gegevens Layer Indicates Incomplete Coverage
**What goes wrong:** Not communicating that Bodemloket data coverage varies by gemeente.
**Why it happens:** Bodemloket's "Beschikbaarheid_gegevens" layer (id=1) shows which autoriteiten have shared their data. Coverage is NOT national.
**How to avoid:** The disclaimer text in BodemData must always note incomplete coverage. Consider querying Beschikbaarheid_gegevens to surface whether the queried gemeente has shared data at all (optional enhancement, not MVP).

## Code Examples

Verified patterns from live API probe:

### Client: Spatial Query for WBB Dossiers
```python
"""bodemloket_arcgis.py — ArcGIS REST client for Bodemloket WBB_locaties."""

import logging
import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import bodemloket_limiter  # add to rate_limiter.py
from app.schemas.bodem import BodemData, WBBDossierRef

logger = logging.getLogger(__name__)

BASE_URL = (
    "https://gis.gdngeoservices.nl/standalone/rest/services"
    "/blk_gdn/lks_blk_rd_v1/MapServer/0/query"
)
DISCLAIMER = (
    "Bodemloket bevat niet alle locaties in Nederland. "
    "Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."
)

class BodemloketClient:
    """Client for Bodemloket ArcGIS REST API — WBB_locaties layer."""

    async def query_by_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
        buffer_m: float = 25.0,
    ) -> BodemData:
        """Query WBB dossiers intersecting a ±buffer_m envelope around (x, y) in RD.

        Returns:
            BodemData with dossiers=[] if no records found (normal for most parcels).

        Raises:
            GovernmentAPIError: On HTTP errors or unexpected response format.
        """
        bbox = f"{x - buffer_m},{y - buffer_m},{x + buffer_m},{y + buffer_m}"
        params = {
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "28992",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": (
                "WBB_DOSSIER_DBK,SIKB_ID,TYPE_CD,VERVOLG_WBB,"
                "STATUSVER,STATUS_OORD,ADMINISTRATOR_NM,"
                "LOCATIECODE_BEVOEGD_GEZAG,BIS_LOCCODE"
            ),
            "returnGeometry": "false",
            "f": "geojson",
        }

        async with bodemloket_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=30.0),
                source="bodemloket",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "bodemloket",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except ValueError as e:
            raise GovernmentAPIError("bodemloket", "Invalid JSON response") from e

        features = data.get("features", [])
        dossiers = []
        for feat in features:
            props = feat.get("properties", {})
            dossiers.append(WBBDossierRef(
                wbb_dossier_dbk=props.get("WBB_DOSSIER_DBK"),
                sikb_id=props.get("SIKB_ID"),
                type_cd=props.get("TYPE_CD"),
                vervolg_wbb=props.get("VERVOLG_WBB"),
                statusver=props.get("STATUSVER"),
                status_oord=props.get("STATUS_OORD"),
                administrator_nm=props.get("ADMINISTRATOR_NM"),
                locatiecode_bevoegd_gezag=props.get("LOCATIECODE_BEVOEGD_GEZAG"),
                bis_loccode=props.get("BIS_LOCCODE"),
            ))

        return BodemData(
            dossiers=dossiers,
            queried_at=None,  # aggregator fills this
            disclaimer=DISCLAIMER,
        )


bodemloket_client = BodemloketClient()
```

### Schema: BodemData + WBBDossierRef
```python
"""backend/app/schemas/bodem.py"""

from pydantic import BaseModel, Field

class WBBDossierRef(BaseModel):
    """Single WBB dossier reference from Bodemloket ArcGIS REST."""
    wbb_dossier_dbk: int | None = Field(default=None, description="Unique dossier OID")
    sikb_id: str | None = Field(default=None, description="SIKB identification number")
    type_cd: str | None = Field(default=None, description="Contamination type code")
    vervolg_wbb: str | None = Field(default=None, description="Follow-up status (e.g. 'voldoende onderzocht')")
    statusver: str | None = Field(default=None, description="Sanering/remediation status")
    status_oord: str | None = Field(default=None, description="Contamination verdict")
    administrator_nm: str | None = Field(default=None, description="Competent authority name")
    locatiecode_bevoegd_gezag: str | None = Field(default=None, description="Authority location code")
    bis_loccode: str | None = Field(default=None, description="BIS location code")

class BodemData(BaseModel):
    """Aggregated soil contamination data from Bodemloket. Phase 9 (v9.0)."""
    dossiers: list[WBBDossierRef] = Field(
        default_factory=list,
        description="WBB dossiers intersecting the parcel — empty list = geen geregistreerde verontreiniging",
    )
    disclaimer: str = Field(
        default=(
            "Bodemloket bevat niet alle locaties in Nederland. "
            "Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."
        ),
    )
```

### Cache Key and TTL
```python
# In config.py CACHE_TTL dict, add:
"bodemloket": 2592000,   # 30 days

# In bodem_aggregator.py fetch_bodem_data():
cache_key = f"bodemloket:rd:{round(x)}:{round(y)}"
```

### Rate Limiter
```python
# In rate_limiter.py, add:
# Bodemloket (Rijkswaterstaat / ArcGIS) — public endpoint, polite limits
bodemloket_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

### PropertyReportResponse extension
```python
# In backend/app/schemas/property.py:
from app.schemas.bodem import BodemData

class PropertyReportResponse(BaseModel):
    ...
    # Phase 9 additions (v9.0)
    wkb_classification: WkbClassification | None = ...
    asbest_indicator: AsbestIndicator | None = ...
    bodem_data: BodemData | None = Field(
        default=None,
        description="Bodemkwaliteit data from Bodemloket (WBB dossiers)",
    )
```

### Frontend TypeScript Types
```typescript
// In frontend/src/lib/types/property.ts:

export interface WBBDossierRef {
  wbb_dossier_dbk: number | null
  sikb_id: string | null
  type_cd: string | null
  vervolg_wbb: string | null
  statusver: string | null
  status_oord: string | null
  administrator_nm: string | null
  locatiecode_bevoegd_gezag: string | null
  bis_loccode: string | null
}

export interface BodemData {
  dossiers: WBBDossierRef[]
  disclaimer: string
}

// Add to PropertyReportResponse:
bodem_data?: BodemData | null
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `www.gdngeoservices.nl/arcgis/rest/...` | `gis.gdngeoservices.nl/standalone/rest/...` | Pre-2024 (confirmed 404 in research) | Must use new URL |
| WMS GetFeatureInfo for feature data | ArcGIS REST query endpoint | Post-2019 | REST is more reliable, returns structured GeoJSON |
| Point geometry query | Envelope (bbox) query | Research finding | Point queries return 0 features even when inside polygon |

**Deprecated/outdated:**
- `www.gdngeoservices.nl/arcgis/rest/services/blk/lks_blk_rd/MapServer`: Returns 404. The 2019 blog posts reference this dead URL.

## Open Questions

1. **Spike Plan 68-01: Is the buffer size optimal?**
   - What we know: ±25m envelope returned 2 features in Schiermonnikoog area test.
   - What's unclear: For dense urban parcels, a 25m buffer may over-extend into adjacent parcels. For small parcels, it may be fine.
   - Recommendation: Plan 68-01 spike should test with both ±25m and ±10m against a known contaminated property in the Netherlands. Use ±25m as default; make buffer a named constant.

2. **Beschikbaarheid_gegevens layer: Query it too?**
   - What we know: Layer 1 has `AUTHORITY_NM`, `WEBSITE_BLN`, `DOSSIER_BLN`, `WEBSITE_URL` fields that indicate whether the gemeente has shared data with Bodemloket.
   - What's unclear: Whether showing "data not available in Bodemloket for this municipality" is useful vs. confusing.
   - Recommendation: Skip for MVP (Plan 68-02). The global disclaimer covers this. Can be added later.

3. **TYPE_CD domain values:**
   - What we know: TYPE_CD has 24 distinct values (1-23 plus null), confirmed from `returnDistinctValues=true` query.
   - What's unclear: The meaning of each TYPE_CD code (not documented in the ArcGIS service metadata).
   - Recommendation: Do not attempt to decode TYPE_CD in MVP. Surface the raw string. This can be enriched later if RIVM/Rijkswaterstaat provides a domain codelist.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `cd backend && python -m pytest tests/unit/test_bodemloket_client.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |
| Estimated runtime | ~3 seconds (unit), ~60 seconds (full suite) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BODEM-01 | `query_by_point()` returns BodemData with list | unit (mock httpx) | `pytest tests/unit/test_bodemloket_client.py -x` | Wave 0 gap |
| BODEM-01 | `fetch_bodem_data()` calls client and caches result | unit (mock client + DB) | `pytest tests/unit/test_bodem_aggregator.py -x` | Wave 0 gap |
| BODEM-01 | Second call within 30 days uses cache (no HTTP) | unit | `pytest tests/unit/test_bodem_aggregator.py::test_cache_hit -x` | Wave 0 gap |
| BODEM-02 | `BodemData.dossiers` contains WBBDossierRef with correct fields | unit | `pytest tests/unit/test_bodemloket_client.py::test_parse_features -x` | Wave 0 gap |
| BODEM-02 | `PropertyReportResponse` includes `bodem_data` field | unit | `pytest tests/unit/test_bodemloket_client.py::test_schema -x` | Wave 0 gap |
| BODEM-03 | Empty features list → `BodemData(dossiers=[])` (not error) | unit | `pytest tests/unit/test_bodemloket_client.py::test_empty_returns_bodemdata` | Wave 0 gap |
| BODEM-03 | `BodemData.disclaimer` is always non-empty | unit | `pytest tests/unit/test_bodemloket_client.py::test_disclaimer_always_present` | Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task → run: `cd backend && python -m pytest tests/unit/test_bodemloket_client.py -x -q`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~3 seconds (unit only)

### Wave 0 Gaps (must be created before implementation)
- [ ] `backend/tests/unit/test_bodemloket_client.py` — covers BODEM-01 (query method), BODEM-02 (field parsing), BODEM-03 (empty result + disclaimer)
- [ ] `backend/tests/unit/test_bodem_aggregator.py` — covers BODEM-01 (caching), BODEM-02 (aggregator wiring)

*(Frontend BodemSection is visual-only — no automated test; verified manually in browser)*

## Sources

### Primary (HIGH confidence)
- Live WMS GetCapabilities — `https://gis.gdngeoservices.nl/standalone/services/blk_gdn/lks_blk_rd_v1/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities` — layers, CRS support confirmed 2026-03-02
- Live ArcGIS REST MapServer — `https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer?f=json` returned ArcGIS Server 11.5, layers list confirmed 2026-03-02
- Live ArcGIS REST layer 0 metadata — field names confirmed from `https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer/0?f=json` 2026-03-02
- Live ArcGIS REST query — Envelope query returned 2 live WBB features with field values confirmed 2026-03-02
- Live WBB feature geometry — OID 17892511 confirmed polygon geometry with ring coordinates in EPSG:28992

### Secondary (MEDIUM confidence)
- Bodemloket FAQ page `https://www.bodemloket.nl/content/kan-ik-bodemloket-ook-mijn-gis-inladen` — WMS endpoints confirmed
- Bodemloket FAQ `https://bodemloket.nl/faq-page` — coverage limitations confirmed

### Tertiary (LOW confidence)
- De Friese Woudloper blog (2019) `http://www.friesewoudloper.nl/2019/05/30/Hergebruik-van-bodemkwaliteitsgegevens.html` — old URL now 404; field names align with current API but blog is from 2019

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in pyproject.toml, no new deps
- Architecture: HIGH — live field names confirmed, URL confirmed working, envelope approach tested
- Pitfalls: HIGH — point query failure observed live; old URL failure observed live
- Frontend: HIGH — follows WkbClassificatieSection pattern directly, no new patterns needed

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — ArcGIS REST endpoint is stable, cert valid to May 2026)
