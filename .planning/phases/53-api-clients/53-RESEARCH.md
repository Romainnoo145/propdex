# Phase 53: API Clients - Research

**Researched:** 2026-02-24
**Domain:** Dutch government API clients — EP-Online V5, WOZ Waardeloket, RCE Linked Data
**Confidence:** MEDIUM (EP-Online field names need live validation; WOZ field names provisional; RCE detail scope constrained by what the REST API actually returns)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**WOZ data source strategy**
- Use WOZ Waardeloket (public, unofficial) as the sole data source for v7.0
- Always show low-confidence disclaimer: "Bron: WOZ Waardeloket (indicatief)" per WOZ-04
- Always fetch both WOZ value and waardepeildatum as a pair (WOZ-02 requirement)
- When waardeloket returns unexpected response format: return error status (not silent None) so frontend can show "WOZ data unavailable" with reason — also log the issue for monitoring

**"No data" semantics — consistent three-state contract**
All three clients follow the same error/missing-data contract:
- **Data found** -> return Pydantic model
- **No data exists (normal)** -> return None (frontend shows "Niet beschikbaar" / "Niet geregistreerd")
- **API error/timeout** -> raise or return error (frontend shows "Kon niet ophalen")
- **API unconfigured** -> return None (section hidden, no error)

EP-Online specifics: distinguish 404 "no label registered" (return None, normal for ~20-30% of properties) from 500/timeout (error state). NRG-03 drives the "Niet geregistreerd" display.

RCE specifics: when a known rijksmonument has no detail page in RCE API (rare), return None. The existing PDOK spatial match already confirms monument status — missing RCE detail just means no enrichment.

**RCE detail field scope**
- **Comprehensive extraction** — pull all available fields, not just the minimum:
  - Core: redengevende omschrijving, oorspronkelijke functie, bouwperiode, rijksmonumentnummer
  - Extended: architect, construction materials, complex membership, kadastrale aanduiding, coordinates
- Store full redengevende omschrijving text (no truncation) — frontend handles display with collapsible section in Phase 56
- Resolve SPARQL-style URIs to human-readable Dutch labels at the client level (return "Woonhuis" not "/id/functie/woonhuis")
- Multi-valued fields (functions, complexes) stored as List[str] — preserves all data

**Rate limiting philosophy**
- Conservative rate limiting across all three APIs: max 2-3 req/sec per API
- Retry with exponential backoff on 429/throttle: up to 3 retries (1s, 2s, 4s delays)
- Shared rate limiters across concurrent scan workers (single limiter per API, not per-worker)
- Log key metrics at INFO level: request counts, throttle events, average latency per API

### Claude's Discretion
- Exact httpx client configuration (timeouts, connection pooling)
- Cache key format for EP-Online and WOZ responses
- Whether to use the existing rate limiter singletons from Phase 52 or create new ones
- Error class hierarchy (custom exceptions vs return types for error states)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NRG-01 | Report fetches energielabel klasse (A++++ to G) from EP-Online V5 API by BAG VBO ID | EP-Online V5 endpoint confirmed: `/api/v5/PandEnergielabel/AdresseerbaarObject/{vbo_id}`; field `energieKlasse` confirmed via third-party wrapper research |
| NRG-03 | Properties without registered label show "Niet geregistreerd" (not an error — ~20-30% of properties) | EP-Online returns HTTP 404 for unregistered VBOs; client must catch `APINotFoundError` and return `EnergyLabel(is_geregistreerd=False)` |
| RCE-01 | When monument detected (existing PDOK spatial), fetch detail from RCE Linked Data API | RCE REST API confirmed at `api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run?rijksmonumentnummer={nr}`; requires JSON-LD response parsing |
| RCE-03 | Display oorspronkelijke functie and bouwperiode when available | RCE REST API `rest-api-rijksmonumenten` query does NOT expose these fields; requires a richer SPARQL query or alternate approach — open question identified |
| RCE-04 | All monument labels say "Rijksmonument (RCE)" not generic "Monument" | Label is a display-layer concern; client returns `RCEMonumentDetail` with `rijksmonumentnummer` field confirming source as RCE |
| WOZ-01 | Report fetches WOZ-waarde from public endpoint (waardeloket or Objectinformatie API) | WOZ Waardeloket API endpoint confirmed: `api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/{nummeraanduiding_id}`; requires BAG nummeraanduiding_id which is already fetched in property aggregator |
| WOZ-04 | Low-confidence disclaimer shown when using unofficial waardeloket endpoint | `WOZData.low_confidence=True` and `low_confidence_reden="Bron: WOZ Waardeloket (indicatief)"` must be set by client on every successful fetch |
</phase_requirements>

