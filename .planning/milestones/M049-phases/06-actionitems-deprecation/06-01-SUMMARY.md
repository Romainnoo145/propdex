---
phase: 06-actionitems-deprecation
plan: "06-01"
subsystem: api
tags: [action-items, data-sources, admin, catalog, m049, s06]

# Dependency graph
requires:
  - phase: 01-datamodel-source-key-catalog
    provides: DATA_SOURCE_KEYS vendor-managed catalog (42 entries) used as drift target
  - phase: 02-admin-api-layer
    provides: GET /api/admin/data-sources/{gemeente_code} + compute_actions matrix
  - phase: 05-encrypted-credentials
    provides: Type-C credential UX precedent (configure_credential action pattern)
provides:
  - "Backend-owned ACTION_ITEMS_CATALOG (6 source-keyed) + INFRASTRUCTURE_ACTION_ITEMS (12 orphans)"
  - "view_action_item ActionType + compute_actions append rule when source_key in catalog"
  - "Module-load drift guard against DATA_SOURCE_KEYS via _validate_catalog()"
affects: [06-02, 06-03, m050-action-items-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen-dataclass catalog with Literal-typed enums (mirrors data_source_keys.py)"
    - "Lazy module-load drift validator to avoid circular imports"
    - "compute_actions(source_type, status, source_key) — third-arg-conditional action append"

key-files:
  created:
    - backend/app/services/action_items_catalog.py
    - backend/tests/unit/test_action_items_catalog.py
    - backend/tests/integration/test_m049_s06_action_items_action.py
  modified:
    - backend/app/admin/data_sources_schemas.py
    - backend/app/admin/data_sources_helpers.py

key-decisions:
  - "ActionItems content owned by backend as Python dataclass (frozen) — frontend becomes pure consumer in 06-02"
  - "Split into ACTION_ITEMS_CATALOG (6 gemeente-bound) + INFRASTRUCTURE_ACTION_ITEMS (12 orphans) — drift guard only fires on catalog"
  - "view_action_item action always enabled when source_key in catalog, regardless of source_type / status (label only signals presence of ActionItem to consume)"
  - "ActionItem DB entity untouched — UI-content migration only, MIG-03 preserved (zero new Alembic migrations)"
  - "Test fixture welstandsnota chosen over woonvisie because welstandsnota IS in ACTION_ITEMS_CATALOG (woonvisie is not — it has no orphan ActionItem in the legacy frontend ITEMS array)"

patterns-established:
  - "Backend catalog module under app/services/ with frozen dataclass + module-load self-validator (precedent: credential_fields.py, data_source_keys.py)"
  - "compute_actions accepts source_key for catalog-conditional action enrichment — future actions can follow same pattern"

requirements-completed: [MIG-01, MIG-03]

# Metrics
duration: 6min
completed: 2026-05-16
---

# Phase 06 Plan 01: ActionItems Catalog Migration Summary

**Backend-owned `ACTION_ITEMS_CATALOG` (6 source-keyed entries) + `INFRASTRUCTURE_ACTION_ITEMS` (12 orphans) migrated verbatim from frontend `ActionItems.tsx`; `view_action_item` ActionType wired into `compute_actions` for `/api/admin/data-sources/{gemeente_code}` rows.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-16T14:52:02Z
- **Completed:** 2026-05-16T14:58:00Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Migrated 18 ActionItem entries from frontend hardcoded `ITEMS` array into typed backend module (`app/services/action_items_catalog.py`)
- Split into 6 gemeente-bound catalog entries (`ACTION_ITEMS_CATALOG`) keyed by `source_key` in `DATA_SOURCE_KEYS`, and 12 infrastructure orphans (`INFRASTRUCTURE_ACTION_ITEMS`) for global concerns (mail-server, google-oauth, stripe, …)
- Extended `ActionType` Literal to 5 members (added `"view_action_item"`) and wired `compute_actions` to append the new action when `source_key` has a catalog entry — regardless of `source_type` / `status`
- Module-load drift guard `_validate_catalog()` asserts every catalog key exists in `DATA_SOURCE_KEYS`, preventing future drift
- 8 new tests (5 unit + 3 integration) + 18 existing admin data-sources router tests all green
- ActionItem DB entity untouched — zero Alembic migrations added (MIG-03 preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing unit tests for catalog**  — `3f416103` (test)
2. **Task 1 GREEN: ACTION_ITEMS_CATALOG module**  — `8357b99f` (feat)
3. **Task 2: ActionType + compute_actions wiring** — `abbf8261` (feat)
4. **Task 3: integration tests for view_action_item** — `6d745b0c` (test)

## Final Mapping Table (Frontend ITEMS id → backend destination)

| Frontend id | Destination | Key |
| --- | --- | --- |
| brk-api | ACTION_ITEMS_CATALOG | brk-eigendom |
| vindsubsidies | ACTION_ITEMS_CATALOG | vindsubsidies |
| nvm-data | ACTION_ITEMS_CATALOG | nvm-transactiedata |
| welstandsnota | ACTION_ITEMS_CATALOG (done=True) | welstandsnota |
| omgevingsvisie | ACTION_ITEMS_CATALOG (done=True) | omgevingsvisie |
| parkeerbeleid | ACTION_ITEMS_CATALOG | parkeerbeleid |
| google-oauth | INFRASTRUCTURE_ACTION_ITEMS | — |
| mail-server | INFRASTRUCTURE_ACTION_ITEMS | — |
| stripe | INFRASTRUCTURE_ACTION_ITEMS | — |
| kadaster-nhr | INFRASTRUCTURE_ACTION_ITEMS | — |
| gemeente-subsidies | INFRASTRUCTURE_ACTION_ITEMS | — |
| subsidie-matching | INFRASTRUCTURE_ACTION_ITEMS | — |
| von-prijs | INFRASTRUCTURE_ACTION_ITEMS | — |
| wws-punten | INFRASTRUCTURE_ACTION_ITEMS | — |
| rendement-calc | INFRASTRUCTURE_ACTION_ITEMS | — |
| raadsinformatie-cache | INFRASTRUCTURE_ACTION_ITEMS | — |
| funda-enrichment | INFRASTRUCTURE_ACTION_ITEMS | — |
| chat-model-upgrade | INFRASTRUCTURE_ACTION_ITEMS | — |

**Counts:** 6 catalog + 12 infrastructure = 18 entries (1:1 with frontend ITEMS).

## Pytest Summary

```
tests/unit/test_action_items_catalog.py::test_python_action_item_keys_match_data_source_keys PASSED
tests/unit/test_action_items_catalog.py::test_all_action_item_entries_have_required_fields PASSED
tests/unit/test_action_items_catalog.py::test_infrastructure_items_are_non_empty PASSED
tests/unit/test_action_items_catalog.py::test_action_item_keys_are_unique PASSED
tests/unit/test_action_items_catalog.py::test_done_items_are_marked_correctly PASSED

tests/integration/test_m049_s06_action_items_action.py::test_view_action_item_appears_for_catalog_source PASSED
tests/integration/test_m049_s06_action_items_action.py::test_view_action_item_absent_for_non_catalog_source PASSED
tests/integration/test_m049_s06_action_items_action.py::test_type_a_live_row_with_action_item_has_four_actions PASSED

tests/integration/test_admin_data_sources_router.py — 18 passed (regression)
```

**Total: 26 passed, 0 failed.**

## File Line Counts (CLAUDE.md ≤300 rule)

| File | Lines |
| --- | --- |
| backend/app/services/action_items_catalog.py | 267 |
| backend/tests/integration/test_m049_s06_action_items_action.py | 170 |
| backend/app/admin/data_sources_helpers.py | 129 |
| backend/tests/unit/test_action_items_catalog.py | 70 |
| backend/app/admin/data_sources_schemas.py | 55 |

All files under 300 lines. Ruff clean (mypy errors in touched files are pre-existing — out of scope per CLAUDE.md).

## ActionItem DB Entity Verification

```bash
$ ls backend/alembic/versions/ | wc -l
54   # unchanged from start of plan
```

No new Alembic migration. MIG-03 (legacy ActionItem table preserved) is honored.

## Decisions Made

- **welstandsnota chosen as primary test fixture** over woonvisie because woonvisie has no orphan ActionItem entry in the legacy frontend ITEMS array — welstandsnota is in both DATA_SOURCE_KEYS and ACTION_ITEMS_CATALOG, making it the natural smoke-test target for Type-A + catalog interaction.
- **`done=True` only set for welstandsnota + omgevingsvisie**, matching the M045/S05+S06 shipped scope; parkeerbeleid PDF-upload works but the CROW-381 calculator is still roadmap, so done stays False there.
- **`view_action_item` always enabled** — the action button surfaces the migrated ActionItem content regardless of the source's live/missing status. Gating would prevent users from reading the "how to activate this source" copy when it's most needed.

## Deviations from Plan

None — plan executed exactly as written. The plan's plan-text smoke test referenced `compute_actions('A', 'live', 'woonvisie')` which fails the view_action_item assertion (woonvisie is NOT in catalog); switched smoke probe to `welstandsnota` to match actual catalog membership. This is a plan-text smoke clarification, not a behavioral deviation — the implementation matches the plan's `<behavior>` block precisely.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

- `backend/app/services/action_items_catalog.py` exists ✓
- `backend/tests/unit/test_action_items_catalog.py` exists ✓
- `backend/tests/integration/test_m049_s06_action_items_action.py` exists ✓
- `data_sources_schemas.py` contains `view_action_item` ✓
- `data_sources_helpers.py` contains `view_action_item` ✓
- All 4 task commits present in git log: 3f416103, 8357b99f, abbf8261, 6d745b0c ✓
- 26 tests pass (5 unit + 3 integration + 18 regression) ✓
- Alembic migrations unchanged at 54 ✓

## Next Phase Readiness

- Backend ready to surface `view_action_item` action-buttons via existing `/api/admin/data-sources/{gemeente_code}` endpoint
- Plan 06-02 (frontend wiring): consume the new action on row-level button + render `ActionItemEntry` content in modal/drawer; TypeScript twin of `ACTION_ITEMS_CATALOG` will mirror backend dict (precedent: `dataSourceKeys.ts`)
- Plan 06-03 (TEST-05): integration parity tests across the gemeente-bound catalog rows

---
*Phase: 06-actionitems-deprecation*
*Completed: 2026-05-16*
