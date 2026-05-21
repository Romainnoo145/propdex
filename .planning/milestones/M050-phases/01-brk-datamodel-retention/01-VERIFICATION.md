---
phase: 01-brk-datamodel-retention
verified: 2026-05-18T15:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run a real unfavorite against a parcel that has a persisted BRK row in staging once S02 lands."
    expected: "BRK row stays in DB with soft_deleted_at + hard_delete_after stamped 60 days in the future; favorite row gone."
    why_human: "S01 ships persist-side disabled (M050_BRK_PERSIST_ENABLED=False default). End-to-end check requires either flipping the flag or waiting until S02 BRK Bevragen client lands so a row to soft-delete actually exists in non-test data."
  - test: "Trigger an anomaly-volume hard-delete cron run (e.g. backfill >1000 expired rows in staging) and confirm Sentry receives the warning."
    expected: "Sentry warning event 'brk.retention.cleanup anomaly: N rows hard-deleted in one run (threshold 1000)'."
    why_human: "Test suite uses monkeypatched sentry_sdk.capture_message; real Sentry pipeline is not exercised in CI."
tooling_followup:
  - issue: "node gsd-tools.cjs state advance-plan failed during 01-01 due to STATE.md 'Current Position' prose format"
    impact: "Non-blocking — manual STATE.md updates worked, plan completion still recorded."
    fix_suggestion: "Either tighten the STATE.md schema (require structured frontmatter for Current Position) or relax the parser to tolerate the existing prose format used throughout the project."
deferred_items:
  - "Pre-existing ruff B904 in app/favorites/favorites_service.py:117 (raise HTTPException inside except). Predates this phase — logged in .planning/phases/01-brk-datamodel-retention/deferred-items.md, scope-boundary per CLAUDE.md."
  - "25 pre-existing mypy [type-arg] errors across app/models/*. New-code baseline is stricter (raw_brk_response: dict[str, object] | None / dict[str, Any] | None); cleanup deferred."
---

# Phase 01: BRK Datamodel + Retention — Verification Report

**Phase Goal (from ROADMAP.md):** Persistent BRK-storage met AVG-compliant retention-life-cycle (Q7 LOCKED) en automatische soft → hard delete cleanup.

**Verified:** 2026-05-18
**Status:** passed
**Re-verification:** No — initial verification

