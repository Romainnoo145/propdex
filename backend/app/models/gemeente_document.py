"""Per-gemeente document storage for beleidsdocumenten."""

import uuid

from sqlalchemy import Index, Integer, LargeBinary, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GemeenteDocument(Base, TimestampMixin):
    """Document attached to a municipality (not a specific parcel).

    Used for beleidsdocumenten like omgevingsvisie, woonvisie, welstandsnota,
    parkeernormen, grondbeleid, and huisvestingsverordening. These are
    auto-ingested from KOOP SRU / officielebekendmakingen.nl.
    """

    __tablename__ = "gemeente_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    gemeente_naam: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Municipality display name (e.g. Amsterdam, Venlo)",
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Beleidsdocument type (e.g. omgevingsvisie, woonvisie)",
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original or derived filename",
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (application/pdf, text/html, etc.)",
    )
    file_data: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
        comment="File bytes (max 25MB)",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes",
    )
    source_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="URL on officielebekendmakingen.nl",
    )
    koop_identifier: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="KOOP SRU document identifier (e.g. cvdr-12345)",
    )
    ai_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="AI-generated summary of the document content",
    )

    __table_args__ = (
        Index("ix_gemeente_documents_naam", "gemeente_naam"),
        Index("ix_gemeente_documents_naam_type", "gemeente_naam", "document_type"),
        UniqueConstraint("gemeente_naam", "koop_identifier", name="uq_gemeente_doc_identifier"),
    )
