"""Per-parcel favorites model for portfolio pipeline tracking."""

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ParcelFavorite(Base, TimestampMixin):
    """
    Parcel favorited by a user, with pipeline stage tracking.

    User-scoped — each user has their own favorites. Stores the Kadaster
    string parcel_id directly (not FK to parcel_cache) so favorites survive
    cache flushes. Location context (gemeente, wijk) is denormalized at
    write time from the frontend's active scan context.
    """

    __tablename__ = "parcel_favorites"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    parcel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Kadaster parcel ID (e.g. HTT02-A-1234)",
    )
    parcel_cache_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="FK to parcel_cache.id -- populated after parcel_code unification",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="User who favorited this parcel",
    )
    gemeente_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="CBS gemeente code (e.g. 0983)",
    )
    gemeente_naam: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Municipality name",
    )
    wijk_naam: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment=(
            "Wijk name from scan context — NOTE: BACK-01 specifies wijk_code but "
            "no wijk_code column exists anywhere in the codebase; wijk_naam is the "
            "deliberate substitution per RESEARCH.md findings"
        ),
    )
    address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Denormalized BAG address for display",
    )
    pipeline_stage: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'Gesignaleerd'"),
        comment="Pipeline stage: Gesignaleerd/Onderzoek/Contact/Besluit/Afgerond",
    )
    afgerond_reden: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        comment="Reason when Afgerond: Gekocht or Afgewezen",
    )
    notitie: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional note (used with Afgerond)",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "parcel_id",
            name="uq_parcel_favorites_user_parcel",
        ),
        Index("ix_parcel_favorites_user", "user_id"),
        Index("ix_parcel_favorites_user_gemeente", "user_id", "gemeente_code"),
    )
