---
phase: 67-wkb-classification-engine
plan: "01"
subsystem: backend
tags: [wkb, asbest, classification, tdd, pydantic, pure-functions]
dependency_graph:
  requires: []
  provides: [wkb_classifier.classify_wkb, asbest_indicator.assess_asbest_risk, WkbClassification, AsbestIndicator]
  affects: [property_aggregator, PropertyReportResponse]
tech_stack:
  added: []
  patterns: [pure-synchronous-function, pydantic-schema-extension, tdd-red-green]
key_files:
  created:
    - backend/app/services/wkb_classifier.py
    - backend/app/services/asbest_indicator.py
    - backend/tests/unit/test_wkb_classifier.py
    - backend/tests/unit/test_asbest_indicator.py
  modified:
    - backend/app/schemas/property.py
    - backend/app/services/property_aggregator.py
decisions:
  - "Use consensus_status == 'rijksmonument' (not is_monument) to exclude only rijksmonumenten, not gemeentelijke monuments"
  - "Exclusion order: rijksmonument checked first, verbouwing second, then GK1 classification"
  - "wkb_applicable=True for 'onbekend' (optimistic) to support Phase 71 CTA without suppression"
  - "bouwjaar >= 1994 is 'geen' boundary — 1993 is 'hoog', 1994 is 'geen' (confirmed in tests)"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-02"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 67 Plan 01: Wkb Classification + Asbest Indicator Backend Services Summary

**One-liner:** Pure synchronous `classify_wkb()` and `assess_asbest_risk()` services with Pydantic schemas and aggregator wiring — TDD red-green with 16 passing unit tests.

---

## What Was Built

Two new pure synchronous classification services extending the property report with deterministic Wkb gevolgklasse and bouwjaar-based asbest risk:

### New Services

**`backend/app/services/wkb_classifier.py`** (54 lines)
- `classify_wkb(*, building, monuments) -> WkbClassification`
- Exclusion order: rijksmonument (via `consensus_status == "rijksmonument"`) > verbouwing (via `building.status.strip().lower() == "verbouwing pand"`) > GK1 (via `"woonfunctie" in gebruiksdoel`) > onbekend (default)
- Trailing space handling: `.strip().lower()` (not bare `.lower()`) per BAG data patterns

**`backend/app/services/asbest_indicator.py`** (59 lines)
- `assess_asbest_risk(*, building) -> AsbestIndicator`
- Three risk bands: `>= 1994` geen, `1963-1993` hoog (NEN 2991), `< 1963` middel (NEN 2991)
- Returns `onbekend` when `building is None` or `building.bouwjaar is None`

### Schema Extensions

**`backend/app/schemas/property.py`**
- Added `WkbClassification` Pydantic model: `wkb_applicable`, `gevolgklasse` (GK1/niet_van_toepassing/onbekend), `exclusion_reason`, `disclaimer`
- Added `AsbestIndicator` Pydantic model: `risk` (hoog/middel/geen/onbekend), `bouwjaar`, `norm_reference`, `reden`
- Extended `PropertyReportResponse` with `wkb_classification: WkbClassification | None` and `asbest_indicator: AsbestIndicator | None`

### Aggregator Wiring

**`backend/app/services/property_aggregator.py`**
- Added imports for both classifier functions and schema types
- Calls both classifiers synchronously after `evaluate_wkb_precheck()` at line ~970
- Passes `wkb_classification` and `asbest_result` to `PropertyReportResponse` constructor

---

## Test Results

| Test File | Tests | Result |
|-----------|-------|--------|
| test_wkb_classifier.py | 8 | All PASSED |
| test_asbest_indicator.py | 8 | All PASSED |
| Existing unit tests | Pre-existing failures unchanged | No regressions |

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0dedd3f | test | Add failing tests for wkb_classifier and asbest_indicator (RED) |
| 1b073c0 | feat | Implement wkb_classifier, asbest_indicator services and schema extensions (GREEN) |
| ca8cd6f | chore | Fix import sort order in property_aggregator.py |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Deferred Issues (Pre-existing, Out of Scope)

- `backend/tests/unit/test_bag_wfs.py::test_truncation_detection` — pre-existing failure unrelated to this plan
- `backend/tests/unit/test_rce_client.py` — 2 pre-existing failures
- `backend/tests/unit/test_sru_bekendmakingen.py` — 2 pre-existing failures
- `backend/tests/unit/test_freshness.py` — pre-existing failures (database-dependent)
- mypy `dict` type parameter warnings in `zoning.py`, `address.py`, `property.py` (pre-existing lines) — not caused by this plan

---

## Self-Check: PASSED

- [x] `backend/app/services/wkb_classifier.py` exists (54 lines)
- [x] `backend/app/services/asbest_indicator.py` exists (59 lines)
- [x] `backend/tests/unit/test_wkb_classifier.py` exists (8 tests)
- [x] `backend/tests/unit/test_asbest_indicator.py` exists (8 tests)
- [x] `WkbClassification` class in property.py at line 322
- [x] `AsbestIndicator` class in property.py at line 340
- [x] `wkb_classification` field in PropertyReportResponse at line 531
- [x] `asbest_indicator` field in PropertyReportResponse at line 535
- [x] `classify_wkb` called in property_aggregator.py at line 970
- [x] `assess_asbest_risk` called in property_aggregator.py at line 974
- [x] Commits 0dedd3f, 1b073c0, ca8cd6f verified in git log
- [x] All 16 new unit tests pass
- [x] ruff check passes (no errors)
- [x] No regressions in existing passing unit tests
