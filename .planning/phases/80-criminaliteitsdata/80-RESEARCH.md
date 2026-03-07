# Phase 80: Criminaliteitsdata - Research

**Researched:** 2026-03-07
**Domain:** CBS OData v3 API (dataderden.cbs.nl, dataset 47018NED), crime data modeling, frontend card components
**Confidence:** HIGH

## Summary

Phase 80 adds crime statistics to the wijk detail view by querying CBS dataset 47018NED ("Geregistreerde misdrijven; soort misdrijf, wijk, buurt, jaarcijfers") on `dataderden.cbs.nl`. This is a **different API** than the existing CBSODataClient uses. The existing client targets OData v4 on `datasets.cbs.nl/odata/v1/CBS/` with Observations/MeasureCodes entities. Dataset 47018NED lives on `dataderden.cbs.nl/ODataApi/odata/` and uses OData v3 with a `TypedDataSet` entity, space-padded keys, and a fundamentally different query structure.

The dataset contains absolute crime counts (GeregistreerdeMisdrijven_1) per crime type per wijk per year, covering 2012-2025 (last updated February 2026). Since the requirement asks for "misdrijven per 1000 inwoners", we must compute this by dividing crime counts by the `aantal_inwoners` value already available in `neighborhood_metrics.data.demografie.aantal_inwoners` from the Kerncijfers dataset (fetched in the same scan job).

The OData v3 protocol differences are manageable: no `$select` restriction needed (TypedDataSet has fixed columns), three filter dimensions (SoortMisdrijf, WijkenEnBuurten, Perioden), and space-padded key values. A dedicated `CbsCrimeClient` class (separate from `CBSODataClient`) is the cleanest approach since the base URL, protocol version, entity structure, and query patterns are all different.

**Primary recommendation:** Create a standalone `CbsCrimeClient` in `government_apis/cbs_crime.py` that queries dataderden.cbs.nl OData v3 for crime totals + 3 category breakdowns, computes per-1000 rates using existing inwoners data, stores in `neighborhood_metrics["criminaliteit"]`, and build a `CriminaliteitCard` frontend component following the NabijheidCard pattern.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRIME-01 | OData v3 client voor dataderden.cbs.nl (47018NED) met rate limiter en retry patronen | dataderden.cbs.nl OData v3 endpoint verified live. TypedDataSet entity confirmed. Space-padded keys documented. Existing retry_with_backoff and APIRateLimiter patterns can be reused |
| CRIME-02 | Wijk detail toont totale misdrijven per 1000 inwoners + uitsplitsing (vermogensdelicten, vernieling, geweld) | Crime type codes mapped: totaal=0.0.0, vermogensdelicten=sum of 1.1.x+1.2.x+1.6.2, vernieling=2.2.1, geweld=sum of 1.4.3+1.4.4+1.4.5+1.4.6+1.4.7. Per-1000 computation uses existing inwoners count from Kerncijfers |
| CRIME-03 | Criminaliteitsdata opgeslagen in neighborhood_metrics JSONB onder "criminaliteit" key | Same JSONB merge pattern as nabijheid (Phase 79). Store as sibling key with dict reconstruction for SQLAlchemy dirty tracking |
</phase_requirements>

## Standard Stack

### Core (already installed -- zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | existing | HTTP requests to dataderden.cbs.nl | Already used by all government API clients |
| aiolimiter | existing | Rate limiting | Already used via APIRateLimiter |
| SQLAlchemy 2.x | existing | JSONB storage in AreaScan | Already in use |
| React | 19.x | Frontend card component | Already in use |
| Tailwind CSS | 4.x | Styling | Already in use |

### No New Dependencies
This phase requires zero new pip or npm packages.

## Architecture Patterns

### Backend: Separate CbsCrimeClient (NOT extending CBSODataClient)

The dataderden.cbs.nl OData v3 protocol is fundamentally different from the datasets.cbs.nl OData v4 protocol used by the existing `CBSODataClient`. Key differences:

| Aspect | OData v4 (existing) | OData v3 (47018NED) |
|--------|---------------------|---------------------|
| Base URL | `datasets.cbs.nl/odata/v1/CBS` | `dataderden.cbs.nl/ODataApi/odata` |
| Entity | `Observations` (one row per measure) | `TypedDataSet` (one row per crime type + region + period) |
| Value column | `Value` + `Measure` code | `GeregistreerdeMisdrijven_1` (single column) |
| Key format | No padding | Space-padded to fixed width (10 chars for WK, 6 for SoortMisdrijf, 8 for Perioden) |
| Region lookup | `WijkenEnBuurtenCodes` entity | `WijkenEnBuurten` entity (different field names) |
| Filter pattern | `Measure eq 'code'` | `SoortMisdrijf eq 'code  '` (padded) |