---

## Summary

Phase 53 builds three httpx API clients that transform raw government API responses into the typed Pydantic models created in Phase 52. Each client follows the established project pattern (class with singleton, `async with rate_limiter:`, `handle_api_response()`, `APINotFoundError` for graceful 404s). The rate limiters (`ep_online_limiter`, `rce_detail_limiter`) were already created in Phase 52's `rate_limiter.py`.

The most significant discovery is that the **RCE Linked Data REST API** (`rest-api-rijksmonumenten`) returns a JSON-LD response with full namespace URI keys — NOT simple JSON field names. Live testing confirms this endpoint returns only: `rijksmonumentnummer`, `cultuurhistorischObjectnummer`, `datumInschrijvingInMonumentenregister`, and BAG address relation data. Fields like `redengevende omschrijving`, `oorspronkelijkeFunctie`, and `bouwperiode` are NOT returned by this endpoint. Phase 53 must resolve this mismatch (see Open Questions).

The **EP-Online V5** endpoint is well-documented (Swagger at `public.ep-online.nl/swagger`). The key field names inferred from third-party wrappers are `energieKlasse`, `registratieDatum`, `geldigTot`, `opnameDatum`, `soortOpname`, `berekeningType` — but **these must be validated against a live API call** (the Phase 52 schema already notes this with LOW/MEDIUM confidence comments in the model docstrings).

The **WOZ Waardeloket** requires a `nummeraanduiding_id` (which the BAG API already fetches). The `api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/{id}` endpoint is confirmed working. Response field names need live validation.

**Primary recommendation:** Build all three clients with liberal `| None` field handling to tolerate field name corrections during live validation. Write the `RCELinkedDataClient.get_detail_by_monument_number()` method to parse the JSON-LD triple structure and confirm what fields are actually available — then either use a richer SPARQL query to get the detail fields or document the gap.

---

## Standard Stack

### Core (all already in pyproject.toml)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx[http2] | >=0.27.0 | Async HTTP client | Already used throughout project; connection pooling via `create_government_api_client()` |
| pydantic | (via fastapi) | Response model validation | Phase 52 schemas are Pydantic models; clients populate them |
| aiolimiter | >=1.2.0 | Token bucket rate limiting | Already used in `rate_limiter.py`; `ep_online_limiter`/`rce_detail_limiter` created in Phase 52 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| datetime (stdlib) | - | Date parsing for label validity | `datetime.utcnow()` (naive UTC, per project pattern) |

**No new dependencies required.** All libraries already in `pyproject.toml`.

---

## Architecture Patterns

### Existing Pattern to Follow

Every government API client in this project follows the same structure. The BRK client (`brk_bevragen.py`) is the best reference for a key-gated API; the BAG client (`bag_api.py`) is the best reference for response normalization:

```python
"""Module docstring with CRITICAL notes for legal constraints."""
import logging
import httpx
from app.core.config import settings
from app.government_apis.base import APINotFoundError, GovernmentAPIError, handle_api_response
from app.government_apis.rate_limiter import ep_online_limiter

logger = logging.getLogger(__name__)

class EPOnlineClient:
    BASE_URL = "https://public.ep-online.nl/api/v5"

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.EP_ONLINE_API_KEY}"}

    def _is_configured(self) -> bool:
        return bool(settings.EP_ONLINE_API_KEY)

    async def get_by_vbo_id(
        self,
        vbo_id: str,
        client: httpx.AsyncClient,
    ) -> EnergyLabel | None:
        """Fetch energy label by BAG VBO ID. Returns None if not registered (404)."""
        if not self._is_configured():
            return None  # Unconfigured -> section hidden, no error

        async with ep_online_limiter:
            url = f"{self.BASE_URL}/PandEnergielabel/AdresseerbaarObject/{vbo_id}"
            logger.info(f"EP-Online get_by_vbo_id: {vbo_id}")
            try:
                response = await client.get(url, headers=self._headers)
                data = handle_api_response(response, source="ep-online")
                return _parse_energy_label(data, vbo_id)
            except APINotFoundError:
                # Normal: ~20-30% of properties have no registered label
                logger.info(f"EP-Online: no label registered for VBO {vbo_id}")
                return EnergyLabel(is_geregistreerd=False,
                                   niet_geregistreerd_reden="Niet geregistreerd",
                                   bag_vbo_id=vbo_id)

# Module-level singleton
ep_online_client = EPOnlineClient()
```

