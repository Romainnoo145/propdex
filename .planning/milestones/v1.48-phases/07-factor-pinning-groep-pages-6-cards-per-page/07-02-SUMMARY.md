---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: "02"
subsystem: backend-api
tags: [factor-pinning, backend, alembic, fastapi, multi-tenant, PIN-02, PIN-03]
dependency_graph:
  requires: [07-01-wave-0-stubs]
  provides: [user-factor-pins-table, factor-pins-rest-api, PIN-02, PIN-03, SC2, SC3, SC9, SC10]
  affects: [07-03, 07-04, 07-05]
tech_stack:
  added: []
  patterns: [sqlalchemy-2x-mapped-column, check-before-insert-conflict-avoidance, explicit-org-filter-per-query, asyncpg-statement-cache-fix]
key_files:
  created:
    - backend/app/models/user_factor_pin.py
    - backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py
    - backend/app/users/factor_pins/__init__.py
    - backend/app/users/factor_pins/schemas.py
    - backend/app/users/factor_pins/router.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/main.py
    - backend/tests/conftest.py
decisions:
  - "Check-before-insert instead of catch-IntegrityError: avoids SQLAlchemy async session rollback/greenlet issues on Python 3.14 + asyncpg; matches auth_service.py project pattern"
  - "statement_cache_size=0 + pool_pre_ping=False in test_engine: fixes asyncpg prepared-statement DDL cache bug causing pg_type_typname_nsp_index UniqueViolation between tests on Python 3.14"
  - "7 explicit organization_id == current_user.organization_id filters in router (list, count, max-pos, duplicate-check, insert, delete-check, delete): no implicit middleware magic per CLAUDE.md security rules"
  - "position = max(existing) + 1 on create; gaps allowed on delete; frontend sorts by position ASC"
metrics:
  duration: "~45 minutes"
  completed_date: "2026-04-26"
  tasks_completed: 3
  files_created: 5
  files_modified: 3
---

# Phase 07 Plan 02: Backend UserFactorPin Model + REST API Summary

**One-liner:** Persistent per-user factor pins via UserFactorPin SQLAlchemy 2.x model + Alembic migration + FastAPI CRUD under /api/users/me/factor-pins with explicit multi-tenant isolation and check-before-insert conflict avoidance.

## What Was Built

### Task 1: UserFactorPin Model + Alembic Migration + models/__init__.py

- **`backend/app/models/user_factor_pin.py`** — `UserFactorPin(Base, TenantMixin, TimestampMixin)` model with 5 columns: `id` (UUID gen_random_uuid()), `user_id` (FK users CASCADE), `category` (String 16), `factor_key` (String 64), `position` (Integer). UniqueConstraint `uq_user_factor_pins_user_cat_key` on (user_id, category, factor_key). Composite index `ix_user_factor_pins_lookup` on (user_id, category). TenantMixin provides `organization_id` + index. TimestampMixin provides `created_at` + `updated_at`.
- **`backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py`** — Revision `3d1196c58771`, `down_revision='28d2d029856d'`. Creates `user_factor_pins` table with all 8 columns + UniqueConstraint + 3 indexes (org_id, user_id, lookup composite). `upgrade()` + `downgrade()` fully implemented.
- **`backend/app/models/__init__.py`** — Added `from app.models.user_factor_pin import UserFactorPin # noqa: F401` import + `"UserFactorPin"` entry in `__all__` for Alembic autogenerate awareness.

