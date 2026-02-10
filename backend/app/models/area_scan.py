"""AreaScan model for tracking area intelligence scan jobs."""

import uuid
from datetime import datetime

from sqlalchemy import Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class AreaScan(Base, TenantMixin, TimestampMixin):
    """
    AreaScan model for tracking area intelligence scan jobs.

    Tracks the status and progress of scan operations that process all parcels
    in a given gemeente bounding box. Each scan generates multiple ScanResult
    records linking to individual ParcelCache entries.

    Status flow: pending -> running -> (completed | failed)
    Progress phases: fetching_parcels -> cross_referencing_bag -> querying_bestemmingen

    Multi-tenant isolated via organization_id.
    """

    __tablename__ = "area_scans"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Gemeente identification
    gemeente_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    gemeente_naam: Mapped[str] = mapped_column(String(100), nullable=False)

    # Bounding box used for the scan (EPSG:28992, stored as 4 floats)
    bbox_minx: Mapped[float] = mapped_column(nullable=False)
    bbox_miny: Mapped[float] = mapped_column(nullable=False)
    bbox_maxx: Mapped[float] = mapped_column(nullable=False)
    bbox_maxy: Mapped[float] = mapped_column(nullable=False)

    # Status tracking
    # pending = queued, running = ARQ job active, completed = done, failed = error
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True,
    )

    # Progress tracking
    progress_pct: Mapped[int] = mapped_column(default=0, nullable=False)
    # Current phase: "fetching_parcels", "cross_referencing_bag", "querying_bestemmingen"
    current_phase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parcels_total: Mapped[int] = mapped_column(default=0, nullable=False)
    parcels_processed: Mapped[int] = mapped_column(default=0, nullable=False)
    parcels_failed: Mapped[int] = mapped_column(default=0, nullable=False)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # ARQ job reference
    job_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    __table_args__ = (
        Index("ix_area_scans_org_status", "organization_id", "status"),
        Index("ix_area_scans_org_gemeente", "organization_id", "gemeente_code"),
    )
