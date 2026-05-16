"""Generic AuditLog model — first emitter is credential rotation (M049/S05).

No tenant scoping mixin: superuser-only actions at this stage. The schema is intentionally
generic (action / target_type / target_id) so future features can emit audit
events without schema changes (eng-review locked 2026-05-16).

'metadata' is reserved on DeclarativeBase, so we map the Python attribute
`event_metadata` to the DB column 'metadata'.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    """Append-only audit trail.

    First emitter (M049/S05): credential rotation events with
    action="credential_rotated", target_type="integration_credential",
    target_id=str(credential.id).
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_metadata: Mapped[dict[str, object] | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )

    __table_args__ = (
        Index("ix_audit_logs_target", "target_type", "target_id"),
        Index("ix_audit_logs_action", "action"),
    )
