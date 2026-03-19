"""AI jurisprudence analysis job metadata model for shared job tracking."""

import uuid

from sqlalchemy import Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class JuridischAnalyseJob(Base, TimestampMixin):
    """
    AI jurisprudence analysis job metadata for job tracking.

    Stores job_id from ARQ alongside gemeente_naam and ecli_list.
    Shared across all users — analysis results are reusable for any gemeente.
    """

    __tablename__ = "juridisch_analyse_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    job_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
        index=True,
        comment="ARQ job identifier (set after enqueue)",
    )
    gemeente_naam: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Municipality name for the analysis",
    )
    ecli_list: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        comment="List of ECLI identifiers to analyze",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        comment="Job status: queued, in_progress, complete, failed",
    )
    error_message: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="Error message if job failed",
    )

    __table_args__ = (
        Index(
            "ix_juridisch_analyse_jobs_gemeente",
            "gemeente_naam",
        ),
    )
