"""Per-parcel document storage model for dossier uploads."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, LargeBinary, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ParcelDocument(Base, TimestampMixin):
    """
    Document attached to a specific parcel within a dossier category.

    User-scoped via uploaded_by_user_id. Supports PDF, images, DOCX, and
    XLSX uploads (max 25MB). Stored in PostgreSQL with LargeBinary.
    """

    __tablename__ = "parcel_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Kadaster parcel identifier",
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Dossier category key (e.g. bestemmingscheck, bodem, fundering)",
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original upload filename",
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (application/pdf, image/jpeg, etc.)",
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
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who uploaded the document",
    )

    __table_args__ = (
        Index("ix_parcel_documents_user_parcel", "uploaded_by_user_id", "parcel_id"),
        Index(
            "ix_parcel_documents_user_parcel_type",
            "uploaded_by_user_id",
            "parcel_id",
            "document_type",
        ),
    )
