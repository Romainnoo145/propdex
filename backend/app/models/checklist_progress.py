"""Per-parcel checklist progress model for vergunning workflow tracking."""

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ChecklistProgress(Base, TimestampMixin):
    """
    Tracks which checklist items a user has checked off for a given parcel
    and use case (optoppen/splitsen/transformatie/nieuwbouw).

    User-scoped — each user has their own progress. Stores checked item IDs
    as a JSON array (e.g. ["nbw-01", "nbw-05"]) rather than per-item rows,
    since progress is always fetched/saved as a whole set.
    """

    __tablename__ = "checklist_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who owns this progress",
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Kadaster parcel ID (e.g. HTT02-A-1234)",
    )
    use_case: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="Checklist use case: optoppen/splitsen/transformatie/nieuwbouw",
    )
    checked_items: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
        comment="Array of checked item IDs, e.g. ['nbw-01', 'nbw-05']",
    )
    uploaded_documents: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        comment="Map of item_id → document_id for manually uploaded docs",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "parcel_id",
            "use_case",
            name="uq_checklist_progress_user_parcel_usecase",
        ),
        Index("ix_checklist_progress_user_parcel", "user_id", "parcel_id"),
    )
