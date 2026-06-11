"""Regression tests — M045/S01 T08: policy_documents auth guard + versioning.

Since M053/S08b the old service-layer _assert_vendor_org guard has been removed.
Auth is now enforced exclusively at the router via get_current_superuser.
The non-superadmin 403 is covered at the endpoint layer by:
  - tests/integration/test_m045_auto_ingest_endpoint.py::test_endpoint_non_superadmin_returns_403
  - test_upload_endpoint_rejects_non_superadmin (below)

The two remaining tests here are the correctness regression guards for
the versioning helper (_next_version_number) and the is_global flag that
the service sets unconditionally on every write.
"""


import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.organization import Organization
from app.models.user import User
from app.policy_documents import service as policy_service


@pytest.fixture
async def vendor_and_customer_users(test_db, monkeypatch):
    """Create vendor + customer organizations and users.

    Patches settings.VENDOR_ORG_ID to match the vendor org created here.
    """
    from app.core import config as config_module

    vendor_org = Organization(name="Propdex Vendor (test)")
    customer_org = Organization(name="Customer Org (test)")
    test_db.add_all([vendor_org, customer_org])
    await test_db.flush()

    vendor_user = User(
        email="vendor@test.example",
        hashed_password="hashed",
        full_name="Vendor Admin",
        organization_id=vendor_org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=True,
    )
    customer_user = User(
        email="customer@test.example",
        hashed_password="hashed",
        full_name="Customer User",
        organization_id=customer_org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add_all([vendor_user, customer_user])
    await test_db.commit()

    # Patch VENDOR_ORG_ID to match the vendor org we just created
    monkeypatch.setattr(config_module.settings, "VENDOR_ORG_ID", vendor_org.id)

    return vendor_user, vendor_org, customer_user, customer_org


async def test_upload_endpoint_rejects_non_superadmin(
    async_client: AsyncClient,
    test_db: AsyncSession,
) -> None:
    """Non-superadmin must get 403 from the upload endpoint.

    This is the router-layer auth regression test that replaced the old
    service-layer _assert_vendor_org check (removed in M053/S08b).
    The guard is get_current_superuser — org membership is irrelevant.
    """
    customer_org = Organization(name="Customer Org Upload Guard (test)")
    test_db.add(customer_org)
    await test_db.flush()
    customer_user = User(
        email="customer-upload-guard@test.example",
        hashed_password="hashed",
        full_name="Customer User",
        organization_id=customer_org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(customer_user)
    await test_db.commit()

    token = create_access_token(str(customer_user.id), str(customer_org.id))
    headers = {"Authorization": f"Bearer {token}"}

    response = await async_client.post(
        "/api/policy-documents/gemeente/GM0983",
        params={"source_key": "welstandsnota"},
        files={"file": ("customer.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 403, response.text


async def test_vendor_org_upload_succeeds_with_is_global_and_version(
    test_db, vendor_and_customer_users
):
    """A vendor-org user upload must succeed and produce a row with
    is_global=True and version_number=1 (first upload of this source)."""
    vendor_user, vendor_org, _customer, _customer_org = vendor_and_customer_users

    doc = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        filename="welstand.pdf",
        content_type="application/pdf",
        file_bytes=b"vendor welstand content",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )

    assert doc.id is not None
    assert doc.is_global is True, (
        "Vendor upload must auto-set is_global=True (cascade visibility)"
    )
    assert doc.version_number == 1, "First upload of a source is version 1"
    assert doc.organization_id == vendor_org.id
    assert doc.entity_type == "gemeente"
    assert doc.entity_code == "GM0983"
    assert doc.source_key == "welstandsnota"


async def test_vendor_reupload_increments_version(test_db, vendor_and_customer_users):
    """Re-uploading the same (entity_type, entity_code, source_key) triple
    must create a new row with version_number = prev + 1.

    This is the iron-rule correctness regression test for T07's
    _next_version_number helper. If the version increment is broken
    (e.g., always returns 1), the DISTINCT ON cascade query in S02
    would show inconsistent results and history view in S05 would break.
    """
    vendor_user, vendor_org, _customer, _customer_org = vendor_and_customer_users

    # First upload — version 1
    doc_v1 = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        filename="v1.pdf",
        content_type="application/pdf",
        file_bytes=b"v1 content",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )
    assert doc_v1.version_number == 1

    # Second upload — version 2
    doc_v2 = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        filename="v2.pdf",
        content_type="application/pdf",
        file_bytes=b"v2 content (updated)",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )
    assert doc_v2.version_number == 2, (
        "Re-upload must increment version_number — _next_version_number "
        "helper is broken or service is using the wrong value"
    )
    assert doc_v2.id != doc_v1.id, "Re-upload must create a new row, not overwrite"

    # Third upload — version 3
    doc_v3 = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        filename="v3.pdf",
        content_type="application/pdf",
        file_bytes=b"v3 content (another update)",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )
    assert doc_v3.version_number == 3, "Third upload is version 3"

    # Different source_key should start at version 1 (not share the counter)
    doc_other = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="omgevingsvisie",  # different source
        filename="visie.pdf",
        content_type="application/pdf",
        file_bytes=b"omgevingsvisie content",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )
    assert doc_other.version_number == 1, (
        "Different source_key must have independent version counter"
    )

    # Different entity (another gemeente) should also start at 1
    doc_different_entity = await policy_service.store_document(
        entity_type="gemeente",
        entity_code="GM1507",  # Horst aan de Maas
        source_key="welstandsnota",
        filename="horst_welstand.pdf",
        content_type="application/pdf",
        file_bytes=b"horst content",
        user_id=vendor_user.id,
        organization_id=vendor_org.id,
        db=test_db,
    )
    assert doc_different_entity.version_number == 1, (
        "Different entity_code must have independent version counter"
    )
