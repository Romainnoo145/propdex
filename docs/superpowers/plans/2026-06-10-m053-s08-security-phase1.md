# Security Phase 1 — Urgent Safety Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the live cross-tenant data leaks, secret exposure, and auth-hardening gaps found in the 2026-06-10 audit, without changing product behavior for legitimate single-tenant flows.

**Architecture:** Each fix is independent and small (1–15 lines). Cross-tenant fixes add a missing `WHERE` clause or auth dependency; secret fixes move hardcoded values to required env vars; logging fixes gate dev-only output behind `ENVIRONMENT`. Every behavioral fix gets a regression test following the existing iron-rule pattern in `backend/tests/regression/`.

**Tech Stack:** FastAPI, SQLAlchemy 2.x async, pytest + httpx AsyncClient (ASGITransport), slowapi, ARQ. Validation per change: `cd backend && ruff check . && mypy .` plus the relevant pytest target.

**Slice:** `M053/S08` (security hardening). Commit prefix on every commit: `M053/S08: <what>`.

**Scope note — what this plan does NOT do:**
- Password **rotation on production** (Tom / Hauzer / partner-site) is a manual ops step gated on user approval — see Task 6. The code change (env-var requirement) is in scope; rotating the live values is not automated.
- The per-org scoring model redesign (audit CRIT-1) is Phase 3. Here we only **stop the bleeding** by org-scoping `rescore_weights_job` (Task 9).
- `pdf_parsing` report-patch (audit CRIT-3) is included but flagged for human review of the product intent (Task 8).

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `backend/app/agents/router.py` | scope `/bulk-requests` to caller | 1 |
| `backend/app/scans/router.py` + `app/scans/service.py` | org-ownership check on `cancel_scan` | 2 |
| `backend/app/policy_documents/router.py` | superuser dependency on auto-ingest | 3 |
| `backend/app/auth/email.py` | gate token logging behind ENVIRONMENT | 4 |
| `backend/app/auth/router.py` | rate limits on confirm + verify-email | 5 |
| `backend/app/middleware/rate_limit.py` | Redis-backed limiter storage | 5 |
| `backend/app/tools/seed_tom_user.py` + `seed_hauzer_demo.py` | required env-var passwords | 6 |
| `backend/app/auth/auth_service.py` | generic OAuth error messages | 7 |
| `backend/app/services/plan_aggregator.py` + `app/jobs/pdf_parsing.py` | commit-before-enqueue + scope report patch | 8 |
| `backend/app/jobs/rescore_weights.py` | org-scope the rescore query | 9 |
| `backend/tests/regression/test_m053_s08_*.py` | regression guards | 1,2,3,5,9 |

---

### Task 1: Scope `/bulk-requests` to the calling user (audit CRIT-2)

**Files:**
- Modify: `backend/app/agents/router.py:271-283` (the `list_bulk_requests` query)
- Test: `backend/tests/regression/test_m053_s08_bulk_requests_isolation.py`

- [ ] **Step 1: Write the failing regression test**

```python
"""REGRESSION-CRITICAL — M053/S08 bulk-requests tenant isolation.

GET /api/agents/bulk-requests must return ONLY the calling user's rows.
Before the fix the query was `select(BulkRequest)` with no filter, leaking
every tenant's natural-language portfolio queries (commercial intent).

Drift-detection: remove the `BulkRequest.user_id == user.id` filter in
`app/agents/router.py::list_bulk_requests` → this test fails.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bulk_request import BulkRequest
from app.models.organization import Organization
from app.models.user import User
from app.auth.password import hash_password


@pytest.mark.asyncio
async def test_bulk_requests_only_returns_callers_rows(
    async_client: AsyncClient,
    test_db: AsyncSession,
    auth_headers: dict[str, str],
    create_test_user,
):
    # The auth_headers user is user A. Create a second user B in another org
    # and a BulkRequest owned by B — it must never appear in A's list.
    org_b = Organization(name=f"OrgB-{uuid.uuid4()}")
    test_db.add(org_b)
    await test_db.flush()
    user_b = User(
        email=f"b-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("Whatever#1234"),
        full_name="B",
        organization_id=org_b.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user_b)
    await test_db.flush()
    test_db.add(BulkRequest(user_id=user_b.id, query_text="B's secret query", status="pending"))
    await test_db.commit()

    resp = await async_client.get("/api/agents/bulk-requests", headers=auth_headers)
    assert resp.status_code == 200
    texts = [r["query_text"] for r in resp.json()["requests"]]
    assert "B's secret query" not in texts
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_bulk_requests_isolation.py -v`
Expected: FAIL — B's query leaks into A's response.

