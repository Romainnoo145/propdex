"""ScanResult model for linking scans to individual cached parcels."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ScanResult(Base):
    """
    ScanResult model - one row per parcel.

    Each record represents the latest scan data for a specific parcel.
    When a newer wijk scan covers the same parcel, the existing row is
    updated (scan_id, score, flags) rather than creating a duplicate.

    This ensures each parcel appears in exactly ONE scan_result, preventing
    data duplication from overlapping wijk bounding boxes.

    Shared data — visible to all authenticated users.
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
    score: Mapped[float | None] = mapped_column(nullable=True)
    flags: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "parcel_id",
            name="uq_scan_results_parcel",
        ),
    )
