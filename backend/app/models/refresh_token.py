"""RefreshToken model for JWT token rotation."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class RefreshToken(Base, TenantMixin, TimestampMixin):
    """
    RefreshToken model for secure token rotation.

    Implements JWT refresh token rotation pattern:
    - Each refresh token has a unique jti (JWT ID)
    - When refreshed, old token is revoked and new one issued
    - Supports "revoke all user tokens" for security incidents

    Multi-tenant: Uses TenantMixin for organization_id.
    RLS policies enabled for defense-in-depth.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    jti: Mapped[str] = mapped_column(
        String(36),  # UUID string format
        unique=True,
        nullable=False,
        index=True,  # Fast lookup for token validation
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        nullable=False,
    )
    revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
    )

    __table_args__ = (
        # Composite indexes with organization_id first for multi-tenant queries
        Index("ix_refresh_tokens_org_user", "organization_id", "user_id"),
        # Index for "revoke all user tokens" operation
        Index("ix_refresh_tokens_user_revoked", "user_id", "revoked"),
    )
