# Pitfalls Research: Dutch Government API Integration

**Domain:** PropTech SaaS — adding WOZ-waarde, Energielabel (EP-Online), BRK eigendomsdata, and improved RCE monument data to an existing property intelligence platform
**Researched:** 2026-02-23
**Confidence:** HIGH (based on Propdex codebase inspection + verified official Dutch government documentation)
**Scope:** Pitfalls specific to integrating WOZ, EP-Online, BRK Bevragen v2, and PDOK RCE OGC API into an existing platform that already handles PDOK BAG, DSO, PDOK Kadastral, and SRU Bekendmakingen

---

## Critical Pitfalls

Mistakes that cause regulatory violations, data loss, authentication failures, or architectural rewrites.

---

### Pitfall 1: Caching BRK Eigendomsdata Violates Kadaster Terms (Tier 3 Never-Store)

**What goes wrong:**
The existing `get_cached_or_fetch()` pattern in `cache_manager.py` stores all API responses in `CachedAPIResponse` (PostgreSQL). BRK eigendomsdata (owner names, BSN-adjacent data, zakelijke rechten) falls under Kadaster's Tier 3 "never store" terms. Feeding eigendomsdata through the standard caching pipeline persists personal ownership data in your database indefinitely, violating the BRK access agreement and GDPR.

**Why it happens:**
The natural developer instinct is to reuse the existing `get_cached_or_fetch()` wrapper for every new API source. Propdex already does this for BAG, Kadaster cadastral parcels, RCE, and DSO. BRK eigendomsdata looks like another government API, so developers apply the same pattern without reading the specific licensing terms.

**How to avoid:**
The `BRKBevragenClient` in `brk_bevragen.py` already has the correct comment (`CRITICAL: Eigendomsdata must NEVER be cached or stored per Kadaster Tier 3 terms`). Enforce this at the aggregator level: the BRK integration MUST NOT call `get_cached_or_fetch()`. Instead, fetch live on each request and pass data directly to the response payload without touching `CachedAPIResponse`. Add a runtime assertion that blocks any future developer from adding a cache key for the `brk` source to `CACHE_TTL` in `config.py`.

**Warning signs:**
- Any `CACHE_TTL` entry for `"brk_eigendom"` or similar appearing in `config.py`
- `get_cached_or_fetch(source="brk", ...)` appearing in `property_aggregator.py`
- `CachedAPIResponse` rows with `source = 'brk'` appearing in the database

**Phase to address:**
BRK integration phase — must be the first thing verified before any eigendom data flows through the system. Add an integration test that asserts no BRK eigendom response is written to the cache table.

---

### Pitfall 2: WOZ Official API Access Is Restricted — SaaS Use Is Not Permitted

