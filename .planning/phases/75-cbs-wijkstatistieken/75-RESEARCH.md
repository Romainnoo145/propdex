# Phase 75: CBS Wijkstatistieken - Research

**Researched:** 2026-03-06
**Domain:** CBS OData v4 API + Frontend neighborhood metrics display
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CBS-01 | Area scan results display neighborhood metrics (WOZ, stedelijkheid, demographics) in a dedicated card on the project/wijk detail view | Data already in `neighborhood_metrics` JSONB — only frontend `CbsNeighborhoodCard` component is missing; TypeScript interface needs narrowing from `Record<string, any>` |
| CBS-02 | CBS OData client uses v4 API with correct endpoint (`odata4.cbs.nl`), filter syntax (`contains()`), and year-aware dataset selection | Existing client uses deprecated v3 URL (`opendata.cbs.nl/ODataApi/OData`) and v3 entity (`TypedDataSet`); v4 uses `datasets.cbs.nl/odata/v1/CBS/` with `Observations` + `WijkenEnBuurtenCodes`; measure codes verified live for 86165NED (2025) |
| CBS-03 | CBS client follows established government API patterns (rate limiter, retry_with_backoff, timeout, proper error handling via GovernmentAPIError) | Existing client has no rate limiter, no explicit timeout, and no `retry_with_backoff` usage; pattern is established in `rate_limiter.py` and `base.py` |
</phase_requirements>

---

## Summary

Phase 75 has two distinct workstreams that can be planned independently: (1) a frontend-only display task (CBS-01) where data is already fetched and stored but never rendered, and (2) a backend CBS client rewrite (CBS-02, CBS-03) that migrates from the deprecated OData v3 endpoint to v4 and hardens the client with rate limiting and timeouts.

The CBS-01 display task is the faster win — zero backend changes, one new component (`CbsNeighborhoodCard.tsx`) plus a TypeScript interface narrowing in `scan.ts`. The data shape returned by the current client (field names, peiljaar, bron string) is already well-defined and stored in the `neighborhood_metrics` JSONB column. The component must handle partial data gracefully since CBS coverage for smaller wijken is incomplete.

The CBS-02/03 backend rewrite is the more significant work. The existing `CBSODataClient` uses the OData v3 URL (`opendata.cbs.nl/ODataApi/OData`) and queries `TypedDataSet` and `WijkenEnBuurten` — both are v3 entities that do not exist in v4. The v4 endpoint (`datasets.cbs.nl/odata/v1/CBS/`) uses `Observations` (long-format cell data) and `WijkenEnBuurtenCodes` for region lookup. The wijk identifier format is also different: v4 uses `WK098311` style (municipality code without GM prefix, plus 2-digit suffix), not the v3 `WK036300` style. The ambiguous wijk name lookup bug (Pitfall 5) must be fixed using `startswith(Identifier, 'WK{gemeente_code}')`. All measure codes for the 2025 dataset `86165NED` have been verified live and are identical to the 2024 dataset codes — no renaming occurred.

**Primary recommendation:** Plan CBS-01 (frontend display) as Wave 1 and CBS-02/03 (client rewrite + hardening) as Wave 2. CBS-01 is a ~1-hour frontend task with zero risk to the scan pipeline. CBS-02/03 rewrites a file called during ARQ area scans and requires careful testing.

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `httpx` | existing | CBS OData v4 HTTP requests | Already used by all government API clients in the project |
| `aiolimiter` | existing | CBS rate limiter token bucket | Used in `APIRateLimiter` in `rate_limiter.py` |
| `asyncio.Semaphore` | stdlib | Concurrency control inside `APIRateLimiter` | Already the established pattern |

### Frontend (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|-------------|
| TanStack Query | existing | CBS data already in scan response cache | Data flows through existing `useScanResults` hook infrastructure |
| Tailwind | existing | `CbsNeighborhoodCard` styling | Matches existing card components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `httpx` OData params | A CBS OData Python library | No maintained Python CBS library exists; manual params are 10 lines |
| `settings.CBS_DATASET_ID` config | Dynamic catalog lookup | Config is sufficient; catalog lookup adds complexity without user-visible benefit |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

No new directories. Files to create/modify:

