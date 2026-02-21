"""ChangeRecord model for storing detected permit and zoning changes."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class ChangeRecord(Base, TenantMixin, TimestampMixin):
    """
    ChangeRecord model - stores detected changes from external APIs.

    Tracks two types of changes:
    - "permit": Building permits from Omgevingsloket API
    - "zoning": Zoning plan changes from Ruimtelijkeplannen.nl API

    Multi-tenant isolated via organization_id.
    Changes are immutable once detected (created_at/updated_at from TimestampMixin).
    """

    __tablename__ = "change_records"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    change_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    external_id: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    detected_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    change_date: Mapped[datetime] = mapped_column(
        nullable=False,
    )

    gemeente_naam: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Store raw API response for debugging and future enrichment
    # Named metadata_json in code to avoid collision with SQLAlchemy metadata attribute
    metadata_json: Mapped[dict] = mapped_column(
        name="change_metadata",
        type_=JSONB,
        nullable=False,
    )

    source_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Extracted Dutch postcode for matching against parcels/reports
    postcode: Mapped[str | None] = mapped_column(
        String(7),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        Index("ix_change_records_project_detected", "project_id", "detected_at"),
        UniqueConstraint(
            "change_type",
            "external_id",
            "gemeente_naam",
            "project_id",
            name="uq_change_records_type_external_gemeente_project",
        ),
    )