Migration round-trip verified: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` all succeed.

### Task 2: factor_pins Schemas + Router + main.py Mount

- **`backend/app/users/factor_pins/schemas.py`** — `PinCategory = Literal["potentie", "risico"]`, `FactorPinCreate(BaseModel)` with `category` + `factor_key` (1-64 chars), `FactorPinResponse(BaseModel, ConfigDict(from_attributes=True))` with `id`, `category`, `factor_key`, `position`, `created_at`.
- **`backend/app/users/factor_pins/router.py`** — `APIRouter(prefix="/api/users/me/factor-pins")` with 3 endpoints:
  - `GET ""` → 200 `list[FactorPinResponse]` sorted by position ASC
  - `POST ""` → 201 `FactorPinResponse` (check-before-insert → 409 if duplicate; max-6 guard → 400 MAX_PINS_REACHED; auto-increment position)
  - `DELETE "/{pin_id}"` → 204 (ownership + tenant check before delete; 404 if not found)
  - All 3 handlers filter explicitly on `organization_id == current_user.organization_id`
- **`backend/app/main.py`** — Added `from app.users.factor_pins.router import router as factor_pins_router` import + `app.include_router(factor_pins_router)` mount.

### Task 3: Full Backend Regression Suite Verification

- All 13 new stub tests from Plan 01 now green (2 unit + 3 migration + 8 router)
- Pre-existing test suite baseline confirmed (failures are pre-existing order-dependent flakiness, not caused by Plan 02 changes)
- Ruff clean on all touched files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] asyncpg DDL statement cache causes pg_type UniqueViolation between tests**

- **Found during:** Task 1 verification — `pytest tests/unit/test_user_factor_pin_model.py` failed with `pg_type_typname_nsp_index UniqueViolation` on `cached_api_responses`
- **Root cause:** asyncpg caches `CREATE TABLE` prepared statements within a process. When test 1's `create_all` creates `cached_api_responses`, asyncpg caches the prepared statement. Test 1's `drop_all` removes the table+type. Test 2's `create_all` re-executes the cached prepared statement, which tries to register the type again — duplicate conflict. This is a Python 3.14 + asyncpg + SQLAlchemy 2.x interaction bug.
- **Fix:** Added `connect_args={"statement_cache_size": 0}` to the test engine in `conftest.py` to disable asyncpg's prepared statement cache for DDL operations.
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** `f04210bf`

**2. [Rule 3 - Blocking] pool_pre_ping causes MissingGreenlet on IntegrityError recovery**

- **Found during:** Task 2 verification — `test_post_duplicate_pin_returns_409` failed with `MissingGreenlet: greenlet_spawn has not been called`
- **Root cause:** After an `IntegrityError` during `db.flush()`, when the invalidated asyncpg connection is returned to the pool, `pool_pre_ping=True` tries to ping it via `await_only()` outside a greenlet context.
- **Fix 1:** Changed `pool_pre_ping=False` in test engine (not needed for short-lived test connections).
- **Fix 2:** Changed router from catch-IntegrityError+rollback pattern to check-before-insert pattern (matching auth_service.py project precedent). This avoids the session rollback/greenlet interaction entirely and is the correct project pattern.
- **Files modified:** `backend/tests/conftest.py`, `backend/app/users/factor_pins/router.py`
- **Commit:** `f04210bf`, `b4a3afab`

## Self-Check

### Files Created

- [x] `backend/app/models/user_factor_pin.py` exists
- [x] `backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py` exists
- [x] `backend/app/users/factor_pins/__init__.py` exists
- [x] `backend/app/users/factor_pins/schemas.py` exists
- [x] `backend/app/users/factor_pins/router.py` exists

### Key Patterns

- [x] `class UserFactorPin(Base, TenantMixin, TimestampMixin)` in user_factor_pin.py
- [x] `uq_user_factor_pins_user_cat_key` UniqueConstraint in model
- [x] `down_revision: str | Sequence[str] | None = '28d2d029856d'` in migration
- [x] `from app.users.factor_pins.router import router as factor_pins_router` in main.py
- [x] `app.include_router(factor_pins_router)` in main.py
- [x] `organization_id == current_user.organization_id` in router (7 occurrences)
- [x] `MAX_PINS_REACHED` in router
- [x] `FactorPinCreate` and `FactorPinResponse` in schemas.py

### Commits

- [x] `3921e397` — feat(07-02): add UserFactorPin model, Alembic migration, and Base.metadata registration
- [x] `b4a3afab` — feat(07-02): add factor_pins router + schemas; mount under /api/users/me/factor-pins
- [x] `f04210bf` — fix(07-02): add statement_cache_size=0 + pool_pre_ping=False to test engine

## Self-Check: PASSED
