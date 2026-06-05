"""Per-factor typed extraction via Anthropic tool-use (M047/S04).

Architecture:
- create_claude_client() factory (routes OpenRouter vs direct Anthropic)
- Force tool_use via tool_choice={"type": "tool", "name": tool_name}
- temperature=0 for determinism
- ephemeral cache_control on PDF block (Anthropic prompt-caching, 5min TTL)
- Pydantic-validate tool_use.input against caller-provided payload_model
- On validation failure: raise FactorExtractionError (no silent default-pass)

This is the first Anthropic tool-use code in the codebase — existing
claude_client.py uses text prompting + JSON markdown parsing (see parse_bestemmingsplan).
Tool-use is cleaner: Claude returns a dict directly in response.content[block].input,
no markdown stripping, no brace-depth counting.

Cache layer lives in factor_extraction_service (T05). This module exposes the
live-call path; T05 wraps it with cache-check-then-call-then-write logic.
"""

import base64
import logging
import time
from datetime import datetime
from typing import Any, TypeVar

from anthropic import AsyncAnthropic
from pydantic import BaseModel, ValidationError

from app.ai.claude_client import create_claude_client
from app.ai.factor_extraction_schemas import (
    SCHEMA_VERSION,
    ExtractedFactor,
    FactorDefinition,
    FactorExtractionError,
)
from app.models.policy_document import PolicyDocument

logger = logging.getLogger(__name__)

PayloadT = TypeVar("PayloadT", bound=BaseModel)

# Iron-rule knobs — changes require schema-version bump and cache-invalidation.
_TEMPERATURE: float = 0.0
_MAX_TOKENS: int = 4096


async def extract_factor_live(
    *,
    factor_def: FactorDefinition[PayloadT],
    parcel_id: str,
    policy_document: PolicyDocument,
    claude_client: AsyncAnthropic | None = None,
) -> ExtractedFactor[PayloadT]:
    """Live Claude-call, no cache. T05 wraps this with caching.

    Args:
        factor_def: FactorDefinition with tool-schema + payload-validator
        parcel_id: opaque BAG/Kadaster string, included in user message for context
        policy_document: PolicyDocument row with file_data (PDF bytes)
        claude_client: optional override for tests (mock injection).
            Default: create_claude_client().client

    Returns:
        ExtractedFactor with from_cache=False.

    Raises:
        FactorExtractionError: Every failure path, with error_code from ERROR_CODES.
    """
    if not policy_document.file_data:
        raise FactorExtractionError(
            "DOCUMENT_MISSING",
            f"PolicyDocument {policy_document.id} has no file_data (PDF bytes)",
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
        )

    if claude_client is None:
        wrapper = create_claude_client()
        client = wrapper.client
        model = wrapper.model
    else:
        client = claude_client
        from app.core.config import settings
        model = settings.AI_MODEL

    file_data = policy_document.file_data
    if file_data[:5] == b"%PDF-":
        pdf_base64 = base64.standard_b64encode(file_data).decode("utf-8")
        doc_block: dict[str, Any] = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_base64},
            "cache_control": {"type": "ephemeral"},
        }
    else:
        text = file_data.decode("utf-8", errors="replace")
        doc_block = {
            "type": "text",
            "text": f'<beleidsdocument filename="{policy_document.filename}">\n{text}\n</beleidsdocument>',
            "cache_control": {"type": "ephemeral"},
        }

    system_text = (
        f"Je extraheert gestructureerde data uit een beleidsdocument voor factor "
        f"'{factor_def.factor_id}'. Gebruik uitsluitend het meegeleverde tool; "
        f"geef GEEN tekstueel antwoord. Als het document onvoldoende informatie bevat, "
        f"retourneer default-waardes zoals gedefinieerd in het input_schema."
    )
    user_instructions = (
        f"Perceel context: {parcel_id}\n"
        f"Document-context: {policy_document.filename}\n\n"
        f"{factor_def.prompt_instructions}"
    )

    try:
        t0 = time.monotonic()
        response = await client.messages.create(  # type: ignore[call-overload]
            model=model,
            max_tokens=_MAX_TOKENS,
            temperature=_TEMPERATURE,
            system=[
                {
                    "type": "text",
                    "text": system_text,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=[
                {
                    "name": factor_def.tool_name,
                    "description": factor_def.description,
                    "input_schema": factor_def.input_schema,
                }
            ],
            tool_choice={"type": "tool", "name": factor_def.tool_name},
            messages=[
                {
                    "role": "user",
                    "content": [
                        doc_block,
                        {"type": "text", "text": user_instructions},
                    ],
                }
            ],
        )
        duration_ms = int((time.monotonic() - t0) * 1000)
    except Exception as exc:
        raise FactorExtractionError(
            "CLAUDE_API_ERROR",
            f"Claude API call failed: {exc}",
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
        ) from exc

    try:
        from app.ai.usage_logger import log_ai_usage
        await log_ai_usage(
            call_site=f"factor_extract:{factor_def.factor_id}",
            model=model,
            usage=response.usage,
            duration_ms=duration_ms,
        )
    except Exception:
        logger.exception("log_ai_usage failed (non-fatal)")

    if not response.content:
        raise FactorExtractionError(
            "EMPTY_RESPONSE",
            "Claude returned response with empty content list.",
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
        )

    tool_use_block = None
    for block in response.content:
        if block.type == "tool_use" and block.name == factor_def.tool_name:
            tool_use_block = block
            break

    if tool_use_block is None:
        block_types = [b.type for b in response.content]
        snippet = str(block_types)[:200]
        raise FactorExtractionError(
            "NO_TOOL_USE_BLOCK",
            f"Expected tool_use block '{factor_def.tool_name}', got blocks: {block_types}",
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
            claude_response_snippet=snippet,
        )

    try:
        payload = factor_def.payload_model.model_validate(tool_use_block.input)
    except ValidationError as exc:
        snippet = str(tool_use_block.input)[:500]
        raise FactorExtractionError(
            "SCHEMA_VALIDATION_FAILED",
            f"Claude tool_use.input failed {factor_def.payload_model.__name__} "
            f"validation: {exc}",
            factor_id=factor_def.factor_id,
            parcel_id=parcel_id,
            policy_document_id=str(policy_document.id),
            claude_response_snippet=snippet,
        ) from exc

    return ExtractedFactor[PayloadT](
        factor_id=factor_def.factor_id,
        parcel_id=parcel_id,
        policy_document_id=str(policy_document.id),
        payload=payload,
        extracted_at=datetime.utcnow(),
        from_cache=False,
        schema_version=SCHEMA_VERSION,
    )