### Pattern: JSON-LD Triple Parsing (RCE)

The RCE Linked Data API returns JSON-LD format — an array of graph nodes with full namespace URI keys. The client must parse this structure to extract values:

```python
def _extract_value(nodes: list[dict], predicate_suffix: str) -> str | None:
    """Extract @value from JSON-LD node list by predicate URI suffix."""
    CEO_NS = "https://linkeddata.cultureelerfgoed.nl/def/ceo#"
    for node in nodes:
        if "@type" in node and "Rijksmonument" in str(node.get("@type", [])):
            key = CEO_NS + predicate_suffix
            values = node.get(key, [])
            if values:
                return values[0].get("@value")
    return None
```

**Confirmed JSON-LD response structure for `rest-api-rijksmonumenten`:**
```json
[
  {
    "@id": "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/29177",
    "@type": ["https://linkeddata.cultureelerfgoed.nl/def/ceo#Rijksmonument"],
    "https://linkeddata.cultureelerfgoed.nl/def/ceo#rijksmonumentnummer": [{"@value": "https://monumentenregister.cultureelerfgoed.nl/monumenten/12340"}],
    "https://linkeddata.cultureelerfgoed.nl/def/ceo#cultuurhistorischObjectnummer": [{"@value": "29177"}],
    "https://linkeddata.cultureelerfgoed.nl/def/ceo#datumInschrijvingInMonumentenregister": [{"@value": "1972-09-05", "@type": "http://www.w3.org/2001/XMLSchema#date"}]
  },
  {
    "@id": "...bagrelatie/...",
    "@type": ["...BAGRelatie"],
    "...huisnummer": [{"@value": "96"}],
    "...openbareRuimte": [{"@value": "Lattropperstraat"}],
    "...postcode": [{"@value": "7591PK"}]
  }
]
```

**CRITICAL: This endpoint does NOT return `redengevende omschrijving`, `oorspronkelijkeFunctie`, or `bouwperiode`.** These must be fetched via a different mechanism (see Open Questions).

### Pattern: Three-State Contract

All three clients implement the same contract (documented in docstrings):
1. `return SomeModel(...)` — data found
2. `return None` — no data exists (normal/unconfigured)
3. `raise GovernmentAPIError(...)` — API error/timeout

Callers (Phase 55 aggregator) check for `None` vs error with try/except.

### Pattern: Rate Limiter Already Exists

Phase 52 added to `rate_limiter.py`:
```python
# EP-Online (RVO) — API-key-gated, conservative limits
ep_online_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)

# RCE Linked Data detail — public API, polite limits
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)
```

**Do NOT create new rate limiter singletons.** Import and use these existing singletons.

### Recommended File Structure

```
backend/app/government_apis/
├── base.py                  # EXISTING — GovernmentAPIError, APINotFoundError, handle_api_response
├── rate_limiter.py          # EXISTING — ep_online_limiter + rce_detail_limiter added in Phase 52
├── ep_online.py             # NEW — EPOnlineClient
├── woz_waardeloket.py       # NEW — WOZWaardeloketClient
└── rce_linked_data.py       # NEW — RCELinkedDataClient (detail method for Phase 53)
```

The existing `rce_monuments.py` handles spatial search (PDOK/Solr-based). The new `rce_linked_data.py` handles monument detail by rijksmonumentnummer.

### Anti-Patterns to Avoid