- [ ] **Step 3: Apply the fix**

In `backend/app/agents/router.py`, in `list_bulk_requests`, scope both the data query and the count to the caller. Replace:

```python
    base = select(BulkRequest)
    count_q = select(func.count()).select_from(BulkRequest)

    if status:
        base = base.where(BulkRequest.status == status)
        count_q = count_q.where(BulkRequest.status == status)
```

with:

```python
    base = select(BulkRequest).where(BulkRequest.user_id == user.id)
    count_q = (
        select(func.count())
        .select_from(BulkRequest)
        .where(BulkRequest.user_id == user.id)
    )

    if status:
        base = base.where(BulkRequest.status == status)
        count_q = count_q.where(BulkRequest.status == status)
```

Also update the docstring line `"""List manual bulk requests. Currently visible to all authenticated users — admin restriction deferred to S04."""` to `"""List the calling user's manual bulk requests."""`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_bulk_requests_isolation.py -v`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd backend && ruff check app/agents/router.py && mypy app/agents/router.py
git add backend/app/agents/router.py backend/tests/regression/test_m053_s08_bulk_requests_isolation.py
git commit -m "M053/S08: scope /bulk-requests to calling user (cross-tenant leak)"
```

---

### Task 2: Org-ownership check on `cancel_scan` (audit CRIT-9)

`AreaScan.project_id` → `Project.organization_id` is the org link (verified in `service.py:144`). Add a helper that resolves the scan's org and reject cancellation of another org's scan.

**Files:**
- Modify: `backend/app/scans/service.py` (add `get_scan_org_id` helper near `get_scan_by_id:279`)
- Modify: `backend/app/scans/router.py:132-153` (`cancel_scan`)
- Test: `backend/tests/regression/test_m053_s08_cancel_scan_isolation.py`

- [ ] **Step 1: Write the failing test**

```python
"""REGRESSION-CRITICAL — M053/S08 cancel_scan org-ownership.

POST /api/scans/{id}/cancel is a destructive write. AreaScan is shared
reference data, but cancelling another org's running scan must be blocked.

Drift-detection: remove the org check in `cancel_scan` → this test fails
(returns 200 instead of 403/404).
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.project import Project


@pytest.mark.asyncio
async def test_cannot_cancel_other_orgs_scan(
    async_client: AsyncClient,
    test_db: AsyncSession,
    auth_headers: dict[str, str],
):
    # Build a running scan that belongs to a DIFFERENT org (via its project).
    org_b = Organization(name=f"OrgB-{uuid.uuid4()}")
    test_db.add(org_b)
    await test_db.flush()
    project_b = Project(
        organization_id=org_b.id,
        gemeente_code="GM9999",
        gemeente_naam="Othertown",
    )
    test_db.add(project_b)
    await test_db.flush()
    scan = AreaScan(
        project_id=project_b.id,
        gemeente_code="GM9999",
        gemeente_naam="Othertown",
        status="running",
        job_id="fake-job-id",
    )
    test_db.add(scan)
    await test_db.commit()

    resp = await async_client.post(f"/api/scans/{scan.id}/cancel", headers=auth_headers)
    assert resp.status_code in (403, 404)
```

