"""Unit tests voor version-aware cache rejection in factor_extraction_service (M048/Phase 1).

TEST-01: Bewijst dat SCHEMA_VERSION-bump van 1→2 cache-entries met version=1
als miss behandelt en entries met version=2 als hit. De WHERE-clause in
_get_cache_hit() is het mechanisme; deze tests bewijzen het contract.
"""

import uuid

import pytest
from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import _get_cache_hit


class _SimplePayload(BaseModel):
    """Minimal payload model voor seeding cache-entries in tests."""

    prioritized_segment: str = Field(pattern=r"^(sociaal|midden|duur|gemengd)$")
    growth_wijken: list[str]
    confidence: float = Field(ge=0.0, le=1.0)


async def _seed_policy_document(test_db, create_test_user) -> PolicyDocument:
    """Seed a minimal PolicyDocument to satisfy the FK on FactorExtractionCache."""
    user, org = await create_test_user()
    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="0983",
        source_key="cache_sentinel_test",
        filename="woonvisie_test.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)
    return doc


@pytest.mark.asyncio
async def test_v1_cache_entry_is_miss(test_db, create_test_user):
    """Cache entry met schema_version=1 geeft None terug wanneer SCHEMA_VERSION==3.

    CACHE-01 / TEST-01: Bewijst dat de WHERE-clause in _get_cache_hit()
    pre-M047 entries correct weigert. Blijft valide na elke SCHEMA_VERSION-bump
    zolang huidige versie > 1.
    """
    assert SCHEMA_VERSION >= 2, f"Test only valid at SCHEMA_VERSION>=2, got {SCHEMA_VERSION}"

    doc = await _seed_policy_document(test_db, create_test_user)
    parcel = "NL.IMBAG.Pand.0983100000000091"
    factor = "woonvisie_match"

    # Directe insert met schema_version=1 (bypasses _write_cache die altijd SCHEMA_VERSION gebruikt)
    stale_row = FactorExtractionCache(
        parcel_id=parcel,
        policy_document_id=doc.id,
        factor_id=factor,
        schema_version=1,
        extracted_payload={
            "prioritized_segment": "sociaal",
            "growth_wijken": [],
            "confidence": 0.9,
        },
    )
    test_db.add(stale_row)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db,
        parcel_id=parcel,
        policy_document_id=doc.id,
        factor_id=factor,
    )

    assert result is None, "v1 entry mag NIET als cache-hit worden teruggegeven"


@pytest.mark.asyncio
async def test_v2_cache_entry_is_hit(test_db, create_test_user):
    """Cache entry met schema_version=2 geeft de row terug wanneer SCHEMA_VERSION==2.

    CACHE-01 / TEST-01: Bewijst dat de WHERE-clause in _get_cache_hit()
    huidige entries correct serveert.
    """
    assert SCHEMA_VERSION == 2, f"Test only valid at SCHEMA_VERSION==2, got {SCHEMA_VERSION}"

    doc = await _seed_policy_document(test_db, create_test_user)
    parcel = "NL.IMBAG.Pand.0983100000000092"
    factor = "woonvisie_match"

    current_row = FactorExtractionCache(
        parcel_id=parcel,
        policy_document_id=doc.id,
        factor_id=factor,
        schema_version=2,
        extracted_payload={
            "prioritized_segment": "midden",
            "growth_wijken": ["Centrum"],
            "confidence": 0.8,
        },
    )
    test_db.add(current_row)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db,
        parcel_id=parcel,
        policy_document_id=doc.id,
        factor_id=factor,
    )

    assert result is not None, "v2 entry MOET als cache-hit worden teruggegeven"
    assert result.schema_version == 2
