"""E2E tests for GET /api/checklist-progress/{parcel_id}/org — M045/S04 T03.

Verifies the FastAPI endpoint contract end-to-end via httpx ASGITransport:
- Requires authentication (401 without Authorization header)
- Returns the expected ChecklistLinksBundle JSON shape
- Respects JWT organization scoping (Org A never sees Org B data)
- Attribution includes user display name
"""

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.checklist_progress import ChecklistProgress
from app.models.organization import Organization
from app.models.user import User

# Distinct parcel_id to avoid test isolation issues with T02 tests
PARCEL_ID = "NL.IMKAD.T03-E2E"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _make_org(db: AsyncSession, *, name: str) -> Organization:
    """Create a minimal organization."""
    org = Organization(name=name)
    db.add(org)
    await db.flush()
    return org


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org: Organization,
    full_name: str | None = "Test User",
) -> User:
    """Create a minimal user in the given org."""
    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name=full_name,
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _make_progress(
    *,
    user_id: uuid.UUID,
    parcel_id: str = PARCEL_ID,
    use_case: str,
    checked_items: list[str] | None = None,
    uploaded_documents: dict[str, str] | None = None,
) -> ChecklistProgress:
    """Construct a ChecklistProgress ORM object."""
    return ChecklistProgress(
        user_id=user_id,
        parcel_id=parcel_id,
        use_case=use_case,
        checked_items=checked_items or [],
        uploaded_documents=uploaded_documents or {},
    )


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    """Build the Authorization header for a user via JWT."""
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Test 1 — endpoint requires authentication
# ---------------------------------------------------------------------------


async def test_endpoint_requires_auth(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001 — fixture ensures clean schema
) -> None:
    """GET without an Authorization header returns 401."""
    response = await async_client.get(
        f"/api/checklist-progress/{PARCEL_ID}/org",
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Test 2 — endpoint returns the expected ChecklistLinksBundle shape
# ---------------------------------------------------------------------------


async def test_endpoint_returns_bundle_shape(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """GET with valid auth returns 200 with the 4 use_case keys in the body."""
    org = await _make_org(test_db, name="Org T03-Shape")
    user = await _make_user(test_db, email="shape@t03.example", org=org)
    await test_db.commit()

    response = await async_client.get(
        f"/api/checklist-progress/{PARCEL_ID}/org",
        headers=_auth_headers(user, org),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body.keys()) == {"optoppen", "splitsen", "transformatie", "nieuwbouw"}
    for use_case in ("optoppen", "splitsen", "transformatie", "nieuwbouw"):
        assert isinstance(body[use_case], dict)


# ---------------------------------------------------------------------------
# Test 3 — endpoint respects JWT organization scoping
# ---------------------------------------------------------------------------


async def test_endpoint_respects_jwt_organization_scoping(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Critical M045 regression: Org A and Org B cannot see each other's checklist data.

    Alice (Org A) and Carol (Org B) both check opt-03 on the same parcel.
    Alice's JWT call returns only her user_id in checked_by; Carol's returns only hers.
    """
    org_a = await _make_org(test_db, name="Org A T03-Scoping")
    org_b = await _make_org(test_db, name="Org B T03-Scoping")
    alice = await _make_user(
        test_db,
        email="alice@t03-scoping.example",
        org=org_a,
        full_name="Alice van Dijk",
    )
    carol = await _make_user(
        test_db,
        email="carol@t03-scoping.example",
        org=org_b,
        full_name="Carol Janssen",
    )
    test_db.add(_make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"]))
    test_db.add(_make_progress(user_id=carol.id, use_case="optoppen", checked_items=["opt-03"]))
    await test_db.commit()

    response_alice = await async_client.get(
        f"/api/checklist-progress/{PARCEL_ID}/org",
        headers=_auth_headers(alice, org_a),
    )
    response_carol = await async_client.get(
        f"/api/checklist-progress/{PARCEL_ID}/org",
        headers=_auth_headers(carol, org_b),
    )

    assert response_alice.status_code == 200, response_alice.text
    assert response_carol.status_code == 200, response_carol.text

    body_alice = response_alice.json()
    body_carol = response_carol.json()

    # Alice sees only her own check on opt-03
    checked_alice = body_alice["optoppen"]["opt-03"]["checked_by"]
    assert len(checked_alice) == 1, f"Alice must see exactly 1 entry, got {len(checked_alice)}"
    assert checked_alice[0]["user_id"] == str(alice.id)

    # Carol sees only her own check on opt-03
    checked_carol = body_carol["optoppen"]["opt-03"]["checked_by"]
    assert len(checked_carol) == 1, f"Carol must see exactly 1 entry, got {len(checked_carol)}"
    assert checked_carol[0]["user_id"] == str(carol.id)


# ---------------------------------------------------------------------------
# Test 4 — attribution includes user display name
# ---------------------------------------------------------------------------


async def test_endpoint_attribution_includes_displayname(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """checked_by entries include the user's full_name as user_name."""
    org = await _make_org(test_db, name="Org T03-DisplayName")
    alice = await _make_user(
        test_db,
        email="alice@t03-displayname.example",
        org=org,
        full_name="Alice van Dijk",
    )
    test_db.add(_make_progress(user_id=alice.id, use_case="optoppen", checked_items=["opt-03"]))
    await test_db.commit()

    response = await async_client.get(
        f"/api/checklist-progress/{PARCEL_ID}/org",
        headers=_auth_headers(alice, org),
    )

    assert response.status_code == 200, response.text
    body = response.json()

    checked_by = body["optoppen"]["opt-03"]["checked_by"]
    assert len(checked_by) == 1
    assert checked_by[0]["user_name"] == "Alice van Dijk"
