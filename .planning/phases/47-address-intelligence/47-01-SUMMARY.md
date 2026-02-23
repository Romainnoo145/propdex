---
phase: 47-address-intelligence
plan: 01
subsystem: api
tags: [regex, sru, bekendmakingen, address-extraction, tdd, python]

# Dependency graph
requires: []
provides:
  - "extract_address_from_title(title) -> dict | None — multi-strategy Dutch address extractor"
  - "extract_huisnummer(address_str) -> int | None — house number parser"
  - "address_components dict stored in metadata_json on each ChangeRecord permit"
affects:
  - "48-parcel-matching: needs extract_address_from_title output for BAG geocoding"
  - "change_detector: refactored to use new module"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-strategy regex extraction: keyword-before, postcode-anchored, dash-separator, bare-fallback"
    - "TDD: RED commit (failing test) -> GREEN commit (implementation) -> refactor in same plan"
    - "Structured dict output from extractors (not raw strings) for Phase 48 matching"

key-files:
  created:
    - backend/app/services/address_extractor.py
    - backend/tests/unit/test_address_extractor.py
  modified:
    - backend/app/services/change_detector.py

key-decisions:
  - "Multi-strategy approach (5 strategies) instead of single giant regex — each strategy handles a subset of real-world SRU formats"
  - "Postcode-anchored extraction is most reliable when postcode present — tried second, after keyword-before"
  - "Return structured dict (not raw string) to give Phase 48 clean field access without re-parsing"
  - "Store address_components in metadata_json so ChangeRecord.address stays backward-compatible"
  - "Guard against bestemmingsplan/wijzigingsplan false positives with NO_ADDRESS_RE"
  - "Guard against generic 'week N' titles with GENERIC_TITLE_RE"
  - "_strip_permit_prefix() removes leading keywords before finding street name — solves 'Reguliere omgevingsvergunning Straat N' pattern"

patterns-established:
  - "SRU address extraction: always try postcode-anchored first when postcode present, then fall back"
  - "address_extractor.py is standalone — no DB, no HTTP, pure string processing"

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 47 Plan 01: Address Extractor Summary

**Standalone Dutch address extractor with 5-strategy regex approach — handles all 9 SRU bekendmaking title formats, 34 tests, stores structured address_components in metadata_json for Phase 48 parcel matching.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T02:05:58Z
- **Completed:** 2026-02-23T02:11:24Z
- **Tasks:** 3 (RED, GREEN, refactor + integration)
- **Files modified:** 3

## Accomplishments

- Created `address_extractor.py` with `extract_address_from_title()` and `extract_huisnummer()` — 34 tests, all passing
- Handles 9 real SRU bekendmaking title formats including multi-word streets ("Laan van Meerdervoort"), spaced postcodes ("5935 BG"), huisnummer additions ("15a", "123-A"), activity descriptions ("voor het kappen van een boom"), and gemeente prefixes ("Gemeente Venlo -")
- Refactored `change_detector.py` to import from `address_extractor` (removed 30-line inline function), stores `address_components` dict in `metadata_json` for Phase 48 parcel matching

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing tests** - `d5d667a` (test)
2. **Task 2: GREEN — implement address_extractor.py** - `85850ef` (feat)
3. **Task 3: Integration — refactor change_detector.py** - `488c194` (feat)

_Note: TDD tasks have separate RED and GREEN commits per TDD protocol._

## Files Created/Modified

- `backend/app/services/address_extractor.py` — Standalone module with extract_address_from_title() and extract_huisnummer()
- `backend/tests/unit/test_address_extractor.py` — 34 tests covering formats A-I with real SRU title examples (295 lines)
- `backend/app/services/change_detector.py` — Removed inline function, imports from address_extractor, stores address_components in metadata_json

## Decisions Made

- **Multi-strategy over monolithic regex:** 5 independent strategies (keyword-before, postcode-anchored, dash-separator, bare-fallback) each handle a subset — easier to debug and extend
- **Structured dict output:** `extract_address_from_title()` returns `{street, huisnummer, huisnummer_toevoeging, postcode, city, full_address}` so Phase 48 can access fields directly without re-parsing
- **Backward compatibility:** `ChangeRecord.address` still receives `full_address` string; new `address_components` go in `metadata_json` — no DB migration needed
- **Permit keyword stripping:** `_strip_permit_prefix()` removes leading keywords like "Reguliere omgevingsvergunning" or "Ter inzage" before looking for street names — critical for formats E, F, I

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial `_find_street_and_number` too greedy — captured keyword prefixes as part of street name**
- **Found during:** Task 2 GREEN phase (first implementation attempt)
- **Issue:** "Reguliere omgevingsvergunning Laan van Meerdervoort 123-A" extracted street as "Reguliere omgevingsvergunning Laan van Meerdervoort" instead of "Laan van Meerdervoort"
- **Fix:** Added `_strip_permit_prefix()` function that removes leading permit keywords before running street extraction; rewrote regex to require capital-starting first word
- **Files modified:** backend/app/services/address_extractor.py
- **Verification:** Format F tests now pass; all 34 tests green
- **Committed in:** 85850ef (Task 2 GREEN commit)

**2. [Rule 1 - Bug] `extract_huisnummer()` incorrectly rejected 4-digit house numbers**
- **Found during:** Task 2 GREEN phase testing
- **Issue:** Guard `len(m.group(1)) == 4` was intended to prevent postcode digits from matching as house numbers, but also blocked valid house numbers like 1234
- **Fix:** Removed 4-digit length guard; only keep year-range guard (1900-2100); postcodes are already excluded by context in the main extractor
- **Files modified:** backend/app/services/address_extractor.py
- **Verification:** `test_large_number` (extract_huisnummer("Hoofdweg 1234") == 1234) now passes
- **Committed in:** 85850ef (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, found during GREEN phase, fixed inline before first passing commit)
**Impact on plan:** Both fixes required for correct address extraction. No scope creep — same module, same interface.

## Issues Encountered

- First `_STREET_WITH_NUMBER_RE` regex used `finditer` over full title without stripping keyword prefixes — led to greedy matches. Solved by adding `_strip_permit_prefix()` before calling `_find_street_and_number()`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `extract_address_from_title()` is stable and fully tested — Phase 48 can call it directly on title strings
- `address_components` dict in `metadata_json` on all new ChangeRecords — ready for BAG geocoding lookup
- Existing ChangeRecords lack `address_components` in metadata — Phase 48 may need backfill migration or re-extraction on the fly

---
*Phase: 47-address-intelligence*
*Completed: 2026-02-23*
