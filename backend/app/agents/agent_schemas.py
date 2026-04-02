"""Pydantic schemas for the Propdex Verkenner agent endpoint."""

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    """Incoming message to the agent endpoint."""

    message: str = Field(
        min_length=1,
        max_length=2000,
        description="User's natural-language question (any language, response always Dutch).",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Conversation thread ID — omit for first message, echo back for follow-ups.",
    )


class AgentResponse(BaseModel):
    """Agent response returned to the frontend."""

    message: str = Field(
        description="Agent's Dutch-language reply.",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Conversation thread ID for follow-up messages.",
    )
    tool_calls_made: list[str] = Field(
        default_factory=list,
        description="Names of tools invoked during this turn.",
    )
    structured_blocks: list[dict] = Field(
        default_factory=list,
        description="Structured data blocks for frontend rendering (placeholder for S03).",
    )
    sources: list[dict] = Field(
        default_factory=list,
        description="Web search citation sources with url, title, cited_text.",
    )
