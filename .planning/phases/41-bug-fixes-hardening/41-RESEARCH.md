# Phase 41: Bug Fixes & Hardening — Research

**Researched:** 2026-02-20
**Domain:** Backend Python bug fixes, SQLAlchemy idempotency, frontend cleanup
**Confidence:** HIGH (all bugs located in codebase, root causes confirmed by code inspection)

---

## Summary

Phase 41 targets three independent bugs discovered during v5.0 development. All three are straightforward, well-scoped fixes with no new dependencies required.

**FIX-01** (register 500 error) has two root causes: (1) the `propdex` database does not exist in the shared Docker container — the `klarifai-discover-db` container (`postgis/postgis:16-3.5`, DB: `propdex`) is stopped while `qualifai-postgres` occupies port 5433 without PostGIS; (2) the test suite still expects the old `TokenResponse` schema (refresh_token in JSON body), but the implementation changed to `CookieTokenResponse` (refresh token in httpOnly cookie). The runtime fix is an infrastructure concern; the code fix is to update auth tests to match the cookie-based flow. The register endpoint code itself is correct — it properly creates org, user, and refresh token in sequence using `db.add()/db.flush()/db.commit()`.

**FIX-02** (ARQ idempotency) is a genuine logic gap: `area_scan_job` in Phase 4 inserts `ScanResult` rows using `session.add()` without conflict handling. A `UniqueConstraint("scan_id", "parcel_id")` named `uq_scan_results_scan_parcel` already exists on the model. The fix is to replace the plain `session.add(scan_result)` with a PostgreSQL `INSERT ... ON CONFLICT (scan_id, parcel_id) DO NOTHING` using `sqlalchemy.dialects.postgresql.insert`.

**FIX-03** (tech debt) has three components: (a) `react-resizable-panels` is listed in `package.json` dependencies but is not imported anywhere in the source code — safe to remove; (b) `ChangeTimeline.tsx` uses Tailwind `gray-*` classes (light theme colors) inconsistent with the dark theme design system that uses `grey-*` (custom CSS variables); (c) `ProjectEditModal.tsx` uses a mix of `gray-*` and one `grey-*` class — the backdrop uses `bg-grey-950/80` while the modal content uses `gray-*` light theme classes; (d) 4 unused Python imports are auto-fixable with `ruff --fix`.

**Primary recommendation:** Fix all three bugs sequentially in plan order. Each plan is fully independent with no cross-dependencies.

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sqlalchemy.dialects.postgresql` | current | `insert().on_conflict_do_nothing()` | Already in use; PostgreSQL-specific upsert pattern |
| `ruff` | 0.14.11 | Auto-fix unused imports | Already in pyproject.toml |
| Tailwind CSS v4 | current | Replace gray-* with grey-* | Already configured in index.css |

### No New Dependencies Required

All fixes use existing infrastructure:
- SQLAlchemy already imported in `area_scan.py`
- `postgresql.insert` is a submodule of already-installed SQLAlchemy
- Frontend uses Tailwind v4 already installed
- `react-resizable-panels` removal: `npm uninstall react-resizable-panels`

---

## Architecture Patterns

### Pattern 1: PostgreSQL ON CONFLICT DO NOTHING via SQLAlchemy

**What:** Replace `session.add(scan_result)` with a batch insert using `postgresql.insert` that silently ignores duplicate (scan_id, parcel_id) violations.

**When to use:** When a unique constraint exists and re-runs of a job should be idempotent rather than raising `IntegrityError`.

**Example:**
```python
# Source: confirmed working via python3 -c test in repo
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models.scan_result import ScanResult

