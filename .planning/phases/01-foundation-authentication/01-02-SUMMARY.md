---
phase: 01-foundation-authentication
plan: 02
subsystem: authentication-api
tags: [jwt, auth-endpoints, password-hashing, token-rotation, multi-tenant-middleware, argon2id, pyjwt]
requires:
  - 01-01-backend-foundation
provides:
  - jwt-auth-endpoints
  - password-hashing-utilities
  - token-rotation-pattern
  - tenant-context-middleware
affects:
  - 01-03-email-verification
  - all-protected-api-endpoints
tech-stack:
  added:
    - PyJWT for JWT creation/validation (NOT python-jose)
    - pwdlib with Argon2id for password hashing (NOT passlib)
    - OAuth2PasswordBearer for FastAPI auth
  patterns:
    - JWT access/refresh token pair with rotation
    - Single-use refresh tokens with theft detection
    - TenantContextMiddleware extracts organization_id from JWT
    - Generic error messages prevent user enumeration
    - 48-hour grace period for email verification
key-files:
  created:
    - backend/app/auth/password.py
    - backend/app/auth/jwt.py
    - backend/app/auth/schemas.py
    - backend/app/auth/dependencies.py
    - backend/app/auth/router.py
    - backend/app/middleware/tenant.py
  modified:
    - backend/app/auth/__init__.py
    - backend/app/middleware/__init__.py
    - backend/app/main.py
key-decisions:
  pyjwt-not-jose:
    decision: Use PyJWT with explicit algorithms=["HS256"] for JWT handling
    rationale: Research showed python-jose has security issues and PyJWT is industry standard with better maintenance
    alternatives: python-jose (rejected due to algorithm confusion vulnerability)
  pwdlib-argon2id:
    decision: Use pwdlib with Argon2id hasher for password hashing
    rationale: Argon2id is memory-hard, resistant to GPU attacks, modern best practice (replaces bcrypt)
    alternatives: passlib with bcrypt (rejected as older, less secure)
  token-rotation:
    decision: Refresh tokens are single-use with automatic rotation
    rationale: Old token revoked on refresh; reuse detection triggers full account token revocation
    alternatives: Long-lived reusable refresh tokens (rejected due to theft risk)
  naive-datetimes:
    decision: Use naive datetimes (datetime.utcnow()) for database timestamps
    rationale: PostgreSQL columns are TIMESTAMP WITHOUT TIME ZONE; timezone-aware datetimes cause type errors
    alternatives: TIMESTAMP WITH TIME ZONE columns (would require migration)
  tenant-middleware:
    decision: Extract organization_id from JWT in middleware, store in request.state
    rationale: Silently populates tenant context for all requests without blocking public endpoints
    alternatives: Extract in each endpoint dependency (rejected as repetitive)
metrics:
  duration: 27 minutes
  completed: 2026-02-06
---

# Phase 01 Plan 02: Authentication Endpoints Summary

**One-liner:** JWT auth with refresh rotation using PyJWT, Argon2id password hashing via pwdlib, and tenant context middleware extracting organization_id from tokens.

---

## Performance

**Execution:** 2026-02-06T18:20:50Z → 2026-02-06T18:48:13Z (27 minutes)

**Efficiency:**
- 2 tasks executed sequentially
- Fixed transaction handling issue (async with db.begin() → direct commit)
- Fixed datetime timezone issue (timezone-aware → naive datetimes)
- All verifications passed after fixes

---

## Accomplishments

### What Was Built

1. **Password Hashing (pwdlib + Argon2id)**
   - hash_password() creates Argon2id hashes
   - verify_password() validates passwords
   - Handles None hashed_password gracefully (OAuth users)

2. **JWT Utilities (PyJWT)**
   - create_access_token() returns 15-minute access tokens
   - create_refresh_token() returns (token, jti) tuple for 7-day refresh tokens
   - decode_token() validates with explicit algorithms=["HS256"]
   - Tokens include sub (user_id), organization_id, type, exp

3. **Pydantic Schemas**
   - UserCreate: email, password, full_name, organization_name
   - UserResponse: id, email, full_name, organization_id, email_verified, auth_provider, created_at
   - TokenResponse: access_token, refresh_token, token_type
   - LoginRequest, RefreshRequest, MessageResponse

4. **Auth Dependencies**
   - oauth2_scheme with auto_error=False for custom error handling
   - get_current_user() validates access token, fetches user from DB
   - get_current_active_user() checks is_active flag
   - get_current_organization_id() extracts from request.state

5. **Tenant Context Middleware**
   - Runs on every request (public and protected)
   - Extracts Bearer token from Authorization header
   - Decodes JWT to get organization_id
   - Stores in request.state.organization_id (silently fails for invalid tokens)

6. **Auth Endpoints**
   - POST /auth/register: Creates organization + user, returns JWT pair
   - POST /auth/login: Validates credentials, enforces 48h email grace period
   - POST /auth/refresh: Rotates tokens, detects reuse (security feature)
   - POST /auth/logout: Revokes refresh token (idempotent)
   - GET /auth/me: Returns current user info

