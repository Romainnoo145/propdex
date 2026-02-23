# Project Research Summary

**Project:** Propdex — Deep Property Data APIs (v7.0)
**Domain:** Dutch Government Property Data Integration — WOZ, EP-Online Energielabel, BRK Eigendom, RCE Monument Enrichment
**Researched:** 2026-02-24
**Confidence:** HIGH (BRK, EP-Online, RCE) / MEDIUM (WOZ — access path requires pre-milestone validation)

## Executive Summary

This milestone adds four new data sources to Propdex's existing property intelligence pipeline: WOZ-waarde (property tax valuation), EP-Online energielabel (energy label), BRK eigendomsdata (ownership and rights), and enriched RCE monument data (redengevende omschrijving, oorspronkelijke functie, bouwperiode). The architecture is already proven — FastAPI + asyncio + `asyncio.gather()` parallel fetches + JSONB caching + graceful degradation — and all four integrations fit cleanly into this established pattern. No new Python libraries are required. The primary structural addition is a sequential Step 2b in the aggregation pipeline for BRK, which depends on cadastral parcel data from the existing Step 2a and must bypass the cache layer entirely due to Kadaster Tier 3 terms.

The recommended build sequence is: schema layer first (Pydantic models precede aggregator wiring), then API clients, then aggregator integration, then frontend components. EP-Online and RCE enrichment are the lowest-risk integrations — free APIs, no procurement delay, well-documented. Register the EP-Online API key immediately (minutes, free at `apikey.ep-online.nl`). WOZ data carries the most uncertainty: the official Kadaster WOZ Bevragen API is restricted to municipalities and Propdex cannot qualify; the viable path is the unofficial WOZ-waardeloket public JSON endpoint (undocumented, no SLA) or the commercial Kadaster Objectinformatie API (€1.92/query, Mijn Kadaster registration required). This access path decision must be made before Phase 2 starts. BRK has the most operational complexity: PKIOverheid certificate procurement takes 2-4 weeks minimum and must start at milestone kickoff, but the client code already exists and gracefully degrades when unconfigured.

The most critical risk is regulatory: caching BRK eigendomsdata in any persistent layer (PostgreSQL, Redis, files) violates Kadaster Tier 3 terms and GDPR. This must be enforced architecturally — no `get_cached_or_fetch()` call for BRK, and `brk_ownership` must be stripped from `PropertyReportResponse` before saving to the JSONB report store. All other pitfalls (EP-Online V4 sunset, WOZ access restrictions, BRK identificatie format mapping) are well-understood and preventable with documented mitigations.

## Key Findings

### Recommended Stack

No new Python libraries are needed. All four APIs return JSON and work with the existing `httpx.AsyncClient`, `aiolimiter.AsyncLimiter`, and `pydantic-settings` stack. The only new configuration entries are two settings (`EP_ONLINE_API_KEY`, optionally `KADASTER_OI_API_KEY`), three new cache TTL entries, and three new rate limiter instances.

**Core technologies (existing — no change):**
- `httpx.AsyncClient`: All four new API clients use the shared async HTTP client — no new HTTP library needed
- `aiolimiter.AsyncLimiter` + `asyncio.Semaphore` via `APIRateLimiter`: New limiters for EP-Online (5 concurrent, 500/hr) and RCE detail (3 concurrent, 100/hr); Kadaster OI (2 concurrent, 100/hr) if WOZ path chosen
- `get_cached_or_fetch()` in `cache_manager.py`: Used by EP-Online (30d TTL), WOZ (365d TTL), RCE enrichment (30d TTL); explicitly NOT used by BRK
- `pyproj.Transformer`: Already handles RD/WGS84 transforms; existing CRS pattern must not be changed

**New API surface confirmed:**
- EP-Online V5: `GET https://public.ep-online.nl/api/v5/PandEnergielabel/Adres` — free, API key required (minutes to register at `apikey.ep-online.nl`)
- RCE Linked Data: `GET https://api.linkeddata.cultureelerfgoed.nl/queries/rce/rest-api-rijksmonumenten/run?rijksmonumentnummer={nr}` — free, no auth required
- BRK Bevragen V2: Client already implemented in `government_apis/brk_bevragen.py` — needs aggregator wiring only; mTLS + API key
- WOZ: Official WOZ Bevragen API is municipalities-only (blocked for Propdex); use WOZ-waardeloket undocumented public endpoint or Kadaster Objectinformatie API — decision required pre-implementation

