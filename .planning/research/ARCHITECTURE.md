# Architecture Patterns

**Domain:** Deep property data integration — WOZ-waarde, Energielabel, BRK eigendomsdata, improved RCE monument data
**Researched:** 2026-02-23
**Confidence:** HIGH — based on direct codebase analysis of existing aggregator pipeline + verified Dutch government API documentation

---

## Existing Pipeline Summary (What We Extend)

The property aggregator follows a two-step pattern that all new data sources must fit:

```
STEP 1 (sequential): resolve_address() via BAG — MUST succeed
  Returns: verblijfsobject_id, pand_id, RD coordinates

STEP 2 (parallel): asyncio.gather(N fetch functions)
  Returns: cadastral_parcels, zoning_data, monument_status
  Error handling: each fetch wraps exceptions → errors list, graceful None

STEP 3 (sequential): AI parsing trigger, MapData build, source attribution

STEP 4: Assemble PropertyReportResponse + completeness_score
```

Key constraints from codebase analysis:
- All fetches in Step 2 use `get_cached_or_fetch()` with source-specific TTLs from `CACHE_TTL`
- Each new data source needs a key added to `CACHE_TTL` in `backend/app/core/config.py`
- `PropertyReportResponse` is stored as JSONB in `reports.report_data` — all new fields must be Pydantic-serializable
- `completeness_score` = `sections_available / total_sections` — new sections must increment `total_sections`
- BRK eigendomsdata MUST NOT be cached (Kadaster Tier 3 terms) — this is the only source that bypasses `get_cached_or_fetch`

---

## New Data Sources: Integration Map

Each new source maps to exactly four integration points:

| Source | API Client File | Schema Section | Aggregator Integration | Frontend Component |
|--------|----------------|----------------|----------------------|-------------------|
| Energielabel | `backend/app/government_apis/ep_online.py` (NEW) | `EnergyLabel` in `backend/app/schemas/energy.py` (NEW) | `fetch_energy_label()` nested func in `property_aggregator.py` | `EnergieLabelSection` in `ReportDetailPage.tsx` |
| WOZ-waarde | `backend/app/government_apis/woz_waardeloket.py` (NEW) | `WOZData` in `backend/app/schemas/woz.py` (NEW) | `fetch_woz_data()` nested func in `property_aggregator.py` | `WOZSection` in `ReportDetailPage.tsx` |
| BRK eigendomsdata | `backend/app/government_apis/brk_bevragen.py` (EXISTS — needs aggregator wiring) | `BRKOwnership` in `backend/app/schemas/brk.py` (NEW) | `fetch_brk_ownership()` nested func, NO caching | `EigendomSection` in `ReportDetailPage.tsx` |
| RCE (improved) | `backend/app/government_apis/rce_monuments.py` (EXISTS — needs RCE Linked Data API) | `MonumentDetail` fields added to `MonumentSourceResult` | Enhance `_fetch_rce()` in `monument_aggregator.py` | Enhance `MonumentSection` in `ReportDetailPage.tsx` |

---

## Source 1: Energielabel (EP-Online)

### API Details

**Endpoint:** `https://public.ep-online.nl/api/v5/`
**Authentication:** API key via `Authorization: Bearer {key}` header — free to request at `https://apikey.ep-online.nl/`
**Query by VBO:** `GET /api/v5/PandEnergielabel/Adres?bagVerblijfsobjectId={verblijfsobject_id}` or by postcode+huisnummer
**Response fields:** `energieklasse` (A+++ through G), `energieprestatie` (EI value), `registratiedatum`, `geldigTot` (validity date), `pand_registratienummer`
**API Version:** V5 (live since November 2024; V4 deprecated July 2025; V3 gone January 2025) — MEDIUM confidence (Swagger docs not directly accessible, inferred from RVO handleiding)
**Rate limits:** Not officially documented; conservative: 5 concurrent, 300/hour
**TTL recommendation:** 90 days (energielabels change infrequently; validity periods are years)

### New File

```
backend/app/government_apis/ep_online.py
```

```python
"""EP-Online energielabel API client.

Fetches registered energy labels from RVO EP-Online Public API V5.
Queries by BAG verblijfsobject ID (VBO).

Authentication: Bearer API key (request at apikey.ep-online.nl).
Free tier: yes, API key required but no cost.
"""

class EPOnlineClient:
    BASE_URL = "https://public.ep-online.nl/api/v5"

    async def get_energielabel(
        self,
        verblijfsobject_id: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Fetch energy label for a verblijfsobject.
        Returns None if no label registered (not all buildings have EP labels).
        """
        url = f"{self.BASE_URL}/PandEnergielabel/Adres"
        params = {"bagVerblijfsobjectId": verblijfsobject_id}
        headers = {"Authorization": f"Bearer {settings.EP_ONLINE_API_KEY}"}
        # ... standard error handling per base.py patterns
```

