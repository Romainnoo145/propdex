"""SQLAlchemy base models and mixins."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models using SQLAlchemy 2.x mapped_column syntax."""

    pass


class TenantMixin:
    """
    Mixin for multi-tenant models.

    Adds organization_id foreign key for tenant isolation.
    All queries MUST filter by organization_id to prevent cross-tenant data leakage.

    NOTE: The root Organization model itself does NOT use this mixin.
    """

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