**What NOT to add:**
- `zeep` — no SOAP APIs in scope
- `lxml` / `xmltodict` — all APIs return JSON, not XML
- `requests` — blocking; httpx already installed and async
- `python-kadaster` — not a maintained package

### Expected Features

**Must have (table stakes — Dutch property developers expect these):**
- WOZ-waarde + waardepeildatum — always displayed together; the date is mandatory context (WOZ can be 12-24 months behind market)
- Energielabel klasse (A++++ to G) + registratiedatum + geldigheid (10-year validity flag)
- BRK eigenaar type (rechtsvorm: natuurlijk persoon / rechtspersoon / overheid) + zakelijk recht type
- BRK hypotheek indicator (boolean — mortgage/lien present)
- RCE redengevende omschrijving + oorspronkelijke functie (only for monument properties, via two-step enrichment)
- RCE monumentnummer exact match (already extracted from PDOK; needs enrichment from Linked Data)

**Should have (differentiators — make Propdex better than manual research):**
- WOZ-waarde per m² (derived: `woz_waarde / building.oppervlakte` — zero extra API cost, high value)
- Energielabel expiry flag + monument-without-label compliance warning (May 2026 obligation for rijksmonumenten on sale/rental)
- Energielabel + bouwjaar correlation signal (pre-1945 + G label = renovation cost flag)
- BRK multiple owners display with count and rights types
- RCE oorspronkelijke functie + bouwperiode + complex membership when applicable

**Defer to later milestone:**
- WOZ historical values (requires separate WOZ Individuele Bevragingen subscription — different API)
- WOZ vs. marktwaarde delta (requires transaction data not currently available)
- RCE complex membership deep-linking (beyond MVP scope)
- Gemeentelijke monumenten (no national API exists; per-gemeente integration required)

**Anti-features — explicitly do not build:**
- Display of BRK natural person names or addresses (AVG/GDPR exposure — show "Particulier eigenaar" only)
- Caching or storing BRK eigendomsdata in any persistent layer (Kadaster Tier 3 terms)
- Full redengevende omschrijving as a raw text dump (can be 1,000-5,000 words; must be collapsible)
- WOZ bezwaar (objection) workflow — developer use case, not residential consumer
- Applying for official Kadaster WOZ Bevragen API as SaaS (application will be rejected)

### Architecture Approach

All four sources integrate into the existing two-step pipeline with one structural addition: BRK requires a sequential Step 2b after cadastral parcels are available, because it needs `kadastrale_aanduiding` from Step 2a. The recommended pattern uses `asyncio.create_task()` for the cadastral fetch, awaits it specifically before BRK, then awaits the remaining Step 2a tasks — avoiding the latency penalty of waiting for the slowest Step 2a call (DSO can be 3-8s) before starting BRK.

**Major new components:**
1. `government_apis/ep_online.py` (NEW): EP-Online V5 client — lookup by BAG VBO ID, explicit `None` on 404 (not an error state)
2. `government_apis/woz_waardeloket.py` (NEW): WOZ public endpoint client — explicit LOW confidence flag, full graceful degradation, WOZ peildatum always co-fetched
3. `government_apis/rce_monuments.py` (EXTEND): Add `get_detail_by_number()` method calling RCE Linked Data API by rijksmonumentnummer
4. `services/property_aggregator.py` (MODIFY): Add `fetch_energy_label()`, `fetch_woz_data()`, `fetch_brk_ownership()` nested functions; restructure gather into Step 2a/2b; update `total_sections` from 6 to 9
5. `services/monument_aggregator.py` (MODIFY): Two-step RCE enrichment — PDOK spatial detection (Step 1) then Linked Data detail call (Step 2) only when monument is found
6. `schemas/energy.py`, `schemas/woz.py`, `schemas/brk.py` (NEW): Pydantic models for three new report sections
7. `reports/service.py` (MODIFY): Strip `brk_ownership` from `PropertyReportResponse` before saving to JSONB
8. Frontend: 3 new section components (`EnergieLabelSection`, `WOZSection`, `EigendomSection`) + enhanced `MonumentSection` with RCE enrichment fields

