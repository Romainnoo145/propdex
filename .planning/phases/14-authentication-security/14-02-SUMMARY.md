---
phase: 14-authentication-security
plan: 02
subsystem: frontend-routing
tags: [tanstack-router, react-router, file-based-routing, react-hook-form, zod, tanstack-query]

# Dependency graph
requires:
  - phase: 13-map-foundation-layout
    provides: React 19 + Vite + Tailwind frontend with map components
provides:
  - TanStack Router with file-based routing
  - Auth dependencies installed (react-hook-form, zod, @tanstack/react-query)
  - Route tree skeleton (__root, /auth, /_authenticated layout, /map)
  - Auth type definitions (User, AuthContextValue, RouterContext)
  - Protected route guard checking context.auth.isAuthenticated
affects: [frontend-auth, protected-routes, auth-forms]

# Tech tracking
tech-stack:
  added: [@tanstack/react-router, @tanstack/react-query, @tanstack/router-plugin, react-hook-form, zod, @hookform/resolvers, @tanstack/react-query-devtools, @tanstack/router-devtools]
  patterns: [file-based routing, router context for auth state, beforeLoad guards, route layouts]

key-files:
  created: [frontend/src/routes/__root.tsx, frontend/src/routes/_authenticated.tsx, frontend/src/routes/_authenticated/map.tsx, frontend/src/routes/auth/index.tsx, frontend/src/routes/auth/google-callback.tsx, frontend/src/lib/auth/types.ts, frontend/src/routeTree.gen.ts]
  modified: [frontend/package.json, frontend/vite.config.ts, frontend/src/main.tsx]

key-decisions:
  - "TanStack Router file-based routing for type-safe routing"
  - "RouterContext pattern for injecting auth state into router"
  - "_authenticated layout route for DRY protected route logic"
  - "beforeLoad guards for redirecting unauthenticated users"
  - "cookieDomainRewrite: 'localhost' in Vite proxy for cookie forwarding"

patterns-established:
  - "File-based routing: routes/ directory structure mirrors URL paths"
  - "Layout routes: _authenticated.tsx wraps all protected pages"
  - "Auth context injection: main.tsx creates router with auth context"
  - "Route guards: beforeLoad checks context.auth.isAuthenticated"
  - "Auto-generated route tree: TanStackRouterVite() plugin generates routeTree.gen.ts"

# Metrics
duration: 3min
completed: 2026-02-08
---

# Phase 14 Plan 02: TanStack Router Setup & Route Skeleton Summary

**TanStack Router with file-based routing, auth layout guards, and route stubs for login and protected map page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-08T12:11:00Z
- **Completed:** 2026-02-08T12:14:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- TanStack Router installed and configured with Vite plugin
- File-based routing established with route tree auto-generation
- Protected layout route (_authenticated) with beforeLoad guard redirects to /auth
- Auth page stub at /auth with redirect search param handling
- Map page moved to /_authenticated/map route
- Auth type definitions (User, AuthContextValue, RouterContext)
- React Hook Form, Zod, TanStack Query dependencies installed for future auth forms

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and configure TanStack Router** - `53cc386` (chore)
2. **Task 2: Create route tree and auth types** - _(work completed in prior plan 14-01 docs commit)_

_Note: Task 2 route creation was inadvertently included in plan 14-01's docs commit (b724cde). All required files exist and satisfy must_haves. Task 1 commit standalone documents dependency installation._

## Files Created/Modified
- `frontend/package.json` - Added TanStack Router, Query, React Hook Form, Zod dependencies
- `frontend/pnpm-lock.yaml` - Lockfile updated with new dependencies
- `frontend/vite.config.ts` - Added TanStackRouterVite() plugin, cookieDomainRewrite for cookies
- `frontend/src/lib/auth/types.ts` - User, AuthContextValue, RegisterData, RouterContext interfaces
- `frontend/src/routes/__root.tsx` - Root route with RouterContext generic
- `frontend/src/routes/_authenticated.tsx` - Protected layout with beforeLoad auth check
- `frontend/src/routes/_authenticated/map.tsx` - Map page (moved from App.tsx)
- `frontend/src/routes/auth/index.tsx` - Auth page stub with redirect validation
- `frontend/src/routes/auth/google-callback.tsx` - OAuth callback stub
- `frontend/src/main.tsx` - TanStack Router integration with initial auth context
- `frontend/src/routeTree.gen.ts` - Auto-generated route tree from Vite plugin

## Decisions Made
- **TanStack Router over React Router:** Type-safe routing with automatic route tree generation from file structure
- **RouterContext pattern:** Inject auth state into router context so beforeLoad guards can check authentication
- **_authenticated layout route:** DRY pattern - all routes under /_authenticated/ inherit authentication check
- **cookieDomainRewrite in Vite proxy:** Ensures httpOnly cookies work correctly in development (localhost:9300 → localhost:8000)
- **Initial context isAuthenticated: false:** Plan 03 will wrap with AuthProvider that updates context after silent refresh

## Deviations from Plan

### Overlap with Prior Plan

**Task 2 route creation completed in plan 14-01 docs commit**
- **Situation:** Plan 14-01's final docs commit (b724cde) inadvertently included frontend route files
- **Files affected:** All Task 2 route files (routes/, lib/auth/types.ts, main.tsx changes)
- **Resolution:** Verified all must_haves satisfied, files match plan specifications exactly
- **Impact:** No rework needed - work already done correctly
- **Committed in:** b724cde (14-01 docs commit)

---

**Total deviations:** 1 overlap (prior plan completed Task 2 work)
**Impact on plan:** No impact - all requirements satisfied, files verified

## Issues Encountered
- `pnpm exec tsr generate` not found (TanStack Router CLI not available as standalone command) - Resolved by starting dev server briefly to trigger Vite plugin route tree generation

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Frontend routing foundation complete. Ready for:
- Plan 03: AuthProvider implementation with silent token refresh
- Plan 04: Login/register forms using React Hook Form + Zod
- Plan 05: Google OAuth callback implementation

All route stubs render without errors. Protected route redirects to /auth (expected until AuthProvider added).

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 14-authentication-security*
*Completed: 2026-02-08*
