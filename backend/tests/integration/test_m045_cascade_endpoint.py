"""E2E tests for GET /api/parcels/{parcel_id}/documents/bundle — M045/S02 T07.

Verifies the FastAPI endpoint contract end-to-end via httpx ASGITransport:
- Returns the expected JSON shape (peer_docs / cascade_policy_docs / checklist_links)
- Requires authentication (401 without Authorization header)
- peer_docs are strictly org-scoped via the JWT subject's organization_id
- Response body never contains file_data bytes (no leakage through the endpoint)
"""

import json
import uuid

import pytest
from geoalchemy2 import WKTElement
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.parcel_document import ParcelDocument
from app.models.policy_document import PolicyDocument
from app.models.user import User

# ---------------------------------------------------------------------------
# Test geometry helper
# ---------------------------------------------------------------------------

_DUMMY_GEOMETRY = WKTElement(
    "MULTIPOLYGON(((155000 463000, 155010 463000, 155010 463010, 155000 463010, 155000 463000)))",
    srid=28992,
)


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org_name: str,
) -> tuple[User, Organization]:
    """Create a minimal org + user for endpoint authentication."""
    org = Organization(name=org_name)
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Endpoint Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user, org


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    """Build the Authorization header for a user via JWT."""
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


def _walk(obj: object) -> list[str]:
    """Recursively collect every key name in a nested JSON-like structure."""
    keys: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            keys.append(k)
            keys.extend(_walk(v))
    elif isinstance(obj, list):
        for item in obj:
            keys.extend(_walk(item))
    return keys


# ---------------------------------------------------------------------------
# Test 1 — endpoint returns the expected bundle shape
# ---------------------------------------------------------------------------


async def test_endpoint_returns_bundle_shape(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """GET /api/parcels/{parcel_id}/documents/bundle returns the documented JSON shape."""
    user, org = await _make_user(test_db, email="shape@e2e.example", org_name="Shape Org")

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.E2ESHAPE",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0983",
        )
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.E2ESHAPE/documents/bundle",
        headers=_auth_headers(user, org),
    )

    assert response.status_code == 200, response.text
    body = response.json()

    # Top-level shape
    assert set(body.keys()) == {"peer_docs", "cascade_policy_docs", "checklist_links"}
    assert isinstance(body["peer_docs"], list)
    assert isinstance(body["cascade_policy_docs"], dict)
    assert isinstance(body["checklist_links"], dict)

    # M045/S04: checklist_links now has the rich ChecklistLinksBundle shape
    assert set(body["checklist_links"].keys()) == {"optoppen", "splitsen", "transformatie", "nieuwbouw"}
    for use_case in ("optoppen", "splitsen", "transformatie", "nieuwbouw"):
        assert isinstance(body["checklist_links"][use_case], dict)

    # cascade_policy_docs always exposes the three level keys (even when empty)
    cascade = body["cascade_policy_docs"]
    assert set(cascade.keys()) == {"landelijk", "provincie", "gemeente"}
    assert isinstance(cascade["landelijk"], list)
    assert isinstance(cascade["provincie"], list)
    assert isinstance(cascade["gemeente"], list)


# ---------------------------------------------------------------------------
# Test 2 — endpoint requires authentication
# ---------------------------------------------------------------------------


