# Phase 6: Security & Configuration - Research

**Researched:** 2026-02-07
**Domain:** PostgreSQL Row-Level Security, Multi-Tenant Isolation, Configuration Management
**Confidence:** HIGH

## Summary

This research investigates three interconnected security and infrastructure hardening tasks for a FastAPI/PostgreSQL multi-tenant SaaS: enforcing row-level security (RLS) at the database layer, consolidating configuration management into a single source of truth, and making data freshness thresholds configurable per organization with minimum limits to prevent API abuse.

The standard approach involves: (1) Creating a dedicated PostgreSQL app_role with RLS enforcement, using session variables (SET LOCAL) to pass tenant context per-request; (2) Retaining pydantic-settings with a single backend/.env file, leveraging startup validation and fail-fast patterns; (3) Storing per-organization freshness thresholds in the organizations table with a minimum enforced threshold.

All three requirements are tightly coupled—RLS enforcement changes the database session lifecycle (affecting config), while freshness configuration affects query patterns (subject to RLS). Security-first principles dominate: fail-closed authorization, 404 responses for cross-tenant access (preventing resource enumeration), and comprehensive audit logging of access denial events.

**Primary recommendation:** Use SQLAlchemy event hooks to execute SET LOCAL commands per-request with asyncpg, maintain Alembic migrations with superuser credentials separately from app credentials, store freshness thresholds in the organizations table with a 1-hour minimum to prevent external API abuse, and implement structured audit logging for all cross-tenant access attempts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**One Explicit Requirement:**
- **Enforce a minimum freshness threshold** to prevent organizations from hammering external APIs (BAG, PDOK, DSO, RCE)

**Final Outcome Required:**
- Config must end up in a single location (backend/.env)
- Multi-tenant isolation must be provably enforced
- Security-first: when in doubt, choose the more secure option

### Claude's Discretion

Almost all implementation details are at Claude's discretion for this phase. The user trusts the builder to make security-appropriate choices:

**RLS Enforcement:**
- Connection approach (dedicated DB user vs SET ROLE per request)
- Migration user separation (separate superuser for Alembic vs elevated privileges)
- org_id passing mechanism (session variable vs other approach)
- Admin bypass strategy (no bypass vs CLI-only bypass)
- All decisions should prioritize security-first design suitable for multi-tenant SaaS

**Config Consolidation:**
- Root .env handling (delete vs Docker-only split)
- Environment-specific config approach (single .env + APP_ENV vs separate files)
- Startup validation strictness
- Secret logging (masked vs none)
- Must result in a single source of truth for application config in backend/

**Freshness Threshold:**
- Granularity (single global per org vs per-data-source)
- Storage location (organization table column vs env + override)
- Stale data behavior (serve stale + background refresh vs block)
- **Enforce a minimum freshness threshold** (the one explicit user decision)

**Access Denial Behavior:**
- HTTP response for cross-org access (404 vs 403)
- Security audit logging approach
- Alerting (logging only vs basic WARN alerts)
- Fail-closed vs fail-open when org_id session variable is unset
- All decisions should follow OWASP guidance and security-first principles

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

## Standard Stack

### Core Libraries (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x | Async ORM with event system | Industry standard for Python DB access, native async support, rich event hooks for RLS |
| asyncpg | Latest | PostgreSQL async driver | Fastest Python PostgreSQL driver, native asyncio, used by SQLAlchemy async |
| pydantic-settings | 2.x | Environment config management | Type-safe config with validation, native .env support, FastAPI standard |
| FastAPI | Latest | Web framework | Already in use, middleware system supports tenant context injection |

### Supporting Tools

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | Latest | Structured logging | Optional upgrade from stdlib logging for audit events |
| python-json-logger | Latest | JSON log formatting | Alternative to structlog if lighter weight needed |

### No Additional Dependencies Required