> Note: if `Project` or `AreaScan` constructors require more non-null fields, fill them from the model definition — check `app/models/project.py` and `app/models/area_scan.py` before running.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_cancel_scan_isolation.py -v`
Expected: FAIL — returns 200, the foreign scan gets cancelled.

- [ ] **Step 3: Add the org-resolution helper in `service.py`**

After `get_scan_by_id` (ends ~line 298) add:

```python
async def get_scan_org_id(
    scan_id: uuid.UUID,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Return the organization_id that owns a scan via its project, or None.

    AreaScan itself is shared reference data; ownership is defined by the
    project the scan belongs to (Project is org-scoped).
    """
    query = (
        select(Project.organization_id)
        .join(AreaScan, AreaScan.project_id == Project.id)
        .where(AreaScan.id == scan_id)
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()
```

Ensure `Project` is imported in `service.py` (it is already used at line 144, so the import exists).

- [ ] **Step 4: Enforce it in `cancel_scan` (`router.py`)**

Add `get_current_organization_id` to the import on line 11 (already imported). Change the signature + body of `cancel_scan`:

```python
@router.post("/{scan_id}/cancel", response_model=MessageResponse)
@limiter.limit("10/minute")
async def cancel_scan(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running scan owned by the caller's organization."""
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    owner_org_id = await service.get_scan_org_id(scan_id, db)
    if owner_org_id != organization_id:
        # Do not reveal existence of another org's scan.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if scan.status != "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scan is not running (current status: {scan.status})",
        )

    arq_pool = request.app.state.arq_pool
    job = Job(scan.job_id, arq_pool)
    await job.abort()
    return {"message": "Scan cancellation requested", "id": str(scan_id)}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_cancel_scan_isolation.py -v`
Expected: PASS (403/404).

- [ ] **Step 6: Lint + commit**

```bash
cd backend && ruff check app/scans/ && mypy app/scans/router.py app/scans/service.py
git add backend/app/scans/router.py backend/app/scans/service.py backend/tests/regression/test_m053_s08_cancel_scan_isolation.py
git commit -m "M053/S08: require org ownership to cancel a scan (IDOR)"
```

---

### Task 3: Superuser dependency on auto-ingest (audit CRIT-10)

**Files:**
- Modify: `backend/app/policy_documents/router.py:266-273`
- Test: `backend/tests/regression/test_m053_s08_auto_ingest_auth.py`

- [ ] **Step 1: Write the failing test**

```python
"""REGRESSION — M053/S08 auto-ingest requires superuser.

POST /api/policy-documents/auto-ingest must not be reachable by an
ordinary authenticated user. Previously it used get_current_active_user
and relied on _assert_vendor_org, which is a no-op when VENDOR_ORG_ID is
unset (dev/test) — so any user could trigger bulk CVDR ingestion.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auto_ingest_blocked_for_non_superuser(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
):
    resp = await async_client.post(
        "/api/policy-documents/auto-ingest",
        headers=auth_headers,
        json={"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
    )
    assert resp.status_code == 403
```

> If `auth_headers` already creates a superuser, instead assert the non-superuser path explicitly by creating a plain user. Check `create_test_user` defaults in `tests/conftest.py:221` first.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_auto_ingest_auth.py -v`
Expected: FAIL — returns 200/202 (or a downstream error), not 403.

- [ ] **Step 3: Apply the fix**

In `backend/app/policy_documents/router.py`, ensure `get_current_superuser` is imported (the file already imports auth deps for other superuser endpoints — confirm via the delete endpoint above auto-ingest). Change the dependency:

```python
async def auto_ingest_policies(
    payload: AutoIngestRequest,
    request: Request,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> AutoIngestResponse:
```

Keep the existing `_assert_vendor_org(current_user.organization_id)` call as defense-in-depth.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_auto_ingest_auth.py -v`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd backend && ruff check app/policy_documents/router.py && mypy app/policy_documents/router.py
git add backend/app/policy_documents/router.py backend/tests/regression/test_m053_s08_auto_ingest_auth.py
git commit -m "M053/S08: require superuser for policy auto-ingest endpoint"
```

---

### Task 4: Gate verification/reset token logging behind ENVIRONMENT (audit CRIT-5)

**Files:**
- Modify: `backend/app/auth/email.py:41-44` and `:116-119`

- [ ] **Step 1: Apply the fix to `send_verification_email`**

Replace lines 41-44:

```python
    # Always log URL for dev testing (no mail server needed)
    print(f"\n[EMAIL VERIFICATION] URL for {email}:")
    print(f"  {verification_url}\n")
    logger.info(f"[EMAIL VERIFICATION] URL for {email}: {verification_url}")
```

with:

```python
    # Log the full token URL only in dev/test — never in production logs.
    if settings.ENVIRONMENT.lower() in ("development", "test", "testing"):
        print(f"\n[EMAIL VERIFICATION] URL for {email}:")
        print(f"  {verification_url}\n")
        logger.info(f"[EMAIL VERIFICATION] URL for {email}: {verification_url}")
```

- [ ] **Step 2: Apply the same fix to `send_password_reset_email`**

Replace lines 116-119:

```python
    # Always log URL for dev testing (no mail server needed)
    print(f"\n[PASSWORD RESET] URL for {email}:")
    print(f"  {reset_url}\n")
    logger.info(f"[PASSWORD RESET] URL for {email}: {reset_url}")
```

with:

```python
    # Log the full token URL only in dev/test — never in production logs.
    if settings.ENVIRONMENT.lower() in ("development", "test", "testing"):
        print(f"\n[PASSWORD RESET] URL for {email}:")
        print(f"  {reset_url}\n")
        logger.info(f"[PASSWORD RESET] URL for {email}: {reset_url}")
```

- [ ] **Step 3: Verify no token logging remains unguarded**

Run: `cd backend && grep -n "verification_url\|reset_url" app/auth/email.py`
Expected: each `print`/`logger` reference sits inside the `if settings.ENVIRONMENT...` block (the HTML-body references remain, which is correct — they are not logs).

- [ ] **Step 4: Lint + commit**

```bash
cd backend && ruff check app/auth/email.py && mypy app/auth/email.py
git add backend/app/auth/email.py
git commit -m "M053/S08: stop logging auth token URLs in production"
```

---

### Task 5: Rate limits on confirm + verify-email, Redis-backed limiter (audit SEC-1, SEC-3)

**Files:**
- Modify: `backend/app/middleware/rate_limit.py:14-20`
- Modify: `backend/app/auth/router.py:164-170` (verify-email) and `:202-208` (confirm)

- [ ] **Step 1: Switch limiter storage to Redis with in-memory fallback**

In `backend/app/middleware/rate_limit.py`, add the config import and use `REDIS_URL`. Replace lines 11-20:

```python
# Initialize rate limiter
# Use in-memory storage for MVP (can switch to Redis later)
# If Redis URL is configured in settings, use Redis backend
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",  # In-memory storage for MVP
)

logger.info("Rate limiter initialized with in-memory storage")
```

with:

```python
from app.core.config import settings

# Redis-backed storage so rate-limit counters survive process restarts and
# are shared across workers; falls back to in-memory only if no Redis URL.
_storage_uri = settings.REDIS_URL or "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri=_storage_uri,
)

logger.info(
    "Rate limiter initialized with %s storage",
    "redis" if _storage_uri.startswith("redis") else "in-memory",
)
```

> Confirm `slowapi`'s Redis backend dependency (`limits[redis]` / `redis` package) is installed — run `cd backend && python -c "import redis"`. If missing, keep the change but note it in the commit; ARQ already uses Redis so the package is present.

- [ ] **Step 2: Add a rate limit to `verify-email`**

In `backend/app/auth/router.py`, change the `verify_email_endpoint` (line 164). It currently has no `request` param. Replace:

```python
@router.post("/verify-email", response_model=MessageResponse)
async def verify_email_endpoint(
    verify_data: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Verify user's email address using verification token."""
    return await verify_email(db, verify_data.token)