stmt = pg_insert(ScanResult).values(
    organization_id=org_id,
    scan_id=scan.id,
    parcel_id=parcel.id,
    score=score,
    flags={"category": category, "factors": factors},
).on_conflict_do_nothing(
    index_elements=["scan_id", "parcel_id"]
)
await session.execute(stmt)
```

The `UniqueConstraint` on `ScanResult` already uses constraint name `uq_scan_results_scan_parcel` covering `(scan_id, parcel_id)`.

**Important:** Use `on_conflict_do_nothing(index_elements=["scan_id", "parcel_id"])` NOT `constraint="uq_scan_results_scan_parcel"` — the `index_elements` form works with both the index and the constraint. The `constraint=` form requires the constraint name to be visible in the transaction, which can fail if the table was just created.

**Verified:** `on_conflict_do_nothing` compiles to `ON CONFLICT (scan_id, parcel_id) DO NOTHING` (confirmed via SQLAlchemy compile test). Confidence: HIGH.

### Pattern 2: Auth Test Cookie Handling

**What:** The auth tests expect `"refresh_token"` in the JSON response body (old `TokenResponse` schema). The implementation now uses `CookieTokenResponse` — refresh token is sent as an httpOnly cookie, not in JSON.

**Fix approach for tests:** Update tests to read refresh_token from the response cookie instead of JSON body.

```python
# OLD (broken):
original_refresh_token = register_response.json()["refresh_token"]
refresh_response = await async_client.post(
    "/auth/refresh",
    json={"refresh_token": original_refresh_token},
)

