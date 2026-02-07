---
phase: 06-security-configuration
plan: 03
subsystem: database
tags: [postgresql, rls, row-level-security, multi-tenant, security, alembic]

# Dependency graph
requires:
  - phase: 06-01
    provides: "MIGRATION_DATABASE_URL setting and security logging utilities"
  - phase: 05-api-integration
    provides: "TenantContextMiddleware sets request.state.organization_id"
provides:
  - "Database-layer tenant isolation via RLS policies"
  - "Fail-closed RLS policies on all 7 tenant-scoped tables"
  - "get_db() dependency sets tenant context per request"
  - "Separated migration credentials (superuser) from app credentials (app_role)"
  - "app_role deployment script for production environments"
affects: ["All future database queries (RLS enforced)", "Production deployment (requires app_role setup)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SET LOCAL session variables for tenant context"
    - "FORCE ROW LEVEL SECURITY for non-superuser enforcement"
    - "NULLIF fail-closed pattern (NULL never equals UUID)"
    - "Separate migration vs application database credentials"

key-files:
  created:
    - backend/sql/setup_app_role.sql
    - backend/alembic/versions/0800fa8394d7_enable_rls_on_all_tenant_tables.py
  modified:
    - backend/app/core/database.py
    - backend/sql/rls_policies.sql
    - backend/alembic/env.py

key-decisions:
  - "Use SET LOCAL (not SET) to scope session variable to transaction"
  - "NULLIF fail-closed pattern instead of COALESCE fail-open"
  - "FORCE ROW LEVEL SECURITY to enforce on table owner"
  - "Alembic uses migration_database_url with superuser privileges"

patterns-established:
  - "RLS context flow: TenantContextMiddleware → request.state.organization_id → get_db() → SET LOCAL → RLS policies"
  - "Fail-closed security: missing session variable denies all access"
  - "Migration separation: MIGRATION_DATABASE_URL (superuser) for DDL, DATABASE_URL (app_role) for runtime"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 06 Plan 03: RLS Enforcement Summary

**Database-layer tenant isolation enforced via fail-closed RLS policies on all 7 tenant tables with per-request context setting**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T13:18:48Z
- **Completed:** 2026-02-07T13:21:36Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Enabled FORCE ROW LEVEL SECURITY on all 7 tenant-scoped tables (users, refresh_tokens, cached_api_responses, pdf_documents, parsing_jobs, saved_reports, projects)
- Updated get_db() dependency to set tenant context via SET LOCAL per request
- Created fail-closed RLS policies using NULLIF pattern (missing session variable = denied access)
- Separated Alembic migration credentials from application runtime credentials
- Provided app_role deployment script for production environments

## Task Commits

Each task was committed atomically:

1. **Task 1: Update get_db() with RLS context and update auth dependencies** - `8b363b4` (feat)
2. **Task 2: Rewrite RLS policies fail-closed and add all tenant tables** - `c50ad2e` (feat)
3. **Task 3: Update Alembic env.py to use migration URL** - `6b79274` (feat)

## Files Created/Modified

- `backend/app/core/database.py` - Added Request parameter to get_db(), executes SET LOCAL app.current_tenant_id for authenticated sessions
- `backend/sql/rls_policies.sql` - Rewritten with fail-closed policies for all 7 tenant tables, FORCE RLS enforcement
- `backend/sql/setup_app_role.sql` - Deployment script to create app_role with proper permissions
- `backend/alembic/env.py` - Uses migration_database_url (superuser) instead of DATABASE_URL (app_role)
- `backend/alembic/versions/0800fa8394d7_enable_rls_on_all_tenant_tables.py` - Migration applies RLS to all tenant tables

## Decisions Made

**1. SET LOCAL over SET for session variables**
- Rationale: SET LOCAL is transaction-scoped, preventing context leakage across pooled connections. SET persists for entire connection lifetime, dangerous with connection pooling.

**2. NULLIF fail-closed pattern instead of COALESCE fail-open**
- Rationale: NULLIF(current_setting(...), '')::uuid returns NULL when session variable is unset. NULL = organization_id is always FALSE in SQL, denying access. The old COALESCE pattern had a fallback that made it fail-open (allowed all rows when variable unset).

**3. FORCE ROW LEVEL SECURITY on all tables**
- Rationale: Without FORCE, table owner bypasses RLS. FORCE ensures RLS applies to everyone except superusers and BYPASSRLS roles.

**4. Separate migration_database_url from DATABASE_URL**
- Rationale: DDL operations (CREATE TABLE, ALTER TABLE, CREATE POLICY) require superuser. Application runtime uses app_role (non-superuser) with RLS enforced. Alembic needs superuser, app needs restricted role.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully. RLS policies applied, Alembic migration ran cleanly, application starts without errors.

## User Setup Required

**Production deployment requires app_role creation.**

To enforce RLS in production:

1. Run `backend/sql/setup_app_role.sql` as superuser (postgres):
   ```bash
   psql -U postgres -d crmplus -f backend/sql/setup_app_role.sql
   ```

2. Update backend/.env with two database URLs:
   ```env
   # Application runtime (RLS enforced)
   DATABASE_URL=postgresql+asyncpg://app_role:password@localhost:5433/crmplus

   # Migrations only (superuser for DDL)
   MIGRATION_DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5433/crmplus
   ```

3. Verify RLS enforcement:
   ```sql
   -- Should return 't' for all tenant tables
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname='public' AND tablename IN (
     'users', 'refresh_tokens', 'cached_api_responses',
     'pdf_documents', 'parsing_jobs', 'saved_reports', 'projects'
   );
   ```

**Development environments:** Currently using superuser connection (bypasses RLS). This is acceptable for local development but must NOT be used in production.

## Next Phase Readiness

**Ready for:** Phase 7 (Error Handling), Phase 8 (Monitoring), Phase 9 (Testing)

**Blockers:** None

**Concerns:**
- RLS policies are now defined and enabled, but application still connects as superuser (dev mode). Production deployment MUST use app_role to enforce RLS.
- get_db() depends on TenantContextMiddleware setting request.state.organization_id. Middleware must run before any database access.
- Initial authentication (get_current_user) reads users table which has RLS. This works because middleware extracts org_id from JWT and sets it before database query.

**Testing considerations for Phase 9:**
- Verify RLS blocks cross-tenant access (attempt query with wrong org_id)
- Verify fail-closed behavior (query with no session variable set)
- Verify middleware → get_db() → RLS flow for all endpoints
- Test app_role connection (non-superuser) enforces policies

## Self-Check: PASSED

All created files verified:
- backend/sql/setup_app_role.sql
- backend/alembic/versions/0800fa8394d7_enable_rls_on_all_tenant_tables.py

All commits verified:
- 8b363b4 (Task 1)
- c50ad2e (Task 2)
- 6b79274 (Task 3)

---
*Phase: 06-security-configuration*
*Completed: 2026-02-07*
