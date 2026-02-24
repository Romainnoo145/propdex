---
phase: 53-api-clients
verified: 2026-02-24T06:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "EP-Online auth header format"
    expected: "Bearer token format confirmed working against live EP-Online V5 API"
    why_human: "Auth header is MEDIUM confidence per code comments — bearer vs X-Api-Key cannot be confirmed without a live API key"
  - test: "WOZ field name mapping produces correct values"
    expected: "meest_recente_waarde, peildatum, woz_objectnummer populated correctly from live API"
    why_human: "WOZ field names marked LOW confidence in code — live API call with real nummeraanduiding_id needed"
---

# Phase 53: API Clients Verification Report

**Phase Goal:** EP-Online V5 client (by VBO ID, graceful 404); WOZ waardeloket client (low-confidence flag); RCE Linked Data detail method (by rijksmonumentnummer); new rate limiters
**Verified:** 2026-02-24T06:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EP-Online client fetches energielabel by VBO ID and returns EnergyLabel Pydantic model | VERIFIED | `EPOnlineClient.get_by_vbo_id` in `ep_online.py` L63–115 returns `EnergyLabel`; test `test_successful_fetch_returns_energy_label` passes |
| 2 | EP-Online client returns EnergyLabel(is_geregistreerd=False) on 404 (not an error) | VERIFIED | `ep_online.py` L94–101 catches `APINotFoundError` and returns `EnergyLabel(is_geregistreerd=False)`; test `test_404_returns_not_registered` passes |
| 3 | EP-Online client returns None when EP_ONLINE_API_KEY is unconfigured | VERIFIED | `ep_online.py` L80–83 checks `_is_configured()` and returns None; test `test_unconfigured_returns_none` passes |
| 4 | WOZ client fetches WOZ value by nummeraanduiding_id and returns WOZData model | VERIFIED | `WOZWaardeloketClient.get_by_nummeraanduiding_id` in `woz_waardeloket.py` L52–88; test `test_successful_fetch_returns_woz_data` passes |
| 5 | WOZ client always sets low_confidence=True and low_confidence_reden on successful fetch | VERIFIED | `woz_waardeloket.py` L168–170 hardcodes `low_confidence=True, low_confidence_reden="Bron: WOZ Waardeloket (indicatief)"`; test `test_low_confidence_always_set` passes |
| 6 | WOZ client raises GovernmentAPIError on unexpected response format (not silent None) | VERIFIED | `woz_waardeloket.py` L146–156 raises `GovernmentAPIError("woz-waardeloket", "Unexpected response format...")` when both `wozWaarden` and `wozObjectnummer` absent; test `test_unexpected_format_raises_error` passes |
| 7 | Both clients retry with exponential backoff (1s, 2s, 4s) on HTTP 429 responses via shared retry_with_backoff helper | VERIFIED | `base.py` L88–119 implements `retry_with_backoff`; both `ep_online.py` L89–92 and `woz_waardeloket.py` L73–76 use it; `rce_linked_data.py` L160–168 also uses it |
| 8 | RCE client fetches monument detail by rijksmonumentnummer and returns RCEMonumentDetail | VERIFIED | `RCELinkedDataClient.get_detail_by_monument_number` in `rce_linked_data.py` L121–151; test `test_successful_fetch_returns_monument_detail` passes |
| 9 | RCE client parses JSON-LD response format with full namespace URI keys | VERIFIED | `rce_linked_data.py` L58–107 implements `_find_node_by_type`, `_get_literal`, `_get_linked_id` using full `CEO_NS`/`SKOS_NS` prefix keys; test `test_parses_jsonld_namespace_keys` passes |
| 10 | RCE client extracts oorspronkelijke_functie and bouwperiode when available (RCE-03) | VERIFIED | `_fetch_functie_label` (L307–355) resolves SKOS prefLabel chain; `_extract_bouwperiode` (L357–373) extracts Bouwperiode node; `test_bouwperiode_extracted_from_graph` passes |
| 11 | RCE client resolves SPARQL-style URIs to human-readable Dutch labels | VERIFIED | `_resolve_uri_to_label` (L94–106) extracts last path segment and capitalizes; test `test_uri_to_label_resolution` passes |
| 12 | RCEMonumentDetail carries rijksmonumentnummer confirming RCE source (RCE-04) | VERIFIED | `rce_linked_data.py` L229 sets `rijksmonumentnummer=rijksmonumentnummer`; `RCEMonumentDetail` schema at `monument.py` L52 has the field; test asserts value |
| 13 | RCE client returns None when monument detail not found (RCE-01) | VERIFIED | `rce_linked_data.py` L142–147 catches `APINotFoundError` and returns None; test `test_not_found_returns_none` passes |
| 14 | RCE client retries with exponential backoff on HTTP 429 via retry_with_backoff | VERIFIED | `rce_linked_data.py` L160, L251, L286, L322 all use `retry_with_backoff` |
| 15 | RCE client attempts linked-node resolution when dereference returns limited fields (RCE-03) | VERIFIED | Two-step plus linked-node strategy: `_dereference_monument` → `_fetch_omschrijving` + `_fetch_functie_label`; replaces SPARQL fallback (SPARQL endpoint confirmed unavailable — see deviation note below) |
| 16 | woz_waardeloket_limiter singleton added to rate_limiter.py | VERIFIED | `rate_limiter.py` L101–102: `woz_waardeloket_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)` |
| 17 | EP-Online unit tests cover: configured success, 404 -> is_geregistreerd=False, unconfigured -> None, timeout -> error | VERIFIED | 7 tests in `test_ep_online.py` all pass (22/22 total across three files) |
| 18 | WOZ unit tests cover: success with low_confidence=True, 404 -> None, unexpected format -> error | VERIFIED | 6 tests in `test_woz_waardeloket.py` all pass |
| 19 | RCE unit tests cover: JSON-LD parsing, detail fields extraction, not-found -> None, timeout -> error | VERIFIED | 9 tests in `test_rce_linked_data.py` all pass |