**Create `backend/app/government_apis/cbs_crime.py`** with a `CbsCrimeClient` class that:
1. Uses the dataderden.cbs.nl base URL
2. Handles space-padded key values
3. Queries TypedDataSet with SoortMisdrijf + WijkenEnBuurten + Perioden filters
4. Reuses existing `retry_with_backoff` and `GovernmentAPIError` from `base.py`
5. Registers its own rate limiter singleton in `rate_limiter.py`

```python
CRIME_BASE_URL = "https://dataderden.cbs.nl/ODataApi/odata/47018NED"

# Crime type codes (space-padded to 6 chars for OData v3 filter matching)
CRIME_CODES: dict[str, str] = {
    "totaal": "0.0.0 ",
    # Vermogensdelicten (property crimes - aggregate subcategories)
    "diefstal_woning": "1.1.1 ",
    "diefstal_inbraak_schuur": "1.1.2 ",
    "diefstal_motorvoertuigen_uit": "1.2.1 ",
    "diefstal_motorvoertuigen_van": "1.2.2 ",
    "diefstal_fietsen": "1.2.3 ",
    "zakkenrollerij": "1.2.4 ",
    "overige_vermogensdelicten": "1.6.2 ",
    # Vernieling
    "vernieling": "2.2.1 ",
    # Geweldsdelicten
    "openlijk_geweld": "1.4.3 ",
    "bedreiging": "1.4.4 ",
    "mishandeling": "1.4.5 ",
    "straatroof": "1.4.6 ",
    "overval": "1.4.7 ",
}
```

### Backend: WijkenEnBuurten Lookup for OData v3

The v3 WijkenEnBuurten entity uses space-padded keys. To find a wijk, filter with `startswith(Key, 'WK{gemeente_code}')` and match by Title.

```python
async def _resolve_wijk_key(
    self,
    client: httpx.AsyncClient,
    gemeente_code: str,
    wijk_naam: str,
) -> str | None:
    """Resolve wijk name to space-padded WijkenEnBuurten Key."""
    url = f"{CRIME_BASE_URL}/WijkenEnBuurten"
    params = {
        "$filter": f"startswith(Key, 'WK{gemeente_code}')",
        "$format": "json",
    }
    # ... match Title, return Key (e.g., "WK098311  ")
```

**Critical: Space-padded key gotcha.** All filter values must include trailing spaces to match. WK keys are 10 chars (e.g., `"WK098311  "`), SoortMisdrijf keys are 6 chars (e.g., `"0.0.0 "`), Perioden keys are 8 chars (e.g., `"2024JJ00"` -- no padding needed).

### Backend: TypedDataSet Query

Query multiple crime types for a wijk in the most recent year:

```python
async def get_crime_data(
    self,
    client: httpx.AsyncClient,
    gemeente_code: str,
    wijk_naam: str | None = None,
    inwoners: float | None = None,
) -> dict | None:
    """Fetch crime data and compute per-1000 rates."""
    wijk_key = await self._resolve_wijk_key(client, gemeente_code, wijk_naam)
    if not wijk_key:
        return None

    # Build filter for all crime codes
    crime_filter = " or ".join(
        f"SoortMisdrijf eq '{code}'" for code in CRIME_CODES.values()
    )
    params = {
        "$filter": f"WijkenEnBuurten eq '{wijk_key}' and Perioden eq '{LATEST_PERIOD}' and ({crime_filter})",
        "$format": "json",
    }
    url = f"{CRIME_BASE_URL}/TypedDataSet"
    # ... parse GeregistreerdeMisdrijven_1 values
```

### Backend: Per-1000 Inwoners Computation

The TypedDataSet returns absolute counts. The requirement asks for "misdrijven per 1000 inwoners". Compute this using the `aantal_inwoners` already in `neighborhood_metrics`:

```python
def _per_1000(count: int | None, inwoners: float | None) -> float | None:
    """Compute crimes per 1000 residents."""
    if count is None or inwoners is None or inwoners <= 0:
        return None
    return round(count / inwoners * 1000, 1)
```

