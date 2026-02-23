# Stack Research — Deep Property Data APIs

**Domain:** Dutch Government Property Data APIs — WOZ-waarde, EP-Online Energielabel, Kadaster BRK Bevragen, RCE Monument Detail Enrichment
**Researched:** 2026-02-24
**Confidence:** HIGH (EP-Online, BRK, RCE Linked Data), MEDIUM (WOZ — access constraints require validation before implementation)

---

## Context: This Is a Subsequent Milestone

The following stack is already implemented and validated. Do NOT re-research or change these:

- FastAPI + asyncio backend, async PostgreSQL via SQLAlchemy 2.x
- `httpx.AsyncClient` — shared client, connection pooling, all government API calls
- `aiolimiter.AsyncLimiter` + `asyncio.Semaphore` composited in `APIRateLimiter` (`government_apis/rate_limiter.py`)
- JSONB caching via `get_cached_or_fetch()` (`services/cache_manager.py`)
- `GovernmentAPIError`, `APINotFoundError`, `handle_api_response()` (`government_apis/base.py`)
- `pydantic-settings` config with `Field()` (`core/config.py`)
- `pyproj.Transformer` — coordinate transforms RD ↔ WGS84 (`government_apis/rce_monuments.py`)

The following are **already implemented in the codebase** (confirmed by code audit):

| File | What it already does |
|------|---------------------|
| `government_apis/brk_bevragen.py` | BRK Bevragen client: mTLS + API key, production+test endpoints, `get_kadastraal_object()`, `get_eigendom()`, no-cache constraint |
| `government_apis/rce_monuments.py` | PDOK OGC spatial query for monument detection, `query_by_location()`, `get_by_monument_number()` stub |
| `government_apis/rate_limiter.py` | `brk_limiter` (2 concurrent, 200/hour), `bag_wfs_limiter`, `plu_wfs_limiter`, `sru_limiter` |
| `core/config.py` | `BRK_API_KEY`, `BRK_CLIENT_CERT_PATH`, `BRK_CLIENT_KEY_PATH`, `BRK_CA_BUNDLE_PATH` settings |

---

## API Integration Specifications

### 1. WOZ-waarde (Property Tax Valuation)

#### Access Reality — Critical Blocker

**HIGH confidence:** The official Kadaster WOZ Bevragen API (Haal Centraal, endpoint: `wozobjecten`) is **restricted to municipalities and specific housing/tax-law use cases**. Commercial SaaS products cannot access it.

**Requirements that Propdex cannot meet:**
- Active OIN (Organisatie Identificatienummer) — government entities only
- PKIOverheid PKIO certificate (Staat der Nederlanden Private Root CA-G1)
- Signed legal agreement with Kadaster for housing-law or tax-collection purposes
- Rate: 10,000 queries/day, 35 queries/minute

