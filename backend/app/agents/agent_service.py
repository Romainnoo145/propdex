"""Core agentic loop service for the Propdex Verkenner.

Implements a Gemini tool-calling loop that:
1. Sends the user message + system prompt + tool definitions to Gemini
2. If Gemini requests tool calls, executes them and feeds results back
3. Repeats until Gemini produces a final text response or MAX_TOOL_ROUNDS is hit
"""

import logging
import time
import uuid as _uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone

from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_prompts import AGENT_SYSTEM_PROMPT
from app.core.database import async_session_factory
from app.agents.agent_schemas import AgentRequest, AgentResponse
from app.agents.agent_tools import execute_tool, get_agent_tools
from app.ai.gemini_client import create_gemini_client, get_gemini_model
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


def _history_to_contents(history: list[dict], user_message: str) -> list[types.Content]:
    """Convert DB-stored message dicts into Gemini Content objects.

    Maps role "assistant" → "model" (Gemini convention).
    Appends the current user message at the end.
    """
    contents: list[types.Content] = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )
    contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
    )
    return contents


async def _persist_agent_turn(
    user_id: str,
    conversation_id: str | None,
    user_message: str,
    assistant_message: str,
    tool_calls_made: list[str],
    duration_ms: int,
) -> str | None:
    """Persist user + assistant messages to chat_conversations/chat_messages.

    Creates its own database session via async_session_factory() so persistence
    is independent of the request lifecycle (important for SSE streaming where
    the request-scoped session may be closed before the generator finishes).

    Fire-and-forget: never raises. Returns conversation_id on success, None on failure.
    """
    try:
        uid = _uuid.UUID(user_id)
        now = datetime.now(timezone.utc)
        cid = None

        async with async_session_factory() as session:
            # Resolve or create conversation
            if conversation_id is not None:
                try:
                    cid = _uuid.UUID(conversation_id)
                except (ValueError, AttributeError):
                    logger.warning("Invalid conversation_id format '%s', creating new", conversation_id)
                    cid = None

                if cid is not None:
                    result = await session.execute(
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
                session.add(convo)
                await session.flush()
                cid = convo.id

            # Insert user message
            session.add(ChatMessage(
                conversation_id=cid,
                role="user",
                content=user_message,
            ))

            # Insert assistant message
            session.add(ChatMessage(
                conversation_id=cid,
                role="assistant",
                content=assistant_message,
                params={"tool_calls": tool_calls_made} if tool_calls_made else None,
                duration_ms=duration_ms,
            ))

            await session.flush()
            await session.commit()
            logger.debug("Persisted agent turn to conversation %s", cid)
            return str(cid)

    except Exception:
        logger.warning(
            "Failed to persist agent turn user_id=%s conversation_id=%s",
            user_id,
            conversation_id,
            exc_info=True,
        )
        return None


def _extract_response(response: types.GenerateContentResponse) -> tuple[str, list[dict]]:
    """Extract text and Google Search grounding sources from a Gemini response.

    Returns:
        (text, sources) where sources is a list of dicts with
        url, title, and cited_text keys.
    """
    # Text extraction — response.text concatenates all text parts
    try:
        text = response.text or ""
    except Exception:
        text = ""

    # Extract grounding metadata (from Google Search grounding)
    sources: list[dict] = []
    seen_urls: set[str] = set()
    try:
        candidates = response.candidates or []
        if candidates:
            metadata = getattr(candidates[0], "grounding_metadata", None)
            if metadata is not None:
                for chunk in getattr(metadata, "grounding_chunks", None) or []:
                    web = getattr(chunk, "web", None)
                    if web is None:
                        continue
                    url = getattr(web, "uri", None) or ""
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    sources.append({
                        "url": url,
                        "title": getattr(web, "title", None) or "",
                        "cited_text": "",  # Gemini doesn't provide cited_text
                    })
    except Exception:
        logger.debug("Failed to extract grounding metadata", exc_info=True)

    return text, sources


async def agent_chat(
    request: AgentRequest,
    db: AsyncSession,
    user_id: str,
    organization_id: str | None = None,
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
        client = create_gemini_client()
        model = get_gemini_model()

        # Load conversation history for multi-turn context
        history = await _load_conversation_history(db, user_id, request.conversation_id)
        contents = _history_to_contents(history, request.message)
        tool_calls_made: list[str] = []

        response = None  # will hold the latest Gemini response

        for _round in range(MAX_TOOL_ROUNDS):
            t0 = time.monotonic()
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=AGENT_SYSTEM_PROMPT,
                    tools=get_agent_tools(),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True,
                    ),
                ),
            )
            duration_ms = int((time.monotonic() - t0) * 1000)

            # Fire-and-forget usage logging
            await log_ai_usage(
                call_site="agent_chat",
                model=model,
                usage=response.usage_metadata,
                duration_ms=duration_ms,
            )

            function_calls = response.function_calls
            num_tool_calls = len(function_calls) if function_calls else 0

            logger.info(
                "agent_chat round=%d tool_calls=%d duration=%dms",
                _round,
                num_tool_calls,
                duration_ms,
            )

            # If Gemini finished (no tool calls), break
            if not function_calls:
                break

            # Execute each tool call and build function-response parts
            tool_response_parts: list[types.Part] = []

            for fc in function_calls:
                tool_calls_made.append(fc.name)
                try:
                    result_str = await execute_tool(
                        fc.name, fc.args or {}, db, user_id, organization_id
                    )
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result_str},
                        )
                    )
                except Exception as exc:
                    logger.error(
                        "Tool execution failed: tool=%s error=%s",
                        fc.name,
                        exc,
                        exc_info=True,
                    )
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"error": f"Tool {fc.name} mislukt: {exc}"},
                        )
                    )

            # Append the model's response (with tool-call parts) and tool results
            # response.candidates[0].content is the model Content with function_call parts
            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="user", parts=tool_response_parts))

        # Extract final text and Google Search grounding sources
        reply_text, sources = _extract_response(response) if response else ("", [])

        if not reply_text:
            reply_text = (
                "Ik kon geen antwoord genereren. Probeer het opnieuw "
                "of stel een andere vraag."
            )

        # Persist turn (fire-and-forget) and get conversation_id
        total_duration_ms = int((time.monotonic() - t0_total) * 1000)
        conv_id = await _persist_agent_turn(
            user_id, request.conversation_id,
            request.message, reply_text, tool_calls_made, total_duration_ms,
        )

        return AgentResponse(
            message=reply_text,
            conversation_id=conv_id or request.conversation_id,
            tool_calls_made=tool_calls_made,
            sources=sources,
        )

    except genai_errors.ClientError as exc:
        logger.error("Gemini API client error: %s", exc)
        return AgentResponse(
            message="De AI-service reageert niet correct. Probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )
    except genai_errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        return AgentResponse(
            message="De AI-service is momenteel niet bereikbaar. Probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )
    except Exception as exc:
        logger.exception("Unexpected error in agent_chat: %s", exc)
        return AgentResponse(
            message="Er is een onverwachte fout opgetreden. Probeer het later opnieuw.",
            conversation_id=request.conversation_id,
        )


async def agent_chat_stream(
    request: AgentRequest,
    db: AsyncSession,
    user_id: str,
    organization_id: str | None = None,
) -> AsyncGenerator[dict, None]:
    """Streaming variant of agent_chat that yields SSE events.

    Yields dicts with ``{"type": str, "data": dict}`` structure:
    - ``tool_start``  – a tool is about to execute
    - ``tool_end``    – a tool finished executing
    - ``text_delta``  – a chunk of the final response text
    - ``sources``     – grounding/citation metadata
    - ``done``        – generation complete
    - ``error``       – an error occurred
    """
    try:
        t0_total = time.monotonic()
        client = create_gemini_client()
        model = get_gemini_model()

        history = await _load_conversation_history(db, user_id, request.conversation_id)
        contents = _history_to_contents(history, request.message)
        tool_calls_made: list[str] = []

        response = None

        for _round in range(MAX_TOOL_ROUNDS):
            t0 = time.monotonic()

            logger.info("agent_chat_stream round=%d starting", _round)

            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=AGENT_SYSTEM_PROMPT,
                    tools=get_agent_tools(),
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True,
                    ),
                ),
            )
            duration_ms = int((time.monotonic() - t0) * 1000)

            await log_ai_usage(
                call_site="agent_chat_stream",
                model=model,
                usage=response.usage_metadata,
                duration_ms=duration_ms,
            )

            function_calls = response.function_calls
            num_tool_calls = len(function_calls) if function_calls else 0

            logger.info(
                "agent_chat_stream round=%d tool_calls=%d duration=%dms",
                _round, num_tool_calls, duration_ms,
            )

            if not function_calls:
                break

            # Execute each tool call, yielding progress events
            tool_response_parts: list[types.Part] = []

            for fc in function_calls:
                tool_calls_made.append(fc.name)
                yield {"type": "tool_start", "data": {"tool": fc.name}}

                try:
                    result_str = await execute_tool(
                        fc.name, fc.args or {}, db, user_id, organization_id
                    )
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result_str},
                        )
                    )
                    yield {"type": "tool_end", "data": {"tool": fc.name, "ok": True}}
                except Exception as exc:
                    logger.error(
                        "Tool execution failed: tool=%s error=%s",
                        fc.name, exc, exc_info=True,
                    )
                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"error": f"Tool {fc.name} mislukt: {exc}"},
                        )
                    )
                    yield {"type": "tool_end", "data": {"tool": fc.name, "ok": False, "error": str(exc)}}

            contents.append(response.candidates[0].content)
            contents.append(types.Content(role="user", parts=tool_response_parts))

        # Extract final text and sources
        reply_text, sources = _extract_response(response) if response else ("", [])

        if not reply_text:
            reply_text = (
                "Ik kon geen antwoord genereren. Probeer het opnieuw "
                "of stel een andere vraag."
            )

        # Stream text as a single delta (preserves markdown structure).
        # Note: Gemini responses arrive complete after the tool-calling loop —
        # word-level splitting is unnecessary and destroys markdown tables/lists.
        yield {"type": "text_delta", "data": {"text": reply_text}}

        # Sources
        yield {"type": "sources", "data": {"sources": sources}}

        # Done — yield with initial conversation_id
        total_duration_ms = int((time.monotonic() - t0_total) * 1000)

        # Persist turn (fire-and-forget) and get resolved conversation_id
        conv_id = await _persist_agent_turn(
            user_id, request.conversation_id,
            request.message, reply_text, tool_calls_made, total_duration_ms,
        )

        yield {
            "type": "done",
            "data": {
                "conversation_id": conv_id or request.conversation_id,
                "tool_calls_made": tool_calls_made,
                "duration_ms": total_duration_ms,
            },
        }

    except genai_errors.ServerError as exc:
        logger.error("Gemini API server error in stream: %s", exc)
        yield {"type": "error", "data": {"message": "De AI-service is momenteel niet bereikbaar. Probeer het later opnieuw."}}
    except genai_errors.ClientError as exc:
        logger.error("Gemini API client error in stream: %s", exc)
        yield {"type": "error", "data": {"message": "De AI-service reageert niet correct. Probeer het later opnieuw."}}
    except Exception as exc:
        logger.exception("Unexpected error in agent_chat_stream: %s", exc)
        yield {"type": "error", "data": {"message": "Er is een onverwachte fout opgetreden. Probeer het later opnieuw."}}
