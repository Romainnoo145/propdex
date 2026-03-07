"""AI jurisprudence analysis job metadata model for tenant-scoped job tracking."""

import uuid

from sqlalchemy import Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class JuridischAnalyseJob(Base, TenantMixin, TimestampMixin):
    """
    AI jurisprudence analysis job metadata for tenant-scoped job tracking.

    Stores job_id from ARQ alongside gemeente_naam, ecli_list, and organization_id.
    Enables tenant isolation: job status endpoint validates organization ownership.
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
            "ix_juridisch_analyse_jobs_org_gemeente",
            "organization_id",
            "gemeente_naam",
        ),
    )
