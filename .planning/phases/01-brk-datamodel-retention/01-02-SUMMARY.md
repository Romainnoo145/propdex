---
phase: 01-brk-datamodel-retention
plan: 02
subsystem: backend-services
tags: [m050, s01, brk, retention, arq, feature-flag, multi-tenant, avg, pydantic]

# Dependency graph
requires:
  - phase: 01-01
    provides: BrkOwnershipRecord model + brk_ownership_records table (Alembic head 20260518_m050_s01) — write target for persist_record stub + read target for retention cron + soft-delete + orphan detection
  - phase: m045+
    provides: User + ParcelFavorite models — User.organization_id resolves favorite owner's org for D3 hook + orphan detection
  - phase: m045+
    provides: async_session_factory + ARQ worker + Sentry SDK + structured logging
provides:
  - "M050_BRK_PERSIST_ENABLED feature flag (D4 write-path-only gate, default False)"
  - "BRKOwnershipRecordCreate + BRKOwnershipRecordRead Pydantic schemas"
  - "brk_persistence_service: strip_raw_brk_response (D2) + persist_record stub (D1+D4+D8) + soft_delete_for_org_parcel (D3 primary) + find_orphaned_records (D3 safety-net)"
  - "FeatureDisabled + ValidationError service exceptions"
  - "Retention constants: SOFT_DELETE_RETENTION_DAYS=30, HARD_DELETE_OFFSET_DAYS=60, ANOMALY_THRESHOLD=1000"
  - "brk_retention_cleanup_job ARQ cron: hard_delete_expired + soft_delete_orphans + alert_if_anomaly"
  - "Worker registration: brk_retention_cleanup_job in WorkerSettings.functions + cron daily 03:00 UTC"
  - "favorites_service.delete_favorite D3 hook: soft-deletes BRK rows for (org, parcel) BEFORE deleting the favorite row"
