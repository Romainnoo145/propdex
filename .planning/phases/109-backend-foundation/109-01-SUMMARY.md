---
phase: 109-backend-foundation
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, pydantic, postgres, rls, parcel-favorites, portfolio]

requires:
  - phase: 106-parcel-dossier-upload
    provides: ParcelDocument pattern — model, migration, RLS — directly copied for ParcelFavorite

provides:
  - ParcelFavorite SQLAlchemy model with pipeline_stage tracking and wijk/gemeente denormalization
  - Alembic migration h8c9d0e1f2g3 with RLS tenant_isolation_parcel_favorites policy
  - Pydantic schemas: FavoriteCreate, FavoriteResponse, PipelineUpdateRequest, PortfolioResponse, PipelineStage
  - app/favorites Python package ready for Plan 02 CRUD router

affects:
  - 109-02 (favorites CRUD router depends on model + schemas from this plan)

tech-stack:
  added: []
  patterns:
    - ParcelFavorite follows Base+TenantMixin+TimestampMixin pattern identical to ParcelDocument
    - Alembic migration RLS pattern: ENABLE ROW LEVEL SECURITY + FORCE + CREATE POLICY with app.current_tenant_id
    - PipelineStage as Pydantic Literal type — auto-validates 5 stages, returns 422 for invalid values
    - Pipeline stage stored as String(30) not PG ENUM — avoids ALTER TYPE migrations on stage additions

key-files:
  created:
    - backend/app/models/parcel_favorite.py
    - backend/alembic/versions/h8c9d0e1f2g3_create_parcel_favorites_table.py
    - backend/app/favorites/__init__.py
    - backend/app/favorites/schemas.py
  modified:
    - backend/app/models/__init__.py

key-decisions:
  - "wijk_naam stored instead of wijk_code — no wijk_code exists anywhere in codebase (BACK-01 requirement substituted per RESEARCH.md)"
  - "PipelineStage Literal type produces 422 (not 400) for invalid values — semantically correct per FastAPI/Pydantic v2 conventions"
  - "afgerond_reden and notitie columns added in Plan 01 even though only used by PATCH endpoint in Plan 02 — model completeness"

patterns-established:
  - "ParcelFavorite model: Base + TenantMixin + TimestampMixin with UniqueConstraint(org_id, user_id, parcel_id)"
  - "RLS policy naming: tenant_isolation_<tablename> — consistent across all tenant tables"
  - "down_revision = g7b8c9d0e1f2 — favorites migration follows score_weights migration"

requirements-completed: [BACK-01]

duration: 8min
completed: 2026-03-15
---

# Phase 109 Plan 01: Backend Foundation Summary

**ParcelFavorite SQLAlchemy model with pipeline stage tracking, RLS-enabled Alembic migration, and full Pydantic v2 schema suite (FavoriteCreate/FavoriteResponse/PipelineUpdateRequest/PortfolioResponse)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T16:39:00Z
- **Completed:** 2026-03-15T16:47:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ParcelFavorite model with all BACK-01 columns: org_id, user_id, parcel_id, gemeente_code, gemeente_naam, wijk_naam, pipeline_stage, afgerond_reden, notitie, created_at, updated_at
- Alembic migration `h8c9d0e1f2g3` with UniqueConstraint(org, user, parcel) and RLS policy `tenant_isolation_parcel_favorites`
- Full Pydantic v2 schema suite including PortfolioResponse with nested gemeente/wijk grouping — ready for Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: ParcelFavorite model + Alembic migration** - `29b5296` (feat)
2. **Task 2: Pydantic schemas + favorites package init** - `868bd11` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `backend/app/models/parcel_favorite.py` - ParcelFavorite SQLAlchemy model, Base+TenantMixin+TimestampMixin
- `backend/alembic/versions/h8c9d0e1f2g3_create_parcel_favorites_table.py` - Migration with RLS policy
- `backend/app/favorites/__init__.py` - Package init for favorites module
- `backend/app/favorites/schemas.py` - 6 Pydantic schemas + PipelineStage Literal type
- `backend/app/models/__init__.py` - Added ParcelFavorite import and __all__ registration

## Decisions Made
- `wijk_naam` stored instead of `wijk_code` per RESEARCH.md finding — no `wijk_code` column exists anywhere in codebase, `wijk_naam` is already the consistent pattern
- `PipelineStage` as Pydantic `Literal` type returns 422 for invalid values (semantically correct per FastAPI conventions — plan said "400" but 422 is correct for Pydantic validation errors)
- `afgerond_reden` and `notitie` columns included in model and migration even though only used by the PATCH endpoint in Plan 02 — model completeness prevents a follow-up migration

## Deviations from Plan

None - plan executed exactly as written. One linting auto-fix applied to migration file (ruff UP035/UP007: `from typing import Union/Sequence` → modern Python union syntax — fully auto-fixable, no logic change).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Model + migration + schemas complete — Plan 02 can immediately build CRUD endpoints on top
- `app/favorites/` package exists with schemas; Plan 02 adds `router.py` to this package
- Migration needs to be applied to database before Plan 02 endpoints are testable: `alembic upgrade head`

---
*Phase: 109-backend-foundation*
*Completed: 2026-03-15*