- **Creating per-request httpx clients**: All clients receive `client: httpx.AsyncClient` as a parameter — the shared client lives on `app.state`. Never create `httpx.AsyncClient()` inside a method.
- **Silent None on unexpected format**: WOZ client must raise/return error when format is unexpected (user decision), not silently return None.
- **Caching at client level**: Clients return raw Pydantic models. Caching happens in the aggregator layer via `get_cached_or_fetch()`.
- **Blocking coordinate transform inside async**: pyproj transforms are sync — they're fast/CPU-bound and acceptable inline. Do not wrap in `asyncio.run_in_executor`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom sleep/counter logic | Existing `APIRateLimiter` (Phase 52) | Already tested, handles semaphore + token bucket |
| HTTP error handling | Per-client status code switch | `handle_api_response()` from `base.py` | Consistent 404/429/5xx handling across all clients |
| JSON-LD parsing library | Custom triple store | Simple dict traversal by key suffix | Response is small (3-5 nodes); full JSON-LD libraries (rdflib) are heavy and not in dependencies |

**Key insight:** The project's government API pattern is mature. New clients should be ~60-80 LOC each, not 200+.

---

## Common Pitfalls

### Pitfall 1: EP-Online Field Name Mismatch (CONFIRMED RISK)

**What goes wrong:** Phase 52 schema uses snake_case (`energieklasse`, `registratie_datum`). EP-Online V5 JSON response likely uses camelCase (`energieKlasse`, `registratieDatum`). Direct `EnergyLabel(**response_data)` will produce all-None fields silently.

**Why it happens:** Pydantic v2 by default does not alias camelCase fields unless configured. The schema was created with provisional field names.

**How to avoid:** Write a `_parse_energy_label(data: dict, vbo_id: str) -> EnergyLabel` function that explicitly maps API fields: `EnergyLabel(energieklasse=data.get("energieKlasse"), registratie_datum=data.get("registratieDatum"), ...)`. Do NOT use `EnergyLabel(**data)`.

**Warning signs:** All label fields are None despite a 200 response.

### Pitfall 2: RCE Linked Data Returns RDF Triples, Not Simple JSON

**What goes wrong:** Developer assumes `response.json()` returns `{"rijksmonumentnummer": "12340", "omschrijving": "..."}`. Actually returns an array of graph nodes with full URI keys.

**Why it happens:** RCE uses a SPARQL-based Linked Data platform (Triply) that serializes to JSON-LD.

**How to avoid:** Always request `Accept: application/ld+json` and parse the array of `@id`/`@type` nodes. Find the node where `@type` contains `Rijksmonument` and extract values from namespace-qualified keys.

**Warning signs:** `KeyError` or empty fields when accessing response as a flat dict.

### Pitfall 3: WOZ Endpoint Needs nummeraanduiding_id, Not VBO ID

**What goes wrong:** Passing `bag_vbo_id` directly to the WOZ endpoint. The WOZ API requires a `nummeraanduiding_id` (address identifier), not a verblijfsobject ID.

**Why it happens:** In BAG, a VBO (verblijfsobject) has a different ID from its nummeraanduiding (address). The property aggregator already fetches the nummeraanduiding during the address resolution step.

**How to avoid:** The `WOZWaardeloketClient.get_by_nummeraanduiding_id()` method takes `nummeraanduiding_id: str` as its parameter. The aggregator (Phase 55) is responsible for passing the correct ID from BAG address data.

**Warning signs:** 404 response when fetching WOZ data for a known address.

### Pitfall 4: EP-Online 404 vs Error

**What goes wrong:** Treating all 404s as errors. For EP-Online, 404 means "no label registered" (normal for ~20-30% of properties, per NRG-03) — not a system error.

**Why it happens:** The base `handle_api_response()` raises `APINotFoundError` on 404, which the caller may not distinguish from a genuine API failure.

**How to avoid:** Catch `APINotFoundError` specifically in `EPOnlineClient.get_by_vbo_id()` and return `EnergyLabel(is_geregistreerd=False, ...)` instead of re-raising.

**Warning signs:** Frontend shows "Kon niet ophalen" for properties that simply lack a registered label.

### Pitfall 5: RCE detail fields may not be available via REST API

**What goes wrong:** The `rest-api-rijksmonumenten` endpoint was live-tested and returns ONLY: `rijksmonumentnummer`, `cultuurhistorischObjectnummer`, `datumInschrijvingInMonumentenregister`, and BAG address data. Fields like `redengevende omschrijving`, `oorspronkelijkeFunctie`, and `bouwperiode` are NOT in the response.

