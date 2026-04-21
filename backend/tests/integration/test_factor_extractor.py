"""End-to-end integration tests for factor-extraction pipeline (M047/S04).

Covers the 3 roadmap tests explicitly:
1. Determinism: same input (mocked Claude with fixed response) 3x → same output
2. Cache-hit: 2nd call with same key hits cache, no 2nd Claude-call
3. Schema-validation: non-conform input → FactorExtractionError, no silent pass
"""

import uuid

import pytest
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.ai.factor_extraction_schemas import (
    SCHEMA_VERSION,
    FactorDefinition,
    FactorExtractionError,
)
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor
from tests.ai_mocks import (
    make_empty_response,
    make_mock_anthropic_client,
    make_text_only_response,
    make_tool_use_response,
)


class WoonvisieSamplePayload(BaseModel):
    """Representative Pydantic schema for tests (matches S06's real woonvisie_match shape)."""

    prioritized_segment: str = Field(pattern=r"^(sociaal|midden|duur|gemengd)$")
    growth_wijken: list[str]
    shrink_wijken: list[str] = Field(default_factory=list)
    excluded_project_types: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


def _make_factor_def() -> FactorDefinition[WoonvisieSamplePayload]:
    return FactorDefinition[WoonvisieSamplePayload](
        factor_id="woonvisie_match_test",
        tool_name="extract_woonvisie_match_test",
        description=(
            "Extraheer woonvisie-signalen: prioritair segment, groei- en krimp-"
            "wijken, expliciet uitgesloten projecttypen."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "prioritized_segment": {
                    "type": "string",
                    "enum": ["sociaal", "midden", "duur", "gemengd"],
                },
                "growth_wijken": {"type": "array", "items": {"type": "string"}},
                "shrink_wijken": {"type": "array", "items": {"type": "string"}},
                "excluded_project_types": {"type": "array", "items": {"type": "string"}},
                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
            },
            "required": ["prioritized_segment", "growth_wijken", "confidence"],
        },
        payload_model=WoonvisieSamplePayload,
        prompt_instructions="Lees de woonvisie en retourneer de gestructureerde samenvatting.",
    )


async def _seed_policy_document(
    test_db,
    create_test_user,
    *,
    filename: str = "woonvisie_venlo_2030.pdf",
    file_data: bytes = b"%PDF-1.4\n%fake-bytes-for-test\n%%EOF",
) -> tuple[PolicyDocument, object, object]:
    """Seed policy_document with ALL required NOT NULL fields.

    B2 fix: PolicyDocument requires filename, content_type, file_size,
    uploaded_by_user_id, organization_id (via TenantMixin). `title` does NOT exist.
    """
    user, org = await create_test_user()
    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="0983",
        source_key="woonvisie_test",
        filename=filename,
        content_type="application/pdf",
        file_data=file_data,
        file_size=len(file_data),
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)
    return doc, user, org


@pytest.mark.asyncio
async def test_determinism_three_calls_same_output(test_db, create_test_user):
    """3 consecutive calls with identical mocked response → byte-identical payload.

    Roadmap test 1: "same input (parcel + doc + factor_id) yields same extraction-JSON 3x".
    force_refresh=True bypasses cache to validate the pure-API determinism path.
    """
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()

    fixed_payload = {
        "prioritized_segment": "sociaal",
        "growth_wijken": ["Q4", "Blerick-Oost"],
        "shrink_wijken": [],
        "excluded_project_types": ["luxe_villa"],
        "confidence": 0.87,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name=defn.tool_name,
            tool_input=fixed_payload,
        )
    )

    results = []
    for _ in range(3):
        result = await extract_factor(
            test_db,
            factor_def=defn,
            parcel_id="NL.IMBAG.Pand.0983100000000001",
            policy_document=doc,
            claude_client=mock_client,
            force_refresh=True,
        )
        results.append(result)

    assert all(r.payload.model_dump() == results[0].payload.model_dump() for r in results)
    assert mock_client.messages.create.call_count == 3
    for call in mock_client.messages.create.call_args_list:
        assert call.kwargs["temperature"] == 0.0
        assert call.kwargs["tool_choice"] == {
            "type": "tool",
            "name": "extract_woonvisie_match_test",
        }


