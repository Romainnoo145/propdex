"""Policy document storage model for beleidsconfiguratie uploads."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, LargeBinary, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class PolicyDocument(Base, TenantMixin, TimestampMixin):
    """
    Document attached to a policy entity (gemeente/provincie/landelijk) within a data source category.

    Organization-scoped via TenantMixin. Supports PDF uploads (max 25MB).
    Stored in PostgreSQL with LargeBinary.

    entity_type + entity_code + source_key uniquely identifies the policy context.
    Multiple documents per context are allowed (versioning, supplements).
    """

    __tablename__ = "policy_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    entity_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Level: 'gemeente', 'provincie', or 'landelijk'",
    )
    entity_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Entity identifier: GM0363, PV26, or NL",
    )
    source_key: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Data source key (e.g. welstandsnota, omgevingsvisie, parkeerbeleid)",
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original upload filename",
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type (application/pdf, etc.)",
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
    status: Mapped[str] = mapped_column(
        String(20),
        server_default=text("'uploaded'"),
        nullable=False,
        comment="Processing status: uploaded, parsing, parsed, error",
    )
    ai_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="AI-generated summary of document contents (future)",
    )

    __table_args__ = (
        Index("ix_policy_documents_entity", "entity_type", "entity_code"),
        Index("ix_policy_documents_org_entity", "organization_id", "entity_type", "entity_code"),
        Index("ix_policy_documents_source", "entity_type", "entity_code", "source_key"),
    )
