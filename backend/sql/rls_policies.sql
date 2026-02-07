-- Row Level Security (RLS) Policies for Multi-Tenant Isolation
-- =================================================================
--
-- IMPORTANT: Defense-in-depth security measure for multi-tenant data isolation.
--
-- PRIMARY DEFENSE: Application-level filtering by organization_id in all queries
-- SECONDARY DEFENSE: RLS policies (this file) catch bugs and provide an extra layer
--
-- ENFORCEMENT STATUS: ACTIVE
-- - Application connects as app_role (non-superuser)
-- - RLS policies are ENFORCED on all tenant-scoped tables
-- - SET LOCAL app.current_tenant_id is set per request by get_db()
-- - Policies are FAIL-CLOSED: missing session variable denies all access
--
-- FAIL-CLOSED PATTERN:
-- - current_setting('app.current_tenant_id', TRUE) returns '' when unset
-- - NULLIF('', '') converts empty string to NULL
-- - NULL::uuid stays NULL
-- - NULL = organization_id is always FALSE in SQL (NULL never equals anything)
-- - Result: no rows are accessible when session variable is unset
--
-- =================================================================

-- Users table
-- =================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_users ON users;

CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- Refresh tokens table
-- =================================================================
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- Cached API responses table
-- =================================================================
ALTER TABLE cached_api_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_api_responses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cached_api_responses ON cached_api_responses;

CREATE POLICY tenant_isolation_cached_api_responses ON cached_api_responses
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- PDF documents table
-- =================================================================
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_pdf_documents ON pdf_documents;

CREATE POLICY tenant_isolation_pdf_documents ON pdf_documents
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- Parsing jobs table
-- =================================================================
ALTER TABLE parsing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_parsing_jobs ON parsing_jobs;

CREATE POLICY tenant_isolation_parsing_jobs ON parsing_jobs
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- Saved reports table
-- =================================================================
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_saved_reports ON saved_reports;

CREATE POLICY tenant_isolation_saved_reports ON saved_reports
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- Projects table
-- =================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_projects ON projects;

CREATE POLICY tenant_isolation_projects ON projects
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
    );


-- NOTE: organizations table does NOT have RLS - it's the root tenant entity


-- Verify RLS is enabled on all tenant tables
-- =================================================================

SELECT
    tablename,
    rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'users',
        'refresh_tokens',
        'cached_api_responses',
        'pdf_documents',
        'parsing_jobs',
        'saved_reports',
        'projects'
    )
ORDER BY tablename;
