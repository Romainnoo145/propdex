-- Row Level Security (RLS) Policies for Multi-Tenant Isolation
-- =================================================================
--
-- IMPORTANT: This is a defense-in-depth security measure.
--
-- PRIMARY DEFENSE: Application-level filtering by organization_id in all queries
-- SECONDARY DEFENSE: RLS policies (this file) catch bugs and provide an extra layer
--
-- CURRENT STATUS (MVP):
-- - Application connects as superuser (bypasses RLS)
-- - RLS policies are defined but not enforced yet
-- - This prepares us for production hardening where we'll switch to app_role
--
-- PRODUCTION HARDENING (Post-MVP):
-- - Create dedicated app_role with limited privileges
-- - Application connects as app_role (RLS enforced)
-- - Set app.current_tenant_id session variable per request
-- - RLS policies automatically filter all queries
--
-- =================================================================

-- Enable RLS on multi-tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- NOTE: organizations table does NOT have RLS - it's the root tenant entity


-- Create tenant isolation policies for users table
-- =================================================================

DROP POLICY IF EXISTS tenant_isolation_users ON users;

CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        -- Allow access only to rows matching current tenant
        -- In production, app.current_tenant_id will be set per request
        organization_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid,
            organization_id  -- Fallback for superuser/migrations (allows all)
        )
    )
    WITH CHECK (
        -- Same check for INSERT/UPDATE operations
        organization_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid,
            organization_id
        )
    );


-- Create tenant isolation policies for refresh_tokens table
-- =================================================================

DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;

CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
    FOR ALL
    USING (
        organization_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid,
            organization_id
        )
    )
    WITH CHECK (
        organization_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid,
            organization_id
        )
    );


-- Create app_role for future production use
-- =================================================================
-- This role will be used when we want RLS enforcement

DO $$ BEGIN
    CREATE ROLE app_role;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Role app_role already exists, skipping creation';
END $$;

-- Grant necessary permissions to app_role
GRANT CONNECT ON DATABASE crmplus TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- Ensure future tables are also granted
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_role;


-- Verify RLS is enabled
-- =================================================================

SELECT
    tablename,
    rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'refresh_tokens', 'organizations')
ORDER BY tablename;