### New Schema File

```
backend/app/schemas/energy.py
```

```python
class EnergyLabel(BaseModel):
    """Energielabel data from EP-Online."""
    energieklasse: str | None   # "A+++" through "G"
    energie_index: float | None  # EI numeric value
    registratiedatum: str | None # ISO 8601
    geldig_tot: str | None       # label validity date
    pand_nummer: str | None      # EP-Online registration number
    source: str = "EP-Online V5"
```

### Aggregator Integration

In `aggregate_property_data()`, add `fetch_energy_label()` as a nested async function alongside `fetch_cadastral_parcels()`. Add to the `asyncio.gather()` call.

**Cache key:** `f"ep-online:label:{verblijfsobject_id}"`
**CACHE_TTL key:** `"ep_online"` → 7776000 (90 days)

Input: `verblijfsobject_id` from BAG resolution (available from Step 1).
Graceful degradation: if no VBO available or API returns 404, return `None`. Append error to `errors` list.

### PropertyReportResponse Addition

```python
# In backend/app/schemas/property.py
energy_label: EnergyLabel | None = Field(
    default=None,
    description="Energielabel from EP-Online (None if not registered or VBO not available)",
)
```

### Frontend Type Addition

```typescript
// In frontend/src/lib/types/property.ts
export interface EnergyLabel {
  energieklasse: string | null   // "A+++" through "G"
  energie_index: number | null
  registratiedatum: string | null
  geldig_tot: string | null
  pand_nummer: string | null
  source: string
}

// Add to PropertyReportResponse:
energy_label: EnergyLabel | null
```

### Frontend Component

New section component added to `ReportDetailPage.tsx` as `EnergieLabelSection`. Renders:
- Label badge (large letter: A through G with color coding — green A+++, red G)
- Energie-index numeric value
- Registration date + validity date
- Link to EP-Online registration lookup

Position in ReportDetailPage: between `GebouwSection` and `KadasterSection` (building-level data logically clusters together).

**Color coding for label classes** (matches EU standard): A+++=`#009900`, A++=`#00bb00`, A+=`#33cc00`, A=`#66dd00`, B=`#99dd00`, C=`#ccee00`, D=`#ffee00`, E=`#ffcc00`, F=`#ff9900`, G=`#ff3300`.

---

## Source 2: WOZ-waarde

### API Details

**Critical finding:** WOZ data has restricted access. The Kadaster WOZ API Bevragen requires OIN + PKIOverheid certificate (municipalities only). The WOZ-waardeloket has no public API.

**Viable approach for Propdex:** The WOZ-waardeloket (`wozwaardeloket.nl`) exposes a public JSON endpoint that Propdex can scrape via HTTP: `https://www.wozwaardeloket.nl/woz-api/v1/objecten/nummeraanduidingen/{nummeraanduiding_id}`. This is the same endpoint the WOZ-waardeloket website uses internally.

**Confidence:** LOW — this is an undocumented public endpoint, subject to change, rate limiting, or blocking. Not an official open API.

**Alternative approach:** WOZ-waarden are also available as open data bulk download from PDOK (monthly snapshot), but bulk ingestion is a different architecture (ETL pipeline, not on-demand per-property lookup).

**Recommended approach for this milestone:** Implement WOZ client with explicit LOW_CONFIDENCE flag on returned data. Mark the source as "WOZ-Waardeloket (publiek)" and show a disclaimer that this is publicly available data from the WOZ-waardeloket, not a certified government API connection.

**TTL recommendation:** 365 days (WOZ values are set annually, usually communicated in February)
**Cache key pattern:** `f"woz:object:{nummeraanduiding_id}"`

### New File

```
backend/app/government_apis/woz_waardeloket.py
```