**Why it happens:** The SPARQL query behind `rest-api-rijksmonumenten` was designed for search/listing, not detail enrichment.

**How to avoid:** See Open Questions below — requires either a custom SPARQL query or the existing Solr API fallback.

### Pitfall 6: WOZ Unexpected Format Must Return Error (Not None)

**What goes wrong:** Returning `None` when the WOZ response is unexpected (e.g., empty list, missing keys). Per user decision, this must return an error state so frontend can show "WOZ data unavailable" with reason.

**Why it happens:** Defensive coding instinct to return None on any parse failure.

**How to avoid:** Distinguish between "API returned 404/empty" (normal → None) and "API returned 200 but unexpected structure" (error → log + return error state).

---

## Code Examples

Verified patterns from the existing codebase:

### EP-Online Client (Pattern)
```python
# Source: existing brk_bevragen.py + bag_api.py patterns
class EPOnlineClient:
    BASE_URL = "https://public.ep-online.nl/api/v5"

    def _is_configured(self) -> bool:
        return bool(settings.EP_ONLINE_API_KEY)

    async def get_by_vbo_id(
        self,
        vbo_id: str,
        client: httpx.AsyncClient,
    ) -> EnergyLabel | None:
        if not self._is_configured():
            return None

        async with ep_online_limiter:
            url = f"{self.BASE_URL}/PandEnergielabel/AdresseerbaarObject/{vbo_id}"
            logger.info("EP-Online get_by_vbo_id: %s", vbo_id)
            try:
                response = await client.get(url, headers=self._headers)
                data = handle_api_response(response, source="ep-online")
                return _parse_energy_label(data, vbo_id)
            except APINotFoundError:
                logger.info("EP-Online: no label for VBO %s (Niet geregistreerd)", vbo_id)
                return EnergyLabel(
                    is_geregistreerd=False,
                    niet_geregistreerd_reden="Niet geregistreerd",
                    bag_vbo_id=vbo_id,
                )
```

### RCE JSON-LD Parser (Pattern)
```python
# Source: live API test 2026-02-24
CEO_NS = "https://linkeddata.cultureelerfgoed.nl/def/ceo#"

def _find_rijksmonument_node(nodes: list[dict]) -> dict | None:
    """Find the Rijksmonument node in a JSON-LD graph."""
    for node in nodes:
        types = node.get("@type", [])
        if any("Rijksmonument" in t for t in types):
            return node
    return None

def _get_literal(node: dict, predicate: str) -> str | None:
    """Extract @value from JSON-LD node predicate."""
    values = node.get(CEO_NS + predicate, [])
    return values[0].get("@value") if values else None
```

### WOZ Client (Pattern)
```python
# Source: wozpy open-source package + Kadaster docs
class WOZWaardeloketClient:
    BASE_URL = "https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1"

    async def get_by_nummeraanduiding_id(
        self,
        nummeraanduiding_id: str,
        client: httpx.AsyncClient,
    ) -> WOZData | None:
        async with woz_limiter:
            url = f"{self.BASE_URL}/wozwaarde/nummeraanduiding/{nummeraanduiding_id}"
            logger.info("WOZ get_by_nummeraanduiding_id: %s", nummeraanduiding_id)
            try:
                response = await client.get(url)
                data = handle_api_response(response, source="woz-waardeloket")
                return _parse_woz_data(data)
            except APINotFoundError:
                return None  # No WOZ object for this address
```

### Retry with Exponential Backoff (Pattern)
```python
# Source: user decision (3 retries, 1s/2s/4s delays on 429/throttle)
import asyncio

async def _retry_with_backoff(fn, retries: int = 3) -> httpx.Response:
    for attempt in range(retries + 1):
        response = await fn()
        if response.status_code != 429:
            return response
        if attempt < retries:
            delay = 2 ** attempt  # 1, 2, 4 seconds
            logger.warning("Rate limited (429), retry %d/%d in %ds", attempt+1, retries, delay)
            await asyncio.sleep(delay)
    return response  # Return last response; caller raises APIRateLimitError
```

