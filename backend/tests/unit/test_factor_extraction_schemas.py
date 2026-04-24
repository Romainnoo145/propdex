"""Unit tests voor factor-extraction Pydantic schemas (M047/S04 T01).

Tests verifieeren de contract-surface: factor_id pattern, from_cache semantics,
error-code carrier, iron-rule ERROR_CODES frozenset, SCHEMA_VERSION constant.
"""

import pytest
from pydantic import BaseModel, Field, ValidationError


class SampleFactorPayload(BaseModel):
    """Pydantic model gebruikt als payload_model in tests."""

    prioritized_segment: str = Field(pattern=r"^(sociaal|midden|duur|gemengd)$")
    growth_wijken: list[str]
    confidence: float = Field(ge=0.0, le=1.0)


def test_factor_definition_factor_id_pattern_enforced() -> None:
    """factor_id moet snake_case starten met letter (stable cache-key)."""
    from app.ai.factor_extraction_schemas import FactorDefinition

    # Happy path
    defn = FactorDefinition[SampleFactorPayload](
        factor_id="woonvisie_match",
        tool_name="extract_woonvisie_match",
        description="Extract woonvisie-match signalen uit beleidsdocument.",
        input_schema={"type": "object", "properties": {}, "required": []},
        payload_model=SampleFactorPayload,
        prompt_instructions="Analyseer de woonvisie.",
    )
    assert defn.factor_id == "woonvisie_match"

    # Invalid: starts with digit
    with pytest.raises(ValidationError):
        FactorDefinition[SampleFactorPayload](
            factor_id="1woonvisie",
            tool_name="x",
            description="10chars!!",
            input_schema={},
            payload_model=SampleFactorPayload,
            prompt_instructions="x",
        )
    # Invalid: contains hyphen
    with pytest.raises(ValidationError):
        FactorDefinition[SampleFactorPayload](
            factor_id="woon-visie",
            tool_name="x",
            description="10chars!!",
            input_schema={},
            payload_model=SampleFactorPayload,
            prompt_instructions="x",
        )


def test_extracted_factor_from_cache_flag_is_required_semantic() -> None:
    """ExtractedFactor.from_cache moet expliciet gezet worden — defaults op False."""
    from datetime import datetime

    from app.ai.factor_extraction_schemas import ExtractedFactor

    result = ExtractedFactor[SampleFactorPayload](
        factor_id="woonvisie_match",
        parcel_id="NL.IMBAG.Pand.0983100000000001",
        policy_document_id="01234567-89ab-cdef-0123-456789abcdef",
        payload=SampleFactorPayload(
            prioritized_segment="sociaal",
            growth_wijken=["Q4"],
            confidence=0.9,
        ),
        extracted_at=datetime.utcnow(),
        from_cache=False,
    )
    assert result.from_cache is False
    # Version-agnostic: ExtractedFactor.schema_version default tracks SCHEMA_VERSION constant.
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION

    assert result.schema_version == SCHEMA_VERSION


def test_factor_extraction_error_carries_error_code() -> None:
    from app.ai.factor_extraction_schemas import ERROR_CODES, FactorExtractionError

    err = FactorExtractionError(
        "SCHEMA_VALIDATION_FAILED",
        "Payload missing required field 'confidence'",
        factor_id="woonvisie_match",
        parcel_id="NL.IMBAG.Pand.0983100000000002",
        policy_document_id="01234567-89ab-cdef-0123-456789abcdef",
        claude_response_snippet='{"prioritized_segment":"sociaal"}',
    )
    assert err.error_code == "SCHEMA_VALIDATION_FAILED"
    assert err.error_code in ERROR_CODES
    assert "woonvisie_match" in str(err) or err.factor_id == "woonvisie_match"


def test_error_codes_is_exactly_five() -> None:
    """Iron-rule: uitbreiding vereist bewuste beslissing + S05-logging update."""
    from app.ai.factor_extraction_schemas import ERROR_CODES

    assert ERROR_CODES == frozenset(
        {
            "SCHEMA_VALIDATION_FAILED",
            "CLAUDE_API_ERROR",
            "NO_TOOL_USE_BLOCK",
            "EMPTY_RESPONSE",
            "DOCUMENT_MISSING",
        }
    )
    assert len(ERROR_CODES) == 5


def test_schema_version_is_at_least_three() -> None:
    """SCHEMA_VERSION bumped 2→3 in M048/Phase 5; Phase 6 bumps 3→4 for WijkPolicy shape.

    Version-agnostic: any future bump only requires updating the constant, not this test.
    v2 entries (parcel-keyed) become cache-misses and are superseded on next
    access via on_conflict_do_update; no cleanup migration required.
    """
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION

    assert SCHEMA_VERSION >= 3, f"SCHEMA_VERSION regressed below 3: got {SCHEMA_VERSION}"
    assert isinstance(SCHEMA_VERSION, int)


def test_document_sentinel_constant() -> None:
    """DOCUMENT_SENTINEL is the reserved parcel_id for document-level factors.

    Used by cascade_enrichment_service.get_cascade_payloads when the factor
    extracts document-scoped signals (e.g. woonvisie_match) — ensures exactly
    1 Claude call per (policy_document_id, factor_id, SCHEMA_VERSION) tuple.
    """
    from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL

    assert DOCUMENT_SENTINEL == "__document__"
    assert isinstance(DOCUMENT_SENTINEL, str)
    assert len(DOCUMENT_SENTINEL) <= 50  # fits String(50) parcel_id column
