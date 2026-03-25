"""BulkQuery model for persisting natural-language parcel search queries."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BulkQuery(Base, TimestampMixin):
    """Persisted bulk query record.

    Stores the original natural-language query, Claude's parsed filter
    parameters, execution results, and status. Used for audit trail and
    result retrieval in S02.

    Status values:
    - ``completed``: query parsed and executed successfully
    - ``unsupported``: query asks for dimensions outside the 6 supported filters
    - ``failed``: parsing or execution error (see ``parsed_query`` for details)
    """

    __tablename__ = "bulk_queries"

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

    parsed_query: Mapped[dict | None] = mapped_column(
        type_=JSONB,
        nullable=True,
    )

    result_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    results: Mapped[list | None] = mapped_column(
        type_=JSONB,
        nullable=True,
    )

    __table_args__ = (
        Index("ix_bulk_queries_user_id", "user_id"),
        Index("ix_bulk_queries_status", "status"),
    )
