---
phase: 53-api-clients
plan: 02
subsystem: api
tags: [rce, linked-data, json-ld, sparql, monument, httpx, pydantic]

requires:
  - phase: 52-schema-config-foundation
    provides: RCEMonumentDetail schema in monument.py, rce_detail_limiter in rate_limiter.py
  - phase: 53-api-clients-plan-01
    provides: retry_with_backoff helper in base.py, GovernmentAPIError, APINotFoundError
provides:
  - RCELinkedDataClient with get_detail_by_monument_number method
  - JSON-LD parsing helpers for CEO ontology namespace
  - Two-step fetch: REST API + dereference with linked-node resolution
  - Live-validated field mappings for RCE Linked Data API (2026-02-24)
  - rce_linked_data_client module-level singleton
affects: [54-aggregator, 55-property-aggregator, 56-frontend-rce]

tech-stack:
  added: []
  patterns:
    - "JSON-LD linked-node resolution: dereference monument -> fetch omschrijving/functie nodes separately"
    - "SKOS prefLabel resolution: heeftFunctieNaam -> SKOS term -> prefLabel[lang=nl]"
    - "Graceful degradation: return basic RCEMonumentDetail when linked nodes unavailable"

key-files:
  created:
    - backend/app/government_apis/rce_linked_data.py
  modified: []

key-decisions:
  - "SPARQL endpoint not available: serviceCount=0 on all public RCE Linked Data datasets; replaced _sparql_fallback with direct linked-node fetching"
  - "ceo:omschrijving (not redengevendeOmschrijving) is the actual predicate in Omschrijving nodes"
  - "Functie label fetched via heeftFunctieNaam -> SKOS prefLabel (not URI path segment resolution)"
  - "Three async HTTP calls per monument: REST API + dereference + omschrijving node (plus optional functie node)"
  - "rijksmonumentnummer in dereference response is plain string; in REST API response it's a full URL"

patterns-established:
  - "Linked-node resolution: CEO ontology uses indirect references (monument->omschrijving IRI->text)"
  - "SKOS label lookup: find term node by IRI in graph, get prefLabel with lang=nl filter"
  - "Always gracefully degrade to basic-fields-only when linked nodes unavailable"

requirements-completed: [RCE-01, RCE-03, RCE-04]

duration: 8min
completed: 2026-02-24
---

# Phase 53 Plan 02: RCE Linked Data Client Summary

**RCELinkedDataClient fetching monument omschrijving and functie via multi-hop JSON-LD linked-node resolution against the CEO ontology**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24T04:53:51Z
- **Completed:** 2026-02-24T05:02:14Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- RCELinkedDataClient with get_detail_by_monument_number returning RCEMonumentDetail
- Two-step fetch strategy: REST API query for CHO number, then dereference for detail
- Linked-node resolution: omschrijving text fetched from separate Omschrijving node, functie label from SKOS term via Functie node
- JSON-LD parsing helpers: _find_node_by_type, _get_literal, _get_linked_id, _get_all_linked_ids
- Live API validation confirmed actual field structure and corrected initial assumptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RCE Linked Data client with REST API integration** - `988f67d` (feat)
2. **Task 2: Live API validation and field name corrections** - `b8f585e` (fix)

## Files Created/Modified
- `backend/app/government_apis/rce_linked_data.py` - RCELinkedDataClient with JSON-LD parsing, linked-node resolution, three-state contract, rce_linked_data_client singleton

## Decisions Made
- SPARQL fallback removed after confirming SPARQL services are not available on any public RCE datasets (serviceCount=0). Replaced with direct linked-node HTTP fetching.
- omschrijving text lives in `ceo:omschrijving` predicate on the `Omschrijving` node (not `redengevendeOmschrijving` as initially assumed from documentation)
- Function label resolved via `heeftFunctieNaam -> SKOS prefLabel (lang=nl)` chain, not URI path segment extraction (e.g. returns "Boerderij (M)" not "116634")
- Three separate HTTP calls accepted for accuracy: REST API + dereference + omschrijving node fetch (functie node fetch optional fourth call)
- Bouwperiode fields (bouwjaar_van/tot) not present in tested monuments; field extraction code handles Bouwperiode node type if present in future responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected all RCE field mappings based on live API response**
- **Found during:** Task 2 (live API validation)
- **Issue:** Initial implementation used assumed field names (redengevendeOmschrijving, URI path segments for functie). Live API confirmed:
  - Omschrijving node uses `ceo:omschrijving` predicate
  - Functie label is a SKOS prefLabel chain, not a URI path segment
  - SPARQL endpoint not available (404 on all dataset service URLs)
- **Fix:** Rewrote _dereference_monument to return node list; added _fetch_omschrijving and _fetch_functie_label methods that fetch linked nodes directly; removed _sparql_fallback entirely; added SKOS_NS constant
- **Files modified:** backend/app/government_apis/rce_linked_data.py
- **Verification:** Live test with monument 12340 returns omschrijving "Boerderij waarvan..." and functie "Boerderij (M)"; monument 511417 returns functie "Schaapskooi"
- **Committed in:** b8f585e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/incorrect field mappings)
**Impact on plan:** Fix was essential for correctness. Research noted field names were MEDIUM confidence and live validation was explicitly required. No scope creep.

## Issues Encountered
- SPARQL endpoint URLs from research (api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho-kennis/services/cho-kennis/sparql) returned 404 — confirmed not available by checking dataset API (serviceCount=0 on all public RCE datasets). Plan's SPARQL fallback was replaced with direct linked-node HTTP fetching which proved more effective.
- rijksmonumentnummer field in REST API response is a full URL (https://monumentenregister.cultureelerfgoed.nl/monumenten/12340) but in the dereference response it's just the plain number ("12340"). Implementation correctly uses the rijksmonumentnummer parameter for the return value, not the REST API field value.

## User Setup Required

None - no external service configuration required. RCE Linked Data is a public API with no API key.

## Next Phase Readiness
- RCELinkedDataClient ready for use by Phase 55 property aggregator
- Imports: `from app.government_apis.rce_linked_data import rce_linked_data_client`
- Method signature: `async def get_detail_by_monument_number(self, rijksmonumentnummer: str, client: httpx.AsyncClient) -> RCEMonumentDetail | None`
- Three-state contract: RCEMonumentDetail on success, None on 404, GovernmentAPIError on timeout
- Note: bouwperiode fields may be None for many monuments (not present in tested samples); frontend should handle gracefully

---
*Phase: 53-api-clients*
*Completed: 2026-02-24*
