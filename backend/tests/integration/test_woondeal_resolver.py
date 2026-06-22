"""Integration tests for the provincie-level Woondeal resolver (M054/S06).

Verifies that get_woondeal_document() resolves gemeente_code -> provincie_code
via GemeenteProvincieMap and fetches the matching woondeals PolicyDocument.
"""
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.services.cascade_enrichment_service import get_woondeal_document


async def _make_org_and_user(db: AsyncSession) -> tuple[Organization, User]:
    """Create a minimal org + user for FK constraints."""
    org = Organization(name="Test Org Woondeal")
    db.add(org)
    await db.flush()

    user = User(
        email=f"woondeal-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="hashed_dummy",
        full_name="Woondeal Tester",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return org, user


@pytest.mark.asyncio
async def test_resolves_provincie_woondeal_for_gemeente(test_db):
    org, user = await _make_org_and_user(test_db)
    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    doc = PolicyDocument(
        entity_type="provincie",
        entity_code="PV31",
        source_key="woondeals",
        filename="woondeal-limburg-2022-2030.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.7 fake",
        file_size=13,
        uploaded_by_user_id=user.id,
        organization_id=org.id,
        status="uploaded",
        is_global=True,
        version_number=1,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await get_woondeal_document(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert found is not None
    assert found.source_key == "woondeals"
    assert found.entity_type == "provincie"


@pytest.mark.asyncio
async def test_returns_none_when_no_provincie_mapping(test_db):
    found = await get_woondeal_document(
        test_db, gemeente_code="GM9999", organization_id=uuid.uuid4()
    )
    assert found is None
