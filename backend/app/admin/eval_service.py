"""DeepEval evaluation service for chat conversations.

Runs conversational metrics (ConversationCompleteness, TurnRelevancy,
RoleAdherence) against recent ChatConversation records and stores
per-conversation scores in the metadata_ JSONB column.

Also provides prompt improvement analysis via Claude for failing conversations.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)

# Chatbot role description used for RoleAdherence evaluation
CHATBOT_ROLE = (
    "A helpful Dutch-language property intelligence assistant called Verkenner. "
    "Helps users search properties, understand zoning regulations, analyse building "
    "data, and answer real-estate questions for the Dutch market."
)

EVAL_TIMEOUT_SECONDS = 60
METRIC_THRESHOLD = 0.5


async def evaluate_conversations(
    db: AsyncSession,
    days_back: int = 7,
    limit: int = 20,
) -> dict[str, Any]:
    """Run DeepEval conversational metrics against recent chat conversations.

    Args:
        db: Async database session.
        days_back: Look back window in days from now.
        limit: Maximum number of conversations to evaluate.

    Returns:
        Summary dict with total, passed, failed, errors, and per-conversation results.
    """
    if days_back < 1 or limit < 1:
        return {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "errors": 0,
            "results": [],
        }

    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    stmt = (
        select(ChatConversation)
        .options(selectinload(ChatConversation.messages))
        .where(ChatConversation.last_message_at >= cutoff)
        .order_by(ChatConversation.last_message_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    summary: dict[str, Any] = {
        "total": len(conversations),
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "results": [],
    }

    for conv in conversations:
        conv_result = await _evaluate_single_conversation(conv, db)
        summary["results"].append(conv_result)

        if conv_result["status"] == "error":
            summary["errors"] += 1
        elif conv_result["eval_pass"]:
            summary["passed"] += 1
        else:
            summary["failed"] += 1

    return summary


async def _evaluate_single_conversation(
    conv: ChatConversation,
    db: AsyncSession,
) -> dict[str, Any]:
    """Evaluate a single conversation against all metrics.

    Stores results in conv.metadata_ and returns a result dict.
    """
    conv_id = str(conv.id)
    messages: list[ChatMessage] = list(conv.messages)

    # Skip conversations with fewer than 2 messages or no assistant turns
    if len(messages) < 2:
        logger.info("Skipping conversation %s: fewer than 2 messages", conv_id)
        return {
            "conversation_id": conv_id,
            "status": "skipped",
            "eval_pass": False,
            "scores": {},
            "reason": "fewer than 2 messages",
        }

    has_assistant = any(m.role == "assistant" for m in messages)
    if not has_assistant:
        logger.info("Skipping conversation %s: no assistant turns", conv_id)
        return {
            "conversation_id": conv_id,
            "status": "skipped",
            "eval_pass": False,
            "scores": {},
            "reason": "no assistant turns",
        }

    try:
        scores = await asyncio.wait_for(
            asyncio.to_thread(_run_metrics_sync, messages),
            timeout=EVAL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Evaluation timed out for conversation %s", conv_id)
        return {
            "conversation_id": conv_id,
            "status": "error",
            "eval_pass": False,
            "scores": {},
            "reason": "evaluation timed out",
        }
    except Exception:
        logger.exception("Evaluation failed for conversation %s", conv_id)
        return {
            "conversation_id": conv_id,
            "status": "error",
            "eval_pass": False,
            "scores": {},
            "reason": "evaluation exception",
        }

    eval_pass = all(v >= METRIC_THRESHOLD for v in scores.values())
    eval_at = datetime.now(timezone.utc).isoformat()

    # Persist to metadata_ JSONB
    existing_meta = conv.metadata_ or {}
    existing_meta["eval_scores"] = scores
    existing_meta["eval_pass"] = eval_pass
    existing_meta["eval_at"] = eval_at
    conv.metadata_ = existing_meta
    await db.commit()

    return {
        "conversation_id": conv_id,
        "status": "evaluated",
        "eval_pass": eval_pass,
        "scores": scores,
    }


def _run_metrics_sync(messages: list[ChatMessage]) -> dict[str, float]:
    """Run DeepEval metrics synchronously (called via asyncio.to_thread).

    Returns dict mapping metric name → score (0.0–1.0).
    """
    from deepeval.metrics import (
        ConversationCompletenessMetric,
        RoleAdherenceMetric,
        TurnRelevancyMetric,
    )
    from deepeval.test_case import ConversationalTestCase, Turn

    turns = [
        Turn(role=msg.role, content=msg.content)
        for msg in messages
    ]

    test_case = ConversationalTestCase(
        chatbot_role=CHATBOT_ROLE,
        turns=turns,
    )

    metrics = {
        "conversation_completeness": ConversationCompletenessMetric(
            threshold=METRIC_THRESHOLD, async_mode=False
        ),
        "turn_relevancy": TurnRelevancyMetric(
            threshold=METRIC_THRESHOLD, async_mode=False
        ),
        "role_adherence": RoleAdherenceMetric(
            threshold=METRIC_THRESHOLD, async_mode=False
        ),
    }

    scores: dict[str, float] = {}
    for name, metric in metrics.items():
        try:
            metric.measure(test_case)
            scores[name] = metric.score if metric.score is not None else 0.0
        except (ValueError, TypeError) as exc:
            logger.warning("Metric %s failed with %s: %s", name, type(exc).__name__, exc)
            scores[name] = 0.0
        except Exception as exc:
            logger.warning("Metric %s unexpected error: %s", name, exc)
            scores[name] = 0.0

    return scores


# ── Prompt improvement analysis ─────────────────────────────────────


async def analyze_failing_prompts(
    db: AsyncSession,
    limit: int = 10,
) -> dict[str, Any]:
    """Analyze failing conversations via Claude and suggest prompt improvements.

    Queries conversations where eval_pass is false, sends transcripts plus the
    current CHAT_INTENT_CLASSIFIER_PROMPT to Claude, and returns structured
    improvement suggestions.

    Args:
        db: Async database session.
        limit: Maximum failing conversations to analyze (1–20).

    Returns:
        Dict with suggestions list, analyzed_count, and prompt_analyzed name.
    """
    limit = max(1, min(limit, 20))

    # Query conversations that failed evaluation
    stmt = (
        select(ChatConversation)
        .options(selectinload(ChatConversation.messages))
        .where(
            ChatConversation.metadata_.has_key("eval_scores"),
            ChatConversation.metadata_["eval_pass"].astext == "false",
        )
        .order_by(ChatConversation.last_message_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    if not conversations:
        logger.info("No failing conversations found for prompt improvement analysis")
        return {
            "suggestions": [],
            "analyzed_count": 0,
            "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
        }

    # Build transcript text for each failing conversation
    transcripts: list[dict[str, Any]] = []
    for conv in conversations:
        messages = sorted(conv.messages, key=lambda m: m.created_at or datetime.min)
        turns = []
        for msg in messages:
            if msg.content:
                turns.append({"role": msg.role, "content": msg.content})
        if turns:
            transcripts.append({
                "conversation_id": str(conv.id),
                "eval_scores": (conv.metadata_ or {}).get("eval_scores", {}),
                "turns": turns,
            })

    if not transcripts:
        logger.info("Failing conversations had no message content")
        return {
            "suggestions": [],
            "analyzed_count": 0,
            "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
        }

    # Build the Claude request
    from app.ai.claude_client import create_chat_claude_client
    from app.ai.prompts import (
        CHAT_INTENT_CLASSIFIER_PROMPT,
        PROMPT_IMPROVEMENT_ANALYSIS_PROMPT,
    )

    user_message = (
        f"## Huidige prompt\n\n{CHAT_INTENT_CLASSIFIER_PROMPT}\n\n"
        f"## Gefaalde conversaties ({len(transcripts)} stuks)\n\n"
        f"{json.dumps(transcripts, ensure_ascii=False, indent=2)}"
    )

    try:
        client = create_chat_claude_client()
        t0 = time.monotonic()
        response = await client.client.messages.create(
            model=client.model,
            max_tokens=4000,
            system=PROMPT_IMPROVEMENT_ANALYSIS_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        duration_ms = int((time.monotonic() - t0) * 1000)

        # Usage logging
        from app.ai.usage_logger import log_ai_usage

        await log_ai_usage(
            call_site="prompt_improvement_analysis",
            model=client.model,
            usage=response.usage,
            duration_ms=duration_ms,
        )

        # Extract text content
        text_content = None
        for block in response.content:
            if block.type == "text":
                text_content = block.text
                break

        if not text_content:
            logger.warning("Claude returned empty response for prompt improvement")
            return {
                "error": "Claude returned empty response",
                "suggestions": [],
                "analyzed_count": len(transcripts),
                "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
            }

        # Strip markdown fences
        json_text = text_content.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.startswith("```"):
            json_text = json_text[3:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()

        parsed = json.loads(json_text)
        suggestions = parsed.get("suggestions", [])

        logger.info(
            "Prompt improvement analysis complete: %d suggestions from %d conversations",
            len(suggestions),
            len(transcripts),
        )

        return {
            "suggestions": suggestions,
            "analyzed_count": len(transcripts),
            "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
        }

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse Claude JSON response for prompt improvement: %s", e)
        return {
            "error": f"Failed to parse Claude response: {e}",
            "suggestions": [],
            "analyzed_count": len(transcripts),
            "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
        }
    except Exception as e:
        logger.exception("Prompt improvement analysis failed: %s", e)
        return {
            "error": f"Analysis failed: {e}",
            "suggestions": [],
            "analyzed_count": len(transcripts),
            "prompt_analyzed": "CHAT_INTENT_CLASSIFIER_PROMPT",
        }