**Score:** 19/19 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/government_apis/base.py` | Shared `retry_with_backoff` helper | VERIFIED | L88–119, `async def retry_with_backoff` with `Callable`/`Awaitable` imports at L4 |
| `backend/app/government_apis/ep_online.py` | `EPOnlineClient` with `get_by_vbo_id` | VERIFIED | 158 LOC, singleton `ep_online_client` at L158 |
| `backend/app/government_apis/woz_waardeloket.py` | `WOZWaardeloketClient` with `get_by_nummeraanduiding_id` | VERIFIED | 175 LOC, singleton `woz_waardeloket_client` at L175 |
| `backend/app/government_apis/rate_limiter.py` | `woz_waardeloket_limiter` singleton | VERIFIED | L101–102, `APIRateLimiter(max_concurrent=3, max_per_hour=500)` |
| `backend/app/government_apis/rce_linked_data.py` | `RCELinkedDataClient` with `get_detail_by_monument_number` | VERIFIED | 401 LOC, singleton `rce_linked_data_client` at L401 |
| `backend/tests/unit/test_ep_online.py` | `TestEPOnlineClient` with 6+ tests | VERIFIED | 7 test methods, all pass |
| `backend/tests/unit/test_woz_waardeloket.py` | `TestWOZWaardeloketClient` with 5+ tests | VERIFIED | 6 test methods, all pass |
| `backend/tests/unit/test_rce_linked_data.py` | `TestRCELinkedDataClient` with 8+ tests | VERIFIED | 9 test methods, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ep_online.py` | `rate_limiter.py` | `import ep_online_limiter` | WIRED | `ep_online.py` L31: `from app.government_apis.rate_limiter import ep_online_limiter`; used at L88 |
| `ep_online.py` | `energy_label.py` | `import EnergyLabel` | WIRED | `ep_online.py` L32: `from app.schemas.energy_label import EnergyLabel`; used at L65, L97, L108, L144 |
| `ep_online.py` | `config.py` | `settings.EP_ONLINE_API_KEY` | WIRED | `ep_online.py` L24: `from app.core.config import settings`; used at L52, L61 |
| `woz_waardeloket.py` | `rate_limiter.py` | `import woz_waardeloket_limiter` | WIRED | `woz_waardeloket.py` L30: `from app.government_apis.rate_limiter import woz_waardeloket_limiter`; used at L72 |
| `woz_waardeloket.py` | `woz.py` | `import WOZData, WOZWaarde` | WIRED | `woz_waardeloket.py` L31: `from app.schemas.woz import WOZData, WOZWaarde`; both used in `_parse_woz_data` |
| `rce_linked_data.py` | `rate_limiter.py` | `import rce_detail_limiter` | WIRED | `rce_linked_data.py` L37: `from app.government_apis.rate_limiter import rce_detail_limiter`; used at L138 |
| `rce_linked_data.py` | `monument.py` | `import RCEMonumentDetail` | WIRED | `rce_linked_data.py` L38: `from app.schemas.monument import RCEMonumentDetail`; used at L182, L194, L201, L228 |
| `rce_linked_data.py` | `base.py` | `import handle_api_response, GovernmentAPIError` | WIRED | `rce_linked_data.py` L31–36; all used in `_fetch_detail` and `get_detail_by_monument_number` |
| `test_ep_online.py` | `ep_online.py` | `import EPOnlineClient` | WIRED | `test_ep_online.py` L9: `from app.government_apis.ep_online import EPOnlineClient`; used in all test methods |
| `test_woz_waardeloket.py` | `woz_waardeloket.py` | `import WOZWaardeloketClient` | WIRED | `test_woz_waardeloket.py` L7: `from app.government_apis.woz_waardeloket import WOZWaardeloketClient`; used in all test methods |
| `test_rce_linked_data.py` | `rce_linked_data.py` | `import RCELinkedDataClient` | WIRED | `test_rce_linked_data.py` L11: `from app.government_apis.rce_linked_data import ... RCELinkedDataClient`; used in all async tests |

