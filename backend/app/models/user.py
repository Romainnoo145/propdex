"""User model with multi-tenant support."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class User(Base, TenantMixin, TimestampMixin):
    """
    User model with email/password and OAuth support.

    Multi-tenant: Uses TenantMixin for organization_id.
    Authentication: Supports both email/password and Google OAuth.
    Email verification: Required with grace period enforcement.

    Security notes:
    - Email is globally unique (identity across organizations)
    - Passwords hashed with Argon2id via pwdlib
    - RLS policies enabled for defense-in-depth
    - Composite indexes with organization_id first for query performance
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(
        String(320),  # RFC 5321 max email length
        unique=True,
        nullable=False,
    )
    hashed_password: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,  # Nullable for OAuth users who have no password
    )
    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )
    auth_provider: Mapped[str] = mapped_column(
        String(20),
        default="email",
        nullable=False,
    )
    google_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        # Composite indexes with organization_id first for multi-tenant query performance
        Index("ix_users_org_id", "organization_id", "id"),
        Index("ix_users_org_email", "organization_id", "email"),
        Index("ix_users_org_created", "organization_id", "created_at"),
    )