**What goes wrong:**
Developers assume WOZ-waarde is public data (it's visible on the WOZ-waardeloket website) and implement integration using the official Kadaster WOZ Bevragen API. Access to this API is legally restricted: it is only permitted for use under the Housing Act (Huisvestingswet), the Good Landlord Act (Wet goed verhuurderschap), or tax collection. A commercial property intelligence SaaS does not qualify. Kadaster will reject the access application, causing a blocking dependency.

**Why it happens:**
WOZ values are public in the sense that citizens can look them up for their own property. But the WOZ Bevragen API that provides programmatic access has strict permitted-use restrictions in the terms of service. The distinction between "this data is visible on a government website" and "you are permitted to API-integrate it" is easy to miss when reading the marketing copy for the API.

**How to avoid:**
Do not apply for direct WOZ Bevragen API access for Propdex. Instead, use the unofficial WOZ-waardeloket approach: the waardeloket site exposes a public-facing endpoint (not officially documented as a developer API) that returns JSON for individual property lookups. Multiple Dutch property data aggregators (Altum AI, Matrixian, Nederland Postcode API) wrap this. Alternatively, procure WOZ data through a licensed data aggregator (Altum AI, Matrixian) that has the commercial rights to redistribute. The WOZ data itself is public information; the restriction is on the official government API, not on display of individual property values obtained through the website.

**Warning signs:**
- Applying for WOZ Bevragen API with a SaaS/commercial purpose description — Kadaster will reject the application
- "Access only granted under Housing Act, Good Landlord Act, or Tax Collection" phrase in the API terms
- Planning phases that depend on WOZ Bevragen API approval before being able to proceed

**Phase to address:**
WOZ integration research/spike phase — decision must be made upfront: unofficial waardeloket endpoint, or licensed aggregator. Do not proceed with official API application.

---

### Pitfall 3: PKIOverheid Certificate Provisioning Blocks BRK for Weeks

**What goes wrong:**
BRK Bevragen requires a PKIOverheid (PKIO) certificate with an Organization Identification Number (OIN) or HRN (Trade Registration Number). Obtaining a PKIOverheid certificate is a formal procurement process: you must apply through a certified certificate authority (DigiCert, Sectigo, QuoVadis), provide organizational verification, and wait for the CA's review process. This typically takes 2-4 weeks. If a phase plans to demo BRK data, the demo will fail if certificate procurement wasn't started 3+ weeks earlier.

**Why it happens:**
The BRK client code in `brk_bevragen.py` already exists and gracefully degrades when unconfigured. Developers see the code is "ready" and assume turning it on is just setting environment variables. In reality, the certificates must be procured before those env vars can be populated with real values.

**How to avoid:**
Start the PKIOverheid certificate application process at the beginning of the milestone, not when the BRK phase begins. The Kadaster test environment (ESD-ETO staging) accepts certificates from the same CA chain, allowing integration testing while awaiting production certificate approval. Plan for 3-week lead time minimum. Also note: certificates expire (maximum 3 years for PKIOverheid OV certificates, G3 root until 2028, G4 transition required after). Add a certificate expiry monitoring step to the deployment checklist.

**Warning signs:**
- BRK phase starts without certificate application already in progress
- `BRK_CLIENT_CERT_PATH` pointing to an expired or self-signed certificate in staging
- `ssl.SSLError` in logs from `_create_brk_ssl_context()` at startup when cert files exist but are malformed

**Phase to address:**
Milestone kickoff — start certificate procurement process immediately, before any BRK phase work begins.

---

### Pitfall 4: EP-Online API Key Is Personal and Cannot Be Used for Multi-Tenant SaaS

**What goes wrong:**
The EP-Online public REST API requires an API key. Per the EP-Online terms of use: "The API-key is personal and may not be made available to third parties." The Propdex backend uses a single shared API key to serve all tenant organizations. Sharing one API key across multiple organizations technically violates the personal-key restriction.

**Why it happens:**
Most SaaS platforms use shared API keys for third-party integrations — it's the standard backend pattern. The EP-Online terms use language ("personal") that is unusual for a B2B API and is often overlooked. The terms also restrict direct redistribution of raw data at individual level to third parties in large quantities, though indirect use (value-added service on a property detail page) is explicitly permitted.

**How to avoid:**
Request clarification from RVO (fbni@rvo.nl) on whether a single API key used in a shared backend to serve multiple end users counts as "made available to third parties." Based on the RVO guidance that indirect sharing is permitted ("as part of information on a website for buying or renting homes"), a shared backend key is most likely acceptable. Document this interpretation and the RVO clarification response. If rejected, investigate whether per-organization API keys are feasible. Do not launch without this clarification.

**Warning signs:**
- EP-Online API key configured in `.env` as a global `EP_ONLINE_API_KEY` setting without reviewing terms
- No documented confirmation from RVO on multi-tenant usage

**Phase to address:**
EP-Online integration phase — legal/terms review must happen before development starts, not after.

---

### Pitfall 5: EP-Online API Version Mismatch — V4 Was Sunset January 2026

**What goes wrong:**
EP-Online Public API V4 was discontinued on January 30, 2026. Any integration built referencing V4 documentation, V4 endpoints, or V4 response schemas will fail immediately. The current version is V5 (live since November 2024), with its Swagger at `https://public.ep-online.nl/swagger`.

**Why it happens:**
Documentation found via Google often references the V4 API, which was the stable version for years. GitHub examples, Stack Overflow answers, and third-party integration guides written before November 2024 will use V4 endpoints and response structures. A developer following an older guide builds against a dead endpoint.

**How to avoid:**
Always reference `https://public.ep-online.nl/swagger` directly for the current API schema. The V5 endpoint for address-based lookup is `GET /api/v5/PandEnergielabel/Adres` with `postcode` and `huisnummer` as required parameters. Do not copy response field names from V4 examples — verify against the V5 Swagger schema.

**Warning signs:**
- Client code referencing `/api/v4/` in the URL
- Response parsing for V4-specific field names that no longer exist in V5
- HTTP 404 or 410 on requests to EP-Online (endpoint no longer exists)

**Phase to address:**
EP-Online implementation phase — pin implementation to V5 Swagger from day one.

---

### Pitfall 6: RCE PDOK OGC API Only Covers Rijksmonumenten — Gemeentelijke Monumenten Are Absent

**What goes wrong:**
The current `RCEMonumentClient` queries `rce_inspire_points` via the PDOK beschermde-gebieden-cultuurhistorie OGC API. This dataset contains only nationally designated monuments (rijksmonumenten) and protected town/village views (stads- en dorpsgezichten). It does NOT contain gemeentelijke monumenten (municipal monuments). A property that is a gemeentelijk monument will return `is_monument=False` from the current implementation — a false negative that misleads users about development restrictions.

**Why it happens:**
The PDOK dataset description says it "shows Rijksmonumenten, Stads- en Dorpsgezichten, and UNESCO sites." Developers see "monuments" and assume it is comprehensive. Gemeentelijke monumenten are maintained by individual municipalities (gemeenten) and are NOT published to a national PDOK layer.

**How to avoid:**
For rijksmonumenten: the PDOK OGC API is correct and sufficient. For gemeentelijke monumenten: there is no national API. Each gemeente maintains its own register. The Monumenten.nl and Monumentengemeenten.nl platforms aggregate some of this data. Consider:
1. Displaying a clear UI disclaimer: "Rijksmonument status via RCE/PDOK. Gemeentelijk monument status is niet centraal beschikbaar — raadpleeg de gemeente."
2. For the RCE improvement goal, enhance the PDOK query to also check the `rce_inspire_areas` collection for beschermde stads- en dorpsgezichten (protected area) containment, which provides a geographic boundary check for area-level designations.
3. Do NOT promise "complete monument coverage" in any Propdex UI copy.

**Warning signs:**
- `consensus_status = "geen_monument"` returned for a property that users report is a gemeentelijk monument
- No distinction in the UI between "not a rijksmonument" and "monument status unknown"
- `monument_type` hardcoded to `"rijksmonument"` in `_fetch_rce()` without considering area-level designations

**Phase to address:**
RCE improvement phase — must add `rce_inspire_areas` bbox query alongside the existing `rce_inspire_points` query, and update UI copy to accurately scope what is and isn't covered.

---

### Pitfall 7: BRK Identificatie Format Must Match Exactly — No Fuzzy Lookup

**What goes wrong:**
BRK Bevragen V2 uses `NL.IMKAD.KadastraalObject.<number>` as the identificatie format for `GET /kadastraalonroerendezaken/{identificatie}`. The identificatie must be obtained from the cadastral parcel data, not guessed or constructed from a kadastrale aanduiding string like "AMSTERDAM M 1234". Using the wrong format returns a 404 that looks like "property not found" but is actually a malformed identifier.

**Why it happens:**
The PDOK Cadastral OGC API already returns parcel features with geometry and attributes like `perceelnummer`, `sectie`, and `kadastrale_gemeente_waarde`. Developers may try to construct a BRK identificatie from those fields. However, the BRK `identificatie` (NEN3610 format) is a separate internal identifier not directly derivable from the kadastrale aanduiding string without a lookup. The correct flow is: PDOK OGC API parcel feature → extract `identificatie` or `kadastraalaanduidingcode` field → use that as the BRK lookup key.

**How to avoid:**
Inspect the PDOK Cadastral OGC API response for the `identificatie` field (it may appear as `kadastraalaanduidingcode` or a similar field in the properties). Verify what field name the PDOK OGC API uses for the BRK-compatible identifier. If PDOK does not expose the NL.IMKAD identificatie, use BRK's own search endpoint with `kadastraleAanduiding` query parameter (supports gemeente code + sectie + nummer) to resolve the identificatie. Do not construct it from scratch.

**Warning signs:**
- HTTP 404 from BRK for parcels that definitely exist
- Identificatie strings that look like `"Amsterdam M 1234"` rather than `"NL.IMKAD.KadastraalObject.12345678910000"`
- BRK lookup failing on parcels that were recently created or split (new parcels may not yet appear in BRK Bevragen)

**Phase to address:**
BRK integration phase — validate the identificatie lookup chain (PDOK → identificatie field → BRK) with real parcels before building the full integration.

---

## Moderate Pitfalls

---

### Pitfall 8: Energielabel "Not Found" Is Normal — Not an Error

**What goes wrong:**
EP-Online returns a 404 (or empty result) for properties that have no registered energy label. The current `handle_api_response()` in `base.py` raises `APINotFoundError` on 404. If EP-Online 404s are surfaced as errors, the aggregator marks energielabel as "failed" rather than "not available," causing misleading error messages and incorrect completeness scores.

**Why it happens:**
The generic 404 handler treats all 404s as "resource not found = error." For BAG addresses, a 404 means the address genuinely doesn't exist (a real error). For EP-Online, a 404 means the building exists but has no registered label — a completely normal and expected state, especially for older buildings, agricultural properties, industrial buildings, and buildings where the label was voluntarily registered. Approximately 20-30% of Dutch residential properties and the majority of non-residential properties do not have a registered energielabel in EP-Online.

**How to avoid:**
In the EP-Online client, catch 404 responses and return a structured `None` or `{"label": None, "registered": False}` rather than raising an exception. The aggregator should treat this as `energielabel_status = "niet_geregistreerd"` — a valid data state, not an error. Do NOT increment the error counter or reduce the completeness score for an absent energielabel.

**Warning signs:**
- EP-Online integration always showing errors for a large proportion of properties
- `errors.append("Energielabel data unavailable")` in aggregator logs for properties in older neighborhoods
- Completeness score dropping for perfectly valid properties that simply don't have a label

**Phase to address:**
EP-Online implementation phase — model the "no label" state explicitly in the schema before writing the client.

---

### Pitfall 9: WOZ Data Has Multiple Objects Per Address (VvE / Appartementen)

**What goes wrong:**
For apartment buildings with a VvE (homeowners association) structure, there may be multiple WOZ objects per building — one per apartment unit. Querying by address (postcode + huisnummer) may return multiple WOZ objects. Blindly returning the first result may return the wrong unit's WOZ value, or the total building value rather than the individual apartment value.

**Why it happens:**
A single postal address in BAG can map to multiple verblijfsobjecten (apartment units), each with their own WOZ taxatie. The query by postcode + huisnummer resolves to the building but not necessarily to the specific unit. In BAG terms, the `nummeraanduidingidentificatie` (specific unit's address ID) is required to disambiguate, not just the postcode + housenumber.

**How to avoid:**
Pass the BAG `nummeraanduidingidentificatie` (already available from the address resolution step in `property_aggregator.py`) as an additional filter in the WOZ query. If the WOZ source does not support filtering by nummeraanduidingidentificatie, display all WOZ objects returned and let the user select, or pick the one whose verblijfsobject ID matches the BAG address resolution result.

**Warning signs:**
- WOZ query returns a list with more than one item for addresses like "Teststraat 1" where multiple units exist
- WOZ value shown significantly higher than expected for a single apartment (may be the whole building value)
- Wrong tax year data shown (multiple objects with different waardepeildatum)

**Phase to address:**
WOZ integration phase — design the disambiguation logic before implementation, not as an afterthought.

---

### Pitfall 10: PDOK RCE OGC API Bbox CRS Must Be Specified Explicitly

**What goes wrong:**
The existing `RCEMonumentClient` already passes `"bbox-crs": "http://www.opengis.net/def/crs/EPSG/0/28992"` correctly. However, if any developer modifies the bbox query to use WGS84 coordinates (e.g., lat/lon from a frontend map click) without updating the CRS parameter, the spatial filter silently uses the wrong coordinate system. A bbox of `[4.9, 52.3, 5.0, 52.4]` (WGS84 Amsterdam) interpreted as RD coordinates points to a location in the middle of the North Sea.

**Why it happens:**
PDOK OGC API Features spec defaults to WGS84 (EPSG:4326) for bbox when no CRS is specified. Propdex stores coordinates in RD (EPSG:28992) internally and passes them correctly. If coordinates come from a different source (frontend GeoJSON click, which uses WGS84), and the conversion step is missed, the query returns zero results with no error — it just finds no monuments near the North Sea.

**How to avoid:**
The current pattern (RD → bbox with explicit CRS header) is correct. Do not change it. When extending the RCE query to also check `rce_inspire_areas`, use the same RD + explicit CRS pattern. Add a coordinate sanity check: valid RD X range is 0-280000, valid Y range is 300000-625000. Reject any coordinates outside these bounds before making the API call.

**Warning signs:**
- Monument queries returning zero results for addresses in Amsterdam city center (known monument-dense area)
- Bbox values like `[4.89, 52.37, 4.91, 52.38]` appearing in logs (these are WGS84, not RD)
- `bbox-crs` header absent from PDOK requests

**Phase to address:**
RCE improvement phase — add coordinate validation helper and use it before all PDOK OGC spatial queries.

---

### Pitfall 11: BRK Rate Limit Is Conservative and Must Not Be Shared Across Workers

**What goes wrong:**
The `brk_limiter` in `rate_limiter.py` is configured as `max_concurrent=2, max_per_hour=200` and is a module-level singleton. If the FastAPI application runs with multiple worker processes (e.g., `uvicorn --workers 4`), each worker has its own `brk_limiter` instance. Four workers with 200 req/hour each = 800 effective requests/hour, far exceeding the Kadaster limit and risking API key suspension.

**Why it happens:**
Python's asyncio rate limiters are in-process only. Module-level singletons are not shared across OS processes. The existing code was designed for single-worker deployment (or single-process development), which is likely fine for MVP but breaks when production scales horizontally.

**How to avoid:**
For BRK specifically (paid API with strict limits), implement rate limiting at the Redis level rather than in-process. Use a Redis-backed rate limiter (e.g., `limits` library with Redis backend) for BRK. Alternatively, enforce that BRK calls only go through a dedicated background worker (ARQ queue) where a single worker process is guaranteed. Document the single-worker constraint for BRK in the deployment notes.

**Warning signs:**
- Multiple `uvicorn` worker processes running in production
- HTTP 429 responses from BRK after periods of normal usage
- Rate limit not being respected during load testing

**Phase to address:**
BRK integration phase — deployment architecture decision must be made alongside the integration work.

---

### Pitfall 12: EP-Online TTL Must Respect Annual Label Update Cycle

**What goes wrong:**
Adding `"ep_online": 86400` (24 hours) to `CACHE_TTL` would cache energielabels for only 24 hours, causing unnecessary re-fetches. But using the same TTL as `"rce": 2592000` (30 days) would serve a stale label after a new label is registered. Energy labels can be updated when a building is renovated (new label required within 6 months of sale), but existing labels are valid for 10 years. The right TTL is "months, not days."

**Why it happens:**
Developers pick a TTL heuristically without considering the update frequency of the specific data source. Energy labels are registered once and are stable for years; they don't need daily re-checking.

**How to avoid:**
Use a 30-day TTL for cached energielabels. Add a `force_refresh` pathway so users can manually re-check (in case they know a new label was registered). Separately, EP-Online provides a bulk mutation file via the webservice for organizations that want to track changes systematically — this is not needed for Propdex's per-property lookup use case.

**Warning signs:**
- `"ep_online": 86400` in `CACHE_TTL` causing 350+ unnecessary EP-Online requests per year per property
- No TTL entry for `ep_online` in `config.py` (would cause `KeyError` at runtime from `get_cached_or_fetch()`)

**Phase to address:**
EP-Online implementation phase — add TTL entry to `config.py` before wiring up the cache integration.

---

### Pitfall 13: WOZ Waardepeildatum Can Be a Year Old — Display the Reference Date

**What goes wrong:**
WOZ values are assessed annually with a `waardepeildatum` (valuation reference date) typically January 1 of the previous year. A WOZ value fetched in February 2026 may show the 2025 value (reference date: January 1, 2024) or the 2026 value (reference date: January 1, 2025) depending on when the municipality published the new assessment. Displaying just the WOZ value without the reference date misleads users who assume they're seeing current market value.

**Why it happens:**
The numeric WOZ value is the salient data point. The `waardepeildatum` is treated as metadata and omitted from the display. Users (real estate developers) use WOZ value as a proxy for current market value, which can be significantly off when the reference date is 12-24 months old.

**How to avoid:**
Always display the `waardepeildatum` alongside the WOZ value. Use a display format like "WOZ-waarde: €485.000 (peildatum 1 jan. 2024)". If the data source provides a tax year (`belastingjaar`), display that too. Do not label the value as "actuele waarde" — it is a tax assessment value with a specific reference date.

**Warning signs:**
- WOZ value displayed without a date reference in the UI
- UI copy reading "Actuele WOZ-waarde" instead of "WOZ-waarde (belastingjaar XXXX)"

**Phase to address:**
WOZ UI implementation — build the display component to require the peildatum as a non-optional field from day one.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip BRK Bevragen, show only PDOK cadastral parcels | Avoids mTLS/cert complexity entirely | Users never see ownership data, limiting product value | Never for v7.0 goal |
| Use unofficial WOZ scraping endpoint without monitoring | Gets WOZ data working quickly | Endpoint can break without notice; no SLA; may violate ToS | Only for internal prototyping, not production |
| Hardcode `monument_type = "rijksmonument"` in aggregator | Avoids building the area-containment query | False negatives for stads/dorpsgezicht properties | Never — misleads users about legal restrictions |
| Skip EP-Online "no label" disambiguation | Simpler error handling | Error logs fill with expected 404s; support burden increases | Never — silent failure is worse than explicit None |
| Cache WOZ data as plain `dict` without `waardepeildatum` in the key | Simpler cache key | Year-old values served after new assessment published without user knowing | Never — always include peildatum in cached payload |

---

## Integration Gotchas

Common mistakes when connecting to these specific Dutch government APIs.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BRK Bevragen | Feeding response through `get_cached_or_fetch()` | Return eigendomsdata directly to response payload, no DB persistence |
| BRK Bevragen | Using `kadastraleAanduiding` string as identificatie | Resolve `NL.IMKAD.KadastraalObject.<id>` from PDOK OGC feature properties or BRK search endpoint |
| BRK Bevragen | Applying in-process `brk_limiter` with multiple uvicorn workers | Use Redis-backed rate limiter or single dedicated ARQ worker for BRK calls |
| EP-Online | Building against V4 API endpoints | Use V5: `GET https://public.ep-online.nl/api/v5/PandEnergielabel/Adres` |
| EP-Online | Treating 404 as "error" | Return `energielabel_status = "niet_geregistreerd"` — 404 is a normal state |
| EP-Online | One API key per organization for multi-tenant | Use single backend key; confirm indirect-use terms with RVO before launch |
| WOZ | Applying for official WOZ Bevragen API as SaaS | Use unofficial waardeloket approach or licensed aggregator (Altum AI, Matrixian) |
| WOZ | Returning first WOZ object for an address without disambiguation | Filter by BAG `nummeraanduidingidentificatie` to get unit-specific WOZ value |
| WOZ | Displaying WOZ value without `waardepeildatum` | Always show peildatum: "€485.000 (peildatum 1 jan. 2024)" |
| RCE/PDOK | Querying only `rce_inspire_points` for monument coverage | Also query `rce_inspire_areas` for beschermde stads- en dorpsgezichten |
| RCE/PDOK | Claiming "full monument coverage" in UI | Be explicit: rijksmonumenten only; gemeentelijke monumenten not available nationally |
| PDOK OGC | Omitting `bbox-crs` header | Always include `"bbox-crs": "http://www.opengis.net/def/crs/EPSG/0/28992"` for RD queries |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| BRK called synchronously in the main aggregation `asyncio.gather()` | BRK's 30s timeout blocks all parallel fetches if BRK is slow | Move BRK call to a separate non-blocking path; return property data without eigendom, then fetch eigendom on user demand | At any scale — BRK is paid/slow; don't block core report rendering |
| WOZ + EP-Online + BRK all fetched in parallel with PDOK BAG | Five parallel external calls on every property lookup, most of which add 0.5-2s each | Phase the load: resolve address (BAG) first, then fetch supplemental data in parallel only if BAG succeeds | At ~50 concurrent property lookups — upstream timeouts cascade |
| No circuit breaker for BRK | A BRK outage causes every property report to wait 30s for timeout before degrading | Implement circuit breaker: after 3 consecutive BRK errors, skip BRK for 5 minutes | First BRK outage |
| EP-Online 30-day cache with no negative caching | "No label" (404) hits EP-Online on every request for uncached properties | Cache "no label" state explicitly with a 7-day TTL; return `{"label": null, "registered": false}` | When more than 30% of queried properties have no label (common) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging BRK eigendomsdata (owner names, BSN-adjacent) | GDPR violation; personal data in log files | Never log BRK response bodies at any log level; log only request ID and status code |
| Storing BRK response in any persistent layer (Redis, Postgres, files) | Violates Kadaster Tier 3 terms; data breach risk | Strict no-persistence rule: BRK data flows only in memory from HTTP response to API response payload |
| Exposing BRK `zakelijkGerechtigden` data to all authenticated users regardless of role | Owner data is sensitive; not all Propdex users should see it | Gate eigendomsdata behind a feature flag or permission level; do not return it in the standard property report endpoint |
| PKIOverheid private key stored in the repository or shared `.env` | Certificate compromise allows impersonation | Store key in secrets manager (Docker secrets, Vault); never commit to git; separate path env vars |
| WOZ unofficial endpoint without ToS review | Potential ToS violation; service disruption if endpoint is blocked | Review wayback machine history of the endpoint; monitor for 429/blocking; have licensed-aggregator fallback |

---

## UX Pitfalls

Common user experience mistakes with this type of data.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "geen monument" when data coverage is only rijksmonumenten | Users trust the result, proceed with renovation, discover they have a gemeentelijk monument after the fact | Show "Geen rijksmonument (RCE)" with tooltip: "Gemeentelijke monumenten worden niet centraal geregistreerd" |
| Displaying WOZ value without year context | Users confuse fiscal assessment value with market value | Format: "WOZ-waarde 2026: €485.000 (peildatum 1 jan. 2025)" with tooltip explaining the annual cycle |
| Energielabel shown without expiry date | Label may be 9 years old and due for renewal; users don't know | Show label year: "Energielabel B (2016)" — labels expire after 10 years |
| BRK eigendomsdata shown to all users without context | Exposing business ownership details without explaining data source or legal basis | Add data source attribution and "deze gegevens zijn afkomstig uit het openbare kadasterregister" |
| Treating WOZ/EP-Online/BRK loading as blocking | If any of these fail or are slow, users see a blank report | Render BAG + kadastral + zoning immediately; load supplemental data sections progressively with individual skeleton states |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **BRK integration:** Often missing the "never cache" enforcement — verify no `CachedAPIResponse` row is created for BRK eigendom data in integration tests.
- [ ] **EP-Online integration:** Often missing "no label" negative caching — verify that a 404 from EP-Online results in a cached `null` state, not an uncached absence that hits EP-Online again on next request.
- [ ] **WOZ integration:** Often missing `waardepeildatum` in the stored/displayed payload — verify that the displayed WOZ value always includes the reference date.
- [ ] **RCE improvement:** Often missing `rce_inspire_areas` containment check — verify that a property in a beschermd stadsgezicht (which is a polygon, not a point) is correctly flagged.
- [ ] **BRK rate limiter:** Often missing Redis-backed enforcement in multi-worker deployments — verify that 200 req/hour limit is respected when running with multiple uvicorn workers.
- [ ] **Monument UI copy:** Often claiming "monument status" when only rijksmonument status is checked — verify UI copy says "rijksmonument" not "monument" in all labels.
- [ ] **PKIOverheid cert path:** Often missing cert expiry monitoring — verify cert expiry date is logged at startup and a warning fires when < 60 days remain.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| BRK eigendomsdata found in `CachedAPIResponse` table | HIGH | Immediate: delete all rows with `source='brk'`. Audit access logs. Review whether Kadaster must be notified. Add DB constraint preventing future inserts with this source. |
| WOZ official API rejected — application denied | LOW | Switch to unofficial waardeloket endpoint or Altum AI/Matrixian aggregator. No code architectural change needed, just client URL change. |
| PKIOverheid certificate expired — BRK calls fail | MEDIUM | Disable BRK in feature flag immediately (graceful degradation already exists). Start emergency certificate renewal (2-5 business days express processing from CA). Update `BRK_CLIENT_CERT_PATH` when new cert arrives. |
| EP-Online V4 endpoint used — all calls 404 | LOW | Update base URL from `/api/v4/` to `/api/v5/`. Verify response schema fields match V5 Swagger. Flush EP-Online cache to force re-fetch with new schema. |
| PDOK OGC CRS mismatch — all monument queries return empty | LOW | Check `bbox-crs` header is set. Verify RD coordinates are in valid range (0-280000 X, 300000-625000 Y). Flush monument cache and re-fetch. |
| BRK rate limit exceeded — 429 from Kadaster | MEDIUM | Stop all BRK requests immediately via feature flag. Wait for rate limit window reset (1 hour). Switch to Redis-backed rate limiter before resuming. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Caching BRK eigendomsdata (Pitfall 1) | BRK integration phase | Integration test: assert no `CachedAPIResponse` row with `source='brk'` after eigendom fetch |
| WOZ API access restrictions (Pitfall 2) | Pre-milestone planning | Document which WOZ access method is used and legal basis before any code |
| PKIOverheid cert provisioning (Pitfall 3) | Milestone kickoff — start cert immediately | Certificate files exist in staging before BRK phase begins |
| EP-Online API key terms (Pitfall 4) | EP-Online integration phase (pre-dev) | Written confirmation from RVO on multi-tenant use |
| EP-Online V4 sunset (Pitfall 5) | EP-Online implementation phase | All client URLs reference `/api/v5/`; Swagger schema verified |
| RCE gemeentelijke monumenten gap (Pitfall 6) | RCE improvement phase | `rce_inspire_areas` query added; UI copy scoped to rijksmonumenten |
| BRK identificatie format (Pitfall 7) | BRK integration phase | Test with real parcels: PDOK OGC → identificatie → BRK lookup succeeds |
| EP-Online 404 as error (Pitfall 8) | EP-Online implementation phase | Test: property with no label returns `energielabel_status="niet_geregistreerd"`, no error increment |
| WOZ multiple objects per address (Pitfall 9) | WOZ integration phase | Test: apartment address returns unit-specific WOZ, not building total |
| PDOK OGC CRS omission (Pitfall 10) | RCE improvement phase | All PDOK OGC requests log `bbox-crs` header; coordinate range validation in helper |
| BRK rate limit multi-worker (Pitfall 11) | BRK integration phase | Load test with 2+ workers: confirm < 200 BRK requests/hour aggregate |
| EP-Online TTL (Pitfall 12) | EP-Online implementation phase | `CACHE_TTL["ep_online"]` exists in `config.py`; negative-cache state stored |
| WOZ waardepeildatum display (Pitfall 13) | WOZ UI phase | UI review: WOZ value always shows reference date in same component |

---

## Sources

- Propdex codebase direct inspection (`brk_bevragen.py`, `rce_monuments.py`, `property_aggregator.py`, `monument_aggregator.py`, `cache_manager.py`, `rate_limiter.py`, `config.py`) — HIGH confidence (source of truth for existing patterns)
- [Kadaster BRK Bevragen — Product page](https://www.kadaster.nl/zakelijk/producten/eigendom/brk-bevragen) — HIGH confidence (official Kadaster documentation)
- [Haal Centraal BRK Bevragen — Getting Started](https://kadaster.github.io/BRK-bevragen/) — HIGH confidence (official VNG-Realisatie documentation)
- [EP-Online Public REST API V5 — Swagger](https://public.ep-online.nl/swagger) — HIGH confidence (official RVO/EP-Online)
- [EP-Online Terms of Use](https://apikey.ep-online.nl/Home/TermsOfUse) — HIGH confidence (official terms)
- [EP-Online Release Notes](https://www.ep-online.nl/Home/ReleaseNotes) — HIGH confidence (V4 sunset date January 30, 2026 confirmed)
- [WOZ API Bevragen — Kadaster](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/woz-api-bevragen) — HIGH confidence (official access restrictions confirmed)
- [WOZ Bevragen Getting Started](https://kadaster.github.io/WOZ-bevragen/getting-started) — HIGH confidence (OIN + PKIO requirement confirmed)
- [PDOK Beschermde Gebieden Cultuurhistorie OGC API](https://api.pdok.nl/rce/beschermde-gebieden-cultuurhistorie/ogc/v1?f=html&lang=en) — HIGH confidence (official PDOK API, confirms rijksmonumenten + stadsgezichten only)
- [KIK Inzage API — Authenticatie/autorisatie methoden v2.3 (March 2025)](https://developer.kadaster.nl/schemas/kik-inzage/6.0.x/KIK-Inzage-API-authenticatie-en-autorisatie-methoden.pdf) — HIGH confidence (PKIOverheid OIN/HRN requirements)
- [PKIoverheid G3/G4 Transition](https://www.logius.nl/english/pkioverheid/new-generation-pkioverheid-certificates) — HIGH confidence (G3 expiry by November 2028)
- [Data.overheid.nl — WOZ access restrictions](https://data.overheid.nl/community/datarequest/api-voor-woz-waarde-woningen-o-b-v-adres) — MEDIUM confidence (community discussion confirming access restrictions)
- [Altum AI WOZ API](https://altum.ai/woz-api/) — MEDIUM confidence (confirms commercial WOZ alternative exists; not official government source)

---
*Pitfalls research for: Dutch government API integration (WOZ, EP-Online, BRK, RCE)*
*Researched: 2026-02-23*
