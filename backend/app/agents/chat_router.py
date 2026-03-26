"""FastAPI router for the Verkenner chat endpoint."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.chat_schemas import ChatRequest, ChatResponse
from app.agents.chat_service import dispatch_chat
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Agents"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Conversational Verkenner endpoint.

    Classifies the user's natural language message into an intent,
    dispatches to the appropriate handler, and returns structured results.

    Supports multi-turn refinement via previous_intent/previous_params.
    """
    logger.info(
        "Chat request from user=%s: %s (prev_intent=%s)",
        user.id,
        body.message[:80],
        body.previous_intent,
    )

    response = await dispatch_chat(body, db, str(user.id))

    logger.info(
        "Chat response: intent=%s count=%s",
        response.intent,
        response.count,
    )

    return response
