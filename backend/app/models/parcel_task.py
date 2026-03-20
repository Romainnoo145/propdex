"""ParcelTask model — per-parcel task management with status tracking."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ParcelTask(Base, TimestampMixin):
    """
    Task associated with a parcel development opportunity.

    User-scoped via user_id. Tracks actions needed for a development
    (e.g., "Bodemonderzoek bestellen", "Vooroverleg inplannen").
    Can be auto-generated from actievoorstellen or manually created.
    """

    __tablename__ = "parcel_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Kadaster parcel identifier",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'todo'"),
        comment="todo / in_progress / done / skipped",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'gemiddeld'"),
        comment="hoog / gemiddeld / laag",
    )
    category: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="onderzoek / vergunning / financieel / juridisch / overig",
    )
    use_case: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        comment="optoppen / splitsen / transformatie / nieuwbouw or null for general",
    )
    deadline: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    source_actie_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="ID from actievoorstellen engine if auto-generated",
    )

    __table_args__ = (
        Index("ix_parcel_tasks_user_parcel", "user_id", "parcel_id"),
    )
