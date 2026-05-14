---
phase: 01-datamodel-source-key-catalog
plan: 01
subsystem: catalog
tags: [m049, data-sources, catalog, python, typescript, vendor-managed]

# Dependency graph
requires:
  - phase: 00-pre-m049-context
    provides: eng-review locked schema (DataSourceKeyEntry: key/label_nl/source_type/description/voedt_factor)
provides:
  - DATA_SOURCE_KEYS catalog in both Python and TS (42 entries: 20 Type-A + 17 Type-B + 5 Type-C)
  - DataSourceKeyEntry dataclass (Python) + interface (TS)
  - get_entry / get_entries_by_type lookup helpers (Python) + getEntry / getEntriesByType (TS)
  - SOURCE_TYPE_LABELS Dutch UI labels (TS)
  - Catalog completeness + Python<->TS sync test battery (7 tests)
affects:
  - 01-02-PLAN.md (DataSourceStatus model — can rely on source_keys being stable)
  - phase-02-admin-api (admin endpoints enumerate over this catalog)
  - phase-03-admin-ux (frontend renders rows without backend roundtrip for labels/types)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-maintained Python <-> TS twin catalog (M045/S05 pattern reused)"
    - "Drift detection via pytest textual-regex parse of TS file"
    - "Frozen dataclass for catalog entries (Python) mirrored by readonly TS interface"

key-files:
  created:
    - backend/app/policy_documents/data_source_keys.py
    - backend/tests/unit/test_data_source_keys_catalog.py
    - frontend/src/lib/constants/dataSourceKeys.ts
    - .planning/phases/01-datamodel-source-key-catalog/deferred-items.md
  modified: []

key-decisions:
  - "Catalog deliberately separate from existing M045 source_keys.py / dataSources.ts to avoid naming-confusion (cascade-level vs data-source-type keys)"
  - "42 entries shipped (>=27 required): 20 Type-A cascade-uploads, 17 Type-B open APIs, 5 Type-C paid integrations"
  - "Kebab-case regex relaxed to allow leading digit (3d-bag is a canonical catalog key)"
  - "Drift detection via Python-side pytest parsing TS file textually (regex on key: literals) — no node/ts-compiler dependency"

patterns-established:
  - "Vendor-managed catalog pattern: no TenantMixin, no organization_id — single source of truth for all orgs"
  - "Pre-existing unrelated TS errors logged to deferred-items.md per scope boundary rule"

requirements-completed: [DATA-03, TEST-01]

# Metrics
duration: 4 min
completed: 2026-05-14
---

# Phase 01 Plan 01: Vendor-managed data-source-key catalog Summary

**Python module + TypeScript mirror exporting `DATA_SOURCE_KEYS` (42 entries across Type-A cascade-uploads / Type-B open APIs / Type-C paid integrations) with 7-test catalog-completeness + Python↔TS sync battery.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-14T12:13:29Z
- **Completed:** 2026-05-14T12:18:24Z
- **Tasks:** 3
- **Files created:** 4 (3 source + 1 deferred-items)
- **Files modified:** 0

## Accomplishments

- New Python catalog `backend/app/policy_documents/data_source_keys.py` with 42 frozen `DataSourceKeyEntry` records and `get_entry` / `get_entries_by_type` helpers
- New TypeScript mirror `frontend/src/lib/constants/dataSourceKeys.ts` with identical key-set, `SOURCE_TYPE_LABELS` Dutch UI mapping, and `getEntry` / `getEntriesByType` helpers
- New pytest suite `backend/tests/unit/test_data_source_keys_catalog.py` — 7 tests covering count threshold, type coverage, dup detection, non-empty labels, kebab-case format, Python↔TS sync, and lookup helpers (all 7 green)
- Phase 1 catalog foundation locked: Phase 2 admin API + Phase 3 admin UX can enumerate without backend roundtrip for labels/types

## Task Commits

Each task was committed atomically with `M049/S01:` prefix per CLAUDE.md harde regels:

1. **Task 1: Write catalog completeness test (RED)** — `cb43663d` (test)
2. **Task 2: Create Python catalog `data_source_keys.py`** — `c24f5529` (feat, includes Rule-1 test-regex fix)
3. **Task 3: Create TypeScript mirror `dataSourceKeys.ts`** — `ad068aed` (feat, includes Rule-3 test-path fix + deferred-items.md)

## Files Created/Modified

- `backend/app/policy_documents/data_source_keys.py` — Python catalog with frozen `DataSourceKeyEntry` dataclass, `DATA_SOURCE_KEYS` constant, lookup helpers
- `backend/tests/unit/test_data_source_keys_catalog.py` — 7-test completeness + sync battery
- `frontend/src/lib/constants/dataSourceKeys.ts` — TypeScript mirror with identical 42-entry key-set + helpers
- `.planning/phases/01-datamodel-source-key-catalog/deferred-items.md` — Pre-existing `npm run check` failures (unrelated to M049/S01) logged out of scope

## Decisions Made