```

with:

```python
@router.post("/verify-email", response_model=MessageResponse)
@limiter.limit("20/hour")
async def verify_email_endpoint(
    request: Request,
    verify_data: EmailVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Verify user's email address using verification token."""
    return await verify_email(db, verify_data.token)
```

- [ ] **Step 3: Add a rate limit to `password-reset/confirm`**

Replace the `confirm_password_reset_endpoint` (line 202):

```python
@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset_endpoint(
    reset_confirm: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Confirm password reset and set new password."""
    return await confirm_password_reset(db, reset_confirm.token, reset_confirm.new_password)
```

with:

```python
@router.post("/password-reset/confirm", response_model=MessageResponse)
@limiter.limit("10/hour")
async def confirm_password_reset_endpoint(
    request: Request,
    reset_confirm: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Confirm password reset and set new password."""
    return await confirm_password_reset(db, reset_confirm.token, reset_confirm.new_password)
```

- [ ] **Step 4: Run the existing auth test suite to confirm nothing broke**

Run: `cd backend && python -m pytest tests/ -k "auth or rate" -v`
Expected: PASS. (Rate-limit tests disable the limiter via `limiter.enabled = False` per the project testing note — the new decorators must not break the suite.)

- [ ] **Step 5: Lint + commit**

```bash
cd backend && ruff check app/middleware/rate_limit.py app/auth/router.py && mypy app/middleware/rate_limit.py app/auth/router.py
git add backend/app/middleware/rate_limit.py backend/app/auth/router.py
git commit -m "M053/S08: Redis-backed rate limiter + limits on verify-email & reset-confirm"
```

---

### Task 6: Require env-var passwords in seed scripts (audit CRIT-4)

This removes hardcoded secrets from source. **Production rotation is a separate manual step (see end of this task) — do not skip it.**

**Files:**
- Modify: `backend/app/tools/seed_tom_user.py:24`
- Modify: `backend/app/tools/seed_hauzer_demo.py:49-51`

- [ ] **Step 1: Make `seed_tom_user.py` require an env var**

Add `import os` near the top imports (after `import asyncio`), then replace line 24:

```python
TOM_INITIAL_PASSWORD = "<REDACTED-HARDCODED-PASSWORD>"
```

with:

```python
TOM_INITIAL_PASSWORD = os.environ.get("TOM_SEED_PASSWORD")
```

Then at the very top of `async def seed()` (before the engine line), add a guard:

```python
    if not TOM_INITIAL_PASSWORD:
        raise SystemExit(
            "TOM_SEED_PASSWORD env var is required to run this seed script."
        )
```

- [ ] **Step 2: Remove the hardcoded fallback in `seed_hauzer_demo.py`**

Replace lines 49-51:

```python
HAUZER_INITIAL_PASSWORD = os.environ.get(
    "HAUZER_DEMO_PASSWORD", "<REDACTED-HARDCODED-FALLBACK>"
)
```

with:

```python
HAUZER_INITIAL_PASSWORD = os.environ.get("HAUZER_DEMO_PASSWORD")
```

Then add a guard at the start of the script's main seed coroutine (find the top-level `async def` that performs the seed — mirror the placement used in `seed_tom_user.py`):

```python
    if not HAUZER_INITIAL_PASSWORD:
        raise SystemExit(
            "HAUZER_DEMO_PASSWORD env var is required to run this seed script."
        )
```

- [ ] **Step 3: Verify no hardcoded credential remains in the tools dir**

Run: `cd backend && grep -rnE "Propdex-Tom#|Hauzer-Venlo#" app/ ; echo "exit=$?"`
Expected: no matches (grep exit=1).

- [ ] **Step 4: Lint + commit**

```bash
cd backend && ruff check app/tools/seed_tom_user.py app/tools/seed_hauzer_demo.py
git add backend/app/tools/seed_tom_user.py backend/app/tools/seed_hauzer_demo.py
git commit -m "M053/S08: require env-var passwords in seed scripts (remove hardcoded secrets)"
```

- [ ] **Step 5: MANUAL — rotate live credentials (requires user)**

Removing the constants does not remove them from git history. After merge, the user must:
1. Set `TOM_SEED_PASSWORD` and `HAUZER_DEMO_PASSWORD` in Railway env (new values).
2. Re-run both seed scripts on prod to reset the live passwords.
3. Rotate the `partner-site/build.mjs` content password (the committed `venlo-…-2026` value) and redeploy partner-site.
4. Consider a history scrub (git filter-repo / BFG) if the repo will ever be shared.

> This step is a checklist item for the human, not an automated change. Flag it in the PR description.

---

### Task 7: Generic OAuth error messages (audit SEC-4)

**Files:**
- Modify: `backend/app/auth/auth_service.py` (the two `detail=f"...: {e!s}"` lines in `google_callback`, ~line 483 and ~line 503)

- [ ] **Step 1: Confirm `logger` exists in the module**

Run: `cd backend && grep -n "^logger\|logging.getLogger" app/auth/auth_service.py`
Expected: a module-level `logger`. If absent, add `import logging` + `logger = logging.getLogger(__name__)` near the top.

- [ ] **Step 2: Replace the token-exchange error**

Replace:

```python
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange authorization code: {e!s}",
        ) from e
```

with:

```python
    except Exception as e:
        logger.exception("Google OAuth token exchange failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication failed",
        ) from e
```

- [ ] **Step 3: Replace the user-info error**

Replace:

```python
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch user info from Google: {e!s}",
        ) from e
