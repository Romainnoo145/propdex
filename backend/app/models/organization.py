"""Organization model - root tenant entity."""

import uuid

from sqlalchemy import Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Organization(Base, TimestampMixin):
    """
    Organization model - represents a tenant in the multi-tenant system.

    This is the root entity for multi-tenancy. All other tenant-scoped models
    have a foreign key to this table via organization_id.

    NOTE: This table does NOT have RLS policies - it's the root tenant entity.
    """

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    freshness_threshold_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("24"),
        comment="Hours before cached data is considered stale. Minimum enforced in application code.",
    )
    score_weights: Mapped[dict | None] = mapped_column(
        type_=JSONB,
        nullable=True,
        default=None,
        comment="Per-org score weight config: {preset, potentie_risico_balance, potentie_weights, risico_weights}",
    )