```python
"""WOZ-waarde client via WOZ-waardeloket public endpoint.

Fetches WOZ-waarde from the public WOZ-waardeloket API.
Uses nummeraanduiding ID from BAG resolution.

IMPORTANT: This is an undocumented public endpoint, not an official API.
Data should be presented with LOW confidence and a disclaimer.
"""

class WOZWaardeloketClient:
    BASE_URL = "https://www.wozwaardeloket.nl/woz-api/v1"

    async def get_woz_waarde(
        self,
        nummeraanduiding_id: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """Fetch WOZ-waarde by nummeraanduiding ID.
        Returns dict with wozWaarde, peildatum, or None if unavailable.
        """
        url = f"{self.BASE_URL}/objecten/nummeraanduidingen/{nummeraanduiding_id}"
        # No authentication required (public endpoint)
```

### New Schema File

```
backend/app/schemas/woz.py
```

```python
class WOZJaarwaarde(BaseModel):
    """WOZ-waarde for a specific peildatum year."""
    peildatum: str   # e.g., "2025-01-01"
    waarde: int      # EUR value

class WOZData(BaseModel):
    """WOZ-waarde data from WOZ-waardeloket."""
    woz_waarden: list[WOZJaarwaarde]  # Last 3-5 years
    actuele_waarde: int | None        # Most recent value
    actuele_peildatum: str | None     # Most recent reference date
    object_id: str | None
    source: str = "WOZ-Waardeloket"
    confidence: str = "LOW"           # Non-official API
```

### Aggregator Integration

Add `fetch_woz_data()` nested function. Input: `nummeraanduiding_id` from BAG address resolution (available from Step 1). Add to `asyncio.gather()`.

**PropertyReportResponse addition:**
```python
woz: WOZData | None = Field(
    default=None,
    description="WOZ-waarde from WOZ-waardeloket (LOW confidence — public endpoint)",
)
```

### Frontend Component

New `WOZSection` in `ReportDetailPage.tsx`. Renders:
- Current WOZ-waarde formatted as currency (e.g., "€ 485.000")
- Peildatum (reference date)
- WOZ history table (last 3-5 years) showing trend
- Explicit LOW confidence disclaimer: "WOZ-waarde opgehaald via publiek waardeloket. Geen gecertificeerde API-verbinding."

**Note on display:** WOZ-waarden for non-residential properties are not public under current law. If the API returns no data for commercial properties, show "WOZ-waarde niet openbaar voor dit type object" rather than a generic error.

---

## Source 3: BRK Eigendomsdata

### API Details

The `BRKBevragenClient` already exists in `backend/app/government_apis/brk_bevragen.py`. It implements `get_eigendom()` and `get_kadastraal_object()`. The gap is that it has never been wired into `aggregate_property_data()`.

**Critical constraint (existing code comment):** "CRITICAL: Eigendomsdata must NEVER be cached or stored per Kadaster Tier 3 terms."

**New requirement:** BRK queries need a `kadaster_identificatie` — the full cadastral object ID (e.g., `NL.IMKAD.KadastraalObject.12345`). This is NOT the same as the `kadastrale_aanduiding` (e.g., "Venlo M 1722") returned by PDOK Cadastral. A mapping step is needed.

**Mapping strategy:** PDOK Cadastral OGC API already returns a feature with properties. The `localid` or `kadastraleAanduiding` can be used to construct or find the BRK identificatie. Alternatively, the BRK API supports query by `kadastraleAanduiding` string. Research indicates BRK API accepts the formatted string directly: `GET /kadastraalonroerendezaken?kadastraleAanduiding=VENLO+M+1722`.

**Access constraint:** BRK requires PKIOverheid mTLS certificate + API key. The client `BRKBevragenClient` gracefully disables itself if not configured (logs warning, `_configured = False`). The aggregator must check `brk_client._configured` before attempting.

**No-cache requirement:** BRK eigendomsdata MUST NOT go through `get_cached_or_fetch()`. It bypasses the cache layer entirely. This is architecturally exceptional — document clearly.

### New Schema File

```
backend/app/schemas/brk.py
```

```python
class BRKEigenaar(BaseModel):
    """Single property owner/rights holder from BRK."""
    naam: str | None            # Person/organization name
    type: str | None            # "Natuurlijk persoon" or "Rechtspersoon"
    recht: str | None           # "Eigendom", "Recht van erfpacht", etc.
    aandeel: str | None         # Share fraction (e.g., "1/2")

class BRKOwnership(BaseModel):
    """Eigendomsdata from BRK Bevragen API.

    NEVER cache or store this data (Kadaster Tier 3 terms).
    """
    eigenaren: list[BRKEigenaar]
    zakelijk_rechten: list[str]   # Rights types present
    is_available: bool             # False if BRK not configured or query failed
    unavailable_reason: str | None # "BRK niet geconfigureerd" or error message
    source: str = "Kadaster BRK Bevragen API v2"
    retrieved_at: str              # ISO 8601 — timestamp of this fetch (not a cache timestamp)
```