```
backend/app/
├── government_apis/
│   ├── cbs_odata.py          # REWRITE — v4 endpoint, Observations entity, rate limiter, timeout
│   └── rate_limiter.py       # ADD cbs_odata_limiter singleton
├── core/
│   └── config.py             # ADD CBS_DATASET_ID setting (default "86165NED")

frontend/src/
├── lib/types/
│   └── scan.ts               # ADD CbsNeighborhoodMetrics interface, update ScanResultsResponse
└── components/projects/
    ├── CbsNeighborhoodCard.tsx  # NEW — renders neighborhood_metrics
    └── WijkDetailView.tsx       # MODIFY — mount CbsNeighborhoodCard between ScanSummarySection and JurisprudenceSection
```

### Pattern 1: CBS OData v4 Region Lookup (WijkenEnBuurtenCodes)

**What:** Look up wijk identifier by filtering `WijkenEnBuurtenCodes` with municipality code prefix, then find by name match in Python.

**When to use:** Any CBS region resolution from gemeente_code + wijk_naam.

**Critical discovery (verified live 2026-03-06):** The `gemeente_code` stored in `AreaScan` is the raw 4-digit format (e.g., `"0983"` for Venlo). CBS v4 wijk identifiers follow the pattern `WK{4-digit-code}{2-digit-suffix}` (e.g., `WK098311` for Venlo-Centrum). The filter to scope by municipality is:

```python
# Source: Verified live against https://datasets.cbs.nl/odata/v1/CBS/86165NED/WijkenEnBuurtenCodes
# gemeente_code is "0983" (raw 4-digit, no GM prefix)
params = {
    "$filter": f"startswith(Identifier, 'WK{gemeente_code}')",
    "$top": "50",
}
response = await client.get(
    f"{BASE_URL}/{dataset_id}/WijkenEnBuurtenCodes",
    headers=headers,
    params=params,
    timeout=10.0,
)
wijk_records = response.json().get("value", [])
# Filter in Python for exact wijk name match
match = next(
    (r for r in wijk_records if wijk_naam.lower() in r["Title"].lower()),
    None,
)
```

**Note:** For gemeente-level fallback (no wijk specified), filter `startswith(Identifier, 'GM{gemeente_code}')` and take the first result.

### Pattern 2: CBS OData v4 Observations Fetch

**What:** Fetch metric values for a specific wijk using the `Observations` entity with measure code filters.

**When to use:** After resolving the wijk identifier via WijkenEnBuurtenCodes.

**Example (verified live — returns `{"Value": 269.0, "ValueAttribute": "None"}` for Venlo-Centrum WOZ):**

```python
# Source: Verified live against https://datasets.cbs.nl/odata/v1/CBS/86165NED/Observations
MEASURE_CODES = [
    "M001642",   # Gemiddelde WOZ-waarde van woningen
    "ST0001",    # Mate van stedelijkheid (1-5 scale)
    "ST0003",    # Omgevingsadressendichtheid (addresses/km2)
    "T001036",   # Aantal inwoners
    "M000297",   # Woningvoorraad
    "1014800",   # Koopwoningen
    "1014850_2", # Huurwoningen totaal
    "M000100",   # Bevolkingsdichtheid
    "M000223",   # Gemiddeld inkomen per inkomensontvanger
]

measure_filter = " or ".join(f"Measure eq '{code}'" for code in MEASURE_CODES)
params = {
    "$filter": f"WijkenEnBuurten eq '{wijk_identifier}' and ({measure_filter})",
    "$select": "Measure,Value,ValueAttribute",
}
response = await client.get(
    f"{BASE_URL}/{dataset_id}/Observations",
    headers=headers,
    params=params,
    timeout=10.0,
)
observations = response.json().get("value", [])
# Build dict: {measure_code: value_or_none}
data = {
    obs["Measure"]: obs["Value"] if obs.get("ValueAttribute", "") == "" else None
    for obs in observations
}
```

**ValueAttribute meaning:** Empty string `""` means reliable value. Non-empty (e.g., `"."`) means missing/unreliable — treat as `None`.

### Pattern 3: Rate Limiter Registration

**What:** Add CBS singleton to `rate_limiter.py` and use it as async context manager in the client.

```python
# In backend/app/government_apis/rate_limiter.py
# CBS OData — public open data, polite limits
cbs_odata_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
```

