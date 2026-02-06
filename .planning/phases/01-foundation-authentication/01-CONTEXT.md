# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely access the platform with multi-tenant data isolation. Covers registration, login, session management, and organization-scoped data access. Does NOT include user profile management, team invitations, or role-based permissions beyond basic auth.

</domain>

<decisions>
## Implementation Decisions

### Auth flow & providers
- Email/password + Google OAuth at launch
- Email verification required, but with grace period (can use app immediately, must verify within 24-48h)
- Standard "forgot password" flow via email reset link → set new password
- No magic links or other social providers for now

### Claude's Discretion
- Auth implementation approach — choose what fits the FastAPI + PostgreSQL stack best (built-in JWT vs external service like Supabase Auth)
- Session duration and "remember me" behavior
- Multi-device session policy
- Login/register UI layout and styling
- Error message tone and format
- Registration fields (beyond email/password)
- Organization creation flow during signup
- Loading and error states for auth screens

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Stack is FastAPI + PostgreSQL + PostGIS as established in research.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-02-07*