```

with:

```python
    except Exception as e:
        logger.exception("Google OAuth user-info fetch failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google authentication failed",
        ) from e
```

> Leave the inner `HTTPException` re-raise (`except HTTPException: raise`) untouched so the explicit "Failed to fetch user email from Google" 400 still surfaces.

- [ ] **Step 4: Lint + commit**

```bash
cd backend && ruff check app/auth/auth_service.py && mypy app/auth/auth_service.py
git add backend/app/auth/auth_service.py
git commit -m "M053/S08: return generic OAuth error, log details server-side"
```

---

### Task 8: Commit-before-enqueue + scope pdf_parsing report patch (audit CRIT-8, CRIT-3)

CRIT-8 is a safe ordering fix. CRIT-3 (the cross-tenant report patch) needs a judgment call, isolated into its own step so it can be reviewed/skipped independently.

**Files:**
- Modify: `backend/app/services/plan_aggregator.py:44-57` (`enqueue_parsing_job`)
- Modify: `backend/app/jobs/pdf_parsing.py:188-203` (report-patch loop)

- [ ] **Step 1: Fix enqueue ordering (CRIT-8)**

In `enqueue_parsing_job`, commit the row before enqueueing so the worker can never observe a missing row. Replace lines 44-57:

```python
    session.add(job)
    await session.flush()  # Get the id

    # Enqueue ARQ job
    arq_job = await arq_pool.enqueue_job(
        "pdf_parsing_job",
        plan_idn=plan_idn,
    )

    # Update ParsingJob with ARQ job_id
    job.job_id = arq_job.job_id
    session.add(job)
    await session.flush()
    await session.commit()