```python
# In CBSODataClient methods:
from app.government_apis.rate_limiter import cbs_odata_limiter

async with cbs_odata_limiter:
    response = await client.get(url, headers=self._headers, params=params, timeout=10.0)
```

### Pattern 4: Settings-Based Dataset ID

**What:** Store CBS dataset ID in `Settings` so it can be updated without code deployment.

```python
# In backend/app/core/config.py
CBS_DATASET_ID: str = Field(
    default="86165NED",
    description="CBS Kerncijfers wijken en buurten dataset ID. "
    "Annual series: 2022=85318NED, 2023=85618NED, 2024=85984NED, 2025=86165NED. "
    "Update when CBS publishes new annual dataset (typically Q2 each year).",
)
```

### Pattern 5: CbsNeighborhoodCard TypeScript Interface

**What:** Narrow `Record<string, any> | null` to a typed interface before building the component.

```typescript
// In frontend/src/lib/types/scan.ts
export interface CbsStedelijkheid {
  klasse: number | null
  omschrijving: string
  omgevingsadressendichtheid: number | null
}

export interface CbsNeighborhoodMetrics {
  bron: string        // e.g. "CBS StatLine OData v4"
  dataset: string     // e.g. "86165NED - Kerncijfers wijken en buurten"
  peiljaar: number    // e.g. 2025
  data: {
    gemiddelde_woz_waarde: number | null
    stedelijkheid: CbsStedelijkheid
    demografie: {
      aantal_inwoners: number | null
      percentage_huurwoningen: number | null
      percentage_koopwoningen: number | null
    }
    bouwjaar_distributie: {
      percentage_bouwjaar_voor_2000: number | null
      percentage_bouwjaar_vanaf_2000: number | null
    }
  }
}
```

Update `ScanResultsResponse.neighborhood_metrics` from `Record<string, any> | null` to `CbsNeighborhoodMetrics | null`.

### Pattern 6: WijkDetailView Mounting

**What:** Mount `CbsNeighborhoodCard` inside the `ScanSummarySection` when `neighborhood_metrics` is present, or as a standalone card between scan summary and jurisprudence.

The data path: `ScanResultsResponse.neighborhood_metrics` is fetched via `useProjectScans` hook which calls `GET /api/scans/{scan_id}/results`. The `WijkDetailView` already receives scan data via `ScanSummarySection`, but `neighborhood_metrics` lives on the scan-level `ScanResultsResponse`, not on individual `ScanResultItem`s.

**Important:** Check the actual data path. `neighborhood_metrics` is in `ScanResultsResponse` (the results response), but `WijkDetailView` uses `useProjectScans` which returns `ProjectScansResponse` — a list of scan summaries. The CBS data needs to be fetched from the scan results endpoint, not the scan list. Options:

1. Add `neighborhood_metrics` to the scan summary list endpoint response
2. Have `CbsNeighborhoodCard` fetch it via a separate hook when the user has a completed scan
3. Fetch full scan results and extract `neighborhood_metrics`