The existing stack (SQLAlchemy 2.x + asyncpg + pydantic-settings + FastAPI) provides all necessary primitives for RLS enforcement, session variable management, and configuration validation. No new dependencies are recommended.

**Installation:** (Nothing new required)
```bash
# All dependencies already present in existing requirements.txt
```

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py           # Settings class (update: add freshness config)
│   │   ├── database.py         # Add: SET LOCAL in get_db() dependency
│   │   └── security.py         # Add: Audit logging utilities
│   ├── middleware/
│   │   └── tenant.py           # Existing: extracts org_id from JWT
│   ├── models/
│   │   ├── organization.py     # Add: freshness_threshold_hours column
│   │   └── ...                 # All models use TenantMixin already
│   └── ...
├── alembic/
│   ├── env.py                  # Keep using DATABASE_URL (superuser for migrations)
│   └── versions/
│       └── [new]_add_rls_update_config.py
├── sql/
│   └── rls_policies.sql        # Already exists, will be updated
└── .env                        # Single source of truth for config
```

### Pattern 1: RLS Enforcement via SET LOCAL Session Variables

**What:** Execute `SET LOCAL app.current_tenant_id = '<uuid>'` at the start of each database session/transaction, before any queries run. PostgreSQL RLS policies reference this session variable to filter rows automatically.

**When to use:** For all authenticated requests that have an organization_id in the JWT. Public endpoints (health check, etc.) skip this.

**Implementation approach:**

```python
# app/core/database.py

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

engine = create_async_engine(settings.DATABASE_URL)

