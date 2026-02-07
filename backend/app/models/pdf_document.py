"""PDF document storage model for bestemmingsplan PDFs."""

import uuid

from sqlalchemy import Index, Integer, LargeBinary, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PDFDocument(Base, TenantMixin, TimestampMixin):
    """
    Bestemmingsplan PDF storage with metadata.

    PDFs stored permanently linked to plan_idn for reuse across addresses.
    Multiple addresses in the same bestemmingsplan area share the same PDF.
    """

    __tablename__ = "pdf_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    plan_idn: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="IMRO plan identifier (NL.IMRO.{gemeente}.{plan}-{version})",
    )
    file_data: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
        comment="PDF file bytes (max 100MB)",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    source_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Original download URL",
    )
    is_user_uploaded: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="True if manually uploaded, False if auto-downloaded",
    )

    __table_args__ = (
        Index("ix_pdf_documents_org_plan", "organization_id", "plan_idn"),
    )