**Recommendation:** Add `neighborhood_metrics` to the scan summary schema (it's already on `AreaScan` model) so the existing `useProjectScans` hook returns it without a new API call.

### Anti-Patterns to Avoid

- **`substringof()` filter:** OData v3 syntax. CBS v4 returns HTTP 400. Use `startswith()` for prefix matching or `eq` for exact match.
- **`TypedDataSet` entity:** Does not exist in CBS v4 — returns 404. Use `Observations`.
- **`WijkenEnBuurten` as entity path:** Does not exist in CBS v4. Use `WijkenEnBuurtenCodes` (note the `Codes` suffix).
- **Wijk lookup by name only:** "Centrum" matches 80+ records nationally. Always scope with `startswith(Identifier, 'WK{gemeente_code}')`.
- **Old wijk key format:** The v3 key format (e.g., `WK036300`) does not match v4 identifiers (e.g., `WK098311`). Use the `Identifier` field from `WijkenEnBuurtenCodes` directly.
- **Hardcoded `peiljaar: 2023`:** The existing client hardcodes this. Derive `peiljaar` from the dataset ID or store it as a config-derived constant.
- **No `timeout=` on httpx call:** CBS calls inside ARQ jobs block worker slots indefinitely without explicit timeout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom asyncio.Semaphore in client file | `APIRateLimiter` from `rate_limiter.py` | Existing pattern; semaphore alone has no time-based throttling |
| HTTP retries | Custom retry loop | `retry_with_backoff()` from `base.py` | Already handles 429 + 5xx + network errors with exponential backoff |
| Error handling | Custom exception dicts | `GovernmentAPIError` subclasses from `base.py` | Consistent three-state contract; endpoint handlers catch these |
| CBS OData library | Third-party CBS wrapper | Manual `httpx` params dict | No maintained Python CBS library; manual is 10 lines and fully transparent |

---

## Common Pitfalls

### Pitfall 1: Wrong CBS API URL (v3 vs v4)

**What goes wrong:** The existing `CBSODataClient.BASE_URL = "https://opendata.cbs.nl/ODataApi/OData"` is the deprecated OData v3 endpoint. The v3 endpoint returns data for legacy datasets but will eventually be discontinued, and v3 uses a fundamentally different entity model.

**How to avoid:** Switch to `BASE_URL = "https://datasets.cbs.nl/odata/v1/CBS/"`. Confirmed live: `86165NED` entity sets include `Observations`, `WijkenEnBuurtenCodes`, `MeasureCodes`, `Properties`.

**Warning signs:** `opendata.cbs.nl` in any URL, `TypedDataSet` in any URL path.

### Pitfall 2: Wrong Wijk Identifier Format

**What goes wrong:** The current code resolves to v3-style keys like `WK036300`. In v4, wijk identifiers look like `WK098311` (municipality 4-digit code + 2-digit sequential suffix from the wijk's index). You cannot construct the v4 identifier manually — you must look it up from `WijkenEnBuurtenCodes` and use the `Identifier` field directly.

**How to avoid:** After calling `WijkenEnBuurtenCodes` with `startswith(Identifier, 'WK{gemeente_code}')`, use the raw `Identifier` field value as the filter key for `Observations`. Do not attempt to construct it by zero-padding.

**Live verification:** For Venlo (gemeente_code `0983`), the wijk identifiers are `WK098311`, `WK098312`, etc. — not the old v3 format.

### Pitfall 3: Data Path for neighborhood_metrics in Frontend

**What goes wrong:** `neighborhood_metrics` is in `ScanResultsResponse` (returned by `GET /api/scans/{scan_id}/results`), but `WijkDetailView.ScanSummarySection` uses `useProjectScans` (which calls `GET /api/projects/{id}/scans`). These are different endpoints with different schemas.

**How to avoid:** Either:
- Add `neighborhood_metrics` to the scan list item schema (`ProjectScanItem`) so it's available from `useProjectScans` — simplest approach, one schema change + one DB field read
- OR create a `useScanResults` hook in `ScanSummarySection` that fetches the full scan results — adds an extra API call on every wijk page load

**Recommendation:** Add `neighborhood_metrics` to `ProjectScanItem` schema and include it in the scan list router's query. The `AreaScan` model already has the column.

### Pitfall 4: Peiljaar Derived Incorrectly

**What goes wrong:** The existing client hardcodes `"peiljaar": 2023`. With the v4 migration to dataset `86165NED`, the peiljaar is 2025. If the peiljaar is still hardcoded to 2023 after migration, users see stale-sounding attribution.

**How to avoid:** Either derive `peiljaar` from `settings.CBS_DATASET_ID` (map known IDs to years) or fetch it from `Properties.ReportingPeriod`. Simplest: derive from the dataset ID configuration value with a lookup constant.

### Pitfall 5: CBS Returns ValueAttribute for Missing Data

**What goes wrong:** When CBS does not have data for a measure in a region, it returns the observation with a non-empty `ValueAttribute` (e.g., `"."` for confidential/suppressed, `"x"` for unreliable). If you use `obs["Value"]` without checking `ValueAttribute`, you store `None` float values that display as `0` or break formatting.

**How to avoid:** Only treat the value as valid when `ValueAttribute == ""` (empty string). All other ValueAttribute values mean the data is absent or suppressed — store as `None`.

### Pitfall 6: gemeente_code Format (4-digit raw, not GM-prefixed)

**What goes wrong:** The `AreaScan.gemeente_code` stores the raw 4-digit code (e.g., `"0983"` for Venlo), not the `GM0983` format. The CBS `WijkenEnBuurtenCodes` `Identifier` field uses `WK0983XX` style. If you accidentally add `GM` prefix before the code, the `startswith` filter returns no results.

**How to avoid:** Use `gemeente_code` directly in the filter: `startswith(Identifier, 'WK{gemeente_code}')`. No prefix needed. Confirmed: `gemeente_code = "0983"` → filter `startswith(Identifier, 'WK0983')` → returns `WK098311`, `WK098312`, etc.

### Pitfall 7: Missing `gemeente_code` in CBS Client Signature

**What goes wrong:** The current `get_neighborhood_data()` signature takes `gemeente_naam` and `wijk_naam` but not `gemeente_code`. The area_scan job has `scan.gemeente_code` available — if it's not passed to the client, the client must do a name-based gemeente lookup first (slow, ambiguous), or the ambiguous wijk lookup bug persists.

**How to avoid:** Add `gemeente_code: str | None = None` to `get_neighborhood_data()` and `_resolve_region_key()`. The area_scan call site already has `scan.gemeente_code` — pass it in. When `gemeente_code` is provided, use it directly in the `startswith` filter without needing a gemeente name lookup.

---

## Code Examples

### CBS v4 Complete Flow (Verified Against Live API)

```python
# Source: Verified live against datasets.cbs.nl/odata/v1/CBS/86165NED on 2026-03-06
# Measure codes confirmed identical to 85984NED

BASE_URL = "https://datasets.cbs.nl/odata/v1/CBS"
DATASET_ID = "86165NED"  # 2025 — from settings.CBS_DATASET_ID

# Step 1: Resolve wijk identifier
# gemeente_code is "0983" (4-digit raw from AreaScan.gemeente_code)
async with cbs_odata_limiter:
    response = await client.get(
        f"{BASE_URL}/{DATASET_ID}/WijkenEnBuurtenCodes",
        headers=headers,
        params={
            "$filter": f"startswith(Identifier, 'WK{gemeente_code}')",
            "$top": "50",
        },
        timeout=10.0,
    )
wijk_records = response.json().get("value", [])
# Find by name match in Python (case-insensitive)
match = next(
    (r for r in wijk_records if wijk_naam.lower() in r["Title"].lower()),
    None,
)
if not match:
    return None  # No CBS data for this wijk

wijk_identifier = match["Identifier"]  # e.g. "WK098311"

# Step 2: Fetch Observations for the resolved wijk
MEASURE_CODES = [
    "M001642", "ST0001", "ST0003", "T001036",
    "M000297", "1014800", "1014850_2", "M000100", "M000223",
]
measure_filter = " or ".join(f"Measure eq '{c}'" for c in MEASURE_CODES)

async with cbs_odata_limiter:
    obs_response = await client.get(
        f"{BASE_URL}/{DATASET_ID}/Observations",
        headers=headers,
        params={
            "$filter": f"WijkenEnBuurten eq '{wijk_identifier}' and ({measure_filter})",
            "$select": "Measure,Value,ValueAttribute",
        },
        timeout=10.0,
    )
observations = obs_response.json().get("value", [])

# Build measure → value dict (None for suppressed values)
data = {
    obs["Measure"]: obs["Value"] if obs.get("ValueAttribute", "x") == "" else None
    for obs in observations
}

# Step 3: Build output dict
mvs = data.get("ST0001")
mvs_desc = {1: "Zeer sterk stedelijk", 2: "Sterk stedelijk", 3: "Matig stedelijk",
            4: "Weinig stedelijk", 5: "Niet stedelijk"}.get(mvs, "Onbekend") if mvs else "Onbekend"

return {
    "bron": "CBS StatLine OData v4",
    "dataset": f"{DATASET_ID} - Kerncijfers wijken en buurten",
    "peiljaar": 2025,  # Derive from DATASET_ID mapping
    "data": {
        "gemiddelde_woz_waarde": data.get("M001642"),
        "stedelijkheid": {
            "klasse": int(mvs) if mvs else None,
            "omschrijving": mvs_desc,
            "omgevingsadressendichtheid": data.get("ST0003"),
        },
        "demografie": {
            "aantal_inwoners": data.get("T001036"),
            "percentage_huurwoningen": data.get("1014850_2"),
            "percentage_koopwoningen": data.get("1014800"),
        },
        "bouwjaar_distributie": {
            "percentage_bouwjaar_voor_2000": data.get("M008209"),   # Note: v4 code differs from v3
            "percentage_bouwjaar_vanaf_2000": data.get("M008210"),
        },
    },
}
```

**Note on bouwjaar codes:** The existing v3 client uses `BouwjaarVoor2000_120`/`BouwjaarVanaf2000_121` column names. In v4, these are measure codes `M008209` (meer dan tien jaar geleden) and `M008210` (afgelopen tien jaar). These are not the same boundary (tien jaar = 10 years, not pre/post 2000) — verify against the variable documentation PDF before using.

### CbsNeighborhoodCard Component (Frontend)

```tsx
// frontend/src/components/projects/CbsNeighborhoodCard.tsx
import type { CbsNeighborhoodMetrics } from '@/lib/types/scan'

const STEDELIJKHEID_COLORS: Record<number, string> = {
  1: 'bg-amber-500/20 text-amber-300',
  2: 'bg-amber-500/15 text-amber-400',
  3: 'bg-grey-600/30 text-grey-300',
  4: 'bg-grey-700/30 text-grey-400',
  5: 'bg-grey-800/30 text-grey-500',
}

interface CbsNeighborhoodCardProps {
  metrics: CbsNeighborhoodMetrics
}

export function CbsNeighborhoodCard({ metrics }: CbsNeighborhoodCardProps) {
  const { data, peiljaar, dataset } = metrics
  const woz = data.gemiddelde_woz_waarde
  const ste = data.stedelijkheid
  const dem = data.demografie

  // Don't render if all key metrics are null
  const hasData = woz !== null || ste.klasse !== null || dem.aantal_inwoners !== null
  if (!hasData) return null

  return (
    <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
        {/* header icon + title */}
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
          CBS Wijkstatistieken
        </span>
        <span className="ml-auto text-xs text-grey-600">
          Bron: CBS StatLine, peiljaar {peiljaar}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Stedelijkheid badge */}
        {ste.klasse && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Stedelijkheid</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STEDELIJKHEID_COLORS[ste.klasse] ?? ''}`}>
              {ste.klasse} — {ste.omschrijving}
            </span>
          </div>
        )}
        {/* WOZ */}
        {woz !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Gem. WOZ-waarde</span>
            <span className="text-sm font-medium text-grey-100">
              €{Math.round(woz * 1000).toLocaleString('nl-NL')}
            </span>
          </div>
        )}
        {/* Demographics */}
        {dem.aantal_inwoners !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-grey-400">Inwoners</span>
            <span className="text-sm text-grey-300">
              {dem.aantal_inwoners.toLocaleString('nl-NL')}
            </span>
          </div>
        )}
        {/* Huur/koop ratio */}
        {dem.percentage_huurwoningen !== null && dem.percentage_koopwoningen !== null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-grey-400">Koop / Huur</span>
              <span className="text-xs text-grey-400">
                {Math.round(dem.percentage_koopwoningen)}% / {Math.round(dem.percentage_huurwoningen)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-grey-800">
              <div
                className="h-full rounded-full bg-amber-accent/60"
                style={{ width: `${Math.min(100, dem.percentage_koopwoningen)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
```

### Empty State (null neighborhood_metrics)

```tsx
// In WijkDetailView — null guard before mounting CbsNeighborhoodCard:
{latestScanResults?.neighborhood_metrics && (
  <CbsNeighborhoodCard metrics={latestScanResults.neighborhood_metrics} />
)}
// If null: nothing renders — no broken card, no misleading "Geen data" in a card wrapper
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CBS OData v3 (`opendata.cbs.nl`, `TypedDataSet`, column-based) | CBS OData v4 (`datasets.cbs.nl`, `Observations`, measure-code-based) | CBS migration started 2023, v3 deprecated ~2024 | Must rewrite `CBSODataClient`; entity structure and filter syntax both change |
| Wijk lookup by name only (ambiguous) | Lookup scoped to municipality using `startswith(Identifier, 'WK{code}')` | This phase | Eliminates cross-municipality name collision bug |
| `WK036300` key format (v3) | `WK098311` key format (v4) | CBS v4 migration | Must use `Identifier` from `WijkenEnBuurtenCodes` directly, not construct it |
| Annual dataset hardcoded in code | `CBS_DATASET_ID` setting with default `86165NED` | This phase | Update without code deploy when CBS releases 2026 dataset |
| `peiljaar: 2023` hardcoded | Derived from dataset ID or fetched from `Properties` | This phase | Correct freshness attribution to users |

**Deprecated/outdated in existing code:**
- `CBSODataClient.BASE_URL = "https://opendata.cbs.nl/ODataApi/OData"` — wrong v3 URL
- `self.dataset_url + "/WijkenEnBuurten"` — entity does not exist in v4 (use `WijkenEnBuurtenCodes`)
- `self.dataset_url + "/TypedDataSet"` — entity does not exist in v4 (use `Observations`)
- `substringof(...)` filter — v3 OData function, returns HTTP 400 on v4
- `DATASET_ID = "85618NED"` class constant — 2023 dataset, now stale (2025 = `86165NED`)
- No `timeout=` on HTTP calls — silent scan job hangs
- No `cbs_odata_limiter` in `rate_limiter.py` — missing per project convention

---

## Open Questions

1. **Bouwjaar measure code meaning mismatch**
   - What we know: v3 client used `BouwjaarVoor2000_120`/`BouwjaarVanaf2000_121` (pre/post 2000 boundary). v4 codes `M008209`/`M008210` are "meer dan tien jaar geleden" (> 10 years ago) and "afgelopen tien jaar" (last 10 years) — a rolling 10-year window, not 2000.
   - What's unclear: Is the existing frontend display label "voor 2000" still appropriate for the v4 measure (which is now "voor 2016")? Or does the frontend need updated labels?
   - Recommendation: Update the display labels in `CbsNeighborhoodCard` to reflect the actual v4 measure meaning ("ouder dan 10 jaar" / "nieuwbouw afgelopen 10 jaar"). Update the `neighborhood_metrics` output key names to avoid confusion.

2. **Data path for `neighborhood_metrics` in WijkDetailView**
   - What we know: `neighborhood_metrics` is in `ScanResultsResponse` but `WijkDetailView` uses `useProjectScans` which returns scan summaries without this field.
   - What's unclear: Which is simpler — adding `neighborhood_metrics` to `ProjectScanItem` schema or adding a new `useLatestScanResults` hook?
   - Recommendation: Add `neighborhood_metrics` to `ProjectScanItem` and include it in the scans list query. One extra field on an existing query is simpler than a new hook with a new API call.

3. **Gemeente-level CBS fallback (no wijk_naam)**
   - What we know: Some scans are gemeente-level (no `wijk_naam`). The existing client falls back to gemeente-level metrics if no wijk is found.
   - What's unclear: In v4, the gemeente identifier is `GM0983` (with `GM` prefix). The filter is `startswith(Identifier, 'GM{gemeente_code}')`. Does the `Observations` endpoint accept `GM0983` as a valid `WijkenEnBuurten` filter value?
   - Recommendation: Verify with a live API call during implementation. Likely yes since `WijkenEnBuurtenCodes` includes `GM` records.

---

## "Looks Done But Isn't" Verification Checklist

Before marking CBS-02/03 complete, verify all of these:

- [ ] `CBSODataClient.BASE_URL` is `"https://datasets.cbs.nl/odata/v1/CBS"` — not `opendata.cbs.nl`
- [ ] No URL path contains `TypedDataSet` or `/WijkenEnBuurten` as an entity (only as a filter field `WijkenEnBuurten eq '...'`)
- [ ] No `substringof(` in any filter string (`grep -r substringof backend/` returns zero results)
- [ ] `get_neighborhood_data()` accepts `gemeente_code: str | None` parameter
- [ ] Wijk filter uses `startswith(Identifier, 'WK{gemeente_code}')` — not name-only matching
- [ ] `cbs_odata_limiter` present in `rate_limiter.py`
- [ ] All CBS HTTP calls have `timeout=10.0` argument
- [ ] `CBS_DATASET_ID` in `Settings` class in `config.py` (not hardcoded class constant)
- [ ] `peiljaar` derived from dataset ID or config — not hardcoded `2023`
- [ ] Exception constructor signatures: `GovernmentAPIError("cbs", f"message: {detail}")` with `source` as first arg

Before marking CBS-01 complete:

- [ ] `CbsNeighborhoodMetrics` TypeScript interface defined in `scan.ts`
- [ ] `ScanResultsResponse.neighborhood_metrics` typed as `CbsNeighborhoodMetrics | null` (not `Record<string, any>`)
- [ ] `neighborhood_metrics` available in `WijkDetailView` data flow (added to `ProjectScanItem` or via hook)
- [ ] `CbsNeighborhoodCard` does not render when all key metrics are null
- [ ] Card renders gracefully when individual metrics are null (partial data)
- [ ] "Bron: CBS StatLine, peiljaar [year]" always visible in the card header
- [ ] Card shows graceful empty state when `neighborhood_metrics` is null: nothing rendered (not a broken card)
- [ ] `npm run check` passes (TypeScript + lint)

---

## Sources

### Primary (HIGH confidence)

- `backend/app/government_apis/cbs_odata.py` — Existing client: v3 URL `opendata.cbs.nl/ODataApi/OData`, `TypedDataSet` entity, `substringof` filter, DATASET_ID `85618NED` hardcoded, no timeout, no rate limiter — all confirmed as problems to fix
- `backend/app/government_apis/rate_limiter.py` — `APIRateLimiter` pattern, `cbs_odata_limiter` not present (confirmed)
- `backend/app/government_apis/base.py` — `GovernmentAPIError`, `APITimeoutError`, `retry_with_backoff` signatures verified
- `backend/app/models/area_scan.py:76` — `neighborhood_metrics: Mapped[dict | None]` JSONB column confirmed
- `backend/app/scans/schemas.py:227` — `neighborhood_metrics: dict | None` in `ScanResultsResponse` confirmed
- `backend/app/core/config.py` — No `CBS_DATASET_ID` setting exists (confirmed gap)
- `backend/app/jobs/area_scan.py:352-364` — CBS fetch integration, non-fatal try/except, uses `scan.gemeente_naam` and `scan.wijk_naam` (not `gemeente_code` — confirmed gap)
- `backend/app/models/parcel_cache.py:55` — gemeente_code format comment: `"0363" for Amsterdam` (4-digit raw)
- `backend/app/services/wijk_service.py:37` — `"GM0983" -> "0983"` strip confirmed; stored as 4-digit raw
- `frontend/src/lib/types/scan.ts:169` — `neighborhood_metrics?: Record<string, any> | null` — needs narrowing
- `frontend/src/components/projects/WijkDetailView.tsx` — Confirmed: `CbsNeighborhoodCard` not yet mounted
- `https://datasets.cbs.nl/odata/v1/CBS/86165NED/Properties` — Confirmed: dataset title "Kerncijfers wijken en buurten 2025", peiljaar 2025, updated January 15 2026
- `https://datasets.cbs.nl/odata/v1/CBS/86165NED/MeasureCodes` — All 12 PropTech-relevant measure codes verified live for 86165NED; codes identical to 85984NED
- `https://datasets.cbs.nl/odata/v1/CBS/86165NED/WijkenEnBuurtenCodes` — Confirmed v4 `Identifier` format: `WK098311` (not old `WK036300`); `startswith(Identifier, 'WK0983')` returns 5 Venlo wijken
- `https://datasets.cbs.nl/odata/v1/CBS/86165NED/Observations` — Confirmed: `WijkenEnBuurten eq 'WK098311' and Measure eq 'M001642'` returns `{"Value": 269.0, "ValueAttribute": "None"}` (WOZ for Venlo-Centrum)

### Secondary (MEDIUM confidence)

- CBS OData v4 Snelstartgids — `https://www.cbs.nl/en-gb/our-services/open-data/statline-as-open-data/quick-start-guide` — confirms v4 entities and filter syntax
- CBS variable documentation PDF `Toelichting variabelen KWB 2024` — bouwjaar measure meaning (rolling 10-year window vs pre-2000 boundary)

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct codebase inspection + no new dependencies needed
- Architecture: HIGH — live API verification for all CBS v4 patterns; data path gap (WijkDetailView → neighborhood_metrics) confirmed by code inspection
- Pitfalls: HIGH — most sourced from direct analysis of existing failing code + live API verification

**Research date:** 2026-03-06
**Valid until:** 2026-09-06 (CBS v4 endpoint stable; dataset ID may need update if CBS releases 2026 dataset in Q2 2026)
