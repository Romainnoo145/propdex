"""Core agentic loop service for the Propdex Verkenner.

Implements a Claude tool-calling loop that:
1. Sends the user message + system prompt + tool definitions to Claude
2. If Claude requests tool calls, executes them and feeds results back
3. Repeats until Claude produces a final text response or MAX_TOOL_ROUNDS is hit
"""

import logging
import time
import uuid as _uuid
from datetime import datetime, timezone

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_prompts import AGENT_SYSTEM_PROMPT
from app.agents.agent_schemas import AgentRequest, AgentResponse
from app.agents.agent_tools import AGENT_TOOLS, execute_tool
from app.ai.claude_client import create_chat_claude_client
from app.ai.usage_logger import log_ai_usage
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 10
"""Safety limit to prevent infinite tool-calling loops."""


async def _load_conversation_history(
    db: AsyncSession,
    user_id: str,
    conversation_id: str | None,
) -> list[dict]:
    """Load historical user/assistant messages for multi-turn context.

    Validates conversation_id format and ownership before querying.
    Returns a list of {"role": ..., "content": ...} dicts ordered by created_at.
    """
    if conversation_id is None:
        return []

    # Validate UUID format
    try:
        cid = _uuid.UUID(conversation_id)
    except (ValueError, AttributeError):
        logger.warning("Invalid conversation_id format '%s', skipping history", conversation_id)
        return []

    try:
        uid = _uuid.UUID(user_id)

        # Verify ownership
        result = await db.execute(
            select(ChatConversation).where(
                ChatConversation.id == cid,
                ChatConversation.user_id == uid,
            )
        )
        convo = result.scalar_one_or_none()
        if convo is None:
            logger.warning(
                "conversation_id %s not found or not owned by user %s",
                conversation_id, user_id,
            )
            return []

        # Load messages ordered by created_at
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == cid)
            .order_by(ChatMessage.created_at.asc())
        )
        rows = result.scalars().all()

        history = []
        for msg in rows:
            if msg.role in ("user", "assistant"):
                history.append({"role": msg.role, "content": msg.content})

        logger.debug(
            "Loaded %d history messages for conversation %s", len(history), cid
        )
        return history

    except Exception:
        logger.warning("Failed to load conversation history", exc_info=True)
        return []


async def _persist_agent_turn(
    db: AsyncSession,
    user_id: str,
    conversation_id: str | None,
    user_message: str,
    assistant_message: str,
    tool_calls_made: list[str],
    duration_ms: int,
) -> str | None:
    """Persist user + assistant messages to chat_conversations/chat_messages.

    Fire-and-forget: never raises. Returns conversation_id on success, None on failure.
    """
    try:
        uid = _uuid.UUID(user_id)
        now = datetime.now(timezone.utc)
        cid = None

        # Resolve or create conversation
        if conversation_id is not None:
            try:
                cid = _uuid.UUID(conversation_id)
            except (ValueError, AttributeError):
                logger.warning("Invalid conversation_id format '%s', creating new", conversation_id)
                cid = None

            if cid is not None:
                result = await db.execute(
                    select(ChatConversation).where(
                        ChatConversation.id == cid,
                        ChatConversation.user_id == uid,
                    )
                )
                convo = result.scalar_one_or_none()
                if convo is None:
                    logger.warning(
                        "conversation_id %s not found or not owned by user %s, creating new",
                        conversation_id, user_id,
                    )
                    cid = None
                else:
                    convo.last_message_at = now
                    convo.message_count = (convo.message_count or 0) + 2

        if cid is None:
            convo = ChatConversation(
                user_id=uid,
                started_at=now,
                last_message_at=now,
                message_count=2,
            )
            db.add(convo)
            await db.flush()
            cid = convo.id

        # Insert user message
        db.add(ChatMessage(
            conversation_id=cid,
            role="user",
            content=user_message,
        ))

        # Insert assistant message
        db.add(ChatMessage(
            conversation_id=cid,
            role="assistant",
            content=assistant_message,
            params={"tool_calls": tool_calls_made} if tool_calls_made else None,
            duration_ms=duration_ms,
        ))

        await db.flush()
        logger.debug("Persisted agent turn to conversation %s", cid)
        return str(cid)

    except Exception:
        logger.warning("Failed to persist agent turn", exc_info=True)
        return None