async def test_endpoint_requires_auth(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001  — fixture pulled in to ensure clean schema
) -> None:
    """GET without an Authorization header returns 401."""
    response = await async_client.get(
        "/api/parcels/NL.IMKAD.NOAUTH/documents/bundle",
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Test 3 — peer_docs are scoped by the JWT subject's organization_id
# ---------------------------------------------------------------------------


async def test_endpoint_peer_docs_are_org_scoped_via_jwt(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Two users in different orgs see only their own peer_docs via the JWT."""
    alice, org_a = await _make_user(test_db, email="alice@e2e.example", org_name="Org A")
    bob, org_b = await _make_user(test_db, email="bob@e2e.example", org_name="Org B")

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.E2EPEER",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0983",
        )
    )
    await test_db.flush()

    test_db.add(
        ParcelDocument(
            parcel_id="NL.IMKAD.E2EPEER",
            organization_id=org_a.id,
            uploaded_by_user_id=alice.id,
            document_type="bodem",
            filename="alice_e2e.pdf",
            content_type="application/pdf",
            file_data=b"alice e2e bytes",
            file_size=15,
        )
    )
    test_db.add(
        ParcelDocument(
            parcel_id="NL.IMKAD.E2EPEER",
            organization_id=org_b.id,
            uploaded_by_user_id=bob.id,
            document_type="bodem",
            filename="bob_e2e.pdf",
            content_type="application/pdf",
            file_data=b"bob e2e bytes",
            file_size=13,
        )
    )
    await test_db.commit()

    # Alice's JWT — sees only her doc
    response_a = await async_client.get(
        "/api/parcels/NL.IMKAD.E2EPEER/documents/bundle",
        headers=_auth_headers(alice, org_a),
    )
    assert response_a.status_code == 200, response_a.text
    body_a = response_a.json()
    assert len(body_a["peer_docs"]) == 1
    assert body_a["peer_docs"][0]["filename"] == "alice_e2e.pdf"

    # Bob's JWT — sees only his doc
    response_b = await async_client.get(
        "/api/parcels/NL.IMKAD.E2EPEER/documents/bundle",
        headers=_auth_headers(bob, org_b),
    )
    assert response_b.status_code == 200, response_b.text
    body_b = response_b.json()
    assert len(body_b["peer_docs"]) == 1
    assert body_b["peer_docs"][0]["filename"] == "bob_e2e.pdf"


# ---------------------------------------------------------------------------
# Test 4 — response body never contains file_data bytes anywhere
# ---------------------------------------------------------------------------


async def test_endpoint_bundle_serializes_cleanly_no_file_data(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """The serialized response must not contain a file_data key at any depth."""
    user, org = await _make_user(test_db, email="leak@e2e.example", org_name="Leak Org")

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    test_db.add(
        ParcelCache(
            id=uuid.uuid4(),
            parcel_id="NL.IMKAD.E2ELEAK",
            geometry=_DUMMY_GEOMETRY,
            gemeente_code="GM0983",
        )
    )
    await test_db.flush()

    # Seed both a peer parcel_document AND a cascade policy_document so the response
    # exercises both the peer_docs and cascade_policy_docs serialization paths.
    test_db.add(
        ParcelDocument(
            parcel_id="NL.IMKAD.E2ELEAK",
            organization_id=org.id,
            uploaded_by_user_id=user.id,
            document_type="bodem",
            filename="leak_peer.pdf",
            content_type="application/pdf",
            file_data=b"peer bytes that must not leak",
            file_size=29,
        )
    )
    test_db.add(
        PolicyDocument(
            entity_type="gemeente",
            entity_code="GM0983",
            source_key="welstand",
            filename="welstand_v1.pdf",
            content_type="application/pdf",
            file_data=b"policy bytes that must not leak",
            file_size=31,
            uploaded_by_user_id=user.id,
            organization_id=org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.E2ELEAK/documents/bundle",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    # Sanity: both surfaces are populated so the assertion isn't vacuous.
    assert len(body["peer_docs"]) == 1
    assert len(body["cascade_policy_docs"]["gemeente"]) == 1

    # Recursive key walk — file_data must not appear anywhere in the response tree.
    all_keys = _walk(body)
    assert "file_data" not in all_keys, (
        f"file_data leaked into response body. Keys present: {sorted(set(all_keys))}"
    )

    # Belt-and-suspenders: also verify the raw serialized text does not contain
    # the literal sentinel bytes (defends against any future field rename).
    raw = json.dumps(body)
    assert "peer bytes that must not leak" not in raw
    assert "policy bytes that must not leak" not in raw


# ---------------------------------------------------------------------------
# T03 Tests — GET /api/policy-documents/cascade/{gemeente_code}
# ---------------------------------------------------------------------------


async def test_gemeente_cascade_endpoint_vendor_200(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Vendor user gets 200 + correct 3-level structure from cascade endpoint."""
    from app.core.config import settings

    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor-t03-1@example.com", org_name="Vendor Org T03-1"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", str(vendor_org.id))

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    await test_db.flush()

    test_db.add(
        PolicyDocument(
            entity_type="landelijk",
            entity_code="NL",
            source_key="beng",
            filename="beng_v1.pdf",
            content_type="application/pdf",
            file_data=b"landelijk bytes",
            file_size=15,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    test_db.add(
        PolicyDocument(
            entity_type="provincie",
            entity_code="PV31",
            source_key="povi",
            filename="povi_v1.pdf",
            content_type="application/pdf",
            file_data=b"provincie bytes",
            file_size=15,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    test_db.add(
        PolicyDocument(
            entity_type="gemeente",
            entity_code="GM0983",
            source_key="welstand",
            filename="welstand_v1.pdf",
            content_type="application/pdf",
            file_data=b"gemeente bytes",
            file_size=14,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/cascade/GM0983",
        headers=_auth_headers(vendor_user, vendor_org),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body.keys()) == {"landelijk", "provincie", "gemeente"}
    assert isinstance(body["landelijk"], list)
    assert isinstance(body["provincie"], list)
    assert isinstance(body["gemeente"], list)
    assert len(body["landelijk"]) == 1
    assert len(body["provincie"]) == 1
    assert len(body["gemeente"]) == 1


async def test_gemeente_cascade_endpoint_customer_200(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Customer user sees identical cascade docs as vendor — is_global, not org-based."""
    from app.core.config import settings

    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor-t03-2@example.com", org_name="Vendor Org T03-2"
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", str(vendor_org.id))

    customer_user, customer_org = await _make_user(
        test_db, email="customer-t03-2@example.com", org_name="Customer Org T03-2"
    )

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    await test_db.flush()

    test_db.add(
        PolicyDocument(
            entity_type="landelijk",
            entity_code="NL",
            source_key="beng_t03_2",
            filename="beng_t03_2_v1.pdf",
            content_type="application/pdf",
            file_data=b"landelijk bytes t03-2",
            file_size=21,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    test_db.add(
        PolicyDocument(
            entity_type="provincie",
            entity_code="PV31",
            source_key="povi_t03_2",
            filename="povi_t03_2_v1.pdf",
            content_type="application/pdf",
            file_data=b"provincie bytes t03-2",
            file_size=21,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    test_db.add(
        PolicyDocument(
            entity_type="gemeente",
            entity_code="GM0983",
            source_key="welstand_t03_2",
            filename="welstand_t03_2_v1.pdf",
            content_type="application/pdf",
            file_data=b"gemeente bytes t03-2",
            file_size=20,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    await test_db.commit()

    vendor_response = await async_client.get(
        "/api/policy-documents/cascade/GM0983",
        headers=_auth_headers(vendor_user, vendor_org),
    )
    customer_response = await async_client.get(
        "/api/policy-documents/cascade/GM0983",
        headers=_auth_headers(customer_user, customer_org),
    )

    assert vendor_response.status_code == 200, vendor_response.text
    assert customer_response.status_code == 200, customer_response.text

    vendor_body = vendor_response.json()
    customer_body = customer_response.json()

    # Both responses must be identical — is_global visibility not org-dependent
    assert len(customer_body["landelijk"]) == len(vendor_body["landelijk"])
    assert len(customer_body["provincie"]) == len(vendor_body["provincie"])
    assert len(customer_body["gemeente"]) == len(vendor_body["gemeente"])

    # Verify source_key matches for first entry in each level
    assert customer_body["landelijk"][0]["source_key"] == vendor_body["landelijk"][0]["source_key"]
    assert customer_body["provincie"][0]["source_key"] == vendor_body["provincie"][0]["source_key"]
    assert customer_body["gemeente"][0]["source_key"] == vendor_body["gemeente"][0]["source_key"]


async def test_gemeente_cascade_endpoint_no_auth_401(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001 — fixture ensures clean schema
) -> None:
    """GET without Authorization header returns 401."""
    response = await async_client.get("/api/policy-documents/cascade/GM0983")
    assert response.status_code == 401


async def test_gemeente_cascade_endpoint_no_file_data_leak(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Response body must not contain file_data key or bytes at any depth."""
    vendor_user, vendor_org = await _make_user(
        test_db, email="vendor-t03-4@example.com", org_name="Vendor Org T03-4"
    )

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    await test_db.flush()

    test_db.add(
        PolicyDocument(
            entity_type="gemeente",
            entity_code="GM0983",
            source_key="welstand_leak",
            filename="welstand_leak_v1.pdf",
            content_type="application/pdf",
            file_data=b"SECRET_CASCADE_BYTES_DO_NOT_LEAK",
            file_size=32,
            uploaded_by_user_id=vendor_user.id,
            organization_id=vendor_org.id,
            status="uploaded",
            is_global=True,
            version_number=1,
        )
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/cascade/GM0983",
        headers=_auth_headers(vendor_user, vendor_org),
    )

    assert response.status_code == 200, response.text
    body = response.json()

    # Sanity: the gemeente list is populated so the assertion is not vacuous
    assert len(body["gemeente"]) >= 1

    all_keys = _walk(body)
    assert "file_data" not in all_keys, (
        f"file_data leaked into response body. Keys present: {sorted(set(all_keys))}"
    )

    raw = json.dumps(body)
    assert "SECRET_CASCADE_BYTES_DO_NOT_LEAK" not in raw
