"""SQLAlchemy model for platform-wide professional directory."""

import uuid

from sqlalchemy import Boolean, Index, String, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Professional(Base, TimestampMixin):
    """
    Platform-wide professional (kwaliteitsborger) directory entry.

    CRITICAL ARCHITECTURAL PATTERN: No TenantMixin — no organization_id.
    Professionals are a platform resource visible to ALL tenants (DIR-03).
    RLS policy: FOR SELECT USING (TRUE) — any authenticated session can read.
    Insert/update/delete is restricted at the application level (admin API key required).
    """

    __tablename__ = "professionals"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        nullable=False,
    )
    naam: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    bedrijfsnaam: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    werkgebied: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    gevolgklassen: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
    )
    telefoon: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    website: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    tlokb_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
    )

    __table_args__ = (
        # GIN indexes for efficient ARRAY containment queries (@> operator)
        Index(
            "ix_professionals_werkgebied_gin",
            "werkgebied",
            postgresql_using="gin",
        ),
        Index(
            "ix_professionals_gevolgklassen_gin",
            "gevolgklassen",
            postgresql_using="gin",
        ),
        # btree indexes for standard lookups
        Index("ix_professionals_naam", "naam"),
        Index("ix_professionals_is_active", "is_active"),
    )
