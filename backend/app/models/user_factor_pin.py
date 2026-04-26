"""UserFactorPin model — per-user persistent pins of factor cards in Potentie/Risico layer.

Phase 7 (M048/S04) — PIN-02. Mirror of RefreshToken model shape.
"""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class UserFactorPin(Base, TenantMixin, TimestampMixin):
    """
    Per-user persistent pin of a factor card in the ParcelDetailModal.

    IMPORTANT NAMING: `category` here is the parent TAB ("potentie" | "risico"),
    NOT the bron-groep (gemeente_beleid/markt/fysiek/klimaat/juridisch/planologisch)
    that lives on FACTOR_REGISTRY.bron. This naming clash is intentional — the
    column name was decided in CONTEXT before the registry field was named.

    Multi-tenant: TenantMixin enforces organization_id presence; routers MUST
    explicitly filter on organization_id == current_user.organization_id —
    no implicit middleware magic.

    Position: monotonically increasing per (user_id, category). Gaps allowed
    when middle pins are deleted. Frontend sorts by position ASC.
    """

    __tablename__ = "user_factor_pins"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    factor_key: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "factor_key",
            name="uq_user_factor_pins_user_cat_key",
        ),
        Index("ix_user_factor_pins_lookup", "user_id", "category"),
    )