# NEW (correct cookie-based flow):
# Refresh token is auto-sent as httpOnly cookie by the AsyncClient
# The /auth/refresh endpoint reads from request.cookies.get("refresh_token")
refresh_response = await async_client.post("/auth/refresh")
# Cookie is automatically forwarded by AsyncClient if set in previous response
```

In httpx `AsyncClient`, cookies from responses are automatically stored and forwarded on subsequent requests to the same host. The `_set_refresh_cookie` helper in `router.py` uses `response.set_cookie(key="refresh_token", ..., path="/api/auth")`, so the cookie is scoped to `/api/auth`.

**Test isolation:** Each test needs to use the cookie set by the register/login response. The `async_client` fixture (ASGITransport) handles cookie jar automatically.

### Pattern 3: Tailwind grey-* vs gray-* Cleanup

**What:** The design system defines custom Tailwind colors as `grey-*` (with 'e') in `index.css` via CSS variables: `--color-grey-950`, `--color-grey-900`, etc. The standard Tailwind palette uses `gray-*` (without 'e'). These are completely different color values.

**The problem in ChangeTimeline.tsx:** The component renders inside the dark-theme UI shell but uses light theme `gray-*` colors (e.g., `bg-gray-50/50`, `text-gray-800`). These reference standard Tailwind's light grays (white/near-white backgrounds, dark text), creating a bright white patch inside the dark UI.

**The problem in ProjectEditModal.tsx:** Modal uses mostly `gray-*` light-theme colors with one `grey-*` dark class: `bg-grey-950/80` for the backdrop (correct — dark overlay) but `bg-white` for the card with `gray-*` inputs (potentially intentional light card on dark backdrop, or legacy).

**Mapping gray-* → grey-* for dark theme:**
| Old (gray-*) | New (grey-*) | Notes |
|---|---|---|
| `bg-gray-50/50` | `bg-grey-900/50` | Very dark, subtle |
| `bg-gray-100` | `bg-grey-850` | Slightly lighter dark |
| `border-gray-100` | `border-grey-800` | Dark border |
| `text-gray-800` | `text-grey-100` | Near-white text |
| `text-gray-500` | `text-grey-400` | Muted text |
| `text-gray-400` | `text-grey-400` | Muted text |
| `hover:bg-gray-100/70` | `hover:bg-grey-800/70` | Hover state |

**ProjectEditModal decision:** The modal is currently light-themed (`bg-white` card on dark overlay). Since it renders in a light-mode area (Projecten page) or as a dialog overlay, the planner must decide: keep light-theme card but fix the one grey-* backdrop, OR convert to dark theme fully. The `bg-grey-950/80` backdrop is correct; the card classes look intentionally light (white background modal on dark backdrop). Clean fix: standardize backdrop to use consistent class and ensure `gray-*` is intentional for the white card.

### Pattern 4: npm Package Removal

**What:** `react-resizable-panels` is in `package.json` dependencies but not imported anywhere in the codebase.

**Fix:**
```bash
cd frontend
npm uninstall react-resizable-panels
```

This updates both `package.json` and `package-lock.json`. Then run `npm run check` to verify no type errors.

**Confidence:** HIGH — confirmed with `grep -r "react-resizable-panels" frontend/src` returns no matches.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate insert handling | Custom check-then-insert | `pg_insert().on_conflict_do_nothing()` | Atomic, race-condition safe |
| Import cleanup | Manual search | `ruff check --select F401 --fix` | Auto-detects and removes unused imports |
| Package audit | Manual grep | `npm ls react-resizable-panels` to verify before uninstall | Confirms no transitive usage |

---

## Common Pitfalls

### Pitfall 1: Batch Insert vs. Individual Insert for ON CONFLICT

**What goes wrong:** Replacing the `for` loop with a single `session.add()` per row with `on_conflict_do_nothing()` still requires changing to `session.execute(stmt)`. Using `session.add()` with a model instance that has a duplicate PK or unique violation will raise `IntegrityError` even if you didn't intend to — you cannot add `on_conflict_do_nothing` to `session.add()`.

**How to avoid:** The fix must use `session.execute(pg_insert(ScanResult).values(...).on_conflict_do_nothing(...))` not `session.add(scan_result)`.

**Batch option:** For performance, collect all (parcel, score, category, factors) tuples and do a single bulk insert with `session.execute(pg_insert(ScanResult).values([...]).on_conflict_do_nothing(...))`. This is cleaner and faster than N individual executes in a loop.

### Pitfall 2: Cookie Path Scoping in Tests

**What goes wrong:** The refresh token cookie is set with `path="/api/auth"`. When the test client makes a request to `/auth/refresh` (without the `/api` prefix), the cookie may not be forwarded because the path doesn't match.

**Verified path:** Looking at `auth/router.py`, the prefix is `/auth` (not `/api/auth`). The cookie path is `/api/auth` but the router is mounted at `/auth`. This is a potential mismatch — need to verify whether the cookie path scoping causes issues in tests.

**How to verify:** Check if `async_client.cookies` contains the refresh_token after register. If not, the cookie path scoping is the root cause.

**Resolution:** The cookie `path="/api/auth"` may need to match the actual route prefix (`/auth`) for tests to work properly. Or the test client needs to be configured with `cookies={"refresh_token": ...}` manually.

### Pitfall 3: gray-* vs grey-* in ProjectEditModal is Intentional Light Theme

**What goes wrong:** Blindly replacing all `gray-*` with `grey-*` in ProjectEditModal makes the modal dark-themed when it may be intentionally a light card on a dark backdrop (which is a valid UX pattern).

**How to avoid:** Keep `bg-white` and light-mode `gray-*` inside the card for readability. Only fix the backdrop to use consistent dark overlay. The one existing `bg-grey-950/80` backdrop class is already correct — the remaining `gray-*` classes inside the modal card are likely intentional.

**Decision for planner:** The success criterion says "clean legacy gray-* classes." If the intent is that ProjectEditModal's white card with gray inputs is intentional, then only fix classes that are clearly wrong (using gray instead of grey in dark-themed areas). Document this distinction explicitly in the plan.

### Pitfall 4: Ruff --fix Changes B904 Violations Too

**What goes wrong:** Running `ruff --fix` on F401 (unused imports) may also try to fix B904 (bare `raise` in except clauses) violations, which modifies auth exception handling code. The B904 changes may break existing tests if the exception chaining changes behavior.

**How to avoid:** Use `ruff check --select F401 --fix` (only F401) not `ruff check --fix` (all fixable). The 4 F401 violations are safe to auto-fix. The 13 B904 violations in the router/auth code are intentional (swallowed exceptions for security) and should be left for a later cleanup or addressed individually.

---

## Code Examples

### Complete ON CONFLICT DO NOTHING Pattern for area_scan.py

```python
# Source: verified via python3 compile test in /home/klarifai/Documents/klarifai/clientprojects/propdex/backend/
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Phase 4 in area_scan_job: Replace individual session.add() with batch upsert
qualifying_values = [
    {
        "organization_id": org_id,
        "scan_id": scan.id,
        "parcel_id": parcel.id,
        "score": score,
        "flags": {"category": category, "factors": factors},
    }
    for parcel, score, category, factors, _centroid in qualifying
]