### Aggregator Integration

```python
async def fetch_brk_ownership() -> BRKOwnership | None:
    """Fetch BRK eigendomsdata — NEVER cached."""
    if not brk_client._configured:
        return BRKOwnership(
            eigenaren=[],
            zakelijk_rechten=[],
            is_available=False,
            unavailable_reason="BRK niet geconfigureerd",
            retrieved_at=datetime.utcnow().isoformat() + "Z",
        )

    if not cadastral_parcels:
        return None  # Need parcel ID to query BRK

    # Use first parcel's kadastrale_aanduiding
    aanduiding = cadastral_parcels[0].kadastrale_aanduiding
    if not aanduiding:
        return None

    try:
        async with brk_client.create_client() as brk_http_client:
            # BRK creates its OWN mTLS client, separate from shared httpx client
            raw = await brk_client.get_eigendom(aanduiding, brk_http_client)
            return _parse_brk_response(raw)
    except GovernmentAPIError as e:
        return BRKOwnership(
            eigenaren=[], zakelijk_rechten=[],
            is_available=False,
            unavailable_reason=str(e.message),
            retrieved_at=datetime.utcnow().isoformat() + "Z",
        )
```

**Critical ordering constraint:** BRK fetch depends on `cadastral_parcels` being populated (needs parcel aanduiding). BRK cannot run in the same `asyncio.gather()` as parcel fetch. It needs a SECOND gather after cadastral parcels resolve.

**Revised aggregation flow:**

```
STEP 2a (parallel): fetch_cadastral_parcels(), fetch_zoning(), fetch_monuments(),
                    fetch_energy_label(), fetch_woz_data()
  ↓ await
STEP 2b (parallel): fetch_brk_ownership()  # depends on STEP 2a cadastral result
```

### PropertyReportResponse Addition

```python
# In backend/app/schemas/property.py
brk_ownership: BRKOwnership | None = Field(
    default=None,
    description="Property ownership data from BRK (never cached per Kadaster terms)",
)
```

**Frontend note:** `BRKOwnership.retrieved_at` replaces `cached_at`/`age_seconds` for source display. Show "Actueel opgevraagd: [timestamp]" instead of cache age.

### Frontend Component

New `EigendomSection` in `ReportDetailPage.tsx`. Renders:
- Owner list (obfuscate partial names for privacy — show "J. de V..." not full name)
- Rights type per owner (eigendom, erfpacht, etc.)
- Aandeel (share fraction) if multiple owners
- "Niet beschikbaar" state when `is_available = false` with `unavailable_reason`
- No "Bekijk op cache" freshness indicator (data is always live)

**Privacy consideration:** Eigendomsdata includes personal names. Display should match the WOZ-waardeloket convention: first initial + truncated surname. Full display is legally permitted (public register) but industry best practice is partial display.

---

## Source 4: RCE Monument Data (Improved)

### Current State

`backend/app/government_apis/rce_monuments.py` queries the PDOK OGC Features API for spatial monument hits but returns minimal data: monument number, naam, and a register URL. The `monument_naam` field often gets populated with a generic "Rijksmonument {nr}" fallback.

### What's Missing

The RCE Linked Data API at `https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run` provides rich detail: volledigeOmschrijving (full description), oorspronkelijkeFunctie (original function), monumentaard (built/archaeological), provincieNaam, woonplaatsNaam, straat, and status. This API requires no authentication and is freely accessible.

**Query:** `GET https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run?rijksmonumentnummer={nr}&pageSize=1`

**TTL:** 30 days (monument register changes infrequently)

### Integration Approach

When the PDOK spatial query returns a monument with a monument number, make a SECOND call to the RCE Linked Data API to fetch full detail. This is a two-step enrichment within `_fetch_rce()`:

