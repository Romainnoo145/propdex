"""Regression test — M045/S01 T08: policy_documents vendor-org guard + versioning.

Iron rule: only the Propdex vendor organization can upload policy_documents.
Customer orgs must get HTTP 403. Re-uploads of the same (entity_type,
entity_code, source_key) triple must increment version_number.

These three tests are the security + correctness regression guards for
M045/S01 T07. If a future change accidentally drops the vendor-org check
or breaks the version increment logic, these tests fail immediately.
"""


import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
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
    )
    customer_user = User(
        email="customer@test.example",
        hashed_password="hashed",
        full_name="Customer User",
        organization_id=customer_org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add_all([vendor_user, customer_user])
    await test_db.commit()

    # Patch VENDOR_ORG_ID to match the vendor org we just created
    monkeypatch.setattr(config_module.settings, "VENDOR_ORG_ID", vendor_org.id)

    return vendor_user, vendor_org, customer_user, customer_org


async def test_customer_org_upload_rejected_with_403(test_db, vendor_and_customer_users):
    """A customer-org user calling store_document must get HTTPException 403.

    This is the iron-rule security regression test. If a future change
    drops the _assert_vendor_org call from store_document, customers
    could write global policy documents visible to all other customers,
    creating a cross-tenant data leak.
    """
    _vendor, _vendor_org, customer_user, customer_org = vendor_and_customer_users

    with pytest.raises(HTTPException) as exc_info:
        await policy_service.store_document(
            entity_type="gemeente",
            entity_code="GM0983",
            source_key="welstandsnota",
            filename="customer_tries_to_upload.pdf",
            content_type="application/pdf",
            file_bytes=b"customer content",
            user_id=customer_user.id,
            organization_id=customer_org.id,
            db=test_db,
        )

    assert exc_info.value.status_code == 403
    assert "vendor admins" in exc_info.value.detail.lower()

    # Verify no row was created
    result = await test_db.execute(select(PolicyDocument))
    rows = result.scalars().all()
    assert len(rows) == 0, "customer upload must not create any policy_documents row"


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
