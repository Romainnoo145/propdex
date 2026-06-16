"""Loader tests voor cascade_enrichment_service.get_huisvestingsverordening_document (M053/S12).

Cloned van de omgevingsvisie-loadertests in
tests/integration/test_cascade_enrichment_service.py: bewijst dat de loader
filtert op entity_type="gemeente", entity_code=<gemeente>, source_key=
"huisvestingsverordening" en de is_global/org_id OR-clause respecteert (global
doc van andere org resolved; org-private doc van andere org niet).
"""

import uuid

import pytest

from app.services import cascade_enrichment_service


@pytest.mark.asyncio
async def test_get_huisvestingsverordening_document_finds_matching_doc(
    test_db, create_test_user
):
    """De loader vindt een huisvestingsverordening die op alle filters matcht."""
    from app.models.policy_document import PolicyDocument

    user, org = await create_test_user(
        email="hv-owner@example.com", org_name="HV Owner Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="huisvestingsverordening",
        filename="venlo-huisvestingsverordening.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_huisvestingsverordening_document(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert found is not None
    assert found.id == doc.id
    assert found.source_key == "huisvestingsverordening"


@pytest.mark.asyncio
async def test_get_huisvestingsverordening_document_filters_on_source_key(
    test_db, create_test_user
):
    """Een doc met een andere source_key (woonvisie) mag NIET resolven."""
    from app.models.policy_document import PolicyDocument

    user, org = await create_test_user(
        email="hv-sk@example.com", org_name="HV SourceKey Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",  # NIET huisvestingsverordening
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_huisvestingsverordening_document(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert found is None


@pytest.mark.asyncio
async def test_get_huisvestingsverordening_document_finds_global_doc_from_other_org(
    test_db, create_test_user
):
    """Een vendor-global huisvestingsverordening van org A resolved voor org B."""
    from app.models.policy_document import PolicyDocument

    vendor_user, vendor_org = await create_test_user(
        email="hv-vendor@example.com", org_name="HV Vendor Org"
    )
    _other_user, other_org = await create_test_user(
        email="hv-other@example.com", org_name="HV Other Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=vendor_org.id,
        is_global=True,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="huisvestingsverordening",
        filename="venlo-huisvestingsverordening.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=vendor_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_huisvestingsverordening_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is not None
    assert found.id == doc.id


@pytest.mark.asyncio
async def test_get_huisvestingsverordening_document_does_not_leak_org_private_doc(
    test_db, create_test_user
):
    """Een org-private (is_global=false) doc van org A mag NIET resolven voor org B."""
    from app.models.policy_document import PolicyDocument

    owner_user, owner_org = await create_test_user(
        email="hv-private-owner@example.com", org_name="HV Private Owner Org"
    )
    _other_user, other_org = await create_test_user(
        email="hv-private-reader@example.com", org_name="HV Private Reader Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=owner_org.id,
        is_global=False,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="huisvestingsverordening",
        filename="private-huisvestingsverordening.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=owner_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_huisvestingsverordening_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is None
