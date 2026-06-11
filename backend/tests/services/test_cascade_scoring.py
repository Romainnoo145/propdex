"""Unit tests for the shared cascade-scoring service (M053/S10)."""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.services.cascade_scoring import load_gemeente_cascade_payloads


@pytest.mark.asyncio
async def test_load_payloads_returns_woonvisie_when_cached(
    create_test_user,
    test_db: AsyncSession,
):
    """A cached woonvisie_match extraction must be returned in the payloads dict."""
    from app.ai.factors.woonvisie_match import WoonvisiePayload

    user, org = await create_test_user()

    doc = PolicyDocument(
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.flush()

    payload_obj = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        confidence=0.9,
    )

    test_db.add(
        FactorExtractionCache(
            policy_document_id=doc.id,
            parcel_id=DOCUMENT_SENTINEL,
            factor_id="woonvisie_match",
            schema_version=SCHEMA_VERSION,
            extracted_payload=payload_obj.model_dump(),
        )
    )
    await test_db.commit()

    payloads = await load_gemeente_cascade_payloads(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert "woonvisie_match" in payloads
    assert isinstance(payloads["woonvisie_match"], WoonvisiePayload)
    assert payloads["woonvisie_match"].periode_start == 2025


@pytest.mark.asyncio
async def test_load_payloads_empty_when_no_document(
    create_test_user,
    test_db: AsyncSession,
):
    """When no policy document exists for the gemeente, return empty dict."""
    _user, org = await create_test_user(
        email="other@example.com", org_name="Other Org"
    )

    payloads = await load_gemeente_cascade_payloads(
        test_db, gemeente_code="GM9999", organization_id=org.id
    )
    assert payloads == {}
