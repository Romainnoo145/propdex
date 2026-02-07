# Phase 6: Security & Configuration - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the database connection to enforce row-level security with app_role (not superuser), consolidate configuration into a single .env file in backend/, and make the freshness threshold configurable per organization. No new features — this is infrastructure hardening of existing v1.0 functionality.

</domain>

<decisions>
## Implementation Decisions

### RLS Enforcement
- Claude's discretion on connection approach (dedicated DB user vs SET ROLE per request)
- Claude's discretion on migration user separation (separate superuser for Alembic vs elevated privileges)
- Claude's discretion on org_id passing mechanism (session variable vs other approach)
- Claude's discretion on admin bypass strategy (no bypass vs CLI-only bypass)
- All decisions should prioritize security-first design suitable for multi-tenant SaaS

### Config Consolidation
- Claude's discretion on root .env handling (delete vs Docker-only split)
- Claude's discretion on environment-specific config approach (single .env + APP_ENV vs separate files)
- Claude's discretion on startup validation strictness
- Claude's discretion on secret logging (masked vs none)
- Must result in a single source of truth for application config in backend/

### Freshness Threshold
- Must be configurable per organization (replacing hardcoded 24h)
- Claude's discretion on granularity (single global per org vs per-data-source)
- Claude's discretion on storage location (organization table column vs env + override)
- Claude's discretion on stale data behavior (serve stale + background refresh vs block)
- **Enforce a minimum freshness threshold** to prevent orgs from hammering external APIs (BAG, PDOK, DSO, RCE)

### Access Denial Behavior
- Claude's discretion on HTTP response for cross-org access (404 vs 403)
- Claude's discretion on security audit logging approach
- Claude's discretion on alerting (logging only vs basic WARN alerts)
- Claude's discretion on fail-closed vs fail-open when org_id session variable is unset
- All decisions should follow OWASP guidance and security-first principles

### Claude's Discretion
Almost all implementation details are at Claude's discretion for this phase. The user trusts the builder to make security-appropriate choices. Key constraints:
- Security-first: when in doubt, choose the more secure option
- Multi-tenant isolation must be provably enforced
- Minimum freshness threshold must be enforced (the one explicit user decision)
- Config must end up in a single location (backend/.env)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly deferred all technical decisions to Claude's judgment with the guidance to prioritize security.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-security-configuration*
*Context gathered: 2026-02-07*
