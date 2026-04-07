"""FastAPI router for the Verkenner agent chat endpoint."""

import json
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.agent_schemas import AgentRequest, AgentResponse
from app.agents.agent_service import agent_chat, agent_chat_stream
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User

# Keep old imports available for other modules that may reference them
from app.agents.chat_schemas import ChatRequest, ChatResponse  # noqa: F401
from app.agents.chat_service import dispatch_chat  # noqa: F401

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Agents"])


@router.post("/chat", response_model=AgentResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    body: AgentRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AgentResponse:
    """Agentic Verkenner endpoint.

    Sends the user's natural-language message to the Claude tool-calling
    agent loop, which can query favorites and reports, and returns a
    Dutch-language response.
    """
    logger.info(
        "Agent chat request from user=%s: %s",
        user.id,
        body.message[:80],
    )

    response = await agent_chat(body, db, str(user.id), str(user.organization_id))

    logger.info(
        "Agent chat response: tools_used=%s message_len=%d",
        response.tool_calls_made,
        len(response.message),
    )

    return response


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(
    request: Request,
    body: AgentRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """Streaming agentic Verkenner endpoint (SSE).

    Returns a Server-Sent Events stream with real-time tool-progress
    indicators and word-by-word response text.
    """
    logger.info(
        "Agent stream request from user=%s: %s",
        user.id,
        body.message[:80],
    )

    async def event_generator():
        async for event in agent_chat_stream(body, db, str(user.id), str(user.organization_id)):
            yield {
                "event": event["type"],
                "data": json.dumps(event["data"]),
            }

    return EventSourceResponse(event_generator())
