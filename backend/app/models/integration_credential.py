"""IntegrationCredential — vendor-managed encrypted credential storage.

Eng-review locked 2026-05-14 + 2026-05-16: no tenant scoping mixin. RBAC at the route
layer via Depends(get_current_superuser). One row per (source_key, credential_name)
pair across the entire platform — Propdex BV brings its own subscriptions for
Type-C cascade integrations (BRK, Vindsubsidies, NVM).

`encrypted_value` stores the Fernet token produced by
`app.services.credential_crypto.encrypt()`. Plaintext NEVER touches the DB.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class IntegrationCredential(Base, TimestampMixin):
    """One encrypted credential value for an (source_key, credential_name) pair."""

    __tablename__ = "integration_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    source_key: Mapped[str] = mapped_column(String(64), nullable=False)
    credential_name: Mapped[str] = mapped_column(String(64), nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_rotated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "source_key",
            "credential_name",
            name="uq_integration_credentials_source_name",
        ),
    )
