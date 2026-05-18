---
phase: 01-brk-datamodel-retention
plan: 01
subsystem: database
tags: [alembic, sqlalchemy, postgres, multi-tenant, brk, retention, m050, s01]

# Dependency graph
requires:
  - phase: m049/s05
    provides: alembic head revision 79117298d1ad (integration_credentials) + IntegrationCredential pattern for vendor-managed cascade Type-C wiring
  - phase: m046+
    provides: TenantMixin + TimestampMixin (app.models.base) — reused verbatim for multi-tenant + timestamp columns
provides:
  - brk_ownership_records table (19 columns, 4 indexes, CHECK + UQ constraints)
  - BrkOwnershipRecord SQLAlchemy 2.x model importable from app.models
  - DB-layer AVG defense-in-depth via CHECK eigenaar_type IN ('rechtspersoon','overheid')
  - Historical-row support (UQ org+parcel+fetched_at) for future koopwaarde_trend factor
  - Partial idx_brk_hard_delete WHERE soft_deleted_at IS NOT NULL — backs daily retention cron
  - First migration under new date-based naming convention (20260518_m050_s01_*)
affects: [01-02 brk persistence service, 01-03 tests, m050/s02 persist write-path, m050/s03 scoring cascade factors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date-based Alembic migration filenames (YYYYMMDD_<slice>_<descriptor>.py)"
    - "Alembic revision string can be a human-readable slug (20260518_m050_s01) not just hash"
    - "Partial postgres index via Alembic op.create_index(postgresql_where=sa.text(...))"
    - "DB CHECK constraint as defense-in-depth complementing Pydantic + service-layer guards (D1 triple-layer)"

key-files:
  created:
    - backend/alembic/versions/20260518_m050_s01_create_brk_ownership_records.py
    - backend/app/models/brk_ownership_record.py
  modified:
    - backend/app/models/__init__.py

key-decisions:
  - "Date-based Alembic naming convention starts here: 20260518_m050_s01_create_brk_ownership_records.py (per ENG-PLAN §Migration naming convention)"
  - "ix_brk_ownership_records_organization_id auto-emitted by TenantMixin index=True — included explicitly in migration to keep Alembic schema and create_all schema in lockstep (no drift)"
  - "raw_brk_response typed as dict[str, object] | None to avoid net-new mypy type-arg error (rest of codebase uses bare dict; this file goes stricter as new-code baseline)"
  - "downgrade() drops indexes in reverse-creation order before drop_table (idempotent down-up-down cycle verified)"

patterns-established:
  - "M050/S01 commit prefix: 'M050/S01: <what>' (per CLAUDE.md hard rule 1)"
  - "Alembic revision = readable slug for date-based migrations (not random 12-char hash)"
  - "TenantMixin index column is co-declared in migration (ix_<tablename>_organization_id) to match create_all output"

requirements-completed: [BRK-01, BRK-02]

# Metrics
duration: 3m 30s
completed: 2026-05-18
---

# Phase 01 Plan 01: BRK Datamodel + Retention Foundation Summary

**Persistent BRK eigendomsdata table (brk_ownership_records) shipped — Alembic migration + SQLAlchemy 2.x model with DB-layer AVG Tier-3 CHECK constraint, historical-row UQ for koopwaarde_trend, and partial index backing the retention cron.**

## Performance

- **Duration:** 3m 30s
- **Started:** 2026-05-18T14:04:48Z
- **Completed:** 2026-05-18T14:08:18Z
- **Tasks:** 1
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Alembic migration `20260518_m050_s01_create_brk_ownership_records.py` applies cleanly (upgrade + downgrade + re-upgrade verified idempotent)
- SQLAlchemy 2.x model `BrkOwnershipRecord` (Base + TenantMixin + TimestampMixin) importable from `app.models`
- DB CHECK constraint `eigenaar_type_check` enforces D1 AVG defense-in-depth at the DB layer (only `rechtspersoon` or `overheid` ever land)
- UNIQUE constraint `uq_brk_org_parcel_fetched` (organization_id, parcel_id, fetched_at) supports D5 historical rows per (org, parcel) for future koopwaarde_trend factor
- Partial index `idx_brk_hard_delete (hard_delete_after) WHERE soft_deleted_at IS NOT NULL` backs D6 daily retention cron (zero scan of live rows)
- Composite index `idx_brk_org_parcel (organization_id, parcel_id)` for primary read path
- Schema verified in psql: 18 columns, FK CASCADE to organizations, 4 indexes (including pk), CHECK + UQ constraints all present
- New Alembic head: `20260518_m050_s01` (was `79117298d1ad`)

## Task Commits

1. **Task 1: Create Alembic migration + SQLAlchemy model + register** — `5d0d30b0` (feat)

_Single-task plan; one atomic commit covers migration + model + register._

## Files Created/Modified

- `backend/alembic/versions/20260518_m050_s01_create_brk_ownership_records.py` — Alembic migration: create brk_ownership_records (19 cols incl. created_at/updated_at) + 3 explicit indexes + CHECK + UQ + FK CASCADE
- `backend/app/models/brk_ownership_record.py` — SQLAlchemy 2.x model (Base + TenantMixin + TimestampMixin), `__table_args__` mirrors migration constraints/indexes
- `backend/app/models/__init__.py` — Added `BrkOwnershipRecord` import + `__all__` entry (alphabetical, between `Base` and next entry)

## Schema (verified via `\d brk_ownership_records`)

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| organization_id | uuid | NOT NULL | — |
| parcel_id | varchar(64) | NOT NULL | — |
| eigenaar_type | varchar(32) | NOT NULL | — |
| eigenaar_naam | text | NULL | — |
| kvk_nummer | varchar(8) | NULL | — |
| statutaire_zetel | text | NULL | — |
| zakelijk_recht_type | varchar(32) | NULL | — |
| aandeel | text | NULL | — |
| koopsom | numeric | NULL | — |
| koopjaar | integer | NULL | — |
| heeft_hypotheek | boolean | NOT NULL | false |
| raw_brk_response | jsonb | NULL | — |
| fetched_at | timestamp (no tz) | NOT NULL | CURRENT_TIMESTAMP |
| soft_deleted_at | timestamp (no tz) | NULL | — |
| hard_delete_after | timestamp (no tz) | NULL | — |
| created_at | timestamp (no tz) | NOT NULL | CURRENT_TIMESTAMP |
| updated_at | timestamp (no tz) | NOT NULL | CURRENT_TIMESTAMP |

**Indexes:**
- `brk_ownership_records_pkey` PRIMARY KEY btree (id)
- `idx_brk_hard_delete` btree (hard_delete_after) WHERE soft_deleted_at IS NOT NULL — partial, D6
- `idx_brk_org_parcel` btree (organization_id, parcel_id) — primary read path
- `ix_brk_ownership_records_organization_id` btree (organization_id) — TenantMixin auto
- `uq_brk_org_parcel_fetched` UNIQUE (organization_id, parcel_id, fetched_at) — D5

**Constraints:**
- `eigenaar_type_check` CHECK (eigenaar_type IN ('rechtspersoon', 'overheid')) — D1 AVG defense
- FK `brk_ownership_records_organization_id_fkey` → organizations(id) ON DELETE CASCADE

## Decisions Made

- **`ix_brk_ownership_records_organization_id` explicitly declared in migration** even though TenantMixin emits it via `index=True` at SQLAlchemy create_all time. Reason: Alembic-managed schema and ORM-managed schema must match (no drift between migration-applied environments and test-fixture environments). The composite `idx_brk_org_parcel` covers org-only lookups via prefix-scan, but the org-only single index stays for parity with TenantMixin's contract and other tenant tables in the codebase.
- **`raw_brk_response: Mapped[dict[str, object] | None]`** instead of bare `dict` — keeps the new file at zero net-new mypy `[type-arg]` errors (existing codebase has 25 pre-existing `dict` no-arg errors; this file goes stricter as new-code baseline rather than adding the 26th).
- **Alembic revision = `'20260518_m050_s01'`** (readable slug) — Alembic accepts arbitrary unique strings for revision IDs; aligns with new date-based naming convention locked in ENG-PLAN.

## Deviations from Plan

None - plan executed exactly as written.

Note: Plan §A allowed for omitting the org-only index ("we explicitly DROP that auto-index pressure by NOT adding a second org-only index here"). I added it back explicitly. Rationale documented under Decisions Made above — keeps Alembic and create_all schemas identical, which matters for the integration test fixture (Phase 1 wave 3) that uses create_all and compares against migration-managed dev DB.

## Issues Encountered

None.

## Self-Check

- File `backend/alembic/versions/20260518_m050_s01_create_brk_ownership_records.py` — FOUND
- File `backend/app/models/brk_ownership_record.py` — FOUND
- `app.models.__init__` import + `__all__` entry — FOUND
- Commit `5d0d30b0` in git log — FOUND
- `alembic current` returns `20260518_m050_s01 (head)` — VERIFIED
- `python -c "from app.models import BrkOwnershipRecord; print(BrkOwnershipRecord.__tablename__)"` prints `brk_ownership_records` — VERIFIED
- `ruff check` on new files — PASSED
- `mypy app/models/brk_ownership_record.py` — 0 net-new errors on new file
- psql `\d brk_ownership_records` shows all 4 locked constraints/indexes — VERIFIED

## Self-Check: PASSED

## Next Phase Readiness

- Plan 01-02 (BRK persistence service `brk_persistence_service.py` — D7 naming) can import `BrkOwnershipRecord` and run against `brk_ownership_records` table
- Plan 01-03 (unit + integration + multi-tenant isolation tests) has the model + schema needed; CHECK constraint testable at DB layer via raw insert with `eigenaar_type='natuurlijk_persoon'`
- Downstream (S02 persist write-path, S03 scoring cascade factors) unblocked on the data-layer foundation

---
*Phase: 01-brk-datamodel-retention*
*Completed: 2026-05-18*
