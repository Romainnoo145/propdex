"""M052/S01 — Wave 0 validation stubs: hauzer_demo /me field + PUT project-type enqueues rescore.

RED today — production code lands in Waves 1-2:
  - DEMO-01: UserResponse has no `hauzer_demo` field yet (Plan 01-02 adds it).
  - FUND-02: PUT /project-type does not yet enqueue rescore_parcel (Plan 01-01 wires it).

These tests are the Nyquist signal: they MUST fail today to prove the production
code is still missing. Do NOT add pytest.skip / xfail / pytest.mark.skip.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.main import app
from app.models.organization import Organization
from app.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _seed_org_and_user(test_db, *, email: str | None = None) -> tuple[Organization, User]:
    """Seed one org + one user. Returns (org, user)."""
    org_name = f"TestOrg-{uuid.uuid4().hex[:8]}"
    org = Organization(name=org_name)
    test_db.add(org)
    await test_db.flush()

    user_email = email or f"u{uuid.uuid4().hex[:8]}@test.com"
    user = User(
        email=user_email,
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user)
    await test_db.commit()
    return org, user


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_me_returns_hauzer_demo_false(test_db, async_client) -> None:
    """DEMO-01: GET /api/auth/me returns hauzer_demo=false for a normal org user.

    RED today: UserResponse schema has no `hauzer_demo` field.
    Plan 01-02 adds the field + the DB column on Organization; once it lands
    this test turns GREEN (normal org → always false).
    """
    org, user = await _seed_org_and_user(test_db)
    headers = _auth_headers(user, org)

    response = await async_client.get("/api/auth/me", headers=headers)

    assert response.status_code == 200, response.text
    data = response.json()
    # The field does not exist today — KeyError is the expected RED signal.
    assert data["hauzer_demo"] is False


@pytest.mark.asyncio
async def test_put_project_type_enqueues_rescore(test_db, async_client) -> None:
    """FUND-02: PUT /api/parcels/{parcel_id}/project-type must enqueue rescore_parcel (best-effort).

    RED today: the PUT endpoint does not call enqueue_rescore_parcel yet.
    Plan 01-01 wires enqueue_rescore_parcel into the PUT handler; once it lands
    this test turns GREEN (enqueue_job await_count >= 1).

    ARQ pool mock pattern: app.state.arq_pool = AsyncMock() in try/finally,
    per M050/S03 + Phase 04.1 decisions in STATE.md.  Do NOT use
    monkeypatch.setattr on async_client.app — httpx AsyncClient has no .app.
    """
    org, user = await _seed_org_and_user(test_db)
    headers = _auth_headers(user, org)

    parcel_id = "NL.IMBAG.Pand.test1"

    # Mock ARQ pool on app.state (the pattern used across M050/S03 + Phase 04.1).
    previous_pool = getattr(app.state, "arq_pool", None)
    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=MagicMock())
    app.state.arq_pool = mock_pool
    try:
        response = await async_client.put(
            f"/api/parcels/{parcel_id}/project-type",
            json={"project_type": "optoppen"},
            headers=headers,
        )

        assert response.status_code == 200, response.text

        # FUND-02 contract: rescore must be enqueued after project-type is set.
        # enqueue_rescore_parcel calls pool.enqueue_job("rescore_parcel", ...).
        assert mock_pool.enqueue_job.await_count >= 1, (
            "FUND-02 VIOLATED: PUT /project-type did not enqueue rescore_parcel. "
            "Plan 01-01 must wire enqueue_rescore_parcel into the PUT handler."
        )
    finally:
        app.state.arq_pool = previous_pool
