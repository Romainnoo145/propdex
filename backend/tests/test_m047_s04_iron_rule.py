"""M047/S04 iron-rule regression tests.

Concrete guards around the LLM-determinism infrastructure: a change that
silently breaks determinism or schema-enforcement must be immediately visible.
"""

import inspect

import pytest
from pydantic import BaseModel, Field


def test_error_codes_is_exactly_five_values():
    """Iron-rule: extension requires S05-cascade logging update + deliberate review."""
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


def test_temperature_is_zero_iron_rule():
    """Iron-rule: temperature=0 is the determinism guard. Non-zero silently
    introduces non-determinism in scoring."""
    from app.ai import factor_extractor

    assert factor_extractor._TEMPERATURE == 0.0


def test_schema_version_exists_and_is_int():
    """Iron-rule: SCHEMA_VERSION must exist as int. Current value == 3
    after M048/Phase 5 document-level cache sentinel bump (was 2 in Phase 1,
    was 1 at M047/S04 introduction)."""
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION

    assert SCHEMA_VERSION == 3
    assert isinstance(SCHEMA_VERSION, int)


def test_cache_unique_constraint_includes_schema_version():
    """Iron-rule: schema_version MUST be part of the cache-key. Without it,
    schema-bumps would treat stale cache-entries as hits."""
    from sqlalchemy import UniqueConstraint

    from app.models.factor_extraction_cache import FactorExtractionCache

    uqs = [
        c
        for c in FactorExtractionCache.__table__.constraints
        if isinstance(c, UniqueConstraint) and c.name == "uq_factor_extraction_cache_key"
    ]
    assert len(uqs) == 1
    cols = {c.name for c in uqs[0].columns}
    assert cols == {"parcel_id", "policy_document_id", "factor_id", "schema_version"}


def test_alembic_head_past_dd1e956d1300():
    """Iron-rule: S04 migration must chain on S01's head (or higher).

    M2 fix: cwd via __file__ relative path (CI-portable).
    """
    import subprocess
    from pathlib import Path

    backend_dir = Path(__file__).resolve().parent.parent
    result = subprocess.run(
        ["alembic", "history"],
        capture_output=True,
        text=True,
        cwd=str(backend_dir),
    )
    assert "dd1e956d1300" in result.stdout, (
        "S01 head missing from alembic history — S04 is not chained on S01. "
        f"Output: {result.stdout[:500]}"
    )
    current = subprocess.run(
        ["alembic", "current"],
        capture_output=True,
        text=True,
        cwd=str(backend_dir),
    )
    assert "dd1e956d1300 (head)" not in current.stdout, (
        "Head is still on S01 — S04 migration not applied."
    )


@pytest.mark.asyncio
async def test_tool_choice_is_forced_type_tool():
    """Iron-rule: tool_choice must be forced ({"type": "tool", "name": ...}).
    If someone accidentally sets tool_choice="auto", Claude can skip the tool
    → NO_TOOL_USE_BLOCK errors and non-deterministic fallback.
    """
    from app.ai.factor_extraction_schemas import FactorDefinition
    from app.ai.factor_extractor import extract_factor_live
    from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response

    class P(BaseModel):
        x: int = Field(ge=0)

    defn = FactorDefinition[P](
        factor_id="test_irule",
        tool_name="extract_test_irule",
        description="Test factor description voldoet aan min_length=10.",
        input_schema={
            "type": "object",
            "properties": {"x": {"type": "integer", "minimum": 0}},
            "required": ["x"],
        },
        payload_model=P,
        prompt_instructions="Extract x.",
    )
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(tool_name="extract_test_irule", tool_input={"x": 42})
    )

    class _StubDoc:
        id = "01234567-89ab-cdef-0123-456789abcdef"
        file_data = b"%PDF-1.4\n%test\n%%EOF"
        filename = "test_doc.pdf"

    await extract_factor_live(
        factor_def=defn,
        parcel_id="NL.IMBAG.Pand.0983100000000099",
        policy_document=_StubDoc(),  # type: ignore[arg-type]
        claude_client=mock_client,
    )

    assert mock_client.messages.create.call_count == 1
    kwargs = mock_client.messages.create.call_args.kwargs
    assert kwargs["tool_choice"] == {"type": "tool", "name": "extract_test_irule"}
    assert kwargs["temperature"] == 0.0


def test_no_silent_pass_on_validation_failure():
    """Iron-rule: SCHEMA_VALIDATION_FAILED is an explicit error, not a default.
    Guards against a 'helpful' fallback={} being added to the validation-except branch.
    """
    from app.ai.factor_extractor import extract_factor_live

    source = inspect.getsource(extract_factor_live)
    assert "SCHEMA_VALIDATION_FAILED" in source
    # Guard: "raise FactorExtractionError" must appear before "SCHEMA_VALIDATION_FAILED"
    # in the source — proving the raise-not-silent-return pattern is intact.
    sv_idx = source.index("SCHEMA_VALIDATION_FAILED")
    before = source[:sv_idx]
    assert "raise FactorExtractionError" in before, (
        "SCHEMA_VALIDATION_FAILED must be raised via FactorExtractionError, not silently swallowed"
    )