async def agent_chat(
    request: AgentRequest,
    db: AsyncSession,
    user_id: str,
) -> AgentResponse:
    """Run the agentic tool-calling loop for a single user turn.

    Args:
        request: Incoming user message and optional conversation_id.
        db: Async database session for tool queries.
        user_id: UUID string of the authenticated user.

    Returns:
        AgentResponse with the agent's Dutch reply and metadata.
    """
    try:
        t0_total = time.monotonic()
        client = create_chat_claude_client()

        # Load conversation history for multi-turn context
        history = await _load_conversation_history(db, user_id, request.conversation_id)
        messages: list[dict] = history + [{"role": "user", "content": request.message}]
        tool_calls_made: list[str] = []

        response = None  # will hold the latest Claude response

        for _round in range(MAX_TOOL_ROUNDS):
            t0 = time.monotonic()
            response = await client.client.messages.create(
                model=client.model,
                system=AGENT_SYSTEM_PROMPT,
                messages=messages,
                tools=AGENT_TOOLS,
                max_tokens=4096,
            )
            duration_ms = int((time.monotonic() - t0) * 1000)

            # Fire-and-forget usage logging
            await log_ai_usage(
                call_site="agent_chat",
                model=client.model,
                usage=response.usage,
                duration_ms=duration_ms,
            )

            logger.info(
                "agent_chat round=%d stop_reason=%s tools_in_response=%d duration=%dms",
                _round,
                response.stop_reason,
                sum(1 for b in response.content if b.type == "tool_use"),
                duration_ms,
            )

            # If Claude finished (no more tool calls), break
            if response.stop_reason != "tool_use":
                break

            # Extract tool_use blocks and execute each tool
            tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
            tool_results = []

            for block in tool_use_blocks:
                tool_calls_made.append(block.name)
                try:
                    result_str = await execute_tool(
                        block.name, block.input, db, user_id
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result_str,
                        }
                    )
                except Exception as exc:
                    logger.error(
                        "Tool execution failed: tool=%s error=%s",
                        block.name,
                        exc,
                        exc_info=True,
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": f'{{"error": "Tool {block.name} mislukt: {exc}"}}',
                            "is_error": True,
                        }
                    )

            # Append the assistant turn (Claude's content with tool_use blocks)
            # and the tool results as a user turn
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        # Extract final text and citation sources from Claude's last response
        reply_text, sources = _extract_response(response) if response else ("", [])

        if not reply_text:
            reply_text = (
                "Ik kon geen antwoord genereren. Probeer het opnieuw "
                "of stel een andere vraag."
            )

        # Persist turn (fire-and-forget) and get conversation_id
        total_duration_ms = int((time.monotonic() - t0_total) * 1000)
        conv_id = await _persist_agent_turn(
            db, user_id, request.conversation_id,
            request.message, reply_text, tool_calls_made, total_duration_ms,
        )

        return AgentResponse(
            message=reply_text,
            conversation_id=conv_id or request.conversation_id,
            tool_calls_made=tool_calls_made,
            sources=sources,
        )

    except anthropic.APIConnectionError as exc:
        logger.error("Claude API connection error: %s", exc)
        return AgentResponse(
            message="De AI-service is momenteel niet bereikbaar. Probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )
    except anthropic.RateLimitError as exc:
        logger.warning("Claude API rate limit: %s", exc)
        return AgentResponse(
            message="De AI-service is tijdelijk overbelast. Probeer het over een minuut opnieuw.",
            conversation_id=request.conversation_id,
        )
    except anthropic.APIStatusError as exc:
        logger.error("Claude API status error: status=%s error=%s", exc.status_code, exc)
        return AgentResponse(
            message="De AI-service reageert niet, probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )
    except Exception as exc:
        logger.exception("Unexpected error in agent_chat: %s", exc)
        return AgentResponse(
            message="Er is een onverwachte fout opgetreden. Probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )


def _extract_response(response: anthropic.types.Message) -> tuple[str, list[dict]]:
    """Extract text and web-search citation sources from a Claude response.

    Returns:
        (text, sources) where sources is a list of citation dicts with
        url, title, and cited_text keys.
    """
    parts: list[str] = []
    seen_urls: set[str] = set()
    sources: list[dict] = []

    for block in response.content:
        if block.type == "text":
            parts.append(block.text)
            # Extract citations attached to this TextBlock (web_search tool)
            for citation in getattr(block, "citations", None) or []:
                url = getattr(citation, "url", None) or getattr(citation, "source", {}).get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                sources.append({
                    "url": url,
                    "title": getattr(citation, "title", None) or "",
                    "cited_text": getattr(citation, "cited_text", None) or "",
                })

    return "\n\n".join(parts), sources
