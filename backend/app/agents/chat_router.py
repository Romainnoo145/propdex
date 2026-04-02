"""FastAPI router for the Verkenner agent chat endpoint."""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_schemas import AgentRequest, AgentResponse
from app.agents.agent_service import agent_chat
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

    response = await agent_chat(body, db, str(user.id))

    logger.info(
        "Agent chat response: tools_used=%s message_len=%d",
        response.tool_calls_made,
        len(response.message),
    )

    return response