### Requirements Coverage

| Requirement | Plan Claims | REQUIREMENTS.md | Status | Notes |
|-------------|-------------|-----------------|--------|-------|
| NRG-01 | Phase 53 (53-01, 53-03) | Phase 53 | SATISFIED | `EPOnlineClient.get_by_vbo_id` returns `EnergyLabel.energieklasse`. Client layer only — report wiring comes in Phase 55. |
| NRG-03 | Phase 53 (53-01, 53-03) | Phase 53 | SATISFIED | 404 returns `EnergyLabel(is_geregistreerd=False, niet_geregistreerd_reden="Niet geregistreerd")`. |
| RCE-01 | Phase 53 (53-02, 53-03) | Phase 53 | SATISFIED | `RCELinkedDataClient.get_detail_by_monument_number` returns `RCEMonumentDetail \| None`. Client layer only — aggregator wiring in Phase 55. |
| RCE-03 | Phase 53 (53-02, 53-03) | Phase 53 | SATISFIED | `oorspronkelijke_functie` extracted via SKOS prefLabel chain; `bouwjaar_van`/`bouwjaar_tot` extracted from Bouwperiode node. |
| RCE-04 | Phase 53 (53-02, 53-03) | Phase 53 | SATISFIED | `RCEMonumentDetail.rijksmonumentnummer` set; `monument_register_url` constructed as `https://monumentenregister.cultureelerfgoed.nl/monumenten/{nr}`. Phase 56 uses this to render "Rijksmonument (RCE)" label. |
| WOZ-01 | Phase 53 (53-01, 53-03) | Phase 54 | SATISFIED (client layer) | WOZ Waardeloket client built. REQUIREMENTS.md traceability maps to Phase 54 — this is a tracking mismatch, not a gap. The client was delivered in Phase 53; report wiring deferred to Phase 54/55. |
| WOZ-04 | Phase 53 (53-01, 53-03) | Phase 54 | SATISFIED (client layer) | `low_confidence=True` and `low_confidence_reden="Bron: WOZ Waardeloket (indicatief)"` always set. REQUIREMENTS.md maps UI display to Phase 56 — the data-layer flag is present. |

