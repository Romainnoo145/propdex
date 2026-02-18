---
phase: 35-settings-page
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, alembic, pydantic, users, preferences, jsonb]

# Dependency graph
requires:
  - phase: 27-35-auth
    provides: User model, auth dependencies (get_current_active_user), password utilities, email utilities, JWT utilities
provides:
  - Alembic migration b7a8c9d0e1f2 adding preferences JSONB column to users table
  - User model updated with preferences Mapped[dict] field
  - app/users module (schemas + router)
  - PATCH /api/users/me — profile update with email re-verification
  - PUT /api/users/me/password — password change (email-only, verifies current password)
  - GET /api/users/me/preferences — returns full preferences with defaults
  - PATCH /api/users/me/preferences — partial merge of preferences
affects:
  - 35-02 (settings UI — frontend calling these endpoints)
  - 35-03 (any advanced settings features)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PATCH endpoints use model_dump(exclude_unset=True) for partial update merging
    - JSONB preferences stored as dict in SQLAlchemy JSON column with server_default '{}'::jsonb
    - Email uniqueness check via func.lower() for case-insensitive comparison
    - Background email sending for email change re-verification

key-files:
  created:
    - backend/alembic/versions/b7a8c9d0e1f2_add_preferences_to_users.py
    - backend/app/users/__init__.py
    - backend/app/users/schemas.py
    - backend/app/users/router.py
  modified:
    - backend/app/models/user.py
    - backend/app/main.py

key-decisions:
  - "Re-export UserResponse and MessageResponse from app.auth.schemas in app.users.schemas to avoid duplication"
  - "OAuth users blocked from password change with Dutch error message (Gebruik je Google-account...)"
  - "Email change sets email_verified=False and email_verified_at=None, sends new verification email in background"
  - "PATCH /me/preferences uses model_dump(exclude_unset=True) for true partial merge — unset fields untouched"
  - "UserPreferences uses ConfigDict(extra='ignore') to handle unknown stored preference keys gracefully"

patterns-established:
  - "Pattern 1: users module re-exports auth schemas (MessageResponse, UserResponse) instead of duplicating"
  - "Pattern 2: JSONB preferences accessed as current_user.preferences or {} to handle null safety"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 35 Plan 01: Users API (Profile, Password, Preferences) Summary

**FastAPI users router with 4 endpoints backed by JSONB preferences column — profile update, password change, and preferences CRUD ready for settings UI.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-18T13:23:17Z
- **Completed:** 2026-02-18T13:25:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Alembic migration adds `preferences` JSONB column (server_default `'{}'::jsonb`) to users table — applied successfully
- Pydantic schemas for profile update, password change, and preferences (full + partial update)
- 4 REST endpoints registered under `/api/users` prefix covering all settings page data requirements
- Email change triggers re-verification flow (resets `email_verified`, sends new verification email in background)
- OAuth users blocked from password change with clear Dutch error message

## Task Commits

Each task was committed atomically:

1. **Task 1: Add preferences JSONB column and Pydantic schemas** - `d2aa8f3` (feat)
2. **Task 2: Create users router and register in main.py** - `b745813` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/alembic/versions/b7a8c9d0e1f2_add_preferences_to_users.py` - Migration: add preferences JSONB column to users
- `backend/app/models/user.py` - Added `preferences: Mapped[dict]` field with JSON column
- `backend/app/users/__init__.py` - New users module init (empty)
- `backend/app/users/schemas.py` - UserProfileUpdate, PasswordChange, UserPreferences, UserPreferencesUpdate; re-exports UserResponse/MessageResponse from auth
- `backend/app/users/router.py` - APIRouter with PATCH /me, PUT /me/password, GET /me/preferences, PATCH /me/preferences
- `backend/app/main.py` - Added `users_router` import and `app.include_router(users_router)` after monitoring_router

## Decisions Made

- Re-exported `UserResponse` and `MessageResponse` from `app.auth.schemas` in `app.users.schemas` — avoids duplication, single source of truth
- OAuth users blocked from password change endpoint with Dutch error: "Gebruik je Google-account om je wachtwoord te wijzigen"
- Email change resets `email_verified = False` and `email_verified_at = None`, enqueues background verification email
- `PATCH /me/preferences` uses `model_dump(exclude_unset=True)` so partial updates don't overwrite untouched preference keys
- `UserPreferences` uses `ConfigDict(extra="ignore")` to gracefully handle any unknown keys in stored JSONB

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Database container (`klarifai-discover-db`) was stopped; started via `docker start klarifai-discover-db` before running migration. Normal dev environment startup.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All backend endpoints for settings page are live: `/api/users/me` (PATCH), `/api/users/me/password` (PUT), `/api/users/me/preferences` (GET/PATCH)
- Plan 02 (settings UI frontend) can begin immediately — endpoints return proper response schemas
- No blockers

---
*Phase: 35-settings-page*
*Completed: 2026-02-18*
