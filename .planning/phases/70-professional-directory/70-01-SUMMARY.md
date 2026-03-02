---
phase: 70-professional-directory
plan: "01"
subsystem: database
tags: [postgresql, sqlalchemy, alembic, rls, array, gin-index]

# Dependency graph
requires:
  - phase: 69-risicobeoordeling-dossier
    provides: GeneratedDossier model + Alembic migration pattern (3d97e34821f2)

provides:
  - Professional SQLAlchemy model with ARRAY columns werkgebied + gevolgklassen
  - Alembic migration b166d55eeb91 with professionals table + RLS FOR SELECT USING (TRUE)
  - ADMIN_API_KEY setting in Settings config for platform management endpoints
  - Cross-tenant integration test suite (9 tests) proving NULL org_id visibility

affects: [71-lead-routing, 70-02-admin-api, 70-03-frontend-directory]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NULL org_id platform resource: Professional uses Base+TimestampMixin with no TenantMixin — visible to all tenants"
    - "Cross-tenant RLS: FOR SELECT USING (TRUE) allows any authenticated session to SELECT professionals"
    - "PostgreSQL ARRAY GIN index: postgresql_using='gin' on werkgebied + gevolgklassen for @> containment queries"
    - "ARRAY type cast in raw SQL: ARRAY['value']::varchar[] required for @> operator with character varying[] columns"

key-files:
  created:
    - backend/app/models/professional.py
    - backend/alembic/versions/b166d55eeb91_add_professionals_table.py
    - backend/tests/integration/test_professionals_cross_tenant.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/core/config.py
    - backend/.env.example

key-decisions:
  - "Professional model uses Base+TimestampMixin (NOT TenantMixin) — no organization_id — platform-wide resource pattern (DIR-03)"
  - "RLS policy FOR SELECT USING (TRUE) — any authenticated tenant can read; no INSERT/UPDATE/DELETE policy needed since app_role has table-level GRANT"
  - "ADMIN_API_KEY added to Settings with empty default — required for Plan 02 admin CRUD endpoints"
  - "GIN indexes on werkgebied and gevolgklassen enable Phase 71 @> containment queries for lead matching"

patterns-established:
  - "NULL org_id + RLS USING (TRUE): platform-wide resources that any tenant can read without isolation"
  - "PostgreSQL ARRAY @> operator: requires explicit ::varchar[] cast when using raw SQL with character varying[] columns"

requirements-completed: [DIR-01, DIR-03]

# Metrics
duration: ~8min
completed: 2026-03-02
---

# Phase 70 Plan 01: Professional Model Data Layer Summary

**PostgreSQL professionals table with ARRAY GIN indexes, cross-tenant RLS FOR SELECT USING (TRUE), and ADMIN_API_KEY config — 9 integration tests GREEN confirming NULL org_id visibility across all tenants**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-02T16:33:00Z
- **Completed:** 2026-03-02T16:41:10Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Professional SQLAlchemy model with ARRAY(String) werkgebied + gevolgklassen columns, GIN-indexed for @> queries
- Alembic migration b166d55eeb91 creates professionals table with RLS FOR SELECT USING (TRUE) cross-tenant policy
- ADMIN_API_KEY setting added to Settings class and .env.example for Phase 70 Plan 02 admin endpoints
- 9 integration tests passing: cross-tenant visibility, GIN index verification, ARRAY containment queries, model structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Professional model + ADMIN_API_KEY config + Alembic migration** - `acd9e98` (feat)
2. **Task 2: Cross-tenant integration test for professional visibility** - `b0f88ef` (feat)

**Plan metadata:** (docs commit — see state update below)

## Files Created/Modified
- `backend/app/models/professional.py` - Professional model: Base+TimestampMixin, ARRAY columns, GIN indexes, no TenantMixin
- `backend/alembic/versions/b166d55eeb91_add_professionals_table.py` - Migration: create table + GIN indexes + RLS FOR SELECT USING TRUE
- `backend/tests/integration/test_professionals_cross_tenant.py` - 9 tests: cross-tenant visibility, GIN indexes, ARRAY queries, model structure
- `backend/app/models/__init__.py` - Added Professional import and __all__ entry
- `backend/app/core/config.py` - Added ADMIN_API_KEY field to Settings class
- `backend/.env.example` - Added ADMIN_API_KEY documentation section

## Decisions Made
- **NULL org_id pattern confirmed**: Professional extends Base+TimestampMixin only — no organization_id column. This is the architectural foundation of the platform-wide directory (DIR-03).
- **RLS FOR SELECT USING (TRUE)**: Any authenticated tenant can read professionals. No per-tenant filtering. Insert/update/delete flows via table-level GRANT on app_role (no matching policies = allow).
- **ADMIN_API_KEY**: Empty default string in Settings. Platform management endpoints in Plan 02 will require this key in the Authorization header.
- **GIN indexes**: Both werkgebied and gevolgklassen get GIN indexes with `postgresql_using='gin'` for efficient @> operator use in Phase 71 lead matching.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ARRAY type mismatch in raw SQL test**
- **Found during:** Task 2 (cross-tenant integration test)
- **Issue:** Raw SQL `ARRAY['Amsterdam']` produces `text[]` but column type is `character varying[]`. PostgreSQL raises `operator does not exist: character varying[] @> text[]`
- **Fix:** Added explicit `::varchar[]` cast: `ARRAY['Amsterdam']::varchar[]`
- **Files modified:** `backend/tests/integration/test_professionals_cross_tenant.py`
- **Verification:** Test passed after cast was added
- **Committed in:** `b0f88ef` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type cast in raw SQL)
**Impact on plan:** Fix was necessary for correct test behavior. No scope creep.

## Issues Encountered
None — migration applied cleanly, model imported correctly, all tests passed after the varchar[] cast fix.

## User Setup Required
None — ADMIN_API_KEY defaults to empty string. Set it before deploying Plan 02 admin endpoints.

## Next Phase Readiness
- professionals table exists in database with correct schema, indexes, and RLS policy
- Professional model importable from `app.models.professional`
- ADMIN_API_KEY config ready for Plan 02 (admin CRUD endpoints for supply-side onboarding)
- Phase 71 lead matching foundation in place (GIN indexes, ARRAY columns, cross-tenant visibility)

---
*Phase: 70-professional-directory*
*Completed: 2026-03-02*