The `inwoners` value comes from the Kerncijfers fetch that runs earlier in the same scan job. Pass it into `get_crime_data()` or compute the ratio after both fetches complete.

### Backend: JSONB Storage Pattern

Same pattern as nabijheid (Phase 79):

```python
# After fetching crime data in area_scan.py job:
if crime_data:
    if scan.neighborhood_metrics:
        scan.neighborhood_metrics = {
            **scan.neighborhood_metrics,
            "criminaliteit": crime_data,
        }
    else:
        scan.neighborhood_metrics = {"criminaliteit": crime_data}
```

The criminaliteit payload structure:
```python
{
    "bron": "CBS Politie dataderden OData v3",
    "dataset": "47018NED",
    "peiljaar": 2024,
    "totaal_misdrijven": 1115,
    "per_1000_inwoners": 52.3,
    "categorien": {
        "vermogensdelicten": {
            "aantal": 385,
            "per_1000": 18.1,
        },
        "vernieling": {
            "aantal": 145,
            "per_1000": 6.8,
        },
        "geweld": {
            "aantal": 210,
            "per_1000": 9.9,
        },
    },
}
```

### Frontend: CriminaliteitCard Component

Follow the exact same card pattern as NabijheidCard:

```typescript
// New interface in scan.ts
export interface CbsCriminaliteit {
  bron: string
  dataset: string
  peiljaar: number
  totaal_misdrijven: number | null
  per_1000_inwoners: number | null
  categorien: {
    vermogensdelicten: { aantal: number | null; per_1000: number | null }
    vernieling: { aantal: number | null; per_1000: number | null }
    geweld: { aantal: number | null; per_1000: number | null }
  }
}

// Extend CbsNeighborhoodMetrics
export interface CbsNeighborhoodMetrics {
  // ... existing fields
  nabijheid?: CbsNabijheid
  criminaliteit?: CbsCriminaliteit  // NEW
}
```

Color coding for crime rates (per 1000 inwoners):
- Green: < 30 (low crime)
- Amber: 30-60 (moderate)
- Red: > 60 (high crime)

These thresholds are based on Dutch national averages (~45 per 1000 in 2024).

### Integration: WijkDetailView

Add CriminaliteitCard after NabijheidCard in WijkDetailView:

```tsx
{(latestScan.neighborhood_metrics as CbsNeighborhoodMetrics | undefined)?.criminaliteit && (
    <CriminaliteitCard
        criminaliteit={(latestScan.neighborhood_metrics as CbsNeighborhoodMetrics).criminaliteit!}
    />
)}
```

### Anti-Patterns to Avoid

- **Do NOT extend CBSODataClient** -- the v3 protocol is fundamentally different. A separate client class is cleaner and avoids polluting the v4 client with v3 quirks.
- **Do NOT forget space-padding on filter keys** -- `SoortMisdrijf eq '0.0.0'` returns empty results. Must be `SoortMisdrijf eq '0.0.0 '` (with trailing space).
- **Do NOT store raw absolute counts without per-1000 computation** -- the requirement explicitly asks for "per 1000 inwoners" and the Phase 81 score engine expects normalized rates.
- **Do NOT query all 61 crime categories** -- only fetch the ~13 codes needed for totaal + 3 category breakdowns. Reduces API payload and simplifies storage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting for dataderden.cbs.nl | Custom throttling | APIRateLimiter singleton in rate_limiter.py | Consistent pattern across all government APIs |
| Retry with backoff | Custom retry loop | `retry_with_backoff()` from base.py | Handles 429 and 5xx with exponential backoff |
| JSONB dirty tracking | Manual flag_modified | Dict reconstruction (`{**old, "criminaliteit": new}`) | Already proven in Phase 79 nabijheid storage |
| Crime category aggregation | Per-subcategory frontend math | Backend aggregation before storage | Simpler frontend, consistent storage, score engine consumes clean data |

## Common Pitfalls

### Pitfall 1: Space-Padded Key Values (OData v3)
**What goes wrong:** Filters return empty results because key values are not padded correctly.
**Why it happens:** OData v3 on dataderden.cbs.nl uses fixed-width string keys with trailing spaces. WijkenEnBuurten keys are 10 chars, SoortMisdrijf keys are 6 chars.
**How to avoid:** Pad all filter values to the correct width. Use a helper function:
```python
def _pad_key(value: str, width: int) -> str:
    return value.ljust(width)
```
**Warning signs:** Empty `value` arrays in API responses despite valid-looking parameters.

