"""ScanResult model for linking scans to individual cached parcels."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin


class ScanResult(Base, TenantMixin):
    """
    ScanResult model - join table linking AreaScan to ParcelCache.

    Each record represents one parcel discovered during a specific area scan.
    Instead of storing bulk JSONB blobs, we maintain foreign key links to
    individual cached parcels for referential integrity and efficient querying.

    Stores scan-specific metadata like score and flags computed during the scan.
    Results are immutable once created (no updated_at needed).

    Multi-tenant isolated via organization_id.
    """

    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    scan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("area_scans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    parcel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parcel_cache.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Scan-specific data (per-parcel results within this scan)
    # Score or flags computed during scan
    score: Mapped[float | None] = mapped_column(nullable=True)
    flags: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_scan_results_scan_parcel", "scan_id", "parcel_id"),
        UniqueConstraint("scan_id", "parcel_id", name="uq_scan_results_scan_parcel"),
    )
