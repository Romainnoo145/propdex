"""SavedReport model for storing property intelligence reports."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SavedReport(Base, TimestampMixin):
    """
    SavedReport model for storing complete property intelligence reports.

    Stores full PropertyReportResponse as JSONB with denormalized fields
    for filtering and search. User-scoped — each user owns their reports.
    Supports soft-delete for recoverable deletion.
    """

    __tablename__ = "saved_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who created this report",
    )

    report_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    report_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    postcode: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    source_parcel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="SET NULL"),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    __table_args__ = (
        Index("ix_saved_reports_user_created", "user_id", "created_at"),
        Index("ix_saved_reports_user_city", "user_id", "city"),
        Index("ix_saved_reports_user_project", "user_id", "project_id"),
        Index("ix_saved_reports_user_source_parcel", "user_id", "source_parcel_id"),
        Index(
            "uq_saved_reports_user_source_parcel_active",
            "user_id",
            "source_parcel_id",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND source_parcel_id IS NOT NULL"
            ),
        ),
        Index(
            "ix_saved_reports_name_gin",
            "report_name",
            postgresql_using="gin",
            postgresql_ops={"report_name": "gin_trgm_ops"},
        ),
        Index("ix_saved_reports_deleted", "deleted_at"),
    )
