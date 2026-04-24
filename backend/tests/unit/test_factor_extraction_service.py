"""Unit tests voor version-aware cache rejection + document sentinel in factor_extraction_service.

TEST-01 (M048/Phase 1): Bewijst dat SCHEMA_VERSION-bump van 1→2 cache-entries
met version=1 als miss behandelt en entries met huidige versie als hit. De
WHERE-clause in _get_cache_hit() is het mechanisme.

TEST-05 (M048/Phase 5): Bewijst dat DOCUMENT_SENTINEL exact 1 Claude-call
oplevert voor N parcel-scans van dezelfde document+factor, én dat v2
parcel-keyed entries na de 2→3 bump als miss worden behandeld.
"""

import uuid

import pytest
from pydantic import BaseModel, Field

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
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
async def test_current_version_cache_entry_is_hit(test_db, create_test_user):
    """Cache entry met schema_version == SCHEMA_VERSION geeft de row terug.

    CACHE-01 / TEST-01: Bewijst dat de WHERE-clause in _get_cache_hit()
    huidige entries correct serveert. Version-agnostic — werkt op elke
    SCHEMA_VERSION zonder edit.
    """
    doc = await _seed_policy_document(test_db, create_test_user)
    parcel = "NL.IMBAG.Pand.0983100000000092"
    factor = "woonvisie_match"

    current_row = FactorExtractionCache(
        parcel_id=parcel,
        policy_document_id=doc.id,
        factor_id=factor,
        schema_version=SCHEMA_VERSION,
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

    assert result is not None, "huidige-versie entry MOET als cache-hit worden teruggegeven"
    assert result.schema_version == SCHEMA_VERSION


@pytest.mark.asyncio
async def test_v2_cache_entry_is_miss_after_bump_to_v3(test_db, create_test_user):
    """TEST-05: pre-M048/Phase 5 v2 entries (parcel-keyed) zijn cache-miss na elke bump >= 3.

    Bewijst dat bestaande parcel-keyed v2 rows automatisch als miss worden
    behandeld bij lookup met SCHEMA_VERSION >= 3 — geen DB-migratie of cleanup
    nodig. Version-agnostic: werkt ook na Phase-6 bump (v3->v4) en verdere bumps.
    """
    assert SCHEMA_VERSION >= 3, f"Test only valid at SCHEMA_VERSION>=3, got {SCHEMA_VERSION}"

    doc = await _seed_policy_document(test_db, create_test_user)

    # Stale v2 entry — parcel-keyed (pre-sentinel era)
    stale = FactorExtractionCache(
        parcel_id="NL.IMBAG.Pand.0983100000000091",
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
        schema_version=2,
        extracted_payload={
            "periode_start": 2020,
            "periode_einde": 2025,
            "prioritized_segment": "sociaal",
            "growth_wijken": [],
            "confidence": 0.9,
        },
    )
    test_db.add(stale)
    await test_db.commit()

    # Lookup with sentinel + current SCHEMA_VERSION=3 → miss
    # (different parcel_id AND different schema_version — doubly invalidated)
    result = await _get_cache_hit(
        test_db,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
    )
    assert result is None, "v2 parcel-keyed entry mag NIET als cache-hit onder SCHEMA_VERSION=3"


@pytest.mark.asyncio
async def test_v3_cache_entry_is_miss_after_bump_to_v4(test_db, create_test_user) -> None:
    """M048/Phase 6: pre-bump v3 entries (old woonvisie payload shape) are cache-miss after bump to v4.

    Mirrors test_v2_cache_entry_is_miss_after_bump_to_v3 (Phase 5 pattern).
    """
    assert SCHEMA_VERSION >= 4, f"Test only valid at SCHEMA_VERSION>=4, got {SCHEMA_VERSION}"

    doc = await _seed_policy_document(test_db, create_test_user)
    stale = FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
        schema_version=3,
        extracted_payload={
            "periode_start": 2020,
            "periode_einde": 2025,
            "prioritized_segment": "sociaal",
            "growth_wijken": ["Blerick"],
            "confidence": 0.9,
        },
    )
    test_db.add(stale)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
    )
    assert result is None, "v3 cache entry must be a miss after bump to v4"


@pytest.mark.asyncio
async def test_document_sentinel_one_claude_call_for_two_parcels(test_db, create_test_user):
    """TEST-05: 2 extract_factor calls met DOCUMENT_SENTINEL → exact 1 Claude call.

    Success criterion #3: 2 sequentiële scans tegen dezelfde woonvisie
    resulteren in exact 1 Claude-call (tweede is cache-hit).
    """
    from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
    from app.services.factor_extraction_service import extract_factor
    from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response

    doc = await _seed_policy_document(test_db, create_test_user)

    fixed_payload = {
        "periode_start": 2025,
        "periode_einde": 2030,
        "prioritized_segment": "sociaal",
        "growth_wijken": ["Blerick"],
        "confidence": 0.9,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name="extract_woonvisie_match",
            tool_input=fixed_payload,
        )
    )

    # First call — cache miss, fires Claude
    result_a = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert result_a.from_cache is False
    assert mock_client.messages.create.call_count == 1

    # Second call — same sentinel, same doc → cache hit, NO new Claude call
    result_b = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert result_b.from_cache is True
    assert mock_client.messages.create.call_count == 1  # KEY: still 1
    assert result_b.payload.model_dump() == result_a.payload.model_dump()
