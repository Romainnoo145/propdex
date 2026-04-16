"""E2E tests for GET /api/policy-documents/admin/overview — M045/S05 T06.

Verifies the vendor-only admin overview endpoint via httpx ASGITransport:
- No Authorization → 401
- Non-superuser → 403 (blocked at get_current_superuser dependency)
- Superuser from non-vendor org → 403 (blocked at _assert_vendor_org)
- Vendor superuser → 200 with grouped cascade levels, latest-version picking,
  version_count, display-name resolution, auto_ingest prefix detection, totals.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.core.config import settings
from app.models.area_scan import AreaScan
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
        full_name="Admin Overview E2E",
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


async def test_overview_requires_authentication(
    async_client: AsyncClient,
    test_db: AsyncSession,  # noqa: ARG001 — pulled in for clean schema
) -> None:
    response = await async_client.get("/api/policy-documents/admin/overview")
    assert response.status_code == 401


async def test_overview_rejects_non_superuser(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    customer_user, customer_org = await _make_user(
        test_db,
        email="customer@overview.example",
        org_name="Customer Org",
        is_superuser=False,
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/overview",
        headers=_auth_headers(customer_user, customer_org),
    )
    assert response.status_code == 403


async def test_overview_rejects_superuser_from_non_vendor_org(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Superuser from a customer org still gets 403 via vendor guard.

    Covers the defence-in-depth layer: get_current_superuser allows the
    request through, but _assert_vendor_org rejects based on org.
    """
    _vendor, vendor_org = await _make_user(
        test_db, email="vendor-bystander@overview.example", org_name="Vendor Org"
    )
    rogue_user, rogue_org = await _make_user(
        test_db,
        email="rogue-super@overview.example",
        org_name="Customer Org With Superuser",
        is_superuser=True,
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/overview",
        headers=_auth_headers(rogue_user, rogue_org),
    )
    assert response.status_code == 403


async def test_overview_returns_grouped_latest_versions(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vendor_user, vendor_org = await _make_user(
        test_db,
        email="vendor@overview.example",
        org_name="Vendor Org",
        is_superuser=True,
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    # Area scan row supplies the gemeente display name (GM0983 → Venlo).
    # bbox_* columns are NOT NULL; dummy values are fine here — we only
    # read (gemeente_code, gemeente_naam) in fetch_admin_overview.
    test_db.add(
        AreaScan(
            gemeente_code="GM0983",
            gemeente_naam="Venlo",
            bbox_minx=0.0,
            bbox_miny=0.0,
            bbox_maxx=0.0,
            bbox_maxy=0.0,
        )
    )
    await test_db.flush()

    test_db.add_all(
        [
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="beng-energieprestatie",
                version_number=1,
                filename="beng_v1.pdf",
            ),
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="beng-energieprestatie",
                version_number=2,
                filename="beng_v2.pdf",
            ),
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="landelijk",
                entity_code="NL",
                source_key="beng-energieprestatie",
                version_number=3,
                filename="beng_v3.pdf",
            ),
            _policy_row(
                user_id=vendor_user.id,
                org_id=vendor_org.id,
                entity_type="gemeente",
                entity_code="GM0983",
                source_key="woonvisie",
                version_number=1,
                filename="venlo_woonvisie.pdf",
            ),
        ]
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/overview",
        headers=_auth_headers(vendor_user, vendor_org),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert len(body["landelijk"]) == 1
    landelijk_row = body["landelijk"][0]
    assert landelijk_row["source_key"] == "beng-energieprestatie"
    assert landelijk_row["source_key_label"] == "BENG & energieprestatie"
    assert landelijk_row["latest_version_number"] == 3
    assert landelijk_row["latest_filename"] == "beng_v3.pdf"
    assert landelijk_row["version_count"] == 3
    assert landelijk_row["entity_display_name"] == "Nederland"
    assert landelijk_row["auto_ingest"] is False
    assert landelijk_row["latest_uploader_name"] == "Admin Overview E2E"

    assert body["provinciaal"] == []

    assert len(body["gemeentelijk"]) == 1
    gemeente_row = body["gemeentelijk"][0]
    assert gemeente_row["entity_code"] == "GM0983"
    assert gemeente_row["entity_display_name"] == "Venlo"
    assert gemeente_row["source_key"] == "woonvisie"
    assert gemeente_row["version_count"] == 1

    assert body["totals"]["total_docs"] == 4
    assert body["totals"]["total_gemeenten"] == 1
    assert body["totals"]["latest_upload_at"] is not None


async def test_overview_marks_auto_ingest_rows(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vendor_user, vendor_org = await _make_user(
        test_db,
        email="vendor-auto@overview.example",
        org_name="Vendor Org Auto",
        is_superuser=True,
    )
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)

    test_db.add(
        _policy_row(
            user_id=vendor_user.id,
            org_id=vendor_org.id,
            entity_type="gemeente",
            entity_code="GM0363",
            source_key="huisvestingsverordening",
            version_number=1,
            filename="koop-cvdr-amsterdam-2024.pdf",
        )
    )
    await test_db.commit()

    response = await async_client.get(
        "/api/policy-documents/admin/overview",
        headers=_auth_headers(vendor_user, vendor_org),
    )
    assert response.status_code == 200, response.text
    gemeente_rows = response.json()["gemeentelijk"]
    assert len(gemeente_rows) == 1
    assert gemeente_rows[0]["auto_ingest"] is True