```python
async def _fetch_rce(x, y, client, organization_id, session, force_refresh):
    # Step 1: spatial query (existing)
    cache_key = f"rce:monument:{x:.0f}:{y:.0f}"
    cache_result = await get_cached_or_fetch(
        cache_key=cache_key, source="rce", ...
        fetch_fn=_fetch_rce_with_detail(x, y, client)  # NEW: includes detail fetch
    )
    ...

async def _fetch_rce_with_detail(x, y, client):
    """Fetch monument spatial hit + enrich with RCE Linked Data detail."""
    # Step 1: spatial hit (existing PDOK OGC query)
    docs = await _rce_client.query_by_location(x, y, client)
    if not docs:
        return {}

    monument_nr = docs[0].get("rce_objrijksnr")
    if not monument_nr:
        return docs[0]

    # Step 2: detail enrichment via RCE Linked Data API
    try:
        detail = await _rce_client.get_detail_by_number(monument_nr, client)
        return {**docs[0], **detail}  # Merge spatial + detail
    except Exception:
        return docs[0]  # Graceful: spatial data only if detail fails
```

### New RCEMonumentClient Method

```python
async def get_detail_by_number(
    self,
    monument_number: str,
    client: httpx.AsyncClient,
) -> dict:
    """Fetch full monument detail from RCE Linked Data API.

    No authentication required. Free public API.
    """
    url = "https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run"
    params = {
        "rijksmonumentnummer": monument_number,
        "pageSize": "1",
    }
    response = await client.get(url, params=params, timeout=15.0)
    data = response.json()
    if not data:
        return {}
    item = data[0]
    return {
        "volledigeOmschrijving": item.get("volledigeOmschrijving"),
        "oorspronkelijkeFunctie": item.get("oorspronkelijkeFunctie"),
        "monumentaard": item.get("monumentaard"),  # "Gebouwd" or "Archeologisch"
        "bouwstijl": item.get("bouwstijl"),
        "redengeving": item.get("redengevingOmschrijving"),
        "rijksmonument_url": f"https://monumentenregister.cultureelerfgoed.nl/monuments/{monument_number}",
    }
```

### Schema Changes

Extend `MonumentSourceResult` (in `backend/app/schemas/monument.py`) with optional enrichment fields:

```python
class MonumentSourceResult(BaseModel):
    # ... existing fields ...
    # NEW enrichment fields (only populated by RCE source):
    volledigeOmschrijving: str | None = None  # Full monument description
    oorspronkelijkeFunctie: str | None = None  # e.g., "Woonhuis", "Kerk"
    monumentaard: str | None = None            # "Gebouwd" or "Archeologisch"
    bouwstijl: str | None = None               # e.g., "Jugendstil"
    redengeving: str | None = None             # Why it was listed
    rijksmonument_url: str | None = None       # Link to official register
```

These fields are nullable so existing BAG and Kadaster `MonumentSourceResult` objects are unaffected.

### Frontend Changes

Enhance `MonumentSection` in `ReportDetailPage.tsx` to display new fields when present:
- Official register link: `<a href={src.rijksmonument_url}>Bekijk in Rijksmonumentenregister</a>`
- `volledigeOmschrijving` — collapsible (potentially long text)
- `oorspronkelijkeFunctie` + `bouwstijl` as metadata chips
- `monumentaard` badge ("Gebouwen" or "Archeologisch")

---

## Data Flow (Complete Updated Picture)

```
Input: { postcode, huisnummer }
  │
  ▼
STEP 1 (sequential) ─────────────────────────────────────────────
resolve_address(BAG)
  → verblijfsobject_id  ← needed by EP-Online, WOZ
  → nummeraanduiding_id ← needed by WOZ
  → pand_id             ← needed by BRK (via parcel)
  → coordinates (RD)    ← needed by cadastral, zoning, monuments
  │
  ▼
STEP 2a (parallel) ───────────────────────────────────────────────
asyncio.gather(
  fetch_cadastral_parcels(coordinates),    # PDOK Cadastral OGC
  fetch_zoning(coordinates),               # DSO Ruimtelijke Plannen
  fetch_monuments(coordinates, pand_id),   # PDOK + RCE Linked Data
  fetch_energy_label(verblijfsobject_id),  # EP-Online V5 [NEW]
  fetch_woz_data(nummeraanduiding_id),     # WOZ-waardeloket [NEW]
)
  │
  ▼
STEP 2b (sequential, BRK only) ──────────────────────────────────
if brk_client._configured and cadastral_parcels:
  fetch_brk_ownership(cadastral_parcels[0].kadastrale_aanduiding)
  # Uses mTLS client, NOT shared httpx client
  # NEVER goes through get_cached_or_fetch
  │
  ▼
STEP 3 (sequential) ─────────────────────────────────────────────
AI parsing trigger (existing)
MapData build (existing)
section_sources build (existing + new sections)
completeness_score (existing + new sections increment total_sections)
  │
  ▼
PropertyReportResponse (extended)
  address, building, cadastral_parcels       ← existing
  zoning, monuments, map_data, ai_parsing    ← existing
  energy_label [NEW]
  woz [NEW]
  brk_ownership [NEW]
```