**Critical architectural constraint:** `brk_ownership` must be stripped from `PropertyReportResponse` before any save to the `reports.report_data` JSONB column. This is the single most important architectural enforcement in the milestone.

**Build order driven by three hard constraints:**
- Schema models must exist before aggregators import and reference them (Phase 1)
- API clients must exist before aggregator integration (Phase 2)
- BRK Step 2b has a hard data dependency on Step 2a cadastral parcel output

### Critical Pitfalls

1. **Caching BRK eigendomsdata violates Kadaster Tier 3 terms** — never call `get_cached_or_fetch()` for BRK; strip `brk_ownership` before DB save in `reports/service.py`; add integration test asserting no `CachedAPIResponse` row with `source='brk'` exists after eigendom fetch

2. **WOZ official API is restricted to municipalities** — do not apply for WOZ Bevragen API (Kadaster will reject SaaS applications); use unofficial WOZ-waardeloket public endpoint or Kadaster Objectinformatie API (commercial, €1.92/query); validate and decide access path before Phase 2 starts

3. **PKIOverheid certificate procurement takes 2-4 weeks** — start at milestone kickoff regardless of when the BRK code phase begins; BRK client already gracefully degrades when unconfigured; test against ESD-ETO staging environment while awaiting production certificate

4. **EP-Online V4 endpoint was sunset January 30, 2026** — implement only against V5 at `https://public.ep-online.nl/api/v5/`; verify response field names against live V5 Swagger before writing parsers; do not copy field names from older examples

5. **EP-Online 404 is a normal state, not an error** — approximately 20-30% of properties and the majority of non-residential/monument/agricultural properties have no registered label; EP-Online 404 must return `energielabel_status = "niet_geregistreerd"`, must not increment the error count, and must not reduce the completeness score

6. **BRK identificatie must be in NL.IMKAD format** — `NL.IMKAD.KadastraalObject.<id>` is not derivable from the kadastrale aanduiding string; it must come from the PDOK OGC cadastral parcel feature properties or from a BRK search by `kadastraleAanduiding`; validate the PDOK → identificatie → BRK lookup chain with real parcels before building the full integration

7. **RCE coverage is rijksmonumenten only** — the PDOK `rce_inspire_points` dataset does not contain gemeentelijke monumenten; UI must say "Rijksmonument (RCE)" not "Monument" in all labels; also query `rce_inspire_areas` for beschermde stads- en dorpsgezichten

## Implications for Roadmap

Based on the combined research, a four-phase backend build followed by a frontend phase is the correct structure. The dependency chain is strict: schemas before clients before aggregator wiring before frontend. PKIOverheid procurement runs in parallel from day one as an operational track.

### Phase 1: Schema and Config Foundation

**Rationale:** Every downstream component references Pydantic models. Nothing can be built until these types and cache config entries exist. This phase has zero external API dependencies and zero risk — pure Python type definitions following established project patterns.
**Delivers:** `schemas/energy.py` (`EnergyLabel`), `schemas/woz.py` (`WOZData`, `WOZJaarwaarde`), `schemas/brk.py` (`BRKOwnership`, `BRKEigenaar`); extended `PropertyReportResponse` with 3 new Optional fields; extended `MonumentSourceResult` with nullable enrichment fields; new `CACHE_TTL` entries for `ep_online` (30d), `woz` (365d), `rce_detail` (30d); `EP_ONLINE_API_KEY` setting in `core/config.py`
**Addresses:** Table stakes feature schemas — establishes the type contract for all four new data sources
**Avoids:** Runtime `KeyError` from missing `CACHE_TTL` entries (Pitfall 12); `mypy` errors from undefined types in aggregator integration phase
**Research flag:** No research phase needed — Pydantic model patterns are established and consistent throughout the codebase. Follow existing `schemas/monument.py` and `schemas/property.py` as templates.

### Phase 2: API Clients