**Sources:** Kadaster official page ([WOZ API Bevragen](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen)) states: "only for municipalities" and "limited to tax collection purposes." Confirmed by [data.overheid.nl community discussion](https://data.overheid.nl/community/datarequest/api-voor-woz-waarde-woningen-o-b-v-adres).

#### Recommended Access Path: Kadaster Objectinformatie API

The Objectinformatie API is the commercial Kadaster product for property data including WOZ values. Available to any registered business via Mijn Kadaster.

| Attribute | Value |
|-----------|-------|
| Base URL | `https://kadatawebservice.kadaster.nl/` (exact API path requires Mijn Kadaster login) |
| Auth | API key via `X-Api-Key` header, obtained from Kadata Internet in Mijn Kadaster portal |
| Cost | €1.92 per WOZ-object query (incl. VAT) |
| Response format | JSON |
| Rate limit | Not publicly documented — apply conservative limits (2 concurrent, 100/hour) |
| Registration | [kadaster.nl/zakelijk/producten/vastgoed/objectinformatie](https://www.kadaster.nl/zakelijk/producten/vastgoed/objectinformatie) then Mijn Kadaster |
| Swagger | Available through Kadata Internet after registration |

**No new Python library needed.** Existing httpx handles this. Add `KADASTER_OI_API_KEY` to settings.

Confidence: MEDIUM — pricing and access model verified; exact API endpoint URL path requires Mijn Kadaster login to confirm. **Validate before starting implementation phase.**

#### If Objectinformatie Access Is Delayed: Altum AI WOZ API

- URL: `https://altum.ai/woz-api/`
- Accepts BAG ID (`pand_id` or `verblijfsobject_id`) or postcode + huisnummer
- No official source — aggregates public WOZ Waardeloket data
- Pricing not public — contact sales
- **Verdict:** Fallback only. Use Kadaster official source when available.

#### What NOT to Do

Do NOT scrape `wozwaardeloket.nl`. This violates the site's terms of service and is legally risky for a commercial product. The data is publicly viewable per-address by law, but automated scraping of the portal is not authorized.

---

### 2. EP-Online Energielabel API

#### API Details

**HIGH confidence** — verified from official RVO handleiding published February 2025.

| Attribute | Value |
|-----------|-------|
| Version | **v5** (live since November 2024) |
| Base URL | `https://public.ep-online.nl/api/v5/` |
| Swagger | `https://public.ep-online.nl/swagger/index.html` |
| Auth | API key in `Authorization` header (Bearer scheme per Swagger) |
| Rate limit | Not published — apply conservative limits (5 concurrent, 500/hour) |
| Response format | JSON |
| Cost | Free with registered API key |
| Registration | `https://apikey.ep-online.nl/` — submit org name, org type, email, KvK number; key delivered by email activation within minutes |

**Critical version note:** v3 deprecated January 30, 2025. v4 deprecated July 1, 2025. **Only v5 is current.** Do not implement against v3 or v4.

#### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v5/PandEnergielabel/Adres` | GET | Lookup by postcode + huisnummer (+ optional toevoeging) |
| `GET /api/v5/PandEnergielabel/{bagId}` | GET | Lookup by BAG Pand ID, VBO ID, Ligplaats ID, or Standplaats ID |

The BAG VBO ID lookup is preferable for Propdex because BAG resolution already runs first in `property_aggregator.py` and provides the `verblijfsobject_id`. Use BAG ID when available; fall back to postcode+huisnummer.

#### Response Fields (MEDIUM confidence — inferred from Swagger schema and API documentation)

```json
{
  "Pand_opnamedatum": "2023-01-15",
  "Pand_registratiedatum": "2023-02-01",
  "Pand_energieklasse": "A",
  "Pand_berekeningstype": "Nieuw",
  "Pand_energielabel_is_pand_label": true,
  "VBO_ID": "0363010000123456",
  "Postcode": "1054GL",
  "Huisnummer": 77
}
```

`Pand_energieklasse` values: `A++++` to `G` for residential; `A+++++` to `G` for utility buildings.

#### Caching Strategy

Energy labels are quasi-permanent once registered. Cache at 30 days (`"ep_online": 2592000`). Cache key: `ep_online:label:{verblijfsobject_id}` or `ep_online:label:{postcode}:{huisnummer}`.

#### New Settings Required

```python
EP_ONLINE_API_KEY: str = Field(
    default="",
    description="EP-Online energielabel API key (register at apikey.ep-online.nl)",
)
```

#### New Rate Limiter Required

```python
# EP-Online (RVO) — free, no published rate limit, be conservative
ep_online_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=500)
```

**No new Python library needed.** Existing httpx handles this.

---

### 3. Kadaster BRK Bevragen (Eigendomsdata)

#### Status: Client Already Implemented

`government_apis/brk_bevragen.py` is fully operational. Confirmed by code audit:

- mTLS via Python stdlib `ssl.SSLContext` + PKIOverheid certificate
- Test endpoint: `https://api.brk.kadaster.nl/esd-eto/bevragen/v2/`
- Production endpoint: `https://api.brk.kadaster.nl/esd/bevragen/v2/`
- Two methods: `get_kadastraal_object(identificatie)` and `get_eigendom(identificatie)` with `expand=true`
- Rate limiter: `brk_limiter` (2 concurrent, 200/hour)
- No-cache constraint enforced ("CRITICAL: Eigendomsdata must NEVER be cached" — per Kadaster Tier 3 terms)
- Graceful degradation: if BRK not configured, logs warning and disables queries (does not crash)

**The client exists. The milestone work is wiring it into the property aggregator pipeline and displaying results.**

#### API Facts (Confirmed)

| Attribute | Value |
|-----------|-------|
| Production URL | `https://api.brk.kadaster.nl/esd/bevragen/v2/` |
| Test URL | `https://api.brk.kadaster.nl/esd-eto/bevragen/v2/` |
| Auth | `X-Api-Key` header + PKIOverheid mTLS certificate |
| Cert type | PKIOverheid G1 Private Root, with HRN (Handelsregisternummer for commercial orgs) |
| Subscription | Mijn Kadaster required (€40.20/year base) |
| Cert procurement | Via TSP registered with Logius PKIOverheid (e.g., DigiCert, QuoVadis) |
| Response format | JSON (OAS3 spec) |
| Caching | Prohibited by terms for eigendomsdata (Tier 3 data) |

#### Endpoints Used

```
GET /kadastraalonroerendezaken/{identificatie}
    → Cadastral object: geometry, area, municipality, section, parcel number

GET /kadastraalonroerendezaken/{identificatie}/zakelijkegerechtigden?expand=true
    → Rights holders: owners (eigenaren), right types, expanded person details
```

#### Integration Gap to Close

`brk_bevragen.py` exists but is not called from `property_aggregator.py`. The aggregator currently has placeholder functions in `monument_aggregator.py` for `_fetch_kadaster_monument()` that return stub errors. The parallel fetch pipeline needs:

1. A new `fetch_eigendom()` async function in `property_aggregator.py`
2. The kadastrale aanduiding from the already-fetched PDOK parcels maps to BRK's `identificatie`
3. Add `BRK` as a new parallel task in `asyncio.gather()` call
4. New `EigendomData` Pydantic schema for the response
5. No caching (enforce existing constraint)

---

### 4. RCE Monument Detail Enrichment

#### Status: Spatial Detection Works, Detail Data Missing

Current `government_apis/rce_monuments.py` uses the PDOK OGC API spatial query, which returns only:
- `localid` (monument number, e.g., `"11766.00"`)
- `sitenaam` (monument name)
- `siteprotectionclassification` (generic text)
- `ci_citation` (register URL)
- `legalfoundationdate`

There is no `beschrijving`, `functie`, `architect`, `bouwperiode`, or `oorspronkelijkeFunctie` from this source.

The stub `get_by_monument_number()` in `rce_monuments.py` explicitly states: "Falls back to returning None. The PDOK API doesn't support filtering by monument number directly."

#### New Source: RCE Linked Data REST API

**HIGH confidence** — official RCE documentation, no registration required.

| Attribute | Value |
|-----------|-------|
| Base URL | `https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run` |
| Auth | None — public, no API key required |
| Rate limit | Not formally documented; "excessive use may result in access restrictions" |
| Response format | JSON-LD via `Accept: application/ld+json`; also CSV and Turtle |
| Pagination | `page` + `pageSize` parameters (max 10,000 per page) |
| Cost | Free |
| Registration | Not required |

#### Key Query Parameters

| Parameter | Type | Use |
|-----------|------|-----|
| `rijksmonumentnummer` | string | Primary lookup after PDOK spatial query yields monument number |
| `postcode` | string | Address-first lookup fallback |
| `volledigAdres` | string | Full address string search |
| `straat` | string | Street name filter |
| `monumentaard` | string | `gebouwd` or `archeologisch` |
| `oorspronkelijkeFunctie` | string | Original function filter |
| `status` | string | `rijksmonument`, `voorbeschermd`, `geen rijksmonument` |

#### Example URL

```
https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run?rijksmonumentnummer=12340
```

#### Response Fields Available (MEDIUM confidence — inferred from CEO ontology and API documentation; verify against live API response)

Fields present in JSON-LD response (ignorable `@context` and `@id` prefixes, parse as plain JSON):
- Monument number, name, status
- `monumentaard` (`gebouwd`, `archeologisch`)
- `oorspronkelijkeFunctie` (original building function)
- `volledigAdres`
- `registeromschrijving` (legal description including cultural significance)
- Building period (`bouwperiode`) — available via CEO ontology, confirm in live response
- Architect — available via CEO ontology, confirm in live response

#### Integration Strategy: Two-Step Enrichment

Do NOT replace the PDOK OGC spatial query. Keep it as Step 1 (monument detection by location). Add Step 2 only when a monument is found:

```
Step 1: PDOK OGC API spatial query
  → bbox query → monument_nummer from localid
  → Returns: is_monument=True/False + basic data

Step 2 (only if monument found): RCE Linked Data API
  → rijksmonumentnummer lookup → rich detail fields
  → Returns: beschrijving, functie, bouwperiode, architect, status
```

This avoids unnecessary calls to the RCE Linked Data API for non-monument properties.

#### New Rate Limiter Required

```python
# RCE Linked Data — free, no published limit, conservative
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=100)
```

#### Caching Strategy

Cache at 30 days (`"rce_detail": 2592000`). Monument descriptions are legally fixed once registered. Cache key: `rce:detail:{monument_nummer}`.

**No new Python library needed.** JSON-LD parses as plain JSON with existing `response.json()`. The `@context` and `@id` fields can be ignored for display purposes.

---

## Summary: Stack Changes Required

### New Python Dependencies

**None.** All four API integrations work with the existing library set.

Do NOT add any of the following:
- `zeep` — no SOAP APIs in scope
- `lxml` / `xmltodict` — no XML responses
- `requests` — blocking; httpx already installed
- `python-kadaster` — not a maintained package

### New Settings (add to `core/config.py`)

```python
EP_ONLINE_API_KEY: str = Field(
    default="",
    description="EP-Online energielabel API key (register at apikey.ep-online.nl)",
)
KADASTER_OI_API_KEY: str = Field(
    default="",
    description="Kadaster Objectinformatie API key (via Mijn Kadaster, for WOZ-waarde data)",
)
```

BRK settings (`BRK_API_KEY`, `BRK_CLIENT_CERT_PATH`, `BRK_CLIENT_KEY_PATH`, `BRK_CA_BUNDLE_PATH`) already exist.
RCE Linked Data needs no credentials.

### New Cache TTLs (add to `CACHE_TTL` in `core/config.py`)

```python
"ep_online":  2592000,  # 30 days — energy labels change infrequently
"woz":        2592000,  # 30 days — WOZ values update annually
"rce_detail": 2592000,  # 30 days — monument descriptions rarely change
```

### New Rate Limiters (add to `government_apis/rate_limiter.py`)

```python
# EP-Online (RVO) — free API, no published limit, conservative
ep_online_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=500)

# RCE Linked Data — free, no published limit
rce_detail_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=100)

# Kadaster Objectinformatie — paid per query
kadaster_oi_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=100)
```

### New Government API Client Files

| File | What it does |
|------|-------------|
| `government_apis/ep_online.py` | EP-Online v5 energielabel lookup by VBO ID or postcode+huisnummer |
| `government_apis/rce_monument_detail.py` | RCE Linked Data enrichment call by rijksmonumentnummer |
| `government_apis/kadaster_objectinfo.py` | Kadaster Objectinformatie WOZ lookup — implement after access is confirmed |

### Existing Files to Modify

| File | Change |
|------|--------|
| `government_apis/rce_monuments.py` | Implement `get_by_monument_number()` to call new `rce_monument_detail.py` |
| `services/monument_aggregator.py` | Wire RCE detail enrichment into `_fetch_rce()` result |
| `services/property_aggregator.py` | Add `fetch_eigendom()` and `fetch_energielabel()` to parallel gather |
| `core/config.py` | Add new settings and cache TTLs |
| `government_apis/rate_limiter.py` | Add new limiter instances |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| WOZ data | Kadaster Objectinformatie API | Official WOZ Bevragen API | Municipalities-only; requires OIN — Propdex cannot qualify |
| WOZ data | Kadaster Objectinformatie API | Altum AI WOZ API | Third-party aggregator; not official source; opaque pricing |
| WOZ data | Kadaster Objectinformatie API | wozwaardeloket.nl scraping | ToS violation; legally risky for commercial product |
| RCE detail | RCE Linked Data REST API + rijksmonumentnummer | Replace PDOK OGC spatial query | PDOK spatial query already works for monument detection; only add enrichment on top |
| RCE legacy | RCE Linked Data REST API | rijksmonumenten.info Solr API | Returns HTTP 403 as of early 2026 (documented in existing `rce_monuments.py` comment) |
| EP-Online | Public REST API v5 | Bulk mutatiebestand file download | Bulk download is for data warehousing; per-address lookup is correct for on-demand reports |
| HTTP client | httpx (existing) | zeep, requests, aiohttp | All new APIs return JSON; no SOAP; httpx already installed and async |

---

## Registration Timeline and Access Prerequisites

| API | Register At | Time to Access | Cost | Blocker? |
|-----|------------|---------------|------|----------|
| EP-Online | `https://apikey.ep-online.nl/` | Minutes (email activation) | Free | No — do this first |
| RCE Linked Data | No registration | Immediate | Free | No — no action needed |
| BRK Bevragen | Mijn Kadaster + PKIOverheid cert | Days-weeks (cert procurement is the long pole) | €40.20/yr + per-query | Partially — client exists, cert may already be procured |
| Kadaster Objectinformatie (WOZ) | Mijn Kadaster → Kadata Internet | Days | €1.92/WOZ query | Yes — validate access before planning implementation phase |

**Recommended order:**
1. Register EP-Online API key now (minutes, free)
2. Confirm BRK PKIOverheid cert status — if not procured, start immediately (takes 1-2 weeks)
3. Request Kadaster Objectinformatie access via Mijn Kadaster — confirm endpoint URL and schema
4. RCE Linked Data — no action needed, test live API response to confirm field names

---

## Sources

- Kadaster WOZ Bevragen official — [kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen) (HIGH)
- Kadaster WOZ Bevragen GitHub — [github.com/kadaster/WOZ-bevragen](https://github.com/kadaster/WOZ-bevragen) (HIGH)
- Kadaster WOZ rate limits — [kadaster.nl/-/wat-kost-de-woz-api-huidige-bevragingen-](https://www.kadaster.nl/-/wat-kost-de-woz-api-huidige-bevragingen-) (HIGH)
- Kadaster Objectinformatie API — [kadaster.nl/-/objectinformatie-api](https://www.kadaster.nl/-/objectinformatie-api) (HIGH)
- EP-Online handleiding (RVO, Feb 2025) — [rvo.nl/sites/default/files/2025-02/handleiding-ep-online-opvragen-van-bestanden.pdf](https://www.rvo.nl/sites/default/files/2025-02/handleiding-ep-online-opvragen-van-bestanden.pdf) (HIGH)
- EP-Online public data page — [ep-online.nl/PublicData](https://www.ep-online.nl/PublicData) (HIGH)
- EP-Online Swagger — [public.ep-online.nl/swagger/index.html](https://public.ep-online.nl/swagger/index.html) (HIGH)
- EP-Online API key portal — [apikey.ep-online.nl](https://apikey.ep-online.nl/) (HIGH)
- EP-Online release notes (v5 live Nov 2024, v3 end-of-life Jan 2025) — [ep-online.nl/Home/ReleaseNotes](https://www.ep-online.nl/Home/ReleaseNotes) (HIGH)
- Kadaster BRK Bevragen official — [kadaster.nl/zakelijk/producten/eigendom/brk-bevragen](https://www.kadaster.nl/zakelijk/producten/eigendom/brk-bevragen) (HIGH)
- Kadaster BRK Bevragen GitHub (VNG) — [github.com/kadaster/BRK-bevragen](https://github.com/kadaster/BRK-bevragen) (HIGH)
- RCE Linked Data API documentation — [cultureelerfgoed.github.io/API/](https://cultureelerfgoed.github.io/API/) (HIGH)
- RCE REST API story — [linkeddata.cultureelerfgoed.nl/rce/-/stories/Restfull-API](https://linkeddata.cultureelerfgoed.nl/rce/-/stories/Restfull-API) (HIGH)
- RCE rijksmonumenten query spec — [linkeddata.cultureelerfgoed.nl/rce/-/queries/rest-api-rijksmonumenten/9](https://linkeddata.cultureelerfgoed.nl/rce/-/queries/rest-api-rijksmonumenten/9) (HIGH)
- Codebase audit: `government_apis/brk_bevragen.py` — fully implemented client confirmed (HIGH)
- Codebase audit: `government_apis/rce_monuments.py` — PDOK OGC integration + 403 note confirmed (HIGH)
- Codebase audit: `government_apis/rate_limiter.py` — existing limiters confirmed (HIGH)
- Codebase audit: `core/config.py` — BRK settings, CACHE_TTL dict confirmed (HIGH)
- Codebase audit: `services/property_aggregator.py` — parallel gather pattern confirmed (HIGH)

---

*Stack research for: Propdex — Deep Property Data APIs (WOZ, EP-Online, BRK eigendom, RCE detail)*
*Researched: 2026-02-24*
