"""E2E tests for GET /api/policy-documents/admin/versions — M045/S05 T07.

Verifies the vendor-only per-slot version history endpoint:
- No Authorization → 401
- Non-vendor (customer, no superuser) → 403
- Vendor superuser → 200, versions ordered newest-first, source_key_label
  resolved from catalog, other slots excluded from the result.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.core.config import settings
from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.models.user import User


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    org_name: str,
    is_superuser: bool = False,
) -> tuple[User, Organization]:
    org = Organization(name=org_name)
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed_dummy",
        full_name="Admin Versions E2E",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=is_superuser,
    )
    db.add(user)
    await db.flush()
    return user, org


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


def _policy_row(
    *,
    user_id,
    org_id,
    entity_type: str,
    entity_code: str,
    source_key: str,
    version_number: int,
    filename: str,
) -> PolicyDocument:
    return PolicyDocument(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        filename=filename,
        content_type="application/pdf",
        file_data=b"test bytes",
        file_size=10,
        uploaded_by_user_id=user_id,
        organization_id=org_id,
        status="uploaded",
        is_global=True,
        version_number=version_number,
    )


async def test_versions_requires_authentication(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001 — pulled in for clean schema
) -> None:
    response = await async_client.get(
        "/api/policy-documents/admin/versions",
        params={
            "entity_type": "landelijk",
            "entity_code": "NL",
            "source_key": "beng-energieprestatie",
        },
    )
    assert response.status_code == 401


async def test_versions_rejects_non_vendor(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    customer_user, customer_org = await _make_user(
        test_db,
        email="customer@versions.example",
        org_name="Customer Org",
        is_superuser=False,
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/versions",
        params={
            "entity_type": "landelijk",
            "entity_code": "NL",
            "source_key": "beng-energieprestatie",
        },
        headers=_auth_headers(customer_user, customer_org),
    )
    assert response.status_code == 403


async def test_versions_returns_newest_first(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vendor_user, vendor_org = await _make_user(
        test_db,
        email="vendor@versions.example",
        org_name="Vendor Org",
        is_superuser=True,
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    for i in range(1, 4):
        test_db.add(
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="beng-energieprestatie",
                version_number=i,
                filename=f"beng_v{i}.pdf",
            )
        )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/versions",
        params={
            "entity_type": "landelijk",
            "entity_code": "NL",
            "source_key": "beng-energieprestatie",
        },
        headers=_auth_headers(vendor_user, vendor_org),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["entity_type"] == "landelijk"
    assert body["entity_code"] == "NL"
    assert body["source_key"] == "beng-energieprestatie"
    assert body["source_key_label"] == "BENG & energieprestatie"

    version_numbers = [v["version_number"] for v in body["versions"]]
    assert version_numbers == [3, 2, 1]

    first = body["versions"][0]
    assert first["filename"] == "beng_v3.pdf"
    assert first["uploader_name"] == "Admin Versions E2E"
    assert first["content_type"] == "application/pdf"
    assert first["file_size"] == 10


async def test_versions_filters_to_one_slot(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Other (entity, source) combinations must not leak into the response."""
    vendor_user, vendor_org = await _make_user(
        test_db,
        email="vendor-filter@versions.example",
        org_name="Vendor Org Filter",
        is_superuser=True,
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    test_db.add_all(
        [
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="beng-energieprestatie",
                version_number=1,
                filename="beng.pdf",
            ),
            # Different source_key at the same level — must be filtered out.
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="stikstof-nationaal",
                version_number=1,
                filename="stikstof.pdf",
            ),
            # Different entity_type — must be filtered out.
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="gemeente",
                entity_code="GM0983",
                source_key="beng-energieprestatie",
                version_number=1,
                filename="gemeente_beng.pdf",
            ),
        ]
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/versions",
        params={
            "entity_type": "landelijk",
            "entity_code": "NL",
            "source_key": "beng-energieprestatie",
        },
        headers=_auth_headers(vendor_user, vendor_org),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["versions"]) == 1
    assert body["versions"][0]["filename"] == "beng.pdf"
