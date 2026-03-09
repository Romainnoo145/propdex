---
phase: 87-soil-data-integration
verified: 2026-03-09T23:58:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 87: Soil Data Integration Verification Report

**Phase Goal:** User can see soil type and foundation risk area context for any parcel location
**Verified:** 2026-03-09T23:58:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BRO Bodemkaart WMS returns soil type (klei/veen/zand/leem/onbekend) for any RD coordinate | VERIFIED | `bro_bodemkaart.py` L44-108: WMS GetFeatureInfo with soilarea layer, 1km window, returns properties or None |
| 2 | PDOK Funderingsrisicogebieden WFS returns postcode-level context (percvoor1970, fgr, legenda) for any pc6 | VERIFIED | `pdok_funderingsrisico.py` L43-136: WFS GetFeature with CQL_FILTER, string-to-numeric parsing, pc6 validation |
| 3 | Soil data is cached in JSONB with 365-day TTL | VERIFIED | `config.py` L21: `"bro_bodemkaart": 31536000` (365 days); `soil_aggregator.py` L65-72: uses `get_cached_or_fetch` with source="bro_bodemkaart" |
| 4 | Funderingsrisico data is cached in JSONB with 180-day TTL | VERIFIED | `config.py` L22: `"pdok_funderingsrisico": 15552000` (180 days); `funderingsrisico_aggregator.py` L52-58: uses `get_cached_or_fetch` |
| 5 | Coordinates with no BRO coverage return onbekend, never an error | VERIFIED | `soil_aggregator.py` L49-55: None from client returns `dominant_type="onbekend"`, `dominant_type_label="Onbekend (geen BRO dekking)"` |
| 6 | Postcodes with no funderingsrisico data return None, never an error | VERIFIED | `funderingsrisico_aggregator.py` L40-41: empty pc6 returns None; L47-49: None from client caches empty dict; L62-63: empty cached.data returns None |
| 7 | PropertyReportResponse includes soil_profile and funderingsrisicogebied fields | VERIFIED | `property.py` L557-563: both fields present as Optional with correct types; `property_aggregator.py` L1349-1350: passed to constructor |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/government_apis/bro_bodemkaart.py` | WMS GetFeatureInfo client for BRO Bodemkaart | VERIFIED | 113 lines, class + singleton, retry + rate limiter |
| `backend/app/government_apis/pdok_funderingsrisico.py` | WFS GetFeature client for Funderingsrisicogebieden | VERIFIED | 141 lines, pc6 validation, string-to-numeric parsing |
| `backend/app/schemas/fysiek_risico.py` | SoilProfile and FunderingsrisicogebiedData Pydantic models | VERIFIED | 73 lines, both models with all required fields and disclaimers |
| `backend/app/services/soil_classifier.py` | Static BRO soil code prefix to grondsoort classification | VERIFIED | 79 lines, SOIL_PREFIX_TO_GRONDSOORT dict, longest-prefix-first matching |
| `backend/app/services/soil_aggregator.py` | Cached soil profile fetch | VERIFIED | 74 lines, follows bodem_aggregator pattern, 365-day cache |
| `backend/app/services/funderingsrisico_aggregator.py` | Cached funderingsrisico fetch | VERIFIED | 66 lines, follows bodem_aggregator pattern, 180-day cache |
| `backend/app/government_apis/rate_limiter.py` (modified) | bro_bodemkaart_limiter + pdok_funderingsrisico_limiter | VERIFIED | L124, L127: both configured max_concurrent=5, max_per_hour=1000 |
| `backend/app/core/config.py` (modified) | CACHE_TTL entries for both sources | VERIFIED | L21-22: 31536000 and 15552000 |
| `backend/app/schemas/property.py` (modified) | soil_profile + funderingsrisicogebied fields | VERIFIED | L14: import, L557-563: both Optional fields |
| `backend/app/services/property_aggregator.py` (modified) | Wired into asyncio.gather | VERIFIED | L49,53: imports; L931-932: in gather at index 7,8; L1349-1350: passed to response |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| soil_aggregator.py | bro_bodemkaart.py | `bro_bodemkaart_client.get_soil_at_point()` | WIRED | L11: import, L48: called in fetch_fn |
| funderingsrisico_aggregator.py | pdok_funderingsrisico.py | `pdok_funderingsrisico_client.get_by_postcode()` | WIRED | L11: import, L46: called in fetch_fn |
| property_aggregator.py | soil_aggregator.py | `fetch_soil_profile` in asyncio.gather | WIRED | L53: import, L891: called, L931: in gather |
| property_aggregator.py | funderingsrisico_aggregator.py | `fetch_funderingsrisico_data` in asyncio.gather | WIRED | L49: import, L910: called, L932: in gather |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BODEM-01 | 87-01-PLAN | User sees soil type classification (klei/veen/zand/leem) for any parcel via BRO Bodemkaart WMS | SATISFIED | BRO client, classifier, aggregator, and PropertyReportResponse.soil_profile all wired end-to-end |
| BODEM-02 | 87-01-PLAN | User sees PDOK Funderingsrisicogebieden context (% pre-1970, soil region, risk label) for parcel's postal code area | SATISFIED | PDOK WFS client, aggregator, and PropertyReportResponse.funderingsrisicogebied all wired end-to-end |

No orphaned requirements found -- REQUIREMENTS.md maps exactly BODEM-01 and BODEM-02 to Phase 87, matching the plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found |

No TODOs, FIXMEs, placeholders, or stub implementations found in any of the 10 files.

### Human Verification Required

### 1. Live BRO Bodemkaart WMS Response

**Test:** View a parcel in ParcelDetailModal (e.g., Venlo area) and check that soil type appears
**Expected:** SoilProfile shows dominant_type (e.g., "Zandgrond") with BRO disclaimer
**Why human:** Cannot verify live WMS response and frontend rendering programmatically

### 2. Live PDOK Funderingsrisico WFS Response

**Test:** View a parcel with known postcode and check funderingsrisicogebied data
**Expected:** Shows percvoor1970 percentage, fgr region name, and legenda risk label
**Why human:** Cannot verify live WFS response and frontend rendering programmatically

### 3. Coverage Gap Handling

**Test:** View a parcel in an area without BRO coverage (e.g., water, urban infill)
**Expected:** Shows "Onbekend (geen BRO dekking)" -- no error state
**Why human:** Need to find a specific location without BRO coverage

### Gaps Summary

No gaps found. All 7 must-have truths are verified at all three levels (existence, substantive implementation, and wiring). All 4 key links confirmed. Both requirements (BODEM-01, BODEM-02) are satisfied. All 3 task commits exist in git history. Zero anti-patterns detected.

Note: Frontend rendering of the new data fields is outside this phase's scope -- the phase goal is backend data integration into PropertyReportResponse, which Phase 88+ and frontend work will consume.

---

_Verified: 2026-03-09T23:58:00Z_
_Verifier: Claude (gsd-verifier)_
