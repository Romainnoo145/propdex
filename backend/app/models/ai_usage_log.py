"""AI usage logging model for tracking Claude API calls."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AIUsageLog(Base):
    """
    Tracks every Claude API call across all call sites.

    Used for cost monitoring, usage analytics, and per-tenant billing attribution.
    Each row represents a single Claude API invocation with token counts and cost.
    """

    __tablename__ = "ai_usage_log"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    call_site: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Identifies the code path, e.g. 'bestemmingsplan_parsing'",
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    input_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    output_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    cache_creation_input_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    cache_read_input_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    total_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sum of input_tokens + output_tokens",
    )
    estimated_cost_usd: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    error: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_ai_usage_log_call_site", "call_site"),
        Index("ix_ai_usage_log_created_at", "created_at"),
        Index("ix_ai_usage_log_user_id", "user_id"),
    )