# Option A: Engine-level event (runs on every connection checkout)
@event.listens_for(engine.sync_engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Connection-level setup - RLS role switching happens here."""
    # Note: This runs once per physical connection from the pool
    # SET LOCAL must be done per-transaction, not per-connection
    pass

# Option B: Session-level event (preferred for per-request context)
async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides DB session with RLS context.

    Extracts organization_id from request.state (set by TenantContextMiddleware)
    and executes SET LOCAL before yielding the session.
    """
    async with async_session_factory() as session:
        org_id = getattr(request.state, "organization_id", None)

        if org_id:
            # Set session variable for RLS policies
            await session.execute(
                text("SET LOCAL app.current_tenant_id = :org_id"),
                {"org_id": str(org_id)}
            )

        try:
            yield session
        finally:
            await session.close()
```

**Critical considerations:**

1. **Connection pooling compatibility:** SET LOCAL is transaction-scoped, safe with pgbouncer in transaction pooling mode. SET (without LOCAL) would persist across pooled connections and leak tenant context.

2. **Fail-closed behavior:** If org_id is None on a protected endpoint, the RLS policy should deny all access (not fall back to showing all data). The policy uses `COALESCE(NULLIF(current_setting('app.current_tenant_id', TRUE), ''), NULL)` which returns NULL when unset, causing the policy to evaluate false.

3. **Superuser bypass:** The application must connect as a non-superuser role (app_role) for RLS to enforce. Alembic migrations continue using superuser credentials.

### Pattern 2: Separate Migration and Application Database Users

**What:** Use two PostgreSQL roles—one superuser for Alembic migrations (CREATE TABLE, ALTER TABLE, RLS management), one restricted app_role for application queries (SELECT, INSERT, UPDATE, DELETE with RLS enforced).

**When to use:** Always, in multi-tenant SaaS with RLS enforcement.

**Implementation:**

```sql
-- Create dedicated application role (not superuser, RLS enforced)
CREATE ROLE app_role WITH LOGIN PASSWORD 'app_secret';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE crmplus TO app_role;
GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- Ensure future tables are also granted
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_role;
```

**Configuration split:**

```bash
# backend/.env (application runtime)
DATABASE_URL=postgresql+asyncpg://app_role:app_secret@localhost:5433/crmplus

# backend/.env.migrations (Alembic only, not in version control)
MIGRATION_DATABASE_URL=postgresql+asyncpg://superuser:password@localhost:5433/crmplus
```

**Alembic env.py adjustment:**

```python
# alembic/env.py
from app.core.config import settings
import os

# Use migration URL if present (for schema changes), else fall back to app URL
migration_url = os.getenv("MIGRATION_DATABASE_URL", settings.DATABASE_URL)
config.set_main_option("sqlalchemy.url", migration_url)
```

### Pattern 3: Per-Organization Freshness Threshold with Minimum Enforcement

**What:** Store a `freshness_threshold_hours` column on the organizations table, allowing each tenant to configure how long cached data remains fresh. Enforce a system-wide minimum (e.g., 1 hour) to prevent API abuse of external government services.

**When to use:** When checking if cached property data needs refresh.

**Schema addition:**

```python
# app/models/organization.py
class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Freshness threshold in hours (default 24, minimum enforced in application)
    freshness_threshold_hours: Mapped[int] = mapped_column(
        nullable=False,
        server_default=text("24"),
        comment="Hours before cached data is considered stale (minimum 1 hour enforced)"
    )
```

**Minimum enforcement in code:**

```python
# app/core/config.py
class Settings(BaseSettings):
    # Minimum freshness threshold to prevent API abuse
    MIN_FRESHNESS_THRESHOLD_HOURS: int = Field(
        default=1,
        description="Minimum freshness threshold (hours) to prevent hammering external APIs"
    )

# app/reports/freshness.py
async def check_report_freshness(
    report: SavedReport,
    organization: Organization,  # Fetch from DB
    session: AsyncSession,
) -> dict:
    # Get org-specific threshold, enforce minimum
    threshold_hours = max(
        organization.freshness_threshold_hours,
        settings.MIN_FRESHNESS_THRESHOLD_HOURS
    )

    if age_hours > threshold_hours:
        # Flag as stale
        updated_sections.append({...})
```

### Pattern 4: 404 vs 403 for Cross-Tenant Access

**What:** When a user attempts to access a resource belonging to another organization, return HTTP 404 (Not Found) instead of 403 (Forbidden) to prevent resource enumeration attacks.

**Why:** Returning 403 confirms the resource exists, enabling attackers to map out resources across tenants. Returning 404 treats cross-tenant resources as non-existent from the requester's perspective.

**When to use:** For all tenant-scoped resources where existence is not public knowledge (reports, projects, cached data).

**Implementation:**

```python
# app/reports/router.py
@router.get("/reports/{report_id}")
async def get_report(
    report_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SavedReport).where(
        SavedReport.id == report_id,
        SavedReport.organization_id == organization_id  # RLS also enforces this
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        # Could be: (1) doesn't exist, or (2) belongs to another org
        # Return 404 for both cases (don't leak existence)
        raise HTTPException(status_code=404, detail="Report not found")

    return report
```

**Audit logging for security monitoring:**

```python
# app/core/security.py
import logging
import structlog

audit_logger = structlog.get_logger("audit")

async def log_access_denial(
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    resource_type: str,
    resource_id: uuid.UUID,
    reason: str,
):
    """Log security-relevant access denial events."""
    audit_logger.warning(
        "access_denied",
        user_id=str(user_id),
        organization_id=str(organization_id),
        resource_type=resource_type,
        resource_id=str(resource_id),
        reason=reason,
        timestamp=datetime.utcnow().isoformat(),
    )
```

### Pattern 5: Single .env File with Startup Validation

**What:** Use a single backend/.env file as the source of truth, loaded via pydantic-settings with strict validation. Fail fast on startup if required variables are missing.

**Why:** Multiple .env files (root and backend) create confusion about which is authoritative. Pydantic-settings naturally looks for .env in the working directory, which is backend/ when running the app.

**Implementation:**

```python
# app/core/config.py
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",  # Looks for backend/.env
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = Field(..., description="App database connection (app_role)")

    # Security - require strong SECRET_KEY in production
    SECRET_KEY: str = Field(..., min_length=32)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key_production(cls, v: str) -> str:
        """Prevent default secret key in production."""
        if v == "CHANGE_ME_IN_PRODUCTION":
            raise ValueError("SECRET_KEY must be changed from default value")
        return v

    # Minimum freshness threshold (enforced system-wide)
    MIN_FRESHNESS_THRESHOLD_HOURS: int = Field(default=1, ge=1)

# Singleton with fail-fast on import
settings = Settings()  # Raises ValidationError if config invalid
```

**Root .env decision:** Delete root/.env entirely. If Docker Compose needs environment variables, use docker-compose.yml `env_file: backend/.env` directive or define variables directly in the compose file.

### Anti-Patterns to Avoid

- **Using SET (without LOCAL):** Session-scoped variables persist across connection pool reuse, leaking tenant context to other requests
- **Connecting as superuser in application code:** Bypasses RLS entirely, defeating the purpose of policies
- **Multiple .env files with overlapping keys:** Creates ambiguity about which value is active
- **Returning 403 for cross-tenant access:** Leaks resource existence, enables enumeration attacks
- **Fail-open on missing org_id:** If session variable is unset, RLS policy should deny (not allow all)
- **Hardcoding freshness thresholds:** Prevents per-tenant customization and makes testing difficult

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON logging | Custom log formatter | python-json-logger or structlog | Handles nested dicts, exceptions, timestamps correctly; battle-tested |
| Config validation | Manual env var checking | pydantic-settings with Field validators | Type coercion, required/optional, nested models, clear error messages |
| Audit event schema | Custom logging format | Structured logging library with consistent fields | Industry-standard fields (timestamp, severity, actor, resource, action) |
| Session variable injection | Manual SQL string building | SQLAlchemy event hooks + parameterized queries | Prevents SQL injection, handles escaping, works with connection pooling |
| Minimum threshold enforcement | Client-side validation only | Database constraint + application validation | Defense in depth, prevents direct DB manipulation |

**Key insight:** Security infrastructure is unforgiving of bugs. Use well-tested libraries (SQLAlchemy events, pydantic validation, structured logging) rather than custom solutions that may have edge cases or vulnerabilities.

## Common Pitfalls

### Pitfall 1: SET LOCAL in Wrong Scope

**What goes wrong:** Executing SET LOCAL at connection checkout time instead of per-transaction means the variable may not be set when the query runs (asyncpg connection pooling).

**Why it happens:** Confusion between connection-level and transaction-level scope. SET LOCAL is transaction-scoped—it must be executed after BEGIN and before the query.

**How to avoid:** Execute SET LOCAL inside the get_db() dependency, after the session is created but before yielding it to the route handler. SQLAlchemy's async session automatically manages transactions.

**Warning signs:**
- Queries return wrong tenant's data despite middleware setting request.state.organization_id
- RLS policies fail to filter rows even though role is correct
- Intermittent cross-tenant data leakage (works sometimes, fails others)

### Pitfall 2: Migration vs Application User Confusion

**What goes wrong:** Using the same database credentials for Alembic migrations and application queries. If using superuser for both, RLS is bypassed. If using app_role for migrations, schema changes fail (insufficient privileges).

**Why it happens:** Convenience—one DATABASE_URL for everything. But migrations need elevated privileges (CREATE TABLE, ALTER TABLE), while application should be restricted (RLS-enforced queries).

**How to avoid:**
- Use separate DATABASE_URL (app_role) and MIGRATION_DATABASE_URL (superuser)
- Alembic env.py checks for MIGRATION_DATABASE_URL first, falls back to DATABASE_URL for local dev
- Document clearly in .env.example which URL is for what purpose

**Warning signs:**
- Alembic migrations fail with "permission denied" errors
- Application bypasses RLS (sees all orgs' data)
- Unable to CREATE TABLE or ALTER TABLE from application code (expected)

### Pitfall 3: Overly Permissive RLS Policies

**What goes wrong:** Writing RLS policies that fall back to allowing all data when session variable is unset, e.g., `organization_id = COALESCE(current_setting(...), organization_id)` which always evaluates true if session variable is NULL.

**Why it happens:** Desire to keep migrations and superuser access working. But fail-open logic defeats multi-tenant isolation.

**How to avoid:**
- RLS policies should fail-closed: if session variable is unset, policy evaluates false (denies access)
- Superusers and BYPASSRLS roles automatically bypass RLS regardless of policy logic
- Migrations run as superuser, so they bypass RLS—policy doesn't need fallback logic

**Warning signs:**
- Public endpoints (no JWT) can query and see all organizations' data
- Missing Authorization header returns data instead of 401
- Integration tests pass despite not setting session variable

### Pitfall 4: Connection Pooling Mode Mismatch

**What goes wrong:** Using pgbouncer in statement pooling mode with SET LOCAL commands. Statement pooling doesn't preserve transaction boundaries, causing SET LOCAL to execute outside the transaction where queries run.

**Why it happens:** Statement pooling offers highest connection efficiency, but breaks transaction-scoped state like SET LOCAL.

**How to avoid:**
- Use session pooling mode (one connection per client session) or transaction pooling mode (safe with SET LOCAL)
- If using pgbouncer, configure `pool_mode = transaction` minimum
- Document pooling requirements in deployment guide

**Warning signs:**
- SET LOCAL works in local dev (no pgbouncer) but fails in staging/production
- Session variables appear to be ignored or leak across requests
- Cross-tenant data leakage in production only, not locally

### Pitfall 5: Testing Without Non-Superuser Connection

**What goes wrong:** All tests use superuser connection (because it's simpler to set up), so RLS policies are never actually tested. Policies may be broken or overly permissive, but tests pass.

**Why it happens:** Test fixtures inherit from development database setup, which uses superuser for convenience.

**How to avoid:**
- Create app_role in test database setup
- Integration tests should connect as app_role and verify cross-tenant isolation
- Write specific test cases that attempt cross-tenant access and verify denial

**Warning signs:**
- No test failures when RLS policies are commented out
- Tests pass locally but integration environment shows cross-tenant data leakage
- Security audit reveals RLS is defined but not enforced

## Code Examples

Verified patterns from official sources and existing codebase:

### Setting Session Variable in get_db() Dependency

```python
# app/core/database.py
from collections.abc import AsyncGenerator
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    echo=False,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides database session with RLS context.

    Extracts organization_id from request.state (set by TenantContextMiddleware)
    and sets PostgreSQL session variable for RLS policies.
    """
    async with async_session_factory() as session:
        # Get organization_id from middleware (if authenticated request)
        org_id = getattr(request.state, "organization_id", None)

        if org_id:
            # Set session variable for RLS policies (transaction-scoped)
            await session.execute(
                text("SET LOCAL app.current_tenant_id = :org_id"),
                {"org_id": str(org_id)}
            )

        try:
            yield session
        finally:
            await session.close()
```

**Source:** SQLAlchemy asyncio documentation + existing codebase pattern in app/core/database.py

### RLS Policy with Fail-Closed Behavior

```sql
-- sql/rls_policies.sql (updated)

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_api_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies with fail-closed logic
DROP POLICY IF EXISTS tenant_isolation_users ON users;

CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        -- Only allow access if session variable matches organization_id
        -- If session variable is unset or empty, this evaluates to NULL = organization_id (false)
        -- This is fail-closed: no session variable = no access
        organization_id = (
            current_setting('app.current_tenant_id', TRUE)::uuid
        )
    )
    WITH CHECK (
        organization_id = (
            current_setting('app.current_tenant_id', TRUE)::uuid
        )
    );

-- Repeat for all tenant-scoped tables...
```

**Source:** Crunchy Data RLS blog post + existing sql/rls_policies.sql patterns

### Per-Organization Freshness Threshold with Minimum

```python
# app/reports/freshness.py (updated)
from app.core.config import settings
from app.models.organization import Organization

async def check_report_freshness(
    report: SavedReport,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> dict:
    # Fetch organization settings
    org_stmt = select(Organization).where(Organization.id == organization_id)
    result = await session.execute(org_stmt)
    organization = result.scalar_one()

    # Get organization's freshness threshold, enforce minimum
    threshold_hours = max(
        organization.freshness_threshold_hours,
        settings.MIN_FRESHNESS_THRESHOLD_HOURS
    )

    updated_sections = []

    for section_source in report.report_data.get("section_sources", []):
        # ... existing cache lookup logic ...

        age_hours = int((latest_dt - saved_dt).total_seconds() / 3600)

        # Use org-specific threshold (with minimum enforced)
        if age_hours > threshold_hours:
            updated_sections.append({
                "section": section_name,
                "saved_at": saved_cached_at,
                "latest_at": latest_dt.isoformat(),
                "age_hours": age_hours,
            })

    return {
        "report_id": report.id,
        "has_updates": len(updated_sections) > 0,
        "updated_sections": updated_sections,
    }
```

**Source:** Existing backend/app/reports/freshness.py + new organization column

### Audit Logging for Cross-Tenant Access Attempts

```python
# app/core/security.py (new file)
import logging
import uuid
from datetime import datetime

# Use structured logging (stdlib logging with JSON formatter)
audit_logger = logging.getLogger("audit")

async def log_access_denial(
    user_id: uuid.UUID | None,
    organization_id: uuid.UUID,
    resource_type: str,
    resource_id: uuid.UUID,
    reason: str,
) -> None:
    """
    Log security-relevant access denial events.

    These logs are critical for security monitoring and compliance audits.
    """
    audit_logger.warning(
        "access_denied",
        extra={
            "event_type": "access_denied",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": str(user_id) if user_id else None,
            "organization_id": str(organization_id),
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "reason": reason,
        }
    )

# Usage in route handler
@router.get("/reports/{report_id}")
async def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SavedReport).where(
        SavedReport.id == report_id,
        SavedReport.organization_id == organization_id
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()

    if not report:
        # Log potential cross-tenant access attempt
        await log_access_denial(
            user_id=current_user.id,
            organization_id=organization_id,
            resource_type="saved_report",
            resource_id=report_id,
            reason="report_not_found_or_wrong_org"
        )

        # Return 404 (not 403) to prevent resource enumeration
        raise HTTPException(status_code=404, detail="Report not found")

    return report
```

**Source:** OWASP Authorization guidance + Python logging best practices

## State of the Art (2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tenant filtering in application code | PostgreSQL RLS policies at database layer | 2020-2023 trend | Defense in depth, catches bugs, provable isolation |
| Single DATABASE_URL for all operations | Separate migration and application credentials | Ongoing best practice | Least privilege, RLS enforcement without breaking migrations |
| Multiple .env files per environment | Single .env + environment variables overlay | pydantic-settings v2 (2023) | Simpler configuration, less duplication |
| SET (session-scoped) for tenant context | SET LOCAL (transaction-scoped) | Always preferred with pooling | Connection pooling safe, no context leakage |
| 403 for unauthorized access | 404 to prevent enumeration | OWASP recommendation | Reduces information disclosure, prevents resource mapping |
| Global freshness threshold | Per-tenant configuration with minimums | SaaS standard | Customization per customer, prevents abuse via minimum |

**Deprecated/outdated:**
- python-jose library: PyJWT is now preferred (project already migrated)
- passlib + bcrypt: pwdlib + Argon2id is more secure (project already migrated)
- `async with db.begin()`: Direct `db.add()/db.commit()` is project pattern (per MEMORY.md)

## Open Questions

Things that couldn't be fully resolved:

1. **Connection pooling in production**
   - What we know: SET LOCAL requires transaction or session pooling mode (not statement pooling)
   - What's unclear: Production deployment uses pgbouncer or direct connections?
   - Recommendation: Document pooling requirements; if using pgbouncer, set `pool_mode = transaction`

2. **External API rate limiting**
   - What we know: User wants minimum freshness threshold to prevent API abuse; BAG, PDOK, DSO, RCE have their own rate limits
   - What's unclear: What are the actual rate limits for these APIs? What's a safe minimum threshold?
   - Recommendation: Start with 1 hour minimum (conservative); monitor external API response codes for rate limit errors; adjust if needed

3. **Admin/superuser access bypass**
   - What we know: Some operations (cross-org analytics, support debugging) may need to bypass RLS
   - What's unclear: User preference on bypass strategy (no bypass vs CLI-only)
   - Recommendation: No bypass in v1.1; if needed later, create separate superuser web endpoints with strict access control

4. **Structured logging adoption**
   - What we know: Audit events benefit from structured logging (JSON format)
   - What's unclear: Whether to add structlog dependency or use stdlib logging with JSON formatter
   - Recommendation: Use python-json-logger (lightweight) rather than structlog; stdlib logging is already configured

## Sources

### Primary (HIGH confidence)

- [PostgreSQL Row-Level Security Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) - Official RLS reference
- [SQLAlchemy Asyncio Extensions](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) - Event hooks with async
- [Pydantic Settings Documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) - Configuration management
- [FastAPI Settings Management](https://fastapi.tiangolo.com/advanced/settings/) - Official pattern for pydantic-settings
- [AWS Prescriptive Guidance: RLS Recommendations](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)
- [Crunchy Data: Row Level Security for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)

### Secondary (MEDIUM confidence)

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Fail-closed guidance
- [PostgreSQL RLS Implementation Guide (Permit.io)](https://www.permit.io/blog/postgres-rls-implementation-guide) - Best practices and pitfalls
- [403 vs 404 Security Considerations (Authress)](https://authress.io/knowledge-base/articles/choosing-the-right-http-error-code-401-403-404)
- [Multi-Tenant SaaS Breach Containment](https://www.pentesttesting.com/multi-tenant-saas-breach-containment/) - Audit logging patterns
- [Python Logging Best Practices 2026](https://betterstack.com/community/guides/logging/python/python-logging-best-practices/)
- [API Rate Limiting Guide 2026](https://www.levo.ai/resources/blogs/api-rate-limiting-guide-2026)

### Tertiary (LOW confidence)

- [PgBouncer Connection Pooling](https://www.pgbouncer.org/features.html) - Pooling mode compatibility
- [SQLAlchemy GitHub Discussion #7673](https://github.com/sqlalchemy/sqlalchemy/discussions/7673) - SET statement with asyncpg
- Various Medium articles and blog posts on RLS implementation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already in use, official documentation verified
- Architecture: **HIGH** - Patterns validated against official sources and existing codebase
- Pitfalls: **HIGH** - Common issues well-documented in PostgreSQL RLS literature

**Research date:** 2026-02-07
**Valid until:** 90 days (stack is stable; PostgreSQL RLS is mature)

**Key decision recommendations:**
1. **RLS enforcement:** Use SET LOCAL in get_db() dependency + app_role connection
2. **Migration separation:** MIGRATION_DATABASE_URL (superuser) separate from DATABASE_URL (app_role)
3. **Freshness storage:** Add freshness_threshold_hours column to organizations table
4. **Minimum threshold:** 1 hour (configurable via MIN_FRESHNESS_THRESHOLD_HOURS env var)
5. **Access denial:** Return 404 (not 403) for cross-tenant access attempts
6. **Audit logging:** Use python-json-logger for structured security events
7. **Config consolidation:** Delete root/.env, use backend/.env exclusively
8. **Fail-closed:** RLS policies deny when session variable unset