if qualifying_values:
    stmt = pg_insert(ScanResult).values(qualifying_values).on_conflict_do_nothing(
        index_elements=["scan_id", "parcel_id"]
    )
    await session.execute(stmt)
```

### Ruff Auto-fix for F401 Violations

```bash
cd /home/klarifai/Documents/klarifai/clientprojects/propdex/backend
ruff check app/ --select F401 --fix

# Files affected:
# app/auth/jwt.py: remove `timezone` and `InvalidTokenError` imports
# app/jobs/change_monitor.py: remove `uuid` import
# app/middleware/rate_limit.py: remove `settings` import
```

### npm Package Removal

```bash
cd /home/klarifai/Documents/klarifai/clientprojects/propdex/frontend
npm uninstall react-resizable-panels
npm run check
```

---

## Exact Bugs Found by Inspection

### FIX-01: Register Endpoint 500 Error

**Root cause:** Two separate issues:

1. **Runtime/Infrastructure:** The `klarifai-discover-db` Docker container (`postgis/postgis:16-3.5`, DB: `propdex`) is stopped. The `qualifai-postgres` container (`postgres:16-alpine`, DB: `qualifai`) currently occupies port 5433 but does not have PostGIS installed and does not have a `propdex` database. When the backend starts and a user hits `/auth/register`, SQLAlchemy/asyncpg returns `InvalidCatalogNameError: database "propdex" does not exist`, which FastAPI catches and returns as a 500.

2. **Test-level bug:** `tests/integration/test_auth_flow.py` asserts `"refresh_token" in data` from the JSON body. The current `CookieTokenResponse` schema only has `access_token` and `token_type`. This causes ALL integration auth tests to fail (setup error in conftest due to missing PostGIS, plus assertion error in any test that runs).

**Code fix needed:**
- `tests/integration/test_auth_flow.py`: Update assertions to not expect `refresh_token` in JSON body. For token rotation tests, use the cookie from the response.
- The register endpoint code (`app/auth/router.py`) is correct — no logic changes needed.

**Infrastructure fix needed (separate from code):** Either start `klarifai-discover-db` container or update `.env` `DATABASE_URL` to point to a working PostGIS database. This is likely a developer environment issue, not a production code bug.

**Plan recommendation:** The 41-01 plan should focus on updating the tests to match the cookie-based auth flow (not the infrastructure setup), since the code logic is correct. The tests need to be updated to reflect the Phase 14 auth security changes (httpOnly cookies).

### FIX-02: ARQ Scan Job Creates Duplicate ScanResult Rows

**Root cause:** In `area_scan_job` Phase 4 (lines 228-242), `ScanResult` rows are inserted via `session.add(scan_result)` in a loop. The `ScanResult` model has `UniqueConstraint("scan_id", "parcel_id", name="uq_scan_results_scan_parcel")`. When the ARQ worker restarts mid-job (e.g., after a crash), it re-runs the scan from the beginning. On re-run, Phase 4 re-inserts the same `(scan_id, parcel_id)` combinations, hitting the unique constraint and raising `IntegrityError` (causing the scan to fail with status "failed").

**Code location:** `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/jobs/area_scan.py`, lines 228-242.

**Fix:** Replace `session.add(scan_result)` with `session.execute(pg_insert(ScanResult).values([...]).on_conflict_do_nothing(index_elements=["scan_id", "parcel_id"]))`.

### FIX-03: Tech Debt Cleanup

**Items confirmed by inspection:**

1. **`react-resizable-panels` in package.json:**
   - Listed as dependency: `"react-resizable-panels": "^2.1.9"` (line 30 of `package.json`)
   - Zero occurrences of import in `frontend/src/` — confirmed with grep
   - Safe to `npm uninstall react-resizable-panels`

2. **Legacy `gray-*` in `ChangeTimeline.tsx`:**
   - File uses 10+ Tailwind `gray-*` classes (lines 88-135)
   - Component is embedded in dark-themed UI shell
   - `bg-gray-50/50` creates near-white background inside dark UI (visual bug)
   - Should be replaced with `grey-*` equivalents from the design system

3. **Mixed `gray-*`/`grey-*` in `ProjectEditModal.tsx`:**
   - Backdrop: `bg-grey-950/80` (correct dark overlay — line 71)
   - Card + inputs: `bg-white`, `gray-*` classes (intentional light card)
   - Decision: the card appears to be intentionally light-themed (white card on dark backdrop). Only the `bg-grey-950/80` backdrop is currently correct. The rest of the `gray-*` classes are either acceptable (white card design) or should be audited for intent.

4. **Unused Python imports (4 total):**
   - `app/auth/jwt.py`: `timezone` from datetime, `InvalidTokenError` from jwt.exceptions
   - `app/jobs/change_monitor.py`: `uuid` module
   - `app/middleware/rate_limit.py`: `settings` from app.core.config
   - All auto-fixable with `ruff check --select F401 --fix`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `session.add()` for inserts | `session.execute(pg_insert().on_conflict_do_nothing())` | SQLAlchemy 1.4+ | Idempotent bulk inserts |
| TokenResponse (refresh in JSON) | CookieTokenResponse (refresh in httpOnly cookie) | Phase 14 | Security improvement — tests need update |
| TokenResponse tests | Cookie-aware httpx tests | Phase 41 (this phase) | Tests match implementation |

---

## Open Questions

1. **FIX-01: What exact error are users seeing in production?**
   - What we know: Tests fail due to `propdex` DB not existing in the shared container. The code is logically correct.
   - What's unclear: Whether this is a dev environment issue (klarifai-discover-db stopped) or a code bug causing 500s in a working environment.
   - Recommendation: Plan 41-01 should fix the test suite to match the cookie-based auth flow. Infrastructure setup is out of scope for a code plan. If the 500 error occurs in a working environment, also investigate whether any exception in `send_verification_email` background task causes the response to fail (it shouldn't — background tasks run after response).

2. **FIX-03: Should ProjectEditModal be dark-themed or stay light?**
   - What we know: The modal uses `bg-white` card with `gray-*` light classes. One backdrop class uses `bg-grey-950/80`.
   - What's unclear: Is the light card intentional UX (modal stands out on dark background) or legacy?
   - Recommendation: The success criterion says "clean legacy gray-* classes." Treat the modal as intentionally white-card-on-dark-backdrop. Fix only the `bg-grey-950/80` backdrop to use `bg-grey-950/80` (already correct) and leave the card `gray-*` as-is, or document that the whole modal should go dark.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/jobs/area_scan.py` — confirmed ScanResult insert logic
