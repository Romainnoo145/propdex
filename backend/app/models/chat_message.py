"""Chat message model for individual turns in a Verkenner conversation."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ChatMessage(Base):
    """
    A single user or assistant message within a ChatConversation.

    Stores the raw content, detected intent, parsed params, full
    response payload (for DeepEval), and performance metrics.
    """

    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="'user' or 'assistant'",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    intent: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )
    params: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    response_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Full response payload for DeepEval evaluation",
    )
    tokens_used: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    conversation: Mapped["ChatConversation"] = relationship(
        "ChatConversation",
        back_populates="messages",
    )

    __table_args__ = (
        Index("ix_chat_messages_conversation_id", "conversation_id"),
        Index("ix_chat_messages_created_at", "created_at"),
    )
