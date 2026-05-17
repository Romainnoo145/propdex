---
phase: 01-datamodel-source-key-catalog
plan: 02
subsystem: datamodel
tags: [m049, data-sources, datamodel, alembic, vendor-managed, rbac]

# Dependency graph
requires:
  - phase: 01-datamodel-source-key-catalog
    plan: 01
    provides: "DATA_SOURCE_KEYS catalog (42 entries) — source_key values match catalog entries"
provides:
  - DataSourceStatus SQLAlchemy model (vendor-managed, no TenantMixin) re-exported from app.models
  - DataSourceStatusCreate / DataSourceStatusRead Pydantic schemas with Literal status enum
  - Alembic migration z0_m049_s01_create_data_source_status (rev 657143b79099)
  - data_source_status table on propdex + propdex_test with UQ + index + FK to users
  - Superuser-RBAC dummy-route test pattern (template for Phase 2 admin endpoints)
affects:
  - phase-02-admin-api (joins data_source_status with DATA_SOURCE_KEYS catalog; reuses RBAC pattern)
  - phase-05-encrypted-credentials (IntegrationCredential reuses vendor-managed pattern locked here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor-managed SQLAlchemy model: Base + TimestampMixin only — explicitly NO TenantMixin / organization_id"
    - "Status enum validated at Pydantic boundary (DataSourceStatusCreate) — plain String(20) at DB level to avoid Postgres-native ENUM migration friction"
    - "Alembic test isolation via asyncio.to_thread + DROP SCHEMA public reset (sidesteps test_db fixture leaving alembic_version out of sync with schema)"
    - "Superuser-RBAC dummy-route fixture: minimal FastAPI app + Depends(get_current_superuser) — proves pattern without coupling to Phase 2 route URL"

key-files:
  created:
    - backend/app/models/data_source_status.py
    - backend/alembic/versions/z0_m049_s01_create_data_source_status.py
    - backend/tests/unit/test_data_source_status_model.py
    - backend/tests/integration/test_alembic_m049_migration.py
    - backend/tests/integration/test_admin_data_sources_rbac.py
  modified:
    - backend/app/models/__init__.py

key-decisions:
  - "Alembic revision SHA = 657143b79099; down_revision = 3d1196c58771 (M048/S04 user_factor_pins head, confirmed via alembic heads pre-write)"
  - "Stale CONTEXT mention of bbdb5c6ff811 (M046-era) explicitly NOT used — verified current head before writing migration per plan §objective alembic-head-note"
  - "Status enum lives in Pydantic only (DataSourceStatusCreate Literal). DB column is plain String(20) — avoids Postgres native ENUM migration friction; revisit when statuses stabilize"
  - "managed_by_user_id FK uses ON DELETE SET NULL (audit-trail row survives user deletion) — diverges from M048 FK pattern (CASCADE) deliberately"
  - "Test isolation strategy: alembic smoke does explicit DROP SCHEMA public + CREATE EXTENSION before replaying full migration chain, because test_db fixture leaves alembic_version inconsistent with schema"

patterns-established:
  - "Vendor-managed model template (no TenantMixin / no organization_id) — Phase 5 IntegrationCredential reuses verbatim"
  - "Superuser-RBAC dummy-route fixture: minimal FastAPI + Depends(get_current_superuser) + dependency_overrides[get_db]"

requirements-completed: [DATA-01, DATA-02, TEST-01]

# Metrics
duration: 11 min
completed: 2026-05-14
---

# Phase 01 Plan 02: DataSourceStatus model + Alembic migration + RBAC scaffold Summary

**Vendor-managed `DataSourceStatus` SQLAlchemy model (no TenantMixin) + Alembic revision `657143b79099` + 23-test battery (model UQ/JSONB/enum, alembic up+down smoke, superuser-RBAC dummy-route pattern) — Phase 2 admin API foundation locked.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-14T12:21:27Z
- **Completed:** 2026-05-14T12:32:47Z
- **Tasks:** 3
- **Files created:** 5 (1 model + 1 migration + 3 tests)
- **Files modified:** 1 (`backend/app/models/__init__.py` — re-export block)

## Accomplishments

- New SQLAlchemy model `DataSourceStatus` (`backend/app/models/data_source_status.py`) — Base + TimestampMixin only, **no TenantMixin / no `organization_id`** per eng-review lock-in 2026-05-14, JSONB `configuratie`, UQ on `(gemeente_code, source_key)`, index on `gemeente_code`, nullable FK `managed_by_user_id` to `users.id` (ON DELETE SET NULL)
- Pydantic schemas `DataSourceStatusCreate` (extra=forbid, Literal status enum) + `DataSourceStatusRead` (from_attributes=True) for Phase 2 API boundary
- Alembic migration `z0_m049_s01_create_data_source_status.py` (revision `657143b79099`, down_revision `3d1196c58771`) — verified up+down roundtrip clean on dev DB + propdex_test
- Test trinity: 12 model unit tests + 1 alembic up/down smoke + 3 superuser-RBAC dummy-route tests = **16 new tests, all green**. Plus 7 P01 catalog tests still green = **23/23 across M049/S01 Phase 1**
- `app.models` re-exports `DataSourceStatus` / `DataSourceStatusCreate` / `DataSourceStatusRead` / `DataSourceStatusValue` so Alembic autogenerate sees the model and Phase 2 imports work cleanly

## Task Commits

Each task was committed atomically with `M049/S01:` prefix per CLAUDE.md harde regels:

1. **Task 1: Wave-0 RED tests (model + alembic + RBAC)** — `68bd3d76` (test)
2. **Task 2: Implement DataSourceStatus model + Pydantic schemas** — `d67ffc19` (feat, includes Rule-1 mypy type-param fix + ruff import-order auto-fix)
3. **Task 3: Add Alembic migration + isolate alembic smoke test** — `aaffdcd4` (feat, includes Rule-3 alembic-test asyncio.to_thread isolation + DROP SCHEMA reset)

## Files Created/Modified

- `backend/app/models/data_source_status.py` — Vendor-managed model + Pydantic schemas (124 lines)
- `backend/alembic/versions/z0_m049_s01_create_data_source_status.py` — Revision 657143b79099, downgrade drops index + table cleanly (80 lines)
- `backend/tests/unit/test_data_source_status_model.py` — 12 tests (parametrized over 4 status values + 3 JSONB shapes)
- `backend/tests/integration/test_alembic_m049_migration.py` — 1 up/down smoke test with full schema reset for isolation
- `backend/tests/integration/test_admin_data_sources_rbac.py` — 3 tests (401 no token, 403 regular user, 200 superuser)
- `backend/app/models/__init__.py` — Re-export block for the four new public names

## Decisions Made

- **Alembic revision lineage:** SHA `657143b79099`; down_revision `3d1196c58771` (M048/S04 user_factor_pins, confirmed via `alembic heads` before writing). The CONTEXT.md mention of `bbdb5c6ff811` was stale (M046-era) — plan §objective explicitly directed verifying the current head, did so.
- **No TenantMixin (vendor-managed lock-in):** Reaffirms eng-review 2026-05-14. Defense-in-depth: `test_no_tenant_columns` asserts `organization_id not in __table__.columns` — any future regression toward tenant-scoping fails CI.
- **Status enum at Pydantic, not DB:** `Literal["live", "broken", "missing", "not_applicable"]` lives in `DataSourceStatusCreate` only. DB column is plain `String(20)`. Trade-off accepted: Phase 2 endpoints must always validate via Pydantic; the trade-off is avoiding Postgres-native ENUM migration friction when status values evolve.
- **FK ondelete=SET NULL** on `managed_by_user_id` (audit-trail survives user deletion) — divergent from M048/S04 `CASCADE` pattern, intentional.
- **Alembic test isolation strategy:** Use `asyncio.to_thread` to escape pytest-asyncio's running loop + explicit `DROP SCHEMA public CASCADE` + replay full migration chain. Reason: `test_db` fixture's `drop_all` leaves `alembic_version` table populated, so naive `alembic upgrade head` becomes a no-op. Full schema reset is correct for an _isolation_ test — and the test does its own `engine.dispose()` cleanup at the end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mypy missing-type-parameters for `dict | None` columns**
- **Found during:** Task 2 (`mypy app/models/data_source_status.py`)
- **Issue:** mypy strict-mode flagged `dict` without type parameters on the JSONB column + both Pydantic schemas (`type-arg` rule)
- **Fix:** Changed all three occurrences to `dict[str, object] | None`. JSONB values are heterogeneous; `object` is the truthful type (vs. forcing `Any`).
- **Files modified:** `backend/app/models/data_source_status.py`
- **Verification:** `mypy app/models/data_source_status.py` clean for this file (project-wide pre-existing errors in 15 other models out of scope; logged out of scope per execution rules)
- **Committed in:** `d67ffc19`

**2. [Rule 1 - Bug] ruff import-order on `app/models/__init__.py`**
- **Found during:** Task 2 (`ruff check app/models/__init__.py`)
- **Issue:** Adding `data_source_status` import after `change_record` violated alphabetical sort
- **Fix:** `ruff check --fix` auto-relocated the import block (placed `data_source_status` after `checklist_progress`, before `factor_extraction_cache`)
- **Verification:** `ruff check` clean
- **Committed in:** `d67ffc19`

**3. [Rule 3 - Blocking] Alembic smoke test hit "asyncio.run() cannot be called from a running event loop"**
- **Found during:** Task 3 (first run of `pytest tests/integration/test_alembic_m049_migration.py`)
- **Issue:** Project's `alembic/env.py` uses `asyncio.run(run_async_migrations())` inside `run_migrations_online`. When pytest-asyncio is already inside an event loop, `asyncio.run()` raises `RuntimeError`.
- **Fix:** Wrap every `command.upgrade` / `command.downgrade` / `command.stamp` call in `asyncio.to_thread(...)` so it executes on a worker thread with its own asyncio bootstrap.
- **Verification:** Alembic test passes solo (`pytest tests/integration/test_alembic_m049_migration.py` exits 0)
- **Committed in:** `aaffdcd4`

**4. [Rule 3 - Blocking] Alembic smoke test failed when run *after* model tests in same session**
- **Found during:** Task 3 (full-suite run `pytest tests/unit/test_data_source_keys_catalog.py tests/unit/test_data_source_status_model.py tests/integration/test_alembic_m049_migration.py tests/integration/test_admin_data_sources_rbac.py`)
- **Issue:** The model tests' `test_db` fixture uses `Base.metadata.drop_all` at teardown but does NOT clear `alembic_version`. So when the alembic smoke test runs next, `alembic_version` still reports the migration as applied, `command.upgrade` becomes a no-op, and the table-existence assertion fails.
- **Fix:** Test now explicitly executes `DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION postgis; CREATE EXTENSION pg_trgm;` before invoking `command.upgrade`. This guarantees the alembic chain replays end-to-end on a known-empty schema (which is the only way to test that the migration correctly creates the FK against `users`).
- **Files modified:** `backend/tests/integration/test_alembic_m049_migration.py`
- **Verification:** Full suite passes (`pytest ... -k "data_source"` 23 passed in 42s)
- **Committed in:** `aaffdcd4`

**5. [Rule 1 - Bug] ruff import-order on alembic test file after asyncio.to_thread refactor**
- **Found during:** Task 3 (post-fix ruff sweep)
- **Issue:** `from alembic import command` and `from app.core.config import settings` placement violated isort rules after the refactor
- **Fix:** `ruff check --fix` repositioned imports
- **Verification:** All 23 tests still pass after formatting
- **Committed in:** `aaffdcd4`

---

**Total deviations:** 5 auto-fixed (2 Rule-1 ruff + 1 Rule-1 mypy + 2 Rule-3 alembic-test isolation). All in test-infrastructure / type-annotation territory — no impact on the model contract, no impact on the migration shape.
**Impact on plan:** Plan executed substantively as written. Only test-fixture / asyncio interactions adjusted. Model + migration files match plan exactly.

## Issues Encountered

- **Pre-existing mypy errors in 15 other model files** (`bulk_query.py`, `area_scan.py`, `parcel_cache.py`, etc.) — out of scope per execution rules. Not caused by this plan. Logged implicitly via mypy output; not adding to deferred-items since the prior P01 deferred-items.md already tracks similar pre-existing housekeeping.

## User Setup Required

None — no external service configuration needed for this datamodel slice.

## Next Phase Readiness

- **Phase 2 (Admin API)** can now register `/admin/data-sources` router gated by `Depends(get_current_superuser)`, query `data_source_status` rows joined with `DATA_SOURCE_KEYS` catalog (P01), and return enumerated statuses without backend roundtrip for catalog metadata. The RBAC dummy-route fixture proves the pattern works against the live test DB.
- **Phase 5 (Encrypted credentials)** can now use this exact pattern for `IntegrationCredential`: vendor-managed (no TenantMixin), superuser-gated routes, plain status string with Pydantic enum at the boundary. Pattern locked.
- No blockers; no concerns.

## Verification

- All 3 acceptance-criteria sets met (Tasks 1, 2, 3 each grep-verified)
- `pytest tests/unit/test_data_source_keys_catalog.py tests/unit/test_data_source_status_model.py tests/integration/test_alembic_m049_migration.py tests/integration/test_admin_data_sources_rbac.py` — **23/23 green** in 42s
- `cd backend && alembic heads` → `657143b79099 (head)` ✓
- `cd backend && alembic upgrade head` exits 0 on dev DB ✓
- `cd backend && alembic downgrade -1 && alembic upgrade head` clean roundtrip on dev DB ✓
- `ruff check backend/app/models/data_source_status.py backend/app/models/__init__.py backend/alembic/versions/z0_m049_s01_create_data_source_status.py backend/tests/unit/test_data_source_status_model.py backend/tests/integration/test_alembic_m049_migration.py backend/tests/integration/test_admin_data_sources_rbac.py` — all green
- `mypy backend/app/models/data_source_status.py` — clean for this file (pre-existing project-wide mypy issues out of scope)
- `grep TenantMixin backend/app/models/data_source_status.py` → 0 lines ✓ (vendor-managed lock-in)
- `grep organization_id backend/app/models/data_source_status.py` → 0 lines ✓
- DataSourceStatus model importable from `app.models` ✓ (re-export verified)

## Self-Check: PASSED

- All 6 declared files present on disk (5 created + 1 modified)
- All 3 task commits present in git log (`68bd3d76`, `d67ffc19`, `aaffdcd4`)
- All 23 pytest tests green at completion
- `ruff check` + `mypy` clean for touched files
- Alembic up + down + up roundtrip verified on dev DB
- New revision `657143b79099` is current alembic head

---
*Phase: 01-datamodel-source-key-catalog*
*Completed: 2026-05-14*