```

with:

```python
    session.add(job)
    await session.flush()  # Get the id
    await session.commit()  # Persist BEFORE enqueue so the worker can see it

    # Enqueue ARQ job only after the row is durably committed
    arq_job = await arq_pool.enqueue_job(
        "pdf_parsing_job",
        plan_idn=plan_idn,
    )

    # Record the ARQ job_id on the now-committed row
    job.job_id = arq_job.job_id
    session.add(job)
    await session.commit()
```

- [ ] **Step 2: Verify the parsing flow still works end-to-end**

Run: `cd backend && python -m pytest tests/ -k "parsing or plan_aggregator or aggregator" -v`
Expected: PASS (or no tests collected — if none exist, note it; the ordering change is behavior-preserving for the happy path).

- [ ] **Step 3: Commit the ordering fix**

```bash
cd backend && ruff check app/services/plan_aggregator.py && mypy app/services/plan_aggregator.py
git add backend/app/services/plan_aggregator.py
git commit -m "M053/S08: commit parsing job before enqueue (no job-not-found race)"
```

- [ ] **Step 4: Constrain the report-patch query to plan-matching rows (CRIT-3, partial-safe)**

The current loop in `pdf_parsing.py:189-203` does `select(SavedReport)` over the whole table and filters in Python. Without user context in the worker, the minimal safe improvement is to (a) avoid the full-table scan and (b) leave a clear marker that cross-user patching is intentional or not. Replace:

```python
                report_stmt = select(SavedReport)
                report_result = await session.execute(report_stmt)
                for report in report_result.scalars().all():
```

with a comment-documented, bounded query. Keep the existing Python prefix-match (the `plan_id` lives inside JSONB and is matched both directions), but add an ordering + cap so a growing table cannot OOM the worker:

```python
                # NOTE (M053/S08): SavedReport has no organization_id (user-scoped
                # via RLS, not enforced in the worker session). This patch updates
                # ANY user's report that references this plan. That is acceptable
                # only because the AI parse is plan-global, not tenant-specific.
                # Bounded to the most recent reports to avoid a full-table scan.
                report_stmt = (
                    select(SavedReport)
                    .order_by(SavedReport.created_at.desc())
                    .limit(500)
                )
                report_result = await session.execute(report_stmt)
                for report in report_result.scalars().all():
