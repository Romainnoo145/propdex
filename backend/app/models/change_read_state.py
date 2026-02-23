"""ChangeReadState model for tracking per-user per-change read state."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class ChangeReadState(Base, TenantMixin):
    """
    ChangeReadState model - tracks which changes each user has read.

    Replaces the project-level last_viewed_at timestamp approach with
    per-change read state. A change is "unread" if NO matching row
    exists in this table for (user_id, change_id).

    Design:
    - Insert-only (no updates) -- read state is either present or absent
    - UniqueConstraint ensures idempotent mark-as-read
    - ondelete=CASCADE on both FKs -- cleanup is automatic
    - No TimestampMixin (no updated_at needed)

    Multi-tenant isolated via organization_id.
    """

    __tablename__ = "change_read_states"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    change_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("change_records.id", ondelete="CASCADE"),
        nullable=False,
    )

    read_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "change_id",
            name="uq_change_read_states_user_change",
        ),
        Index("ix_change_read_states_user_change", "user_id", "change_id"),
    )
