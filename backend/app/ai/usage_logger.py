"""Fire-and-forget AI usage logging for all Claude API call sites.

Logs token counts, estimated cost, and timing to the ai_usage_log table.
Never raises — all errors are caught and logged to stderr.
"""

import logging
import uuid as _uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (USD) — Claude claude-sonnet-4-5-20250929
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-sonnet-4-5-20250929": {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_creation": 3.75,
    },
}

# Fallback: zero cost for unknown models
_ZERO_PRICING = {"input": 0.0, "output": 0.0, "cache_read": 0.0, "cache_creation": 0.0}


def _compute_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation_input_tokens: int,
    cache_read_input_tokens: int,
) -> float:
    """Compute estimated cost in USD from token counts and model pricing."""
    pricing = MODEL_PRICING.get(model, _ZERO_PRICING)
    cost = (
        (input_tokens / 1_000_000) * pricing["input"]
        + (output_tokens / 1_000_000) * pricing["output"]
        + (cache_read_input_tokens / 1_000_000) * pricing["cache_read"]
        + (cache_creation_input_tokens / 1_000_000) * pricing["cache_creation"]
    )
    return round(cost, 6)


async def log_ai_usage(
    *,
    call_site: str,
    model: str,
    usage: Any,
    duration_ms: int | None = None,
    error: str | None = None,
    user_id: _uuid.UUID | None = None,
    organization_id: _uuid.UUID | None = None,
    db: AsyncSession | None = None,
) -> None:
    """Log an AI API call to the ai_usage_log table. Fire-and-forget.

    Args:
        call_site: Identifier for the code path (e.g. 'bestemmingsplan_parsing')
        model: Model identifier (e.g. 'claude-sonnet-4-5-20250929')
        usage: Anthropic Usage object (has input_tokens, output_tokens, etc.)
        duration_ms: Wall-clock time of the API call in milliseconds
        error: Error message if the call failed
        user_id: Optional user UUID for attribution
        organization_id: Optional org UUID for tenant attribution
        db: Optional existing session. If None, creates a standalone session.
    """
    try:
        from app.models.ai_usage_log import AIUsageLog

        # Extract token counts safely — handle missing fields
        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        total_tokens = input_tokens + output_tokens

        estimated_cost = _compute_cost(
            model, input_tokens, output_tokens, cache_creation, cache_read
        )

        row = AIUsageLog(
            call_site=call_site,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_input_tokens=cache_creation if cache_creation else None,
            cache_read_input_tokens=cache_read if cache_read else None,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            user_id=user_id,
            organization_id=organization_id,
            duration_ms=duration_ms,
            error=error,
        )

        if db is not None:
            db.add(row)
            await db.flush()
        else:
            # Standalone session — create, commit, close
            from app.core.database import async_session_factory

            async with async_session_factory() as standalone:
                standalone.add(row)
                await standalone.commit()

        logger.debug(
            "Logged AI usage: site=%s model=%s tokens=%d cost=$%.4f",
            call_site, model, total_tokens, estimated_cost,
        )

    except Exception:
        logger.error("Failed to log AI usage for call_site=%s", call_site, exc_info=True)