This is the foundation phase for M050 (BRK Actiefase-Wedge). Goal-backward audit was driven by ROADMAP success criteria + locked decisions D1-D8 in `.planning/milestones/M050-S01-ENG-PLAN.md`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| T1 | Persistent BRK datamodel exists and is multi-tenant safe | VERIFIED | psql shows table with 18 cols, FK CASCADE to organizations, 4 indexes incl. partial idx_brk_hard_delete, CHECK eigenaar_type_check, UQ uq_brk_org_parcel_fetched. Alembic head = `20260518_m050_s01`. Model at `backend/app/models/brk_ownership_record.py:32` uses TenantMixin (organization_id NOT NULL + indexed). |
| T2 | D2 strip-at-write strips natuurlijk_persoon from nested dicts AND list items | VERIFIED | `backend/app/services/brk_persistence_service.py:52-85` recurses into both `isinstance(value, list)` (line 68) — filtering by `item.get("eigenaar_type") == "natuurlijk_persoon"` (line 74) AND further `strip_raw_brk_response(item)` on survivors (line 76) — and `isinstance(value, dict)` (line 80). 5 dedicated tests in `tests/unit/services/test_brk_persistence_service.py`. |
| T3 | D3 favorites hook resolves org via User.organization_id (deviation from plan — correct) | VERIFIED | `favorites_service.py:415-431` selects `User.organization_id` by `user_id`, calls `soft_delete_for_org_parcel` BEFORE `db.delete(fav)` at line 433. LEFT-join orphan safety-net at `brk_persistence_service.py:178-216` via active_org_parcels subquery joining User + ParcelFavorite. Deviation justified: ParcelFavorite has no `organization_id` column (user-scoped); the plan's `fav.organization_id` assumption was incorrect — corrected per Rule 1. |
| T4 | M050_BRK_PERSIST_ENABLED feature flag gates write path only | VERIFIED | Flag declared at `config.py:252` (default False). `persist_record` raises `FeatureDisabled` at line 102-105 of service. `soft_delete_for_org_parcel` (D3) + `brk_retention_cleanup_job` (cron) + `strip_raw_brk_response` are NOT gated. Test `test_persist_record_raises_feature_disabled` asserts default behavior; happy-path test uses `monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)`. |
| T5 | ARQ cron registered + runs daily 03:00 UTC + structured log + Sentry anomaly | VERIFIED | `worker.py:69` registers `brk_retention_cleanup_job` in `WorkerSettings.functions`. `worker.py:86` adds `cron(brk_retention_cleanup_job, hour=3, minute=0, unique=True)` to `cron_jobs`. Job emits `logger.info("brk.retention.cleanup orphans_softdeleted=%d hard_deleted=%d", ...)` (line 102-105). Anomaly alert at `brk_retention_cleanup_job.py:70-88` calls `sentry_sdk.capture_message` with `level="warning"` when `deleted_count > 1000`. |
| T6 | Retention state-machine: fetched → stale → hard_delete with multi-tenant isolation | VERIFIED | `tests/integration/test_brk_retention_state_machine.py` proves D3 trigger sets `hard_delete_after = soft_deleted_at + 60d`. `test_brk_retention_cleanup_job.py` proves fast-forward hard-delete + idempotency + orphan-pickup + anomaly alert (9 tests). `test_brk_multi_tenant_isolation.py` proves org-B queries return 0 org-A rows + cascade-delete on org removal (3 tests). |
| T7 | Phase 105 regression-critical iron rule holds (ephemeral endpoint unchanged) | VERIFIED | `git log 3bb05109..HEAD -- backend/app/scans/parcels_service.py` returns empty — no commits in this phase touch the file. Last commit on file was `0d4a4864` (M049/S04.2), pre-M050. Regression tests at `backend/tests/regression/test_phase105_brk_modal_still_works.py` add 3 long-term guards (no-row-written + persist_record-never-called + signature-drift). |
| T8 | Code quality gates: files < 300 LOC, ruff clean on new files, no net-new mypy errors | VERIFIED | LOC: model 95 / service 216 / cron job 111 / schemas 58 / migration 129 — all < 300. Ruff clean on all 6 changed/new files; sole error (B904) is pre-existing in favorites_service:117 (predates this phase; logged in deferred-items.md). mypy: zero net-new errors on new files (existing 25 type-arg errors in models/ unchanged). |
| T9 | Requirement traceability complete (BRK-01, BRK-02, BRK-03, TEST-01) | VERIFIED | REQUIREMENTS.md marks all four [x] complete (lines 12, 13, 14, 67). Traceability table maps each to Phase 1 = Complete (lines 109-111, 140). All 7 phase commits prefixed `M050/S01:` per CLAUDE.md hard rule. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `backend/alembic/versions/20260518_m050_s01_create_brk_ownership_records.py` | Alembic migration creates table + indexes + constraints | VERIFIED | 129 LOC. `revision='20260518_m050_s01'`, `down_revision='79117298d1ad'`. upgrade() creates table with 18 columns, 4 indexes (incl. partial + composite), CHECK + UQ + FK CASCADE. downgrade() drops in reverse order. Schema applied; psql confirms head `20260518_m050_s01`. |
| `backend/app/models/brk_ownership_record.py` | SQLAlchemy 2.x model (Base + TenantMixin + TimestampMixin) | VERIFIED | 95 LOC. `class BrkOwnershipRecord(Base, TenantMixin, TimestampMixin)`. Uses `Mapped[]` + `mapped_column()` throughout. `__table_args__` mirrors migration constraints exactly. No redeclaration of organization_id/created_at/updated_at (TenantMixin + TimestampMixin supply them). |
| `backend/app/models/__init__.py` | BrkOwnershipRecord exported in __all__ | VERIFIED | Line 7: `from app.models.brk_ownership_record import BrkOwnershipRecord  # noqa: F401`. Line 51: `"BrkOwnershipRecord",` in `__all__`. |
| `backend/app/core/config.py` | M050_BRK_PERSIST_ENABLED flag default False | VERIFIED | Line 252: `M050_BRK_PERSIST_ENABLED: bool = Field(default=False, description=...)`. Importable via `from app.core.config import settings; settings.M050_BRK_PERSIST_ENABLED`. |
| `backend/app/schemas/brk_ownership_record.py` | Pydantic BRKOwnershipRecordCreate + BRKOwnershipRecordRead | VERIFIED | 58 LOC. `BRKOwnershipRecordCreate` (Literal["rechtspersoon", "overheid"] — D1 enforced at schema layer too). `BRKOwnershipRecordRead` (`from_attributes=True` for ORM mapping). |
| `backend/app/services/brk_persistence_service.py` | Service module: strip + persist + soft-delete + orphan + exceptions + constants | VERIFIED | 216 LOC. Public surface complete: `FeatureDisabled`, `ValidationError`, `strip_raw_brk_response`, `persist_record`, `soft_delete_for_org_parcel`, `find_orphaned_records`, `SOFT_DELETE_RETENTION_DAYS=30`, `HARD_DELETE_OFFSET_DAYS=60`, `ANOMALY_THRESHOLD=1000`, `PERSISTENT_EIGENAAR_TYPES`. Uses `datetime.utcnow()` per CLAUDE.md. CursorResult[Any] cast for rowcount. |
| `backend/app/jobs/brk_retention_cleanup_job.py` | ARQ cron: hard_delete + orphan + anomaly | VERIFIED | 111 LOC. `brk_retention_cleanup_job(ctx)` opens `async_session_factory()`, runs `soft_delete_orphans` then `hard_delete_expired`, commits once, logs structured event, calls `alert_if_anomaly`. Returns `{orphans_softdeleted, hard_deleted, total}`. |
| `backend/app/jobs/worker.py` | brk_retention_cleanup_job in functions + cron_jobs at 03:00 UTC | VERIFIED | Line 16 import. Line 69 in functions. Line 86 in cron_jobs `cron(brk_retention_cleanup_job, hour=3, minute=0, unique=True)`. Coexists with `daily_change_monitor_job` at same hour (unique=True ensures sequential exec). |
| `backend/app/favorites/favorites_service.py` | delete_favorite invokes soft_delete_for_org_parcel before db.delete(fav) | VERIFIED | Line 27 import. Line 415-431 try/except block resolves `User.organization_id` via SELECT, awaits `soft_delete_for_org_parcel(...)`. Line 433 `await db.delete(fav)` AFTER hook. Wrapped in try/except so BRK failure never blocks favorite deletion (orphan-cron is safety-net per D3 design). |
| 7 test files (2 unit + 3 integration + 2 regression) | 44 tests, all green | VERIFIED | All present and committed. Unit tests verified passing (23/23). Integration + regression tests verified existing per `ls -la`; per 01-03-SUMMARY.md all 44 green on full run (154.64s). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `favorites_service.delete_favorite()` | `brk_persistence_service.soft_delete_for_org_parcel()` | `await` call wrapped in try/except, runs BEFORE `db.delete(fav)` | WIRED | Line 421-425. Order: SELECT org_id → soft-delete → db.delete(fav) → db.commit. Try/except resilience verified by regression test `test_delete_favorite_still_succeeds_when_brk_soft_delete_raises`. |
| `worker.WorkerSettings` | `brk_retention_cleanup_job` | `cron(...,hour=3,minute=0,unique=True)` in `cron_jobs` list + function in `functions` list | WIRED | Lines 69 + 86. Python import asserts `brk_retention_cleanup_job in WorkerSettings.functions` — passes. |
| `brk_retention_cleanup_job` | `brk_ownership_records` table | `delete(BrkOwnershipRecord).where(hard_delete_after < now, soft_deleted_at.is_not(None))` | WIRED | `brk_retention_cleanup_job.py:39-42`. Backed by partial idx_brk_hard_delete. |
| `brk_retention_cleanup_job` | `brk_persistence_service.find_orphaned_records` | imported + called by `soft_delete_orphans` | WIRED | Line 24 import. Line 54 call. Orphan IDs feed the batch update. |
| `Alembic migration` | Current head | `down_revision='79117298d1ad'` (zb_m049_s05) | WIRED | psql `alembic_version` table contains `20260518_m050_s01`. Confirmed via `SELECT version_num FROM alembic_version`. |
| `BrkOwnershipRecord model` | `TenantMixin + TimestampMixin` (Base) | `class BrkOwnershipRecord(Base, TenantMixin, TimestampMixin)` | WIRED | Provides org-FK (NOT NULL + indexed) + created_at/updated_at automatically. Multi-tenant CLAUDE.md rule satisfied. |
| `BRKOwnership ephemeral schema` | Phase 105 endpoint | UNCHANGED — no commit touches `app/scans/parcels_service.py` in this phase | WIRED (regression preserved) | `git log 3bb05109..HEAD -- backend/app/scans/parcels_service.py` returns empty. Iron-rule held. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BRK-01 | 01-01-PLAN | brk_ownership_records SQLAlchemy model with locked fields + UNIQUE + TenantMixin | SATISFIED | Model + DDL match REQUIREMENTS.md spec exactly. UQ on (org, parcel, fetched_at) verified in psql. |
| BRK-02 | 01-01-PLAN | Alembic migration + idx_brk_org_parcel + partial idx_brk_hard_delete | SATISFIED | Migration applies cleanly. Both indexes confirmed in psql `\d brk_ownership_records`. Partial WHERE clause correct. |
| BRK-03 | 01-02-PLAN | ARQ cron daily hard-delete + soft-delete on unfavorite + 30→60d retention math | SATISFIED | Cron at 03:00 UTC daily, hard_delete_expired wired; D3 hook in favorites_service; HARD_DELETE_OFFSET_DAYS=60. |
| TEST-01 | 01-03-PLAN | Backend unit tests for datamodel + retention-trigger + ARQ job (fast-forward mock) | SATISFIED | 44 tests across 7 files; mock-clock pattern via direct timestamp injection (project doesn't use freezegun); 23 unit tests verified green during this verification. |

No ORPHANED requirements: REQUIREMENTS.md only maps BRK-01, BRK-02, BRK-03, TEST-01 to Phase 1 — all four claimed by plan frontmatter and all four implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `backend/app/favorites/favorites_service.py` | 117 | `raise HTTPException(...)` inside `except (ValueError, AttributeError)` — missing `from err` or `from None` (ruff B904) | INFO | Pre-existing, predates this phase. Documented in `.planning/phases/01-brk-datamodel-retention/deferred-items.md`. Scope-boundary policy per CLAUDE.md keeps it out of S01 scope. Phase code itself is clean. |
| Various `app/models/*.py` | n/a | 25 pre-existing mypy `[type-arg]` errors on bare `dict` / `list` annotations | INFO | Pre-existing. New code in this phase (`raw_brk_response: Mapped[dict[str, object] | None]`) goes stricter than legacy baseline. No net-new errors introduced. |

No blocker or warning anti-patterns found in new code. No TODO/FIXME/placeholder strings in new files. No `return null`-style stubs. The `persist_record` STUB docstring is honest (it works fully for write but full BRK Bevragen client wiring lands in S02; this is documented behavior, not a placeholder).

### Human Verification Required

| Test | Expected | Why Human |
| ---- | -------- | --------- |
| Real unfavorite against a parcel with a persisted BRK row in staging once S02 lands. | BRK row stamped with soft_deleted_at + hard_delete_after = +60d; favorite row gone. | M050_BRK_PERSIST_ENABLED=False default means S01 doesn't write rows in production. Full E2E will become observable after S02. |
| Anomaly-volume hard-delete cron run (backfill >1000 expired rows in staging). | Sentry warning event "brk.retention.cleanup anomaly: N rows hard-deleted in one run (threshold 1000)". | Tests monkeypatch sentry_sdk.capture_message — real Sentry transport not exercised in CI. |

### Tooling Follow-up

- **`node gsd-tools.cjs state advance-plan` failed during 01-01** due to STATE.md "Current Position" being free-prose rather than structured. STATE.md was updated manually instead and the rest of the phase completed normally. Non-blocking but should be filed as a tooling polish item — either tighten the schema or relax the parser.

### Gaps Summary

None. All 9 must-haves verified, all 4 requirements satisfied, all key links wired, no blocker anti-patterns, regression-critical iron rule (Phase 105 untouched) preserved, code-quality gates green on new code. Two items remain for human verification — both about staging-level observability that S01 by design cannot test in CI (production-disabled write path + real Sentry transport).

Phase 1 is ready to close. M050/S02 (BRK Bevragen client + persist write-path) can build on a clean foundation: model + retention state-machine + AVG defense-in-depth + multi-tenant-isolation contract all proven.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier, Opus 4.7 1M)_
