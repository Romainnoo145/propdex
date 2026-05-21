"""REGRESSION: M052/S01 iron-rules for project_type pass-through + hauzer_demo multi-tenant isolation.

RED today — production code lands in Waves 1-2:
  - FUND-02 (iron-rule): rescore_parcel currently calls compute_score_v3(flags) without
    project_type — the source-text drift guard fails immediately.
  - DEMO-01 (isolation): Organization.hauzer_demo column does not exist yet; any attempt
    to set it errors, which is the expected RED signal driving Plan 01-02.

Do NOT add pytest.skip / xfail / pytest.mark.skip.

Per M050/S01 iron-rule pattern (STATE.md): "if eng-plan says X must not change, encode
that as regression test in backend/tests/regression/, not as comment."
"""
from __future__ import annotations

import inspect
import re
import uuid

import pytest

from app.jobs.rescore_cascade_job import rescore_parcel
from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.models.organization import Organization
from app.models.user import User


# ---------------------------------------------------------------------------
# Test 1 — FUND-02 iron-rule: rescore_parcel passes project_type to compute_score_v3
# ---------------------------------------------------------------------------


def test_rescore_parcel_uses_stored_project_type() -> None:
    """FUND-02 IRON RULE: rescore_parcel MUST pass stored project_type to compute_score_v3.

    Mechanism chosen: source-text drift guard (inspect.getsource) — mirrors the
    M050/S03 F2 drift-detection pattern in STATE.md and the existing
    test_brk_bevragen_signature_drift.py style. A full mock-DB approach would
    require re-implementing the rescore_parcel session flow just for this stub;
    the source-text guard is lighter and still fails CI the moment the
    production wiring is absent.

    RED today: rescore_cascade_job.py:341 reads `compute_score_v3(flags)` with
    no project_type argument. Plan 01-01 changes this to
    `compute_score_v3(flags, project_type=project_type_value)`.
    """
    source = inspect.getsource(rescore_parcel)

    # The call must pass project_type as a keyword argument to compute_score_v3.
    # Regex: compute_score_v3(..., project_type=...) anywhere in the function body.
    pattern = r"compute_score_v3\([^)]*project_type\s*="
    assert re.search(pattern, source), (
        "FUND-02 IRON RULE VIOLATED: rescore_parcel does not pass project_type "
        "to compute_score_v3. Current source calls compute_score_v3(flags) "
        "with the hardcoded 'onbepaald' default, ignoring the user's stored "
        "project choice. Plan 01-01 must load ParcelProjectType and pass it. "
        f"Searched for pattern: {pattern!r}"
    )


# ---------------------------------------------------------------------------
# Test 2 — DEMO-01: hauzer_demo multi-tenant isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hauzer_demo_multi_tenant_isolation(test_db, async_client) -> None:
    """DEMO-01: org with hauzer_demo=True sees true in /me; other org sees false.

    RED today on two levels:
      (a) Organization.hauzer_demo column does not exist (Plan 01-02 adds it) —
          the DB write errors, which is an acceptable RED signal.
      (b) UserResponse does not expose hauzer_demo (Plan 01-02 adds it too) —
          KeyError on response.json()["hauzer_demo"].

    Once Plan 01-02 ships: org_a (flag=True) → hauzer_demo:true,
    org_b (flag=False) → hauzer_demo:false, proving multi-tenant isolation.
    """
    # --- org A: hauzer_demo = True ---
    org_a = Organization(name=f"DemoOrg-{uuid.uuid4().hex[:8]}")
    test_db.add(org_a)
    await test_db.flush()

    # Set hauzer_demo at the DB layer (Plan 01-02 adds this column).
    # RED today: AttributeError / column-not-found.
    org_a.hauzer_demo = True  # type: ignore[attr-defined]

    user_a = User(
        email=f"demo-{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="Demo User A",
        organization_id=org_a.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user_a)
    await test_db.commit()

    # --- org B: hauzer_demo = False (default) ---
    org_b = Organization(name=f"NormalOrg-{uuid.uuid4().hex[:8]}")
    test_db.add(org_b)
    await test_db.flush()

    user_b = User(
        email=f"normal-{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="Normal User B",
        organization_id=org_b.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user_b)
    await test_db.commit()

    headers_a = {"Authorization": f"Bearer {create_access_token(str(user_a.id), str(org_a.id))}"}
    headers_b = {"Authorization": f"Bearer {create_access_token(str(user_b.id), str(org_b.id))}"}

    # org A (demo): must see hauzer_demo = True
    resp_a = await async_client.get("/api/auth/me", headers=headers_a)
    assert resp_a.status_code == 200, resp_a.text
    assert resp_a.json()["hauzer_demo"] is True, (
        "DEMO-01 VIOLATED: org with hauzer_demo=True must see true in /me response. "
        "Check that Organization.hauzer_demo column exists and /me reads it."
    )

    # org B (normal): must see hauzer_demo = False
    resp_b = await async_client.get("/api/auth/me", headers=headers_b)
    assert resp_b.status_code == 200, resp_b.text
    assert resp_b.json()["hauzer_demo"] is False, (
        "DEMO-01 MULTI-TENANT VIOLATED: org without hauzer_demo=True must see false. "
        "Users in other orgs must NEVER receive hauzer_demo:true."
    )
