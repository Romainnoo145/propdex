-- Setup app_role for RLS-enforced application access
-- =====================================================
--
-- Run this as superuser (postgres) ONCE during initial deployment
--
-- Purpose: Create a non-superuser role for the application to use,
--          ensuring Row-Level Security policies are enforced.
--
-- Security model:
-- - Migrations: Use MIGRATION_DATABASE_URL (superuser) for DDL
-- - Runtime: Use DATABASE_URL with app_role (RLS enforced)
--
-- =====================================================

-- Create app_role with LOGIN (required for direct connection)
-- NOT SUPERUSER ensures RLS policies are enforced
DO $$ BEGIN
    CREATE ROLE app_role WITH LOGIN PASSWORD 'CHANGE_ME_app_role_password';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Role app_role already exists, skipping creation';
END $$;

-- Grant connection and schema usage
GRANT CONNECT ON DATABASE propdex TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;

-- Grant DML on all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- Grant DML on future tables (created by Alembic migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_role;

-- Verify role exists and permissions
SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = 'app_role';
