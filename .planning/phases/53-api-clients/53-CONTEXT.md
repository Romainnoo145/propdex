# Phase 53: API Clients - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build httpx clients for three Dutch government APIs that fetch property data and return typed Pydantic models (from Phase 52 schemas): EP-Online V5 (energielabel by VBO ID), WOZ Waardeloket (property valuation), and RCE Linked Data (monument detail by rijksmonumentnummer). Includes rate limiters and retry logic. Aggregator integration is Phase 55; frontend sections are Phase 56.

</domain>

<decisions>
## Implementation Decisions

### WOZ data source strategy
- Use WOZ Waardeloket (public, unofficial) as the sole data source for v7.0
- Always show low-confidence disclaimer: "Bron: WOZ Waardeloket (indicatief)" per WOZ-04
- Always fetch both WOZ value and waardepeildatum as a pair (WOZ-02 requirement)
- When waardeloket returns unexpected response format: return error status (not silent None) so frontend can show "WOZ data unavailable" with reason — also log the issue for monitoring

### "No data" semantics — consistent three-state contract
All three clients follow the same error/missing-data contract:
- **Data found** -> return Pydantic model
- **No data exists (normal)** -> return None (frontend shows "Niet beschikbaar" / "Niet geregistreerd")
- **API error/timeout** -> raise or return error (frontend shows "Kon niet ophalen")
- **API unconfigured** -> return None (section hidden, no error)

EP-Online specifics: distinguish 404 "no label registered" (return None, normal for ~20-30% of properties) from 500/timeout (error state). NRG-03 drives the "Niet geregistreerd" display.

RCE specifics: when a known rijksmonument has no detail page in RCE API (rare), return None. The existing PDOK spatial match already confirms monument status — missing RCE detail just means no enrichment.

### RCE detail field scope
- **Comprehensive extraction** — pull all available fields, not just the minimum:
  - Core: redengevende omschrijving, oorspronkelijke functie, bouwperiode, rijksmonumentnummer
  - Extended: architect, construction materials, complex membership, kadastrale aanduiding, coordinates
- Store full redengevende omschrijving text (no truncation) — frontend handles display with collapsible section in Phase 56
- Resolve SPARQL-style URIs to human-readable Dutch labels at the client level (return "Woonhuis" not "/id/functie/woonhuis")
- Multi-valued fields (functions, complexes) stored as List[str] — preserves all data

### Rate limiting philosophy
- Conservative rate limiting across all three APIs: max 2-3 req/sec per API
- Retry with exponential backoff on 429/throttle: up to 3 retries (1s, 2s, 4s delays)
- Shared rate limiters across concurrent scan workers (single limiter per API, not per-worker)
- Log key metrics at INFO level: request counts, throttle events, average latency per API

### Claude's Discretion
- Exact httpx client configuration (timeouts, connection pooling)
- Cache key format for EP-Online and WOZ responses
- Whether to use the existing rate limiter singletons from Phase 52 or create new ones
- Error class hierarchy (custom exceptions vs return types for error states)

</decisions>

<specifics>
## Specific Ideas

- WOZ data should always carry a "low-confidence" flag at the data level so any consumer knows the source is unofficial
- The error/missing-data contract should be documented in docstrings so future client authors follow the same pattern
- RCE label resolution should happen at fetch time, not display time — the Pydantic model should contain clean Dutch strings

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-api-clients*
*Context gathered: 2026-02-24*