**Rationale:** Clients depend on schemas (import them) but have no aggregator dependencies. They can be built and verified against live APIs before any pipeline wiring. This is where the WOZ access path decision must be implemented and where EP-Online V5 field names are verified against real responses.
**Delivers:** `ep_online.py` — EP-Online V5 client by VBO ID, graceful `None` on 404; `woz_waardeloket.py` — WOZ public endpoint client with explicit LOW confidence flag; `rce_monuments.py` extended with `get_detail_by_number()` calling RCE Linked Data API; new rate limiters (`ep_online_limiter`, `rce_detail_limiter`) in `rate_limiter.py`
**Uses:** Existing `httpx.AsyncClient`, `APIRateLimiter`, `handle_api_response()` from `government_apis/base.py`
**Avoids:** EP-Online V4 sunset (Pitfall 5) — pin to V5 Swagger from day one; WOZ API restriction (Pitfall 2) — use waardeloket or Objectinformatie approach, not official WOZ Bevragen API
**Research flag:** Validate EP-Online V5 field names against live Swagger with a real VBO ID before writing the parser — V4 vs V5 field names differ. Confirm WOZ-waardeloket endpoint JSON structure with a real address (nummeraanduidingidentificatie). Test RCE Linked Data API for a known rijksmonumentnummer (e.g., 12340) to confirm `volledigeOmschrijving`, `oorspronkelijkeFunctie`, `bouwstijl` field availability in the REST response.

### Phase 3: Aggregator Wiring (Backend Integration)

**Rationale:** This is the structurally complex change — rewiring `asyncio.gather()` into Step 2a/2b, integrating all four new data sources, and enforcing the BRK no-cache constraint at every touch point. Must happen after Phases 1 and 2 are complete and type-checked. The BRK integration requires the most care because of the data dependency on cadastral parcels and the regulatory constraint on storage.
**Delivers:** `property_aggregator.py` with `fetch_energy_label()`, `fetch_woz_data()`, `fetch_brk_ownership()` nested functions; Step 2a/2b gather restructure using `asyncio.create_task()` for cadastral to avoid blocking BRK on slow DSO calls; `monument_aggregator.py` with two-step RCE enrichment (`_fetch_rce_with_detail()`); `completeness_score` `total_sections` denominator updated (6 → 9); `reports/service.py` with `brk_ownership` stripped before JSONB save
**Avoids:** BRK caching violation (Pitfall 1) — no `get_cached_or_fetch()` call for BRK, `brk_ownership` stripped before DB save; BRK blocking on DSO latency (ARCHITECTURE.md Anti-Pattern 4) — `asyncio.create_task()` pattern; BRK identificatie format (Pitfall 7) — validate PDOK OGC field names before implementing; WOZ multiple objects per apartment (Pitfall 9) — filter by `nummeraanduidingidentificatie`; PDOK OGC CRS (Pitfall 10) — use existing RD coordinate + explicit `bbox-crs` header pattern
**Research flag:** Validate which field in the PDOK OGC cadastral parcel response carries the `NL.IMKAD.KadastraalObject.<id>` format needed for BRK lookup — this must be confirmed against a real PDOK response before implementing `fetch_brk_ownership()`. Confirm `nummeraanduidingidentificatie` is returned from the existing BAG address resolution step in `property_aggregator.py`.

### Phase 4: Frontend Components

**Rationale:** Frontend depends on stable backend types and a working API endpoint. Building after Phase 3 means components can be verified against real data. All three new section components follow the established `GebouwSection`/`KadasterSection` pattern.
**Delivers:** `EnergieLabelSection.tsx` — label badge (A-G with EU color coding), registratiedatum, geldigheid, expired flag, monument compliance warning; `WOZSection.tsx` — WOZ-waarde + peildatum always together, per-m² calculation, LOW confidence disclaimer; `EigendomSection.tsx` — owner list with partial name obfuscation for natural persons, rights type, hypotheek indicator, "Actueel opgevraagd" timestamp instead of cache age; enhanced `MonumentSection` with RCE enrichment fields (volledigeOmschrijving collapsible, oorspronkelijkeFunctie, bouwstijl, rijksmonument link); TypeScript interfaces in `property.ts` for all new sections; `ReportDetailPage.tsx` wired with new sections
**Addresses:** All display format recommendations from FEATURES.md — energielabel EU color scale, WOZ peildatum always shown, BRK partial name display, collapsible redengevende omschrijving
**Avoids:** WOZ display without peildatum (Pitfall 13); "geen monument" false confidence (Pitfall 6 UX); energielabel shown without expiry status; BRK data without data source attribution
**Research flag:** No research phase needed — React section component pattern is established in existing report sections. Follow `GebouwSection.tsx` and `KadasterSection.tsx` as structural templates.

