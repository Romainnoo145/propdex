"""Integration tests voor cascade_enrichment_service.get_cascade_payloads (M048/Phase 5).

TEST-05: bewijst dat get_cascade_payloads bij een woonvisie_match-extractie de
DOCUMENT_SENTINEL (niet het echte parcel_id) aan extract_factor doorgeeft.
"""

import uuid
from datetime import datetime

import pytest

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, ExtractedFactor
from app.services import cascade_enrichment_service


@pytest.mark.asyncio
async def test_woonvisie_uses_document_sentinel(
    test_db, create_test_user, monkeypatch
):
    """get_cascade_payloads MOET DOCUMENT_SENTINEL (niet het echte parcel_id) aan
    extract_factor doorgeven voor woonvisie_match.

    Success criterion #1: cascade_enrichment_service.py calls extract_factor
    with parcel_id='__document__' for document-level factors (woonvisie_match).
    """
    from app.ai.factors.woonvisie_match import WoonvisiePayload
    from app.models.policy_document import PolicyDocument

    user, org = await create_test_user()

    # Seed een woonvisie voor gemeente Venlo (entity_code="0983") zodat
    # get_woonvisie_document een doc vindt.
    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)

    # Spy op extract_factor — vang kwargs zonder Claude aan te roepen.
    captured_kwargs: dict = {}

    async def fake_extract_factor(db, *, factor_def, parcel_id, policy_document, **kwargs):
        captured_kwargs["parcel_id"] = parcel_id
        captured_kwargs["factor_id"] = factor_def.factor_id
        captured_kwargs["policy_document_id"] = policy_document.id
        return ExtractedFactor[WoonvisiePayload](
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
            payload=WoonvisiePayload(
                periode_start=2025,
                periode_einde=2030,
                prioritized_segment="sociaal",
                growth_wijken=["Blerick"],
                confidence=0.9,
            ),
            extracted_at=datetime.utcnow(),
            from_cache=False,
            schema_version=3,
        )

    monkeypatch.setattr(cascade_enrichment_service, "extract_factor", fake_extract_factor)

    real_parcel_id = "NL.IMBAG.Pand.0983100000000091"
    payloads = await cascade_enrichment_service.get_cascade_payloads(
        test_db,
        parcel_id=real_parcel_id,
        gemeente_code="0983",
        organization_id=org.id,
    )

    # Key assertion: extract_factor kreeg de sentinel, niet het echte parcel_id
    assert captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL
    assert captured_kwargs["parcel_id"] != real_parcel_id
    assert captured_kwargs["factor_id"] == "woonvisie_match"
    assert captured_kwargs["policy_document_id"] == doc.id
    assert "woonvisie_match" in payloads


@pytest.mark.asyncio
async def test_get_woonvisie_document_finds_global_doc_from_other_org(
    test_db, create_test_user
):
    """A vendor-global woonvisie owned by org A must resolve when queried as org B."""
    from app.models.policy_document import PolicyDocument
    from app.services import cascade_enrichment_service

    vendor_user, vendor_org = await create_test_user(
        email="vendor@example.com", org_name="Vendor Org"
    )
    _other_user, other_org = await create_test_user(
        email="other@example.com", org_name="Other Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=vendor_org.id,
        is_global=True,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=vendor_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_woonvisie_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is not None
    assert found.id == doc.id


@pytest.mark.asyncio
async def test_get_woonvisie_document_does_not_leak_org_private_doc(
    test_db, create_test_user
):
    """An org-private (is_global=false) doc owned by org A must NOT resolve for org B."""
    from app.models.policy_document import PolicyDocument
    from app.services import cascade_enrichment_service

    owner_user, owner_org = await create_test_user(
        email="owner@example.com", org_name="Owner Org"
    )
    _other_user, other_org = await create_test_user(
        email="reader@example.com", org_name="Reader Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=owner_org.id,
        is_global=False,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="private-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=owner_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_woonvisie_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is None
