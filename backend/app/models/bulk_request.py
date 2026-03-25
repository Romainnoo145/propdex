"""BulkRequest model for manually submitted queries that need admin handling."""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BulkRequest(Base, TimestampMixin):
    """Manually submitted query request for admin review.

    Created when a user submits an unsupported query that can't be
    auto-resolved against parcel_cache. Admin can review, process
    manually, and link results.

    Status values:
    - ``pending``: awaiting admin review
    - ``completed``: admin processed and optionally linked results
    - ``rejected``: admin declined the request
    """

    __tablename__ = "bulk_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    query_text: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'pending'"),
    )

    admin_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # If admin processes the request and creates a BulkQuery with results
    results_query_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bulk_queries.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_bulk_requests_user_id", "user_id"),
        Index("ix_bulk_requests_status", "status"),
    )