### Pitfall 2: Latest Period Discovery
**What goes wrong:** Hardcoding `2024JJ00` breaks when data is updated to 2025.
**Why it happens:** CBS updates this dataset annually (last update Feb 2026 added 2025 data). The latest period changes without notice.
**How to avoid:** Fetch the Perioden entity first and use the maximum year, OR hardcode `2024JJ00` initially and make it configurable via env var. The Perioden entity is small (14 records) and can be fetched once per client initialization.
**Warning signs:** Empty results after CBS publishes new year data.

### Pitfall 3: Per-1000 Computation Division by Zero
**What goes wrong:** Division error when inwoners count is 0 or None.
**Why it happens:** Some wijken have very small populations or missing Kerncijfers data.
**How to avoid:** Guard with `if inwoners is None or inwoners <= 0: return None`. The frontend already handles null values with `--` display.

### Pitfall 4: Wijk Key Mismatch Between Datasets
**What goes wrong:** Wijk found in Kerncijfers (86165NED) but not in crime dataset (47018NED), or vice versa.
**Why it happens:** The two datasets use different reference years. Kerncijfers 86165NED uses 2025 boundaries, while 47018NED may still use 2024 boundaries for the 2024 data.
**How to avoid:** Resolve the wijk identifier from the crime dataset's own WijkenEnBuurten entity (not from the cached Kerncijfers identifier). Fall back to gemeente-level if wijk not found.

### Pitfall 5: $format=json Required for OData v3
**What goes wrong:** Response returns XML instead of JSON.
**Why it happens:** OData v3 on dataderden.cbs.nl defaults to Atom/XML. Unlike v4 which respects Accept headers, v3 requires explicit `$format=json` query parameter.
**How to avoid:** Always include `$format=json` in all requests to dataderden.cbs.nl.

## Code Examples

### Backend: Complete Crime Data Fetch
```python
# Source: Verified against live dataderden.cbs.nl OData v3 endpoint

CRIME_BASE_URL = "https://dataderden.cbs.nl/ODataApi/odata/47018NED"
LATEST_PERIOD = "2024JJ00"  # Most recent full-year data

# Crime type aggregation mapping
VERMOGENSDELICTEN_CODES = ["1.1.1 ", "1.1.2 ", "1.2.1 ", "1.2.2 ", "1.2.3 ", "1.2.4 ", "1.6.2 "]
VERNIELING_CODES = ["2.2.1 "]
GEWELD_CODES = ["1.4.3 ", "1.4.4 ", "1.4.5 ", "1.4.6 ", "1.4.7 "]
ALL_CODES = ["0.0.0 "] + VERMOGENSDELICTEN_CODES + VERNIELING_CODES + GEWELD_CODES

# TypedDataSet query
url = f"{CRIME_BASE_URL}/TypedDataSet"
crime_filter = " or ".join(f"SoortMisdrijf eq '{code}'" for code in ALL_CODES)
params = {
    "$filter": f"WijkenEnBuurten eq '{wijk_key}' and Perioden eq '{LATEST_PERIOD}' and ({crime_filter})",
    "$format": "json",
}
```

### Backend: Parsing TypedDataSet Response
```python
# Each row in TypedDataSet:
# {
#   "ID": 12345,
#   "SoortMisdrijf": "0.0.0 ",
#   "WijkenEnBuurten": "WK098311  ",
#   "Perioden": "2024JJ00",
#   "GeregistreerdeMisdrijven_1": 1115,
#   "Gemeentenaam_2": "",
#   "SoortRegio_3": ""
# }

# Parse response into code->count dict
crime_counts: dict[str, int | None] = {}
for row in response_data:
    code = row["SoortMisdrijf"]
    count = row.get("GeregistreerdeMisdrijven_1")
    crime_counts[code] = int(count) if count is not None else None

# Aggregate categories
vermogensdelicten = sum(
    crime_counts.get(c, 0) or 0
    for c in VERMOGENSDELICTEN_CODES
)
```

