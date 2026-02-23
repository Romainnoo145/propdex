---
phase: 47-address-intelligence
plan: 02
subsystem: ui, api
tags: [python, fastapi, pydantic, react, typescript, bekendmakingen, classification]

# Dependency graph
requires:
  - phase: 47-01
    provides: address_extractor.py and change_detector refactoring this plan builds on top of

provides:
  - classify_bekendmaking() function mapping SRU titles to Dutch category labels
  - category_label field on ChangeRecordResponse API schema
  - Category badge pill rendering in ChangeTimeline and meldingen.tsx

affects:
  - 47-03 and later — category_label is now available on all ChangeRecord objects

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyword matching classifier: most-specific-first checks, case-insensitive via lower(), single fallback per change_type"
    - "Optional field threading: add to Pydantic schema as str | None = None, compute at response build time"

key-files:
  created:
    - backend/app/services/category_classifier.py
    - backend/tests/unit/test_category_classifier.py
  modified:
    - backend/app/schemas/monitoring.py
    - backend/app/monitoring/router.py
    - frontend/src/lib/types/monitoring.ts
    - frontend/src/components/notifications/ChangeTimeline.tsx
    - frontend/src/routes/_authenticated/meldingen.tsx

key-decisions:
  - "classify_bekendmaking checks 'buiten behandeling' and 'bezwaar' before permit verb patterns — prevents false substrings"
  - "category_label computed at response-build time, not stored in DB — no migration needed"
  - "category_label: str | None = None (nullable) so old records without classification degrade gracefully"
  - "Badge uses grey-800/grey-300 to visually separate from amber match pills and blue parcel pills"

patterns-established:
  - "Response enrichment pattern: compute label inline during ChangeRecordResponse construction, not in a separate pass"

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 47 Plan 02: Category Classifier Summary

**Dutch category labels (e.g. "Omgevingsvergunning verleend") added to every ChangeRecord via keyword-matching classifier, rendered as grey badge pills in ChangeTimeline and meldingen.tsx**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T09:13:47Z
- **Completed:** 2026-02-23T09:16:22Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `classify_bekendmaking(title, change_type)` covers 10 permit categories + 4 zoning categories with fallbacks
- 27 unit tests pass (case-insensitive, all patterns, both fallbacks, unknown type)
- API schema updated: `category_label: str | None = None` on `ChangeRecordResponse`
- Router computes `category_label` for both `get_changes` and `get_changes_for_parcel` endpoints
- Frontend `ChangeRecord` interface extended with `category_label?: string | null`
- Grey badge pill (`bg-grey-800 text-grey-300`) rendered in ChangeTimeline metadata line and MeldingItem

## Task Commits

Each task was committed atomically:

1. **Task 1: Create category classifier module with test suite** - `1d1bbff` (feat)
2. **Task 2: Wire category_label through API schema and frontend display** - `01da9ca` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `backend/app/services/category_classifier.py` - classify_bekendmaking() with 10 permit + 4 zoning category rules
- `backend/tests/unit/test_category_classifier.py` - 27 unit tests covering all categories, case sensitivity, fallbacks
- `backend/app/schemas/monitoring.py` - Added `category_label: str | None = None` to ChangeRecordResponse
- `backend/app/monitoring/router.py` - Import + wire classify_bekendmaking in get_changes and get_changes_for_parcel
- `frontend/src/lib/types/monitoring.ts` - Added `category_label?: string | null` to ChangeRecord interface
- `frontend/src/components/notifications/ChangeTimeline.tsx` - Category badge after relative time, before match pills
- `frontend/src/routes/_authenticated/meldingen.tsx` - Category badge after gemeente context, before timestamp row

## Decisions Made

- `classify_bekendmaking` checks "buiten behandeling" and "bezwaar" before permit verb patterns (aangevraagd/verleend) to prevent substring false positives from title text like "bezwaar tegen verleende vergunning".
- `category_label` computed at response-build time, not stored in the database — avoids a migration and keeps the classifier logic decoupled from the storage layer.
- Field is nullable (`str | None = None`) so any pre-existing records that flow through unmodified code paths degrade gracefully to no badge rather than errors.
- Badge styling: `bg-grey-800 text-grey-300` visually separates category labels from amber rapport pills (`bg-amber-accent/10`) and blue perceel pills (`bg-info/10`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `classify_bekendmaking` is importable from `app.services.category_classifier` for any future plan that needs it
- `category_label` is present on all API responses; Phase 48 address geocoding can extend the same ChangeRecordResponse pattern
- 27 tests provide regression coverage for the classifier keyword ordering

---
*Phase: 47-address-intelligence*
*Completed: 2026-02-23*