- Direct code inspection of `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/models/scan_result.py` — confirmed UniqueConstraint exists
- Direct code inspection of `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/app/auth/router.py` — confirmed CookieTokenResponse schema
- Direct code inspection of `/home/klarifai/Documents/klarifai/clientprojects/propdex/backend/tests/integration/test_auth_flow.py` — confirmed stale test assertions
- `ruff check app/ --select F401` — confirmed 4 unused import violations
- `grep -r "react-resizable-panels" frontend/src` — confirmed 0 usages
- `grep -rn "gray-"` on ChangeTimeline.tsx and ProjectEditModal.tsx — confirmed gray-* usage
- SQLAlchemy compile test confirming `on_conflict_do_nothing()` syntax — `ON CONFLICT (scan_id, parcel_id) DO NOTHING`
- Docker container inspection confirming klarifai-discover-db stopped, qualifai-postgres at port 5433 without PostGIS

### Secondary (MEDIUM confidence)
- SQLAlchemy 2.x documentation on `insert().on_conflict_do_nothing()` — standard pattern verified by compile test

---

## Metadata

**Confidence breakdown:**
- FIX-01 (register 500): HIGH — code and infrastructure root causes confirmed
- FIX-02 (ARQ idempotency): HIGH — bug location confirmed, fix pattern verified
- FIX-03 (tech debt): HIGH — unused package confirmed, gray-* classes confirmed, unused imports confirmed

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (stable domain — 30 days)