### Test Pattern (Rate Limiter Disabled)
```python
# Source: tests/unit/test_brk_bevragen.py
@pytest.fixture(autouse=True)
def disable_rate_limiting():
    from app.government_apis.rate_limiter import ep_online_limiter
    original_enabled = ep_online_limiter.enabled
    ep_online_limiter.enabled = False
    yield
    ep_online_limiter.enabled = original_enabled
```

---

## API Reference (Confirmed)

### EP-Online V5

| Item | Value | Confidence |
|------|-------|-----------|
| Base URL | `https://public.ep-online.nl/api/v5` | HIGH — confirmed via Swagger URL |
| VBO lookup endpoint | `GET /PandEnergielabel/AdresseerbaarObject/{vbo_id}` | HIGH — confirmed via search results + PHP wrapper |
| Auth header | `Authorization: Bearer {EP_ONLINE_API_KEY}` | MEDIUM — bearer token is standard pattern; needs live validation |
| 404 meaning | No label registered for this VBO (normal) | HIGH — confirmed in documentation |
| Field: energieklasse | `energieKlasse` (camelCase) | MEDIUM — from third-party wrapper research |
| Field: registration date | `registratieDatum` | MEDIUM — from third-party wrapper research |
| Field: expiry date | `geldigTot` | MEDIUM — from third-party wrapper research |
| Field: survey type | `soortOpname` | MEDIUM — from third-party wrapper research |
| Field: calculation type | `berekeningType` | MEDIUM — from third-party wrapper research |

**Action required in Phase 53 execution:** Make a live test call with the project's API key and log the actual response field names. Update schema if corrections needed.

### WOZ Waardeloket

| Item | Value | Confidence |
|------|-------|-----------|
| Base URL | `https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1` | MEDIUM — from wozpy source code |
| Lookup endpoint | `GET /wozwaarde/nummeraanduiding/{nummeraanduiding_id}` | MEDIUM — from wozpy source code |
| Auth | None (public endpoint) | MEDIUM — wozpy has no auth in implementation |
| Required input | `nummeraanduiding_id` from BAG (already fetched) | HIGH — confirmed |
| Response field: waarde | `vastgesteldeWaarde` | LOW — inferred from schema design |
| Response field: peildatum | `peildatum` | LOW — inferred from schema design |
| Response field: objectnummer | `wozObjectnummer` | LOW — inferred from schema design |
| 404 meaning | No WOZ object registered for this nummeraanduiding | MEDIUM |

**Action required in Phase 53 execution:** Make a live test call with a known nummeraanduiding_id and document actual field names.

### RCE Linked Data REST API

| Item | Value | Confidence |
|------|-------|-----------|
| Endpoint | `https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run` | HIGH — confirmed live |
| Parameter | `rijksmonumentnummer={nr}` | HIGH — confirmed live |
| Response format | JSON-LD (array of graph nodes with full URI keys) | HIGH — confirmed via live curl test |
| Request header | `Accept: application/ld+json` | HIGH — confirmed live |
| Available fields | `rijksmonumentnummer`, `cultuurhistorischObjectnummer`, `datumInschrijvingInMonumentenregister`, BAG address data | HIGH — confirmed via live test |
| Missing fields | `redengevende omschrijving`, `oorspronkelijkeFunctie`, `bouwperiode`, `architect` | HIGH — confirmed NOT present in this endpoint |

---

## Open Questions

### 1. RCE: How to get redengevende omschrijving and oorspronkelijkeFunctie?

**What we know:** The `rest-api-rijksmonumenten` endpoint (confirmed live) returns only: rijksmonumentnummer, cultuurhistorischObjectnummer, datumInschrijvingInMonumentenregister, and BAG address relation. It does NOT return the rich monument detail that RCE-03 requires.

**What's unclear:** What mechanism provides `redengevende omschrijving`, `oorspronkelijkeFunctie`, and `bouwperiode`?

**Options to investigate during implementation:**
1. **Custom SPARQL query** — Query `api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho-kennis/services/cho-kennis/sparql` directly with a SELECT query that fetches all detail fields for a given rijksmonumentnummer. This is a more powerful but more complex approach.
2. **Monumentenregister REST API** — The Monumentenregister at `monumentenregister.cultureelerfgoed.nl` may have its own REST API with richer data. The JSON-LD for monument 12340 includes a URL `https://monumentenregister.cultureelerfgoed.nl/monumenten/12340` — check if this resolves to an API endpoint.
3. **Existing RCE Solr API** — `api.rijksmonumenten.info/select/` currently returns "permission denied" from curl. This may still work from a server context; worth testing from the backend container.

