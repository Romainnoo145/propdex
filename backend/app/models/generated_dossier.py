"""GeneratedDossier model for audit trail of generated PDF dossiers."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class GeneratedDossier(Base, TenantMixin, TimestampMixin):
    """
    GeneratedDossier model for tracking generated Risicobeoordeling Startdossier PDFs.

    Each row represents one PDF generation event. Provides an audit trail for
    compliance and allows users to see when dossiers were generated and by whom.
    Multi-tenant isolated via organization_id (from TenantMixin).
    """

    __tablename__ = "generated_dossiers"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("saved_reports.id", ondelete="CASCADE"),
        nullable=False,
    )

    generated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    template_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'v1'"),
    )

    __table_args__ = (
        Index("ix_generated_dossiers_org_report", "organization_id", "report_id"),
        Index("ix_generated_dossiers_org_created", "organization_id", "created_at"),
    )
