"""Integration tests for list_documents org-scoping fix — M045/S03 T01.

Verifies that GET /api/documents/{parcel_id}/documents filters by organization_id
(not uploaded_by_user_id), enabling peer document sharing within an org.
"""

import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.organization import Organization
from app.models.parcel_document import ParcelDocument
from app.models.user import User

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org: Organization,
) -> User:
    """Create a minimal user in the given org."""
    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _make_org(db: AsyncSession, *, name: str) -> Organization:
    """Create a minimal organization."""
    org = Organization(name=name)
    db.add(org)
    await db.flush()
    return org


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    """Build the Authorization header for a user via JWT."""
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


def _make_parcel_doc(
    *,
    parcel_id: str,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    filename: str,
    document_type: str = "bodem",
) -> ParcelDocument:
    """Construct a ParcelDocument ORM object with all required fields."""
    return ParcelDocument(
        parcel_id=parcel_id,
        organization_id=org_id,
        uploaded_by_user_id=user_id,
        document_type=document_type,
        filename=filename,
        content_type="application/pdf",
        file_data=b"test content",
        file_size=12,
    )


# ---------------------------------------------------------------------------
# Test 1 — same-org users see each other's uploads
# ---------------------------------------------------------------------------


async def test_alice_and_bob_same_org_see_each_others_uploads(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Alice and Bob in the same org both see each other's uploads for the same parcel."""
    org_a = await _make_org(test_db, name="Shared Org A")
    alice = await _make_user(test_db, email="alice@t01.example", org=org_a)
    bob = await _make_user(test_db, email="bob@t01.example", org=org_a)

    parcel_id = "NL.IMKAD.T01-A"
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org_a.id, user_id=alice.id,
        filename="alice_bodemrapport.pdf",
    ))
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org_a.id, user_id=bob.id,
        filename="bob_funderingsrapport.pdf",
    ))
    await test_db.commit()

    response = await async_client.get(
        f"/api/documents/{parcel_id}/documents",
        headers=_auth_headers(alice, org_a),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["documents"]) == 2, (
        f"expected 2 documents (alice + bob), got {len(body['documents'])}"
    )
    filenames = {d["filename"] for d in body["documents"]}
    assert "alice_bodemrapport.pdf" in filenames
    assert "bob_funderingsrapport.pdf" in filenames


# ---------------------------------------------------------------------------
# Test 2 — org B user does not see org A uploads
# ---------------------------------------------------------------------------


async def test_org_b_user_does_not_see_org_a_uploads(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Carol in Org B must not see Alice's upload in Org A for the same parcel."""
    org_a = await _make_org(test_db, name="Org A T01-B")
    org_b = await _make_org(test_db, name="Org B T01-B")
    alice = await _make_user(test_db, email="alice@t01b.example", org=org_a)
    carol = await _make_user(test_db, email="carol@t01b.example", org=org_b)

    parcel_id = "NL.IMKAD.T01-B"
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org_a.id, user_id=alice.id,
        filename="alice_org_a_upload.pdf",
    ))
    await test_db.commit()

    response = await async_client.get(
        f"/api/documents/{parcel_id}/documents",
        headers=_auth_headers(carol, org_b),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["documents"]) == 0, (
        f"org B must see 0 documents from org A, got {len(body['documents'])}"
    )


# ---------------------------------------------------------------------------
# Test 3 — regression test for S03 fix (was user-scoped, now org-scoped)
# ---------------------------------------------------------------------------


async def test_pre_existing_user_scoped_regression_fails_without_fix(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Regression test for M045/S03 T01 org-scoping fix.

    Before the fix, list_documents filtered by uploaded_by_user_id == requesting_user.
    This meant Bob could not see Alice's upload even though they are in the same org.
    After the fix, the WHERE clause uses organization_id so both uploads are visible.
    Asserting len == 2 would have returned 1 before the fix.
    """
    org_a = await _make_org(test_db, name="Shared Org T01-C")
    alice = await _make_user(test_db, email="alice@t01c.example", org=org_a)
    bob = await _make_user(test_db, email="bob@t01c.example", org=org_a)

    parcel_id = "NL.IMKAD.T01-C"
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org_a.id, user_id=alice.id,
        filename="alice_regression.pdf",
    ))
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org_a.id, user_id=bob.id,
        filename="bob_regression.pdf",
    ))
    await test_db.commit()

    # GET as Bob — before fix this returned only Bob's 1 document
    response = await async_client.get(
        f"/api/documents/{parcel_id}/documents",
        headers=_auth_headers(bob, org_a),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["documents"]) == 2, (
        f"after S03 fix Bob must see both uploads (org-scoped); got {len(body['documents'])}. "
        "This would be 1 before the fix (user-scoped)."
    )


# ---------------------------------------------------------------------------
# Test 4 — document_type filter still works after org-scoping change
# ---------------------------------------------------------------------------


async def test_document_type_filter_still_works(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """The optional document_type query param still filters correctly after org-scoping fix."""
    org = await _make_org(test_db, name="Filter Test Org T01-D")
    user = await _make_user(test_db, email="user@t01d.example", org=org)

    parcel_id = "NL.IMKAD.T01-D"
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org.id, user_id=user.id,
        filename="bodem_rapport.pdf", document_type="bodem",
    ))
    test_db.add(_make_parcel_doc(
        parcel_id=parcel_id, org_id=org.id, user_id=user.id,
        filename="fundering_rapport.pdf", document_type="fundering",
    ))
    await test_db.commit()

    response = await async_client.get(
        f"/api/documents/{parcel_id}/documents?document_type=bodem",
        headers=_auth_headers(user, org),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["documents"]) == 1, (
        f"document_type=bodem filter must return exactly 1 result, got {len(body['documents'])}"
    )
    assert body["documents"][0]["document_type"] == "bodem"
