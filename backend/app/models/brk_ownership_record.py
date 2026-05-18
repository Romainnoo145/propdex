"""BrkOwnershipRecord — persistent BRK eigendomsdata (M050/S01).

Per ENG-PLAN locked 2026-05-18 (M050-S01-ENG-PLAN.md):
- rechtspersoon + overheid only (DB CHECK + AVG Tier-3 defense-in-depth, D1)
- eigenaar_naam nullable at DB; service-layer rejects NULL for rechtspersoon (D8)
- UNIQUE (org, parcel, fetched_at) keeps historical rows for koopwaarde_trend (D5)
- retention: soft_deleted_at = NOW() at unfavorite; hard_delete_after = soft_deleted_at + 60d
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class BrkOwnershipRecord(Base, TenantMixin, TimestampMixin):
    """One persisted BRK eigendomsrecord (rechtspersoon or overheid)."""

    __tablename__ = "brk_ownership_records"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    parcel_id: Mapped[str] = mapped_column(String(64), nullable=False)
    eigenaar_type: Mapped[str] = mapped_column(String(32), nullable=False)
    eigenaar_naam: Mapped[str | None] = mapped_column(Text, nullable=True)
    kvk_nummer: Mapped[str | None] = mapped_column(String(8), nullable=True)
    statutaire_zetel: Mapped[str | None] = mapped_column(Text, nullable=True)
    zakelijk_recht_type: Mapped[str | None] = mapped_column(
        String(32), nullable=True,
    )
    aandeel: Mapped[str | None] = mapped_column(Text, nullable=True)
    koopsom: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    koopjaar: Mapped[int | None] = mapped_column(Integer, nullable=True)
    heeft_hypotheek: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
    )
    raw_brk_response: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True,
    )
    fetched_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    soft_deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=True,
    )
    hard_delete_after: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=False),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "eigenaar_type IN ('rechtspersoon', 'overheid')",
            name="eigenaar_type_check",
        ),
        UniqueConstraint(
            "organization_id",
            "parcel_id",
            "fetched_at",
            name="uq_brk_org_parcel_fetched",
        ),
        Index(
            "idx_brk_org_parcel",
            "organization_id",
            "parcel_id",
        ),
        Index(
            "idx_brk_hard_delete",
            "hard_delete_after",
            postgresql_where=text("soft_deleted_at IS NOT NULL"),
        ),
    )