### Phase 5: BRK Live Integration (Operational Track — Parallel to Phases 1-4)

**Rationale:** PKIOverheid certificate procurement is independent of all code work and takes 2-4 weeks minimum. This track starts at milestone kickoff and runs in parallel. Phases 1-4 code must gracefully degrade when BRK is unconfigured (`brk_client._configured = False`); this phase plugs in real credentials when procurement completes.
**Delivers:** PKIOverheid certificate procured from an approved CA (DigiCert, QuoVadis, Sectigo); certificate files installed and paths configured in staging env; BRK switched from test endpoint (ESD-ETO) to production (ESD); `EigendomSection` showing live data instead of "Eigendomsdata niet geconfigureerd" state; Redis-backed rate limiter for BRK to prevent multi-worker rate limit violations (Pitfall 11); certificate expiry logging at application startup with warning when < 60 days remain
**Avoids:** Certificate procurement blocking BRK demo (Pitfall 3) — start procurement day one; BRK rate limit multi-worker violation (Pitfall 11) — Redis-backed limiter before production traffic; certificate expiry surprise — startup monitoring

### Phase Ordering Rationale

- Schema before aggregator is a hard Python import-time dependency
- API clients before aggregator makes isolated testing feasible before pipeline integration
- BRK Step 2b is a hard data dependency on Step 2a cadastral parcel output — cannot be parallelized with Step 2a
- Frontend after backend because testing against mocks would require maintaining a mock layer that diverges from actual API responses
- PKIOverheid procurement is operational (not code), runs in parallel from day one to avoid being the late blocker
- The completeness_score denominator change (6 → 9) retroactively affects all existing stored reports — plan whether to recalculate or version-guard during Phase 3 planning

### Research Flags

Phases needing live API validation during planning or early Phase 2 execution:
- **Phase 2 (API Clients):** Validate EP-Online V5 response schema with a real VBO ID before writing the parser — field names changed between V4 and V5. Validate WOZ-waardeloket endpoint JSON structure with a real nummeraanduidingidentificatie. Test RCE Linked Data API for a known rijksmonumentnummer to confirm field availability.
- **Phase 3 (Aggregator):** Validate which PDOK OGC cadastral parcel property field carries the BRK-compatible `NL.IMKAD.KadastraalObject.<id>` identificatie. Confirm `nummeraanduidingidentificatie` is returned from existing BAG resolution.
- **Phase 5 (BRK Live):** Confirm current PKIOverheid certificate status in the existing environment — check whether a certificate was procured for a prior milestone or whether fresh procurement is required.
- **Pre-milestone (WOZ access path):** Decide between WOZ-waardeloket undocumented endpoint vs. Kadaster Objectinformatie API before Phase 2 starts. Register for Kadaster Objectinformatie access via Mijn Kadaster immediately to assess timeline and confirm endpoint URL.

Phases with standard well-understood patterns (skip research-phase):
- **Phase 1 (Schemas):** Pydantic model patterns are fully established in the codebase
- **Phase 4 (Frontend):** React section component pattern is established in existing report sections

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs return JSON; existing httpx handles everything; no new libraries; settings patterns confirmed by codebase audit; EP-Online V5, RCE Linked Data, and BRK Bevragen V2 all verified against official documentation |
| Features | HIGH | Official Dutch government documentation + direct codebase analysis of existing schema gaps; feature boundaries are precisely identified with source-level field mappings |
| Architecture | HIGH | Based on direct codebase analysis of `property_aggregator.py`, `monument_aggregator.py`, `cache_manager.py`, `brk_bevragen.py`, `schemas/property.py`; integration points are explicit and the extension pattern is consistent |
| Pitfalls | HIGH | Based on official Kadaster/RVO/EP-Online documentation + existing code comments that already document BRK no-cache constraint; regulatory pitfalls confirmed against official terms of service |

**Overall confidence:** HIGH

### Gaps to Address

- **WOZ access path (pre-milestone decision):** Kadaster Objectinformatie API is the recommended official commercial path (€1.92/query), but the exact endpoint URL requires Mijn Kadaster login to confirm and the timeline for access approval is unknown. The WOZ-waardeloket undocumented endpoint is the fallback but carries LOW confidence and no SLA. This decision must be made before Phase 2 begins. Register for Objectinformatie access immediately.