- **Catalog separateness:** Did NOT extend `source_keys.py` or `dataSources.ts` — those are M045 cascade-level keys, eng-review locked decision to keep concerns separate (2026-05-14, commit 7439e3a1)
- **Entry count:** Shipped 42 entries (well above ≥27 requirement) to capture full landscape now; admin UI ordering = Type-A first, then B, then C
- **Sync mechanism:** Hand-maintained twin (M045/S05 pattern) verified by Python-side regex parse of TS file — no codegen / OpenAPI overhead for leaf constants

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kebab-case test regex rejected canonical `3d-bag` key**
- **Found during:** Task 2 (after creating Python catalog, the `test_all_keys_are_kebab_case` test failed)
- **Issue:** Plan-supplied regex `^[a-z][a-z0-9-]*$` requires lowercase letter as first char, but `3d-bag` (a plan-mandated canonical key from CONTEXT §catalog files + plan acceptance criteria grep) starts with a digit
- **Fix:** Relaxed regex to `^[a-z0-9]+(-[a-z0-9]+)*$` (proper kebab-case: alphanumeric tokens hyphen-joined). Added explanatory comment.
- **Files modified:** `backend/tests/unit/test_data_source_keys_catalog.py`
- **Verification:** All 6 non-TS-sync tests pass after fix; `3d-bag` accepted
- **Committed in:** `c24f5529`

**2. [Rule 3 - Blocking] TS_CATALOG_PATH path resolution wrong (parents[2] vs parents[3])**
- **Found during:** Task 3 (running full test suite — TS-sync test failed with `TS mirror missing: /home/.../backend/frontend/src/lib/...`)
- **Issue:** Plan-supplied `Path(__file__).resolve().parents[2] / "../frontend/..."` evaluated to `backend/frontend/...` — wrong because the test file is at `backend/tests/unit/test_X.py` so `parents[2] = backend/`, not project root
- **Fix:** Changed to `parents[3]` which resolves to project root, then descend into `frontend/src/lib/constants/dataSourceKeys.ts`
- **Files modified:** `backend/tests/unit/test_data_source_keys_catalog.py`
- **Verification:** TS-sync test green; all 7 tests pass
- **Committed in:** `ad068aed`

**3. [Rule 1 - Bug] Prettier formatting issues in new TS file**
- **Found during:** Task 3 (`npx prettier --check` failed)
- **Issue:** Auto-generated long lines exceeded Prettier print-width
- **Fix:** Ran `prettier --write` to auto-format
- **Files modified:** `frontend/src/lib/constants/dataSourceKeys.ts`
- **Verification:** `prettier --check` passes; all 7 pytest tests still green after formatting
- **Committed in:** `ad068aed`

---

**Total deviations:** 3 auto-fixed (2 Rule-1 bugs + 1 Rule-3 blocking). All in the test infrastructure or formatting — no impact on the catalog contract itself.
**Impact on plan:** Plan executed substantively as written. Only test-fixture details adjusted. Final shape (42 entries, 3 types, ≥27 minimum) matches plan exactly.

## Issues Encountered

- **`npm run check` reports pre-existing TS errors in unrelated files** (verkenner.tsx, ReportSidebar.stories.tsx, SideRailNav.stories.tsx, ~12 more). Verified via `git stash` test that these are NOT caused by M049/S01. The new TypeScript catalog file itself has no React/motion/router dependencies and contains only plain types + array literals; visual inspection + prettier format verify cleanliness. Logged in `deferred-items.md` for triage in dedicated cleanup task. Scope boundary applied per execution rules.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 01-02 (`DataSourceStatus` SQLAlchemy model + Alembic migration) can now reference `DATA_SOURCE_KEYS` as the canonical source-key enumeration
- Phase 2 admin API can enumerate over either Python or TS catalog (key-set proven identical)
- Phase 3 admin UX can render rows without backend roundtrip for `label_nl` / `source_type` / `description` / `voedt_factor`
- No blockers; no concerns

## Verification

- All 3 acceptance criteria sets met (Tasks 1, 2, 3 each grep-verified)
- `pytest tests/unit/test_data_source_keys_catalog.py` — 7/7 green
- `ruff check backend/app/policy_documents/data_source_keys.py backend/tests/unit/test_data_source_keys_catalog.py` — passes
- `mypy backend/app/policy_documents/data_source_keys.py` — passes
- `prettier --check frontend/src/lib/constants/dataSourceKeys.ts` — passes
- Type-A/B/C distribution: 20/17/5 = 42 (≥ 27 required, all 3 types present)
- 5 canonical keys (woonvisie, bag-panden, brk-eigendom, 3d-bag, ep-online-energielabel) present in both files

## Self-Check: PASSED

- All 5 declared files present on disk (3 source + SUMMARY + deferred-items)
- All 3 task commits present in git log (cb43663d, c24f5529, ad068aed)
- All 7 pytest catalog tests green at completion
- Python `ruff check` + `mypy` clean for touched files
- TypeScript file Prettier-formatted; only pre-existing unrelated `npm run check` errors (logged out of scope in deferred-items.md)

---
*Phase: 01-datamodel-source-key-catalog*
*Completed: 2026-05-14*
