# Phase 14: Authentication & Security - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Login/register flow for the frontend, connecting to the existing backend JWT auth system. JWT stored in memory + httpOnly refresh cookie for silent refresh. Protected routes with auth guards. CORS configuration. Backend cookie endpoint additions. Google OAuth integration.

This phase does NOT include: sidebar navigation, dashboard, user profile/settings, or team management.

</domain>

<decisions>
## Implementation Decisions

### Login/Register UI
- Centered card layout over subtle background (GitHub/Vercel style)
- Tabbed single page at `/auth` — Login and Register tabs on one card
- Google OAuth button + email/password form, separated by "or" divider — both shown from start
- Inline validation under fields — red text below each field on blur/submit
- Registration fields: email, password, full name, company name (4 fields)

### Auth Flow & Session Behavior
- Silent refresh — access token refreshes in background via httpOnly refresh cookie, user never notices
- No "Remember me" checkbox — refresh token always lasts a reasonable duration (e.g., 7 days)
- On refresh token expiry: silently redirect to `/auth` with no error toast — user just logs in again
- Post-login interim redirect: Claude's discretion (map view is the natural choice until dashboard ships)

### Protected Route Experience
- Unauthenticated users redirected to `/auth` with return URL preserved — after login, return to originally requested page
- Auth loading state: branded Propdex splash screen with subtle loading animation while checking auth status
- Already-authenticated users visiting `/auth` are redirected to main app immediately
- Temporary minimal logout button somewhere visible — proper placement comes with sidebar in later phase

### Registration Onboarding
- Immediate access after registration — no email verification required to use the app
- No onboarding/welcome screen — straight into the app (professional tool, users figure it out)
- Company name field on registration form creates the user's organization automatically

### Claude's Discretion
- Post-login redirect destination (map view until dashboard exists)
- Exact logout button placement (temporary)
- Branded splash screen design details
- Password strength requirements display
- Tab transition animation between Login/Register
- Error state handling for failed OAuth/API calls

</decisions>

<specifics>
## Specific Ideas

- User mentioned wanting a sidebar with tabs and dashboard as the eventual landing page — that ships in later phases (16/17), so Phase 14 needs an interim redirect target
- Professional tool feel — no hand-holding onboarding, users are real estate developers who know what they need

</specifics>

<deferred>
## Deferred Ideas

- Dashboard with quick actions and session states — Phase 16/17
- Sidebar navigation with tabs — Phase 16/17
- Account switching — not currently scoped
- Email verification enforcement — could add later if needed

</deferred>

---

*Phase: 14-authentication-security*
*Context gathered: 2026-02-08*