@pytest.mark.asyncio
async def test_cache_hit_second_call_no_claude(test_db, create_test_user):
    """2nd call with same key → cache-hit, no Claude-call.

    Roadmap test 2: "cache-hit path works (2nd call hits cache, no Claude-call)".
    """
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()
    parcel = "NL.IMBAG.Pand.0983100000000002"

    fixed_payload = {
        "prioritized_segment": "midden",
        "growth_wijken": ["Centrum"],
        "confidence": 0.75,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name=defn.tool_name,
            tool_input=fixed_payload,
        )
    )

    first = await extract_factor(
        test_db,
        factor_def=defn,
        parcel_id=parcel,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert first.from_cache is False
    assert mock_client.messages.create.call_count == 1

    second = await extract_factor(
        test_db,
        factor_def=defn,
        parcel_id=parcel,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert second.from_cache is True
    assert mock_client.messages.create.call_count == 1  # Still 1!
    assert second.payload.model_dump() == first.payload.model_dump()

    stmt = select(FactorExtractionCache).where(
        FactorExtractionCache.parcel_id == parcel,
        FactorExtractionCache.policy_document_id == doc.id,
        FactorExtractionCache.factor_id == defn.factor_id,
    )
    cached = (await test_db.execute(stmt)).scalar_one()
    assert cached.schema_version == SCHEMA_VERSION
    assert cached.extracted_payload["prioritized_segment"] == "midden"


@pytest.mark.asyncio
async def test_schema_validation_failure_raises(test_db, create_test_user):
    """Non-conform Claude response → FactorExtractionError, no silent pass, no cache-write.

    Roadmap test 3: "schema-validation fails cleanly when Claude returns non-conform JSON".
    """
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()
    parcel = "NL.IMBAG.Pand.0983100000000003"

    invalid_payload = {
        "prioritized_segment": "onbekend_segment",  # Not in enum
        "growth_wijken": ["X"],
        # confidence missing — required
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name=defn.tool_name,
            tool_input=invalid_payload,
        )
    )

    with pytest.raises(FactorExtractionError) as exc_info:
        await extract_factor(
            test_db,
            factor_def=defn,
            parcel_id=parcel,
            policy_document=doc,
            claude_client=mock_client,
        )
    assert exc_info.value.error_code == "SCHEMA_VALIDATION_FAILED"
    assert exc_info.value.factor_id == defn.factor_id
    assert exc_info.value.parcel_id == parcel

    assert mock_client.messages.create.call_count == 1

    stmt = select(FactorExtractionCache).where(
        FactorExtractionCache.parcel_id == parcel,
    )
    cached = (await test_db.execute(stmt)).scalar_one_or_none()
    assert cached is None


@pytest.mark.asyncio
async def test_empty_response_raises_empty_response_error(test_db, create_test_user):
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()
    mock_client = make_mock_anthropic_client(make_empty_response())

    with pytest.raises(FactorExtractionError) as exc_info:
        await extract_factor(
            test_db,
            factor_def=defn,
            parcel_id="NL.IMBAG.Pand.0983100000000004",
            policy_document=doc,
            claude_client=mock_client,
        )
    assert exc_info.value.error_code == "EMPTY_RESPONSE"


@pytest.mark.asyncio
async def test_no_tool_use_block_raises(test_db, create_test_user):
    """Claude ignores tool_choice-forced and returns only text → error."""
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()
    mock_client = make_mock_anthropic_client(
        make_text_only_response("Sorry, dit document kan ik niet analyseren.")
    )

    with pytest.raises(FactorExtractionError) as exc_info:
        await extract_factor(
            test_db,
            factor_def=defn,
            parcel_id="NL.IMBAG.Pand.0983100000000005",
            policy_document=doc,
            claude_client=mock_client,
        )
    assert exc_info.value.error_code == "NO_TOOL_USE_BLOCK"


@pytest.mark.asyncio
async def test_document_missing_raises(test_db, create_test_user):
    """PolicyDocument.file_data = b'' → DOCUMENT_MISSING error, no Claude-call."""
    doc, _user, _org = await _seed_policy_document(
        test_db,
        create_test_user,
        filename="empty_test.pdf",
        file_data=b"",
    )

    defn = _make_factor_def()
    mock_client = make_mock_anthropic_client(None)

    with pytest.raises(FactorExtractionError) as exc_info:
        await extract_factor(
            test_db,
            factor_def=defn,
            parcel_id="NL.IMBAG.Pand.0983100000000006",
            policy_document=doc,
            claude_client=mock_client,
        )
    assert exc_info.value.error_code == "DOCUMENT_MISSING"
    assert mock_client.messages.create.call_count == 0


@pytest.mark.asyncio
async def test_force_refresh_bypasses_cache(test_db, create_test_user):
    """force_refresh=True → Claude-call even on cache-hit."""
    doc, _user, _org = await _seed_policy_document(test_db, create_test_user)
    defn = _make_factor_def()
    parcel = "NL.IMBAG.Pand.0983100000000007"

    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name=defn.tool_name,
            tool_input={
                "prioritized_segment": "duur",
                "growth_wijken": ["VIP"],
                "confidence": 0.99,
            },
        )
    )
    await extract_factor(
        test_db,
        factor_def=defn,
        parcel_id=parcel,
        policy_document=doc,
        claude_client=mock_client,
    )
    result = await extract_factor(
        test_db,
        factor_def=defn,
        parcel_id=parcel,
        policy_document=doc,
        claude_client=mock_client,
        force_refresh=True,
    )
    assert result.from_cache is False
    assert mock_client.messages.create.call_count == 2
