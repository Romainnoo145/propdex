"""Cached API response model for government API data."""

import uuid
from datetime import datetime

from sqlalchemy import Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CachedAPIResponse(Base, TimestampMixin):
    """
    Cache table for government API responses.

    Stores API responses in JSONB format with TTL metadata for cache invalidation.
    Shared across all users — cache_key is globally unique.
    """

    __tablename__ = "cached_api_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    cache_key: Mapped[str] = mapped_column(
        nullable=False,
        index=False,  # Composite index defined in __table_args__
    )

    source: Mapped[str] = mapped_column(
        nullable=False,
        index=True,
    )

    response_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    fetched_at: Mapped[datetime] = mapped_column(
        nullable=False,
    )

    ttl_seconds: Mapped[int] = mapped_column(
        nullable=False,
    )

    __table_args__ = (
        Index("ix_cached_responses_key", "cache_key"),
        UniqueConstraint("cache_key", name="uq_cached_responses_key"),
    )
