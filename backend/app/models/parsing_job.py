"""AI parsing job metadata model for tenant-scoped job tracking."""

import uuid

from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class ParsingJob(Base, TenantMixin, TimestampMixin):
    """
    AI parsing job metadata for tenant-scoped job tracking.

    Stores job_id from ARQ alongside plan_idn and organization_id.
    Enables tenant isolation: job status endpoint validates organization ownership.
    """

    __tablename__ = "parsing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    job_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="ARQ job identifier",
    )
    plan_idn: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="IMRO plan identifier being parsed",
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
        Index("ix_parsing_jobs_org_plan", "organization_id", "plan_idn"),
    )
