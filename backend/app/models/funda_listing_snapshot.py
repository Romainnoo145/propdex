"""Listing snapshots from Funda for market-friction signals."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class FundaListingSnapshot(Base, TenantMixin, TimestampMixin):
    """
    Daily snapshot of a single Funda listing.

    Used to derive:
    - listing_duration_days (first_seen -> last_seen)
    - price_change_count (distinct price points over time)
    """

    __tablename__ = "funda_listing_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    source: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="funda",
        server_default=text("'funda'"),
        index=True,
    )

    listing_external_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )
    listing_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    area_name: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    snapshot_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    postcode: Mapped[str | None] = mapped_column(String(7), nullable=True, index=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    price_eur: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    listing_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    offered_since_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    matched_parcel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    metadata_json: Mapped[dict | None] = mapped_column(
        type_=JSONB,
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "source",
            "listing_external_id",
            "snapshot_date",
            name="uq_funda_listing_snapshots_org_source_listing_day",
        ),
        Index(
            "ix_funda_listing_snapshots_org_parcel_day",
            "organization_id",
            "matched_parcel_id",
            "snapshot_date",
        ),
    )