affects: [01-03 tests, m050/s02 persist write-path implementation, m050/s03 scoring cascade factors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "M050_BRK_PERSIST_ENABLED feature-flag gates write path only — read + retention always live"
    - "Service-layer D8 NULL-naam reject for rechtspersoon complements DB CHECK (D1) for defense-in-depth"
    - "strip_raw_brk_response defensively recurses into nested dicts AND lists (drops natuurlijk_persoon entries by eigenaar_type; recurses into surviving dicts to scrub deeper structures)"
    - "ParcelFavorite is user-scoped (no organization_id column) — D3 hook resolves org_id via User.organization_id join; find_orphaned_records uses LEFT-JOIN against User+ParcelFavorite subquery"
    - "ARQ cron at 03:00 UTC coexists with daily_change_monitor_job (both unique=True, run sequentially under one worker)"
    - "CursorResult[Any] cast pattern for UPDATE/DELETE result.rowcount under SQLAlchemy 2.x async (mypy)"

key-files:
  created:
    - backend/app/schemas/brk_ownership_record.py
    - backend/app/services/brk_persistence_service.py
    - backend/app/jobs/brk_retention_cleanup_job.py
    - .planning/phases/01-brk-datamodel-retention/deferred-items.md
  modified:
    - backend/app/core/config.py
    - backend/app/favorites/favorites_service.py
    - backend/app/jobs/worker.py

key-decisions:
  - "raw_brk_response typed as dict[str, Any] | None on BRKOwnershipRecordCreate — matches Wave-1 model strictness (Mapped[dict[str, object] | None]) and keeps new-code mypy-clean baseline"
  - "strip_raw_brk_response recurses into list items (not just top-level filter) — defensive against nested BRK payloads where natuurlijk_persoon may appear inside a deeper dict, not only at the top-level list root"
  - "find_orphaned_records joins via User.organization_id subquery — ParcelFavorite has user_id FK to users (TenantMixin lives on User), so org-membership is transitive; an orphan = no user in the same org currently favorites the parcel"
  - "favorites_service D3 hook wrapped in try/except — never blocks favorite deletion if BRK soft-delete fails; orphan-cron catches up on next run (resilience over correctness in the moment, per ENG-PLAN D3 design)"
  - "CursorResult[Any] cast for UPDATE/DELETE rowcount — SQLAlchemy 2.x async Result base class doesn't expose rowcount on the public type even though CursorResult always returns the right thing at runtime; cast is mypy-only ergonomic"
  - "Auto-fix: plan referenced fav.organization_id (TenantMixin assumption) but ParcelFavorite has no such column — adapted plan interface to query User.organization_id by user_id (Rule 1 bug correction)"

patterns-established:
  - "Service-layer business rules raise typed exceptions (FeatureDisabled, ValidationError) — callers translate to HTTP status codes; no fastapi.HTTPException leakage from service layer"
  - "Retention constants (SOFT_DELETE_RETENTION_DAYS / HARD_DELETE_OFFSET_DAYS / ANOMALY_THRESHOLD) live in service module + imported by job — single source of truth for retention arithmetic"
  - "ARQ cron registration pattern: import in worker.py + append to WorkerSettings.functions + append cron() to WorkerSettings.cron_jobs (3 edit points per new cron)"

requirements-completed: [BRK-03]

# Metrics
duration: 7m 14s
completed: 2026-05-18
---

# Phase 01 Plan 02: BRK Persistence Service + Retention Cron Summary

**Retention state-machine and AVG defense-in-depth landed end-to-end — feature-flag-gated persist stub, AVG-strip helper, D3 favorites soft-delete trigger, daily ARQ cron with orphan safety-net + Sentry anomaly alert. Plan 01-01 model is now wired up to the full retention life-cycle; persist write-path stays disabled until Kadaster DPA signed.**

## Performance

- **Duration:** 7m 14s
- **Started:** 2026-05-18T14:09:24Z
- **Completed:** 2026-05-18T14:16:38Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- **D4 Feature flag** `M050_BRK_PERSIST_ENABLED: bool = False` added to `Settings` — gates `persist_record()` write path only; read + retention paths always live
- **Pydantic schemas** `BRKOwnershipRecordCreate` (Literal `"rechtspersoon"|"overheid"`) + `BRKOwnershipRecordRead` (`from_attributes=True` for ORM mapping)
- **D2 strip-at-write** helper `strip_raw_brk_response()` recursively redacts natuurlijk_persoon entries from raw BRK responses before JSONB persist — recurses into both nested dicts AND list items
- **D8 service-layer reject** — `persist_record()` raises `ValidationError` when `eigenaar_type='rechtspersoon'` AND `eigenaar_naam` is None/empty
- **D4 service-layer gate** — `persist_record()` raises `FeatureDisabled` when `M050_BRK_PERSIST_ENABLED=False` (default until DPA)
- **D3 primary trigger** — `favorites_service.delete_favorite()` invokes `soft_delete_for_org_parcel()` BEFORE `db.delete(fav)`, wrapped in try/except so BRK failures never block favorite deletion (orphan-cron is the safety-net)
- **D3 safety-net** — `find_orphaned_records()` LEFT-joins BRK rows against `(User.organization_id, ParcelFavorite.parcel_id)` subquery to find rows with no living favorite in their org
- **D6 daily ARQ cron** at 03:00 UTC — `brk_retention_cleanup_job` runs `soft_delete_orphans` first, then `hard_delete_expired`, commits once, logs structured event `brk.retention.cleanup`, fires Sentry warning if `deleted_count > ANOMALY_THRESHOLD (1000)`
- **Retention math constants** centralised in service module: `SOFT_DELETE_RETENTION_DAYS=30` (informational) / `HARD_DELETE_OFFSET_DAYS=60` / `ANOMALY_THRESHOLD=1000`
- **Worker registration** — `brk_retention_cleanup_job` appended to `WorkerSettings.functions` AND `cron_jobs` (3-edit pattern: import + functions + cron)
- **Phase 105 ephemeral path** untouched — `git diff` between HEAD~3 and HEAD on `app/scans/parcels_service.py` shows zero changes (regression gate cleared)
- **All new files < 300 lines** — service: 213 lines, retention job: 111 lines, schemas: 59 lines

## Service module public surface

```python
# Constants
SOFT_DELETE_RETENTION_DAYS = 30
HARD_DELETE_OFFSET_DAYS    = 60
ANOMALY_THRESHOLD          = 1000
PERSISTENT_EIGENAAR_TYPES  = {"rechtspersoon", "overheid"}

# Exceptions
class FeatureDisabled(Exception): ...   # D4 gate
class ValidationError(Exception): ...   # D8 reject

# Functions
def strip_raw_brk_response(raw: dict[str, Any] | None) -> dict[str, Any] | None
async def persist_record(db, organization_id, data: BRKOwnershipRecordCreate) -> BRKOwnershipRecordRead
async def soft_delete_for_org_parcel(db, organization_id, parcel_id) -> int
async def find_orphaned_records(db) -> list[uuid.UUID]
```

## ARQ cron entry

```python
# backend/app/jobs/worker.py — WorkerSettings.cron_jobs
cron(brk_retention_cleanup_job, hour=3, minute=0, unique=True)  # M050/S01 daily 03:00 UTC

# Job entry-point signature
async def brk_retention_cleanup_job(ctx: dict[str, Any]) -> dict[str, int]
# Returns: {"orphans_softdeleted": N, "hard_deleted": M, "total": N+M}
```

## Favorites D3 hook diff hunk

```python
# backend/app/favorites/favorites_service.py — inside delete_favorite, BEFORE db.delete(fav)
+    # M050/S01 D3 primary trigger — soft-delete BRK records for this (org, parcel).
+    try:
+        org_lookup = await db.execute(
+            select(User.organization_id).where(User.id == user_id)
+        )
+        organization_id = org_lookup.scalar_one_or_none()
+        if organization_id is not None:
+            await soft_delete_for_org_parcel(
+                db=db,
+                organization_id=organization_id,
+                parcel_id=fav.parcel_id,
+            )
+    except Exception:  # noqa: BLE001 — never block favorite deletion
+        logger.exception(
+            "BRK soft-delete failed for parcel=%s user=%s — favorite delete continues; "
+            "orphan-cron will catch up",
+            parcel_id, user_id,
+        )

     await db.delete(fav)
     await db.commit()
```

## Task Commits

1. **Task 1: Feature flag + Pydantic schemas** — `b4855276` (feat)
2. **Task 2: Service layer + favorites D3 hook** — `f94571f5` (feat)
3. **Task 3: ARQ retention cron + worker registration** — `6cea8c29` (feat)

## Files Created/Modified

- `backend/app/core/config.py` — added `M050_BRK_PERSIST_ENABLED: bool = False` Field
- `backend/app/schemas/brk_ownership_record.py` (NEW, 59 LOC) — `BRKOwnershipRecordCreate` + `BRKOwnershipRecordRead`
- `backend/app/services/brk_persistence_service.py` (NEW, 213 LOC) — full retention state-machine + D2 strip + D4/D8 gated persist stub
- `backend/app/jobs/brk_retention_cleanup_job.py` (NEW, 111 LOC) — daily cron entry + 3 helpers (hard_delete_expired / soft_delete_orphans / alert_if_anomaly)
- `backend/app/jobs/worker.py` — import + 1 entry in `functions` + 1 entry in `cron_jobs`
- `backend/app/favorites/favorites_service.py` — added `User` + `soft_delete_for_org_parcel` imports + D3 hook block inside `delete_favorite()` BEFORE `db.delete(fav)`
- `.planning/phases/01-brk-datamodel-retention/deferred-items.md` (NEW) — pre-existing B904 + 25 pre-existing mypy type-arg warnings logged as out-of-scope

## Decisions Made

- **`dict[str, Any] | None` on raw_brk_response (schemas)** — kept new-code mypy strictness baseline (matches Wave-1 model). Plan suggested bare `dict | None` but stricter is healthier.
- **strip_raw_brk_response recurses into list items, not only at top level** — defensive against nested BRK payloads where natuurlijk_persoon could appear inside deeper dicts. Drop logic preserved at list-entry level (`eigenaar_type == "natuurlijk_persoon"` matches → entry omitted); recursion runs on surviving dicts.
- **find_orphaned_records via `User.organization_id` join subquery** — ParcelFavorite is user-scoped (no TenantMixin / no organization_id column), so org-membership is transitive through User. Orphan = no user in the same org has the parcel favorited.
- **favorites_service D3 hook resolves org_id via SELECT User.organization_id by user_id** — same root reason; one extra round-trip on the favorite-delete path (acceptable, sub-millisecond on indexed PK lookup).
- **D3 hook wrapped in try/except** — favorite delete is the primary user concern; BRK soft-delete failure must not block it. Orphan-cron will pick up missed records nightly.
- **CursorResult[Any] cast for rowcount** — SQLAlchemy 2.x async `Result` base type doesn't expose `rowcount` on its public surface despite runtime always being `CursorResult`. Cast keeps mypy clean without typing.cast at every callsite (pattern reusable for S02).
- **ARQ cron at 03:00 UTC alongside daily_change_monitor_job** — ARQ `unique=True` ensures sequential execution under a single worker; low-traffic window, no contention.

## Deviations from Plan

### Rule 1 — Bug fix (plan interface mismatch)

**Plan referenced `fav.organization_id` (assumed TenantMixin column on ParcelFavorite)**
- **Found during:** Task 2 (favorites D3 wiring)
- **Issue:** ParcelFavorite is user-scoped (`user_id` FK to `users`, no `organization_id` column / no TenantMixin). The plan's interface assumption (`fav.organization_id`) would fail at attribute access.
- **Fix:** Added `from app.models.user import User` and resolved org_id via `select(User.organization_id).where(User.id == user_id)` before invoking `soft_delete_for_org_parcel`. Same adaptation applied to `find_orphaned_records()` which now LEFT-joins against a `(User.organization_id, ParcelFavorite.parcel_id)` subquery instead of a direct join on `ParcelFavorite.organization_id`.
- **Files modified:** `backend/app/favorites/favorites_service.py`, `backend/app/services/brk_persistence_service.py`
- **Commit:** `f94571f5`

### Rule 1/3 — mypy strictness adaptation

**`result.rowcount` not typed on SQLAlchemy 2.x async `Result` base class**
- **Found during:** Task 2 + Task 3 (mypy)
- **Issue:** mypy [attr-defined] on `result.rowcount` because the async `db.execute(update/delete)` returns `Result[Any]`, not the runtime concrete `CursorResult[Any]`.
- **Fix:** `from sqlalchemy import CursorResult` + `result = cast("CursorResult[Any]", await db.execute(...))`. Runtime behaviour unchanged.
- **Files modified:** `backend/app/services/brk_persistence_service.py`, `backend/app/jobs/brk_retention_cleanup_job.py`

### Scope-boundary logging

**Pre-existing ruff B904 in `favorites_service.py:117`** — `raise HTTPException(...)` inside `except (ValueError, AttributeError)` predates this plan. Logged to `.planning/phases/01-brk-datamodel-retention/deferred-items.md` per CLAUDE.md scope-boundary rule. NOT fixed.

**25 pre-existing mypy `type-arg` errors in `app/models/*`** — bare `dict` / `list` annotations across 16 files. Same baseline Wave 1 documented. NOT fixed.

## Issues Encountered

- During Task 2 verification I ran `git stash push -m tmp-check ...` to compare ruff output against pre-change baseline. The stash push targeted paths that hadn't been added to git yet, so git refused; immediately after, when I ran `git stash pop`, it surfaced an unrelated older stash (`stash@{0}: gsd: pre-merge stash for M032`) and applied it as unmerged paths on `.gitignore` + `frontend/src/components/reports/components/AIAnalysisModal.tsx`. Resolved by `git checkout HEAD -- .gitignore frontend/src/components/reports/components/AIAnalysisModal.tsx` (resetting only those two unrelated files to HEAD, leaving my staged Task 2 work intact). The older stash itself is still in the stash list — no data lost. Lesson: avoid `git stash push` of unknown untracked files as a baseline-comparison trick; use `git show HEAD:path | ruff -` instead.

## Self-Check

- File `backend/app/schemas/brk_ownership_record.py` — FOUND
- File `backend/app/services/brk_persistence_service.py` — FOUND
- File `backend/app/jobs/brk_retention_cleanup_job.py` — FOUND
- `M050_BRK_PERSIST_ENABLED` in `app/core/config.py` — FOUND (default False, asserted)
- `BRKOwnershipRecordCreate` + `BRKOwnershipRecordRead` importable — VERIFIED
- `strip_raw_brk_response`, `persist_record`, `soft_delete_for_org_parcel`, `find_orphaned_records`, `FeatureDisabled`, `ValidationError` importable — VERIFIED
- `SOFT_DELETE_RETENTION_DAYS=30`, `HARD_DELETE_OFFSET_DAYS=60`, `ANOMALY_THRESHOLD=1000` — VERIFIED
- D2 strip drops natuurlijk_persoon at list-level — VERIFIED via `strip_raw_brk_response({'items':[...]})` returning only rechtspersoon entry
- `brk_retention_cleanup_job in WorkerSettings.functions` — VERIFIED
- `cron(brk_retention_cleanup_job, ...)` in `WorkerSettings.cron_jobs` — VERIFIED
- `favorites_service.delete_favorite` calls `soft_delete_for_org_parcel` BEFORE `db.delete(fav)` — VERIFIED via source order inspection
- File line counts: service 213 ≤ 300, job 111 ≤ 300, schemas 59 ≤ 300 — VERIFIED
- `ruff check` on every touched new/modified file — PASSED (B904 in favorites_service is pre-existing, logged in deferred-items)
- `mypy` on new files — 0 new errors (pre-existing 25 errors in `app/models/*` unchanged)
- Phase 105 ephemeral `app/scans/parcels_service.py:get_parcel_eigendom` UNCHANGED — VERIFIED via `git diff HEAD~3 HEAD app/scans/parcels_service.py` = empty
- Commits `b4855276`, `f94571f5`, `6cea8c29` exist in git log — VERIFIED

## Self-Check: PASSED

## Next Phase Readiness

- Plan 01-03 (unit + integration + multi-tenant + regression tests) has the complete service surface to exercise: D2 strip, D4 FeatureDisabled, D8 ValidationError, D3 primary + safety-net, D6 anomaly alert, retention cron timestamps + DELETE
- Multi-tenant test (T-Critical) can exercise `find_orphaned_records` to confirm cross-org isolation — orphan calculation now correctly transits through `User.organization_id`
- M050/S02 persist write-path can flip the FF, reuse `BRKOwnershipRecordCreate` schema verbatim, and only needs to add: BRK Bevragen client + transaction wiring + 30-day re-favorite skip-refetch + `get_latest_for_parcel`

---
*Phase: 01-brk-datamodel-retention*
*Completed: 2026-05-18*