- **EP-Online multi-tenant API key terms:** RVO terms state the API key is "personal and may not be shared with third parties." For a multi-tenant SaaS using a shared backend key, RVO guidance is needed. Contact RVO at `fbni@rvo.nl` at milestone start to confirm whether a single backend key serving multiple organizations is permitted under the indirect-use exemption.

- **EP-Online V5 response schema field names:** The exact field names in the V5 JSON response were inferred from Swagger and the RVO handleiding but not directly verified with a live VBO ID call. Verify before writing the parser — V4 and V5 field naming is not identical.

- **RCE Linked Data field availability:** `bouwstijl`, `bouwperiode`, and architect fields are referenced in the CEO ontology but their presence in the REST API JSON response was not directly confirmed. Test with a known rijksmonumentnummer early in Phase 2.

- **PDOK OGC cadastral identificatie field name:** It is not confirmed which property field in the PDOK cadastral OGC feature response carries the `NL.IMKAD.KadastraalObject.<id>` format. This must be validated against a real PDOK response before Phase 3 implementation.

- **completeness_score versioning:** Increasing `total_sections` from 6 to 9 retroactively lowers completeness scores on all stored reports. Decide during Phase 3 planning whether to (a) accept the regression, (b) add a `score_version` field, or (c) trigger a background recalculation.

## Sources

### Primary (HIGH confidence)
- Kadaster WOZ API Bevragen official — `kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen` — municipal-only access confirmed; SaaS blocked
- Kadaster WOZ Bevragen GitHub — `github.com/kadaster/WOZ-bevragen` — OIN + PKIOverheid requirement confirmed
- Kadaster Objectinformatie API — `kadaster.nl/-/objectinformatie-api` — commercial WOZ access path confirmed
- EP-Online Public API V5 Swagger — `public.ep-online.nl/swagger/index.html` — V5 endpoint structure
- RVO EP-Online handleiding (February 2025) — `rvo.nl/sites/default/files/2025-02/handleiding-ep-online-opvragen-van-bestanden.pdf` — V5 confirmed current, V3 end-of-life January 2025
- EP-Online release notes — `ep-online.nl/Home/ReleaseNotes` — V4 sunset date January 30, 2026 confirmed
- RCE Linked Data API documentation — `cultureelerfgoed.github.io/API/` — REST endpoint, no auth, parameters confirmed
- RCE rijksmonumenten query spec — `linkeddata.cultureelerfgoed.nl/rce/-/queries/rest-api-rijksmonumenten/9` — query parameters and response shape
- Kadaster BRK Bevragen official — `kadaster.nl/zakelijk/producten/eigendom/brk-bevragen` — Tier 3 never-store terms, mTLS confirmed
- VNG Realisatie BRK Bevragen GitHub — `github.com/VNG-Realisatie/Haal-Centraal-BRK-bevragen` — V2 API specification
- RCE energielabelplicht rijksmonumenten — `cultureelerfgoed.nl/onderwerpen/d/duurzaamheid/energielabel-voor-monumenten/energielabelplicht---vraag--antwoord` — May 2026 obligation confirmed
- Propdex codebase audit (all of): `government_apis/brk_bevragen.py`, `government_apis/rce_monuments.py`, `services/property_aggregator.py`, `services/monument_aggregator.py`, `services/cache_manager.py`, `government_apis/rate_limiter.py`, `core/config.py`, `schemas/property.py`, `schemas/monument.py` — existing patterns, integration gaps, and constraints confirmed

### Secondary (MEDIUM confidence)
- WOZ-waardeloket.nl — public website with undocumented JSON endpoint at `/woz-api/v1/objecten/nummeraanduidingen/{id}`; multiple Dutch data aggregators (Altum AI, Matrixian) use this approach
- RCE CEO ontology — field availability for `bouwperiode`, architect, `oorspronkelijkeFunctie` inferred but not directly tested against REST API JSON response
- data.overheid.nl community discussion on WOZ access — confirms commercial SaaS access restrictions; MEDIUM confidence (community, not official)

### Tertiary (LOW confidence)
- WOZ-waardeloket internal API endpoint — reverse-engineered from public website; no SLA, no official documentation; endpoint may change without notice
- Altum AI WOZ API — confirmed as commercial alternative at `altum.ai/woz-api/`; pricing not public; not recommended as primary source

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
