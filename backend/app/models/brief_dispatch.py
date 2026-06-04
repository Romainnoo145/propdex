"""M052/S04 — dispatch-metadata (GEEN brief-inhoud → geen PII-opslag).

Slaat uitsluitend metadata op (org, parcel, status, template, dispatcher, sent_at);
de brief-markdown wordt bewust NIET gepersisteerd (AVG/PII).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BriefDispatch(Base):
    """Eén verzonden-brief metadata-record (geen brief-inhoud)."""

    __tablename__ = "brief_dispatches"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    parcel_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    template_id: Mapped[str] = mapped_column(String(64), nullable=False)
    dispatcher: Mapped[str] = mapped_column(String(32), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_brief_dispatches_org_parcel",
            "organization_id",
            "parcel_id",
        ),
    )