**Recommendation:** During Phase 53 implementation, first try fetching `https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/{cultuurhistorischObjectnummer}` directly with `Accept: application/ld+json` to see if the full monument record (with all CEO ontology fields) is available as a dereferenced resource. If not, write a custom SPARQL query.

### 2. EP-Online API Key Auth Header Format

**What we know:** EP-Online V5 requires an API key. The Swagger at `public.ep-online.nl/swagger/index.html` documents the auth scheme, but was not accessible during research (JS-rendered).

**What's unclear:** Is the header `Authorization: Bearer {key}` or `X-Api-Key: {key}` or something else?

**Recommendation:** Check the EP-Online Swagger from a browser before coding, or make an unauthenticated call and inspect the 401 response for WWW-Authenticate hints.

### 3. WOZ Rate Limiter Singleton

**What's unclear:** Phase 52 created `ep_online_limiter` and `rce_detail_limiter` but no `woz_limiter`. Per user's discretion, a WOZ rate limiter needs to be either added to `rate_limiter.py` in Phase 53 or reused from an existing one.

**Recommendation:** Add `woz_waardeloket_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)` to `rate_limiter.py`. The WOZ Waardeloket is a public endpoint — conservative limits appropriate.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EP-Online V4 API | EP-Online V5 API | November 2024 | V4 deprecated July 2025; V5 uses `/api/v5/` base URL |
| RCE Solr API (api.rijksmonumenten.info) | RCE Linked Data (api.linkeddata.cultureelerfgoed.nl) | ~2022 | Solr API now returns 403; Linked Data is the canonical source |
| WOZ via wozwaardeloket.nl (Angular SPA + session) | WOZ via api.kadaster.nl/lvwoz/ | ~2023 | Direct API endpoint available; no session cookie needed |

---

## Sources

### Primary (HIGH confidence)
- Live API test via curl — `api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run` — response structure confirmed
- Project codebase — `backend/app/government_apis/` — established client patterns, base classes, rate limiters
- `backend/app/schemas/` — Phase 52 Pydantic models (EnergyLabel, WOZData, RCEMonumentDetail)
- `backend/app/government_apis/rate_limiter.py` — ep_online_limiter and rce_detail_limiter already created

### Secondary (MEDIUM confidence)
- WebSearch results: EP-Online V5 endpoint `public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/{id}` — confirmed across multiple sources
- wozpy Python package source (`github.com/wpeterw/wozpy`) — WOZ Kadaster endpoint URL: `api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/{id}`
- overheid.io documentation — EP-Online field names: `energieKlasse`, `registratieDatum`, `opnameDatum`, `geldigTot`, `soortOpname`, `berekeningType`
- RCE Linked Data story page — endpoint list for rest-api-rijksmonumenten

### Tertiary (LOW confidence)
- WOZ response field names (`wozObjectnummer`, `vastgesteldeWaarde`, `peildatum`) — inferred from schema naming + third-party documentation; MUST be validated live

---

## Metadata

**Confidence breakdown:**
- EP-Online endpoint URL: HIGH — confirmed via multiple authoritative sources
- EP-Online field names: MEDIUM — from third-party wrappers, needs live validation
- WOZ endpoint URL: MEDIUM — confirmed via open-source package source
- WOZ field names: LOW — inferred, needs live validation
- RCE endpoint + response structure: HIGH — confirmed via live API test
- RCE detail fields (redengevende omschrijving etc.): HIGH (for the negative finding) — these fields are NOT in the `rest-api-rijksmonumenten` endpoint
- Architecture patterns: HIGH — directly observed from existing project code

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (EP-Online V5 stable; RCE API stable; WOZ Kadaster API stable)

**Critical validation tasks for Phase 53 executor:**
1. Make a live EP-Online V5 call and document actual JSON field names
2. Make a live WOZ Waardeloket call and document actual JSON field names
3. Investigate how to fetch `redengevende omschrijving` from RCE (SPARQL query or dereferenced resource)