---

## Component Boundaries

### New Backend Files

| File | Type | Purpose | Caching |
|------|------|---------|---------|
| `backend/app/government_apis/ep_online.py` | API client | EP-Online V5 REST queries by VBO ID | Via `get_cached_or_fetch`, TTL 90d |
| `backend/app/government_apis/woz_waardeloket.py` | API client | WOZ-waardeloket public JSON endpoint | Via `get_cached_or_fetch`, TTL 365d |
| `backend/app/schemas/energy.py` | Pydantic schema | `EnergyLabel` model | N/A |
| `backend/app/schemas/woz.py` | Pydantic schema | `WOZData`, `WOZJaarwaarde` models | N/A |
| `backend/app/schemas/brk.py` | Pydantic schema | `BRKOwnership`, `BRKEigenaar` models | N/A |

### Modified Backend Files

| File | Change | Scope |
|------|--------|-------|
| `backend/app/government_apis/rce_monuments.py` | Add `get_detail_by_number()` method to `RCEMonumentClient` | EXTEND — existing `query_by_location` unchanged |
| `backend/app/services/monument_aggregator.py` | Modify `_fetch_rce()` to call enrichment after spatial hit | MODIFY — split fetch into two-step |
| `backend/app/schemas/monument.py` | Add nullable enrichment fields to `MonumentSourceResult` | EXTEND — backward compatible |
| `backend/app/schemas/property.py` | Add `energy_label`, `woz`, `brk_ownership` fields to `PropertyReportResponse` | EXTEND — all Optional |
| `backend/app/services/property_aggregator.py` | Add 3 nested fetch functions, adjust gather call order, update completeness_score denominator | MODIFY — core orchestration |
| `backend/app/core/config.py` | Add `CACHE_TTL` entries for `ep_online` and `woz` | EXTEND |
| `backend/app/government_apis/rate_limiter.py` | Add `ep_online_limiter` (5 concurrent, 300/hour) | EXTEND |

### New Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/components/reports/EnergieLabelSection.tsx` | Energy label badge + index + history |
| `frontend/src/components/reports/WOZSection.tsx` | WOZ-waarde + history table + disclaimer |
| `frontend/src/components/reports/EigendomSection.tsx` | BRK ownership list + rights + live-fetch indicator |

### Modified Frontend Files

| File | Change |
|------|--------|
| `frontend/src/lib/types/property.ts` | Add `EnergyLabel`, `WOZData`, `WOZJaarwaarde`, `BRKOwnership`, `BRKEigenaar` interfaces; extend `MonumentSourceResult` with enrichment fields; extend `PropertyReportResponse` |
| `frontend/src/components/reports/ReportDetailPage.tsx` | Import + render `EnergieLabelSection`, `WOZSection`, `EigendomSection` in section stack; enhance `MonumentSection` with RCE enrichment fields |

---

## Settings / Config Changes

### New Settings (backend/app/core/config.py)

```python
CACHE_TTL = {
    # ... existing ...
    "ep_online": 7776000,   # 90 days (energy labels change infrequently)
    "woz": 31536000,        # 365 days (set annually)
}
```

```python
class Settings(BaseSettings):
    # ... existing ...
    EP_ONLINE_API_KEY: str = Field(
        default="",
        description="EP-Online Public API key (request at apikey.ep-online.nl — free)",
    )
    # BRK_API_KEY, BRK_CLIENT_CERT_PATH, etc. already exist
```

### Environment Variables

| Variable | Required | Fallback Behavior |
|----------|----------|------------------|
| `EP_ONLINE_API_KEY` | Yes (for EP-Online) | Section returns None + error in errors list |
| `BRK_API_KEY` + certs | Yes (for BRK) | `brk_client._configured = False`, section shows "niet geconfigureerd" |
| No new vars for WOZ | N/A | WOZ public endpoint needs no auth |

---

## Build Order