### Frontend: CriminaliteitCard Structure
```tsx
// Follow NabijheidCard pattern
const CATEGORIES: { key: string; label: string }[] = [
    { key: 'vermogensdelicten', label: 'Vermogensdelicten' },
    { key: 'vernieling', label: 'Vernieling' },
    { key: 'geweld', label: 'Geweldsdelicten' },
]

// Color thresholds for per-1000 rate
function crimeColor(per1000: number | null): string {
    if (per1000 == null) return 'text-grey-500'
    if (per1000 < 30) return 'text-green-400'
    if (per1000 <= 60) return 'text-amber-400'
    return 'text-red-400'
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single CBS OData v4 client | v4 for Kerncijfers/Nabijheid, v3 for crime data | Phase 80 | First v3 client in codebase -- separate class needed |
| Crime data on opendata.cbs.nl | Crime wijk data hosted on dataderden.cbs.nl | CBS decision (ongoing) | Different base URL, different protocol version |
| Manual period selection | Auto-detect latest period from Perioden entity | Phase 80 | Future-proofs against CBS annual updates |

## Open Questions

1. **Latest period auto-detection vs hardcoding**
   - What we know: 47018NED has data 2012-2025. CBS updates annually. 2024 is the most recent full-year "Definitief" data.
   - What's unclear: Whether 2025 data is marked Definitief yet or still Voorlopig (preliminary). Preliminary data may have lower quality.
   - Recommendation: Hardcode `2024JJ00` initially. Optionally add env var `CBS_CRIME_PERIOD` for easy update. A future enhancement could auto-detect the latest "Definitief" period.

2. **Vermogensdelicten definition scope**
   - What we know: CBS category 1.x covers diefstal/inbraak types. The requirement says "vermogensdelicten" which is a legal term covering theft, fraud, and related property crimes.
   - What's unclear: Whether to include ALL subcategories under 1.x (including straatroof which is also geweld), or only the pure property crimes.
   - Recommendation: Use 1.1.1, 1.1.2, 1.2.1-1.2.4, 1.6.2 for vermogensdelicten (pure property). Use 1.4.3-1.4.7 for geweld (violence). This avoids double-counting straatroof (1.4.6 is in geweld, not vermogen).

3. **Crime rate thresholds for color coding**
   - What we know: Dutch national average was ~45 per 1000 in 2024. Amsterdam wijken range 30-120+. Rural wijken can be <15.
   - What's unclear: Optimal threshold boundaries for green/amber/red in PropTech context.
   - Recommendation: Start with <30 green, 30-60 amber, >60 red. These can be tuned after user feedback.

## Sources

### Primary (HIGH confidence)
- dataderden.cbs.nl/ODataApi/odata/47018NED -- verified live: TypedDataSet, WijkenEnBuurten, SoortMisdrijf, Perioden entities confirmed
- dataderden.cbs.nl/ODataApi/odata/47018NED/Perioden -- 14 periods confirmed (2012-2025)
- dataderden.cbs.nl/ODataApi/odata/47018NED/SoortMisdrijf -- 61 crime types confirmed with exact key values and padding
- dataderden.cbs.nl/ODataApi/odata/47018NED/WijkenEnBuurten -- space-padded keys confirmed (10 chars for WK prefix)
- dataderden.cbs.nl/ODataApi/odata/47018NED/TypedDataSet -- verified query with WK098311 + 2024JJ00, returned crime counts
- Existing codebase: `backend/app/government_apis/cbs_odata.py` (CBSODataClient patterns, NOT to be extended)
- Existing codebase: `backend/app/government_apis/rate_limiter.py` (APIRateLimiter pattern)
- Existing codebase: `backend/app/government_apis/base.py` (retry_with_backoff, GovernmentAPIError)
- Existing codebase: `backend/app/jobs/area_scan.py` (neighborhood_metrics JSONB merge pattern)
- Existing codebase: `frontend/src/components/projects/NabijheidCard.tsx` (card UI pattern to follow)

### Secondary (MEDIUM confidence)
- [data.overheid.nl dataset page](https://data.overheid.nl/dataset/5252-geregistreerde-misdrijven--soort-misdrijf--wijk--buurt--jaarcijfers) -- confirmed dataset last updated Feb 2026, CC-BY 4.0 license
- [CBS misdrijven dashboard](https://www.cbs.nl/nl-nl/visualisaties/politie/dashboard-misdrijven-in-de-buurt/jaarcijfers) -- confirmed ~45 per 1000 national average for threshold calibration

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, reuses existing patterns
- Architecture: HIGH - OData v3 protocol verified live with actual queries against dataderden.cbs.nl
- Pitfalls: HIGH - space-padded keys, $format=json, per-1000 computation all verified against live API
- Crime category mapping: MEDIUM - vermogensdelicten scope is a judgment call (documented in Open Questions)

**Research date:** 2026-03-07
**Valid until:** 2026-09-07 (stable CBS dataset, annually updated)