**Traceability mismatch note:** REQUIREMENTS.md traceability table assigns WOZ-01 and WOZ-04 to Phase 54. The Phase 53 plans and summaries claim these requirements. The underlying deliverable (WOZ Waardeloket client with low-confidence flag) exists and works. The mismatch is in the traceability table only — REQUIREMENTS.md should be updated to reflect Phase 53 for the client layer.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ep_online.py` | 133, 145–151 | "MEDIUM confidence field names" comments | Info | Acceptable — live API validation explicitly planned; code warns developers to verify field names before relying on them |
| `ep_online.py` | 140 | `datetime.utcnow()` deprecated in Python 3.12+ | Info | Matches project pattern (see MEMORY.md: "datetime.utcnow() (naive UTC)") — not a bug |
| `woz_waardeloket.py` | 111–126 | "LOW confidence field names" comments | Info | Acceptable — same pattern as EP-Online; WOZ API not live-validated yet |
| `rce_linked_data.py` | various | 401 LOC exceeds 300-line project guideline | Warning | File is large due to JSON-LD parsing helpers; no single method exceeds 80 LOC; functional correctness is not affected |

No blocker anti-patterns found. All TODO/FIXME comments are informational confidence-level annotations that document known validation checkpoints.

### Human Verification Required

#### 1. EP-Online Authentication Header

**Test:** Make a real API call to `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/{vbo_id}` with `Authorization: Bearer {EP_ONLINE_API_KEY}` header.
**Expected:** 200 response with `energieKlasse`, `registratieDatum`, `geldigTot` fields (or 404 for an unregistered VBO).
**Why human:** Auth format is flagged MEDIUM confidence in code (`ep_online.py` L7–8, L59). If the actual API requires `X-Api-Key` header instead of `Bearer`, the field mapping will also need correction.

#### 2. WOZ Waardeloket Field Name Mapping

**Test:** Make a real API call to `https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/{id}` with a known Amsterdam address nummeraanduiding_id.
**Expected:** Response has `wozObjectnummer`, `wozWaarden` list with `vastgesteldeWaarde` and `peildatum` entries.
**Why human:** All WOZ field names are marked LOW confidence (`woz_waardeloket.py` L94). Incorrect field names would result in all None values while not raising an error (because `woz_objectnummer` would be None but there would still be a wozWaarden structure, bypassing the error guard).

### Deviation: SPARQL Fallback Replaced by Linked-Node Resolution

Plan 53-02 specified a SPARQL fallback as an observable truth. Live API validation on 2026-02-24 confirmed the SPARQL endpoint is not available on any public RCE Linked Data dataset (serviceCount=0). The implementation replaced it with direct linked-node HTTP fetching:

- `_fetch_omschrijving` — fetches the Omschrijving node directly via IRI
- `_fetch_functie_label` — fetches the Functie node and resolves SKOS prefLabel chain

This delivers RCE-03 (oorspronkelijke functie + redengevende omschrijving) through a different mechanism than planned. The outcome is superior to SPARQL fallback because the linked-node approach is how the CEO ontology is designed to be consumed. Documented in 53-02-SUMMARY.md as an auto-fixed deviation.

### Test Results

```
22 passed in 0.14s
- test_ep_online.py:    7 passed
- test_woz_waardeloket.py: 6 passed
- test_rce_linked_data.py: 9 passed
```

### Ruff Check

All five modified/created files pass with zero errors:
- `backend/app/government_apis/base.py` — PASS
- `backend/app/government_apis/ep_online.py` — PASS
- `backend/app/government_apis/woz_waardeloket.py` — PASS
- `backend/app/government_apis/rce_linked_data.py` — PASS
- `backend/app/government_apis/rate_limiter.py` — PASS

---
_Verified: 2026-02-24T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