Build order is driven by three constraints:
1. Schema before aggregator (Pydantic models must exist before they're referenced)
2. API client before aggregator integration
3. BRK aggregation after cadastral parcel fetch (data dependency)

### Phase 1: Schema Layer (no dependencies)

1. `backend/app/schemas/energy.py` — `EnergyLabel` model
2. `backend/app/schemas/woz.py` — `WOZData`, `WOZJaarwaarde`
3. `backend/app/schemas/brk.py` — `BRKOwnership`, `BRKEigenaar`
4. Extend `backend/app/schemas/monument.py` — add nullable enrichment fields
5. Extend `backend/app/schemas/property.py` — add 3 new fields to `PropertyReportResponse`
6. Add CACHE_TTL entries + EP_ONLINE_API_KEY to `backend/app/core/config.py`

**Gate:** `ruff check . && mypy .` — all type checks pass

### Phase 2: API Clients (depends on Phase 1 schemas)

7. `backend/app/government_apis/ep_online.py` — EPOnlineClient
8. `backend/app/government_apis/woz_waardeloket.py` — WOZWaardeloketClient
9. Add `ep_online_limiter` to `backend/app/government_apis/rate_limiter.py`
10. Extend `backend/app/government_apis/rce_monuments.py` — `get_detail_by_number()` method

**Gate:** Manual curl tests against live APIs (EP-Online Swagger, WOZ-waardeloket, RCE Linked Data)

### Phase 3: Aggregator Wiring (depends on Phases 1 + 2)

11. Extend `backend/app/services/monument_aggregator.py` — two-step RCE enrichment
12. Extend `backend/app/services/property_aggregator.py` — add 3 nested fetch functions, second gather for BRK, update completeness_score
13. Update `total_sections` denominator (currently 6, becomes 9 with 3 new sections)

**Gate:** Full end-to-end test: `POST /api/property/lookup` returns response with all 3 new sections populated

### Phase 4: Frontend Types + Components (depends on Phase 3 backend being stable)

14. Extend `frontend/src/lib/types/property.ts` — all new interfaces
15. `frontend/src/components/reports/EnergieLabelSection.tsx`
16. `frontend/src/components/reports/WOZSection.tsx`
17. `frontend/src/components/reports/EigendomSection.tsx`
18. Modify `frontend/src/components/reports/ReportDetailPage.tsx` — wire in new sections
19. Enhance `MonumentSection` within `ReportDetailPage.tsx` — RCE detail fields

**Gate:** `npm run check` passes; open a real report and verify all 3 new sections render (even in empty/unavailable state)

### Phase 5: BRK Stub (parallel-executable with Phases 1-4)

BRK requires mTLS certificates which are not yet obtained. Build with graceful degradation:
- `EigendomSection` must render cleanly when `brk_ownership.is_available = false`
- Show "Eigendomsdata niet geconfigureerd" with configuration instructions
- Section should be visible but empty — not hidden — so users know the feature exists

The mTLS certificate procurement process (PKIOverheid via KPN/Digidentity) takes weeks. Build the full integration with the mock/graceful-fail path FIRST, then plug in real credentials.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Caching BRK Eigendomsdata

**What goes wrong:** Using `get_cached_or_fetch()` for BRK ownership data.
**Why it happens:** Every other source uses this pattern — easy to copy.
**Consequences:** Violates Kadaster Tier 3 terms of service. Legal liability for Propdex.
**Prevention:** `fetch_brk_ownership()` never calls `get_cached_or_fetch()`. Uses `brk_client.create_client()` directly. Add a `# NEVER CACHE — Kadaster Tier 3 terms` comment at the call site.

### Anti-Pattern 2: Including BRK Data in JSONB Report Store

**What goes wrong:** Storing `brk_ownership` in `reports.report_data` JSONB when saving a report.
**Why it happens:** `PropertyReportResponse` is saved wholesale to `report_data`.
**Consequences:** Cached/stored eigendomsdata violates Kadaster terms.
**Prevention:** Strip `brk_ownership` from `PropertyReportResponse` before saving to DB. Either (a) add a `to_storable_dict()` method that excludes it, or (b) set `brk_ownership = None` before the save operation in `reports/service.py`.

### Anti-Pattern 3: Treating WOZ-waardeloket Endpoint as a Stable API

**What goes wrong:** Building production code that depends on `wozwaardeloket.nl` internal endpoint without fallback.
**Why it happens:** Endpoint happens to work today.
**Consequences:** Non-zero probability of endpoint change or authentication requirement added without notice.
**Prevention:** Wrap in try/except, return `WOZData` with `confidence="LOW"` and a disclaimer. Design frontend to show "WOZ-waarde tijdelijk niet beschikbaar" gracefully. Add health monitoring.

### Anti-Pattern 4: Blocking Step 2b BRK on Zoning/Monument Completion

**What goes wrong:** Awaiting ALL Step 2a results before starting BRK (including slow DSO API calls).
**Why it happens:** Simple to await the full gather result.
**Consequences:** BRK fetch adds latency equal to the slowest Step 2a call (DSO can be 3-8s).
**Prevention:** Only BRK needs the cadastral parcel result. Use a separate `asyncio.Task` for cadastral that starts immediately, then await it specifically before BRK:
```python
cadastral_task = asyncio.create_task(fetch_cadastral_parcels())
other_tasks = asyncio.gather(fetch_zoning(), fetch_monuments(), fetch_energy_label(), fetch_woz())
cadastral_result = await cadastral_task
brk_result = await fetch_brk_ownership(cadastral_result)
await other_tasks  # Wait for remaining
```

### Anti-Pattern 5: Using Full Monument Description as Monument Name

**What goes wrong:** Populating `monument_naam` with `volledigeOmschrijving` (can be 500+ characters).
**Why it happens:** The RCE detail provides this field and it seems like the "name".
**Consequences:** `monument_naam` overflows in UI — it was designed for short names.
**Prevention:** Keep `monument_naam` from the PDOK spatial query (short). Put `volledigeOmschrijving` in the new enrichment field, displayed in a collapsible panel.

---

## Scalability Considerations

| Concern | At Current Scale | With New Sources | Mitigation |
|---------|-----------------|-----------------|------------|
| API call count per lookup | 4-6 calls | +4-5 calls (EP-Online, WOZ, RCE detail, optional BRK) | Parallel gather; TTL caching keeps repeat lookups fast |
| BRK mTLS overhead | N/A | Creates dedicated SSL client per request | `create_client()` overhead is ~5ms; acceptable for optional paid feature |
| WOZ endpoint reliability | N/A | Single point of failure (undocumented endpoint) | Graceful degradation; 365d TTL means cache cushions outages |
| completeness_score inflation | 6 sections | 9 sections | Denominator change means existing reports show lower scores — consider versioning |
| JSONB storage size | ~20KB per report | +2-5KB per new section | No concern at current scale |
| BRK in JSONB | N/A | MUST strip before save | Enforce in reports/service.py save path |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `backend/app/services/property_aggregator.py` — aggregation pipeline structure
  - `backend/app/government_apis/brk_bevragen.py` — existing BRK client (graceful degradation pattern)
  - `backend/app/government_apis/rce_monuments.py` — existing RCE PDOK client
  - `backend/app/services/monument_aggregator.py` — two-step aggregation pattern
  - `backend/app/schemas/monument.py` — MonumentSourceResult extension approach
  - `backend/app/schemas/property.py` — PropertyReportResponse structure
  - `backend/app/core/config.py` — CACHE_TTL and Settings patterns
  - `backend/app/services/cache_manager.py` — caching contract
  - `frontend/src/components/reports/ReportDetailPage.tsx` — section rendering pattern
  - `frontend/src/lib/types/property.ts` — TypeScript interface extension points
- [EP-Online Swagger UI](https://public.ep-online.nl/swagger/index.html) — V5 API endpoints (MEDIUM confidence — confirmed V5 is current, BAG VBO query supported)
- [EP-Online API key request portal](https://apikey.ep-online.nl/) — free API key, registration required (HIGH confidence)
- [RVO EP-Online handleiding February 2025](https://www.rvo.nl/sites/default/files/2025-02/handleiding-ep-online-opvragen-van-bestanden.pdf) — V5 endpoint structure (HIGH confidence — official government documentation)
- [RCE Linked Data API — rest-api-rijksmonumenten](https://linkeddata.cultureelerfgoed.nl/rce/-/queries/rest-api-rijksmonumenten/9) — no auth, public REST endpoint (HIGH confidence — official RCE Linked Open Data)
- [RCE PDOK OGC API](https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1) — existing integration confirmed working (HIGH confidence)
- [Kadaster WOZ API Bevragen docs](https://kadaster.github.io/WOZ-bevragen/getting-started) — confirms municipal-only access (HIGH confidence — official Kadaster)
- [WOZ-waardeloket public access](https://www.wozwaardeloket.nl/) — public website with undocumented JSON API (LOW confidence — reverse-engineered public endpoint)
- [Kadaster BRK Bevragen Tier 3 terms](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen) — never-store eigendomsdata requirement (HIGH confidence — existing code comment + official Kadaster terms)
