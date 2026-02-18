---
phase: 35-settings-page
plan: 02
subsystem: ui
tags: [tanstack-query, react, hooks, auth-context, typescript]

# Dependency graph
requires:
  - phase: 35-01
    provides: backend API endpoints for user profile, password, and preferences

provides:
  - TanStack Query hooks for all settings operations (useUserPreferences, useUpdatePreferences, useUpdateProfile, useChangePassword)
  - TypeScript interfaces for settings API contracts (UserPreferences, UserProfileUpdate, PasswordChangeRequest, UserPreferencesUpdate)
  - AuthContext.updateUser callback for keeping local user state fresh after profile PATCH

affects:
  - 35-03 (settings UI sections consume these hooks directly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSettings hooks follow useProjects.ts pattern: useAuth + apiFetch + useMutation/useQuery"
    - "Optimistic cache update via queryClient.setQueryData in useUpdatePreferences onSuccess"
    - "Caller-driven AuthContext update: useUpdateProfile returns User, caller invokes updateUser"
    - "useCallback with empty deps for simple state setter callbacks in AuthContext"

key-files:
  created:
    - frontend/src/lib/types/settings.ts
    - frontend/src/hooks/useSettings.ts
  modified:
    - frontend/src/lib/auth/types.ts
    - frontend/src/lib/auth/AuthContext.tsx

key-decisions:
  - "useUpdateProfile does not auto-update AuthContext — caller pattern chosen to avoid circular dependency (hook -> AuthContext -> hook)"
  - "useUpdatePreferences uses setQueryData (not invalidateQueries) for optimistic UX — preferences PATCH returns final state, no refetch needed"
  - "updateUser is useCallback with [] deps — stable reference, never changes"

patterns-established:
  - "Settings hook pattern: import apiFetch from @/lib/api, USERS_BASE constant, useMutation with typed generics"
  - "AuthContext updateUser: direct setUser call, no API round-trip, caller owns when to invoke"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 35 Plan 02: Settings Hooks + AuthContext Summary

**TanStack Query hooks for profile/password/preferences PATCH mutations and useUserPreferences query, plus AuthContext.updateUser for stale-free local user state after profile edits**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-18T13:23:06Z
- **Completed:** 2026-02-18T13:25:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `settings.ts` types mirroring backend Pydantic schemas for profile, password, and preferences endpoints
- Created `useSettings.ts` with four TanStack Query hooks covering all settings data operations
- Added `updateUser(user: User)` to AuthContext, enabling settings page to keep SideRailNav user display current without re-fetching /api/auth/me

## Task Commits

Each task was committed atomically:

1. **Task 1: Create settings TypeScript types and TanStack Query hooks** - `1cd79f0` (feat)
2. **Task 2: Add updateUser callback to AuthContext** - `e76b21e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/lib/types/settings.ts` - UserProfileUpdate, PasswordChangeRequest, UserPreferences, UserPreferencesUpdate interfaces
- `frontend/src/hooks/useSettings.ts` - useUserPreferences, useUpdatePreferences, useUpdateProfile, useChangePassword hooks
- `frontend/src/lib/auth/types.ts` - Added `updateUser: (user: User) => void` to AuthContextValue
- `frontend/src/lib/auth/AuthContext.tsx` - Implemented updateUser useCallback and added to Provider value

## Decisions Made
- `useUpdateProfile` does not automatically call `updateUser` — the caller (AccountSection) decides when to update local state. This avoids a circular dependency where the hook would need to import from AuthContext.
- `useUpdatePreferences` uses `setQueryData` instead of `invalidateQueries` — the PATCH response already contains the final preferences state, making a round-trip GET unnecessary.
- `updateUser` uses `useCallback` with empty deps array — it's a simple `setUser` wrapper with a stable reference.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

- FOUND: `frontend/src/lib/types/settings.ts`
- FOUND: `frontend/src/hooks/useSettings.ts`
- FOUND: `frontend/src/lib/auth/types.ts`
- FOUND: `frontend/src/lib/auth/AuthContext.tsx`
- FOUND: commit `1cd79f0` (feat(35-02): create settings types and TanStack Query hooks)
- FOUND: commit `e76b21e` (feat(35-02): add updateUser callback to AuthContext)

## Next Phase Readiness
- Settings hooks are fully typed and verified with zero TypeScript errors
- `useUpdateProfile`, `useChangePassword`, `useUserPreferences`, `useUpdatePreferences` ready for Plan 03 consumption
- `AuthContext.updateUser` exposed and type-safe
- Plan 03 (AccountSection, PasswordSection, PreferencesSection UI components) can begin immediately

---
*Phase: 35-settings-page*
*Completed: 2026-02-18*