### Task Commits

| Task | Name | Commit | Files Created/Modified |
|------|------|--------|------------------------|
| 1 | Auth utilities, schemas, and tenant middleware | 2aa233c | password.py, jwt.py, schemas.py, dependencies.py, tenant.py, __init__.py (2 files) |
| 2 | Auth endpoints (register, login, refresh, logout, me) | d6f36e3 | router.py, main.py (updated with middleware and router) |

---

## Files Created/Modified

### Created (6 files)

**Auth Module:**
- `backend/app/auth/password.py` - Password hashing with pwdlib/Argon2id
- `backend/app/auth/jwt.py` - JWT creation and validation with PyJWT
- `backend/app/auth/schemas.py` - Pydantic schemas for auth API
- `backend/app/auth/dependencies.py` - FastAPI auth dependencies
- `backend/app/auth/router.py` - Auth endpoints router

**Middleware:**
- `backend/app/middleware/tenant.py` - Tenant context middleware

### Modified (3 files)

- `backend/app/auth/__init__.py` - Export auth utilities
- `backend/app/middleware/__init__.py` - Export TenantContextMiddleware
- `backend/app/main.py` - Include auth router and tenant middleware

---

## Decisions Made

### 1. PyJWT with Explicit Algorithms

**Decision:** Use PyJWT library with algorithms=["HS256"] explicitly specified in decode_token().

**Why:**
- Research identified algorithm confusion vulnerability in python-jose
- PyJWT is the industry standard with active maintenance
- Explicit algorithm specification prevents "none" algorithm attack

**Alternative considered:** python-jose as originally documented in some FastAPI tutorials. Rejected due to security concerns and less active maintenance.

### 2. pwdlib with Argon2id

**Decision:** Use pwdlib with Argon2Hasher for password hashing.

**Why:**
- Argon2id is memory-hard, resistant to GPU-based attacks
- Modern cryptographic best practice (2015 Password Hashing Competition winner)
- Replaces older bcrypt standard
- pwdlib provides clean API

**Alternative considered:** passlib with bcrypt. Rejected because Argon2id is demonstrably more secure against modern attack vectors.

### 3. Single-Use Refresh Token Rotation

**Decision:** Each refresh token can only be used once. On refresh, old token is revoked and new one issued. JTI stored in database for validation.

**Why:**
- If stolen refresh token is used while legitimate user has already refreshed, we detect theft
- Automatic revocation of ALL user tokens on detected reuse
- Industry best practice for refresh token security

**Alternative considered:** Long-lived reusable refresh tokens. Rejected because stolen token could be used indefinitely until expiration.

### 4. Naive Datetimes for Database

**Decision:** Use datetime.utcnow() (naive UTC datetime) instead of datetime.now(timezone.utc) (timezone-aware).

**Why:**
- PostgreSQL columns are TIMESTAMP WITHOUT TIME ZONE (from 01-01 migration)
- SQLAlchemy raises error when passing timezone-aware datetime to TIMESTAMP WITHOUT TIME ZONE
- Naive UTC datetimes are sufficient for backend-only timestamps

**Alternative considered:** Change database columns to TIMESTAMP WITH TIME ZONE. Rejected to avoid migration churn and because naive UTC is adequate.

### 5. Tenant Context Middleware

**Decision:** Middleware extracts organization_id from JWT on every request, stores in request.state.

**Why:**
- Single place to extract tenant context
- Silent failure allows public endpoints to work
- Available to all protected endpoints via get_current_organization_id()
- Prepares for RLS SET LOCAL app.current_tenant_id in get_db()

**Alternative considered:** Extract organization_id in each protected endpoint. Rejected as repetitive and error-prone.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Transaction Handling with AsyncSession**

- **Found during:** Task 2 - First registration test
- **Issue:** Used `async with db.begin()` on session from get_db() dependency, which already manages transactions. Caused "A transaction is already begun on this Session" error.
- **Fix:** Removed `async with db.begin()` blocks, used direct db.add(), db.flush(), db.commit() calls
- **Files modified:** `backend/app/auth/router.py` (all 5 endpoint functions)
- **Commit:** d6f36e3

**2. [Rule 1 - Bug] Timezone-Aware Datetime Type Mismatch**

- **Found during:** Task 2 - First registration test
- **Issue:** Used `datetime.now(timezone.utc)` which returns timezone-aware datetime, but PostgreSQL columns are TIMESTAMP WITHOUT TIME ZONE. SQLAlchemy raised DBAPIError on insert.
- **Fix:** Changed all occurrences to `datetime.utcnow()` (naive UTC datetime)
- **Files modified:** `backend/app/auth/router.py`, `backend/app/auth/jwt.py`
- **Commit:** d6f36e3

---

## Testing

### Verification Results

All plan verification criteria passed:

1. ✅ POST /auth/register creates user + organization, returns JWT pair
2. ✅ POST /auth/login validates credentials, returns JWT pair
3. ✅ POST /auth/refresh rotates refresh token (old invalidated, new issued)
4. ✅ POST /auth/logout revokes refresh token
5. ✅ GET /auth/me returns authenticated user info
6. ✅ Refresh token reuse triggers security revocation (401 on second use)
7. ✅ Tenant context middleware extracts organization_id from JWT
8. ✅ Generic error messages prevent user enumeration
9. ✅ Passwords hashed with Argon2id (verified by successful login after registration)

### Manual Testing Performed

**Full auth lifecycle test:**

```bash
# 1. Register new user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","organization_name":"Test Org"}'
# Returns: {"access_token": "...", "refresh_token": "...", "token_type": "bearer"}

# 2. Login with credentials
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
# Returns: JWT pair

# 3. Get current user
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
# Returns: {"id": "...", "email": "test@example.com", "organization_id": "...", ...}

# 4. Refresh token
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"REFRESH_TOKEN"}'
# Returns: New JWT pair

# 5. Reuse old refresh token (should fail)
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"OLD_REFRESH_TOKEN"}'
# Returns: {"detail": "Could not validate credentials"}

# 6. Logout
curl -X POST http://localhost:8000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"NEW_REFRESH_TOKEN"}'
# Returns: {"message": "Logged out successfully"}

# 7. Duplicate registration
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"other123","organization_name":"Dup"}'
# Returns: {"detail": "Email already registered"}

# 8. Wrong password
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
# Returns: {"detail": "Incorrect email or password"}

# 9. Unauthenticated /me
curl http://localhost:8000/auth/me
# Returns: {"detail": "Could not validate credentials"}
```

---

## Issues Encountered

### AsyncSession Transaction Management

**Issue:** Initial implementation used `async with db.begin()` pattern from SQLAlchemy examples, but FastAPI's get_db() dependency already provides a session with transaction management.

**Impact:** Registration endpoint failed with "A transaction is already begun on this Session" error.

**Resolution:** Removed nested transaction blocks, used session methods directly (add, flush, commit). This is the correct pattern for FastAPI dependency-injected sessions.

**Future consideration:** Document transaction patterns in project README or add code comments.

### TIMESTAMP WITHOUT TIME ZONE

**Issue:** Database columns created in 01-01 migration use TIMESTAMP WITHOUT TIME ZONE, but Python code used timezone-aware datetimes (datetime.now(timezone.utc)).

**Impact:** SQLAlchemy raised DBAPIError when trying to insert timezone-aware datetime into naive timestamp column.

**Resolution:** Changed all datetime creation to datetime.utcnow() for consistency with database schema.

**Future consideration:** Could standardize on TIMESTAMP WITH TIME ZONE in future migrations if timezone tracking becomes important (unlikely for internal timestamps).

---

## Next Phase Readiness

### Ready to Proceed

✅ **Phase 01 Plan 03 (Email Verification) can proceed:**
- User model has email_verified, email_verified_at fields
- Registration creates verification token placeholder (currently just logs URL)
- 48-hour grace period enforcement works in login endpoint
- Backend ready for email sending via fastapi-mail

✅ **Protected endpoints can be built:**
- Authentication dependencies available: get_current_user, get_current_active_user
- Tenant context available via get_current_organization_id
- Middleware extracts organization_id on every request

✅ **Token refresh pattern established:**
- Single-use rotation prevents token theft
- JTI tracking in database
- Security logging for reuse detection

### Blockers

None. All authentication infrastructure is functional.

### Concerns

None critical. Minor considerations:

1. **Email verification placeholder:** Currently just logs verification URL. Plan 01-03 will implement actual email sending.

2. **RLS context in get_db():** Tenant middleware sets request.state.organization_id but get_db() doesn't yet use it for SET LOCAL app.current_tenant_id. This is intentional for MVP (application-level filtering is primary defense).

3. **Rate limiting:** No rate limiting on auth endpoints yet. Consider adding in future for brute-force protection.

### Recommendations for Next Plan

1. **Email verification (01-03):**
   - Implement fastapi-mail integration
   - Generate verification tokens (JWT or UUID)
   - Create /auth/verify-email endpoint
   - Send emails in background (asyncio task or Celery)

2. **Security hardening:**
   - Add rate limiting to auth endpoints (slowapi)
   - Implement CAPTCHA for registration (optional)
   - Add login attempt tracking for brute-force detection

3. **Testing infrastructure:**
   - Add pytest fixtures for authentication
   - Create test database setup
   - Add integration tests for auth flow

---

## Self-Check: PASSED

All key files verified to exist:
- ✅ backend/app/auth/password.py
- ✅ backend/app/auth/jwt.py
- ✅ backend/app/auth/schemas.py
- ✅ backend/app/auth/dependencies.py
- ✅ backend/app/auth/router.py
- ✅ backend/app/middleware/tenant.py
- ✅ backend/app/auth/__init__.py (modified)
- ✅ backend/app/middleware/__init__.py (modified)
- ✅ backend/app/main.py (modified)

All commit hashes verified:
- ✅ 2aa233c (Task 1: Auth utilities, schemas, and tenant middleware)
- ✅ d6f36e3 (Task 2: Auth endpoints - register, login, refresh, logout, me)