```

> **HUMAN REVIEW REQUIRED:** confirm the product intent — should a plan re-parse patch other tenants' saved reports at all? If not, the correct fix is to thread the requesting `user_id` from `enqueue_parsing_job` → `pdf_parsing_job` and filter `SavedReport.user_id == user_id`, which touches all callers of `enqueue_parsing_job`/`get_or_parse_plan`. Do that in a follow-up if the answer is "no". Verify `SavedReport.created_at` exists before applying the `order_by` (check `app/models/saved_report.py`).

- [ ] **Step 5: Commit the bounded report-patch**

```bash
cd backend && ruff check app/jobs/pdf_parsing.py && mypy app/jobs/pdf_parsing.py
git add backend/app/jobs/pdf_parsing.py
git commit -m "M053/S08: bound pdf_parsing report patch + document cross-tenant scope"
```

---

### Task 9: Org-scope `rescore_weights_job` (audit CRIT-1, stop-the-bleeding)

The job receives `organization_id` but rescopes **all** tenants' `scan_results`. `ScanResult` has no `organization_id`; the org link is `scan_results.scan_id → area_scans.project_id → projects.organization_id`. Constrain the batch query to the triggering org's scans.

**Files:**
- Modify: `backend/app/jobs/rescore_weights.py:197-208`
- Test: `backend/tests/regression/test_m053_s08_rescore_weights_org_scope.py`

- [ ] **Step 1: Confirm the join columns**

Run: `cd backend && grep -n "scan_id\|project_id\|organization_id" app/models/scan_result.py app/models/area_scan.py app/models/project.py`
Expected: `ScanResult.scan_id`, `AreaScan.id`/`AreaScan.project_id`, `Project.id`/`Project.organization_id`. Adjust the join below if names differ.

- [ ] **Step 2: Write the failing test**

```python
"""REGRESSION-CRITICAL — M053/S08 rescore_weights_job org scope.

The job must only rescore scan_results belonging to the triggering org
(via scan_id -> area_scans.project_id -> projects.organization_id).
Before the fix it rescored ALL tenants' rows with one org's weights.

This test pins the query: build two scan_results in two different orgs,
run the job for org A, assert org B's row is untouched.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.jobs.rescore_weights import rescore_weights_job


async def _scan_result_for_org(db: AsyncSession, gemeente_code: str) -> tuple[uuid.UUID, ScanResult]:
    org = Organization(name=f"Org-{uuid.uuid4()}", score_weights={})
    db.add(org)
    await db.flush()
    project = Project(organization_id=org.id, gemeente_code=gemeente_code, gemeente_naam="X")
    db.add(project)
    await db.flush()
    scan = AreaScan(project_id=project.id, gemeente_code=gemeente_code, gemeente_naam="X", status="completed", job_id="j")
    db.add(scan)
    await db.flush()
    sr = ScanResult(scan_id=scan.id, parcel_id=f"P-{uuid.uuid4()}", score=10, flags={"score_breakdown": {}})
    db.add(sr)
    await db.flush()
    return org.id, sr


@pytest.mark.asyncio
async def test_rescore_weights_does_not_touch_other_org(test_db: AsyncSession):
    org_a, sr_a = await _scan_result_for_org(test_db, "GM0001")
    _org_b, sr_b = await _scan_result_for_org(test_db, "GM0002")
    await test_db.commit()
    b_score_before = sr_b.score

    # The job opens its own engine/session; this test asserts the QUERY shape
    # via a direct call. If the job cannot share test_db, assert instead that
    # the SQL text contains the org join (see Step 4 fallback).
    await rescore_weights_job({}, organization_id=str(org_a))

    await test_db.refresh(sr_b)
    assert sr_b.score == b_score_before, "org B's scan_result must be untouched"
```

> The job builds its own engine (`create_async_engine`), so it will not see `test_db`'s uncommitted state and may not be callable in-process against the test DB. If that makes the behavioral test infeasible in this harness, fall back to a **query-shape assertion**: import the statement-builder or assert the module source contains the `Project.organization_id` join (mirroring how `test_m050_s03_multitenant.py` documents drift). Pick whichever runs green in this repo's conftest.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_rescore_weights_org_scope.py -v`
Expected: FAIL — org B's row is rescored.

- [ ] **Step 4: Apply the org filter**

In `backend/app/jobs/rescore_weights.py`, add the needed imports (`from app.models.area_scan import AreaScan`, `from app.models.project import Project` — keep existing `ScanResult` import) and constrain the batch query. Replace lines 199-208:

```python
                stmt = (
                    select(ScanResult)
                    .where(
                        ScanResult.flags.isnot(None),
                    )
                    .order_by(ScanResult.id)
                    .offset(offset)
                    .limit(BATCH_SIZE)
                )
```

with:

```python
                stmt = (
                    select(ScanResult)
                    .join(AreaScan, AreaScan.id == ScanResult.scan_id)
                    .join(Project, Project.id == AreaScan.project_id)
                    .where(
                        ScanResult.flags.isnot(None),
                        Project.organization_id == org.id,
                    )
                    .order_by(ScanResult.id)
                    .offset(offset)
                    .limit(BATCH_SIZE)
                )
```

> `org` is already loaded in scope (the job fetches the org to read `score_weights` — confirm the variable name; if it is `organization`/`org_row`, use that). Use the org's UUID, converting from the `organization_id` str arg if no ORM object is in scope.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/regression/test_m053_s08_rescore_weights_org_scope.py -v`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd backend && ruff check app/jobs/rescore_weights.py && mypy app/jobs/rescore_weights.py
git add backend/app/jobs/rescore_weights.py backend/tests/regression/test_m053_s08_rescore_weights_org_scope.py
git commit -m "M053/S08: org-scope rescore_weights_job (stop cross-tenant score overwrite)"
```

---

### Task 10: Full validation + verification before claiming done

- [ ] **Step 1: Run the full backend check**

Run: `cd backend && ruff check . && mypy .`
Expected: no errors.

- [ ] **Step 2: Run the regression suite + touched areas**

Run: `cd backend && python -m pytest tests/regression/ tests/ -k "auth or scan or bulk or policy or rescore or rate" -v`
Expected: PASS. Capture the summary line as evidence.

- [ ] **Step 3: Confirm no hardcoded secret or unguarded token log remains**

Run:
```bash
cd backend && grep -rnE "Propdex-Tom#|Hauzer-Venlo#" app/ ; echo "secrets_exit=$?"
grep -nA1 "verification_url\b" app/auth/email.py | grep -c "ENVIRONMENT"
```
Expected: no secret matches (`secrets_exit=1`); ENVIRONMENT guard present.

- [ ] **Step 4: Invoke verification-before-completion**

Use `superpowers:verification-before-completion` to confirm each audit item (CRIT-2, CRIT-9, CRIT-10, CRIT-5, SEC-1, SEC-3, CRIT-4 code-part, SEC-4, CRIT-8, CRIT-1) maps to a committed change + green test/grep, before reporting completion. List the manual follow-ups (Task 6 Step 5, Task 8 Step 4 product decision) explicitly in the wrap-up.

---

## Self-Review

**Spec coverage:** bulk-requests (T1), cancel_scan (T2), auto-ingest auth (T3), token logging (T4), rate limits + Redis limiter (T5), seed passwords (T6), OAuth errors (T7), commit-before-enqueue + report-patch (T8), rescore_weights scope (T9), verification (T10). All nine audit items from the request are covered.

**Placeholder scan:** no "TBD/handle edge cases" — every code step shows the exact before/after. Two steps carry explicit **HUMAN REVIEW** flags (T6.5 rotation, T8.4 report-patch intent) by design, not as placeholders.

**Type consistency:** `get_scan_org_id` (T2) returns `uuid.UUID | None`, compared against `organization_id: uuid.UUID` from `get_current_organization_id`. Test helper names and model fields are marked "verify before running" where the constructor's full non-null set wasn't confirmed (`Project`, `AreaScan`, `ScanResult`). The rescore join (T9) is gated behind a Step-1 column-name confirmation.
